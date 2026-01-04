/**
 * Seed Test Users Script
 * 
 * Creates 20 test users with password "password123"
 * Resets wallet balance for ALL users (old + new) to 0
 * 
 * Run with: npx ts-node scripts/seed-test-users.ts
 */

import { Pool } from "pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Test user data
const TEST_USERS = [
  { username: "player1", email: "player1@test.com", phone: "9100000001" },
  { username: "player2", email: "player2@test.com", phone: "9100000002" },
  { username: "player3", email: "player3@test.com", phone: "9100000003" },
  { username: "player4", email: "player4@test.com", phone: "9100000004" },
  { username: "player5", email: "player5@test.com", phone: "9100000005" },
  { username: "player6", email: "player6@test.com", phone: "9100000006" },
  { username: "player7", email: "player7@test.com", phone: "9100000007" },
  { username: "player8", email: "player8@test.com", phone: "9100000008" },
  { username: "player9", email: "player9@test.com", phone: "9100000009" },
  { username: "player10", email: "player10@test.com", phone: "9100000010" },
  { username: "gamer1", email: "gamer1@test.com", phone: "9200000001" },
  { username: "gamer2", email: "gamer2@test.com", phone: "9200000002" },
  { username: "gamer3", email: "gamer3@test.com", phone: "9200000003" },
  { username: "gamer4", email: "gamer4@test.com", phone: "9200000004" },
  { username: "gamer5", email: "gamer5@test.com", phone: "9200000005" },
  { username: "proking", email: "proking@test.com", phone: "9300000001" },
  { username: "firequeen", email: "firequeen@test.com", phone: "9300000002" },
  { username: "shadowx", email: "shadowx@test.com", phone: "9300000003" },
  { username: "thunderbolt", email: "thunderbolt@test.com", phone: "9300000004" },
  { username: "nighthawk", email: "nighthawk@test.com", phone: "9300000005" },
];

const PASSWORD = "password123";

