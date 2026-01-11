/**
 * User Profile Uniqueness Enforcement Script
 * 
 * This script ensures strict uniqueness for:
 * - username
 * - phone_number
 * - email
 * - game_ids (each individual game_id must be unique across all users)
 * 
 * Retention Rule: Keep the MOST RECENT record (by created_at), delete older duplicates
 * 
 * Data Model:
 * - Table: users
 * - id: UUID PRIMARY KEY
 * - username: VARCHAR(50)
 * - email: VARCHAR(255)
 * - phone_number: VARCHAR(20)
 * - in_game_ids: JSONB - stored as {"game_type": "game_id"} e.g., {"pubg": "player123"}
 * - created_at: TIMESTAMP WITH TIME ZONE
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool, PoolClient } from "pg";

interface DuplicateRecord {
  id: string;
  username: string;
  email: string;
  phone_number: string | null;
  in_game_ids: Record<string, string> | null;
  created_at: Date;
}

interface GameIdDuplicate {
  game_type: string;
  game_id: string;
  user_ids: string[];
  usernames: string[];
  created_dates: Date[];
}

interface CleanupReport {
  duplicateUsernames: { field: string; value: string; deletedIds: string[]; keptId: string }[];
  duplicateEmails: { field: string; value: string; deletedIds: string[]; keptId: string }[];
  duplicatePhones: { field: string; value: string; deletedIds: string[]; keptId: string }[];
  duplicateGameIds: { gameType: string; gameId: string; deletedIds: string[]; keptId: string; clearedFromUsers: string[] }[];
  totalDeleted: number;
  totalGameIdsCleaned: number;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * Detect duplicate usernames
 */
async function detectDuplicateUsernames(client: PoolClient): Promise<Map<string, DuplicateRecord[]>> {
  const result = await client.query<DuplicateRecord>(`
    SELECT id, username, email, phone_number, in_game_ids, created_at
    FROM users
    WHERE LOWER(username) IN (
      SELECT LOWER(username)
      FROM users
      GROUP BY LOWER(username)
      HAVING COUNT(*) > 1
    )
    ORDER BY LOWER(username), created_at DESC
  `);

  const duplicates = new Map<string, DuplicateRecord[]>();
  for (const row of result.rows) {
    const key = row.username.toLowerCase();
    if (!duplicates.has(key)) {
      duplicates.set(key, []);
    }
    duplicates.get(key)!.push(row);
  }

  return duplicates;
}

/**
 * Detect duplicate emails
 */
async function detectDuplicateEmails(client: PoolClient): Promise<Map<string, DuplicateRecord[]>> {
  const result = await client.query<DuplicateRecord>(`
    SELECT id, username, email, phone_number, in_game_ids, created_at
    FROM users
    WHERE LOWER(email) IN (
      SELECT LOWER(email)
      FROM users
      GROUP BY LOWER(email)
      HAVING COUNT(*) > 1
    )
    ORDER BY LOWER(email), created_at DESC
  `);

  const duplicates = new Map<string, DuplicateRecord[]>();
  for (const row of result.rows) {
    const key = row.email.toLowerCase();
    if (!duplicates.has(key)) {
      duplicates.set(key, []);
    }
    duplicates.get(key)!.push(row);
  }

  return duplicates;
}

/**
 * Detect duplicate phone numbers (excluding NULL/empty)
 */
async function detectDuplicatePhones(client: PoolClient): Promise<Map<string, DuplicateRecord[]>> {
  const result = await client.query<DuplicateRecord>(`
    SELECT id, username, email, phone_number, in_game_ids, created_at
    FROM users
    WHERE phone_number IS NOT NULL 
      AND phone_number != ''
      AND phone_number IN (
        SELECT phone_number
        FROM users
        WHERE phone_number IS NOT NULL AND phone_number != ''
        GROUP BY phone_number
        HAVING COUNT(*) > 1
      )
    ORDER BY phone_number, created_at DESC
  `);

  const duplicates = new Map<string, DuplicateRecord[]>();
  for (const row of result.rows) {
    const key = row.phone_number!;
    if (!duplicates.has(key)) {
      duplicates.set(key, []);
    }
    duplicates.get(key)!.push(row);
  }

  return duplicates;
}

/**
 * Detect duplicate game_ids across all users
 * Each individual game_id value must be unique across all users (per game_type)
 */
