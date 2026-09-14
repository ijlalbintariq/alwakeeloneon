
import { 
  generateAdversarialQueries, 
  runAdversarialRAG, 
  generateCounterBrief, 
  type BenchContext 
} from "./server/pipeline/bench-pipeline";

async function main() {
  console.log("=== Bench Simulator RAG Pipeline Test ===");

  const context: BenchContext = {
    courtLevel: "High Court",
    caseNature: "Constitutional / Writ",
    proceedingStage: "Maintainability"
  };

  const userArgument = "The delay in filing the FIR should not be fatal because the petitioner was negotiating a settlement out of court.";
  
  console.log("\n[1] Generating Adversarial Queries for argument:");
  console.log(`"${userArgument}"`);
  
  const queries = await generateAdversarialQueries(userArgument, context);
  console.log("\nGenerated Queries:");
  console.log(JSON.stringify(queries, null, 2));

  console.log("\n[2] Running Adversarial RAG...");
  const flatQueries = [
    queries.proceduralBar, 
    queries.statutoryException, 
    queries.contraryPrecedent
  ];
  
  const cases = await runAdversarialRAG(flatQueries);
  console.log(`\nRetrieved ${cases.length} Hostile Cases.`);
  
  cases.forEach((c, idx) => {
    // Assert overruled is not true (if property exists)
    if ((c as any).isOverruled === true) {
      console.error(`❌ ERROR: Overruled case retrieved: ${c.citation}`);
    } else {
      console.log(`${idx + 1}. ${c.citation} - ${c.title}`);
    }
  });

  if (cases.length > 0) {
    console.log("\n[3] Generating Counter Brief...");
    const brief = await generateCounterBrief(cases, userArgument);
    console.log("\nCounter Brief JSON:");
    console.log(JSON.stringify(brief, null, 2));
  } else {
    console.log("\nNo cases retrieved, skipping Counter Brief generation.");
  }

  console.log("\n=== Test Complete ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
