/**
 * Update password for test users
 */
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function updatePasswords() {
  const hash = await bcrypt.hash('password123', 10);
  console.log('Generated hash:', hash);
  
  const emails = ['henry@esports.com', 'admin@esports.com', 'organizer@esports.com', 'alice@esports.com', 'bob@esports.com'];
  
  for (const email of emails) {
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, email]);
    console.log(`Updated: ${email}`);
  }
  
  console.log('\nAll passwords updated to: password123');
  await pool.end();
}

updatePasswords().catch(console.error);
