import "../server/load-env";
import { storage } from "../server/storage";
import { pool } from "../server/db";

async function main() {
  const q1 = "Order XLI Rule 19";
  const r1 = await storage.searchStatutes(q1, 25);
  console.log(`Query: "${q1}", found: ${r1.length} rows`);
  for (const r of r1) {
    console.log(` - ${r.shortTitle} | ${r.section}`);
  }

  const q2 = "Order XXXIX Rule 1";
  const r2 = await storage.searchStatutes(q2, 25);
  console.log(`Query: "${q2}", found: ${r2.length} rows`);
  for (const r of r2) {
    console.log(` - ${r.shortTitle} | ${r.section}`);
  }

  await pool.end();
}

main().catch(console.error);
