/**
 * Direct database seeding script for 15 Free Fire tournaments
 * Run with: npx tsx scripts/seed-tournaments-db.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

// Create pool directly using individual variables (more reliable)
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

// Tournament name prefixes
const prefixes = [
  "Ultimate", "Pro", "Elite", "Champion", "Legend",
  "Master", "Grand", "Royal", "Supreme", "Epic",
  "Thunder", "Phoenix", "Dragon", "Blaze", "Storm"
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

// Generate random dates for tournaments
function generateDates(index: number) {
  const now = new Date();

  // Stagger registration start times (every 2-8 hours apart)
  const regStartOffset = index * randomBetween(2, 8); // hours
  const regStart = new Date(now.getTime() + regStartOffset * 60 * 60 * 1000);

  // Registration lasts 1-2 days (at least 24 hours)
  const regDuration = randomBetween(24, 48); // hours
  const regEnd = new Date(regStart.getTime() + regDuration * 60 * 60 * 1000);

  // Tournament starts 30 min - 2 hours after registration ends
  const tournamentStartOffset = randomBetween(30, 120); // minutes
  const tournamentStart = new Date(regEnd.getTime() + tournamentStartOffset * 60 * 1000);

  // Tournament lasts 2-4 hours (at least 2 hours)
  const tournamentDuration = randomBetween(2, 4); // hours
  const tournamentEnd = new Date(tournamentStart.getTime() + tournamentDuration * 60 * 60 * 1000);

  return {
    registration_start_date: regStart,
    registration_end_date: regEnd,
    tournament_start_date: tournamentStart,
    tournament_end_date: tournamentEnd,
  };
}

async function seedTournaments() {
  console.log("🎮 Starting tournament seeding via database...\n");

  try {
    // Test connection
    await directPool.query("SELECT 1");
    console.log("✅ Database connected successfully!\n");
    
    // Get admin user ID (host)
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

    for (let i = 0; i < 15; i++) {
      const type = types[randomBetween(0, types.length - 1)];
      const map = maps[randomBetween(0, maps.length - 1)];
      const prefix = prefixes[i];
      const dates = generateDates(i);
      const entryFee = randomBetween(0, 5) * 10; // 0, 10, 20, 30, 40, or 50
      const prizePool = randomBetween(5, 50) * 100; // 500 to 5000

      const tournamentName = `${prefix} FF ${type.charAt(0).toUpperCase() + type.slice(1)} #${i + 1}`;
      
      console.log(`📝 Creating: ${tournamentName}`);
      console.log(`   Type: ${type} | Map: ${map} | Entry: ₹${entryFee} | Prize: ₹${prizePool}`);
      console.log(`   Reg: ${dates.registration_start_date.toLocaleString()} - ${dates.registration_end_date.toLocaleString()}`);
      console.log(`   Tournament: ${dates.tournament_start_date.toLocaleString()} - ${dates.tournament_end_date.toLocaleString()}`);

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
            `Join the ${prefix} Free Fire tournament! Compete against the best players in this exciting ${type} battle. Show your skills and win amazing prizes! 🔥`,
            null, // banner URL
            getMaxTeams(type),
            entryFee,
            prizePool,
            `🎯 Tournament Rules:\n1. Fair play required - no hacks or cheats\n2. Join room 10 minutes before start\n3. Room ID/Password shared after registration closes\n4. Screenshots required for verification\n5. Admin decision is final`,
            map,
            1, // total_matches
            "upcoming", // status will be computed dynamically
            dates.registration_start_date,
            dates.registration_end_date,
            dates.tournament_start_date,
            dates.tournament_end_date,
            "once",
            false,
          ]
        );
        
        console.log(`   ✅ Created successfully!\n`);
        created++;
      } catch (error: unknown) {
        const errMessage = error instanceof Error ? error.message : String(error);
        console.log(`   ❌ Failed: ${errMessage}\n`);
        failed++;
      }
    }

    console.log("═".repeat(50));
    console.log(`🏁 Seeding complete!`);
    console.log(`   ✅ Created: ${created}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log("═".repeat(50));

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await directPool.end();
    process.exit(0);
  }
}

seedTournaments();
