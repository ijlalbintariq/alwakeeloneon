import { db } from "./server/db";
import { citationLinks } from "./shared/schema";
import { count } from "drizzle-orm";

async function main() {
  const [res1] = await db.select({ cnt: count(citationLinks.id) }).from(citationLinks);
  const startCount = Number(res1.cnt);
  console.log("Start Count:", startCount);
  
  await new Promise(r => setTimeout(r, 10000));
  
  const [res2] = await db.select({ cnt: count(citationLinks.id) }).from(citationLinks);
  const endCount = Number(res2.cnt);
  console.log("End Count:", endCount);
  console.log(`Delta over 10s: ${endCount - startCount}`);
  process.exit(0);
}
main().catch(console.error);
