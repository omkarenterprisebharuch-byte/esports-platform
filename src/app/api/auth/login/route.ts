import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { 
  verifyPassword, 
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  generateCsrfToken,
  AUTH_COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
  CSRF_COOKIE_OPTIONS 
} from "@/lib/auth";
import {
  errorResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { 
  checkRateLimit, 
  getClientIp, 
  loginRateLimit, 
  rateLimitResponse 
} from "@/lib/rate-limit";
import { 
  loginSchema, 
  validateWithSchema, 
  validationErrorResponse 
} from "@/lib/validations";

/**
 * POST /api/auth/login
 * User login with access token (15min) + refresh token (7 days)
 * - Access token: httpOnly cookie (15 min expiry)
 * - Refresh token: httpOnly cookie (7 day expiry), hash stored in DB
 * Rate limited: 5 attempts per 15 minutes
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimitResult = checkRateLimit(clientIp, loginRateLimit);
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const body = await request.json();
    
    // Validate input with Zod
    const validation = validateWithSchema(loginSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }
    
    const { email, password } = validation.data;

    // Find user by email (including role)
    const result = await pool.query(
      "SELECT *, COALESCE(role, 'player') as role FROM users WHERE email = $1", 
      [email]
    );

    if (result.rows.length === 0) {
      return errorResponse("Invalid credentials", 401);
    }

    const user = result.rows[0];

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return errorResponse("Invalid credentials", 401);
    }

    // Generate access token (15 min) with role
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      username: user.username,
      is_host: user.is_host,
      role: user.role,
    });

    // Generate refresh token and store hash in database
    const { token: refreshToken, hash: refreshTokenHash } = generateRefreshToken();
    const refreshTokenExpiry = getRefreshTokenExpiry();

    // Get device info for security tracking
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Store refresh token hash in database
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, refreshTokenHash, refreshTokenExpiry, userAgent, clientIp]
    );

    // Generate CSRF token
    const csrfToken = generateCsrfToken(user.id);

    // Update last login
    await pool.query(
      "UPDATE users SET last_login_at = NOW() WHERE id = $1",
      [user.id]
    );

    // Create response with user data
    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          is_host: user.is_host,
        },
        csrfToken, // Send CSRF token in response body
      },
    });

    // Set httpOnly cookie for access token (15 min)
    response.cookies.set(AUTH_COOKIE_OPTIONS.name, accessToken, {
      httpOnly: AUTH_COOKIE_OPTIONS.httpOnly,
      secure: AUTH_COOKIE_OPTIONS.secure,
      sameSite: AUTH_COOKIE_OPTIONS.sameSite,
      path: AUTH_COOKIE_OPTIONS.path,
      maxAge: AUTH_COOKIE_OPTIONS.maxAge,
    });

    // Set httpOnly cookie for refresh token (7 days)
    response.cookies.set(REFRESH_COOKIE_OPTIONS.name, refreshToken, {
      httpOnly: REFRESH_COOKIE_OPTIONS.httpOnly,
      secure: REFRESH_COOKIE_OPTIONS.secure,
      sameSite: REFRESH_COOKIE_OPTIONS.sameSite,
      path: REFRESH_COOKIE_OPTIONS.path,
      maxAge: REFRESH_COOKIE_OPTIONS.maxAge,
    });

    // Set CSRF token cookie (readable by JavaScript for inclusion in requests)
    response.cookies.set(CSRF_COOKIE_OPTIONS.name, csrfToken, {
      httpOnly: CSRF_COOKIE_OPTIONS.httpOnly,
      secure: CSRF_COOKIE_OPTIONS.secure,
      sameSite: CSRF_COOKIE_OPTIONS.sameSite,
      path: CSRF_COOKIE_OPTIONS.path,
      maxAge: CSRF_COOKIE_OPTIONS.maxAge,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return serverErrorResponse(error);
  }
}
