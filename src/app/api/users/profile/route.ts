import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { z } from "zod";
import { validateWithSchema, validationErrorResponse } from "@/lib/validations";
import { sanitizeUsername, sanitizeText, sanitizeUrl, sanitizeGameUid } from "@/lib/sanitize";
import { 
  encryptPhoneNumber, 
  encryptInGameIds, 
  decryptUserPII,
  hashPhoneNumber,
  hashGameId 
} from "@/lib/encryption";
import { invalidateDbCache } from "@/lib/db-cache";

// Type for PostgreSQL errors with code
interface PostgresError extends Error {
  code?: string;
  constraint?: string;
  detail?: string;
}

// Schema for updating profile
const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be less than 50 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens")
    .optional(),
  full_name: z
    .string()
    .max(100, "Full name must be less than 100 characters")
    .optional(),
  phone_number: z
    .string()
    .max(20, "Phone number must be less than 20 characters")
    .regex(/^[\d\s\-+()]*$/, "Invalid phone number format")
    .optional()
    .or(z.literal("")),
  in_game_ids: z.record(
    z.string()
      .max(50, "Game ID must be less than 50 characters")
      .regex(/^\d*$/, "Game ID must contain only numbers")
  ).optional(),
  avatar_url: z
    .string()
    .url("Invalid avatar URL")
    .optional()
    .or(z.literal("")),
}).refine((data) => {
  return Object.values(data).some(v => v !== undefined);
}, {
  message: "At least one field must be provided for update",
});

/**
 * GET /api/users/profile
 * Get current user's profile
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    const result = await pool.query(
      `SELECT 
        id, 
        username, 
        email, 
        full_name,
        phone_number,
        in_game_ids,
        is_host, 
        is_verified,
        profile_picture_url, 
        wallet_balance,
        created_at
      FROM users WHERE id = $1`,
      [user.id]
    );

    if (result.rows.length === 0) {
      return unauthorizedResponse("User not found");
    }

    // Decrypt PII fields (phone_number, in_game_ids)
    const userData = decryptUserPII(result.rows[0]);
    
    return successResponse({ 
      user: {
        ...userData,
        avatar_url: userData.profile_picture_url,
      }
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * PUT /api/users/profile
 * Update current user's profile
 */
