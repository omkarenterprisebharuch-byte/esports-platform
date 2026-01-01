/**
 * Reset Wallet Balances Script
 * 
 * This script resets all user wallet balances to 0.
 * Owner will deposit fresh amounts to organizers who will deposit to users.
 * 
 * Usage: npx ts-node scripts/reset-wallet-balances.ts
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function resetAllWalletBalances() {
  console.log("Starting wallet balance reset...\n");

  try {
    // Get current state before reset
    const beforeResult = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        SUM(wallet_balance) as total_balance,
        COUNT(CASE WHEN wallet_balance > 0 THEN 1 END) as users_with_balance
      FROM users
    `);

    const before = beforeResult.rows[0];
    console.log("Current State:");
    console.log(`  Total Users: ${before.total_users}`);
    console.log(`  Users with Balance: ${before.users_with_balance}`);
    console.log(`  Total Balance: ₹${parseFloat(before.total_balance || 0).toFixed(2)}`);
    console.log("");

    // Reset all wallet balances to 0
    const updateResult = await pool.query(`
      UPDATE users 
      SET wallet_balance = 0, updated_at = NOW()
      WHERE wallet_balance != 0
      RETURNING id, username, wallet_balance
    `);

    console.log(`Reset ${updateResult.rowCount} user balances to 0`);

    // Archive old transactions (mark them as historical)
    const archiveResult = await pool.query(`
      UPDATE wallet_transactions 
      SET description = CONCAT('[RESET] ', COALESCE(description, ''))
      WHERE created_at < NOW()
      AND description NOT LIKE '[RESET]%'
    `);

    console.log(`Archived ${archiveResult.rowCount} transaction records`);

    // Verify final state
    const afterResult = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        SUM(wallet_balance) as total_balance,
        COUNT(CASE WHEN wallet_balance > 0 THEN 1 END) as users_with_balance
      FROM users
    `);

    const after = afterResult.rows[0];
    console.log("\nFinal State:");
    console.log(`  Total Users: ${after.total_users}`);
    console.log(`  Users with Balance: ${after.users_with_balance}`);
    console.log(`  Total Balance: ₹${parseFloat(after.total_balance || 0).toFixed(2)}`);

    console.log("\n✅ All wallet balances have been reset to 0");
    console.log("Owner can now deposit fresh amounts to organizers.");

  } catch (error) {
    console.error("Error resetting wallet balances:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the script
resetAllWalletBalances()
  .then(() => {
    console.log("\nScript completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
