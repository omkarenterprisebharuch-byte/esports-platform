import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key";

/**
 * GET /api/auth/socket-token
 * Returns a short-lived JWT token for socket authentication.
 * This allows the socket server to authenticate users when the main token
 * is stored in httpOnly cookies (not accessible from JavaScript).
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user from httpOnly cookie
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Create a short-lived token for socket connection (5 minutes)
    const socketToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        is_host: user.is_host,
      },
      JWT_SECRET,
      { expiresIn: "5m" }
    );

    return NextResponse.json({
      success: true,
      token: socketToken,
    });
  } catch (error) {
    console.error("Error generating socket token:", error);
    return NextResponse.json(
      { error: "Failed to generate socket token" },
      { status: 500 }
    );
  }
}
