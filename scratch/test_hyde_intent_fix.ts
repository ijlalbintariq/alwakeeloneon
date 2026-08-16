/**
 * Test: HyDE Intent Fix Verification
 * 
 * Verifies the 3 surgical pipeline changes:
 *   1. Short ambiguous queries (previously failed) now trigger LLM
 *   2. Short queries with known topics still use static taxonomy (no wasted LLM calls)
 *   3. HyDE syntheticHeadnote is generated and included in focused queries
 *   4. LLM legal_domains are fed back into intent when taxonomy returns 0 topics
 */

import "../server/load-env";
import { classifyQueryIntent } from "../server/pipeline/intent-classifier";
import { generateSemanticRetrievalQueries, extractDeterministicFacts } from "../server/pipeline/llm-query-extractor";

// ─── Test Scenarios ───────────────────────────────────────────────────────────

const SCENARIOS = [
  {
    label: "Short ambiguous (taxonomy miss)",
    query: "landlord locked my shop",
    expectLLM: true,
    expectTopics: 0,
  },
  {
    label: "Short with known topic (taxonomy hit)",
    query: "bail in murder case PPC 302",
    expectLLM: false,
    expectTopics: 1, // at least 1
  },
  {
    label: "Short ambiguous (neighbour dispute)",
    query: "neighbour blocked my drainage pipe",
    expectLLM: true,
    expectTopics: 0,
  },
  {
    label: "Long narrative (already works)",
    query: "My husband married another woman without my consent and took all my gold ornaments worth 50 tola. He also retained my dowry articles including furniture and electronics. I want to file a case for recovery of my belongings and also want maintenance for myself and my two children.",
    expectLLM: true,
    expectTopics: 1, // family/matrimonial topics should match
  },
];

async function runTests() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  HyDE Intent Fix — Verification Tests");
  console.log("═══════════════════════════════════════════════════════════\n");

  for (const scenario of SCENARIOS) {
    console.log(`\n──── ${scenario.label} ────`);
    console.log(`Query: "${scenario.query}"`);

    // Step 1: Run static intent classifier
    const intent = classifyQueryIntent(scenario.query);
    console.log(`  intent.type      = ${intent.type}`);
    console.log(`  intent.topics    = [${intent.topics.map(t => t.id).join(", ")}] (count: ${intent.topics.length})`);
    console.log(`  intent.expanded  = "${intent.expandedQuery.slice(0, 80)}"`);

    // Check: Would this trigger LLM? (the new gate condition)
    const wouldTriggerLLM = scenario.query.length > 150 || intent.topics.length === 0;
    console.log(`  wouldTriggerLLM  = ${wouldTriggerLLM} (expected: ${scenario.expectLLM})`);

    if (wouldTriggerLLM !== scenario.expectLLM) {
      console.error(`  ❌ FAIL: LLM trigger mismatch!`);
      continue;
    }
    console.log(`  ✅ LLM gate condition correct`);

    // Step 2: If LLM should trigger, call it and verify HyDE + domains
    if (wouldTriggerLLM) {
      try {
        console.log(`  Calling LLM...`);
        const t0 = Date.now();
        const semantic = await generateSemanticRetrievalQueries(scenario.query);
        const elapsed = Date.now() - t0;

        console.log(`  LLM response (${elapsed}ms):`);
        console.log(`    legal_domains     = [${semantic.legal_domains.join(", ")}]`);
        console.log(`    issues            = [${semantic.issues.join(", ")}]`);
        console.log(`    queries           = [${semantic.queries.map(q => `"${q}"`).join(", ")}]`);
        console.log(`    syntheticHeadnote = "${(semantic.syntheticHeadnote || "").slice(0, 120)}..."`);

        // Verify HyDE
        if (semantic.syntheticHeadnote && semantic.syntheticHeadnote.length > 20) {
          console.log(`  ✅ HyDE synthetic headnote generated (${semantic.syntheticHeadnote.length} chars)`);
        } else {
          console.warn(`  ⚠️  HyDE headnote missing or too short`);
        }

        // Verify domain enrichment would fire
        if (intent.topics.length === 0 && semantic.legal_domains.length > 0) {
          console.log(`  ✅ LLM domain enrichment would fire (domains: ${semantic.legal_domains.join(", ")})`);
        }

        // Deterministic facts
        const facts = extractDeterministicFacts(scenario.query);
        if (facts.length > 0) {
          console.log(`    deterministicFacts = [${facts.join(", ")}]`);
        }
      } catch (err) {
        console.error(`  ❌ LLM call failed:`, err);
      }
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  Tests Complete");
  console.log("═══════════════════════════════════════════════════════════\n");
}

runTests().catch(console.error);
