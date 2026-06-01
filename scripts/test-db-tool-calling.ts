import "../server/load-env";
import { runToolJudgmentSearchOR, isOpenRouterAvailable } from "../server/openrouter-ai";
import { pool } from "../server/db";

const INHERITANCE_QUERY = `A Muslim man died leaving behind a widow, two daughters, and a brother. He owned a commercial building and agricultural land in Punjab. During his lifetime, the brother claims the deceased gifted (Hiba) the agricultural land to him via an oral gift (Hiba) followed by a mutation in revenue records. The daughters claim the gift is fraudulent, designed to deprive female heirs of their legal inheritance under Shariat, and that under Section 498-A PPC, depriving women of inheritance is a criminal offense. What are the rules of Islamic inheritance for this family, the legal requirements of a valid oral Hiba (gift) under Muslim personal law, and the burden of proof for the brother's claim? Citing relevant Pakistani statutes and landmark Supreme Court judgments is mandatory.`;

async function main() {
  console.log("=== Neon DB Hybrid Citation Search & Tool Calling Local Test ===\n");

  if (!isOpenRouterAvailable()) {
    console.error("❌ OPENROUTER_API_KEY not set. Cannot run OpenRouter tool calling.");
    process.exit(1);
  }
  console.log("✅ OPENROUTER_API_KEY found.");

  console.log(`📝 User Query: "${INHERITANCE_QUERY}"\n`);
  console.log("⏳ Starting parallel hybrid tool call loop for database search...\n");

  const startedAt = Date.now();

  try {
    const result = await runToolJudgmentSearchOR(
      INHERITANCE_QUERY,
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

    if (result.verifiedTitles.length > 0) {
      console.log("\n📜 UNIQUE TITLES MATCHED:");
      for (const t of result.verifiedTitles) {
        console.log(`  ✅ ${t.citation} — ${t.title}`);
      }
    }

    console.log("\n📄 GENERATED RAG CONTEXT (FIRST 1000 CHARACTERS):");
    console.log("─".repeat(60));
    const preview = result.contextString.length > 1000
      ? result.contextString.slice(0, 1000) + "\n\n... [Truncated]"
      : result.contextString;
    console.log(preview || "[No Context Generated]");
    console.log("─".repeat(60));

    if (pool) {
      await pool.end();
    }
    process.exit(0);
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
