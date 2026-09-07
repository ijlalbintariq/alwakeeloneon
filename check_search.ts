import { db } from './server/db';
import { caseLaw, judgments } from './shared/schema';
import { sql, eq } from 'drizzle-orm';

async function run() {
  const tsQuery = "Const:* & 11:* & 2026:*";
  const result = await db.select({ id: caseLaw.id, title: caseLaw.title, citation: caseLaw.citation })
    .from(caseLaw)
    .where(sql`tsv_citation_title_summary_court @@ to_tsquery('simple', ${tsQuery})`);
    
  console.log("Search Result from case_law tsvector:");
  console.log(result);
  
  const jresult = await db.select({ id: judgments.id, title: judgments.title, citation: judgments.citationString })
    .from(judgments)
    .where(eq(judgments.citationString, 'Const. P. 11/2026 (SHC)'));
    
  console.log("Judgment Direct Query Result:");
  console.log(jresult);
  
  process.exit(0);
}
run();
