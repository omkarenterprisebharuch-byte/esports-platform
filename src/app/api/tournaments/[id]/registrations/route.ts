import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { decryptTeamMemberGameUid } from "@/lib/encryption";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tournaments/[id]/registrations
 * Get all registrations for a tournament (Host/Admin only)
 * Query params:
 *   - include_players=true: Include player details with game UIDs
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = getUserFromRequest(request);
    const { searchParams } = new URL(request.url);
    const includePlayers = searchParams.get("include_players") === "true";

    if (!user) {
      return unauthorizedResponse();
    }

    // Check if tournament exists
    const tournamentResult = await pool.query(
      `SELECT t.*, 
        CASE
          WHEN t.tournament_end_date <= NOW() THEN 'completed'
          WHEN t.tournament_start_date <= NOW() THEN 'ongoing'
          WHEN t.registration_end_date <= NOW() THEN 'upcoming'
          WHEN t.registration_start_date <= NOW() THEN 'registration_open'
          ELSE 'upcoming'
        END as computed_status
      FROM tournaments t WHERE t.id = $1`,
      [id]
    );

    if (tournamentResult.rows.length === 0) {
      return notFoundResponse("Tournament not found");
    }

    const tournament = tournamentResult.rows[0];

    // Check permissions - must be host or admin
    const userResult = await pool.query(
      "SELECT is_host, username FROM users WHERE id = $1",
      [user.id]
    );
    const dbUser = userResult.rows[0];

    const isHost = tournament.host_id === user.id;
    const isAdmin = dbUser?.username === "admin";

    if (!isHost && !isAdmin) {
      return errorResponse("Only tournament host or admin can view registrations", 403);
    }

    // Get all registrations with team/user details
    const registrationsResult = await pool.query(
      `SELECT 
        tr.id,
        tr.slot_number,
        tr.registration_type,
        tr.status,
        tr.team_id,
        tr.user_id,
        tr.registered_at,
        tr.lobby_id,
        t.team_name,
        t.captain_id as leader_id,
        COALESCE(cap.username, u.username) as leader_name
      FROM tournament_registrations tr
      LEFT JOIN teams t ON tr.team_id = t.id
      LEFT JOIN users u ON tr.user_id = u.id
      LEFT JOIN users cap ON t.captain_id = cap.id
      WHERE tr.tournament_id = $1 AND tr.status != 'cancelled'
      ORDER BY tr.slot_number ASC`,
      [id]
    );

    let registrations = registrationsResult.rows;

    // If include_players is requested, fetch all team members
    if (includePlayers) {
      // Get team IDs that we need to fetch members for
      const teamIds = registrations
        .filter(r => r.team_id)
        .map(r => r.team_id);

      if (teamIds.length > 0) {
        // Fetch all team members in one query
        const membersResult = await pool.query(
          `SELECT 
            tm.team_id,
            tm.user_id as id,
            u.username,
            tm.game_uid,
            tm.game_name as in_game_name
          FROM team_members tm
          JOIN users u ON tm.user_id = u.id
          WHERE tm.team_id = ANY($1) AND tm.left_at IS NULL
          ORDER BY tm.role = 'captain' DESC, tm.joined_at ASC`,
          [teamIds]
        );

        // Decrypt game_uid for each member and group by team_id
        const membersByTeam: Record<string, typeof membersResult.rows> = {};
        for (const member of membersResult.rows) {
          const decrypted = decryptTeamMemberGameUid({
            ...member,
            game_uid: member.game_uid,
          });
          if (!membersByTeam[member.team_id]) {
            membersByTeam[member.team_id] = [];
          }
          membersByTeam[member.team_id].push({
            id: member.id,
            username: member.username,
            in_game_name: member.in_game_name,
            in_game_id: decrypted.game_uid, // Decrypted game UID
          });
        }

        // Add players to each registration
        registrations = registrations.map(reg => ({
          ...reg,
          players: reg.team_id ? (membersByTeam[reg.team_id] || []) : [],
        }));
      }

      // For solo registrations, add the single user as the player
      for (let i = 0; i < registrations.length; i++) {
        const reg = registrations[i];
        if (reg.registration_type === "solo" && reg.user_id && !reg.team_id) {
          // Fetch solo player's game info from their active game ID
          const soloPlayerResult = await pool.query(
            `SELECT 
              u.id,
              u.username,
              gid.in_game_name,
              gid.player_id as in_game_id
            FROM users u
            LEFT JOIN game_ids gid ON gid.user_id = u.id AND gid.game_type = $1
            WHERE u.id = $2
            LIMIT 1`,
            [tournament.game_type, reg.user_id]
          );
          
          if (soloPlayerResult.rows.length > 0) {
            const player = soloPlayerResult.rows[0];
            registrations[i] = {
              ...reg,
              players: [{
                id: player.id,
                username: player.username,
                in_game_name: player.in_game_name,
                in_game_id: player.in_game_id,
              }],
            };
          }
        }
      }
    }

    return successResponse({
      tournament: {
        id: tournament.id,
        tournament_name: tournament.tournament_name,
        tournament_type: tournament.tournament_type,
        status: tournament.computed_status,
        current_teams: tournament.current_teams,
        max_teams: tournament.max_teams,
      },
      registrations,
    });
  } catch (error) {
    console.error("Get tournament registrations error:", error);
    return serverErrorResponse(error);
  }
}
