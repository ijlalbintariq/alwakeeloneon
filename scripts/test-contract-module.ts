/**
 * Al Wakeelo Contract Module Integration & Quality Test
 * ====================================================
 * Tests the local template retrieval, AI-fallback suggestion/generation,
 * and AI-based contract risk analysis, comparing results against market standards.
 *
 * Usage: npx tsx scripts/test-contract-module.ts
 */
import { suggestClauses, generateClauseFromPrompt } from "../server/retrieval/clause-library";
import { chatWithOpenRouter, isOpenRouterAvailable } from "../server/openrouter";
import { chatWithDeepSeek, isDeepSeekAvailable } from "../server/deepseek-ai";

// Load .env
import { readFileSync } from "fs";
import { resolve } from "path";
try {
  const envPath = resolve(import.meta.dirname || __dirname, "../.env");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

// Mock user context details
const MOCK_JURISDICTION = "Karachi, Pakistan";

// Sample flawed contract text for Risk Analysis Test
const SAMPLE_FLAWED_CONTRACT = `
MUTUAL SERVICE AGREEMENT
This agreement is entered into between Party A and Party B.
1. Scope: Party A will provide consulting services to Party B.
2. Payment: Party B will pay Party A for services rendered.
3. Term: This agreement shall begin on June 18, 2026 and continue indefinitely.
4. Indemnity: Party B agrees to fully indemnify and hold harmless Party A from any and all claims, damages, liabilities, losses, costs, or expenses of any nature whatsoever, whether arising out of negligence, breach of contract, or otherwise, without any financial cap or limitation.
5. Entire Agreement: This constitutes the entire agreement between the parties.
`;

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt }
  ];
  
  if (isOpenRouterAvailable()) {
    try {
      const orResult = await chatWithOpenRouter({
        messages,
        maxTokens: 2000,
        temperature: 0.2
      });
      return orResult.content;
    } catch (err: any) {
      console.warn("   ⚠️ OpenRouter call failed, trying DeepSeek:", err.message);
    }
  }

  if (isDeepSeekAvailable()) {
    const dsResult = await chatWithDeepSeek({
      messages,
      maxTokens: 2000,
      temperature: 0.2
    });
    return dsResult.content;
  }

  throw new Error("No AI providers available. Check OPENROUTER_API_KEY or DEEPSEEK_API_KEY.");
}

