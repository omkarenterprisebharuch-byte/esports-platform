/**
 * Backfill game ID hashes for existing users
 * 
 * This script:
 * 1. Reads all users with in_game_ids
 * 2. Decrypts the game IDs
 * 3. Generates hashes for each game_type:game_id combination
 * 4. Detects duplicates and resolves them (keeps most recent)
 * 5. Populates the user_game_id_hashes table
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";
import { safeDecrypt, hashGameId } from "../src/lib/encryption";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

interface UserRow {
  id: string;
  username: string;
  in_game_ids: Record<string, string> | null;
  created_at: Date;
}

interface GameIdEntry {
  userId: string;
  username: string;
  gameType: string;
  gameId: string;
  hash: string;
  createdAt: Date;
}

async function backfillGameIdHashes() {
  const client = await pool.connect();
  
  try {
    console.log("\n🎮 Backfilling Game ID Hashes");
    console.log("=".repeat(50));
    
    await client.query("BEGIN");
    
    // Clear existing hashes (fresh start)
    await client.query("DELETE FROM user_game_id_hashes");
    console.log("Cleared existing game ID hashes\n");
    
    // Get all users with game IDs
    const result = await client.query<UserRow>(`
      SELECT id, username, in_game_ids, created_at
      FROM users
      WHERE in_game_ids IS NOT NULL AND in_game_ids != '{}'::jsonb
      ORDER BY created_at DESC
    `);
    
    console.log(`Found ${result.rows.length} users with game IDs\n`);
    
    // Decrypt and collect all game IDs
    const allGameIds: GameIdEntry[] = [];
    
    for (const row of result.rows) {
      if (!row.in_game_ids) continue;
      
      for (const [gameType, encryptedGameId] of Object.entries(row.in_game_ids)) {
        if (!encryptedGameId || encryptedGameId.trim() === "") continue;
        
        const decryptedGameId = safeDecrypt(encryptedGameId);
        if (!decryptedGameId || decryptedGameId.trim() === "") continue;
        
        const hash = hashGameId(gameType, decryptedGameId);
        if (!hash) continue;
        
        allGameIds.push({
          userId: row.id,
          username: row.username,
          gameType,
          gameId: decryptedGameId,
          hash,
          createdAt: row.created_at,
        });
      }
    }
    
    console.log(`Total game IDs found: ${allGameIds.length}\n`);
    
    // Group by hash to find duplicates
    const hashToEntries = new Map<string, GameIdEntry[]>();
    
    for (const entry of allGameIds) {
      const key = `${entry.gameType}:${entry.hash}`;
      if (!hashToEntries.has(key)) {
        hashToEntries.set(key, []);
      }
      hashToEntries.get(key)!.push(entry);
    }
    
    // Find and report duplicates
    const duplicates: { gameType: string; gameId: string; entries: GameIdEntry[] }[] = [];
    
    for (const [, entries] of hashToEntries) {
      if (entries.length > 1) {
        // Sort by created_at DESC (most recent first)
        entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        duplicates.push({
          gameType: entries[0].gameType,
          gameId: entries[0].gameId,
          entries,
        });
      }
    }
    
    if (duplicates.length > 0) {
      console.log(`⚠️  Found ${duplicates.length} duplicate game IDs:\n`);
      
      for (const dup of duplicates) {
        console.log(`  Game: ${dup.gameType}, ID: ${dup.gameId}`);
        for (let i = 0; i < dup.entries.length; i++) {
          const entry = dup.entries[i];
          const status = i === 0 ? "✅ KEEP" : "❌ CLEAR";
          console.log(`    ${status} - ${entry.username} (id: ${entry.userId}, created: ${entry.createdAt.toISOString()})`);
        }
        console.log();
      }
      
      // Resolve duplicates: clear game ID from older users' in_game_ids
      console.log("Resolving duplicates by clearing game ID from older accounts...\n");
      
      for (const dup of duplicates) {
        const toClear = dup.entries.slice(1); // Keep first (most recent), clear rest
        
        for (const entry of toClear) {
          // Remove just this specific game type from in_game_ids
          await client.query(
            `UPDATE users 
             SET in_game_ids = in_game_ids - $1, updated_at = NOW() 
             WHERE id = $2`,
            [entry.gameType, entry.userId]
          );
          console.log(`  Cleared ${entry.gameType} ID from ${entry.username} (${entry.userId})`);
        }
      }
      console.log();
    }
    
    // Now insert all unique hashes
    console.log("Populating user_game_id_hashes table...\n");
    
    // Re-fetch users after duplicate cleanup
    const freshResult = await client.query<UserRow>(`
      SELECT id, username, in_game_ids
      FROM users
      WHERE in_game_ids IS NOT NULL AND in_game_ids != '{}'::jsonb
    `);
    
    let inserted = 0;
    let skipped = 0;
    
    for (const row of freshResult.rows) {
      if (!row.in_game_ids) continue;
      
      for (const [gameType, encryptedGameId] of Object.entries(row.in_game_ids)) {
        if (!encryptedGameId || encryptedGameId.trim() === "") continue;
        
        const decryptedGameId = safeDecrypt(encryptedGameId);
        if (!decryptedGameId || decryptedGameId.trim() === "") {
          skipped++;
          continue;
        }
        
        const hash = hashGameId(gameType, decryptedGameId);
        if (!hash) {
          skipped++;
          continue;
        }
        
        try {
          await client.query(
            `INSERT INTO user_game_id_hashes (user_id, game_type, game_id_hash)
             VALUES ($1, $2, $3)
             ON CONFLICT (game_type, game_id_hash) DO NOTHING`,
            [row.id, gameType, hash]
          );
          inserted++;
        } catch (err) {
          console.error(`  Error inserting hash for ${row.username}/${gameType}: ${err}`);
          skipped++;
        }
      }
    }
    
    await client.query("COMMIT");
    
    console.log("=".repeat(50));
    console.log(`✅ Backfill complete!`);
    console.log(`   Inserted: ${inserted} game ID hashes`);
    console.log(`   Skipped: ${skipped}`);
    if (duplicates.length > 0) {
      console.log(`   Duplicates resolved: ${duplicates.length}`);
    }
    console.log();
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("\n❌ Backfill failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
backfillGameIdHashes().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
