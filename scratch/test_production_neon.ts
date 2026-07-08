/**
 * Production Neon test: Run the full retrieval pipeline with standard 1500ms timeout
 * against the warm Neon database to verify Voyage Law-2 works within production SLA.
 * Also runs a direct (no-timeout) query to compare cold vs warm Neon latency.
 */
import { classifyQueryIntent } from "../server/pipeline/intent-classifier";
import { runRetrieval } from "../server/pipeline/retrieval-engine";
import { retrieveForQuery } from "../server/rag/rag-service";

const TEST_USER_ID = "test-production-neon";

const QUERIES = [
  "What is the punishment for narcotics possession under CNSA 1997?",
  "Explain Section 12 of the Contract Act 1872",
  "Grounds for bail under Section 497 CrPC Pakistan",
];

async function main() {
  console.log("=".repeat(80));
  console.log("PRODUCTION NEON TEST — Voyage Law-2 Statute Retrieval");
  console.log("=".repeat(80));
  console.log(`Neon endpoint: ${(process.env.DATABASE_URL || "").split("@")[1]?.split("/")[0] || "unknown"}`);
  console.log(`VOYAGE_API_KEY: ${!!process.env.VOYAGE_API_KEY}`);
  console.log();

  // ─── Phase 1: Direct RAG query (no timeout) to test warm Neon latency ───
  console.log("━".repeat(70));
  console.log("PHASE 1: Direct retrieveForQuery (no timeout cap)");
  console.log("━".repeat(70));
  
  const warmupQuery = "punishment for narcotics CNSA 1997";
  const t0 = Date.now();
  const directResult = await retrieveForQuery({
    userId: TEST_USER_ID,
    query: warmupQuery,
    topK: 8,
  });
  const directMs = Date.now() - t0;

  let directStatutes = 0;
  let directJudgments = 0;
  for (const m of directResult.matches) {
    const sType = String((m.metadata || {} as any).sourceType || "");
    if (sType === "admin-statute" || sType === "statute") {
      directStatutes++;
      console.log(`  ⚡ STATUTE score=${m.score.toFixed(4)} "${(m.title || "").slice(0, 60)}" → ${(m.chunkText || "").slice(0, 70).replace(/\n/g, " ")}...`);
    } else {
      directJudgments++;
    }
  }
  console.log(`  Duration: ${directMs}ms | ${directStatutes} statutes, ${directJudgments} judgments | confidence=${directResult.confidence}`);
  console.log();

  // ─── Phase 2: Full pipeline with production 1500ms timeout ───
  console.log("━".repeat(70));
  console.log("PHASE 2: Full Pipeline (runRetrieval with 1500ms ADMIN_DOC_TIMEOUT_MS)");
  console.log("━".repeat(70));

  for (const query of QUERIES) {
    console.log(`\n  📋 Query: "${query}"`);
    const t1 = Date.now();
    const intent = classifyQueryIntent(query);
    console.log(`    Intent: type=${intent.type}, needsAdminDocs=${intent.needsAdminDocs}`);

    const retrieval = await runRetrieval(intent, TEST_USER_ID, {
      caseLaw: 5,
      statutes: 4,
      adminDocs: 6,
    });
    const pipelineMs = Date.now() - t1;

    let voyageCount = 0;
    for (const ad of retrieval.adminDocs) {
      if (ad.source === "statute") voyageCount++;
    }

    console.log(`    Results: caseLaw=${retrieval.caseLaw.length}, keywordStatutes=${retrieval.statutes.length}, adminDocs=${retrieval.adminDocs.length} (${voyageCount} Voyage statute chunks)`);
    console.log(`    Duration: ${pipelineMs}ms`);

    if (voyageCount > 0) {
      console.log(`    ✅ PASS: Voyage Law-2 statute chunks retrieved within production timeout`);
      for (const ad of retrieval.adminDocs.filter(a => a.source === "statute")) {
        console.log(`       ⚡ "${ad.title.slice(0, 50)}" → ${ad.content.slice(0, 60).replace(/\n/g, " ")}...`);
      }
    } else if (retrieval.statutes.length > 0) {
      console.log(`    ⚠️  PARTIAL: Keyword statutes found, Voyage RAG timed out at 1500ms`);
    } else {
      console.log(`    ❌ FAIL: No statutes at all`);
    }
  }

  // ─── Phase 3: Second direct query to check warm-cache speed ───
  console.log("\n" + "━".repeat(70));
  console.log("PHASE 3: Second Direct RAG Query (warm cache check)");
  console.log("━".repeat(70));
  
  const t2 = Date.now();
  const warmResult = await retrieveForQuery({
    userId: TEST_USER_ID,
    query: "bail grounds under Section 497 CrPC",
    topK: 8,
  });
  const warmMs = Date.now() - t2;
  
  let warmStatutes = 0;
  for (const m of warmResult.matches) {
    const sType = String((m.metadata || {} as any).sourceType || "");
    if (sType === "admin-statute" || sType === "statute") warmStatutes++;
  }
  console.log(`  Duration: ${warmMs}ms | ${warmStatutes} statutes, ${warmResult.matches.length - warmStatutes} judgments`);
  console.log(`  ${warmMs <= 1500 ? "✅ WITHIN 1500ms production SLA!" : "⚠️ Exceeds 1500ms — may need HNSW index or higher timeout"}`);

  console.log("\n" + "=".repeat(80));
  console.log("PRODUCTION TEST COMPLETE");
  console.log("=".repeat(80));
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
