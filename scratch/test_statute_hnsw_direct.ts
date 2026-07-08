/**
 * Targeted test: Call similaritySearch directly for global-admin-statute
 * to verify the HNSW index is working and results have correct metadata.
 */
import { similaritySearch } from "../server/rag/vector-store";
import { embedTextLocal } from "../server/rag/embedding-local";

async function main() {
  const query = "punishment for possession of narcotics CNSA 1997";
  
  console.log("Step 1: Embedding query...");
  const t0 = Date.now();
  const embedding = await embedTextLocal(query);
  const embedMs = Date.now() - t0;
  console.log(`  Embedding took ${embedMs}ms (dim=${embedding.length})`);

  console.log("\nStep 2: similaritySearch on global-admin-statute...");
  const t1 = Date.now();
  const statuteMatches = await similaritySearch({
    userId: "global-admin-statute",
    queryEmbedding: embedding,
    queryText: query,
    topK: 10,
    vectorWeight: 0.72,
    keywordWeight: 0.28,
  });
  const searchMs = Date.now() - t1;
  console.log(`  Search took ${searchMs}ms, returned ${statuteMatches.length} matches`);

  for (const m of statuteMatches.slice(0, 5)) {
    const meta = m.metadata || {};
    console.log(`  [score=${m.score.toFixed(4)}] title="${(m.title || "").slice(0, 50)}" sourceType="${(meta as any).sourceType || "NONE"}" chunk="${(m.chunkText || "").slice(0, 60).replace(/\n/g, " ")}..."`);
  }

  console.log(`\nTotal: ${embedMs + searchMs}ms (embed=${embedMs}ms + search=${searchMs}ms)`);
  console.log(searchMs + embedMs <= 4000 ? "✅ Within 4000ms production SLA" : "⚠️ Exceeds 4000ms");
  
  process.exit(0);
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });
