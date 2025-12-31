// Check users table structure
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkSchema() {
  console.log("Users table columns:");
  const users = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    ORDER BY ordinal_position
  `);
  console.table(users.rows);

  console.log("\nTournaments table columns:");
  const tournaments = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tournaments' 
    ORDER BY ordinal_position
  `);
  console.table(tournaments.rows);

  // Check anti-cheating tables
  console.log("\nAnti-cheating tables created:");
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('report_categories', 'player_reports', 'banned_game_ids', 'ban_appeals') 
    ORDER BY table_name
  `);
  console.table(tables.rows);

  // Check categories count
  const categories = await pool.query(`SELECT COUNT(*) as count FROM report_categories`);
  console.log("\nReport categories count:", categories.rows[0].count);

  await pool.end();
}

checkSchema().catch(e => {
  console.error(e.message);
  pool.end();
});
