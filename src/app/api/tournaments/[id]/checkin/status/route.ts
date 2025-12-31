import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { getAllCheckinStatuses, getCheckinSummary } from "@/lib/checkin";
import pool from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tournaments/[id]/checkin/status
 * Get detailed check-in status for all registered teams (host/admin only)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { id: tournamentId } = await context.params;

    // Check if user is tournament host or admin
    const tournamentResult = await pool.query(
      `SELECT host_id FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      return errorResponse("Tournament not found", 404);
    }

    const tournament = tournamentResult.rows[0];

    // Only host or admin can view all check-in statuses
    const isHost = tournament.host_id === parseInt(user.id);
    const isAdmin = user.role === "owner";
    if (!isHost && !isAdmin) {
      return errorResponse("Only tournament host can view check-in statuses", 403);
    }

    // Get all check-in statuses
    const statuses = await getAllCheckinStatuses(tournamentId);
    const summary = await getCheckinSummary(tournamentId);

    // Separate registered and waitlisted
    const registered = statuses.filter((s) => !s.isWaitlisted);
    const waitlisted = statuses.filter((s) => s.isWaitlisted);

    return successResponse({
      registered: {
        total: registered.length,
        checkedIn: registered.filter((s) => s.checkedIn).length,
        teams: registered,
      },
      waitlisted: {
        total: waitlisted.length,
        checkedIn: waitlisted.filter((s) => s.checkedIn).length,
        teams: waitlisted,
      },
      summary,
    });
  } catch (error) {
    console.error("Get check-in statuses error:", error);
    return serverErrorResponse("Failed to get check-in statuses");
  }
}
