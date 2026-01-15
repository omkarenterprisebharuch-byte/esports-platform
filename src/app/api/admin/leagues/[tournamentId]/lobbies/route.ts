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
  TEAMS_PER_LOBBY,
  type LeagueMode,
} from "@/lib/league-config";
import { sendPushNotification } from "@/lib/notifications";

interface RouteParams {
  params: Promise<{ tournamentId: string }>;
}

/**
 * GET /api/admin/leagues/[tournamentId]/lobbies
 * Get all lobbies for a tournament
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const userRole = (user.role || "player") as UserRole;

    if (!isOrganizer(userRole)) {
      return errorResponse("Only organizers can view lobbies", 403);
    }

    const { tournamentId } = await params;

    // Verify tournament access
    const tournamentResult = await pool.query(
      `SELECT id, host_id, tournament_name, is_league_enabled, league_lobbies_created, league_mode
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

    // First, try to add the credentials_published column if it doesn't exist
    // This is safe since IF NOT EXISTS won't error if column exists
    try {
      await pool.query(`
        ALTER TABLE league_lobbies 
        ADD COLUMN IF NOT EXISTS credentials_published BOOLEAN DEFAULT FALSE
      `);
    } catch {
      // Column might already exist - ignore error
    }

    // Get lobbies with registration counts
    const lobbiesResult = await pool.query(
      `SELECT 
        ll.id,
        ll.lobby_number,
        ll.lobby_id as room_id,
        ll.lobby_password as room_password,
        ll.max_teams,
        ll.current_teams,
        ll.status,
        COALESCE(ll.credentials_published, FALSE) as credentials_published,
        ll.started_at,
        ll.completed_at,
        ll.created_at
      FROM league_lobbies ll
      WHERE ll.tournament_id = $1
      ORDER BY ll.lobby_number`,
      [tournamentId]
    );

    return successResponse({
      tournament: {
        id: tournament.id,
        name: tournament.tournament_name,
        mode: tournament.league_mode,
        lobbiesCreated: tournament.league_lobbies_created,
      },
      lobbies: lobbiesResult.rows,
    });
  } catch (error) {
    console.error("Error fetching lobbies:", error);
    return serverErrorResponse("Failed to fetch lobbies");
  }
}

/**
 * POST /api/admin/leagues/[tournamentId]/lobbies
 * Create lobbies for a tournament (called when registration opens)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const userRole = (user.role || "player") as UserRole;

    if (!isOrganizer(userRole)) {
      return errorResponse("Only organizers can create lobbies", 403);
    }

    const { tournamentId } = await params;

    // Get tournament details
    const tournamentResult = await pool.query(
      `SELECT id, host_id, is_league_enabled, league_total_slots, league_mode, 
              league_lobbies_created, status
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
      return errorResponse("League mode is not enabled", 400);
    }

    if (tournament.league_lobbies_created) {
      return errorResponse("Lobbies have already been created", 400);
    }

    const mode = tournament.league_mode as LeagueMode;
    const totalSlots = tournament.league_total_slots;
    
    // Validate mode and slots
    if (!mode || !TEAMS_PER_LOBBY[mode]) {
      return errorResponse(`Invalid league mode: ${mode}`, 400);
    }
    if (!totalSlots || totalSlots <= 0) {
      return errorResponse(`Invalid total slots: ${totalSlots}`, 400);
    }
    
    const teamsPerLobby = TEAMS_PER_LOBBY[mode];
    const lobbyCount = Math.ceil(totalSlots / teamsPerLobby);

    // First, ensure the credentials_published column exists and lobby_id/lobby_password can be NULL
    try {
      await pool.query(`
        ALTER TABLE league_lobbies 
        ADD COLUMN IF NOT EXISTS credentials_published BOOLEAN DEFAULT FALSE
      `);
      // Make lobby_id and lobby_password nullable
      await pool.query(`ALTER TABLE league_lobbies ALTER COLUMN lobby_id DROP NOT NULL`);
      await pool.query(`ALTER TABLE league_lobbies ALTER COLUMN lobby_password DROP NOT NULL`);
    } catch {
      // Column might already exist or constraint might already be dropped - ignore
    }

    // Create lobbies in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const createdLobbies = [];
      for (let i = 1; i <= lobbyCount; i++) {
        // Create lobby without Room ID and Password - admin will add them later
        const result = await client.query(
          `INSERT INTO league_lobbies 
           (tournament_id, lobby_number, lobby_id, lobby_password, max_teams, status)
           VALUES ($1, $2, NULL, NULL, $3, 'pending')
           RETURNING id, lobby_number, lobby_id as room_id, lobby_password as room_password, max_teams`,
          [tournamentId, i, teamsPerLobby]
        );

        createdLobbies.push({
          ...result.rows[0],
          credentials_published: false
        });
      }

      // Mark tournament as lobbies created
      await client.query(
        `UPDATE tournaments 
         SET league_lobbies_created = TRUE, updated_at = NOW()
         WHERE id = $1`,
        [tournamentId]
      );

      await client.query('COMMIT');

      return successResponse({
        message: `Created ${lobbyCount} lobbies successfully. Room IDs and Passwords can be added later.`,
        lobbies: createdLobbies,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error creating lobbies:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return errorResponse(`Failed to create lobbies: ${errMsg}`, 500);
  }
}

/**
 * PUT /api/admin/leagues/[tournamentId]/lobbies
 * Update lobby status, credentials, and publish to teams
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const userRole = (user.role || "player") as UserRole;

    if (!isOrganizer(userRole)) {
      return errorResponse("Only organizers can update lobbies", 403);
    }

    const { tournamentId } = await params;
    const body = await request.json();
    const { lobbyId, action, roomId, roomPassword } = body;

    // Verify tournament access
    const tournamentResult = await pool.query(
      `SELECT id, host_id, tournament_name FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      return errorResponse("Tournament not found", 404);
    }

    const tournament = tournamentResult.rows[0];
    if (tournament.host_id !== user.id && !isOwner(userRole)) {
      return errorResponse("Permission denied", 403);
    }

    if (!lobbyId) {
      return errorResponse("Lobby ID is required", 400);
    }

    switch (action) {
      case 'start':
        await pool.query(
          `UPDATE league_lobbies 
           SET status = 'in_progress', started_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND tournament_id = $2`,
          [lobbyId, tournamentId]
        );
        break;

      case 'complete':
        await pool.query(
          `UPDATE league_lobbies 
           SET status = 'completed', completed_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND tournament_id = $2`,
          [lobbyId, tournamentId]
        );
        break;

      case 'open':
        await pool.query(
          `UPDATE league_lobbies 
           SET status = 'open', updated_at = NOW()
           WHERE id = $1 AND tournament_id = $2`,
          [lobbyId, tournamentId]
        );
        break;

      case 'update_credentials':
        // Update Room ID and Password
        if (!roomId || !roomPassword) {
          return errorResponse("Room ID and Password are required", 400);
        }
        await pool.query(
          `UPDATE league_lobbies 
           SET lobby_id = $1, lobby_password = $2, updated_at = NOW()
           WHERE id = $3 AND tournament_id = $4`,
          [roomId.trim(), roomPassword.trim(), lobbyId, tournamentId]
        );
        return successResponse({ 
          message: "Credentials updated successfully",
          roomId: roomId.trim(),
          roomPassword: roomPassword.trim()
        });

      case 'publish_credentials':
        // Get lobby info
        const lobbyResult = await pool.query(
          `SELECT lobby_number, lobby_id, lobby_password, credentials_published 
           FROM league_lobbies WHERE id = $1 AND tournament_id = $2`,
          [lobbyId, tournamentId]
        );

        if (lobbyResult.rows.length === 0) {
          return errorResponse("Lobby not found", 404);
        }

        const lobby = lobbyResult.rows[0];
        
        if (!lobby.lobby_id || !lobby.lobby_password) {
          return errorResponse("Please set Room ID and Password before publishing", 400);
        }

        // Get all team members in this lobby
        const teamMembersResult = await pool.query(
          `SELECT DISTINCT u.id as user_id, u.username, t.team_name
           FROM tournament_registrations tr
           JOIN teams t ON tr.team_id = t.id
           JOIN team_members tm ON t.id = tm.team_id
           JOIN users u ON tm.user_id = u.id
           WHERE tr.tournament_id = $1 
             AND tr.lobby_number = $2
             AND tr.status = 'confirmed'`,
          [tournamentId, lobby.lobby_number]
        );

        // Send push notifications to all team members
        const notificationTitle = `🎮 Room Credentials Ready!`;
        const notificationBody = `Lobby #${lobby.lobby_number} - Room ID: ${lobby.lobby_id} | Password: ${lobby.lobby_password}`;

        let sentCount = 0;
        let failedCount = 0;

        for (const member of teamMembersResult.rows) {
          try {
            const result = await sendPushNotification(
              member.user_id,
              notificationTitle,
              notificationBody,
              { 
                tournamentId, 
                type: "room_credentials",
                url: `/app/tournament/${tournamentId}`
              }
            );
            sentCount += result.sent;
            failedCount += result.failed;
          } catch (err) {
            console.error(`Failed to send notification to ${member.username}:`, err);
            failedCount++;
          }
        }

        // Mark credentials as published
        await pool.query(
          `UPDATE league_lobbies 
           SET credentials_published = TRUE, updated_at = NOW()
           WHERE id = $1 AND tournament_id = $2`,
          [lobbyId, tournamentId]
        );

        return successResponse({ 
          message: `Credentials published to ${teamMembersResult.rows.length} team members`,
          notificationsSent: sentCount,
          notificationsFailed: failedCount,
          teamMemberCount: teamMembersResult.rows.length
        });

      default:
        return errorResponse("Invalid action", 400);
    }

    return successResponse({ message: `Lobby ${action} successful` });
  } catch (error) {
    console.error("Error updating lobby:", error);
    return serverErrorResponse("Failed to update lobby");
  }
}
