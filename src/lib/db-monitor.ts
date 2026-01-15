/**
 * Database Query Monitoring & Analysis Utilities
 * 
 * Provides query performance monitoring, slow query logging,
 * and analysis tools for database optimization.
 * 
 * Features:
 * - Slow query logging with thresholds
 * - Query execution time tracking
 * - Connection pool monitoring
 * - Query explain analysis helper
 * 
 * Usage:
 *   import { monitoredQuery, getQueryStats, logSlowQuery } from "@/lib/db-monitor";
 */

import pool from "./db";

// ============ Configuration ============

const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD || "500");
const ENABLE_QUERY_LOGGING = process.env.ENABLE_QUERY_LOGGING === "true";
const MAX_STORED_QUERIES = 100;

// ============ Types ============

interface QueryStats {
  query: string;
  executionTimeMs: number;
  timestamp: Date;
  params?: unknown[];
}

interface AggregatedStats {
  totalQueries: number;
  avgExecutionTime: number;
  slowQueries: number;
  maxExecutionTime: number;
  minExecutionTime: number;
}

// ============ Query Storage (in-memory for development) ============

const queryHistory: QueryStats[] = [];
const slowQueries: QueryStats[] = [];

// ============ Query Monitoring ============

/**
 * Execute a query with monitoring and logging
 */
export async function monitoredQuery<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; executionTime: number }> {
  const start = performance.now();
  
  try {
    const result = await pool.query(text, params);
    const executionTime = performance.now() - start;
    
    // Log query stats
    if (ENABLE_QUERY_LOGGING || executionTime > SLOW_QUERY_THRESHOLD_MS) {
      logQuery(text, executionTime, params);
    }
    
    return {
      rows: result.rows as T[],
      executionTime,
    };
  } catch (error) {
    const executionTime = performance.now() - start;
    logQuery(text, executionTime, params, true);
    throw error;
  }
}

/**
 * Log a query to the monitoring system
 */
function logQuery(
  query: string,
  executionTimeMs: number,
  params?: unknown[],
  isError = false
): void {
  const stats: QueryStats = {
    query: normalizeQuery(query),
    executionTimeMs,
    timestamp: new Date(),
    params,
  };

  // Always store in query history
  queryHistory.push(stats);
  if (queryHistory.length > MAX_STORED_QUERIES) {
    queryHistory.shift();
  }

  // Store slow queries separately
  if (executionTimeMs > SLOW_QUERY_THRESHOLD_MS) {
    slowQueries.push(stats);
    if (slowQueries.length > MAX_STORED_QUERIES) {
      slowQueries.shift();
    }
    
    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.warn(`⚠️ Slow query (${executionTimeMs.toFixed(2)}ms): ${stats.query.substring(0, 100)}...`);
    }
  }

  if (isError) {
    console.error(`❌ Query error (${executionTimeMs.toFixed(2)}ms): ${stats.query.substring(0, 100)}...`);
  }
}

/**
 * Normalize query for grouping (remove values, keep structure)
 */
function normalizeQuery(query: string): string {
  return query
    .replace(/\s+/g, " ")
    .replace(/\$\d+/g, "?")
    .trim();
}

// ============ Statistics ============

/**
 * Get aggregated query statistics
 */
export function getQueryStats(): {
  totalQueries: number;
  avgExecutionTime: number;
  slowQueryCount: number;
  maxExecutionTime: number;
  minExecutionTime: number;
  recentQueries: QueryStats[];
  slowQueries: QueryStats[];
} {
  const times = queryHistory.map((q) => q.executionTimeMs);
  
  return {
    totalQueries: queryHistory.length,
    avgExecutionTime: times.length > 0 
      ? times.reduce((a, b) => a + b, 0) / times.length 
      : 0,
    slowQueryCount: slowQueries.length,
    maxExecutionTime: times.length > 0 ? Math.max(...times) : 0,
    minExecutionTime: times.length > 0 ? Math.min(...times) : 0,
    recentQueries: queryHistory.slice(-10),
    slowQueries: slowQueries.slice(-10),
  };
}

/**
 * Clear query statistics (for testing)
 */
export function clearQueryStats(): void {
  queryHistory.length = 0;
  slowQueries.length = 0;
}

// ============ Query Analysis ============

