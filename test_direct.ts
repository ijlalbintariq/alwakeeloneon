import { db } from './server/db';
import { caseLaw, judgments } from './shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from './server/storage';

async function main() {
  const caseLawEntry = await db.select().from(caseLaw).where(eq(caseLaw.citation, "1995 SCMR 1345")).limit(1).then(res => res[0]);
  
  if (!caseLawEntry) {
    console.log("No case_law found.");
    process.exit(1);
  }
  
  console.log("Executing fallback logic for ID:", caseLawEntry.id);
  
  let detail;
  if (caseLawEntry.citation) {
    console.log("Found citation in case_law:", caseLawEntry.citation);
    const [realJudgment] = await db.select({ id: judgments.id }).from(judgments).where(eq(judgments.citationString, caseLawEntry.citation)).limit(1);
    
    if (realJudgment) {
      console.log("Resolved real judgments UUID:", realJudgment.id);
      detail = await storage.getJudgmentDetail(realJudgment.id);
    }
  }

  if (detail) {
    console.log("Fallback succeeded. Returned payload keys:", Object.keys(detail));
    console.log("Made:", detail.citations?.made?.length);
    console.log("Received:", detail.citations?.received?.length);
  } else {
    console.log("Fallback failed to find detail.");
  }
  process.exit(0);
}

main().catch(console.error);
