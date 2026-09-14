import { db } from "./server/db";
import { citationLinks } from "./shared/schema";
import { count } from "drizzle-orm";

async function main() {
  const [res1] = await db.select({ cnt: count(citationLinks.id) }).from(citationLinks);
  const start = Date.now();
  console.log("Start Count:", res1.cnt);
  
  await new Promise(r => setTimeout(r, 60000)); // wait exactly 60 seconds
  
  const [res2] = await db.select({ cnt: count(citationLinks.id) }).from(citationLinks);
  const end = Date.now();
  console.log("End Count:", res2.cnt);
  console.log(`Speed: ${Number(res2.cnt) - Number(res1.cnt)} links per minute`);
  process.exit(0);
}
main().catch(console.error);
