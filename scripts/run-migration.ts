// Migration runner - uses direct pg connection to avoid module resolution issues
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";
import fs from "fs";
import path from "path";

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  // Default to add_user_roles.sql, or use command line argument
  const migrationName = process.argv[2] || "add_user_roles.sql";
  const migrationFile = path.join(process.cwd(), "migrations", migrationName);
  
  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ Migration file not found: ${migrationFile}`);
    process.exit(1);
  }
  
  const sql = fs.readFileSync(migrationFile, "utf-8");

  console.log(`Running migration: ${migrationName}`);
  console.log("=".repeat(50));

  try {
    await pool.query(sql);
    console.log(`✅ Migration successful: ${migrationName}`);
    
    // If running user roles migration, show role distribution
    if (migrationName.includes("user_roles")) {
      const result = await pool.query(`
        SELECT COALESCE(role::text, 'NULL') as role, COUNT(*) as count 
        FROM users 
        GROUP BY role 
        ORDER BY count DESC
      `);
      console.log("\nRole distribution after migration:");
      result.rows.forEach(row => {
        console.log(`  - ${row.role}: ${row.count} users`);
      });
    }
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message.includes("already exists")) {
      console.log("ℹ️ Already exists, skipping...");
    } else {
      console.error("❌ Migration failed:", err.message);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

runMigration();
