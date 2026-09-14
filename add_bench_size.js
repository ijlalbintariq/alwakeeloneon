import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await pool.query('ALTER TABLE bench_sessions ADD COLUMN IF NOT EXISTS bench_size text DEFAULT \'single\'');
    console.log("Column added successfully");
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
