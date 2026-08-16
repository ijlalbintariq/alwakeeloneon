/**
 * Full Pipeline Production Test — Obscure & Uncommon Legal Queries
 * 
 * Tests the ENTIRE pipeline end-to-end:
 *   Query Rewriter → Intent Classifier → LLM Query Extractor (HyDE) → Hybrid Retrieval → Context Builder
 * 
 * NO code changes — read-only observation of live production pipeline.
 */

import "../server/load-env";
import { runKnowledgePipeline } from "../server/pipeline/knowledge-pipeline";

const OBSCURE_QUERIES = [
  // 1. Extremely uncommon — maritime / admiralty
  "a cargo ship damaged my fisherman boat near Karachi port who do I sue",

  // 2. Absurd / edge-case — animal law
  "my neighbour's cow ate my entire wheat crop can I claim damages",

  // 3. Uncommon — intellectual property
  "someone copied my mobile app design and selling it on play store",

  // 4. Environmental — rare in Pakistani courts
  "factory dumping chemicals in river near my village children getting sick",

  // 5. Cyber / digital — modern edge case
  "someone made fake facebook profile with my photo and defaming me",

  // 6. Religious endowment — niche Islamic law
  "can waqf property be sold if the mutawalli is corrupt",

  // 7. Military / armed forces — very niche
  "army officer dismissed without court martial can he challenge in high court",

  // 8. Consumer protection — relatively new
  "online store delivered wrong product and refusing refund",

  // 9. Short ambiguous — no legal terms at all
  "my boss fired me for no reason",

  // 10. Roman Urdu — mixed language
  "shohar ne mujhe ghar se nikaal diya aur bachon ko bhi nahi milne deta",
];

async function runFullPipelineTest() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║  FULL PIPELINE PRODUCTION TEST — Obscure & Uncommon Queries     ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  const results: Array<{
    query: string;
    durationMs: number;
    hasCaseLaw: boolean;
    hasStatutes: boolean;
    contextLen: number;
    caseLawHits: number;
    topCitations: string[];
    verdict: string;
  }> = [];

  for (let i = 0; i < OBSCURE_QUERIES.length; i++) {
    const query = OBSCURE_QUERIES[i];
    console.log(`\n${"═".repeat(70)}`);
    console.log(`TEST ${i + 1}/10: "${query}"`);
    console.log(`${"═".repeat(70)}`);

    try {
      const t0 = Date.now();
      const result = await runKnowledgePipeline(query, undefined, undefined, undefined);
      const elapsed = Date.now() - t0;

      const topCitations = result.caseLawHits
        ?.slice(0, 3)
        .map(h => `${h.citation} — ${h.court}`)
        || [];

      // Count statute sections in context
      const statuteMatches = result.contextString.match(/STATUTE:|SECTION:/gi) || [];

      console.log(`\n  ⏱  Duration:     ${elapsed}ms`);
      console.log(`  📊 Context Size:  ${result.contextString.length} chars`);
      console.log(`  ⚖️  Has Case Law: ${result.hasCaseLaw}`);
      console.log(`  📜 Has Statutes:  ${result.hasStatutes}`);
      console.log(`  🔢 Case Law Hits: ${result.caseLawHits?.length || 0}`);
      console.log(`  📑 Statute Refs:  ${statuteMatches.length}`);

      if (topCitations.length > 0) {
        console.log(`  📚 Top Citations:`);
        topCitations.forEach((c, j) => console.log(`     ${j + 1}. ${c}`));
      }

      // Show first 300 chars of context for inspection
      if (result.contextString.length > 0) {
        console.log(`\n  📝 Context Preview (first 300 chars):`);
        console.log(`     "${result.contextString.slice(0, 300).replace(/\n/g, "\\n")}..."`);
      }

      // Verdict
      let verdict = "❌ FAIL";
      if (result.hasCaseLaw || result.hasStatutes) {
        if (result.caseLawHits?.length >= 2 && result.contextString.length > 200) {
          verdict = "✅ EXCELLENT";
        } else if (result.contextString.length > 100) {
          verdict = "🟡 PARTIAL";
        }
      } else if (result.contextString.length > 50) {
        verdict = "🟡 PARTIAL (context but no structured hits)";
      }

      console.log(`\n  VERDICT: ${verdict}`);

      results.push({
        query: query.slice(0, 50),
        durationMs: elapsed,
        hasCaseLaw: result.hasCaseLaw,
        hasStatutes: result.hasStatutes,
        contextLen: result.contextString.length,
        caseLawHits: result.caseLawHits?.length || 0,
        topCitations,
        verdict,
      });

    } catch (err) {
      console.error(`  ❌ PIPELINE ERROR: ${err instanceof Error ? err.message : String(err)}`);
      results.push({
        query: query.slice(0, 50),
        durationMs: 0,
        hasCaseLaw: false,
        hasStatutes: false,
        contextLen: 0,
        caseLawHits: 0,
        topCitations: [],
        verdict: `❌ ERROR: ${err instanceof Error ? err.message.slice(0, 60) : "unknown"}`,
      });
    }
  }

  // ── Summary Table ──
  console.log(`\n\n${"═".repeat(70)}`);
  console.log("SUMMARY TABLE");
  console.log(`${"═".repeat(70)}`);
  console.log(`${"Query".padEnd(52)} ${"Time".padEnd(7)} ${"CL".padEnd(4)} ${"St".padEnd(4)} ${"Hits".padEnd(5)} Verdict`);
  console.log(`${"-".repeat(52)} ${"-".repeat(7)} ${"-".repeat(4)} ${"-".repeat(4)} ${"-".repeat(5)} ${"-".repeat(15)}`);

  let passCount = 0;
  let partialCount = 0;
  let failCount = 0;

  for (const r of results) {
    const line = `${r.query.padEnd(52)} ${String(r.durationMs + "ms").padEnd(7)} ${(r.hasCaseLaw ? "Y" : "N").padEnd(4)} ${(r.hasStatutes ? "Y" : "N").padEnd(4)} ${String(r.caseLawHits).padEnd(5)} ${r.verdict}`;
    console.log(line);

    if (r.verdict.startsWith("✅")) passCount++;
    else if (r.verdict.startsWith("🟡")) partialCount++;
    else failCount++;
  }

  console.log(`\n${"═".repeat(70)}`);
  console.log(`SCORE: ${passCount} EXCELLENT / ${partialCount} PARTIAL / ${failCount} FAIL  (out of ${results.length})`);
  console.log(`${"═".repeat(70)}\n`);
}

runFullPipelineTest().catch(console.error);
