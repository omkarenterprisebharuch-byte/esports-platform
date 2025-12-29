import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { 
  hashToken,
  AUTH_COOKIE_OPTIONS, 
  REFRESH_COOKIE_OPTIONS,
  CSRF_COOKIE_OPTIONS 
} from "@/lib/auth";

/**
 * POST /api/auth/logout
 * - Revokes the refresh token in database
 * - Clears all auth cookies
 */
export async function POST(request: NextRequest) {
  try {
    // Get refresh token from cookie to revoke it
    const refreshToken = request.cookies.get(REFRESH_COOKIE_OPTIONS.name)?.value;
    
    if (refreshToken) {
      // Hash the token and revoke it in database
      const tokenHash = hashToken(refreshToken);
      await pool.query(
        `UPDATE refresh_tokens 
         SET revoked = TRUE, revoked_at = NOW() 
         WHERE token_hash = $1 AND revoked = FALSE`,
        [tokenHash]
      );
    }
  } catch (error) {
    // Log but don't fail - we still want to clear cookies
    console.error("Error revoking refresh token:", error);
  }

  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully",
  });

  // Clear access token cookie
  response.cookies.set(AUTH_COOKIE_OPTIONS.name, "", {
    httpOnly: AUTH_COOKIE_OPTIONS.httpOnly,
    secure: AUTH_COOKIE_OPTIONS.secure,
    sameSite: AUTH_COOKIE_OPTIONS.sameSite,
    path: AUTH_COOKIE_OPTIONS.path,
    maxAge: 0, // Expire immediately
  });

  // Clear refresh token cookie
  response.cookies.set(REFRESH_COOKIE_OPTIONS.name, "", {
    httpOnly: REFRESH_COOKIE_OPTIONS.httpOnly,
    secure: REFRESH_COOKIE_OPTIONS.secure,
    sameSite: REFRESH_COOKIE_OPTIONS.sameSite,
    path: REFRESH_COOKIE_OPTIONS.path,
    maxAge: 0, // Expire immediately
  });

  // Clear CSRF token cookie
  response.cookies.set(CSRF_COOKIE_OPTIONS.name, "", {
    httpOnly: CSRF_COOKIE_OPTIONS.httpOnly,
    secure: CSRF_COOKIE_OPTIONS.secure,
    sameSite: CSRF_COOKIE_OPTIONS.sameSite,
    path: CSRF_COOKIE_OPTIONS.path,
    maxAge: 0,
  });

  return response;
}
