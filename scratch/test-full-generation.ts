import "../server/load-env";
import { gatherKnowledgeContextV2 } from "../server/pipeline/knowledge-pipeline";
import { chatWithDeepSeek } from "../server/deepseek-ai";
import { getModuleProfile } from "../server/ai-module-profiles";
import { pool } from "../server/db";
import fs from "fs";
import path from "path";

// A mock version of getLegalSystemPrompt from routes.ts
function getMockLegalSystemPrompt(): string {
  return `You are Al Wakeelo AI, an expert legal AI assistant specializing in Pakistani law. 
Provide professional, legally sound, and structured responses based on Pakistani statutes and case law. 
Strictly restrict your legal analysis, citations, and recommendations to Pakistani law only.`;
}

async function generateDraft(moduleType: "draft" | "contract-drafting", queryText: string, filename: string) {
  console.log(`\n======================================================================`);
  console.log(`🚀 GENERATING FOR MODULE: ${moduleType.toUpperCase()}`);
  console.log(`⚖️  QUERY: "${queryText}"`);
  console.log(`======================================================================`);

  try {
    // 1. Gather RAG context (using Voyage Law 2 + Reranker)
    console.log("🔍 Running Voyage RAG Retrieval...");
    const context = await gatherKnowledgeContextV2(queryText, "global-admin-judgments");
    console.log(`✅ RAG context gathered (${context.length} chars)`);

    // 2. Resolve Module Profile
    const profile = getModuleProfile(moduleType);

    // 3. Assemble Prompts
    const systemPrompt = `${getMockLegalSystemPrompt()}
    
MODULE PROFILE: ${profile.label}
${profile.systemPromptAddon}

${context}`;

    const userPrompt = `User Query:
${queryText}

Please generate the complete professional draft based on the profile constraints and retrieved reference materials.`;

    console.log("🤖 Requesting DeepSeek Completion...");
    const t0 = Date.now();
    const result = await chatWithDeepSeek({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      maxTokens: 4000,
      temperature: 0.2
    });
    const duration = Date.now() - t0;
    console.log(`✅ Completed in ${duration}ms (model: ${result.model})`);

    // 4. Save Output to File
    const outputPath = path.join("/Users/macbook/Downloads/Alwakeelo/scratch", filename);
    fs.writeFileSync(outputPath, result.content, "utf8");
    console.log(`💾 Saved draft to: ${outputPath}`);

    return result.content;
  } catch (err: any) {
    console.error(`❌ Generation failed:`, err.message);
    return null;
  }
}

async function main() {
  // 1. Run Legal Drafting (Writ Petition)
  await generateDraft(
    "draft",
    "Draft a constitutional writ petition under Article 199 of the Constitution of Pakistan to challenge an illegal eviction notice issued by the Cantonment Board.",
    "eviction_writ_petition.txt"
  );

  // 2. Run Contract Drafting (Lease Agreement)
  await generateDraft(
    "contract-drafting",
    "Draft a commercial lease agreement for a retail shop in Lahore under the Punjab Rented Premises Ordinance 2009 with security deposit and 10% annual escalation.",
    "commercial_lease_agreement.txt"
  );

  await pool.end();
}

main().catch(console.error);
