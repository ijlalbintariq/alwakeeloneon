import { db } from "./server/db";
import { citationLinks } from "./shared/schema";
import { count } from "drizzle-orm";

async function main() {
  const [res1] = await db.select({ cnt: count(citationLinks.id) }).from(citationLinks);
  console.log("Total links right now:", res1.cnt);
  process.exit(0);
}
main().catch(console.error);
