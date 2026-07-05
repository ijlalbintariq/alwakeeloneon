import "./load-env";
import { gatherKnowledgeWithHits } from "../pipeline/knowledge-pipeline";
import { chatWithApex } from "../apex-ai";
import { chatWithOpenRouter } from "../openrouter";

async function run() {
  console.log("\n=======================================================");
  console.log("[Test] Simulating Chat Mode Transition (Standard -> Turbo)");
  console.log("=======================================================\n");

  const query1 = "What is the maximum punishment for theft under PPC?";
  console.log(`[Turn 1: Standard Mode] User: "${query1}"`);
  
  const messages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];

  // 1. Simulating Standard Mode execution (Gemini 3.0 via OpenRouter)
  const systemPromptStandard = "You are Al Wakeelo, a legal assistant. Answer the legal question briefly.";
  const t0 = Date.now();
  let standardResponse = "";
  try {
    const result = await chatWithOpenRouter({
      messages: [
        { role: "system", content: systemPromptStandard },
        { role: "user", content: query1 }
      ],
      maxTokens: 1024,
      temperature: 0.7
    });
    standardResponse = result.content;
    const standardMs = Date.now() - t0;
    console.log(`[Standard Mode Done] took ${standardMs}ms.`);
    console.log(`AI (Standard): ${standardResponse.substring(0, 150)}...\n`);
  } catch (err: any) {
    console.error("[Error] Standard Mode failed:", err.message);
    return;
  }

  // Add Turn 1 to history
  messages.push({ role: "user", content: query1 });
  messages.push({ role: "assistant", content: standardResponse });

  // 2. Simulating Transition to Turbo Mode for Turn 2
  const query2 = "Does this change if the theft was committed in a dwelling house under Section 380 PPC?";
  console.log(`[Turn 2: Turbo Mode Transition] User: "${query2}"`);
  
  console.log("   - Running RAG retrieval for Turn 2 query...");
  const t1 = Date.now();
  const retrieval = await gatherKnowledgeWithHits(query2, "global-admin-judgments", []);
  const ragMs = Date.now() - t1;
  console.log(`   - [RAG Done] took ${ragMs}ms. Has case law: ${retrieval.hasCaseLaw}`);

  const systemPromptTurbo = `You are Al Wakeelo, an AI-powered legal assistant for Pakistani law.
Answer the user's legal question accurately and citation-disciplined.

=== CONTEXT FROM DATABASE ===
${retrieval.contextString}
=== END OF CONTEXT ===

Ensure references are at the end.`;

  console.log("   - Calling Kimi K2.6 (Apex) with full history...");
  const t2 = Date.now();
  try {
    const result = await chatWithApex({
      model: "apex-pro",
      messages: [
        { role: "system", content: systemPromptTurbo },
        ...messages,
        { role: "user", content: query2 }
      ],
      maxTokens: 4096,
      temperature: 0.3
    });
    const apexMs = Date.now() - t2;
    console.log(`[Turbo Mode Done] took ${apexMs}ms. Model used: ${result.model}`);
    console.log("\n=======================================================");
    console.log("[Turn 2 Response Text]:\n");
    console.log(result.content);
    console.log("=======================================================\n");
  } catch (err: any) {
    console.error("[Error] Turbo Mode transition failed:", err.message);
  }
}

run().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
