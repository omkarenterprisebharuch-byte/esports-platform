/**
 * Cursor-Based Pagination Utility
 * 
 * Provides efficient cursor-based pagination for list APIs.
 * Cursor pagination is more efficient than offset-based pagination
 * for large datasets as it doesn't need to skip rows.
 * 
 * Features:
 * - Base64 encoded cursors for safe URL transmission
 * - Support for multiple sort fields
 * - Forward and backward pagination
 * - Consistent results during concurrent updates
 * 
 * Usage:
 *   import { encodeCursor, decodeCursor, buildCursorQuery } from "@/lib/pagination";
 *   
 *   // Parse cursor from request
 *   const cursor = decodeCursor(searchParams.get("cursor"));
 *   
 *   // Build query with cursor
 *   const { whereClause, params } = buildCursorQuery(cursor, "created_at", "DESC");
 */

// ============ Types ============

export interface CursorData {
  /** The value to compare against (e.g., timestamp, ID) */
  value: string | number;
  /** The unique ID for tie-breaking */
  id: string;
  /** Sort direction: ASC or DESC */
  direction: "ASC" | "DESC";
}

export interface PaginationResult<T> {
  /** The paginated data */
  data: T[];
  /** Pagination metadata */
  pagination: {
    /** Number of items returned */
    count: number;
    /** Whether there are more items after */
    hasNextPage: boolean;
    /** Whether there are more items before */
    hasPrevPage: boolean;
    /** Cursor to get next page */
    nextCursor: string | null;
    /** Cursor to get previous page */
    prevCursor: string | null;
  };
}

export interface CursorPaginationOptions {
  /** Page size (default: 20) */
  limit?: number;
  /** Sort field (default: "created_at") */
  sortField?: string;
  /** Sort direction (default: "DESC") */
  sortDirection?: "ASC" | "DESC";
  /** ID field for tie-breaking (default: "id") */
  idField?: string;
}

// ============ Cursor Encoding/Decoding ============

/**
 * Encode cursor data to a URL-safe string
 */
export function encodeCursor(data: CursorData): string {
  const json = JSON.stringify(data);
  // Use URL-safe base64
  return Buffer.from(json).toString("base64url");
}

/**
 * Decode cursor string back to cursor data
 */
export function decodeCursor(cursor: string | null): CursorData | null {
  if (!cursor) return null;
  
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf-8");
    const data = JSON.parse(json) as CursorData;
    
    // Validate required fields
    if (data.value === undefined || data.id === undefined) {
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

// ============ Query Building ============

/**
 * Build WHERE clause and params for cursor pagination
 * 
 * @param cursor - Decoded cursor data
 * @param sortField - Field to sort by (e.g., "created_at")
 * @param sortDirection - Sort direction ("ASC" or "DESC")
 * @param startParamIndex - Starting parameter index for $1, $2, etc.
 * @returns Object with whereClause and params array
 */
export function buildCursorQuery(
  cursor: CursorData | null,
  sortField: string,
  sortDirection: "ASC" | "DESC" = "DESC",
  startParamIndex: number = 1
): {
  whereClause: string;
  params: (string | number)[];
  orderBy: string;
} {
  const params: (string | number)[] = [];
  const comparator = sortDirection === "DESC" ? "<" : ">";
  
  // Order by with tie-breaker
  const orderBy = `ORDER BY ${sortField} ${sortDirection}, id ${sortDirection}`;
  
  if (!cursor) {
    return {
      whereClause: "",
      params: [],
      orderBy,
    };
  }

  // For cursor pagination, we need to find records after the cursor position
  // Using (sort_value, id) tuple comparison for consistency
  const whereClause = `AND (
    ${sortField} ${comparator} $${startParamIndex}
    OR (${sortField} = $${startParamIndex} AND id ${comparator} $${startParamIndex + 1})
  )`;
  
  params.push(cursor.value, cursor.id);

  return {
    whereClause,
    params,
    orderBy,
  };
}

// ============ Pagination Response Builder ============

/**
 * Build pagination response with cursors
 * 
 * @param rows - Query results (should fetch limit + 1 to check for next page)
 * @param limit - Page size
 * @param sortField - Field used for sorting
 * @param sortDirection - Sort direction
 * @param idField - Field used for tie-breaking
 * @param hasPrevCursor - Whether a previous cursor was provided
 */
export function buildPaginationResponse<T extends Record<string, unknown>>(
  rows: T[],
  limit: number,
  sortField: string,
  sortDirection: "ASC" | "DESC",
  idField: string = "id",
  hasPrevCursor: boolean = false
): PaginationResult<T> {
  const hasNextPage = rows.length > limit;
  const data = hasNextPage ? rows.slice(0, limit) : rows;
  
  let nextCursor: string | null = null;
  let prevCursor: string | null = null;
  
  if (data.length > 0) {
    // Build next cursor from last item
    if (hasNextPage) {
      const lastItem = data[data.length - 1];
      nextCursor = encodeCursor({
        value: lastItem[sortField] as string | number,
        id: String(lastItem[idField]),
        direction: sortDirection,
      });
    }
    
    // Build prev cursor from first item (only if we navigated here with a cursor)
    if (hasPrevCursor) {
      const firstItem = data[0];
      prevCursor = encodeCursor({
        value: firstItem[sortField] as string | number,
        id: String(firstItem[idField]),
        direction: sortDirection === "ASC" ? "DESC" : "ASC",
      });
    }
  }
  
  return {
    data,
    pagination: {
      count: data.length,
      hasNextPage,
      hasPrevPage: hasPrevCursor,
      nextCursor,
      prevCursor,
    },
  };
}

// ============ Helper to Parse Pagination Params ============

/**
 * Parse common pagination parameters from URL search params
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaults: Partial<CursorPaginationOptions> = {}
): {
  cursor: CursorData | null;
  limit: number;
  sortField: string;
  sortDirection: "ASC" | "DESC";
} {
  const cursor = decodeCursor(searchParams.get("cursor"));
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") || String(defaults.limit || 20)), 1),
    100 // Max limit
  );
  const sortField = searchParams.get("sort_by") || defaults.sortField || "created_at";
  
  // Parse sort direction
  let sortDirection: "ASC" | "DESC" = defaults.sortDirection || "DESC";
  const sortParam = searchParams.get("sort_dir");
  if (sortParam === "asc" || sortParam === "ASC") {
    sortDirection = "ASC";
  } else if (sortParam === "desc" || sortParam === "DESC") {
    sortDirection = "DESC";
  }
  
  return { cursor, limit, sortField, sortDirection };
}

// ============ Legacy Offset Pagination (for backwards compatibility) ============

/**
 * Convert offset pagination to approximate cursor
 * Useful for migrating from offset to cursor pagination
 */
export function offsetToCursor(
  page: number,
  limit: number,
  sortDirection: "ASC" | "DESC" = "DESC"
): string | null {
  if (page <= 1) return null;
  
  // This is a rough approximation - actual cursor should come from data
  return encodeCursor({
    value: `offset:${(page - 1) * limit}`,
    id: "0",
    direction: sortDirection,
  });
}

/**
 * Build offset-based pagination response (legacy support)
 */
export function buildOffsetPaginationResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
} {
  const pages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages,
      hasNextPage: page < pages,
      hasPrevPage: page > 1,
    },
  };
}
