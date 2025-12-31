import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { finalizeCheckins, getCheckinSettings, calculateCheckinStatus } from "@/lib/checkin";
import pool from "@/lib/db";
import { sendNotification } from "@/lib/notifications";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/tournaments/[id]/checkin/finalize
 * Finalize check-ins and promote waitlist teams (host/admin only or automatic)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = getUserFromRequest(request);
    
    const { id: tournamentId } = await context.params;

    // Get tournament info
    const tournamentResult = await pool.query(
      `SELECT id, host_id, tournament_name, tournament_start_date 
       FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      return errorResponse("Tournament not found", 404);
    }

    const tournament = tournamentResult.rows[0];

    // Check authorization - must be host, admin, or system call (no user = cron job)
    const isSystemCall = !user;
    const isHost = user && tournament.host_id === parseInt(user.id);
    const isAdmin = user && user.role === "owner";

    if (!isSystemCall && !isHost && !isAdmin) {
      return unauthorizedResponse();
    }

    // Check if check-in window has closed (tournament has started)
    const settings = await getCheckinSettings(tournamentId);
    const checkinStatus = calculateCheckinStatus(
      tournament.tournament_start_date,
      settings.windowMinutes
    );

    // Only allow finalization if check-in window is closed (tournament started)
    // or if force=true is passed by admin
    const body = await request.json().catch(() => ({}));
    const force = body.force === true && isAdmin;

    if (checkinStatus.isOpen && !force) {
      return errorResponse(
        "Cannot finalize check-ins while check-in window is still open",
        400
      );
    }

    // Perform finalization
    const result = await finalizeCheckins(tournamentId);

    if (!result.success) {
      return errorResponse("Check-ins have already been finalized", 400);
    }

    // Send notifications to promoted teams
    for (const promoted of result.promotedTeams) {
      try {
        await sendNotification({
          userId: promoted.userId.toString(),
          title: "🎉 You've been promoted!",
          message: `You've been moved from the waitlist to slot #${promoted.slotNumber} in ${tournament.tournament_name}!`,
          type: "waitlist",
          category: "success",
          tournamentId: tournamentId.toString(),
          tournamentName: tournament.tournament_name,
          actionUrl: `/tournament/${tournamentId}`,
        });
      } catch (e) {
        console.error("Failed to send promotion notification:", e);
      }
    }

    // Send notifications to disqualified teams
    for (const disqualified of result.disqualifiedTeams) {
      try {
        await sendNotification({
          userId: disqualified.userId.toString(),
          title: "❌ Check-in missed",
          message: `You missed the check-in for ${tournament.tournament_name} and your slot has been forfeited.`,
          type: "tournament_update",
          category: "warning",
          tournamentId: tournamentId.toString(),
          tournamentName: tournament.tournament_name,
          actionUrl: `/tournament/${tournamentId}`,
        });
      } catch (e) {
        console.error("Failed to send DQ notification:", e);
      }
    }

    return successResponse(
      {
        finalized: true,
        promotedCount: result.promotedCount,
        disqualifiedCount: result.disqualifiedCount,
        promotedTeams: result.promotedTeams,
        disqualifiedTeams: result.disqualifiedTeams,
      },
      `Check-ins finalized. ${result.promotedCount} teams promoted from waitlist, ${result.disqualifiedCount} no-shows.`
    );
  } catch (error) {
    console.error("Finalize check-ins error:", error);
    return serverErrorResponse("Failed to finalize check-ins");
  }
}
