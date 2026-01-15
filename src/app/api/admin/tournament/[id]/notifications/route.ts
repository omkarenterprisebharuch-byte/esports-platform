import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isOrganizer } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";

/**
 * POST /api/admin/tournament/[id]/notifications
 * Send notification to teams in tournament
 * 
 * Body:
 * - message: string (required)
 * - target: "all" | "lobby" (required)
 * - lobby_id: number (required if target is "lobby")
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { id: tournamentId } = await params;
    const body = await request.json();
    const { message, target, lobby_id } = body;

    if (!message?.trim()) {
      return errorResponse("Message is required", 400);
    }

    if (!target || !["all", "lobby"].includes(target)) {
      return errorResponse("Invalid target. Must be 'all' or 'lobby'", 400);
    }

    if (target === "lobby" && !lobby_id) {
      return errorResponse("Lobby ID is required when target is 'lobby'", 400);
    }

    // Verify ownership
    const tournamentResult = await pool.query(
      `SELECT id, host_id, tournament_name FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      return errorResponse("Tournament not found", 404);
    }

    const tournament = tournamentResult.rows[0];
    const canManage = tournament.host_id === user.id || isOrganizer(user.role);

    if (!canManage) {
      return unauthorizedResponse("You don't have permission to manage this tournament");
    }

    // Get users to notify
    let usersQuery = `
      SELECT DISTINCT r.user_id
      FROM tournament_registrations r
      WHERE r.tournament_id = $1 AND r.status != 'cancelled'
    `;
    const queryParams: (string | number)[] = [tournamentId];

    if (target === "lobby") {
      usersQuery += ` AND r.lobby_id = $2`;
      queryParams.push(lobby_id);
    }

    const usersResult = await pool.query(usersQuery, queryParams);

    if (usersResult.rows.length === 0) {
      return errorResponse("No users to notify", 400);
    }

    // Get lobby name if targeting specific lobby
    let lobbyName = "All Lobbies";
    if (target === "lobby") {
      const lobbyResult = await pool.query(
        `SELECT lobby_name FROM tournament_lobbies WHERE id = $1`,
        [lobby_id]
      );
      if (lobbyResult.rows.length > 0) {
        lobbyName = lobbyResult.rows[0].lobby_name;
      }
    }

    // Create notifications
    const notificationTitle = `📢 ${tournament.tournament_name}`;
    const insertPromises = usersResult.rows.map((row) =>
      pool.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, 'tournament_announcement', $2, $3, $4)`,
        [
          row.user_id,
          notificationTitle,
          message.trim(),
          JSON.stringify({
            tournament_id: parseInt(tournamentId),
            lobby_id: target === "lobby" ? lobby_id : null,
            from_host: true,
          }),
        ]
      )
    );

    await Promise.all(insertPromises);

    return successResponse({
      message: `Notification sent to ${usersResult.rows.length} users`,
      sent_to: usersResult.rows.length,
      target: target === "lobby" ? lobbyName : "All Lobbies",
    });
  } catch (error) {
    console.error("Failed to send notification:", error);
    return serverErrorResponse("Failed to send notification");
  }
}
