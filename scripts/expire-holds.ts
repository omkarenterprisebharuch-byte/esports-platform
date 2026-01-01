/**
 * Expire Balance Holds Script
 * 
 * This script expires balance holds that have passed their expiry time.
 * Should be run periodically (e.g., via cron job every hour).
 * 
 * Usage: npx ts-node scripts/expire-holds.ts
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool, PoolClient } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

interface ExpiredHold {
  id: number;
  user_id: string;
  amount: number;
  hold_type: string;
  description: string;
  expires_at: Date;
}

async function expireHolds(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Balance Holds Expiry Script");
  console.log(new Date().toISOString());
  console.log("=".repeat(60));
  console.log("");

  const client: PoolClient = await pool.connect();
  
  try {
    await client.query("BEGIN");

    // Find expired holds
    const expiredHoldsResult = await client.query<ExpiredHold>(
      `SELECT id, user_id, amount, hold_type, description, expires_at
       FROM balance_holds 
       WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < NOW()
       FOR UPDATE`,
      []
    );

    const expiredHolds = expiredHoldsResult.rows;

    if (expiredHolds.length === 0) {
      console.log("No expired holds found.");
      await client.query("COMMIT");
      return;
    }

    console.log(`Found ${expiredHolds.length} expired hold(s):\n`);
    console.table(expiredHolds.map(h => ({
      ID: h.id,
      Amount: `₹${h.amount.toLocaleString()}`,
      Type: h.hold_type,
      Description: h.description?.substring(0, 30) + (h.description?.length > 30 ? "..." : ""),
      "Expired At": h.expires_at.toISOString(),
    })));

    let expiredCount = 0;
    let totalReleased = 0;

    for (const hold of expiredHolds) {
      try {
        // Get user's current hold balance with lock
        const userResult = await client.query(
          "SELECT hold_balance, username FROM users WHERE id = $1 FOR UPDATE",
          [hold.user_id]
        );

        if (userResult.rows.length > 0) {
          const currentHoldBalance = parseFloat(userResult.rows[0].hold_balance) || 0;
          const newHoldBalance = Math.max(0, currentHoldBalance - hold.amount);

          // Update user's hold balance
          await client.query(
            "UPDATE users SET hold_balance = $1, updated_at = NOW() WHERE id = $2",
            [newHoldBalance, hold.user_id]
          );

          console.log(`   Released ₹${hold.amount} for user ${userResult.rows[0].username}`);
        }

        // Update hold status
        await client.query(
          `UPDATE balance_holds 
           SET status = 'expired', 
               released_at = NOW(),
               description = COALESCE(description, '') || ' - Expired automatically',
               updated_at = NOW()
           WHERE id = $1`,
          [hold.id]
        );

        expiredCount++;
        totalReleased += hold.amount;
      } catch (error) {
        console.error(`❌ Failed to expire hold ${hold.id}:`, error);
      }
    }

    await client.query("COMMIT");

    console.log("\n" + "=".repeat(60));
    console.log(`Expired ${expiredCount} holds, released ₹${totalReleased.toLocaleString()} total`);
    console.log("=".repeat(60));

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await expireHolds();
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
