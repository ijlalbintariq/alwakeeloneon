import { pool } from './server/db.ts';
async function run() {
  const res = await pool.query('SELECT bench_size FROM bench_sessions LIMIT 1');
  console.log(res.rows);
  process.exit(0);
}
run();
