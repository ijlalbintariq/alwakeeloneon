import { refineUserQuery } from "./server/query-refiner.ts";
import { gatherKnowledgeWithHits } from "./server/pipeline/knowledge-pipeline.ts";

function trimTextToTokenBudget(text: string, maxTokens: number): string {
    return text.slice(0, maxTokens * 4);
}

async function run() {
  const safePrompt = "what is the procedure for post arrest bail in murder cases?";
  console.log("Original prompt:", safePrompt);
  
  // 1. Refine
  const draftRefineResult = await refineUserQuery(safePrompt, [], 3000).catch(() => ({
      refined: safePrompt, wasRefined: false, elapsedMs: 0,
  }));
  console.log("Refined prompt:", draftRefineResult.refined);
  
  // 2. Query construction
  const legalKnowledgeQuery = trimTextToTokenBudget(
    [
      draftRefineResult.refined,
      "Post Arrest Bail Application",
      "Pakistan"
    ].filter(p => p.trim().length > 0).join("\n"),
    1000
  );
  console.log("\n--- Search Query ---");
  console.log(legalKnowledgeQuery);
  console.log("--------------------\n");
  
  // 3. Gather Hits
  const hits = await gatherKnowledgeWithHits(legalKnowledgeQuery, undefined, undefined, { module: "legal-drafting" }).catch((err) => {
      console.log("Error gathering hits:", err);
      return { caseLawHits: [] };
  });
  
  console.log("Found Case Law Hits:", hits.caseLawHits?.length || 0);
  if (hits.caseLawHits && hits.caseLawHits.length > 0) {
      hits.caseLawHits.slice(0,3).forEach((h: any) => {
          console.log(`\n- ${h.title} [${h.citation}] (${h.court})`);
          console.log(`  Summary: ${h.summary?.slice(0,150)}...`);
      });
  }
}

run().then(() => {
    console.log("\nTest finished.");
    process.exit(0);
}).catch(console.error);
