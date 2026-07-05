import "../server/load-env";
import { gatherKnowledgeContextV2 } from "../server/pipeline/knowledge-pipeline";
import { chatWithDeepSeek, chatWithDeepSeekPro } from "../server/deepseek-ai";
import { getModuleProfile } from "../server/ai-module-profiles";
import { pool } from "../server/db";
import fs from "fs";
import path from "path";

// Extract system prompts
import { getLegalSystemPrompt } from "../server/routes";

async function runComparison() {
  const queryText = "Draft a Partnership Deed between three partners for a technology services startup in Lahore under the Partnership Act, 1932. The deed must specify capital contributions, profit/loss sharing ratio (40:30:30), authority of managing partner, dispute resolution via arbitration under the Arbitration Act, 1940, and conditions for retirement or dissolution.";

  console.log(`\n======================================================================`);
  console.log(`⚖️  TESTING CONTRACTING MODULE: COMPARISON`);
  console.log(`📝 Query: "${queryText}"`);
  console.log(`======================================================================`);

  // 1. Gather RAG context (using Voyage Law 2 + Reranker)
  console.log("🔍 Running Voyage RAG Retrieval...");
  const tStartRag = Date.now();
  const context = await gatherKnowledgeContextV2(queryText, "global-admin-judgments");
  console.log(`✅ RAG context gathered in ${Date.now() - tStartRag}ms (${context.length} chars)`);

  // 2. Resolve Module Profile & base prompt
  const profile = getModuleProfile("contract-drafting");

  // Retrieve CONTRACT_LAW_ADDON from routes.ts using a dynamic check or import.
  // Since we can't export inline constants easily without changing the file, let's define the addon content here to match routes.ts.
  const CONTRACT_LAW_ADDON = `

━━━ CONTRACT LAW DEEP ANALYSIS (TOPIC-SPECIFIC) ━━━

MANDATORY AREAS TO CHECK for commercial agreements and disputes:

**Contract Act, 1872**:
- **S.2(h) & S.10**: A contract must be enforceable by law and have (1) free consent, (2) competent parties, (3) lawful consideration, and (4) lawful object.
- **S.13-22 (Free Consent)**: Analyze if there is Coercion (S.15), Undue Influence (S.16), Fraud (S.17), Misrepresentation (S.18), or Mistake (S.20-22). Fraud or misrepresentation makes the contract voidable.
- **S.23 (Lawful Object/Consideration)**: Check if consideration is forbidden by law, defeats any law, is fraudulent, involves injury, or is opposed to public policy.
- **S.25 (No Consideration = Void)**: Exceptions: natural love/affection in writing and registered, promise to compensate for past services, or written promise to pay time-barred debt.
- **S.27 (Restraint of Trade)**: Any agreement restraining a person from exercising a lawful profession, trade, or business of any kind is VOID, except for sale of goodwill.
- **S.28 (Restraint of Legal Proceedings)**: Restraining a party from enforcing their rights via ordinary legal proceedings is VOID, except for arbitration clauses (Exceptions 1 & 2).
- **S.56 (Frustration / Force Majeure)**: Contract becomes void if the act becomes impossible or unlawful after the contract is made. If a force majeure clause is present, it governs instead of S.56.
- **S.73 (Compensation for Breach)**: Standard damages are compensatory (natural consequences of breach), NOT remote or indirect. Liquidated damages under **S.74** must be a genuine pre-estimate of loss, and courts will only award reasonable compensation up to the specified amount (no penalties).

**Specific Relief Act, 1877**:
- **S.12**: Contracts that can be specifically enforced (e.g. sale of land where pecuniary compensation is not an adequate relief).
- **S.21**: Contracts that CANNOT be specifically enforced (e.g., contracts for personal services, contracts dependent on personal qualifications, contracts with minute/numerous details).

**Arbitration Act, 1940**:
- **S.34**: Stay of legal proceedings in the presence of an arbitration clause. Party must apply for stay *before* filing written statement.

**Doctrine of Privity of Contract**:
- Only parties to a contract can sue or be sued under it. Exceptions: trust, family arrangements, agency.
`;

  const systemPrompt = `You are Al Wakeelo AI, an expert legal AI assistant specializing in Pakistani law. 
Provide professional, legally sound, and structured responses based on Pakistani statutes and case law. 
Strictly restrict your legal analysis, citations, and recommendations to Pakistani law only.

MODULE PROFILE: ${profile.label}
${profile.systemPromptAddon}

${CONTRACT_LAW_ADDON}

━━━ CONTRACT DRAFTING SPECIAL RULES (OVERRIDES ALL PREVIOUS RULES) ━━━
- You are drafting a contract or agreement. Do NOT follow the CASE LAW RULES, STATUTE RULES, or CITATION INTEGRITY guidelines.
- Do NOT output any "VERIFIED JUDGMENTS", "VERIFIED STATUTES", or references analysis/commentary in the main response.
- Do NOT include the "REFERENCES BLOCK" (the \`\`\`references JSON block) at the end of your response.
- Return ONLY the clean, structured contract/agreement text or direct answers to contract questions, with no conversational preambles, introductions, or closing remarks.

${context}`;

  const userPrompt = `User Query:
${queryText}

Please generate the complete professional draft based on the profile constraints, the Contract Act 1872 guidelines, and retrieved reference materials.`;

  // Test Model 1: deepseek-v4-flash
  console.log("\n🤖 Running Test on Model 1: deepseek-v4-flash...");
  const t0 = Date.now();
  let flashOutput = "";
  try {
    const result = await chatWithDeepSeek({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      maxTokens: 8192,
      temperature: 0.3
    });
    const duration = Date.now() - t0;
    flashOutput = result.content;
    console.log(`✅ deepseek-v4-flash completed in ${duration}ms (output size: ${flashOutput.length} chars)`);
    fs.writeFileSync(path.join(process.cwd(), "scratch/contract_flash_output.txt"), flashOutput, "utf8");
  } catch (err: any) {
    console.error("❌ deepseek-v4-flash failed:", err.message);
  }

  // Test Model 2: deepseek-v4-pro
  console.log("\n🤖 Running Test on Model 2: deepseek-v4-pro...");
  const t1 = Date.now();
  let proOutput = "";
  try {
    const result = await chatWithDeepSeekPro({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      maxTokens: 8192,
      temperature: 0.3
    });
    const duration = Date.now() - t1;
    proOutput = result.content;
    console.log(`✅ deepseek-v4-pro completed in ${duration}ms (output size: ${proOutput.length} chars)`);
    fs.writeFileSync(path.join(process.cwd(), "scratch/contract_pro_output.txt"), proOutput, "utf8");
  } catch (err: any) {
    console.error("❌ deepseek-v4-pro failed:", err.message);
  }

  await pool.end();
}

runComparison().catch(console.error);
