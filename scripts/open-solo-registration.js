/**
 * Make a solo tournament registration-open for testing
 */
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function makeSoloRegistrationOpen() {
  // Update a solo tournament to have registration open
  const result = await pool.query(`
    UPDATE tournaments 
    SET registration_start_date = NOW() - INTERVAL '1 hour',
        registration_end_date = NOW() + INTERVAL '1 day'
    WHERE tournament_type = 'solo' 
    AND tournament_name LIKE '%Solo%'
    RETURNING id, tournament_name
  `);
  
  console.log('Updated solo tournaments:');
  result.rows.forEach(row => {
    console.log(`  - ${row.tournament_name} (${row.id})`);
  });
  
  await pool.end();
}

makeSoloRegistrationOpen().catch(e => {
  console.error('Error:', e.message);
  pool.end();
});
