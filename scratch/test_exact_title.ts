import "../server/load-env";
import { storage } from "../server/storage";

async function main() {
  // Test exact title match
  const titles = [
    "Transfer of Property Act 1882",
    "West Pakistan Land Revenue Act 1967",
    "Specific Relief Act 1877",
    "The Punjab Partition of Immovable Property Act 2012",
    "Contract Act 1872",
  ];

  for (const title of titles) {
    const rows = await storage.getStatutesByTitle(title, 5);
    console.log(`\n[${title}] → ${rows.length} sections:`);
    rows.forEach((r, i) => console.log(`  ${i+1}. Section ${r.section}: ${r.description.slice(0, 100)}...`));
  }
}

main().catch(console.error);
