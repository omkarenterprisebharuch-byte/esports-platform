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
import {
  validateLeagueSlots,
  isLeagueGameSupported,
  isLeagueModeValid,
} from "@/lib/league-config";

/**
 * POST /api/admin/leagues
 * Enable league mode for a tournament and configure slots
 * 
 * Body:
 * - tournamentId: UUID of the tournament
 * - game: 'freefire' | 'bgmi'
 * - mode: 'solo' | 'duo' | 'squad'
 * - totalSlots: number (must follow slot rules)
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const userRole = (user.role || "player") as UserRole;

    // Check admin/host permission
    if (!isOrganizer(userRole) && !isOwner(userRole) && !user.is_host) {
      return errorResponse("Only organizers and hosts can manage leagues", 403);
    }

    const body = await request.json();
    const { tournamentId, game, mode, totalSlots } = body;

    // Validate required fields
    if (!tournamentId) {
      return errorResponse("Tournament ID is required", 400);
    }
    if (!game) {
      return errorResponse("Game type is required", 400);
    }
    if (!mode) {
      return errorResponse("Mode is required", 400);
    }
    if (!totalSlots || typeof totalSlots !== 'number') {
      return errorResponse("Total slots is required and must be a number", 400);
    }

    // Validate game and mode
    if (!isLeagueGameSupported(game)) {
      return errorResponse("League mode is only available for Free Fire and BGMI", 400);
    }
    if (!isLeagueModeValid(mode)) {
      return errorResponse("Mode must be solo, duo, or squad", 400);
    }

    // Validate slots against game rules
    const validation = validateLeagueSlots(game, mode, totalSlots);
    if (!validation.valid) {
      return errorResponse(validation.error!, 400);
    }

    // Check tournament exists and belongs to user
    const tournamentResult = await pool.query(
      `SELECT id, host_id, status, is_league_enabled, league_lobbies_created 
       FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      return errorResponse("Tournament not found", 404);
    }

    const tournament = tournamentResult.rows[0];

    // Verify ownership (unless owner role)
    if (tournament.host_id !== user.id && !isOwner(userRole)) {
      return errorResponse("You don't have permission to modify this tournament", 403);
    }

    // Check if tournament can be modified
    if (tournament.status !== 'upcoming' && tournament.status !== 'draft') {
      return errorResponse("Cannot enable league mode after tournament has started", 400);
    }

    // Check if already configured
    if (tournament.league_lobbies_created) {
      return errorResponse("League lobbies have already been created. Cannot reconfigure.", 400);
    }

    // Update tournament with league settings
    await pool.query(
      `UPDATE tournaments 
       SET is_league_enabled = TRUE,
           league_total_slots = $1,
           league_mode = $2,
           game_type = $3,
           tournament_type = $4,
           max_teams = $5,
           updated_at = NOW()
       WHERE id = $6`,
      [
        totalSlots,
        mode,
        game,
        mode, // tournament_type matches mode
        totalSlots,
        tournamentId,
      ]
    );

    return successResponse({
      message: "League mode enabled successfully",
      tournament: {
        id: tournamentId,
        game,
        mode,
        totalSlots,
        lobbyCount: validation.lobbyCount,
        teamsPerLobby: validation.teamsPerLobby,
      },
    });
  } catch (error) {
    console.error("Error enabling league mode:", error);
    return serverErrorResponse("Failed to enable league mode");
  }
}

/**
 * GET /api/admin/leagues
 * Get all league-enabled tournaments for the admin
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const userRole = (user.role || "player") as UserRole;

    if (!isOrganizer(userRole) && !isOwner(userRole) && !user.is_host) {
      return errorResponse("Only organizers and hosts can view leagues", 403);
    }

    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get("tournamentId");
    const isAdmin = isOwner(userRole);

    if (tournamentId) {
      // Get specific tournament league details
      const result = await pool.query(
        `SELECT 
          t.id,
          t.tournament_name,
          t.game_type,
          t.tournament_type,
          t.is_league_enabled,
          t.league_total_slots,
          t.league_mode,
          t.league_lobbies_created,
          t.status,
          t.registration_start_date,
          t.registration_end_date,
          t.tournament_start_date,
          t.current_teams,
          t.max_teams,
          COUNT(ll.id) as lobby_count
        FROM tournaments t
        LEFT JOIN league_lobbies ll ON t.id = ll.tournament_id
        WHERE t.id = $1 AND (t.host_id = $2 OR $3 = TRUE)
        GROUP BY t.id`,
        [tournamentId, user.id, isAdmin]
      );

      if (result.rows.length === 0) {
        return errorResponse("Tournament not found", 404);
      }

      return successResponse({ tournament: result.rows[0] });
    }

    // Get all league tournaments
    const result = await pool.query(
      `SELECT 
        t.id,
        t.tournament_name,
        t.game_type,
        t.tournament_type,
        t.is_league_enabled,
        t.league_total_slots,
        t.league_mode,
        t.league_lobbies_created,
        t.status,
        t.registration_start_date,
        t.tournament_start_date,
        t.current_teams,
        t.max_teams,
        COUNT(ll.id) as lobby_count,
        COALESCE(SUM(ll.current_teams), 0) as registered_teams
      FROM tournaments t
      LEFT JOIN league_lobbies ll ON t.id = ll.tournament_id
      WHERE t.is_league_enabled = TRUE 
        AND (t.host_id = $1 OR $2 = TRUE)
      GROUP BY t.id
      ORDER BY t.created_at DESC`,
      [user.id, isAdmin]
    );

    return successResponse({ tournaments: result.rows });
  } catch (error) {
    console.error("Error fetching leagues:", error);
    return serverErrorResponse("Failed to fetch leagues");
  }
}

/**
 * PUT /api/admin/leagues
 * Update league settings (only before lobbies are created)
 */
