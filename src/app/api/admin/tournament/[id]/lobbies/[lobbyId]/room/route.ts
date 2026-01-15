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
 * PUT /api/admin/tournament/[id]/lobbies/[lobbyId]/room
 * Update room credentials for a lobby
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lobbyId: string }> }
) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { id: tournamentId, lobbyId } = await params;
    const body = await request.json();
    const { room_id, room_password } = body;

    if (!room_id?.trim() || !room_password?.trim()) {
      return errorResponse("Room ID and Password are required", 400);
    }

    // Verify ownership
    const tournamentResult = await pool.query(
      `SELECT t.id, t.host_id 
       FROM tournaments t
       JOIN tournament_lobbies l ON l.tournament_id = t.id
       WHERE t.id = $1 AND l.id = $2`,
      [tournamentId, lobbyId]
    );

    if (tournamentResult.rows.length === 0) {
      return errorResponse("Tournament or lobby not found", 404);
    }

    const tournament = tournamentResult.rows[0];
    const canManage = tournament.host_id === user.id || isOrganizer(user.role);

    if (!canManage) {
      return unauthorizedResponse("You don't have permission to manage this tournament");
    }

    // Update lobby room credentials
    const result = await pool.query(
      `UPDATE tournament_lobbies 
       SET room_id = $1, room_password = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [room_id.trim(), room_password.trim(), lobbyId]
    );

    return successResponse({
      lobby: result.rows[0],
      message: "Room credentials saved successfully",
    });
  } catch (error) {
    console.error("Failed to update room credentials:", error);
    return serverErrorResponse("Failed to update room credentials");
  }
}