export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    
    // Validate input with Zod
    const validation = validateWithSchema(updateProfileSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }
    
    const { username, phone_number, in_game_ids, avatar_url, full_name } = validation.data;

    // Sanitize user inputs
    const sanitizedUsername = username ? sanitizeUsername(username) : undefined;
    const sanitizedFullName = full_name ? sanitizeText(full_name, 100) : undefined;
    const sanitizedAvatarUrl = avatar_url ? sanitizeUrl(avatar_url) : (avatar_url === "" ? "" : undefined);
    // Sanitize in_game_ids object values
    const sanitizedInGameIds = in_game_ids 
      ? Object.fromEntries(
          Object.entries(in_game_ids).map(([key, value]) => [
            sanitizeText(key, 50),
            sanitizeGameUid(value)
          ])
        )
      : undefined;

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (sanitizedUsername !== undefined) {
      // Check if username is taken
      const existing = await pool.query(
        "SELECT id FROM users WHERE username = $1 AND id != $2",
        [sanitizedUsername, user.id]
      );
      if (existing.rows.length > 0) {
        return errorResponse("Username is already taken");
      }
      updates.push(`username = $${paramIndex}`);
      values.push(sanitizedUsername);
      paramIndex++;
    }

    if (sanitizedFullName !== undefined) {
      updates.push(`full_name = $${paramIndex}`);
      values.push(sanitizedFullName);
      paramIndex++;
    }

    if (phone_number !== undefined) {
      // Check if phone number is taken by another user (only if not empty)
      if (phone_number && phone_number.trim() !== "") {
        // Use hash for uniqueness check (encrypted values can't be compared directly)
        const phoneHash = hashPhoneNumber(phone_number);
        const existingPhone = await pool.query(
          "SELECT id FROM users WHERE phone_number_hash = $1 AND id != $2",
          [phoneHash, user.id]
        );
        if (existingPhone.rows.length > 0) {
          return errorResponse("USER_2007");
        }
      }
      // Encrypt phone number before storing
      const encryptedPhone = phone_number.trim() !== "" ? encryptPhoneNumber(phone_number) : null;
      const phoneHash = phone_number.trim() !== "" ? hashPhoneNumber(phone_number) : null;
      
      updates.push(`phone_number = $${paramIndex}`);
      values.push(encryptedPhone);
      paramIndex++;
      
      updates.push(`phone_number_hash = $${paramIndex}`);
      values.push(phoneHash);
      paramIndex++;
    }

    if (sanitizedInGameIds !== undefined) {
      // Check if any in-game ID is already in use by another user (using hashes)
      if (sanitizedInGameIds && Object.keys(sanitizedInGameIds).length > 0) {
        for (const [gameKey, gameId] of Object.entries(sanitizedInGameIds)) {
          if (gameId && gameId.trim() !== "") {
            // Use hash for uniqueness check (encrypted values can't be compared directly)
            const gameIdHash = hashGameId(gameKey, gameId);
            const existingGameId = await pool.query(
              `SELECT user_id FROM user_game_id_hashes 
               WHERE game_type = $1 AND game_id_hash = $2 AND user_id != $3`,
              [gameKey, gameIdHash, user.id]
            );
            if (existingGameId.rows.length > 0) {
              return errorResponse(`The ${gameKey} ID "${gameId}" is already in use by another player`);
            }
          }
        }
      }
      
      // Update game ID hashes in the tracking table
      // First, remove old hashes for this user
      await pool.query(
        `DELETE FROM user_game_id_hashes WHERE user_id = $1`,
        [user.id]
      );
      
      // Insert new hashes
      if (sanitizedInGameIds && Object.keys(sanitizedInGameIds).length > 0) {
        for (const [gameKey, gameId] of Object.entries(sanitizedInGameIds)) {
          if (gameId && gameId.trim() !== "") {
            const gameIdHash = hashGameId(gameKey, gameId);
            await pool.query(
              `INSERT INTO user_game_id_hashes (user_id, game_type, game_id_hash)
               VALUES ($1, $2, $3)
               ON CONFLICT (game_type, game_id_hash) DO NOTHING`,
              [user.id, gameKey, gameIdHash]
            );
          }
        }
      }
      
      // Encrypt in-game IDs before storing
      const encryptedGameIds = encryptInGameIds(sanitizedInGameIds);
      updates.push(`in_game_ids = $${paramIndex}`);
      values.push(encryptedGameIds ? JSON.stringify(encryptedGameIds) : null);
      paramIndex++;
    }

    if (sanitizedAvatarUrl !== undefined) {
      updates.push(`profile_picture_url = $${paramIndex}`);
      values.push(sanitizedAvatarUrl);
      paramIndex++;
    }

    if (updates.length === 0) {
      // This shouldn't happen due to Zod validation, but keep as safety
      return errorResponse("No fields to update");
    }

    updates.push(`updated_at = NOW()`);
    values.push(user.id);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex} 
       RETURNING id, username, email, full_name, phone_number, in_game_ids, is_host, profile_picture_url as avatar_url`,
      values
    );

    // Invalidate user cache
    await invalidateDbCache.user(user.id);

    // Decrypt PII fields before returning to client
    const updatedUser = decryptUserPII(result.rows[0]);

    return successResponse(
      { user: updatedUser },
      "Profile updated successfully"
    );
  } catch (error) {
    console.error("Update profile error:", error);
    
    // Handle PostgreSQL unique constraint violations
    const pgError = error as PostgresError;
    if (pgError.code === "23505") { // unique_violation
      const detail = pgError.detail || "";
      const constraint = pgError.constraint || "";
      
      // Check which field caused the violation
      if (constraint.includes("username") || detail.toLowerCase().includes("username")) {
        return errorResponse("USER_2003");
      }
      if (constraint.includes("email") || detail.toLowerCase().includes("email")) {
        return errorResponse("USER_2002");
      }
      if (constraint.includes("phone") || detail.toLowerCase().includes("phone")) {
        return errorResponse("USER_2007");
      }
      if (constraint.includes("game_id") || detail.toLowerCase().includes("game_id") || detail.toLowerCase().includes("game id")) {
        return errorResponse("USER_2008");
      }
      // Generic unique violation
      return errorResponse("This value is already in use by another account", 409);
    }
    
    // Handle custom trigger error for game_id uniqueness
    if (pgError.message && pgError.message.includes("already in use by another user")) {
      return errorResponse("USER_2008");
    }
    
    return serverErrorResponse(error);
  }
}
