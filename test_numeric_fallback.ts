import { db } from './server/db';
import { caseLaw } from './shared/schema';
import { eq } from 'drizzle-orm';
import fetch from 'node-fetch';

async function main() {
  console.log("1. Finding case_law entry for '1995 SCMR 1345'...");
  const [caseLawEntry] = await db.select().from(caseLaw).where(eq(caseLaw.citation, "1995 SCMR 1345")).limit(1);
  
  if (!caseLawEntry) {
    console.error("Could not find '1995 SCMR 1345' in case_law table.");
    process.exit(1);
  }
  
  console.log(`Found case_law entry: ID = ${caseLawEntry.id}`);
  
  console.log(`2. Hitting API GET /api/judgments/${caseLawEntry.id}...`);
  // Note: we might need a dummy session cookie if it requires auth, but let's try.
  // We can bypass auth in our test by just calling the route function directly if needed,
  // but let's try the HTTP endpoint first.
  const res = await fetch(`http://localhost:5001/api/judgments/${caseLawEntry.id}`);
  
  if (res.status === 401) {
    console.log("API requires auth. I will test the logic directly.");
  } else {
    const data = await res.json();
    console.log("API Response Keys:", Object.keys(data));
    if (data.citations) {
      console.log("Citations Made:", data.citations.made?.length);
      console.log("Citations Received:", data.citations.received?.length);
    } else {
      console.log("ERROR: citations object is missing!");
    }
  }
  
  process.exit(0);
}

main().catch(console.error);
