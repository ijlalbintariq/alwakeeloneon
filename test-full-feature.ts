import { db } from "./server/db.js";
import { sql } from "drizzle-orm";
import { buildJudgeDecisionProfile, generateAdversarialQueries, runAdversarialRAG, generateCounterBrief } from "./server/pipeline/bench-pipeline.js";
import { getClient } from "./server/openrouter-ai.js";

async function runTests() {
  console.log("=== TEST 1: JUDGE DIRECTORY AUTOCOMPLETE ===");
  try {
    const q = "shah";
    // Avoid raw SQL template literal inside bash heredoc by using eq/like from drizzle instead, or just formatting carefully
    const res = await db.execute(sql.raw("SELECT DISTINCT judge_name FROM judge_case_links WHERE LOWER(judge_name) LIKE '%shah%' LIMIT 5"));
    console.log("Autocomplete results for 'shah':", res.rows.map(r => r.judge_name));
  } catch(e) {
    console.error("Directory test failed:", e);
  }

  console.log("\n=== TEST 2: FULL PIPELINE LATENCY & PROFILE QUALITY ===");
  const testConfig = {
    courtLevel: "supreme_court",
    caseNature: "constitutional",
    proceedingStage: "preliminary_hearing",
    selectedJudgeName: "Mansoor Ali Shah",
    userBrief: "The petition challenges the constitutional amendment under Article 184(3), arguing it violates the salient features of the Constitution."
  };

  const startTime = Date.now();
  
  try {
    console.log("[1] Building Profile...");
    const profile = await buildJudgeDecisionProfile(testConfig.selectedJudgeName, testConfig);
    console.log("Profile Confidence:", profile?.confidence, "(Evidence:", profile?.evidenceJudgmentIds?.length, "cases)");
    
    console.log("[2] Generating Attack Plan...");
    const queries = await generateAdversarialQueries(testConfig.userBrief, { ...testConfig, judgeProfile: profile });
    const hostileCases = await runAdversarialRAG([queries.proceduralBar, queries.statutoryException].filter(Boolean));
    const attackPlan = await generateCounterBrief(hostileCases, testConfig.userBrief);
    
    console.log("[3] Generating Final Judge Response (Streaming Simulation)...");
    const systemPrompt = `Role: Pakistani Judge Simulation.
Court Level: ${testConfig.courtLevel}
Stage: ${testConfig.proceedingStage}

The following evidence-derived decision profile describes recurring patterns found in the retrieved judgments for this judge/court.
Use these patterns when evaluating the advocate's arguments, but independently assess the facts and law in this simulation.
Do not fabricate quotations, authorities, or prior rulings.

${profile?.profile ? "--- JUDICIAL DECISION PROFILE ---\n" + profile.profile + "\n----------------------------------" : "Standard strict procedural purist temperament."}

Attack Plan Strategy to use: ${JSON.stringify(attackPlan)}
Keep your responses authoritative, interrogative, and strictly focused on legal grounds.`;

    const client = getClient();
    const model = process.env.BENCH_SIMULATOR_MODEL || "google/gemini-3-flash-preview";
    const stream = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: testConfig.userBrief }
      ],
      stream: true,
      max_tokens: 500
    });

    let finalResponse = "";
    process.stdout.write("\nJudge Response: ");
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      finalResponse += text;
      process.stdout.write(text);
    }
    
    const endTime = Date.now();
    console.log(`\n\nTotal Pipeline Latency: ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
    
    process.exit(0);
  } catch(e) {
    console.error("Pipeline test failed:", e);
    process.exit(1);
  }
}

runTests();
