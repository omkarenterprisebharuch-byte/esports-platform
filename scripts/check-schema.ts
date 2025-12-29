// Check users table structure
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'users' 
  ORDER BY ordinal_position
`).then(r => {
  console.log("Users table columns:");
  console.table(r.rows);
  pool.end();
}).catch(e => {
  console.error(e.message);
  pool.end();
});