async function seedTestUsers() {
  const client = await pool.connect();
  
  try {
    console.log("🚀 Starting test user seeding...\n");
    
    // Hash password once (same for all users)
    const hashedPassword = await bcrypt.hash(PASSWORD, 10);
    console.log("🔐 Password hashed successfully\n");
    
    // Check if wallets table exists
    const walletTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'wallets'
      ) as exists
    `);
    const hasWalletTable = walletTableExists.rows[0].exists;
    
    await client.query("BEGIN");
    
    let created = 0;
    let skipped = 0;
    
    for (const user of TEST_USERS) {
      // Check if user already exists
      const existingUser = await client.query(
        `SELECT id FROM users WHERE username = $1 OR email = $2 OR phone_number = $3`,
        [user.username, user.email, user.phone]
      );
      
      if (existingUser.rows.length > 0) {
        console.log(`⏭️  Skipped: ${user.username} (already exists)`);
        skipped++;
        continue;
      }
      
      // Create user
      const result = await client.query(
        `INSERT INTO users (
          username, email, phone_number, password_hash, 
          is_verified, email_verified, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, true, true, NOW(), NOW())
        RETURNING id, username`,
        [user.username, user.email, user.phone, hashedPassword]
      );
      
      const userId = result.rows[0].id;
      
      // Create wallet for user (if table exists)
      if (hasWalletTable) {
        await client.query(
          `INSERT INTO wallets (user_id, balance, created_at, updated_at)
           VALUES ($1, 0, NOW(), NOW())
           ON CONFLICT (user_id) DO NOTHING`,
          [userId]
        );
      }
      
      console.log(`✅ Created: ${user.username} (ID: ${userId})`);
      created++;
    }
    
    await client.query("COMMIT");
    
    console.log(`\n📊 User Creation Summary:`);
    console.log(`   ✅ Created: ${created}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   📝 Total test users: ${TEST_USERS.length}`);
    if (!hasWalletTable) {
      console.log(`   ⚠️  Wallets table not found - skipped wallet creation`);
    }
    
    return { created, skipped };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function resetAllWalletBalances() {
  const client = await pool.connect();
  
  try {
    console.log("\n💰 Resetting wallet balances for ALL users...\n");
    
    // Check if wallets table exists
    const walletTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'wallets'
      ) as exists
    `);
    
    if (!walletTableExists.rows[0].exists) {
      console.log("⚠️  Wallets table doesn't exist - skipping wallet reset");
      return { walletsReset: 0, holdsCancelled: 0 };
    }
    
    await client.query("BEGIN");
    
    // Get count of wallets before reset
    const countResult = await client.query(`SELECT COUNT(*) as count FROM wallets`);
    const walletCount = parseInt(countResult.rows[0].count);
    
    // Reset all wallet balances to 0
    await client.query(`UPDATE wallets SET balance = 0, updated_at = NOW()`);
    
    // Also clear any pending balance holds (if table exists)
    let cancelledHolds = 0;
    try {
      const holdsResult = await client.query(
        `UPDATE balance_holds 
         SET status = 'cancelled', released_at = NOW(), updated_at = NOW() 
         WHERE status = 'active'
         RETURNING id`
      );
      cancelledHolds = holdsResult.rowCount || 0;
    } catch {
      // Table might not exist, that's ok
    }
    
    await client.query("COMMIT");
    
    console.log(`✅ Reset ${walletCount} wallet(s) to ₹0`);
    if (cancelledHolds > 0) {
      console.log(`🔓 Cancelled ${cancelledHolds} active balance hold(s)`);
    }
    
    return { walletsReset: walletCount, holdsCancelled: cancelledHolds };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function showUserSummary() {
  const client = await pool.connect();
  
  try {
    console.log("\n📋 Current User Summary:\n");
    
    // Check if wallets table exists
    const walletTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'wallets'
      ) as exists
    `);
    const hasWalletTable = walletTableExists.rows[0].exists;
    
    // Get all test users
    let testUsers;
    if (hasWalletTable) {
      testUsers = await client.query(`
        SELECT u.username, u.email, COALESCE(w.balance, 0) as balance
        FROM users u
        LEFT JOIN wallets w ON u.id = w.user_id
        WHERE u.email LIKE '%@test.com'
        ORDER BY u.created_at DESC
        LIMIT 25
      `);
    } else {
      testUsers = await client.query(`
        SELECT u.username, u.email, 0 as balance
        FROM users u
        WHERE u.email LIKE '%@test.com'
        ORDER BY u.created_at DESC
        LIMIT 25
      `);
    }
    
    if (testUsers.rows.length > 0) {
      console.log("   Test Users:");
      console.log("   " + "-".repeat(50));
      testUsers.rows.forEach((user, i) => {
        console.log(`   ${(i + 1).toString().padStart(2)}. ${user.username.padEnd(15)} | ${user.email.padEnd(25)} | ₹${user.balance}`);
      });
    }
    
    // Get total user count
    const totalUsers = await client.query(`SELECT COUNT(*) as count FROM users`);
    
    console.log("\n   " + "-".repeat(50));
    console.log(`   Total Users: ${totalUsers.rows[0].count}`);
    
    if (hasWalletTable) {
      const totalWallets = await client.query(`SELECT COUNT(*) as count, SUM(balance) as total FROM wallets`);
      console.log(`   Total Wallets: ${totalWallets.rows[0].count}`);
      console.log(`   Combined Balance: ₹${totalWallets.rows[0].total || 0}`);
    }
    
  } finally {
    client.release();
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("  TEST USER SEEDING & WALLET RESET SCRIPT");
  console.log("=".repeat(60));
  console.log(`\n📅 Date: ${new Date().toLocaleString()}`);
  console.log(`🔑 Password for all test users: ${PASSWORD}\n`);
  
  try {
    // Step 1: Seed test users
    await seedTestUsers();
    
    // Step 2: Reset all wallet balances
    await resetAllWalletBalances();
    
    // Step 3: Show summary
    await showUserSummary();
    
    console.log("\n" + "=".repeat(60));
    console.log("  ✅ SCRIPT COMPLETED SUCCESSFULLY");
    console.log("=".repeat(60) + "\n");
    
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
