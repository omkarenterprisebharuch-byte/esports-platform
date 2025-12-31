/**
 * Individual Game ID Ban Management API
 * 
 * GET - Get ban details
 * PUT - Update ban (modify reason, extend/reduce duration)
 * DELETE - Lift ban (unban)
 */

import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/api-response";
import { sanitizeText } from "@/lib/sanitize";
import { z } from "zod";

// Validation schema for updating ban
const updateBanSchema = z.object({
  reason: z.string().min(5).max(500).optional(),
  is_permanent: z.boolean().optional(),
  ban_duration_days: z.number().min(1).max(365).optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/bans/game-id/[id] - Get ban details
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (user.role !== "owner" && user.role !== "organizer") {
      return errorResponse("Admin access required", 403);
    }

    const { id } = await context.params;
    const banId = parseInt(id);

    if (isNaN(banId)) {
      return errorResponse("Invalid ban ID", 400);
    }

    const result = await pool.query(
      `SELECT 
        b.*,
        banner.username as banned_by_username,
        owner.username as original_user_username,
        owner.email as original_user_email,
        pr.description as report_description,
        pr.category_id,
        cat.name as category_name
      FROM banned_game_ids b
      LEFT JOIN users banner ON b.banned_by = banner.id
      LEFT JOIN users owner ON b.original_user_id = owner.id
      LEFT JOIN player_reports pr ON b.report_id = pr.id
      LEFT JOIN report_categories cat ON pr.category_id = cat.id
      WHERE b.id = $1`,
      [banId]
    );

    if (result.rows.length === 0) {
      return errorResponse("Ban not found", 404);
    }

    // Get appeal if exists
    const appealResult = await pool.query(
      `SELECT * FROM ban_appeals WHERE ban_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [banId]
    );

    return successResponse({
      ban: {
        ...result.rows[0],
        appeal: appealResult.rows[0] || null,
      },
    });
  } catch (error) {
    console.error("Get ban error:", error);
    return errorResponse("Failed to fetch ban", 500);
  }
}

/**
 * PUT /api/bans/game-id/[id] - Update ban
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (user.role !== "owner") {
      return errorResponse("Owner access required", 403);
    }

    const { id } = await context.params;
    const banId = parseInt(id);

    if (isNaN(banId)) {
      return errorResponse("Invalid ban ID", 400);
    }

    const body = await request.json();
    const validation = updateBanSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(validation.error.errors[0]?.message || "Invalid input", 400);
    }

    const data = validation.data;

    // Check ban exists
    const existingResult = await pool.query(
      "SELECT * FROM banned_game_ids WHERE id = $1",
      [banId]
    );

    if (existingResult.rows.length === 0) {
      return errorResponse("Ban not found", 404);
    }

    // Build update
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.reason) {
      updates.push(`reason = $${paramIndex}`);
      values.push(sanitizeText(data.reason));
      paramIndex++;
    }

    if (data.is_permanent !== undefined) {
      updates.push(`is_permanent = $${paramIndex}`);
      values.push(data.is_permanent);
      paramIndex++;

      if (data.is_permanent) {
        updates.push("ban_expires_at = NULL");
      } else if (data.ban_duration_days) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + data.ban_duration_days);
        updates.push(`ban_expires_at = $${paramIndex}`);
        values.push(expiresAt);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return errorResponse("No updates provided", 400);
    }

    values.push(banId);
    const result = await pool.query(
      `UPDATE banned_game_ids 
       SET ${updates.join(", ")}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return successResponse({
      ban: result.rows[0],
    }, "Ban updated successfully");
  } catch (error) {
    console.error("Update ban error:", error);
    return errorResponse("Failed to update ban", 500);
  }
}

/**
 * DELETE /api/bans/game-id/[id] - Lift ban (unban)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (user.role !== "owner") {
      return errorResponse("Owner access required", 403);
    }

    const { id } = await context.params;
    const banId = parseInt(id);

    if (isNaN(banId)) {
      return errorResponse("Invalid ban ID", 400);
    }

    // Soft delete - set is_active to false
    const result = await pool.query(
      `UPDATE banned_game_ids 
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [banId]
    );

    if (result.rows.length === 0) {
      return errorResponse("Ban not found", 404);
    }

    return successResponse({
      ban: result.rows[0],
    }, "Ban lifted successfully. The game ID can now be used again.");
  } catch (error) {
    console.error("Lift ban error:", error);
    return errorResponse("Failed to lift ban", 500);
  }
}
