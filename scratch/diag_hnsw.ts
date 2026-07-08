/**
 * Focused diagnostic: test HNSW vector-only search for each legal query individually
 * with detailed timing to find why some queries return 0 results.
 */
import { similaritySearch } from "../server/rag/vector-store";
import { embedTextLocal } from "../server/rag/embedding-local";

const GLOBAL_STATUTE_RAG_USER_ID = "global-admin-statute";

const QUERIES = [
  "What are the grounds for granting bail under Section 497 CrPC in murder cases in Pakistan?",
  "What does Article 10-A of the Constitution of Pakistan say about right to fair trial and due process?",
  "What is the legal procedure for obtaining Khula under the Dissolution of Muslim Marriages Act 1939?",
  "Under what conditions can specific performance of a contract be granted under the Specific Relief Act 1877?",
  "What constitutes an act of terrorism under Section 6 of the Anti-Terrorism Act 1997 and what are the penalties?",
];

async function main() {
  console.log("=== HNSW Vector-Only Diagnostic ===\n");

  // Step 1: Embed all queries first (warm up the embedding model)
  console.log("Step 1: Generating embeddings...");
  const embeddings: number[][] = [];
  for (const q of QUERIES) {
    const t = Date.now();
    const emb = await embedTextLocal(q);
    console.log(`  [${Date.now() - t}ms] dim=${emb.length} "${q.slice(0, 60)}..."`);
    embeddings.push(emb);
  }

  // Step 2: Test each query against HNSW (vector-only, keywordWeight=0)
  console.log("\nStep 2: Vector-only HNSW search (keywordWeight=0)...");
  for (let i = 0; i < QUERIES.length; i++) {
    const t = Date.now();
    try {
      const results = await similaritySearch({
        userId: GLOBAL_STATUTE_RAG_USER_ID,
        queryEmbedding: embeddings[i],
        queryText: QUERIES[i],
        topK: 10,
        vectorWeight: 1.0,
        keywordWeight: 0,
      });
      const elapsed = Date.now() - t;
      console.log(`\n  [${elapsed}ms] Query ${i + 1}: ${results.length} results`);
      for (const r of results.slice(0, 3)) {
        console.log(`    score=${r.score.toFixed(4)} "${r.title?.slice(0, 60)}"`);
      }
    } catch (err: any) {
      console.log(`\n  [${Date.now() - t}ms] Query ${i + 1}: ERROR - ${err.message}`);
    }
  }

  // Step 3: Test with hybrid search for comparison
  console.log("\n\nStep 3: Hybrid search (keywordWeight=0.28)...");
  for (let i = 0; i < QUERIES.length; i++) {
    const t = Date.now();
    try {
      const results = await similaritySearch({
        userId: GLOBAL_STATUTE_RAG_USER_ID,
        queryEmbedding: embeddings[i],
        queryText: QUERIES[i],
        topK: 10,
        vectorWeight: 0.72,
        keywordWeight: 0.28,
      });
      const elapsed = Date.now() - t;
      console.log(`\n  [${elapsed}ms] Query ${i + 1}: ${results.length} results`);
      for (const r of results.slice(0, 3)) {
        console.log(`    score=${r.score.toFixed(4)} "${r.title?.slice(0, 60)}"`);
      }
    } catch (err: any) {
      console.log(`\n  [${Date.now() - t}ms] Query ${i + 1}: ERROR - ${err.message}`);
    }
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
