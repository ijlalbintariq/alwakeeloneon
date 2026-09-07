import { db } from './server/db';
import { sql } from 'drizzle-orm';
async function run() {
  try {
    const q = await db.execute(sql`SELECT to_tsquery('simple', '11/2026') AS q`);
    console.log("Query:", q.rows[0].q);
  } catch (e) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}
run();
