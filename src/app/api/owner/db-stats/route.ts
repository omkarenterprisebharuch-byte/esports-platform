import { NextRequest } from "next/server";
import { successResponse, unauthorizedResponse, serverErrorResponse } from "@/lib/api-response";
import { requireOwner } from "@/lib/auth";
import { getPoolStats } from "@/lib/db";
import { generateMonitoringReport } from "@/lib/db-monitor";
import pool from "@/lib/db";

/**
 * GET /api/owner/db-stats
 * 
 * Get database connection pool statistics and query monitoring
 * Only accessible by owners
 */
export async function GET(request: NextRequest) {
  try {
    // Require owner role (handles auth check internally)
    const user = requireOwner(request);
    if (!user) {
      return unauthorizedResponse("Owner access required");
    }

    // Get pool statistics
    const stats = getPoolStats();
    
    // Get query monitoring report
    const monitoringReport = generateMonitoringReport();

    // Get materialized view status
    let materializedViews: { name: string; size: string }[] = [];
    try {
      const mvResult = await pool.query(`
        SELECT 
          matviewname as name,
          pg_size_pretty(pg_total_relation_size('"public"."' || matviewname || '"')) as size
        FROM pg_matviews 
        WHERE schemaname = 'public'
        ORDER BY matviewname
      `);
      materializedViews = mvResult.rows;
    } catch {
      // Materialized views may not exist yet
    }

    return successResponse({
      pool: {
        ...stats,
        utilizationPercent: Math.round((stats.activeConnections / stats.maxConnections) * 100),
        healthy: stats.activeConnections < stats.maxConnections,
      },
      config: {
        maxConnections: stats.maxConnections,
        idleTimeoutMs: 30000,
        connectionTimeoutMs: 10000,
        queueTimeoutMs: 30000,
      },
      queryMonitoring: {
        totalQueries: monitoringReport.stats.totalQueries,
        avgExecutionTime: Math.round(monitoringReport.stats.avgExecutionTime * 100) / 100,
        slowQueryCount: monitoringReport.stats.slowQueries,
        slowQueries: monitoringReport.slowQueries.slice(-5).map(q => ({
          query: q.query.substring(0, 100) + (q.query.length > 100 ? "..." : ""),
          executionTimeMs: Math.round(q.executionTimeMs * 100) / 100,
          timestamp: q.timestamp,
        })),
        topPatterns: monitoringReport.patterns.slice(0, 5).map(p => ({
          pattern: p.query.substring(0, 80) + (p.query.length > 80 ? "..." : ""),
          count: p.count,
          avgTimeMs: Math.round(p.avgTime * 100) / 100,
        })),
      },
      materializedViews,
      recommendations: getRecommendations(stats, monitoringReport),
    });
  } catch (error) {
    console.error("Error fetching DB stats:", error);
    return serverErrorResponse("Failed to fetch database statistics");
  }
}

function getRecommendations(
  stats: ReturnType<typeof getPoolStats>,
  monitoring: ReturnType<typeof generateMonitoringReport>
): string[] {
  const recommendations: string[] = [];
  
  if (stats.queueLength > 0) {
    recommendations.push(
      `⚠️ ${stats.queueLength} requests are queued waiting for connections. Consider upgrading database plan.`
    );
  }
  
  if (stats.activeConnections >= stats.maxConnections) {
    recommendations.push(
      "🔴 All connections are in use. Database is at capacity."
    );
  } else if (stats.activeConnections >= stats.maxConnections * 0.8) {
    recommendations.push(
      "🟡 Connection pool is above 80% utilization. Monitor for potential bottlenecks."
    );
  } else {
    recommendations.push(
      "🟢 Connection pool is healthy with available capacity."
    );
  }
  
  if (stats.waitingClients > 0) {
    recommendations.push(
      `${stats.waitingClients} pg clients waiting. Consider connection release optimization.`
    );
  }
  
  // Query performance recommendations
  if (monitoring.stats.avgExecutionTime > 200) {
    recommendations.push(
      `🟡 Average query time is ${Math.round(monitoring.stats.avgExecutionTime)}ms. Consider query optimization.`
    );
  }
  
  if (monitoring.stats.slowQueries > 10) {
    recommendations.push(
      `⚠️ ${monitoring.stats.slowQueries} slow queries detected. Review query patterns and indexes.`
    );
  }
  
  return recommendations;
}