async function runTests() {
  console.log("═".repeat(80));
  console.log("             AL WAKEELO CONTRACT MODULE — INTEGRATION & QUALITY TEST");
  console.log("═".repeat(80));

  // ─── TEST 1: Local Template Retrieval (suggestClauses) ─────────────────
  console.log("\n📋 Test 1: Local Template Retrieval (suggestClauses)...");
  const suggestions = suggestClauses({
    query: "dispute resolution arbitration",
    contractType: "Partnership Agreement",
    limit: 2
  });

  console.log(`   Found ${suggestions.length} suggestions:`);
  for (const s of suggestions) {
    console.log(`   👉 [${s.id}] Title: "${s.title}" | Subtitle: "${s.subtitle}"`);
  }

  const hasDisputeResolution = suggestions.some(s => s.id === "dispute-resolution");
  if (hasDisputeResolution) {
    console.log("   ✅ suggestClauses matched 'dispute-resolution' correctly.");
  } else {
    console.warn("   ❌ suggestClauses failed to prioritize 'dispute-resolution' for dispute query.");
  }


  // ─── TEST 2: Local Template Generation (generateClauseFromPrompt) ───────
  console.log("\n📋 Test 2: Local Template Generation (generateClauseFromPrompt)...");
  const generatedLocal = generateClauseFromPrompt({
    prompt: "I need a governing law clause for Lahore",
    jurisdiction: "Lahore"
  });

  console.log(`   Method: ${generatedLocal.method} | SourceId: ${generatedLocal.sourceId} | Confidence: ${generatedLocal.confidence}`);
  console.log("   --- Generated Clause Excerpt ---");
  console.log(`   ${generatedLocal.clause.substring(0, 150)}...`);
  console.log("   --------------------------------");

  if (generatedLocal.clause.includes("laws of Pakistan") && generatedLocal.clause.includes("courts at Lahore")) {
    console.log("   ✅ generateClauseFromPrompt correctly generated governing law locked to Lahore jurisdiction.");
  } else {
    console.warn("   ❌ generateClauseFromPrompt failed to inject jurisdiction or match template.");
  }


  // ─── TEST 3: AI Fallback Clause Generation ─────────────────────────────
  console.log("\n📋 Test 3: AI Fallback Clause Generation (Quality Test)...");
  const genSystemInstruction = `You are a Pakistani legal drafting assistant.
Draft one enforceable contract clause based on the instruction and draft context.
Return only clause text. No markdown. No bullet list. No JSON.`;

  const genUserInput = `Instruction: Draft a highly secure limitation of liability clause for a software development company.
Jurisdiction: ${MOCK_JURISDICTION}
Current Draft Excerpt: [None]`;

  try {
    const started = Date.now();
    const clauseText = await callAI(genSystemInstruction, genUserInput);
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    
    console.log(`   ✅ AI response generated in ${elapsed}s:`);
    console.log("\n   " + "─".repeat(70));
    console.log(`   AI GENERATED CLAUSE:`);
    console.log("   " + "─".repeat(70));
    console.log(clauseText.split("\n").map(l => "   " + l).join("\n"));
    console.log("   " + "─".repeat(70));
    
    // Evaluate against market standards
    const hasPakistanRef = /Pakistan/i.test(clauseText);
    const hasCapRef = /(limit|cap|maximum|liability|indemnify)/i.test(clauseText);
    const marketCheck = [
      { check: "Cites Pakistani legal context", pass: hasPakistanRef },
      { check: "Defines limitation of liability caps clearly", pass: hasCapRef },
      { check: "Excludes indirect/consequential damages (Market standard)", pass: /(indirect|consequential|incidental|punitive)/i.test(clauseText) }
    ];

    let passCount = 0;
    for (const c of marketCheck) {
      console.log(`   ${c.pass ? "✅" : "❌"} Market Standard: ${c.check}`);
      if (c.pass) passCount++;
    }
    console.log(`   📊 Quality Score: ${((passCount / marketCheck.length) * 100).toFixed(0)}%`);
  } catch (err: any) {
    console.error("   ❌ AI Fallback Generation failed:", err.message);
  }


  // ─── TEST 4: Contract Risk & Compliance Scan ──────────────────────────
  console.log("\n📋 Test 4: Contract Risk & Compliance Scan...");
  const scanSystemInstruction = `You are a legal drafting risk scanner for Pakistani legal documents.
TASK:
Analyze the user's draft and identify drafting, enforceability, compliance, ambiguity, and dispute-risk issues.

OUTPUT FORMAT (STRICT):
Return ONLY valid JSON with this exact shape:
{
  "risks": [
    {
      "id": "short-stable-id",
      "title": "Short risk title",
      "detail": "1-2 sentence explanation of risk",
      "severity": "warning" | "danger",
      "prompt": "A direct instruction to generate a corrective clause"
    }
  ]
}
RULES:
- Return 0 to 8 risks.
- Use "danger" only for high-impact issues (enforceability/invalidity/major litigation exposure).
- Use "warning" for medium/low risks.
- Keep each detail concise and specific to the draft text.
- Do not include markdown, code fences, or extra keys.`;

  const scanUserInput = `Draft Title: MUTUAL SERVICE AGREEMENT\n\nDraft Content:\n${SAMPLE_FLAWED_CONTRACT}`;

  try {
    const started = Date.now();
    const rawScanJson = await callAI(scanSystemInstruction, scanUserInput);
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);

    console.log(`   ✅ Scan response generated in ${elapsed}s:`);
    console.log("\n   " + "─".repeat(70));
    console.log(`   AI RISK ANALYSIS RESULT (JSON):`);
    console.log("   " + "─".repeat(70));
    console.log(rawScanJson.split("\n").map(l => "   " + l).join("\n"));
    console.log("   " + "─".repeat(70));

    // Parse and validate compliance with strict output format
    let cleanJsonStr = rawScanJson.trim();
    if (cleanJsonStr.startsWith("```json")) {
      cleanJsonStr = cleanJsonStr.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleanJsonStr.startsWith("```")) {
      cleanJsonStr = cleanJsonStr.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const scanData = JSON.parse(cleanJsonStr);
    
    // Evaluate quality against market standards
    console.log("\n   📊 SCAN COMPLIANCE CHECKLIST:");
    const hasRisks = Array.isArray(scanData.risks);
    const foundIndemnityDanger = scanData.risks?.some((r: any) => 
      r.severity === "danger" && /indemnity|liability|cap/i.test(r.title + " " + r.detail)
    );
    const foundMissingDisputeWarning = scanData.risks?.some((r: any) => 
      /dispute|arbitration/i.test(r.title + " " + r.detail)
    );
    const foundTermDurationWarning = scanData.risks?.some((r: any) => 
      /term|termination|duration|indefinite/i.test(r.title + " " + r.detail)
    );

    const scanChecks = [
      { check: "Valid JSON schema with 'risks' array", pass: hasRisks },
      { check: "Identifies risk of unlimited/uncapped indemnity (marked as 'danger')", pass: foundIndemnityDanger },
      { check: "Identifies omission of Dispute Resolution / Arbitration clause", pass: foundMissingDisputeWarning },
      { check: "Identifies risk of indefinite term / lack of termination convenience", pass: foundTermDurationWarning }
    ];

    let scanPassCount = 0;
    for (const c of scanChecks) {
      console.log(`   ${c.pass ? "✅" : "❌"} Market Standard: ${c.check}`);
      if (c.pass) scanPassCount++;
    }
    console.log(`   📊 Scan Quality Score: ${((scanPassCount / scanChecks.length) * 100).toFixed(0)}%`);

  } catch (err: any) {
    console.error("   ❌ Contract Risk Scan failed:", err.message);
  }

  console.log("\n" + "═".repeat(80));
}

runTests().catch(e => {
  console.error("Fatal test runner crash:", e);
  process.exit(1);
});