async function detectDuplicateGameIds(client: PoolClient): Promise<GameIdDuplicate[]> {
  // Extract all game_ids from JSONB and find duplicates
  const result = await client.query(`
    WITH expanded_game_ids AS (
      SELECT 
        id,
        username,
        created_at,
        key as game_type,
        value as game_id,
        LOWER(value) as game_id_lower
      FROM users,
      LATERAL jsonb_each_text(COALESCE(in_game_ids, '{}'::jsonb))
      WHERE in_game_ids IS NOT NULL 
        AND in_game_ids != '{}'::jsonb
    ),
    duplicate_game_ids AS (
      SELECT game_type, game_id_lower
      FROM expanded_game_ids
      WHERE game_id IS NOT NULL AND game_id != ''
      GROUP BY game_type, game_id_lower
      HAVING COUNT(*) > 1
    )
    SELECT 
      e.game_type,
      MAX(e.game_id) as game_id,
      array_agg(e.id ORDER BY e.created_at DESC) as user_ids,
      array_agg(e.username ORDER BY e.created_at DESC) as usernames,
      array_agg(e.created_at ORDER BY e.created_at DESC) as created_dates
    FROM expanded_game_ids e
    JOIN duplicate_game_ids d ON e.game_type = d.game_type AND e.game_id_lower = d.game_id_lower
    GROUP BY e.game_type, e.game_id_lower
  `);

  return result.rows.map(row => ({
    game_type: row.game_type,
    game_id: row.game_id,
    user_ids: row.user_ids,
    usernames: row.usernames,
    created_dates: row.created_dates,
  }));
}

/**
 * Delete older duplicates, keeping the most recent record
 * Returns the IDs of deleted records
 */
async function deleteOlderDuplicates(
  client: PoolClient,
  duplicates: Map<string, DuplicateRecord[]>,
  fieldName: string
): Promise<{ value: string; deletedIds: string[]; keptId: string }[]> {
  const results: { value: string; deletedIds: string[]; keptId: string }[] = [];

  for (const [value, records] of duplicates) {
    if (records.length < 2) continue;

    // Records are already sorted by created_at DESC, so first one is most recent
    const [keep, ...toDelete] = records;
    const deleteIds = toDelete.map(r => r.id);

    if (deleteIds.length > 0) {
      // Check for foreign key dependencies before deletion
      const dependencyCheck = await client.query(`
        SELECT 
          (SELECT COUNT(*) FROM tournament_registrations WHERE user_id = ANY($1::uuid[])) as registrations,
          (SELECT COUNT(*) FROM teams WHERE captain_id = ANY($1::uuid[])) as teams_captain,
          (SELECT COUNT(*) FROM team_members WHERE user_id = ANY($1::uuid[])) as team_members,
          (SELECT COUNT(*) FROM tournaments WHERE host_id = ANY($1::uuid[])) as tournaments_hosted,
          (SELECT COUNT(*) FROM wallet_transactions WHERE user_id = ANY($1::uuid[])) as wallet_txns
      `, [deleteIds]);

      const deps = dependencyCheck.rows[0];
      const hasDependencies = 
        parseInt(deps.registrations) > 0 ||
        parseInt(deps.teams_captain) > 0 ||
        parseInt(deps.team_members) > 0 ||
        parseInt(deps.tournaments_hosted) > 0 ||
        parseInt(deps.wallet_txns) > 0;

      if (hasDependencies) {
        console.log(`⚠️  Skipping deletion for ${fieldName}="${value}" - has FK dependencies:`);
        console.log(`   Registrations: ${deps.registrations}, Teams(captain): ${deps.teams_captain}, Team Members: ${deps.team_members}`);
        console.log(`   Tournaments: ${deps.tournaments_hosted}, Wallet Txns: ${deps.wallet_txns}`);
        console.log(`   Would have deleted: ${deleteIds.join(', ')}`);
        console.log(`   Manual merge required for these records.`);
        continue;
      }

      await client.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [deleteIds]);
      
      results.push({
        value,
        deletedIds: deleteIds,
        keptId: keep.id,
      });

      console.log(`✓ ${fieldName}="${value}": Deleted ${deleteIds.length} older records, kept ${keep.id} (${keep.username})`);
    }
  }

  return results;
}

/**
 * Clean duplicate game_ids
 * Strategy: Keep the game_id for the most recent user, remove from older users' in_game_ids JSONB
 */