export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const userRole = (user.role || "player") as UserRole;

    if (!isOrganizer(userRole) && !isOwner(userRole) && !user.is_host) {
      return errorResponse("Only organizers and hosts can modify leagues", 403);
    }

    const body = await request.json();
    const { tournamentId, totalSlots, mode } = body;

    if (!tournamentId) {
      return errorResponse("Tournament ID is required", 400);
    }

    // Get current tournament state
    const tournamentResult = await pool.query(
      `SELECT id, host_id, game_type, league_mode, league_lobbies_created, status
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

    if (tournament.league_lobbies_created) {
      return errorResponse("Cannot modify league settings after lobbies are created", 400);
    }

    const newMode = mode || tournament.league_mode;
    const newSlots = totalSlots;

    if (newSlots) {
      const validation = validateLeagueSlots(tournament.game_type, newMode, newSlots);
      if (!validation.valid) {
        return errorResponse(validation.error!, 400);
      }
    }

    await pool.query(
      `UPDATE tournaments 
       SET league_total_slots = COALESCE($1, league_total_slots),
           league_mode = COALESCE($2, league_mode),
           tournament_type = COALESCE($2, tournament_type),
           max_teams = COALESCE($1, max_teams),
           updated_at = NOW()
       WHERE id = $3`,
      [newSlots, mode, tournamentId]
    );

    return successResponse({ message: "League settings updated" });
  } catch (error) {
    console.error("Error updating league:", error);
    return serverErrorResponse("Failed to update league");
  }
}

/**
 * DELETE /api/admin/leagues
 * Disable league mode (only before lobbies are created)
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const userRole = (user.role || "player") as UserRole;

    if (!isOrganizer(userRole) && !isOwner(userRole) && !user.is_host) {
      return errorResponse("Only organizers and hosts can disable leagues", 403);
    }

    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get("tournamentId");

    if (!tournamentId) {
      return errorResponse("Tournament ID is required", 400);
    }

    const tournamentResult = await pool.query(
      `SELECT id, host_id, league_lobbies_created 
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

    if (tournament.league_lobbies_created) {
      return errorResponse("Cannot disable league mode after lobbies are created", 400);
    }

    await pool.query(
      `UPDATE tournaments 
       SET is_league_enabled = FALSE,
           league_total_slots = NULL,
           league_mode = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [tournamentId]
    );

    return successResponse({ message: "League mode disabled" });
  } catch (error) {
    console.error("Error disabling league:", error);
    return serverErrorResponse("Failed to disable league");
  }
}
