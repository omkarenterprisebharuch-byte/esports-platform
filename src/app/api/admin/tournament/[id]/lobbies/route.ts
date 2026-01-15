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
 * GET /api/admin/tournament/[id]/lobbies
 * Get all lobbies for a tournament
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { id: tournamentId } = await params;

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

    // Get lobbies
    const lobbiesResult = await pool.query(
      `SELECT id, lobby_name, lobby_number, room_id, room_password, max_teams, 
              COALESCE(current_teams, 0) as current_teams, status, created_at
       FROM tournament_lobbies 
       WHERE tournament_id = $1 
       ORDER BY lobby_number ASC`,
      [tournamentId]
    );

    return successResponse({
      lobbies: lobbiesResult.rows,
      tournament: {
        id: tournament.id,
        name: tournament.tournament_name,
      },
    });
  } catch (error) {
    console.error("Failed to fetch lobbies:", error);
    return serverErrorResponse("Failed to fetch lobbies");
  }
}

/**
 * POST /api/admin/tournament/[id]/lobbies
 * Create a new lobby
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
    const { lobby_name, max_teams = 12 } = body;

    if (!lobby_name?.trim()) {
      return errorResponse("Lobby name is required", 400);
    }

    // Verify ownership
    const tournamentResult = await pool.query(
      `SELECT id, host_id FROM tournaments WHERE id = $1`,
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

    // Get next lobby number
    const lobbyCountResult = await pool.query(
      `SELECT COALESCE(MAX(lobby_number), 0) + 1 as next_number FROM tournament_lobbies WHERE tournament_id = $1`,
      [tournamentId]
    );
    const nextLobbyNumber = lobbyCountResult.rows[0].next_number;

    // Create lobby
    const result = await pool.query(
      `INSERT INTO tournament_lobbies (tournament_id, lobby_name, lobby_number, max_teams, status, current_teams)
       VALUES ($1, $2, $3, $4, 'pending', 0)
       RETURNING *`,
      [tournamentId, lobby_name.trim(), nextLobbyNumber, max_teams]
    );

    return successResponse({
      lobby: result.rows[0],
      message: "Lobby created successfully",
    });
  } catch (error) {
    console.error("Failed to create lobby:", error);
    return serverErrorResponse("Failed to create lobby");
  }
}
