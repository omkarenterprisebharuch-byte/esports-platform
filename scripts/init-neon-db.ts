/**
 * Initialize Neon Database with Complete Schema
 * Run with: npx tsx scripts/init-neon-db.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

// Disable SSL verification for cloud databases
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function initDatabase() {
  console.log("🚀 Initializing Neon Database...\n");
  console.log("📡 Connecting to:", process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] || "database");
  
  const client = await pool.connect();
  
  try {
    // Read the complete schema SQL
    const schemaPath = path.join(__dirname, "../migrations/00_complete_schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");
    
    console.log("\n📝 Running schema migration...\n");
    
    // Execute the schema
    await client.query(schemaSql);
    
    console.log("✅ Schema created successfully!\n");
    
    // Verify tables were created
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log("📊 Created tables:");
    tablesResult.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.table_name}`);
    });
    
    console.log(`\n✅ Total: ${tablesResult.rows.length} tables created`);
    
    // Check if we need to create test users
    const usersCount = await client.query("SELECT COUNT(*) FROM users");
    
    if (parseInt(usersCount.rows[0].count) === 0) {
      console.log("\n👤 Creating test users...");
      
      // Create admin user (owner role)
      await client.query(`
        INSERT INTO users (username, email, password_hash, role, is_host, email_verified, wallet_balance)
        VALUES ('admin', 'admin@esports.com', '$2b$10$8K1p/a0dR1LXMIgoEDFrwOMoYoOm/YDMCEbq.WH6S1oj.yLblxJ2.', 'owner', true, true, 10000)
        ON CONFLICT (email) DO NOTHING
      `);
      
      // Create organizer user
      await client.query(`
        INSERT INTO users (username, email, password_hash, role, is_host, email_verified, wallet_balance)
        VALUES ('organizer', 'organizer@esports.com', '$2b$10$8K1p/a0dR1LXMIgoEDFrwOMoYoOm/YDMCEbq.WH6S1oj.yLblxJ2.', 'organizer', true, true, 5000)
        ON CONFLICT (email) DO NOTHING
      `);
      
      // Create Henry (test player)
      await client.query(`
        INSERT INTO users (username, email, password_hash, role, is_host, email_verified, wallet_balance, in_game_ids)
        VALUES (
          'henry', 
          'henry@esports.com', 
          '$2b$10$8K1p/a0dR1LXMIgoEDFrwOMoYoOm/YDMCEbq.WH6S1oj.yLblxJ2.', 
          'player', 
          false, 
          true, 
          500,
          '{"freefire": "HENRY123", "pubg": "HENRY_PUBG"}'::jsonb
        )
        ON CONFLICT (email) DO NOTHING
      `);
      
      // Create more test players
      await client.query(`
        INSERT INTO users (username, email, password_hash, role, is_host, email_verified, wallet_balance, in_game_ids)
        VALUES 
          ('alice', 'alice@esports.com', '$2b$10$8K1p/a0dR1LXMIgoEDFrwOMoYoOm/YDMCEbq.WH6S1oj.yLblxJ2.', 'player', false, true, 300, '{"freefire": "ALICE_FF"}'::jsonb),
          ('bob', 'bob@esports.com', '$2b$10$8K1p/a0dR1LXMIgoEDFrwOMoYoOm/YDMCEbq.WH6S1oj.yLblxJ2.', 'player', false, true, 250, '{"freefire": "BOB_FF"}'::jsonb)
        ON CONFLICT (email) DO NOTHING
      `);
      
      console.log("✅ Test users created:");
      console.log("   - admin@esports.com (owner, ₹10,000)");
      console.log("   - organizer@esports.com (organizer, ₹5,000)");
      console.log("   - henry@esports.com (player, ₹500)");
      console.log("   - alice@esports.com (player, ₹300)");
      console.log("   - bob@esports.com (player, ₹250)");
      console.log("   All passwords: password123");
    }
    
    console.log("\n🎉 Database initialization complete!");
    
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase().catch((e) => {
  console.error("Failed to initialize database:", e.message);
  process.exit(1);
});
