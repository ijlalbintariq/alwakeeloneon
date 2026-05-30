import "../server/load-env";
import { db } from "../server/db";
import { sql } from "drizzle-orm";
import { pool } from "../server/db";
import { ensureRagSchema, similaritySearch, upsertRagDocument } from "../server/rag/vector-store";
import { chunkTextByTokens } from "../server/rag/chunker";
import { retrieveForQuery, indexJudgmentDocument } from "../server/rag/rag-service";
import { cleanLegalDocumentText } from "../server/rag/text-cleaner";

async function main() {
  console.log("==========================================");
  console.log("🧪 ADVANCED RAG PIPELINE VERIFICATION TEST");
  console.log("==========================================\n");

  console.log("Step 1: Initializing RAG database schema and executing migrations...");
  await ensureRagSchema();
  console.log("✅ Schema ensured. parent_chunk_id and dropping NOT NULL constraint executed successfully.\n");

  console.log("Step 2: Testing Chunker output hierarchy...");
  const mockLegalText = `
FACTS: The petitioner filed this constitutional writ petition under Article 199 of the Constitution of Pakistan, 1973. The dispute relates to a commercial plot in Lahore. The petitioner claims possession was handed over in 1998, but the respondent disputes this and asserts ex-parte transfer occurred.

LAW: Under Qanun-e-Shahadat Order 1984, the burden of proof lies on the party asserting the affirmative of the issue. Furthermore, ex-parte transfers are regulated strictly by High Court guidelines and the Civil Procedure Code, 1908.

JUDGMENT: Having heard both sides, this Court is of the opinion that ex-parte transfer without notice is illegal. Therefore, this writ petition is allowed, and the impugned order of the respondent is set aside.
  `;

  const chunks = chunkTextByTokens(mockLegalText);
  console.log(`✅ Chunker produced ${chunks.length} total chunks.`);
  
  const parents = chunks.filter(c => c.isParent);
  const children = chunks.filter(c => !c.isParent);
  
  console.log(`- Parent Chunks: ${parents.length}`);
  console.log(`- Child Chunks:  ${children.length}`);

  if (parents.length === 0 || children.length === 0) {
    throw new Error("❌ Chunker failed to split text into Parent-Child relationships!");
  }
  
  console.log("\nSample Parent Text:");
  console.log(`[Parent #${parents[0].chunkIndex}]: ${parents[0].text.substring(0, 150)}...`);
  
  console.log("\nSample Child Text (Linked back to parent):");
  console.log(`[Child #${children[0].chunkIndex} -> Parent #${children[0].parentIndex}]: ${children[0].text}`);
  console.log("==========================================\n");

  console.log("Step 3: Indexing mock document in RAG store...");
  const testUserId = "test-user-parent-child-verification";
  const sourceDocId = 99999;
  
  const ragDoc = await upsertRagDocument({
    userId: testUserId,
    sourceDocumentId: sourceDocId,
    title: "Test Parent-Child Legal Document",
    contentHash: "test-hash-12345",
    status: "pending"
  });

  console.log(`- Created RAG document row ID: ${ragDoc.id}`);

  // Insert parents first
  const parentEntries = parents.map((p) => ({
    ragDocumentId: ragDoc.id,
    userId: testUserId,
    sourceDocumentId: sourceDocId,
    chunkIndex: p.chunkIndex,
    tokenCount: p.tokenCount,
    chunkText: p.text,
    embedding: null, // Null embeddings for parent context text holders
    metadata: {
      sourceType: "test-doc",
      isParent: true,
      sectionType: p.sectionType,
    },
  }));

  const parentRows = await pool.query(`
    INSERT INTO rag_chunks (rag_document_id, user_id, source_document_id, chunk_index, token_count, chunk_text, metadata, embedding)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, null)
    ON CONFLICT (rag_document_id, chunk_index) DO UPDATE SET chunk_text = EXCLUDED.chunk_text
    RETURNING id, chunk_index
  `, [
    ragDoc.id,
    testUserId,
    sourceDocId,
    parentEntries[0].chunkIndex,
    parentEntries[0].tokenCount,
    parentEntries[0].chunkText,
    JSON.stringify(parentEntries[0].metadata)
  ]);

  const parentDbId = parentRows.rows[0].id;
  console.log(`✅ Successfully inserted Parent Chunk with Database Row ID: ${parentDbId}`);

  // Insert child chunk linked to this parent (with mock 384-dimensional normalized vector)
  const mockVector = new Array(384).fill(0).map((_, i) => (i === 0 ? 1 : 0)); // Normalized vector [1, 0, 0...]
  const childEntry = {
    ragDocumentId: ragDoc.id,
    userId: testUserId,
    sourceDocumentId: sourceDocId,
    chunkIndex: children[0].chunkIndex,
    tokenCount: children[0].tokenCount,
    chunkText: children[0].text,
    embedding: mockVector,
    parentChunkId: parentDbId,
    metadata: {
      sourceType: "test-doc",
      isParent: false,
      court: "Lahore High Court",
      sectionType: children[0].sectionType,
    }
  };

  await pool.query(`
    INSERT INTO rag_chunks (rag_document_id, user_id, source_document_id, chunk_index, token_count, chunk_text, metadata, embedding, parent_chunk_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::vector, $9)
    ON CONFLICT (rag_document_id, chunk_index) DO NOTHING
  `, [
    childEntry.ragDocumentId,
    childEntry.userId,
    childEntry.sourceDocumentId,
    childEntry.chunkIndex,
    childEntry.tokenCount,
    childEntry.chunkText,
    JSON.stringify(childEntry.metadata),
    `[${childEntry.embedding.join(",")}]`,
    childEntry.parentChunkId
  ]);
  console.log("✅ Successfully inserted Child Chunk linked to Parent and populated mock 384-dimension vector.\n");

  console.log("Step 4: Verifying Parent Context Expansion during similarity search...");
  const searchResults = await similaritySearch({
    userId: testUserId,
    queryEmbedding: mockVector,
    queryText: "constitutional writ Lahore",
    topK: 1
  });

  if (searchResults.length === 0) {
    throw new Error("❌ Similarity search returned zero matches!");
  }

  const match = searchResults[0];
  console.log(`- Matched Child Chunk Index: ${match.chunkIndex}`);
  console.log(`- Matched Score: ${match.score.toFixed(4)}`);
  console.log(`- Returned Context Text (Should be expanded parent text):`);
  console.log(`\"${match.chunkText}\"`);
  
  if (!match.chunkText.includes("FACTS:") || !match.chunkText.includes("petitioner filed this constitutional writ")) {
    throw new Error("❌ Parent expansion failed! Retrieved child text instead of expanded parent paragraph.");
  }
  console.log("✅ SUCCESS! Matched child vector but retrieved complete parent section context!\n");

  console.log("Step 5: Verifying high-performance SQL Metadata Pre-filtering...");
  // Query 1: Search with correct court filter
  const filterMatchSuccess = await similaritySearch({
    userId: testUserId,
    queryEmbedding: mockVector,
    queryText: "constitutional writ Lahore",
    metadataFilters: { court: "Lahore High Court" },
    topK: 1
  });
  console.log(`- Results with matching court filter ('Lahore High Court'): ${filterMatchSuccess.length}`);
  if (filterMatchSuccess.length === 0) {
    throw new Error("❌ SQL Metadata filter discarded a matching chunk incorrectly!");
  }

  // Query 2: Search with mismatching court filter
  const filterMatchFail = await similaritySearch({
    userId: testUserId,
    queryEmbedding: mockVector,
    queryText: "constitutional writ Lahore",
    metadataFilters: { court: "Karachi High Court" },
    topK: 1
  });
  console.log(`- Results with mismatching court filter ('Karachi High Court'): ${filterMatchFail.length}`);
  if (filterMatchFail.length > 0) {
    throw new Error("❌ SQL Metadata filter failed to discard mismatching chunk!");
  }
  console.log("✅ SUCCESS! SQL JSONB pre-filtering is 100% precise and functional.\n");

  console.log("Step 6: Cleaning up test data...");
  await pool.query("DELETE FROM rag_chunks WHERE user_id = $1", [testUserId]);
  await pool.query("DELETE FROM rag_documents WHERE user_id = $1", [testUserId]);
  console.log("✅ Cleaned up database.\n");

  console.log("==========================================");
  console.log("🎉 ALL ADVANCED RAG VERIFICATION TESTS PASS!");
  console.log("==========================================");

  await pool.end();
}

main().catch(async (e) => {
  console.error("\n❌ TEST FAILURE:");
  console.error(e);
  await pool.end();
  process.exit(1);
});
