import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import {
  canCheckIn,
  performCheckin,
  getCheckinSummary,
  getAllCheckinStatuses,
  getCheckinSettings,
  calculateCheckinStatus,
} from "@/lib/checkin";
import pool from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tournaments/[id]/checkin
 * Get check-in status for the tournament and current user
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: tournamentId } = await context.params;

    // Get tournament info
    const tournamentResult = await pool.query(
      `SELECT id, tournament_name, tournament_start_date, max_teams, current_teams 
       FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      return errorResponse("Tournament not found", 404);
    }

    const tournament = tournamentResult.rows[0];
    const settings = await getCheckinSettings(tournamentId);
    const checkinStatus = calculateCheckinStatus(
      tournament.tournament_start_date,
      settings.windowMinutes
    );

    // Get check-in summary
    const summary = await getCheckinSummary(tournamentId);

    // Check if user is authenticated and get their status
    const user = getUserFromRequest(request);
    let userCheckinStatus = null;

    if (user) {
      const canCheckinResult = await canCheckIn(tournamentId, user.id);
      userCheckinStatus = {
        canCheckIn: canCheckinResult.canCheckIn,
        reason: canCheckinResult.reason,
        registration: canCheckinResult.registration,
      };
    }

    return successResponse({
      tournament: {
        id: tournament.id,
        name: tournament.tournament_name,
        startDate: tournament.tournament_start_date,
        maxTeams: tournament.max_teams,
        currentTeams: tournament.current_teams,
      },
      checkinWindow: {
        isOpen: checkinStatus.isOpen,
        opensAt: checkinStatus.opensAt,
        closesAt: checkinStatus.closesAt,
        minutesUntilOpen: checkinStatus.minutesUntilOpen,
        minutesUntilClose: checkinStatus.minutesUntilClose,
        windowMinutes: settings.windowMinutes,
      },
      summary,
      userStatus: userCheckinStatus,
      isFinalized: settings.finalizedAt !== null,
      finalizedAt: settings.finalizedAt,
    });
  } catch (error) {
    console.error("Get check-in status error:", error);
    return serverErrorResponse("Failed to get check-in status");
  }
}

/**
 * POST /api/tournaments/[id]/checkin
 * Check in for a tournament
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { id: tournamentId } = await context.params;

    // Perform check-in
    const result = await performCheckin(tournamentId, user.id);

    if (!result.success) {
      return errorResponse(result.message, 400);
    }

    return successResponse(
      {
        checkedIn: true,
        registration: result.registration,
      },
      result.message
    );
  } catch (error) {
    console.error("Check-in error:", error);
    return serverErrorResponse("Failed to check in");
  }
}
