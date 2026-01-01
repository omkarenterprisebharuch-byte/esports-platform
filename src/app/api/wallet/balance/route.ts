/**
 * Wallet Balance API
 * GET /api/wallet/balance
 * 
 * Get current user's wallet balance including holds
 */

import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { successResponse, unauthorizedResponse } from "@/lib/api-response";
import { getBalanceSummary, getPendingRequestCounts, getUserActiveHolds } from "@/lib/wallet";

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    // Get balance summary including holds
    const balanceSummary = await getBalanceSummary(user.id);
    
    // Get active holds for detailed view
    const activeHolds = await getUserActiveHolds(user.id);
    
    // Get pending request counts for organizers
    let pendingCounts = { incoming: 0, outgoing: 0 };
    if (user.role === "organizer" || user.role === "owner") {
      pendingCounts = await getPendingRequestCounts(user.id, user.role);
    }

    return successResponse({
      balance: balanceSummary.wallet_balance,
      hold_balance: balanceSummary.hold_balance,
      available_balance: balanceSummary.available_balance,
      active_holds: activeHolds.length,
      holds: activeHolds.map(h => ({
        id: h.id,
        amount: h.amount,
        type: h.hold_type,
        description: h.description,
        created_at: h.created_at,
        expires_at: h.expires_at,
      })),
      pendingRequests: pendingCounts,
    });
  } catch (error) {
    console.error("Get wallet balance error:", error);
    return successResponse({ 
      balance: 0,
      hold_balance: 0,
      available_balance: 0,
      active_holds: 0,
      holds: [],
    });
  }
}
