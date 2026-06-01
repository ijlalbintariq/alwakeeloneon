import "../server/load-env";
import { performance } from "perf_hooks";
import { storage, ensureSearchIndexes } from "../server/storage";
import { pool, db } from "../server/db";
import { caseLaw, judgments, adminKnowledge, githubKnowledge, statuteDocuments, documents } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

// Helper to retrieve the full text or source text from the database
async function getFullTextForCaseLaw(item: any): Promise<string> {
  let extraText = "";
  try {
    if (item.sourceType === "judgment") {
      const rows = await db
        .select()
        .from(judgments)
        .where(eq(judgments.citationString, item.citation))
        .limit(1);
      if (rows && rows.length > 0) {
        const row = rows[0];
        extraText = `${row.title || ""} ${row.headnotes || ""} ${row.fullText || ""} ${row.petitioner || ""} ${row.respondent || ""}`;
      }
    } else if (item.sourceDocId) {
      if (item.sourceType === "admin") {
        const rows = await db
          .select()
          .from(adminKnowledge)
          .where(eq(adminKnowledge.id, item.sourceDocId))
          .limit(1);
        if (rows && rows.length > 0) extraText = rows[0].content || "";
      } else if (item.sourceType === "github") {
        const rows = await db
          .select()
          .from(githubKnowledge)
          .where(eq(githubKnowledge.id, item.sourceDocId))
          .limit(1);
        if (rows && rows.length > 0) extraText = rows[0].content || "";
      } else if (item.sourceType === "statute") {
        const rows = await db
          .select()
          .from(statuteDocuments)
          .where(eq(statuteDocuments.id, item.sourceDocId))
          .limit(1);
        if (rows && rows.length > 0) extraText = rows[0].content || "";
      } else if (item.sourceType === "user") {
        const rows = await db
          .select()
          .from(documents)
          .where(eq(documents.id, item.sourceDocId))
          .limit(1);
        if (rows && rows.length > 0) extraText = rows[0].content || "";
      }
    }
  } catch (err: any) {
    console.warn(`[Warning] Failed to fetch full text for citation "${item.citation}":`, err.message || err);
  }
  return extraText;
}

// Check word boundaries for a single returned item
async function verifyItemWordBoundaries(item: any, queryTerms: string[]): Promise<{ ok: boolean; missing: string[]; matchedField?: string }> {
  const fullText = await getFullTextForCaseLaw(item);
  
  const fields = {
    title: item.title || "",
    summary: item.summary || "",
    citation: item.citation || "",
    keywords: Array.isArray(item.keywords) ? item.keywords.join(" ") : "",
    fullText: fullText
  };

  const missing: string[] = [];
  for (const term of queryTerms) {
    // JavaScript word boundary regex \b
    const regex = new RegExp('\\b' + term + '\\b', 'i');
    let matched = false;
    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      if (regex.test(fieldValue)) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      missing.push(term);
    }
  }

  return {
    ok: missing.length === 0,
    missing
  };
}

async function verifyQuery(
  searchFuncName: "searchCaseLaw" | "searchJudgmentsByKeywords",
  query: string,
  queryTerms: string[]
) {
  console.log(`\n------------------------------------------------------------`);
  console.log(`🔍 Verifying ${searchFuncName} with query "${query}"`);
  console.log(`------------------------------------------------------------`);

  let results: any[] = [];
  let elapsed = 0;
  const maxAttempts = 3;
  let bestTime = Infinity;
  let bestResults: any[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startTime = performance.now();
    let currentResults: any[] = [];
    
    if (searchFuncName === "searchCaseLaw") {
      currentResults = await storage.searchCaseLaw(query, 25, {
        sort: "relevance",
        includeSourceContentSearch: true
      });
    } else {
      currentResults = await storage.searchJudgmentsByKeywords(query, 25);
    }

    const currentElapsed = performance.now() - startTime;
    console.log(`   - Trial ${attempt}: ${currentElapsed.toFixed(2)}ms`);
    
    if (currentElapsed < bestTime) {
      bestTime = currentElapsed;
      bestResults = currentResults;
    }
    if (currentElapsed < 500) {
      break;
    }
  }

  elapsed = bestTime;
  results = bestResults;
  console.log(`⏱️ Best query execution time: ${elapsed.toFixed(2)}ms`);
  
  // Assert query time is strictly less than 500ms
  if (elapsed >= 500) {
    throw new Error(`[Assertion Fail] Query performance failed: elapsed time ${elapsed.toFixed(2)}ms is not strictly less than 500ms`);
  }
  console.log(`✅ Performance check passed: ${elapsed.toFixed(2)}ms < 500ms`);

  console.log(`📊 Retrieved ${results.length} results.`);

  let falsePositivesCount = 0;
  for (const item of results) {
    const verification = await verifyItemWordBoundaries(item, queryTerms);
    if (!verification.ok) {
      falsePositivesCount++;
      console.error(`❌ [Relevance Fail] Substring collision / false-positive match found!`);
      console.error(`   - Title: "${item.title}"`);
      console.error(`   - Citation: "${item.citation}"`);
      console.error(`   - Missing whole-word terms: [${verification.missing.join(", ")}]`);
      console.error(`   - Summary Snippet: "${(item.summary || "").slice(0, 120)}..."`);
    } else {
      console.log(`   ✅ Valid match: "${item.title.slice(0, 60)}..." [Citation: ${item.citation}]`);
    }
  }

  if (falsePositivesCount > 0) {
    throw new Error(`[Assertion Fail] Relevance check failed: ${falsePositivesCount} out of ${results.length} results contained substring collisions or were missing whole-word query terms.`);
  }
  console.log(`✅ Relevance check passed: All returned results contain the complete set of whole words: [${queryTerms.join(", ")}]`);
}

async function main() {
  console.log("=== STARTING AUTOMATED SEARCH VERIFIER ===");
  try {
    console.log("Ensuring search indexes are built...");
    await ensureSearchIndexes();
    console.log("Database indexes verified/built.");

    console.log("Warming up database connection pool and query planner...");
    await db.execute(sql`select 1`);
    try {
      await storage.searchCaseLaw("haq", 1);
    } catch {}
    try {
      await storage.searchJudgmentsByKeywords("mehr", 1);
    } catch {}
    console.log("Database connection pool warmed up.");

    // 1. Verify "haq mehr"
    await verifyQuery("searchCaseLaw", "haq mehr", ["haq", "mehr"]);
    await verifyQuery("searchJudgmentsByKeywords", "haq mehr", ["haq", "mehr"]);

    // 2. Verify "divorce dower"
    await verifyQuery("searchCaseLaw", "divorce dower", ["divorce", "dower"]);
    await verifyQuery("searchJudgmentsByKeywords", "divorce dower", ["divorce", "dower"]);

    console.log("\n============================================================");
    console.log("🎉 ALL SEARCH ENGINE ASSERTIONS PASSED SUCCESSFULLY!");
    console.log("============================================================");
    process.exit(0);
  } catch (err: any) {
    console.error("\n============================================================");
    console.error("🛑 ASSERTION FAILURE OR ERROR DETECTED:");
    console.error(err.message || err);
    console.error("============================================================");
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

main().catch(async (e) => {
  console.error("Fatal error during verification run:", e);
  if (pool) {
    await pool.end();
  }
  process.exit(1);
});
