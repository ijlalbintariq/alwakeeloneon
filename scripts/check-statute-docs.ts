import "../server/load-env";
import { db } from "../server/db";
import { statuteDocuments, statuteDocumentFiles, statutes } from "../shared/schema";
import { sql } from "drizzle-orm";
import { pool } from "../server/db";

async function main() {
  console.log("==========================================");
  console.log("🔍 Checking statute_documents Table");
  console.log("==========================================");

  try {
    const docs = await db.select({
      id: statuteDocuments.id,
      title: statuteDocuments.title,
      content: statuteDocuments.content
    }).from(statuteDocuments)
    .where(sql`${statuteDocuments.id} = 49`);

    if (docs.length > 0) {
      const content = docs[0].content;
      console.log(`Document Title: ${docs[0].title}`);
      console.log(`Content total length: ${content.length}`);
      console.log(`Last 2000 characters:`);
      console.log(`--------------------------------------------------`);
      console.log(content.substring(content.length - 2000));
      console.log(`--------------------------------------------------`);
    }
  } catch (error) {
    console.error("Error querying statutes table:", error);
  } finally {
    await pool.end();
  }
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
});
