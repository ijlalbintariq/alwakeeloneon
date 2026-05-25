import "../server/load-env";
import { runToolJudgmentSearchOR, isOpenRouterAvailable } from "../server/openrouter-ai";
import { pool } from "../server/db";

const USER_STRESS_QUERY = "A client received an ex-parte decree from a civil court in Lahore. He was not properly served with summons and learned about the decree 45 days later. What are the relevant Supreme Court judgments for setting aside ex-parte decree under Order IX Rule 13 CPC and limitation under Article 164 of the Limitation Act?";

async function main() {
  console.log("=== Neon DB Citation Search & Tool Calling Test (OpenRouter) ===\n");

  if (!isOpenRouterAvailable()) {
    console.error("❌ OPENROUTER_API_KEY not set. Cannot run OpenRouter tool calling.");
    process.exit(1);
  }
  console.log("✅ OPENROUTER_API_KEY found.");

  console.log(`📝 User Query: "${USER_STRESS_QUERY}"\n`);
  console.log("⏳ Starting parallel tool call loop for database search...\n");

  const startedAt = Date.now();

  try {
    const result = await runToolJudgmentSearchOR(
      USER_STRESS_QUERY,
      (query, found) => {
        console.log(`🔍 [Tool Call] search_judgments(query: "${query}") -> Found ${found} records in database.`);
      }
    );

    const elapsed = Date.now() - startedAt;

    console.log("\n" + "─".repeat(60));
    console.log(`✅ COMPLETED in ${(elapsed / 1000).toFixed(1)}s`);
    console.log(`   Queries executed: ${result.queriesUsed.length}`);
    console.log(`   Unique judgments found: ${result.foundCount}`);
    console.log("─".repeat(60));

    if (result.queriesUsed.length > 0) {
      console.log("\n🔍 SEARCH QUERIES SUBMITTED BY AI:");
      for (const q of result.queriesUsed) {
        console.log(`  • "${q}"`);
      }
    }

    if (result.verifiedCitations.length > 0) {
      console.log("\n📜 UNIQUE CITATIONS FOUND:");
      for (const cit of result.verifiedCitations) {
        console.log(`  ✅ ${cit}`);
      }
    }

    console.log("\n📄 GENERATED RAG CONTEXT (FIRST 600 CHARACTERS):");
    console.log("─".repeat(60));
    const preview = result.contextString.length > 600
      ? result.contextString.slice(0, 600) + "\n\n... [Truncated]"
      : result.contextString;
    console.log(preview || "[No Context Generated]");
    console.log("─".repeat(60));

    // Validation checks
    const hasQueries = result.queriesUsed.length > 0;
    const hasCitations = result.verifiedCitations.length > 0;
    const hasContext = result.contextString.length > 100;

    console.log("\n🧪 VALIDATION VERDICT:");
    console.log(`  ${hasQueries ? "✅" : "❌"} AI successfully formulated sub-queries.`);
    console.log(`  ${hasCitations ? "✅" : "❌"} Relational DB retrieved real citations.`);
    console.log(`  ${hasContext ? "✅" : "❌"} Valid RAG context string compiled.`);

    const passed = hasQueries && hasCitations && hasContext;
    console.log(`\n${passed ? "🎉 REAL USER TOOL CALLING TEST PASSED!" : "⚠️ TEST NEEDS REVIEW"}`);

    if (pool) {
      await pool.end();
    }
    process.exit(passed ? 0 : 1);
  } catch (err: any) {
    const elapsed = Date.now() - startedAt;
    console.error(`\n❌ FAILED after ${(elapsed / 1000).toFixed(1)}s`);
    console.error(`   Error: ${err.message}`);
    if (pool) {
      await pool.end();
    }
    process.exit(1);
  }
}

main();
