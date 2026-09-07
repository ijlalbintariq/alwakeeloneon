import { db } from './server/db';
import { caseLaw } from './shared/schema';
import { ilike } from 'drizzle-orm';
async function run() {
  const c = await db.select().from(caseLaw).where(ilike(caseLaw.citation, '%Const. P. 11%'));
  console.log(c.map(x => x.citation));
  process.exit(0);
}
run();
