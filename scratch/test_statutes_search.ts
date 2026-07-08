import "../server/load-env";
import { storage } from "../server/storage";

async function main() {
  console.log("Testing searchStatutes with complex query...\n");

  // Test 1: The query that was returning 0 statutes
  const query1 = "co-sharer ancestral agricultural land punjab partition construction";
  console.log(`Query: "${query1}"`);
  const results1 = await storage.searchStatutes(query1, 10);
  console.log(`Results: ${results1.length}`);
  results1.forEach((r, i) => {
    console.log(`  ${i+1}. [${r.shortTitle}] Section ${r.section}: ${r.description.slice(0, 100)}...`);
  });

  // Test 2: Contract breach query
  console.log("\n---\n");
  const query2 = "breach of contract construction company damages refund specific performance";
  console.log(`Query: "${query2}"`);
  const results2 = await storage.searchStatutes(query2, 10);
  console.log(`Results: ${results2.length}`);
  results2.forEach((r, i) => {
    console.log(`  ${i+1}. [${r.shortTitle}] Section ${r.section}: ${r.description.slice(0, 100)}...`);
  });

  // Test 3: Transfer of Property Act
  console.log("\n---\n");
  const query3 = "transfer of property joint ownership undivided share";
  console.log(`Query: "${query3}"`);
  const results3 = await storage.searchStatutes(query3, 10);
  console.log(`Results: ${results3.length}`);
  results3.forEach((r, i) => {
    console.log(`  ${i+1}. [${r.shortTitle}] Section ${r.section}: ${r.description.slice(0, 100)}...`);
  });
}

main().catch(console.error);
