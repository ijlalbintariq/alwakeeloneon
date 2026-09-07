import { db } from './server/db';
import { sql } from 'drizzle-orm';
async function run() {
  const q = await db.execute(sql`SELECT to_tsvector('simple', 'Const. P. 11/2026 (SHC)') @@ to_tsquery('simple', 'const & 11 & 2026') AS match`);
  console.log("Match without :* ->", q.rows[0].match);
  const q2 = await db.execute(sql`SELECT to_tsvector('simple', 'Const. P. 11/2026 (SHC)') @@ to_tsquery('simple', 'const:* & 11:* & 2026:*') AS match`);
  console.log("Match with :* ->", q2.rows[0].match);
  process.exit(0);
}
run();
