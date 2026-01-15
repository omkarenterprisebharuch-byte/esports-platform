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
import { sanitizeText } from "@/lib/sanitize";
import {
  MESSAGE_DELETE_WINDOW_MINUTES,
  canDeleteMessage,
  getRemainingDeleteTime,
} from "@/lib/league-config";

/**
 * POST /api/admin/leagues/messages
 * Send a message to all teams, a specific lobby, or a specific team
 * 
 * Body:
 * - tournamentId: UUID
 * - recipientType: 'global' | 'lobby' | 'team'
 * - recipientLobbyId?: number (required if recipientType is 'lobby')
 * - recipientTeamId?: number (required if recipientType is 'team')
 * - content: string (message text)
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const userRole = (user.role || "player") as UserRole;

    if (!isOrganizer(userRole)) {
      return errorResponse("Only admins can send messages", 403);
    }

    const body = await request.json();
    const { tournamentId, recipientType, recipientLobbyId, recipientTeamId, content } = body;

    // Validate required fields
    if (!tournamentId) {
      return errorResponse("Tournament ID is required", 400);
    }
    if (!recipientType || !['global', 'lobby', 'team'].includes(recipientType)) {
      return errorResponse("Valid recipient type is required (global, lobby, or team)", 400);
    }
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return errorResponse("Message content is required", 400);
    }
    if (content.length > 1000) {
      return errorResponse("Message cannot exceed 1000 characters", 400);
    }

    // Validate recipient based on type
    if (recipientType === 'lobby' && !recipientLobbyId) {
      return errorResponse("Lobby ID is required for lobby messages", 400);
    }
    if (recipientType === 'team' && !recipientTeamId) {
      return errorResponse("Team ID is required for team messages", 400);
    }

    // Verify tournament access
    const tournamentResult = await pool.query(
      `SELECT id, host_id, is_league_enabled, tournament_name
       FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      return errorResponse("Tournament not found", 404);
    }

    const tournament = tournamentResult.rows[0];

    if (tournament.host_id !== user.id && !isOwner(userRole)) {
      return errorResponse("Permission denied", 403);
    }

    if (!tournament.is_league_enabled) {
      return errorResponse("League mode is not enabled for this tournament", 400);
    }

    // Validate lobby exists if sending to lobby
    if (recipientType === 'lobby') {
      const lobbyResult = await pool.query(
        `SELECT id FROM league_lobbies WHERE id = $1 AND tournament_id = $2`,
        [recipientLobbyId, tournamentId]
      );
      if (lobbyResult.rows.length === 0) {
        return errorResponse("Lobby not found", 404);
      }
    }

    // Calculate deletable until (5 minutes from now)
    const now = new Date();
    const deletableUntil = new Date(now.getTime() + MESSAGE_DELETE_WINDOW_MINUTES * 60 * 1000);

    // Sanitize content
    const sanitizedContent = sanitizeText(content.trim());

    // Insert message
    const result = await pool.query(
      `INSERT INTO league_messages 
       (tournament_id, sender_id, recipient_type, recipient_lobby_id, recipient_team_id, content, deletable_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, recipient_type, content, deletable_until, created_at`,
      [
        tournamentId,
        user.id,
        recipientType,
        recipientType === 'lobby' ? recipientLobbyId : null,
        recipientType === 'team' ? recipientTeamId : null,
        sanitizedContent,
        deletableUntil,
      ]
    );

    const message = result.rows[0];

    return successResponse({
      message: "Message sent successfully",
      data: {
        id: message.id,
        recipientType: message.recipient_type,
        content: message.content,
        deletableUntil: message.deletable_until,
        canDelete: true,
        deleteTimeRemaining: MESSAGE_DELETE_WINDOW_MINUTES * 60,
        createdAt: message.created_at,
      },
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return serverErrorResponse("Failed to send message");
  }
}

/**
 * GET /api/admin/leagues/messages
 * Get messages for a tournament
 * 
 * Query params:
 * - tournamentId: UUID (required)
 * - lobbyId?: number (filter by lobby)
 * - limit?: number (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const userRole = (user.role || "player") as UserRole;

    if (!isOrganizer(userRole)) {
      return errorResponse("Only admins can view messages", 403);
    }

    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get("tournamentId");
    const lobbyId = searchParams.get("lobbyId");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!tournamentId) {
      return errorResponse("Tournament ID is required", 400);
    }

    // Verify tournament access
    const tournamentResult = await pool.query(
      `SELECT id, host_id FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      return errorResponse("Tournament not found", 404);
    }

    const tournament = tournamentResult.rows[0];
    if (tournament.host_id !== user.id && !isOwner(userRole)) {
      return errorResponse("Permission denied", 403);
    }

    let query = `
      SELECT 
        lm.id,
        lm.tournament_id,
        lm.sender_id,
        u.username as sender_username,
        lm.recipient_type,
        lm.recipient_lobby_id,
        ll.lobby_number as recipient_lobby_number,
        lm.recipient_team_id,
        t.team_name as recipient_team_name,
        lm.content,
        lm.is_deleted,
        lm.deletable_until,
        lm.created_at
      FROM league_messages lm
      JOIN users u ON lm.sender_id = u.id
      LEFT JOIN league_lobbies ll ON lm.recipient_lobby_id = ll.id
      LEFT JOIN teams t ON lm.recipient_team_id = t.id
      WHERE lm.tournament_id = $1 AND lm.is_deleted = FALSE
    `;

    const queryParams: (string | number)[] = [tournamentId];

    if (lobbyId) {
      query += ` AND (lm.recipient_type = 'global' OR lm.recipient_lobby_id = $2)`;
      queryParams.push(parseInt(lobbyId));
    }

    query += ` ORDER BY lm.created_at DESC LIMIT $${queryParams.length + 1}`;
    queryParams.push(limit);

    const result = await pool.query(query, queryParams);

    // Add canDelete flag based on current time
    const messages = result.rows.map((msg) => ({
      ...msg,
      canDelete: canDeleteMessage(new Date(msg.deletable_until)),
      deleteTimeRemaining: getRemainingDeleteTime(new Date(msg.deletable_until)),
    }));

    return successResponse({ messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return serverErrorResponse("Failed to fetch messages");
  }
}
