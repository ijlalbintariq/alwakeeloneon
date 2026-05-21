/**
 * Test script: Apex Agent Web (kimi-k2.6 + $web_search)
 * Directly calls chatWithApexAgent to verify the web research pipeline works.
 *
 * Usage: npx tsx scripts/test-apex-agent.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env manually
try {
  const envPath = resolve(import.meta.dirname || __dirname, "../.env");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

import { chatWithApexAgent, isApexAvailable } from "../server/apex-ai";

const TEST_QUERY = "What is the limitation period for filing an appeal against an ex-parte decree under Pakistani law? Cite relevant statutes and any recent Supreme Court judgments.";

async function main() {
  console.log("=== Apex Agent Web Test (kimi-k2.6 + $web_search) ===\n");

  if (!isApexAvailable()) {
    console.error("❌ MOONSHOT_API_KEY not set. Cannot test.");
    process.exit(1);
  }
  console.log("✅ MOONSHOT_API_KEY found\n");

  const systemPrompt = `You are Al Wakeelo, a Pakistani legal AI assistant with web research capabilities.
You have access to the $web_search tool to research Pakistani legal topics.

RULES:
1. Use web search to find current, authoritative Pakistani legal information
2. Search for relevant case law from Pakistani courts (Supreme Court, High Courts)
3. Look up specific statutes, ordinances, and regulations
4. Focus searches on: Pakistan Law Site (pakistanlawsite.com), Supreme Court of Pakistan, High Court judgments, PLD, SCMR
5. Always cite your sources with URLs when available
6. Synthesize findings into a comprehensive, structured legal analysis
7. Only discuss Pakistani law.`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: TEST_QUERY },
  ];

  console.log(`📝 Query: "${TEST_QUERY}"\n`);
  console.log("⏳ Starting Apex Agent web research...\n");

  const startedAt = Date.now();

  try {
    const result = await chatWithApexAgent({
      messages,
      maxTokens: 4096,
      maxIterations: 6,
      totalBudgetMs: 120_000,
      perIterationTimeoutMs: 30_000,
    });

    const elapsed = Date.now() - startedAt;

    console.log("─".repeat(60));
    console.log(`✅ COMPLETED in ${(elapsed / 1000).toFixed(1)}s`);
    console.log(`   Model: ${result.model}`);
    console.log(`   Steps: ${result.steps.length}`);
    console.log(`   Search queries: ${result.searchQueries.length}`);
    console.log(`   Input tokens: ${result.inputTokens ?? "N/A"}`);
    console.log(`   Output tokens: ${result.outputTokens ?? "N/A"}`);
    console.log("─".repeat(60));

    console.log("\n📋 STEPS:");
    for (const step of result.steps) {
      const icon = step.type === "thinking" ? "🧠" : step.type === "searching" ? "🔍" : step.type === "reading" ? "📖" : "✨";
      console.log(`  ${icon} [${step.type}] ${step.content}`);
    }

    if (result.searchQueries.length > 0) {
      console.log("\n🔍 SEARCH QUERIES:");
      for (const q of result.searchQueries) {
        console.log(`  • ${q}`);
      }
    }

    console.log("\n📄 RESPONSE CONTENT:");
    console.log("─".repeat(60));
    // Print first 2000 chars to keep output readable
    const preview = result.content.length > 2000
      ? result.content.slice(0, 2000) + `\n\n... [${result.content.length - 2000} more characters]`
      : result.content;
    console.log(preview);
    console.log("─".repeat(60));

    // Validation checks
    console.log("\n🧪 VALIDATION:");
    const hasContent = result.content.length > 100;
    const hasSteps = result.steps.length >= 2;
    const didSearch = result.searchQueries.length > 0;
    const mentionsLaw = /limitation|decree|appeal|CPC|Order/i.test(result.content);
    const noAbortError = !/aborted|abort/i.test(result.content);

    console.log(`  ${hasContent ? "✅" : "❌"} Response has content (${result.content.length} chars)`);
    console.log(`  ${hasSteps ? "✅" : "❌"} Has processing steps (${result.steps.length})`);
    console.log(`  ${didSearch ? "✅" : "⚠️"} Performed web searches (${result.searchQueries.length})`);
    console.log(`  ${mentionsLaw ? "✅" : "❌"} Mentions relevant legal terms`);
    console.log(`  ${noAbortError ? "✅" : "❌"} No abort errors`);

    const passed = hasContent && hasSteps && mentionsLaw && noAbortError;
    console.log(`\n${passed ? "🎉 TEST PASSED" : "⚠️ TEST NEEDS REVIEW"}`);

    process.exit(passed ? 0 : 1);
  } catch (err: any) {
    const elapsed = Date.now() - startedAt;
    console.error(`\n❌ FAILED after ${(elapsed / 1000).toFixed(1)}s`);
    console.error(`   Error: ${err.message}`);
    console.error(`   Name: ${err.name}`);
    if (err.status) console.error(`   Status: ${err.status}`);
    console.error("\nFull error:", err);
    process.exit(1);
  }
}

main();
