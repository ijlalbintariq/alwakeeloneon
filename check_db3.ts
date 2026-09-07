import { db } from './server/db';
import { caseLaw } from './shared/schema';
import { eq } from 'drizzle-orm';
async function run() {
  const c = await db.select({ 
    cit: caseLaw.citation, 
    y: caseLaw.citationYear, 
    r: caseLaw.citationReport, 
    p: caseLaw.citationPage 
  }).from(caseLaw).where(eq(caseLaw.citation, 'Const. P. 11/2026 (SHC)'));
  console.log(c[0]);
  process.exit(0);
}
run();
