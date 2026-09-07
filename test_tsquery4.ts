import { db } from './server/db';
import { sql } from 'drizzle-orm';
async function run() {
  try {
    const q = await db.execute(sql`SELECT to_tsquery('simple', 'const. & p. & 11/2026') AS q`);
    console.log("Query:", q.rows[0].q);
    const m = await db.execute(sql`SELECT to_tsvector('simple', 'Const. P. 11/2026 (SHC)') @@ to_tsquery('simple', 'const. & p. & 11/2026') AS match`);
    console.log("Match:", m.rows[0].match);
  } catch (e) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}
run();
