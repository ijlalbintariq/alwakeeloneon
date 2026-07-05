import "/Users/macbook/Downloads/Alwakeelo/server/load-env";
import { retrieveLegalCaseLaw } from "/Users/macbook/Downloads/Alwakeelo/server/legal-retrieval";
import { pool } from "/Users/macbook/Downloads/Alwakeelo/server/db";

async function runTest() {
  console.log("=========================================================");
  console.log("🔍 TESTING LEGAL RETRIEVAL / SEARCH (Semantic + Hybrid)");
  console.log("=========================================================");

  const t0 = Date.now();
  try {
    const result = await retrieveLegalCaseLaw({
      userId: "global-admin-judgments",
      query: "Whether Section 20 of PECA violates freedom of speech under Article 19 Constitution of Pakistan",
      limit: 5,
    });

    console.log(`⏱️  Search Finished in: ${Date.now() - t0}ms`);
    console.log(`📊 Retrieval Strategy: ${result.retrievalStrategy}`);
    console.log(`📄 Results retrieved: ${result.rows.length}\n`);

    result.rows.slice(0, 5).forEach((res, idx) => {
      console.log(`[${idx + 1}] Title: ${res.title}`);
      console.log(`🔗 Citation: ${res.citation}`);
      console.log(`🏛️  Court: ${res.court || "unknown"}`);
      console.log(`✍️  Summary: ${res.summary?.slice(0, 300)}...`);
      console.log("---------------------------------------------------------");
    });
  } catch (err: any) {
    console.error("❌ Search error:", err.message);
  }

  await pool.end();
}

runTest().catch(console.error);
