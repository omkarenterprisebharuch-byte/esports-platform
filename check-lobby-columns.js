require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function check() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // First add the column if missing
    await pool.query(`ALTER TABLE league_lobbies ADD COLUMN IF NOT EXISTS credentials_published BOOLEAN DEFAULT FALSE`);
    console.log('ALTER executed');
    
    // Then check columns
    const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='league_lobbies' ORDER BY ordinal_position`);
    console.log('\n=== league_lobbies columns ===');
    res.rows.forEach(r => console.log(' -', r.column_name));
  } finally {
    await pool.end();
  }
}

check().catch(console.error);
