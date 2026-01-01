/**
 * Balance Holds API
 * GET /api/wallet/holds - Get all holds with pagination and filtering
 * 
 * Get current user's balance holds
 */

import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { 
  successResponse, 
  unauthorizedResponse, 
  serverErrorResponse 
} from "@/lib/api-response";
import { 
  getUserHolds, 
  getBalanceSummary,
  HoldStatus 
} from "@/lib/wallet";

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") as HoldStatus | null;

    // Get balance summary
    const balanceSummary = await getBalanceSummary(user.id);

    // Get holds with pagination
    const { holds, total } = await getUserHolds(
      user.id, 
      status || undefined, 
      page, 
      limit
    );

    return successResponse({
      summary: {
        wallet_balance: balanceSummary.wallet_balance,
        hold_balance: balanceSummary.hold_balance,
        available_balance: balanceSummary.available_balance,
      },
      holds,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get wallet holds error:", error);
    return serverErrorResponse(error);
  }
}
