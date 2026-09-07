import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function run() {
  try {
    const res = await db.execute(sql`SELECT to_tsquery('simple', 'const & 11/2026 & shc')`);
    console.log(res);
  } catch(e) {
    console.error(e.message);
  }
  process.exit(0);
}
run();
