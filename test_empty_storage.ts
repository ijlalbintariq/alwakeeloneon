import { storage } from './server/storage';
import { db } from './server/db';

async function main() {
  console.log("Testing searchJudgmentsByKeywords('') fallback...");
  const judgmentsHits = await storage.searchJudgmentsByKeywords("");
  console.log("Top 3 judgments table hits:");
  for (const h of judgmentsHits.slice(0, 3)) {
    console.log(`- ${h.citation} | Year extracted: ${h.citation.split(' ')[0]} | Title: ${h.title}`);
  }
  
  console.log("\nTesting searchCaseLaw('') fallback...");
  const caseLawHits = await storage.searchCaseLaw("");
  console.log("Top 3 case_law table hits:");
  for (const h of caseLawHits.slice(0, 3)) {
    console.log(`- ${h.citation} | Year extracted: ${h.citation.split(' ')[0]} | Title: ${h.title}`);
  }
  
  process.exit(0);
}
main().catch(console.error);