async function cleanDuplicateGameIds(
  client: PoolClient,
  duplicates: GameIdDuplicate[]
): Promise<{ gameType: string; gameId: string; deletedIds: string[]; keptId: string; clearedFromUsers: string[] }[]> {
  const results: { gameType: string; gameId: string; deletedIds: string[]; keptId: string; clearedFromUsers: string[] }[] = [];

  for (const dup of duplicates) {
    // user_ids[0] is the most recent (sorted by created_at DESC)
    const keepUserId = dup.user_ids[0];
    const clearFromUserIds = dup.user_ids.slice(1);

    if (clearFromUserIds.length > 0) {
      // Remove the game_id from older users' in_game_ids JSONB
      await client.query(`
        UPDATE users 
        SET 
          in_game_ids = in_game_ids - $1,
          updated_at = NOW()
        WHERE id = ANY($2::uuid[])
      `, [dup.game_type, clearFromUserIds]);

      results.push({
        gameType: dup.game_type,
        gameId: dup.game_id,
        deletedIds: [], // No users deleted, just game_id cleared
        keptId: keepUserId,
        clearedFromUsers: clearFromUserIds,
      });

      console.log(`✓ game_id ${dup.game_type}="${dup.game_id}": Kept for user ${keepUserId}, cleared from ${clearFromUserIds.length} older users`);
    }
  }

  return results;
}

/**
 * Main cleanup function - runs in a transaction
 */
