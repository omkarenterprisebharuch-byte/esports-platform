/**
 * Admin League Teams API
 * GET /api/admin/leagues/[tournamentId]/teams
 * 
 * Fetches all registered teams for a league tournament
 * with their lobby assignments
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyToken, isOrganizer, isOwner } from "@/lib/auth";

interface RouteContext {
  params: Promise<{
    tournamentId: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { tournamentId } = await context.params;

    // Auth check
    const token = request.cookies.get("auth_token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Invalid token" },
        { status: 401 }
      );
    }

    // Only organizers, owners, or hosts can view teams
    if (!isOrganizer(user.role) && !isOwner(user.role) && !user.is_host) {
      return NextResponse.json(
        { success: false, message: "Permission denied" },
        { status: 403 }
      );
    }

    // Verify tournament exists and belongs to user (if organizer)
    const tournamentCheck = await pool.query(
      `SELECT id, tournament_name, host_id, is_league_enabled 
       FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Tournament not found" },
        { status: 404 }
      );
    }

    const tournament = tournamentCheck.rows[0];

    // Check ownership (organizers can only see their own tournaments)
    if (isOrganizer(user.role) && !isOwner(user.role) && tournament.host_id !== user.id) {
      return NextResponse.json(
        { success: false, message: "You can only view your own tournaments" },
        { status: 403 }
      );
    }

    // Fetch registered teams with captain info and lobby assignment
    const teamsResult = await pool.query(
      `SELECT 
        tr.id as registration_id,
        tr.team_id,
        tr.status,
        tr.registered_at,
        t.team_name,
        t.team_code,
        t.total_members as member_count,
        u.username as captain_username,
        u.email as captain_email,
        ll.lobby_number,
        ll.lobby_id
       FROM tournament_registrations tr
       JOIN teams t ON tr.team_id = t.id
       JOIN users u ON t.captain_id = u.id
       LEFT JOIN league_lobby_assignments lla ON lla.registration_id = tr.id
       LEFT JOIN league_lobbies ll ON lla.lobby_id = ll.id
       WHERE tr.tournament_id = $1
       ORDER BY tr.registered_at ASC`,
      [tournamentId]
    );

    return NextResponse.json({
      success: true,
      data: {
        tournament: {
          id: tournament.id,
          name: tournament.tournament_name,
          is_league_enabled: tournament.is_league_enabled,
        },
        teams: teamsResult.rows,
        total: teamsResult.rows.length,
      },
    });
  } catch (error) {
    console.error("Error fetching league teams:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch teams" },
      { status: 500 }
    );
  }
}
