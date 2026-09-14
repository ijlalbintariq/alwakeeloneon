import { db } from "./server/db.js";
import { 
  buildJudgeDecisionProfile, 
  generateAdversarialQueries, 
  runAdversarialRAG 
} from "./server/pipeline/bench-pipeline.js";

async function runTest() {
  console.log("=== 1. Starting Bench Simulator Pipeline Test ===");
  const testConfig = {
    courtLevel: "high_court",
    caseNature: "criminal",
    proceedingStage: "bail_pre_arrest",
    selectedJudgeName: "Mansoor Ali Shah",
    userBrief: "The petitioner seeks pre-arrest bail. There is an unexplained delay of 3 days in lodging the FIR, indicating mala fide and afterthought by the complainant."
  };

  try {
    console.log("\n[Phase 1] Building Judicial Decision Profile...");
    const profileData = await buildJudgeDecisionProfile(testConfig.selectedJudgeName, testConfig);
    console.log("-> Confidence:", profileData?.confidence);
    console.log("-> Evidence Cases Found:", profileData?.evidenceJudgmentIds?.length);
    console.log("-> Profile Preview:\\n", profileData?.profile?.substring(0, 300) + "...");

    console.log("\n[Phase 2] Generating Adversarial Queries...");
    const queries = await generateAdversarialQueries(testConfig.userBrief, {
      ...testConfig,
      judgeProfile: profileData
    });
    console.log("-> Procedural Bar Query:", queries.proceduralBar);
    console.log("-> Statutory Exception Query:", queries.statutoryException);
    console.log("-> Contrary Precedent Query:", queries.contraryPrecedent);

    console.log("\n[Phase 3] Running RAG Retrieval against Hostile Cases...");
    const flatQueries = [queries.proceduralBar, queries.statutoryException, queries.contraryPrecedent].filter(Boolean);
    const hostileCases = await runAdversarialRAG(flatQueries);
    console.log(`-> Retrieved ${hostileCases.length} hostile precedents.`);
    if (hostileCases.length > 0) {
      console.log("-> Top Hostile Case Citation:", hostileCases[0].citation);
    }

    console.log("\n=== Test Completed Successfully! ===");
    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

runTest();
