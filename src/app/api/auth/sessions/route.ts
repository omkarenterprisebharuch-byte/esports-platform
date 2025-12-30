import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { parseUserAgent, getDeviceName } from "@/lib/device-detection";
import { z } from "zod";
import { validateWithSchema, validationErrorResponse, uuidSchema } from "@/lib/validations";

// Schema for revoking a session
const revokeSessionSchema = z.object({
  session_id: uuidSchema,
});

export interface ActiveSession {
  id: string;
  deviceName: string;
  browser: string;
  os: string;
  ipAddress: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

/**
 * GET /api/auth/sessions
 * Get all active sessions for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    // Get the current session's token hash from cookie
    const refreshToken = request.cookies.get("refresh_token")?.value;
    let currentTokenHash: string | null = null;
    
    if (refreshToken) {
      // Import dynamically to avoid circular dependencies
      const crypto = await import("crypto");
      currentTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    }

    // Get all active sessions for this user
    const result = await pool.query(
      `SELECT id, user_agent, ip_address, created_at, expires_at, token_hash
       FROM refresh_tokens 
       WHERE user_id = $1 AND revoked = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [user.id]
    );

    const sessions: ActiveSession[] = result.rows.map(row => {
      const deviceInfo = parseUserAgent(row.user_agent || "unknown");
      return {
        id: row.id,
        deviceName: getDeviceName(deviceInfo),
        browser: `${deviceInfo.browser}${deviceInfo.browserVersion ? ' ' + deviceInfo.browserVersion : ''}`,
        os: `${deviceInfo.os}${deviceInfo.osVersion ? ' ' + deviceInfo.osVersion : ''}`,
        ipAddress: row.ip_address || "Unknown",
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        isCurrent: row.token_hash === currentTokenHash,
      };
    });

    return successResponse({ 
      sessions,
      totalSessions: sessions.length,
    });
  } catch (error) {
    console.error("Get sessions error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * DELETE /api/auth/sessions
 * Revoke a specific session (logout from that device)
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    
    // Validate input
    const validation = validateWithSchema(revokeSessionSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }

    const { session_id } = validation.data;

    // Verify the session belongs to this user and revoke it
    const result = await pool.query(
      `UPDATE refresh_tokens 
       SET revoked = TRUE, revoked_at = NOW()
       WHERE id = $1 AND user_id = $2 AND revoked = FALSE
       RETURNING id`,
      [session_id, user.id]
    );

    if (result.rows.length === 0) {
      return errorResponse("Session not found or already revoked", 404);
    }

    return successResponse(
      { revokedSessionId: session_id },
      "Session revoked successfully"
    );
  } catch (error) {
    console.error("Revoke session error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * POST /api/auth/sessions/revoke-all
 * Revoke all sessions except the current one
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    // Get current session's token hash
    const refreshToken = request.cookies.get("refresh_token")?.value;
    
    if (!refreshToken) {
      return errorResponse("No active session", 400);
    }

    const crypto = await import("crypto");
    const currentTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    // Revoke all sessions except current
    const result = await pool.query(
      `UPDATE refresh_tokens 
       SET revoked = TRUE, revoked_at = NOW()
       WHERE user_id = $1 AND revoked = FALSE AND token_hash != $2
       RETURNING id`,
      [user.id, currentTokenHash]
    );

    return successResponse(
      { revokedCount: result.rows.length },
      `${result.rows.length} other session(s) logged out successfully`
    );
  } catch (error) {
    console.error("Revoke all sessions error:", error);
    return serverErrorResponse(error);
  }
}
