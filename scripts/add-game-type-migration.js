const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Running migration: Add game_type column to teams table...');
    
    await pool.query(`
      ALTER TABLE teams 
      ADD COLUMN IF NOT EXISTS game_type VARCHAR(50);
    `);
    console.log('✅ Added game_type column');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_teams_game_type ON teams(game_type);
    `);
    console.log('✅ Created index on game_type');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
