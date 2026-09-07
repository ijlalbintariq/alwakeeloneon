import { db } from './server/db';
import { caseLaw } from './shared/schema';
import { desc } from 'drizzle-orm';
async function run() {
  const c = await db.select({ 
    cit: caseLaw.citation,
    role: caseLaw.citationRole,
    page: caseLaw.citationPage,
  }).from(caseLaw).orderBy(desc(caseLaw.citationYear), desc(caseLaw.id)).limit(10);
  console.log(c);
  process.exit(0);
}
run();
