import { db } from './server/db.js';
import { caseLaw } from './shared/schema.js';
async function test() {
  const courts = await db.execute('SELECT DISTINCT court FROM case_law LIMIT 10');
  console.log(courts.rows);
  process.exit(0);
}
test().catch(console.error);
