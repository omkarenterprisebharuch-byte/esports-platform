/**
 * API Response Caching Layer
 * 
 * Provides a higher-level caching abstraction for API routes.
 * Integrates with the Redis cache layer and adds:
 * - Automatic cache key generation from requests
 * - Stale-while-revalidate pattern
 * - Cache tags for targeted invalidation
 * - Response headers for client-side caching
 * 
 * Usage:
 *   import { withCache, CacheTags } from "@/lib/api-cache";
 *   
 *   export async function GET(request: NextRequest) {
 *     return withCache(request, {
 *       keyPrefix: "leaderboard",
 *       ttl: TTL.MEDIUM,
 *       tags: [CacheTags.LEADERBOARD],
 *       fetcher: async () => {
 *         // Your database query here
 *         return data;
 *       }
 *     });
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { cache, TTL, invalidatePattern, del } from "./redis";
import { successResponse } from "./api-response";

// ============ Cache Tags for Targeted Invalidation ============

export const CacheTags = {
  TOURNAMENTS: "tournaments",
  TOURNAMENT: "tournament",
  LEADERBOARD: "leaderboard",
  TEAMS: "teams",
  USERS: "users",
  HALL_OF_FAME: "hof",
  STATS: "stats",
  REGISTRATIONS: "registrations",
} as const;

export type CacheTag = (typeof CacheTags)[keyof typeof CacheTags];

// ============ Cache Key Generation ============

/**
 * Generate a cache key from a request
 */
export function generateCacheKey(
  request: NextRequest,
  options: {
    prefix: string;
    includeParams?: boolean;
    excludeParams?: string[];
    customKey?: string;
  }
): string {
  const { prefix, includeParams = true, excludeParams = [], customKey } = options;

  if (customKey) {
    return `api:${prefix}:${customKey}`;
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  
  // Build key from path
  const keyParts = [`api:${prefix}`];
  
  // Add path segments (skip "api")
  const pathKey = pathParts.slice(1).join(":");
  if (pathKey) {
    keyParts.push(pathKey);
  }

  // Add query params if requested
  if (includeParams && url.searchParams.toString()) {
    const params: string[] = [];
    url.searchParams.forEach((value, key) => {
      if (!excludeParams.includes(key)) {
        params.push(`${key}=${value}`);
      }
    });
    if (params.length > 0) {
      params.sort(); // Normalize order
      keyParts.push(params.join("&"));
    }
  }

  return keyParts.join(":");
}

// ============ Cache Wrapper Types ============

interface CacheOptions<T> {
  /** Cache key prefix (e.g., "leaderboard", "teams") */
  keyPrefix: string;
  /** TTL in seconds (default: 300 = 5 minutes) */
  ttl?: number;
  /** Cache tags for invalidation */
  tags?: CacheTag[];
  /** Custom cache key (overrides auto-generation) */
  customKey?: string;
  /** Query params to exclude from cache key */
  excludeParams?: string[];
  /** The function that fetches the data */
  fetcher: () => Promise<T>;
  /** Whether to add stale-while-revalidate (default: true) */
  staleWhileRevalidate?: boolean;
  /** Max-age for browser caching in seconds (default: 0) */
  browserMaxAge?: number;
  /** Whether this is a private/user-specific response (default: false) */
  isPrivate?: boolean;
}

interface CachedResponse<T> {
  data: T;
  cached: boolean;
  cachedAt?: string;
}

// ============ Main Cache Wrapper ============

/**
 * Wrap an API handler with caching
 * 
 * @example
 * export async function GET(request: NextRequest) {
 *   return withCache(request, {
 *     keyPrefix: "teams",
 *     ttl: TTL.MEDIUM,
 *     tags: [CacheTags.TEAMS],
 *     fetcher: async () => {
 *       const result = await pool.query("SELECT * FROM teams");
 *       return result.rows;
 *     }
 *   });
 * }
 */
export async function withCache<T>(
  request: NextRequest,
  options: CacheOptions<T>
): Promise<NextResponse> {
  const {
    keyPrefix,
    ttl = TTL.MEDIUM,
    tags = [],
    customKey,
    excludeParams = [],
    fetcher,
    staleWhileRevalidate = true,
    browserMaxAge = 0,
    isPrivate = false,
  } = options;

  // Generate cache key
  const cacheKey = generateCacheKey(request, {
    prefix: keyPrefix,
    includeParams: true,
    excludeParams,
    customKey,
  });

  // Try to get from cache
  const cached = await cache.get<CachedResponse<T>>(cacheKey);

  if (cached) {
    // Return cached response with appropriate headers
    return successResponse(
      {
        ...cached.data,
        _cache: {
          hit: true,
          key: cacheKey,
          cachedAt: cached.cachedAt,
        },
      },
      undefined,
      200,
      {
        maxAge: browserMaxAge,
        staleWhileRevalidate: staleWhileRevalidate ? ttl : 0,
        isPrivate,
      }
    );
  }

  // Fetch fresh data
  const data = await fetcher();

  // Store in cache
  const cacheData: CachedResponse<T> = {
    data,
    cached: true,
    cachedAt: new Date().toISOString(),
  };

  // Store with tags for later invalidation
  const taggedKey = tags.length > 0 ? `${cacheKey}:tags:${tags.join(",")}` : cacheKey;
  await cache.set(cacheKey, cacheData, ttl);

  // Return response
  return successResponse(
    {
      ...data,
      _cache: {
        hit: false,
        key: cacheKey,
      },
    },
    undefined,
    200,
    {
      maxAge: browserMaxAge,
      staleWhileRevalidate: staleWhileRevalidate ? ttl : 0,
      isPrivate,
    }
  );
}

// ============ Cache Invalidation Helpers ============

/**
 * Invalidate cache by tag
 */
export async function invalidateByTag(tag: CacheTag): Promise<number> {
  return invalidatePattern(`api:${tag}:*`);
}

/**
 * Invalidate cache by tags
 */
export async function invalidateByTags(tags: CacheTag[]): Promise<number> {
  let total = 0;
  for (const tag of tags) {
    total += await invalidateByTag(tag);
  }
  return total;
}

/**
 * Invalidate specific API cache key
 */
export async function invalidateApiCache(
  prefix: string,
  customKey?: string
): Promise<boolean> {
  if (customKey) {
    return del(`api:${prefix}:${customKey}`);
  }
  const count = await invalidatePattern(`api:${prefix}:*`);
  return count > 0;
}

// ============ Pre-built Cache Key Builders ============

export const apiCacheKeys = {
  // Tournament leaderboard
  leaderboard: (tournamentId: string): string => 
    `api:leaderboard:tournaments:${tournamentId}:leaderboard`,

  // Team details
  team: (teamId: string): string => 
    `api:teams:teams:${teamId}`,

  // User's teams
  userTeams: (userId: string): string => 
    `api:teams:my-teams:${userId}`,

  // Hall of fame
  hallOfFame: (gameType?: string, period?: string): string => {
    const parts = ["api:hof:hall-of-fame"];
    if (gameType) parts.push(gameType);
    if (period) parts.push(period);
    return parts.join(":");
  },

  // Tournament registrations
  registrations: (tournamentId: string): string =>
    `api:registrations:tournaments:${tournamentId}:registrations`,

  // Checkin status
  checkinStatus: (tournamentId: string): string =>
    `api:checkin:tournaments:${tournamentId}:checkin:status`,
};

// ============ Export Defaults ============

export { TTL };
