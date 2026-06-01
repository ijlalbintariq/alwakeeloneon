import "../server/load-env";
import { performance } from "perf_hooks";
import { storage } from "../server/storage";
import { pool, db } from "../server/db";
import { statutes } from "../shared/schema";
import { sql } from "drizzle-orm";

async function runStatuteQueries() {
  console.log("=== STARTING INDEPENDENT STATUTES SEARCH VERIFIER ===");

  // Warmup
  await db.execute(sql`select 1`);
  try {
    await storage.searchStatutes("Constitution", 1);
  } catch {}

  const queries = [
    "302 qatl",
    "punishment dower",
    "Section 392 PPC",
    "Constitution Article 25",
  ];

  for (const query of queries) {
    console.log(`\n🔍 Searching statutes for query: "${query}"`);
    const trials = 3;
    let bestTime = Infinity;
    let results: any[] = [];

    for (let i = 1; i <= trials; i++) {
      const start = performance.now();
      results = await storage.searchStatutes(query, 10);
      const elapsed = performance.now() - start;
      console.log(`  - Trial ${i}: ${elapsed.toFixed(2)}ms (found ${results.length} results)`);
      if (elapsed < bestTime) {
        bestTime = elapsed;
      }
    }

    console.log(`⏱️ Best time: ${bestTime.toFixed(2)}ms`);
    if (bestTime > 350) {
      throw new Error(`[Assertion Fail] Statute search for "${query}" took ${bestTime.toFixed(2)}ms, which exceeds 350ms!`);
    }
    console.log(`✅ Performance check passed: ${bestTime.toFixed(2)}ms < 350ms`);

    // Verify tokenized AND logic
    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 2);

    for (const row of results) {
      const combined = `${row.shortTitle || ""} ${row.section || ""} ${row.description || ""} ${row.punishment || ""}`.toLowerCase();
      const matchesAll = tokens.every((token) => combined.includes(token));
      if (!matchesAll) {
        console.error(`❌ Row failed tokenized AND check! Row:`, row);
        throw new Error(`[Assertion Fail] Row did not contain all query tokens: [${tokens.join(", ")}]`);
      }
      console.log(`  ✅ Match verified: [${row.shortTitle}] Sec ${row.section}`);
    }
  }

  console.log("\n🎉 ALL INDEPENDENT STATUTE SEARCH PERF AND CORRECTNESS TESTS PASSED!");
}

runStatuteQueries()
  .then(async () => {
    if (pool) await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("🛑 VERIFICATION FAILED:", err);
    if (pool) await pool.end();
    process.exit(1);
  });
