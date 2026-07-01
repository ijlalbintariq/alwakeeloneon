import "../server/load-env";
import { retrieveForQuery } from "../server/rag/rag-service";
import { pool } from "../server/db";

async function testQuery(queryText: string) {
  console.log(`\n======================================================================`);
  console.log(`⚖️  LEGAL QUERY: "${queryText}"`);
  console.log(`======================================================================`);

  const t0 = Date.now();
  try {
    const result = await retrieveForQuery({
      userId: "global-admin-judgments", // Correct judgments scope
      query: queryText,
      topK: 5,
    });

    console.log(`⏱️  Query + Rerank Latency: ${Date.now() - t0}ms`);
    console.log(`📊 Confidence Level: ${result.confidence.toUpperCase()}`);
    console.log(`📄 Retrieved matches: ${result.matches.length}\n`);

    if (result.matches.length === 0) {
      console.log("❌ No relevant case law found.");
      return;
    }

    result.matches.forEach((match, idx) => {
      const srcType = match.metadata?.sourceType || "unknown";
      console.log(`[${idx + 1}] Score: ${match.score.toFixed(4)} | Type: ${srcType.toUpperCase()}`);
      console.log(`📜 Title: ${match.title}`);
      if (match.metadata?.citationString) {
        console.log(`🔗 Citation: ${match.metadata.citationString}`);
      }
      if (match.metadata?.court) {
        console.log(`🏛️  Court: ${match.metadata.court}`);
      }
      console.log(`✍️  Snippet Excerpt:\n"${match.chunkText.slice(0, 300).trim()}..."`);
      console.log(`----------------------------------------------------------------------`);
    });
  } catch (err: any) {
    console.error("❌ Retrieval error:", err.message);
  }
}

async function runTests() {
  // Test Case 1: Bail in Narcotics Cases (CNSA)
  await testQuery("Whether bail can be granted to an accused under Control of Narcotic Substances Act (CNSA) if the quantity of recovered contraband falls within border limits of commercial quantity.");

  // Test Case 2: Specific Performance of Contract
  await testQuery("What are the essential requirements for proving a suit for specific performance of contract concerning immovable property when the agreement is oral?");

  // Test Case 3: Writ Jurisdiction (Article 199) and Laches
  await testQuery("Can a constitutional writ petition under Article 199 of the Constitution of Pakistan be dismissed solely on the ground of laches and delay, and what are the exceptions to it?");

  // Close connection pool
  await pool.end();
}

runTests().catch(console.error);
