/**
 * Backfill phone number hashes for existing users
 * 
 * This script:
 * 1. Reads all users with phone numbers
 * 2. Decrypts the phone numbers
 * 3. Generates hashes
 * 4. Detects duplicates and resolves them (keeps most recent)
 * 5. Updates the phone_number_hash column
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";
import { safeDecrypt, hashPhoneNumber } from "../src/lib/encryption";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

interface UserRow {
  id: string;
  username: string;
  phone_number: string | null;
  created_at: Date;
}

async function backfillPhoneHashes() {
  const client = await pool.connect();
  
  try {
    console.log("\n🔐 Backfilling Phone Number Hashes");
    console.log("=".repeat(50));
    
    await client.query("BEGIN");
    
    // Get all users with phone numbers
    const result = await client.query<UserRow>(`
      SELECT id, username, phone_number, created_at
      FROM users
      WHERE phone_number IS NOT NULL AND phone_number != ''
      ORDER BY created_at DESC
    `);
    
    console.log(`\nFound ${result.rows.length} users with phone numbers\n`);
    
    // Decrypt and group by phone number to find duplicates
    const phoneToUsers = new Map<string, { id: string; username: string; created_at: Date }[]>();
    
    for (const row of result.rows) {
      const decryptedPhone = safeDecrypt(row.phone_number);
      if (!decryptedPhone) continue;
      
      // Normalize the phone number
      const normalized = decryptedPhone.replace(/[\s\-()]/g, "").toLowerCase();
      
      if (!phoneToUsers.has(normalized)) {
        phoneToUsers.set(normalized, []);
      }
      phoneToUsers.get(normalized)!.push({
        id: row.id,
        username: row.username,
        created_at: row.created_at,
      });
    }
    
    // Find and report duplicates
    const duplicates: { phone: string; users: { id: string; username: string; created_at: Date }[] }[] = [];
    
    for (const [phone, users] of phoneToUsers) {
      if (users.length > 1) {
        duplicates.push({ phone, users });
      }
    }
    
    if (duplicates.length > 0) {
      console.log(`⚠️  Found ${duplicates.length} duplicate phone numbers:\n`);
      
      for (const dup of duplicates) {
        console.log(`  Phone: ${dup.phone}`);
        // Users are already sorted by created_at DESC, first one is most recent
        for (let i = 0; i < dup.users.length; i++) {
          const user = dup.users[i];
          const status = i === 0 ? "✅ KEEP" : "❌ CLEAR";
          console.log(`    ${status} - ${user.username} (id: ${user.id}, created: ${user.created_at.toISOString()})`);
        }
        console.log();
      }
      
      // Resolve duplicates: clear phone_number from older users
      console.log("Resolving duplicates by clearing phone from older accounts...\n");
      
      for (const dup of duplicates) {
        // Keep the first (most recent), clear the rest
        const toClear = dup.users.slice(1);
        for (const user of toClear) {
          await client.query(
            `UPDATE users SET phone_number = NULL, phone_number_hash = NULL, updated_at = NOW() WHERE id = $1`,
            [user.id]
          );
          console.log(`  Cleared phone from ${user.username} (${user.id})`);
        }
      }
      console.log();
    }
    
    // Now update all users with their hash
    console.log("Updating phone_number_hash for all users...\n");
    
    let updated = 0;
    let skipped = 0;
    
    // Re-fetch users after duplicate cleanup
    const freshResult = await client.query<UserRow>(`
      SELECT id, username, phone_number
      FROM users
      WHERE phone_number IS NOT NULL AND phone_number != ''
    `);
    
    for (const row of freshResult.rows) {
      const decryptedPhone = safeDecrypt(row.phone_number);
      if (!decryptedPhone) {
        skipped++;
        continue;
      }
      
      const hash = hashPhoneNumber(decryptedPhone);
      
      await client.query(
        `UPDATE users SET phone_number_hash = $1, updated_at = NOW() WHERE id = $2`,
        [hash, row.id]
      );
      updated++;
    }
    
    // Clear hash for users without phone numbers
    await client.query(`
      UPDATE users 
      SET phone_number_hash = NULL 
      WHERE (phone_number IS NULL OR phone_number = '') AND phone_number_hash IS NOT NULL
    `);
    
    await client.query("COMMIT");
    
    console.log("=".repeat(50));
    console.log(`✅ Backfill complete!`);
    console.log(`   - Updated: ${updated} users`);
    console.log(`   - Skipped: ${skipped} users (couldn't decrypt)`);
    console.log(`   - Duplicates resolved: ${duplicates.length}`);
    console.log("=".repeat(50));
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error during backfill, transaction rolled back:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

backfillPhoneHashes().catch(console.error);
