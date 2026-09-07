import { db } from './server/db';
import { sql } from 'drizzle-orm';
async function run() {
  const q = await db.execute(sql`SELECT to_tsvector('simple', 'Const. P. 11/2026 (SHC)') AS vec`);
  console.log("Vector:", q.rows[0].vec);
  process.exit(0);
}
run();
