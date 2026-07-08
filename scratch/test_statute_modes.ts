/**
 * Cross-verification test: Statute retrieval via Voyage Law-2 RAG
 * Tests that the retrieval pipeline correctly queries global-admin-statute
 * embeddings for three different legal queries simulating Standard, Turbo, and Apex modes.
 */
import { classifyQueryIntent } from "../server/pipeline/intent-classifier";
import { runRetrieval } from "../server/pipeline/retrieval-engine";

const TEST_USER_ID = "test-cross-verify";

const QUERIES = [
  {
    label: "Standard Mode Query",
    query: "What is the punishment for possession of narcotics under CNSA 1997?",
  },
  {
    label: "Turbo Mode Query",
    query: "Explain Section 12 of the Contract Act 1872 regarding valid consideration",
  },
  {
    label: "Apex Mode Query",
    query: "What are the grounds for bail under Section 497 CrPC Pakistan?",
  },
];

async function main() {
  console.log("=" .repeat(80));
  console.log("CROSS-VERIFICATION TEST: Voyage Law-2 Statute Retrieval");
  console.log("=" .repeat(80));
  console.log(`DATABASE_URL present: ${!!process.env.DATABASE_URL}`);
  console.log(`VOYAGE_API_KEY present: ${!!process.env.VOYAGE_API_KEY}`);
  console.log(`RAG_EMBEDDING_PROVIDER: ${process.env.RAG_EMBEDDING_PROVIDER || "not set"}`);

  for (const test of QUERIES) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`📋 ${test.label}: "${test.query}"`);
    console.log(`${"─".repeat(70)}`);

    const t0 = Date.now();
    const intent = classifyQueryIntent(test.query);
    console.log(`  Intent: type=${intent.type}, needsCaseLaw=${intent.needsCaseLaw}, needsStatutes=${intent.needsStatutes}, needsAdminDocs=${intent.needsAdminDocs}`);
    console.log(`  Topics: [${intent.topics.map(t => t.id).join(", ")}]`);

    const retrieval = await runRetrieval(
      intent,
      TEST_USER_ID,
      { caseLaw: 5, statutes: 4, adminDocs: 6 },
    );

    const elapsed = Date.now() - t0;

    // Report case law
    console.log(`\n  📚 Case Law Retrieved: ${retrieval.caseLaw.length}`);
    for (const cl of retrieval.caseLaw.slice(0, 3)) {
      console.log(`    • [score=${cl.relevanceScore}] ${cl.citation} — ${(cl.snippet || "").slice(0, 80)}...`);
    }

    // Report statutes (from fetchStatutes – keyword-based)
    console.log(`\n  📜 Statutes Retrieved (keyword): ${retrieval.statutes.length}`);
    for (const s of retrieval.statutes.slice(0, 3)) {
      console.log(`    • [score=${s.relevanceScore}] ${s.statuteTitle || "??"} § ${s.section || "??"}`);
    }

    // Report admin docs (includes Voyage RAG statute chunks!)
    console.log(`\n  🔍 Admin Docs Retrieved (includes Voyage RAG): ${retrieval.adminDocs.length}`);
    let voyageStatuteCount = 0;
    for (const ad of retrieval.adminDocs) {
      const isStatute = ad.source === "statute";
      if (isStatute) voyageStatuteCount++;
      const tag = isStatute ? "⚡ VOYAGE-STATUTE" : ad.source.toUpperCase();
      console.log(`    • [${tag}] "${ad.title.slice(0, 60)}" — ${ad.content.slice(0, 80).replace(/\n/g, " ")}...`);
    }

    // Verdict
    console.log(`\n  ⏱️  Duration: ${elapsed}ms`);
    if (voyageStatuteCount > 0) {
      console.log(`  ✅ PASS: ${voyageStatuteCount} Voyage Law-2 statute chunk(s) retrieved`);
    } else if (retrieval.statutes.length > 0) {
      console.log(`  ⚠️  PARTIAL: Keyword statutes found but no Voyage RAG statute chunks (may be timeout at 1500ms locally)`);
    } else {
      console.log(`  ❌ FAIL: No statutes retrieved at all`);
    }
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log("TEST COMPLETE");
  console.log(`${"=".repeat(80)}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
