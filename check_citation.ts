import { db } from './server/db';
import { judgments, caseLaw } from './shared/schema';
import { eq, ilike } from 'drizzle-orm';

async function run() {
  const j = await db.select().from(judgments).where(eq(judgments.citationString, '2026 SHC 515001'));
  console.log("Judgments:", j.map(x => ({ id: x.id, title: x.title, citation: x.citationString })));
  
  const c = await db.select().from(caseLaw).where(ilike(caseLaw.citation, '%2026 SHC 515001%'));
  console.log("CaseLaw:", c.map(x => ({ id: x.id, title: x.title, citation: x.citation })));
  
  // Find how many neutral citations look like this
  const allJ = await db.select({ citation: judgments.citationString, title: judgments.title }).from(judgments).where(ilike(judgments.citationString, '%SHC 515%'));
  console.log("Other SHC 515... cases:", allJ.length, allJ.slice(0, 5));
  process.exit(0);
}
run();
