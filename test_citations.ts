import { db } from './server/db';
import { judgments, citationLinks } from './shared/schema';
import { eq, sql } from 'drizzle-orm';

async function main() {
  const count = await db.select({ count: sql<number>\`count(*)\` }).from(citationLinks);
  console.log("Total citation links in DB:", count[0].count);

  const sample = await db.select().from(citationLinks).limit(5);
  console.log("Sample citation links:", sample);
  process.exit(0);
}

main().catch(console.error);
