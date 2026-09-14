import { generateAdversarialQueries, runAdversarialRAG } from "./server/pipeline/bench-pipeline";
import { getClient } from "./server/openrouter-ai";

async function runTest() {
  const userMessage = "My client seeks post-arrest bail in a white-collar NAB reference. He has been in jail for 2 years without trial conclusion. We rely on the statutory delay ground under Section 497(1) third proviso CrPC, as well as the Supreme Court's equitable jurisdiction.";
  
  const config = {
    courtLevel: "Supreme Court of Pakistan",
    caseNature: "Criminal / NAB Bail",
    proceedingStage: "Post-Arrest Bail Hearing",
    selectedJudgeName: ""
  };

  console.log("1. User Argument:\n", userMessage);
  
  console.log("\n2. Extracting Adversarial Queries...");
  const queries = await generateAdversarialQueries(userMessage, config);
  console.log("   Queries:", queries);

  console.log("\n3. Retrieving Hostile Precedent...");
  const flatQueries = [queries.proceduralBar, queries.statutoryException, queries.contraryPrecedent];
  const hostileCases = await runAdversarialRAG(flatQueries);
  
  let attackPlan = hostileCases.length > 0 
        ? hostileCases.map(c => `Citation: ${c.citation}\nRule: ${c.summary?.substring(0, 300) || "N/A"}`).join("\n\n")
        : "No directly hostile precedent found. Rely on general statutory principles.";
  
  console.log(`   Found ${hostileCases.length} hostile cases.`);
  
  console.log("\n4. Synthesizing Judge Response...");
  const systemPrompt = `Role: Pakistani Judge Simulation.
Court Level: ${config.courtLevel}
Stage: ${config.proceedingStage}

The following evidence-derived decision profile describes recurring patterns found in the retrieved judgments for this judge/court.
Use these patterns when evaluating the advocate's arguments, but independently assess the facts and law in this simulation.
Do not fabricate quotations, authorities, or prior rulings.

Standard strict procedural purist temperament.

Contrary Legal Authority to confront the user with:
${attackPlan}
Keep your responses authoritative, interrogative, and strictly focused on legal grounds.`;

  const client = getClient();
  const model = process.env.BENCH_SIMULATOR_MODEL || "google/gemini-3-flash-preview";
  
  const stream = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "assistant", content: `Session started. Welcome Counsel. You are presenting before the ${config.courtLevel}. Please present your opening argument regarding the ${config.proceedingStage}.` },
      { role: "user", content: userMessage }
    ],
    stream: true
  });

  let fullResponse = "";
  process.stdout.write("\n--- JUDGE'S RESPONSE ---\n\n");
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || "";
    if (text) {
      fullResponse += text;
      process.stdout.write(text);
    }
  }
  process.stdout.write("\n\n------------------------\n");
}

runTest().catch(console.error);