/**
 * Run EXPLAIN ANALYZE on a query
 */
export async function explainQuery(
  query: string,
  params?: unknown[]
): Promise<{
  plan: string[];
  executionTime: number;
  planningTime: number;
}> {
  const explainQuery = `EXPLAIN (ANALYZE, COSTS, VERBOSE, BUFFERS, FORMAT TEXT) ${query}`;
  
  const result = await pool.query(explainQuery, params);
  const plan = result.rows.map((row) => row["QUERY PLAN"]);
  
  // Parse execution and planning time from the output
  let executionTime = 0;
  let planningTime = 0;
  
  for (const line of plan) {
    const execMatch = line.match(/Execution Time: ([\d.]+) ms/);
    const planMatch = line.match(/Planning Time: ([\d.]+) ms/);
    if (execMatch) executionTime = parseFloat(execMatch[1]);
    if (planMatch) planningTime = parseFloat(planMatch[1]);
  }
  
  return { plan, executionTime, planningTime };
}

/**
 * Check if a query would benefit from an index
 */
export async function analyzeQueryPerformance(
  query: string,
  params?: unknown[]
): Promise<{
  usesIndex: boolean;
  sequentialScans: string[];
  suggestions: string[];
}> {
  const { plan } = await explainQuery(query, params);
  const planText = plan.join("\n");
  
  const usesIndex = planText.includes("Index Scan") || planText.includes("Index Only Scan");
  const sequentialScans: string[] = [];
  const suggestions: string[] = [];
  
  // Find sequential scans
  const seqScanMatches = planText.match(/Seq Scan on (\w+)/g);
  if (seqScanMatches) {
    sequentialScans.push(...seqScanMatches.map((m) => m.replace("Seq Scan on ", "")));
    suggestions.push(
      `Consider adding indexes on tables: ${sequentialScans.join(", ")}`
    );
  }
  
  // Check for expensive sorts
  if (planText.includes("Sort Method: external merge")) {
    suggestions.push("Query requires disk-based sorting - consider adding index for ORDER BY columns");
  }
  
  // Check for hash joins on large datasets
  if (planText.includes("Hash Join") && planText.includes("rows=")) {
    const rowMatch = planText.match(/rows=(\d+)/);
    if (rowMatch && parseInt(rowMatch[1]) > 10000) {
      suggestions.push("Large hash join detected - consider adding indexes for JOIN conditions");
    }
  }
  
  return { usesIndex, sequentialScans, suggestions };
}

// ============ Common Query Patterns ============

/**
 * Get commonly executed queries grouped by pattern
 */
export function getQueryPatterns(): Map<string, { count: number; avgTime: number }> {
  const patterns = new Map<string, { count: number; totalTime: number }>();
  
  for (const query of queryHistory) {
    const normalized = normalizeQuery(query.query);
    const existing = patterns.get(normalized) || { count: 0, totalTime: 0 };
    patterns.set(normalized, {
      count: existing.count + 1,
      totalTime: existing.totalTime + query.executionTimeMs,
    });
  }
  
  // Convert to avg time
  const result = new Map<string, { count: number; avgTime: number }>();
  for (const [pattern, stats] of patterns) {
    result.set(pattern, {
      count: stats.count,
      avgTime: stats.totalTime / stats.count,
    });
  }
  
  return result;
}

// ============ Export for API endpoint ============

export interface MonitoringReport {
  stats: AggregatedStats;
  slowQueries: QueryStats[];
  patterns: { query: string; count: number; avgTime: number }[];
  poolStats: {
    total: number;
    idle: number;
    waiting: number;
  };
}

/**
 * Generate a full monitoring report
 */
export function generateMonitoringReport(): MonitoringReport {
  const stats = getQueryStats();
  const patterns = getQueryPatterns();
  
  return {
    stats: {
      totalQueries: stats.totalQueries,
      avgExecutionTime: stats.avgExecutionTime,
      slowQueries: stats.slowQueryCount,
      maxExecutionTime: stats.maxExecutionTime,
      minExecutionTime: stats.minExecutionTime,
    },
    slowQueries: slowQueries.slice(-20),
    patterns: Array.from(patterns.entries())
      .map(([query, data]) => ({ query, ...data }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 20),
    poolStats: {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    },
  };
}
