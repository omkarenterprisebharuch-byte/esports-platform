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
 * POST /api/admin/tournament/[id]/lobbies/[lobbyId]/send-room
 * Send room credentials to all teams in the lobby
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lobbyId: string }> }
) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { id: tournamentId, lobbyId } = await params;

    // Get lobby with tournament info
    const lobbyResult = await pool.query(
      `SELECT l.*, t.host_id, t.tournament_name
       FROM tournament_lobbies l
       JOIN tournaments t ON t.id = l.tournament_id
       WHERE l.id = $1 AND l.tournament_id = $2`,
      [lobbyId, tournamentId]
    );

    if (lobbyResult.rows.length === 0) {
      return errorResponse("Lobby not found", 404);
    }

    const lobby = lobbyResult.rows[0];
    const canManage = lobby.host_id === user.id || isOrganizer(user.role);

    if (!canManage) {
      return unauthorizedResponse("You don't have permission to manage this tournament");
    }

    if (!lobby.room_id || !lobby.room_password) {
      return errorResponse("Room credentials not set", 400);
    }

    // Get all teams/users in this lobby
    const teamsResult = await pool.query(
      `SELECT DISTINCT r.user_id, u.username
       FROM tournament_registrations r
       JOIN users u ON u.id = r.user_id
       WHERE r.tournament_id = $1 AND r.lobby_id = $2 AND r.status != 'cancelled'`,
      [tournamentId, lobbyId]
    );

    if (teamsResult.rows.length === 0) {
      return errorResponse("No teams in this lobby", 400);
    }

    // Create notifications for each team
    const notificationTitle = `Room Credentials - ${lobby.lobby_name}`;
    const notificationMessage = `Room ID: ${lobby.room_id}\nPassword: ${lobby.room_password}\n\nJoin the match on time. Good luck!`;

    const insertPromises = teamsResult.rows.map((team) =>
      pool.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, 'room_credentials', $2, $3, $4)`,
        [
          team.user_id,
          notificationTitle,
          notificationMessage,
          JSON.stringify({
            tournament_id: parseInt(tournamentId),
            lobby_id: parseInt(lobbyId),
            room_id: lobby.room_id,
            room_password: lobby.room_password,
          }),
        ]
      )
    );

    await Promise.all(insertPromises);

    return successResponse({
      message: `Room credentials sent to ${teamsResult.rows.length} teams`,
      sent_to: teamsResult.rows.length,
    });
  } catch (error) {
    console.error("Failed to send room credentials:", error);
    return serverErrorResponse("Failed to send room credentials");
  }
}
