const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function backfillGameType() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Backfilling game_type for existing teams...');
    
    // Update teams based on name patterns
    // If team name contains "FREE FIRE" or "FF", set to "freefire"
    // If team name contains "BGMI" or "PUBG" or "BR", set to "bgmi"
    
    const result1 = await pool.query(`
      UPDATE teams 
      SET game_type = 'freefire'
      WHERE game_type IS NULL 
      AND (UPPER(team_name) LIKE '%FREE FIRE%' OR UPPER(team_name) LIKE '%FF%')
      RETURNING id, team_name, game_type
    `);
    console.log('Updated to freefire:', result1.rows);

    const result2 = await pool.query(`
      UPDATE teams 
      SET game_type = 'bgmi'
      WHERE game_type IS NULL 
      AND (UPPER(team_name) LIKE '%BGMI%' OR UPPER(team_name) LIKE '%PUBG%')
      RETURNING id, team_name, game_type
    `);
    console.log('Updated to bgmi:', result2.rows);

    // For remaining teams without clear game type, default to freefire
    const result3 = await pool.query(`
      UPDATE teams 
      SET game_type = 'freefire'
      WHERE game_type IS NULL
      RETURNING id, team_name, game_type
    `);
    console.log('Defaulted to freefire:', result3.rows);

    // Show final state
    const finalResult = await pool.query('SELECT id, team_name, game_type FROM teams');
    console.log('\nFinal team state:');
    console.log(finalResult.rows);

    console.log('\nBackfill completed successfully!');
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

backfillGameType();
