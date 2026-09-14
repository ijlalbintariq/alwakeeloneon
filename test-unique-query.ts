import "./load-env";
import { gatherKnowledgeWithHits } from "./server/pipeline/knowledge-pipeline";

async function runUniqueTest() {
  console.log("=== UNIQUE TOPIC QUERY TEST (NARRATIVE) ===\n");
  
  // A highly nuanced narrative WITHOUT sections (forces Tier 2 LLM Expansion)
  const uniqueQuery = "A supplier took advance payment from me but failed to deliver the goods. Instead of filing a civil suit for recovery, I filed an FIR for criminal breach of trust. Can the supplier get this FIR quashed by arguing it's just a business dispute?";
  
  console.log(`Query: "${uniqueQuery}"\n`);
  
  const t0 = Date.now();
  try {
    const result = await gatherKnowledgeWithHits(uniqueQuery, "test-user");
    console.log(`⏱️ Pipeline Completed in: ${result.durationMs}ms\n`);
    
    console.log("=== 1. INTENT & EXPANSION ===");
    console.log(`Mapped Topics: ${result.topics.join(", ") || "None"}`);
    console.log(`Statutes Found: ${result.hasStatutes ? "Yes" : "No"}`);
    
    console.log("\n=== 2. RETRIEVAL RESULTS (Top 5) ===");
    if (result.caseLawHits.length === 0) {
      console.log("No case law retrieved.");
    } else {
      result.caseLawHits.slice(0, 5).forEach((hit, i) => {
        console.log(`[${i+1}] Court: ${hit.court || "Unknown"} | Citation: ${hit.citation || "N/A"}`);
        console.log(`    Title: ${hit.title}`);
      });
    }
  } catch (err) {
    console.error("Pipeline Error:", err);
  }
  process.exit(0);
}

runUniqueTest();
