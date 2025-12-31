/**
 * Report Detail API - View and Update Individual Reports
 * 
 * GET - Get report details
 * PUT - Update report status (admin only)
 */

import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/api-response";
import { sanitizeText } from "@/lib/sanitize";
import { z } from "zod";

// Validation schema for updating report
const updateReportSchema = z.object({
  status: z.enum(["pending", "under_review", "resolved", "dismissed", "escalated"]).optional(),
  priority: z.enum(["low", "normal", "high", "critical"]).optional(),
  resolution_notes: z.string().max(2000).optional(),
  action_taken: z.enum(["warning", "temp_ban", "permanent_ban", "game_id_ban", "none"]).optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/reports/[id] - Get report details
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await context.params;
    const reportId = parseInt(id);

    if (isNaN(reportId)) {
      return errorResponse("Invalid report ID", 400);
    }

    const isAdmin = user.role === "owner" || user.role === "organizer";

    // Get report with related data
    const result = await pool.query(
      `SELECT 
        pr.*,
        reporter.username as reporter_username,
        reporter.email as reporter_email,
        reported.username as reported_username,
        reported.email as reported_email,
        cat.name as category_name,
        cat.description as category_description,
        subcat.name as subcategory_name,
        subcat.description as subcategory_description,
        t.tournament_name,
        t.game_type as tournament_game_type,
        reviewer.username as reviewer_username
      FROM player_reports pr
      LEFT JOIN users reporter ON pr.reporter_id = reporter.id
      LEFT JOIN users reported ON pr.reported_user_id = reported.id
      LEFT JOIN report_categories cat ON pr.category_id = cat.id
      LEFT JOIN report_categories subcat ON pr.subcategory_id = subcat.id
      LEFT JOIN tournaments t ON pr.tournament_id = t.id
      LEFT JOIN users reviewer ON pr.reviewed_by = reviewer.id
      WHERE pr.id = $1`,
      [reportId]
    );

    if (result.rows.length === 0) {
      return errorResponse("Report not found", 404);
    }

    const report = result.rows[0];

    // Regular users can only see their own reports
    if (!isAdmin && report.reporter_id !== user.id) {
      return errorResponse("Access denied", 403);
    }

    // Get any existing bans for this game ID
    const bansResult = await pool.query(
      `SELECT id, reason, is_permanent, ban_expires_at, created_at
       FROM banned_game_ids
       WHERE game_id = $1 AND game_type = $2 AND is_active = TRUE`,
      [report.reported_game_id, report.reported_game_type]
    );

    // Get report history for this game ID (for admins)
    let reportHistory = [];
    if (isAdmin) {
      const historyResult = await pool.query(
        `SELECT id, status, action_taken, created_at
         FROM player_reports
         WHERE reported_game_id = $1 
         AND reported_game_type = $2
         AND id != $3
         ORDER BY created_at DESC
         LIMIT 10`,
        [report.reported_game_id, report.reported_game_type, reportId]
      );
      reportHistory = historyResult.rows;
    }

    return successResponse({
      report: {
        ...report,
        existing_bans: bansResult.rows,
        report_history: reportHistory,
      },
    });
  } catch (error) {
    console.error("Get report error:", error);
    return errorResponse("Failed to fetch report", 500);
  }
}

/**
 * PUT /api/reports/[id] - Update report (admin only)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    // Only owners/organizers can update reports
    if (user.role !== "owner" && user.role !== "organizer") {
      return errorResponse("Admin access required", 403);
    }

    const { id } = await context.params;
    const reportId = parseInt(id);

    if (isNaN(reportId)) {
      return errorResponse("Invalid report ID", 400);
    }

    const body = await request.json();
    const validation = updateReportSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(validation.error.errors[0]?.message || "Invalid input", 400);
    }

    const data = validation.data;

    // Check report exists
    const existingResult = await pool.query(
      "SELECT * FROM player_reports WHERE id = $1",
      [reportId]
    );

    if (existingResult.rows.length === 0) {
      return errorResponse("Report not found", 404);
    }

    const existingReport = existingResult.rows[0];

    // Build update query
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.status) {
      updates.push(`status = $${paramIndex}`);
      values.push(data.status);
      paramIndex++;
    }

    if (data.priority) {
      updates.push(`priority = $${paramIndex}`);
      values.push(data.priority);
      paramIndex++;
    }

    if (data.resolution_notes !== undefined) {
      updates.push(`resolution_notes = $${paramIndex}`);
      values.push(sanitizeText(data.resolution_notes));
      paramIndex++;
    }

    if (data.action_taken) {
      updates.push(`action_taken = $${paramIndex}`);
      values.push(data.action_taken);
      paramIndex++;

      // If action taken, mark as resolved and set reviewer
      if (!data.status) {
        updates.push(`status = 'resolved'`);
      }
      updates.push(`reviewed_by = $${paramIndex}`);
      values.push(user.id);
      paramIndex++;
      updates.push(`reviewed_at = NOW()`);

      // If action is game_id_ban, create the ban
      if (data.action_taken === "game_id_ban") {
        await pool.query(
          `INSERT INTO banned_game_ids (
            game_id, game_type, reason, banned_by, report_id, original_user_id
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (game_id, game_type) DO UPDATE SET
            is_active = TRUE,
            reason = EXCLUDED.reason,
            updated_at = NOW()`,
          [
            existingReport.reported_game_id,
            existingReport.reported_game_type,
            data.resolution_notes || `Banned due to report #${reportId}`,
            user.id,
            reportId,
            existingReport.reported_user_id,
          ]
        );
      }
    }

    if (updates.length === 0) {
      return errorResponse("No updates provided", 400);
    }

    values.push(reportId);
    const result = await pool.query(
      `UPDATE player_reports 
       SET ${updates.join(", ")}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return successResponse({
      report: result.rows[0],
    }, "Report updated successfully");
  } catch (error) {
    console.error("Update report error:", error);
    return errorResponse("Failed to update report", 500);
  }
}
