const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkTeams() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    const result = await pool.query('SELECT id, team_name, game_type FROM teams');
    console.log('Current teams:');
    console.log(result.rows);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkTeams();
