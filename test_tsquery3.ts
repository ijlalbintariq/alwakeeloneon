import { db } from './server/db';
import { sql } from 'drizzle-orm';
async function run() {
  const tests = ["const", "p.", "11/2026", "(shc)", "&", "|", "!"];
  for (const t of tests) {
    try {
      await db.execute(sql`SELECT to_tsquery('simple', ${t})`);
      console.log(t, "-> OK");
    } catch (e) {
      console.log(t, "-> ERROR");
    }
  }
  process.exit(0);
}
run();
