import "../server/load-env";
import { gatherKnowledgeContextV2 } from "../server/pipeline/knowledge-pipeline";
import { pool } from "../server/db";

async function testModuleRAG(moduleName: string, query: string) {
  console.log(`\n======================================================================`);
  console.log(`📂 TESTING MODULE: ${moduleName.toUpperCase()}`);
  console.log(`⚖️  PROMPT/QUERY: "${query}"`);
  console.log(`======================================================================`);

  const t0 = Date.now();
  try {
    const context = await gatherKnowledgeContextV2(query, "global-admin-judgments");
    const duration = Date.now() - t0;

    console.log(`⏱️  Enrichment Latency: ${duration}ms`);
    console.log(`📏 Context Length: ${context.length} characters`);
    
    // Check if context contains section titles
    const hasStatutes = context.includes("VERIFIED STATUTES");
    const hasJudgments = context.includes("VERIFIED JUDGMENTS");
    console.log(`📚 Contains Verified Statutes: ${hasStatutes ? "YES" : "NO"}`);
    console.log(`🏛️  Contains Verified Judgments: ${hasJudgments ? "YES" : "NO"}`);

    console.log(`\n📄 CONTEXT PREVIEW (First 800 chars):`);
    console.log(context.slice(0, 800) + "...\n");
  } catch (err: any) {
    console.error(`❌ Error testing ${moduleName}:`, err.message);
  }
}

async function main() {
  // Test Legal Drafting Module RAG
  await testModuleRAG(
    "Legal Drafting (Court Pleadings)",
    "Draft a constitutional writ petition under Article 199 of the Constitution of Pakistan to challenge an illegal eviction notice issued by the Cantonment Board."
  );

  // Test Contract Drafting Module RAG
  await testModuleRAG(
    "Contract Drafting (Agreements)",
    "Draft a commercial lease agreement for a retail shop in Lahore under the Punjab Rented Premises Ordinance 2009 with security deposit and 10% annual escalation."
  );

  await pool.end();
}

main().catch(console.error);
