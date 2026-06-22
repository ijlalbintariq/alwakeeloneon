import fs from "fs";

// Load DEEPSEEK_API_KEY from .env
const env = fs.readFileSync(".env", "utf8");
const deepseekMatch = env.match(/DEEPSEEK_API_KEY=(.*)/);
const DEEPSEEK_API_KEY = deepseekMatch ? deepseekMatch[1].trim() : null;

if (!DEEPSEEK_API_KEY) {
  console.error("❌ DEEPSEEK_API_KEY not found in .env");
  process.exit(1);
}

const prompt = `You are drafting a formal Pakistani legal contract.

Contract Type: Service Agreement
Document Title: Software Development Service Agreement
First Party: TechCorp (Pvt) Ltd.
Second Party: Ali Ahmed
Effective Date: 2026-07-01
Termination Notice: 30 Days
Jurisdiction: Lahore
Specific Obligations: Development of a custom CRM system over 6 months with monthly milestone payments.

Instructions:
1. Draft a complete, professional contract for Pakistani legal practice.
2. Use clear heading structure and clause numbering.
3. Include mandatory clauses: scope, consideration/payment, term, termination, confidentiality, indemnity, dispute resolution, governing law/jurisdiction, notices, and signatures.
4. Keep unknown details as placeholders in square brackets.
5. Return only contract text, no markdown fences, no extra commentary.`;

async function runTest() {
  console.log("🚀 Running Contract Drafting Test on Production AI Provider (DeepSeek)...\n");
  
  const startTime = Date.now();
  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      })
    });

    if (!response.ok) {
        throw new Error(`API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const result = data.choices[0].message.content;
    const latency = Date.now() - startTime;

    console.log("================ OUTPUT DRAFT ================");
    console.log(result);
    console.log("==============================================\n");

    console.log("📊 SCORING RESULTS:");
    console.log("-------------------");
    console.log(`⏱️ Latency: ${latency}ms`);
    console.log(`📏 Length: ${result.length} characters`);
    
    let score = 0;
    const checks = [
      { name: "Scope of Services", test: /scope/i },
      { name: "Consideration / Payment", test: /payment|consideration|milestone/i },
      { name: "Term / Duration", test: /term|duration|6 months/i },
      { name: "Termination", test: /terminat/i },
      { name: "Confidentiality", test: /confidential/i },
      { name: "Indemnity", test: /indemni/i },
      { name: "Dispute Resolution (Arbitration)", test: /dispute|arbitration/i },
      { name: "Governing Law (Pakistan/Lahore)", test: /pakistan|lahore/i },
      { name: "Notices", test: /notice/i },
      { name: "Signatures", test: /signature|witness/i },
      { name: "No Markdown Fences", test: (text) => !text.includes("```") },
    ];

    checks.forEach(check => {
      const passed = typeof check.test === "function" ? check.test(result) : check.test.test(result);
      if (passed) score++;
      console.log(`${passed ? '✅' : '❌'} ${check.name}`);
    });

    console.log(`\n🏆 Final Score: ${score}/${checks.length} (${Math.round(score/checks.length*100)}%)`);

  } catch (err) {
    console.error("Test failed:", err);
  }
}

runTest();
