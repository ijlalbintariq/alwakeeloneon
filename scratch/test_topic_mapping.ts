import "../server/load-env";
import { classifyQueryIntent } from "../server/pipeline/intent-classifier";
import { storage } from "../server/storage";

// Simulate what fetchStatutes does with the new topic mapping
const TOPIC_STATUTE_MAP: Record<string, string[]> = {
  "contract": ["Contract Act 1872", "Specific Relief Act 1877"],
  "property": ["Transfer of Property Act 1882", "West Pakistan Land Revenue Act 1967", "Specific Relief Act 1877"],
  "partition-suit": ["The Punjab Partition of Immovable Property Act 2012", "West Pakistan Land Revenue Act 1967", "Specific Relief Act 1877", "Transfer of Property Act 1882"],
};

async function main() {
  // Test 1: Partition query
  const q1 = "I am a co-sharer in an ancestral agricultural land in Punjab one of the other co-sharers has sold his specific portion to an outsider without partition";
  const intent1 = classifyQueryIntent(q1);
  console.log("=== Query 1: Partition ===");
  console.log("Detected topics:", intent1.topics.map(t => t.id));
  
  const titles1 = new Set<string>();
  for (const topic of intent1.topics) {
    const titles = TOPIC_STATUTE_MAP[topic.id];
    if (titles) titles.forEach(t => titles1.add(t));
  }
  console.log("Mapped statute titles:", Array.from(titles1));
  
  for (const title of titles1) {
    const rows = await storage.searchStatutes(title, 5);
    console.log(`\n  [${title}] → ${rows.length} results:`);
    rows.forEach((r, i) => console.log(`    ${i+1}. Section ${r.section}: ${r.description.slice(0, 80)}...`));
  }

  // Test 2: Contract breach query
  console.log("\n\n=== Query 2: Contract Breach ===");
  const q2 = "breach of contract construction company damages refund specific performance";
  const intent2 = classifyQueryIntent(q2);
  console.log("Detected topics:", intent2.topics.map(t => t.id));
  
  const titles2 = new Set<string>();
  for (const topic of intent2.topics) {
    const titles = TOPIC_STATUTE_MAP[topic.id];
    if (titles) titles.forEach(t => titles2.add(t));
  }
  console.log("Mapped statute titles:", Array.from(titles2));
  
  for (const title of titles2) {
    const rows = await storage.searchStatutes(title, 5);
    console.log(`\n  [${title}] → ${rows.length} results:`);
    rows.forEach((r, i) => console.log(`    ${i+1}. Section ${r.section}: ${r.description.slice(0, 80)}...`));
  }
}

main().catch(console.error);
