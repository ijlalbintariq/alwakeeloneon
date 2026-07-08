import "../server/load-env";

// Dynamically override ADMIN_DOC_TIMEOUT_MS if exported, or modify the test to call retrieval-engine
import { runRetrieval } from "../server/pipeline/retrieval-engine";
import { classifyQueryIntent } from "../server/pipeline/intent-classifier";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Locating user...");
  const userRow = await db.execute(sql`SELECT id FROM users LIMIT 1`);
  const userId = userRow.rows[0]?.id as string;

  const query = "What is the penalty or punishment under the Control of Narcotic Substances Act 1997?";
  console.log(`\nExecuting test with slow timeout profile for query: "${query}"...`);

  // We can temporarily modify the environment or configuration
  // Let's run it. We know locally it times out at 1.5s. But if we run it directly,
  // we can see if it fetches it correctly.
  const intent = classifyQueryIntent(query);
  intent.needsAdminDocs = true;

  console.log("Running retrieval...");
  // Let's see what happens if we wait
  const results = await runRetrieval(intent, userId, {
    caseLaw: 2,
    statutes: 2,
    adminDocs: 5,
  });

  console.log(`Finished retrieval. Total admin docs: ${results.adminDocs.length}`);
  results.adminDocs.forEach((doc, idx) => {
    console.log(`Match ${idx+1}: Source: ${doc.source}, Title: "${doc.title}", Content: "${doc.content.slice(0, 100)}..."`);
  });
}

main().catch(console.error);
