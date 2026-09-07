import { db } from './server/db';
import { caseLaw } from './shared/schema';
import { eq, sql } from 'drizzle-orm';
async function run() {
  const c = await db.select({ tsv: sql`tsv_citation_title_summary_court` }).from(caseLaw).where(eq(caseLaw.citation, 'Const. P. 11/2026 (SHC)'));
  console.log(c[0].tsv);
  process.exit(0);
}
run();