async function enforceUniqueness(dryRun: boolean = true): Promise<CleanupReport> {
  const client = await pool.connect();
  const report: CleanupReport = {
    duplicateUsernames: [],
    duplicateEmails: [],
    duplicatePhones: [],
    duplicateGameIds: [],
    totalDeleted: 0,
    totalGameIdsCleaned: 0,
  };

  try {
    console.log("\n" + "=".repeat(60));
    console.log(dryRun ? "🔍 DRY RUN MODE - No changes will be made" : "🚀 LIVE MODE - Changes will be applied");
    console.log("=".repeat(60) + "\n");

    await client.query("BEGIN");

    // Set a savepoint for potential rollback
    await client.query("SAVEPOINT cleanup_start");

    // 1. Detect and report all duplicates
    console.log("📊 Detecting duplicates...\n");

    const dupUsernames = await detectDuplicateUsernames(client);
    const dupEmails = await detectDuplicateEmails(client);
    const dupPhones = await detectDuplicatePhones(client);
    const dupGameIds = await detectDuplicateGameIds(client);

    console.log(`Found ${dupUsernames.size} duplicate username groups`);
    console.log(`Found ${dupEmails.size} duplicate email groups`);
    console.log(`Found ${dupPhones.size} duplicate phone number groups`);
    console.log(`Found ${dupGameIds.length} duplicate game_id groups\n`);

    // 2. Display duplicate details
    if (dupUsernames.size > 0) {
      console.log("\n📋 Duplicate Usernames:");
      for (const [username, records] of dupUsernames) {
        console.log(`  "${username}": ${records.length} records`);
        for (const r of records) {
          console.log(`    - ${r.id} (${r.email}) created ${r.created_at.toISOString()}`);
        }
      }
    }

    if (dupEmails.size > 0) {
      console.log("\n📋 Duplicate Emails:");
      for (const [email, records] of dupEmails) {
        console.log(`  "${email}": ${records.length} records`);
        for (const r of records) {
          console.log(`    - ${r.id} (${r.username}) created ${r.created_at.toISOString()}`);
        }
      }
    }

    if (dupPhones.size > 0) {
      console.log("\n📋 Duplicate Phone Numbers:");
      for (const [phone, records] of dupPhones) {
        console.log(`  "${phone}": ${records.length} records`);
        for (const r of records) {
          console.log(`    - ${r.id} (${r.username}) created ${r.created_at.toISOString()}`);
        }
      }
    }

    if (dupGameIds.length > 0) {
      console.log("\n📋 Duplicate Game IDs:");
      for (const dup of dupGameIds) {
        console.log(`  ${dup.game_type}="${dup.game_id}": ${dup.user_ids.length} users`);
        for (let i = 0; i < dup.user_ids.length; i++) {
          console.log(`    - ${dup.user_ids[i]} (${dup.usernames[i]}) created ${dup.created_dates[i]}`);
        }
      }
    }

    if (!dryRun) {
      console.log("\n" + "=".repeat(60));
      console.log("🔧 Cleaning duplicates (keeping most recent)...\n");

      // 3. Delete older duplicates (order matters - start with emails/usernames due to UNIQUE constraints)
      const emailResults = await deleteOlderDuplicates(client, dupEmails, "email");
      report.duplicateEmails = emailResults.map(r => ({ field: "email", ...r }));
      
      const usernameResults = await deleteOlderDuplicates(client, dupUsernames, "username");
      report.duplicateUsernames = usernameResults.map(r => ({ field: "username", ...r }));

      const phoneResults = await deleteOlderDuplicates(client, dupPhones, "phone_number");
      report.duplicatePhones = phoneResults.map(r => ({ field: "phone_number", ...r }));

      // 4. Clean duplicate game_ids (remove from older users, don't delete users)
      const gameIdResults = await cleanDuplicateGameIds(client, dupGameIds);
      report.duplicateGameIds = gameIdResults;

      report.totalDeleted = 
        emailResults.reduce((sum, r) => sum + r.deletedIds.length, 0) +
        usernameResults.reduce((sum, r) => sum + r.deletedIds.length, 0) +
        phoneResults.reduce((sum, r) => sum + r.deletedIds.length, 0);

      report.totalGameIdsCleaned = gameIdResults.reduce((sum, r) => sum + r.clearedFromUsers.length, 0);

      // 5. Commit transaction
      await client.query("COMMIT");

      console.log("\n" + "=".repeat(60));
      console.log("✅ Cleanup completed successfully!");
      console.log(`   Total users deleted: ${report.totalDeleted}`);
      console.log(`   Total game_ids cleaned: ${report.totalGameIdsCleaned}`);
      console.log("=".repeat(60));
    } else {
      // Dry run - rollback
      await client.query("ROLLBACK TO SAVEPOINT cleanup_start");
      await client.query("ROLLBACK");
      
      console.log("\n" + "=".repeat(60));
      console.log("ℹ️  Dry run complete - no changes made");
      console.log("   Run with --live to apply changes");
      console.log("=".repeat(60));
    }

    return report;
  } catch (error) {
    // Rollback on any error
    await client.query("ROLLBACK");
    console.error("\n❌ Error during cleanup, transaction rolled back:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Verify uniqueness constraints can be added
 */
async function verifyConstraintsCanBeAdded(client: PoolClient): Promise<boolean> {
  console.log("\n🔍 Verifying uniqueness constraints can be added...\n");

  // Check for remaining duplicates
  const checks = await client.query(`
    SELECT 
      (SELECT COUNT(*) FROM (
        SELECT LOWER(username) FROM users GROUP BY LOWER(username) HAVING COUNT(*) > 1
      ) u) as dup_usernames,
      (SELECT COUNT(*) FROM (
        SELECT LOWER(email) FROM users GROUP BY LOWER(email) HAVING COUNT(*) > 1
      ) e) as dup_emails,
      (SELECT COUNT(*) FROM (
        SELECT phone_number FROM users 
        WHERE phone_number IS NOT NULL AND phone_number != ''
        GROUP BY phone_number HAVING COUNT(*) > 1
      ) p) as dup_phones
  `);

  const { dup_usernames, dup_emails, dup_phones } = checks.rows[0];

  if (parseInt(dup_usernames) > 0 || parseInt(dup_emails) > 0 || parseInt(dup_phones) > 0) {
    console.log("⚠️  Remaining duplicates found:");
    console.log(`   Usernames: ${dup_usernames}`);
    console.log(`   Emails: ${dup_emails}`);
    console.log(`   Phone numbers: ${dup_phones}`);
    console.log("   Cannot add unique constraints until these are resolved.");
    return false;
  }

  console.log("✅ No duplicate values found - constraints can be safely added");
  return true;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--live");
  const addConstraints = args.includes("--add-constraints");

  try {
    console.log("\n🔐 User Profile Uniqueness Enforcement");
    console.log("=====================================\n");

    // Run cleanup
    await enforceUniqueness(dryRun);

    // Optionally verify and suggest constraint addition
    if (!dryRun || addConstraints) {
      const client = await pool.connect();
      try {
        const canAddConstraints = await verifyConstraintsCanBeAdded(client);
        if (canAddConstraints && addConstraints) {
          console.log("\n📌 Adding unique constraints is handled by a separate migration.");
          console.log("   Run: npx tsx scripts/run-migration.ts add_user_uniqueness_constraints.sql");
        }
      } finally {
        client.release();
      }
    }

    console.log("\n📖 Usage:");
    console.log("   npx tsx scripts/enforce-user-uniqueness.ts          # Dry run (preview changes)");
    console.log("   npx tsx scripts/enforce-user-uniqueness.ts --live   # Apply changes");
    console.log("");

  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
