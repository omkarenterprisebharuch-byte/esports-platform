/**
 * Ban Checking Utility
 * 
 * Functions for checking if game IDs are banned
 */

import pool from "./db";

export interface BanStatus {
  banned: boolean;
  reason?: string;
  expires_at?: Date | null;
  is_permanent?: boolean;
}

/**
 * Check if a single game ID is banned
 */
export async function isGameIdBanned(
  gameId: string,
  gameType: string
): Promise<BanStatus> {
  const result = await pool.query(
    `SELECT reason, is_permanent, ban_expires_at 
     FROM banned_game_ids
     WHERE game_id = $1 
     AND game_type = $2 
     AND is_active = TRUE
     AND (is_permanent = TRUE OR ban_expires_at > NOW())`,
    [gameId, gameType]
  );

  if (result.rows.length === 0) {
    return { banned: false };
  }

  return {
    banned: true,
    reason: result.rows[0].reason,
    expires_at: result.rows[0].ban_expires_at,
    is_permanent: result.rows[0].is_permanent,
  };
}

/**
 * Check multiple game IDs at once
 * Returns a map of game ID -> ban status
 */
export async function checkMultipleGameIds(
  gameIds: Array<{ gameId: string; gameType: string }>
): Promise<Map<string, BanStatus>> {
  if (gameIds.length === 0) {
    return new Map();
  }

  // Build query for multiple IDs
  const conditions = gameIds.map((_, i) => `(game_id = $${i * 2 + 1} AND game_type = $${i * 2 + 2})`);
  const params = gameIds.flatMap((g) => [g.gameId, g.gameType]);

  const result = await pool.query(
    `SELECT game_id, game_type, reason, is_permanent, ban_expires_at 
     FROM banned_game_ids
     WHERE (${conditions.join(" OR ")})
     AND is_active = TRUE
     AND (is_permanent = TRUE OR ban_expires_at > NOW())`,
    params
  );

  const banMap = new Map<string, BanStatus>();

  // Initialize all as not banned
  for (const { gameId, gameType } of gameIds) {
    banMap.set(`${gameId}:${gameType}`, { banned: false });
  }

  // Update with actual bans
  for (const row of result.rows) {
    banMap.set(`${row.game_id}:${row.game_type}`, {
      banned: true,
      reason: row.reason,
      expires_at: row.ban_expires_at,
      is_permanent: row.is_permanent,
    });
  }

  return banMap;
}

/**
 * Get formatted ban message for user display
 */
export function getBanMessage(banStatus: BanStatus): string {
  if (!banStatus.banned) {
    return "";
  }

  if (banStatus.is_permanent) {
    return `This game ID has been permanently banned. Reason: ${banStatus.reason}`;
  }

  const expiryDate = banStatus.expires_at
    ? new Date(banStatus.expires_at).toLocaleDateString()
    : "unknown";
    
  return `This game ID is temporarily banned until ${expiryDate}. Reason: ${banStatus.reason}`;
}
