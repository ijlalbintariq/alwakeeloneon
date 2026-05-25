import "../server/load-env";
import { db, pool } from "../server/db";
import { statuteDocuments } from "../shared/schema";
import { sql } from "drizzle-orm";

async function main() {
  console.log("==========================================");
  console.log("🔍 COUNTING TRUNCATED STATUTES");
  console.log("==========================================");

  const docs = await db.select({
    id: statuteDocuments.id,
    title: statuteDocuments.title,
    length: sql<number>`length(${statuteDocuments.content})`
  }).from(statuteDocuments);

  let truncated = 0;
  let full = 0;

  for (const doc of docs) {
    if (doc.length === 60000) {
      truncated++;
    } else {
      full++;
    }
  }

  console.log(`Total documents: ${docs.length}`);
  console.log(`Truncated (exactly 60,000 chars): ${truncated}`);
  console.log(`Full (under 60,000 chars): ${full}`);

  await pool.end();
}

main().catch(async (err) => {
  console.error("Error:", err);
  await pool.end();
});
