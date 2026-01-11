// Quick check script for phone number duplicates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function check() {
  console.log("Checking users...\n");
  
  const result = await pool.query(`
    SELECT id, username, email, phone_number 
    FROM users 
    WHERE email IN ('henry@esports.com', 'player1@test.com')
  `);
  
  console.log("Users:");
  for (const r of result.rows) {
    console.log(`  ${r.username} (${r.email}):`);
    console.log(`    phone_number: ${r.phone_number || 'NULL'}`);
  }
  
  console.log("\n--- All non-null phone numbers ---");
  const all = await pool.query(`
    SELECT username, phone_number 
    FROM users 
    WHERE phone_number IS NOT NULL AND phone_number != ''
    ORDER BY phone_number
  `);
  
  for (const r of all.rows) {
    console.log(`  ${r.username}: ${r.phone_number}`);
  }
  
  console.log("\n--- Duplicate phone_number values (raw) ---");
  const dups = await pool.query(`
    SELECT phone_number, COUNT(*)::int as cnt, array_agg(username) as users
    FROM users 
    WHERE phone_number IS NOT NULL AND phone_number != ''
    GROUP BY phone_number 
    HAVING COUNT(*) > 1
  `);
  
  console.log(`Found ${dups.rows.length} duplicate groups`);
  for (const r of dups.rows) {
    console.log(`  "${r.phone_number}" -> ${r.users.join(', ')} (${r.cnt} users)`);
  }
  
  await pool.end();
}

check().catch(console.error);
