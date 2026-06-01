import "../server/load-env";
import { db } from "../server/db";
import { judgments, caseLaw } from "../shared/schema";
import { sql, eq } from "drizzle-orm";
import { pool } from "../server/db";

async function main() {
  const targetCitations = ["1987 SCMR 1403", "2024 SCMR 1567", "2024 SCMR 1716", "2021 PLD 85"];
  
  console.log("Searching in judgments table...");
  for (const cit of targetCitations) {
    const rows = await db.select({
      id: judgments.id,
      citationString: judgments.citationString,
      title: judgments.title,
    })
    .from(judgments)
    .where(eq(judgments.citationString, cit));
    
    console.log(`Citation: "${cit}" -> Found ${rows.length} rows in judgments`);
    for (const r of rows) {
      console.log(`  - ID: ${r.id} | Title: ${r.title}`);
    }
  }

  console.log("\nSearching in case_law table...");
  for (const cit of targetCitations) {
    const rows = await db.select({
      id: caseLaw.id,
      citation: caseLaw.citation,
      title: caseLaw.title,
    })
    .from(caseLaw)
    .where(eq(caseLaw.citation, cit));
    
    console.log(`Citation: "${cit}" -> Found ${rows.length} rows in case_law`);
    for (const r of rows) {
      console.log(`  - ID: ${r.id} | Title: ${r.title}`);
    }
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
});
