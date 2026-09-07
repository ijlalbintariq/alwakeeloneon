import { db } from './server/db';
import { judgments, caseLaw } from './shared/schema';
import { inArray, eq, sql } from 'drizzle-orm';

async function run() {
  console.log("Fetching suspicious judgments...");
  const allJ = await db.select({ 
    id: judgments.id, 
    citation: judgments.citationString, 
    title: judgments.title,
    page: judgments.page 
  }).from(judgments);
  
  const suspicious = allJ.filter(j => j.page > 50000);
  console.log(`Found ${suspicious.length} suspicious judgments.`);

  const updates = [];
  
  for (const j of suspicious) {
    const titleMatch = j.title.match(/^(.*?)\s*\(/);
    if (!titleMatch) continue;
    
    let caseNumber = titleMatch[1].trim();
    
    // Extract court abbreviation from the fake citation (e.g. "2026 SHC 515001" -> "SHC")
    const courtMatch = j.citation.match(/\d+\s+([A-Z]+)\s+\d+/);
    const courtAbbr = courtMatch ? courtMatch[1] : "Unreported";
    
    const newCitation = `${caseNumber} (${courtAbbr})`;
    
    updates.push({
      id: j.id,
      oldCitation: j.citation,
      newCitation: newCitation
    });
  }
  
  console.log(`Prepared ${updates.length} updates. Preview of first 10:`);
  console.log(updates.slice(0, 10));
  
  // Apply updates to judgments table in batches
  const batchSize = 100;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async u => {
      // Update judgments table
      await db.update(judgments)
        .set({ citationString: u.newCitation })
        .where(eq(judgments.id, u.id));
        
      // Update case_law table (using the same old citation matching)
      await db.update(caseLaw)
        .set({ citation: u.newCitation })
        .where(eq(caseLaw.citation, u.oldCitation));
    }));
    console.log(`Updated ${Math.min(i + batchSize, updates.length)} / ${updates.length}`);
  }
  
  console.log("Finished updating citations!");
  process.exit(0);
}
run();
