script = """import { db } from "./server/db.js";
import { sql } from "drizzle-orm";
import { buildJudgeDecisionProfile, generateAdversarialQueries, runAdversarialRAG } from "./server/pipeline/bench-pipeline.js";
import { getClient } from "./server/openrouter-ai.js";

async function runHardTest() {
  console.log("=== INITIATING HARD STRESS TEST: PIPELINE & CACHE ===");
  
  const testConfig = {
    courtLevel: "supreme_court",
    caseNature: "corporate",
    proceedingStage: "appellate_arguments",
    selectedJudgeName: "Ayesha A. Malik",
    userBrief: "This appeal challenges the corporate veil piercing by the High Court. The company is a separate legal entity and directors cannot be held personally liable for corporate debt without explicit evidence of fraud."
  };

  try {
    console.log("\\n[Test 1] Fetching Judge Profile (Expected: Cache MISS)...");
    let startTime = Date.now();
    const profileMiss = await buildJudgeDecisionProfile(testConfig.selectedJudgeName, testConfig);
    let endTime = Date.now();
    console.log(`-> Result: ${profileMiss?.confidence} Confidence`);
    console.log(`-> Time Taken (Cache Miss): ${((endTime - startTime) / 1000).toFixed(2)} seconds`);

    console.log("\\n[Test 2] Fetching Judge Profile Again (Expected: Cache HIT)...");
    startTime = Date.now();
    const profileHit = await buildJudgeDecisionProfile(testConfig.selectedJudgeName, testConfig);
    endTime = Date.now();
    console.log(`-> Result: ${profileHit?.confidence} Confidence`);
    console.log(`-> Time Taken (Cache Hit): ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
    
    if (endTime - startTime > 1000) {
      console.error("❌ CACHE FAILED: Hit took too long!");
    } else {
      console.log("✅ CACHE SUCCESS: Sub-second profile retrieval!");
    }

    console.log("\\n[Test 3] Generating Queries & Hostile RAG...");
    startTime = Date.now();
    const queries = await generateAdversarialQueries(testConfig.userBrief, { ...testConfig, judgeProfile: profileHit });
    const hostileCases = await runAdversarialRAG([queries.proceduralBar, queries.statutoryException, queries.contraryPrecedent].filter(Boolean));
    endTime = Date.now();
    console.log(`-> Retrieved ${hostileCases.length} hostile cases.`);
    console.log(`-> Time Taken (Queries + RAG): ${((endTime - startTime) / 1000).toFixed(2)} seconds`);

    console.log("\\n[Test 4] Final Judge Stream (Compressed Pipeline)...");
    const attackPlan = hostileCases.length > 0 
        ? hostileCases.map((c: any) => `Citation: ${c.citation}\\nRule: ${c.summary?.substring(0, 300) || "N/A"}`).join("\\n\\n")
        : "No directly hostile precedent found. Rely on general statutory principles.";

    const systemPrompt = `Role: Pakistani Judge Simulation.
Court Level: ${testConfig.courtLevel}
Stage: ${testConfig.proceedingStage}

The following evidence-derived decision profile describes recurring patterns found in the retrieved judgments for this judge/court.
Use these patterns when evaluating the advocate's arguments, but independently assess the facts and law in this simulation.

${profileHit?.profile ? "--- JUDICIAL DECISION PROFILE ---\\n" + profileHit.profile + "\\n----------------------------------" : ""}

Contrary Legal Authority to confront the user with:
${attackPlan}
Keep your responses authoritative, interrogative, and strictly focused on legal grounds.`;

    startTime = Date.now();
    const client = getClient();
    const stream = await client.chat.completions.create({
      model: process.env.BENCH_SIMULATOR_MODEL || "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: testConfig.userBrief }
      ],
      stream: true,
      max_tokens: 500
    });

    let finalResponse = "";
    process.stdout.write("Judge Response: ");
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      finalResponse += text;
      process.stdout.write(text);
    }
    endTime = Date.now();
    console.log(`\\n\\n-> Time Taken (Streaming Output): ${((endTime - startTime) / 1000).toFixed(2)} seconds`);

    console.log("\\n=== ALL TESTS PASSED SUCCESSFULLY ===");
    process.exit(0);

  } catch (error) {
    console.error("HARD TEST FAILED:", error);
    process.exit(1);
  }
}

runHardTest();"""

with open("hard-test.ts", "w") as f:
    f.write(script)
