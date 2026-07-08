import "../server/load-env";
import { runRetrieval } from "../server/pipeline/retrieval-engine";
import { classifyQueryIntent } from "../server/pipeline/intent-classifier";
import { getUserId } from "../server/storage";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Locating a valid user ID for test...");
  const userRow = await db.execute(sql`SELECT id FROM users LIMIT 1`);
  const userId = userRow.rows[0]?.id as string;
  if (!userId) {
    throw new Error("No users found in database to run query retrieval test.");
  }
  console.log(`Using User ID: ${userId}`);

  const query = "What is the penalty or punishment under the Control of Narcotic Substances Act 1997?";
  console.log(`\nExecuting runRetrieval for query: "${query}"...`);
  
  const intent = classifyQueryIntent(query);
  // Ensure it triggers need for adminDocs/statutes
  intent.needsAdminDocs = true;

  const t0 = Date.now();
  const results = await runRetrieval(intent, userId, {
    caseLaw: 2,
    statutes: 2,
    adminDocs: 5,
  });

  console.log(`\nRetrieval finished in ${Date.now() - t0}ms.`);
  console.log(`\n--- Admin Docs / Statute RAG Results (${results.adminDocs.length} matches) ---`);
  
  results.adminDocs.forEach((doc, idx) => {
    console.log(`\n[Match ${idx + 1}] Source: ${doc.source}`);
    console.log(`  Title: "${doc.title}"`);
    console.log(`  Content Preview: "${doc.content.slice(0, 300)}..."`);
  });
}

main().catch(console.error);
