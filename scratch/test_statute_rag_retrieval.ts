import "../server/load-env";
import { retrieveForQuery } from "../server/rag/rag-service";

async function main() {
  // Test a query related to one of the indexed statutes, e.g. Control of Narcotic Substances Act
  const query = "What is the penalty or punishment under the Control of Narcotic Substances Act 1997?";
  console.log(`Executing RAG semantic search query: "${query}"...`);

  const t0 = Date.now();
  const result = await retrieveForQuery({
    userId: "test-user-id", // Standard user (should trigger global admin sources inclusion)
    query: query,
    topK: 10,
  });

  console.log(`Query completed in ${((Date.now() - t0)/1000).toFixed(2)}s`);
  console.log(`Total matches found: ${result.matches.length}`);
  console.log(`Confidence score: ${result.confidence}`);
  console.log("");

  // Inspect retrieved matches
  result.matches.forEach((match, index) => {
    const meta = match.metadata || {};
    console.log(`[Match ${index + 1}] Similarity score: ${(match.score || 0).toFixed(4)}`);
    console.log(`  Source Doc: id=${match.sourceDocumentId}, title="${match.title}"`);
    console.log(`  Source Type: ${meta.sourceType || "unknown"}`);
    console.log(`  Preview: "${match.chunkText.slice(0, 150)}..."`);
    console.log("");
  });
}

main().catch(console.error);
