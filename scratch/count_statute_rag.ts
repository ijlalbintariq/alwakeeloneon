import "../server/load-env";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  // Count statute RAG chunks
  const statuteChunks = await db.execute(sql`
    SELECT count(*)::integer as total FROM rag_chunks WHERE user_id = 'global-admin-statute'
  `);
  console.log("Statute RAG chunks (user_id='global-admin-statute'):", statuteChunks.rows[0].total);

  // Count admin RAG chunks
  const adminChunks = await db.execute(sql`
    SELECT count(*)::integer as total FROM rag_chunks WHERE user_id = 'global-admin'
  `);
  console.log("Admin RAG chunks (user_id='global-admin'):", adminChunks.rows[0].total);

  // Count judgment RAG chunks
  const judgmentChunks = await db.execute(sql`
    SELECT count(*)::integer as total FROM rag_chunks WHERE user_id = 'global-admin-judgment'
  `);
  console.log("Judgment RAG chunks (user_id='global-admin-judgment'):", judgmentChunks.rows[0].total);

  // Count user RAG chunks
  const userChunks = await db.execute(sql`
    SELECT count(*)::integer as total FROM rag_chunks WHERE user_id NOT LIKE 'global%'
  `);
  console.log("User document RAG chunks:", userChunks.rows[0].total);

  // Check statute_documents
  const statDocs = await db.execute(sql`SELECT count(*)::integer as total FROM statute_documents`);
  console.log("\nTotal statute_documents:", statDocs.rows[0].total);

  // Sample statute rag_documents
  const ragDocs = await db.execute(sql`
    SELECT id, title, status, chunk_count 
    FROM rag_documents 
    WHERE user_id = 'global-admin-statute'
    ORDER BY chunk_count DESC
    LIMIT 15
  `);
  console.log("\nTop statute RAG documents:");
  ragDocs.rows.forEach(r => console.log(`  id=${r.id} chunks=${r.chunk_count} status=${r.status} title="${r.title}"`));

  // Check with embeddings
  const withEmbed = await db.execute(sql`
    SELECT count(*)::integer as total FROM rag_chunks 
    WHERE user_id = 'global-admin-statute' AND embedding IS NOT NULL
  `);
  console.log("\nStatute chunks WITH embedding:", withEmbed.rows[0].total);

  const withoutEmbed = await db.execute(sql`
    SELECT count(*)::integer as total FROM rag_chunks 
    WHERE user_id = 'global-admin-statute' AND embedding IS NULL
  `);
  console.log("Statute chunks WITHOUT embedding:", withoutEmbed.rows[0].total);
}

main().catch(console.error);
