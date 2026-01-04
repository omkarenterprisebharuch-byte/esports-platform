/**
 * Delete all tournaments and seed 35 new Free Fire tournaments
 * Run with: npx ts-node scripts/reset-tournaments.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

// Create pool directly using individual variables
const directPool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

// Tournament types
const types = ["solo", "duo", "squad"] as const;

// Map names for Free Fire
const maps = ["Bermuda", "Purgatory", "Kalahari", "Nextera", "Alpine"];

// Tournament name prefixes (expanded for 35 tournaments)
const prefixes = [
  "Ultimate", "Pro", "Elite", "Champion", "Legend",
  "Master", "Grand", "Royal", "Supreme", "Epic",
  "Thunder", "Phoenix", "Dragon", "Blaze", "Storm",
  "Titan", "Warrior", "Battle", "Victory", "Glory",
  "Apex", "Crown", "Fury", "Shadow", "Venom",
  "Flash", "Inferno", "Cyclone", "Omega", "Alpha",
  "Prime", "Savage", "Mystic", "Cosmic", "Stellar"
];

// Get max teams based on type
function getMaxTeams(type: string): number {
  switch (type) {
    case "solo": return 48;
    case "duo": return 24;
    case "squad": return 12;
    default: return 48;
  }
}

// Generate random number between min and max
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate random dates for tournaments with variety
function generateDates(index: number) {
  const now = new Date();
  
  // Create different tournament timing categories
  const category = index % 5;
  
  let regStart: Date;
  let regDuration: number;
  
  switch (category) {
    case 0:
      // Starting soon (registration open now, closes in 1-4 hours)
      regStart = new Date(now.getTime() - randomBetween(1, 3) * 60 * 60 * 1000);
      regDuration = randomBetween(4, 8);
      break;
    case 1:
      // Starting today (registration opens now to few hours)
      regStart = new Date(now.getTime() + randomBetween(0, 2) * 60 * 60 * 1000);
      regDuration = randomBetween(6, 12);
      break;
    case 2:
      // Tomorrow's tournaments
      regStart = new Date(now.getTime() + randomBetween(12, 24) * 60 * 60 * 1000);
      regDuration = randomBetween(12, 24);
      break;
    case 3:
      // This week tournaments
      regStart = new Date(now.getTime() + randomBetween(24, 72) * 60 * 60 * 1000);
      regDuration = randomBetween(24, 48);
      break;
    case 4:
    default:
      // Next week tournaments  
      regStart = new Date(now.getTime() + randomBetween(72, 168) * 60 * 60 * 1000);
      regDuration = randomBetween(48, 72);
      break;
  }
  
  const regEnd = new Date(regStart.getTime() + regDuration * 60 * 60 * 1000);
  
  // Tournament starts 30 min - 2 hours after registration ends
  const tournamentStartOffset = randomBetween(30, 120);
  const tournamentStart = new Date(regEnd.getTime() + tournamentStartOffset * 60 * 1000);
  
  // Tournament lasts 2-4 hours
  const tournamentDuration = randomBetween(2, 4);
  const tournamentEnd = new Date(tournamentStart.getTime() + tournamentDuration * 60 * 60 * 1000);

  return {
    registration_start_date: regStart,
    registration_end_date: regEnd,
    tournament_start_date: tournamentStart,
    tournament_end_date: tournamentEnd,
  };
}

async function deleteAllTournaments() {
  console.log("🗑️  Deleting all existing tournaments...\n");
  
  // Delete related data first (foreign key constraints)
  // Each delete is a separate transaction to avoid cascade failures
  const tables = [
    { name: "tournament_registrations", column: "tournament_id" },
    { name: "tournament_results", column: "tournament_id" },
    { name: "match_results", column: "tournament_id" },
    { name: "tournament_matches", column: "tournament_id" },
    { name: "tournament_teams", column: "tournament_id" },
    { name: "balance_holds", column: "tournament_id" },
  ];
  
  for (const table of tables) {
    try {
      // Check if table exists first
      const tableCheck = await directPool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        ) as exists
      `, [table.name]);
      
      if (tableCheck.rows[0].exists) {
        // Check if column exists
        const columnCheck = await directPool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = $2
          ) as exists
        `, [table.name, table.column]);
        
        if (columnCheck.rows[0].exists) {
          const result = await directPool.query(`DELETE FROM ${table.name} WHERE ${table.column} IS NOT NULL`);
          console.log(`   ✅ Cleared ${table.name}: ${result.rowCount} rows`);
        } else {
          console.log(`   ⚠️  Skipped ${table.name} (no ${table.column} column)`);
        }
      } else {
        console.log(`   ⏭️  Table ${table.name} doesn't exist`);
      }
    } catch (err) {
      console.log(`   ⚠️  Error with ${table.name}: ${err instanceof Error ? err.message : err}`);
    }
  }
  
  // Now delete all tournaments
  try {
    const tournamentResult = await directPool.query("DELETE FROM tournaments");
    console.log(`   ✅ Deleted ${tournamentResult.rowCount} tournaments`);
    console.log("\n✅ All tournaments deleted successfully!\n");
  } catch (error) {
    console.error("   ❌ Failed to delete tournaments:", error);
    throw error;
  }
}

async function seedTournaments() {
  console.log("🎮 Creating 35 new tournaments...\n");

  // Get admin/host user ID
  const hostResult = await directPool.query(
    "SELECT id FROM users WHERE is_host = true OR username = 'admin' LIMIT 1"
  );

  if (hostResult.rows.length === 0) {
    console.error("❌ No host/admin user found. Please create one first.");
    process.exit(1);
  }

  const hostId = hostResult.rows[0].id;
  console.log(`✅ Found host user ID: ${hostId}\n`);

  let created = 0;
  let failed = 0;

  for (let i = 0; i < 35; i++) {
    const type = types[i % 3]; // Evenly distribute types
    const map = maps[randomBetween(0, maps.length - 1)];
    const prefix = prefixes[i];
    const dates = generateDates(i);
    
    // Varied entry fees: 0 (free), 10, 20, 30, 50, 100
    const entryFeeOptions = [0, 0, 10, 10, 20, 20, 30, 50, 100];
    const entryFee = entryFeeOptions[randomBetween(0, entryFeeOptions.length - 1)];
    
    // Prize pool proportional to entry fee
    const prizePool = entryFee === 0 
      ? randomBetween(1, 5) * 100  // 100-500 for free
      : randomBetween(5, 20) * entryFee; // 5x to 20x entry fee

    const tournamentName = `${prefix} FF ${type.charAt(0).toUpperCase() + type.slice(1)} #${i + 1}`;
    
    console.log(`📝 [${i + 1}/35] Creating: ${tournamentName}`);
    console.log(`   Type: ${type} | Map: ${map} | Entry: ₹${entryFee} | Prize: ₹${prizePool}`);

    try {
      await directPool.query(
        `INSERT INTO tournaments (
          host_id,
          tournament_name,
          game_type,
          tournament_type,
          description,
          tournament_banner_url,
          max_teams,
          entry_fee,
          prize_pool,
          match_rules,
          map_name,
          total_matches,
          status,
          registration_start_date,
          registration_end_date,
          tournament_start_date,
          tournament_end_date,
          schedule_type,
          is_template
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
          hostId,
          tournamentName,
          "freefire",
          type,
          `🔥 Join the ${prefix} Free Fire tournament! Compete against the best players in this exciting ${type} battle. Show your skills and win amazing prizes worth ₹${prizePool}!\n\n🎯 Format: ${type.toUpperCase()}\n🗺️ Map: ${map}\n💰 Entry: ${entryFee === 0 ? 'FREE' : '₹' + entryFee}\n🏆 Prize Pool: ₹${prizePool}`,
          null,
          getMaxTeams(type),
          entryFee,
          prizePool,
          `🎯 Tournament Rules:\n1. Fair play required - no hacks or cheats\n2. Join room 10 minutes before start\n3. Room ID/Password shared after registration closes\n4. Screenshots required for verification\n5. Admin decision is final\n6. ${type === 'solo' ? 'Individual gameplay only' : type === 'duo' ? 'Teams of 2 players' : 'Teams of 4 players'}`,
          map,
          1,
          "upcoming",
          dates.registration_start_date,
          dates.registration_end_date,
          dates.tournament_start_date,
          dates.tournament_end_date,
          "once",
          false,
        ]
      );
      
      console.log(`   ✅ Created!\n`);
      created++;
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ Failed: ${errMessage}\n`);
      failed++;
    }
  }

  return { created, failed };
}

async function main() {
  console.log("═".repeat(60));
  console.log("  TOURNAMENT RESET SCRIPT - Delete All & Create 35 New");
  console.log("═".repeat(60));
  console.log(`📅 Date: ${new Date().toLocaleString()}\n`);

  try {
    // Test connection
    await directPool.query("SELECT 1");
    console.log("✅ Database connected successfully!\n");
    
    // Step 1: Delete all tournaments
    await deleteAllTournaments();
    
    // Step 2: Create 35 new tournaments
    const { created, failed } = await seedTournaments();
    
    // Summary
    console.log("═".repeat(60));
    console.log("  ✅ SCRIPT COMPLETED SUCCESSFULLY");
    console.log("═".repeat(60));
    console.log(`   🆕 Created: ${created} tournaments`);
    console.log(`   ❌ Failed: ${failed} tournaments`);
    console.log("═".repeat(60));

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await directPool.end();
    process.exit(0);
  }
}

main();
