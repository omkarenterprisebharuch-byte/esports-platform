import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isOrganizer, isOwner } from "@/lib/auth";
import { type UserRole } from "@/types";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { canDeleteMessage } from "@/lib/league-config";

interface RouteParams {
  params: Promise<{ messageId: string }>;
}

/**
 * DELETE /api/admin/leagues/messages/[messageId]
 * Delete a message (only within 5 minutes of creation)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const userRole = (user.role || "player") as UserRole;

    if (!isOrganizer(userRole)) {
      return errorResponse("Only admins can delete messages", 403);
    }

    const { messageId } = await params;
    const id = parseInt(messageId);

    if (isNaN(id)) {
      return errorResponse("Invalid message ID", 400);
    }

    // Get message details
    const messageResult = await pool.query(
      `SELECT lm.id, lm.sender_id, lm.tournament_id, lm.deletable_until, lm.is_deleted,
              t.host_id as tournament_host_id
       FROM league_messages lm
       JOIN tournaments t ON lm.tournament_id = t.id
       WHERE lm.id = $1`,
      [id]
    );

    if (messageResult.rows.length === 0) {
      return errorResponse("Message not found", 404);
    }

    const message = messageResult.rows[0];

    // Check if already deleted
    if (message.is_deleted) {
      return errorResponse("Message has already been deleted", 400);
    }

    // Verify ownership or admin
    if (message.sender_id !== user.id && 
        message.tournament_host_id !== user.id && 
        !isOwner(userRole)) {
      return errorResponse("Permission denied", 403);
    }

    // Check if still within delete window
    const deletableUntil = new Date(message.deletable_until);
    if (!canDeleteMessage(deletableUntil)) {
      return errorResponse(
        "Message can no longer be deleted. Delete window (5 minutes) has expired.",
        400
      );
    }

    // Soft delete the message
    await pool.query(
      `UPDATE league_messages 
       SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    return successResponse({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error deleting message:", error);
    return serverErrorResponse("Failed to delete message");
  }
}

/**
 * GET /api/admin/leagues/messages/[messageId]
 * Get a specific message
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const userRole = (user.role || "player") as UserRole;

    if (!isOrganizer(userRole)) {
      return errorResponse("Only admins can view messages", 403);
    }

    const { messageId } = await params;
    const id = parseInt(messageId);

    if (isNaN(id)) {
      return errorResponse("Invalid message ID", 400);
    }

    const result = await pool.query(
      `SELECT 
        lm.id,
        lm.tournament_id,
        lm.sender_id,
        u.username as sender_username,
        lm.recipient_type,
        lm.recipient_lobby_id,
        ll.lobby_number as recipient_lobby_number,
        lm.recipient_team_id,
        tm.team_name as recipient_team_name,
        lm.content,
        lm.is_deleted,
        lm.deletable_until,
        lm.created_at,
        t.host_id as tournament_host_id
      FROM league_messages lm
      JOIN users u ON lm.sender_id = u.id
      JOIN tournaments t ON lm.tournament_id = t.id
      LEFT JOIN league_lobbies ll ON lm.recipient_lobby_id = ll.id
      LEFT JOIN teams tm ON lm.recipient_team_id = tm.id
      WHERE lm.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse("Message not found", 404);
    }

    const message = result.rows[0];

    // Verify access
    if (message.tournament_host_id !== user.id && !isOwner(userRole)) {
      return errorResponse("Permission denied", 403);
    }

    const deletableUntil = new Date(message.deletable_until);

    return successResponse({
      message: {
        ...message,
        canDelete: !message.is_deleted && canDeleteMessage(deletableUntil),
      },
    });
  } catch (error) {
    console.error("Error fetching message:", error);
    return serverErrorResponse("Failed to fetch message");
  }
}
