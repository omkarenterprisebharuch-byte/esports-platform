/**
 * Single Balance Hold API
 * GET /api/wallet/holds/[id] - Get a specific hold
 * DELETE /api/wallet/holds/[id] - Release a hold (admin only or owner of hold)
 */

import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { 
  successResponse, 
  unauthorizedResponse, 
  notFoundResponse,
  errorResponse,
  serverErrorResponse 
} from "@/lib/api-response";
import { releaseHold, BalanceHold } from "@/lib/wallet";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/wallet/holds/[id]
 * Get details of a specific hold
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = getUserFromRequest(request);
    
    if (!user) {
      return unauthorizedResponse();
    }

    const holdResult = await pool.query(
      `SELECT bh.*, t.tournament_name, tr.tournament_id
       FROM balance_holds bh
       LEFT JOIN tournament_registrations tr ON bh.reference_id = tr.id::text AND bh.reference_type = 'tournament_registration'
       LEFT JOIN tournaments t ON tr.tournament_id = t.id
       WHERE bh.id = $1`,
      [id]
    );

    if (holdResult.rows.length === 0) {
      return notFoundResponse("Hold not found");
    }

    const hold = holdResult.rows[0];

    // Check if user owns this hold or is platform owner
    const isOwner = user.role === "owner";
    if (hold.user_id !== user.id && !isOwner) {
      return errorResponse("You don't have permission to view this hold", 403);
    }

    return successResponse({
      hold: {
        ...hold,
        tournament_name: hold.tournament_name || null,
      },
    });
  } catch (error) {
    console.error("Get hold error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * DELETE /api/wallet/holds/[id]
 * Release a hold - returns the held amount to available balance
 * Only admins/owners can release holds, or the user themselves if the related registration is cancelled
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = getUserFromRequest(request);
    
    if (!user) {
      return unauthorizedResponse();
    }

    // Get the hold
    const holdResult = await pool.query<BalanceHold>(
      "SELECT * FROM balance_holds WHERE id = $1",
      [id]
    );

    if (holdResult.rows.length === 0) {
      return notFoundResponse("Hold not found");
    }

    const hold = holdResult.rows[0];

    // Check permissions - only platform owner can force-release holds
    const isOwner = user.role === "owner";
    if (!isOwner) {
      // Regular users can only view their holds, not release them manually
      // Holds should be released via proper flow (cancel waitlist, etc.)
      return errorResponse(
        "Only administrators can manually release holds. Use cancel registration to release your hold.",
        403
      );
    }

    if (hold.status !== "active") {
      return errorResponse(`Hold is already ${hold.status}`, 400);
    }

    // Get reason from body if provided
    let reason = "Released by admin";
    try {
      const body = await request.json();
      if (body.reason) {
        reason = body.reason;
      }
    } catch {
      // No body provided, use default reason
    }

    // Release the hold
    const releasedHold = await releaseHold(parseInt(id), reason);

    return successResponse({
      message: "Hold released successfully",
      hold: releasedHold,
      amount_released: releasedHold.amount,
    });
  } catch (error) {
    console.error("Release hold error:", error);
    if (error instanceof Error) {
      return errorResponse(error.message);
    }
    return serverErrorResponse(error);
  }
}
