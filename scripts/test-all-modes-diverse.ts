import "../server/load-env";
import { writeFileSync } from "fs";
import { resolve } from "path";
import OpenAI from "openai";
import { chatWithApex, chatWithApexAgent, isApexAvailable } from "../server/apex-ai";
import { isOpenRouterAvailable } from "../server/openrouter-ai";
import { pool } from "../server/db";

// New diverse legal query: Family / Child Custody Conflict under Section 25 GWA
const FAMILY_CUSTODY_QUERY = `A Muslim mother seeks custody of her 5-year-old son (hizanat) under Section 25 of the Guardians and Wards Act, 1890. The paternal grandmother currently has physical custody and claims the mother lost her right due to contracting a second marriage with a stranger (non-mahram). Advise under Pakistani family law, citing relevant statutory provisions and landmark Supreme Court judgments.`;

async function runMode(name: string, executeFn: () => Promise<any>) {
  console.log(`\n[Test Launcher] Starting: ${name}...`);
  const start = Date.now();
  try {
    const res = await executeFn();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ [Test Launcher] Completed ${name} in ${elapsed}s`);
    return {
      success: true,
      elapsed: parseFloat(elapsed),
      content: res.content,
      reasoning: res.reasoning || null,
      model: res.model
    };
  } catch (err: any) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`❌ [Test Launcher] Failed ${name} in ${elapsed}s:`, err.message);
    return {
      success: false,
      elapsed: parseFloat(elapsed),
      error: err.message
    };
  }
}

async function main() {
  console.log("======================================================================");
  console.log("AL WAKEELO DIVERSE MULTI-MODE TEST RUNNER");
  console.log("Query: Family Custody / Second Marriage Conflict under Section 25 GWA");
  console.log("======================================================================\n");

  if (!isOpenRouterAvailable()) {
    console.error("❌ OPENROUTER_API_KEY missing!");
    process.exit(1);
  }
  if (!isApexAvailable()) {
    console.error("❌ MOONSHOT_API_KEY missing!");
    process.exit(1);
  }

  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  const orClient = new OpenAI({
    apiKey: openRouterApiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });

  const systemPrompt = "You are Al Wakeelo, an expert Pakistani family law AI assistant. Citing specific statute sections (e.g. \"Section 25 of the Guardians and Wards Act, 1890\") and landmark Supreme Court judgments (e.g. 2018 SCMR 193) is highly required.";
  
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: FAMILY_CUSTODY_QUERY }
  ];

  console.log("🚀 Launching sequential test runs across all 5 active modes...\n");

  // Run all 5 modes sequentially to avoid API concurrency limits
  const mode1 = await runMode("1. Standard Mode (deepseek-chat)", async () => {
    const response = await orClient.chat.completions.create({
      model: "deepseek/deepseek-chat",
      messages,
      max_tokens: 3000,
      temperature: 0.5
    });
    return {
      content: response.choices[0]?.message?.content || "",
      model: "deepseek/deepseek-chat"
    };
  });

  const mode2 = await runMode("2. Turbo Mode (deepseek-r1)", async () => {
    const response = await orClient.chat.completions.create({
      model: "deepseek/deepseek-r1",
      messages,
      max_tokens: 3500,
      temperature: 0.5
    });
    return {
      content: response.choices[0]?.message?.content || "",
      reasoning: (response.choices[0]?.message as any)?.reasoning || (response.choices[0]?.message as any)?.reasoning_content || null,
      model: "deepseek/deepseek-r1"
    };
  });

  const mode3 = await runMode("3. Apex Mode (kimi-k2.6)", async () => {
    return chatWithApex({
      model: "apex-pro",
      messages,
      maxTokens: 3000
    });
  });

  const mode4 = await runMode("4. Apex Pro Mode (kimi-k2.6 thinking)", async () => {
    return chatWithApex({
      model: "apex-agent",
      messages,
      maxTokens: 3500
    });
  });

  const mode5 = await runMode("5. Web Search Mode (kimi-k2.6 Web)", async () => {
    return chatWithApexAgent({
      messages: [
        { role: "system", content: "You are Al Wakeelo, a Pakistani family law AI assistant. Use the web search tool to find recent Supreme Court judgments on mother's custody rights after contracting second marriage." },
        { role: "user", content: FAMILY_CUSTODY_QUERY }
      ],
      maxTokens: 3000,
      maxIterations: 4
    });
  });

  const results = {
    standard: mode1,
    turbo: mode2,
    apex: mode3,
    apexPro: mode4,
    webSearch: mode5
  };

  const resultsPath = resolve(import.meta.dirname || __dirname, "../all_modes_diverse_results.json");
  writeFileSync(resultsPath, JSON.stringify(results, null, 2), "utf-8");

  console.log("\n======================================================================");
  console.log("🎉 ALL TESTS EXECUTION COMPLETE!");
  console.log(`Results successfully saved to: ${resultsPath}`);
  console.log("======================================================================");

  if (pool) {
    await pool.end();
  }
  process.exit(0);
}

main().catch(async err => {
  console.error("Test execution failed:", err);
  if (pool) {
    await pool.end();
  }
  process.exit(1);
});
