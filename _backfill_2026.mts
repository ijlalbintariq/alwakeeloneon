import { db } from './server/db.js';
import { caseLaw, judgments, lawJournals, courtsRef } from './shared/schema.js';
import { eq, and, sql } from 'drizzle-orm';

async function main() {
  console.log("Fetching 2026 judgments via Drizzle...");
  
  const results = await db
    .select({
      id: judgments.id,
      year: judgments.year,
      page: judgments.page,
      citationString: judgments.citationString,
      title: judgments.title,
      petitioner: judgments.petitioner,
      respondent: judgments.respondent,
      headnotes: judgments.headnotes,
      fullTextHead: sql<string>`LEFT(${judgments.fullText}, 1500)`,
      courtName: courtsRef.name,
      courtSnapshot: judgments.courtNameSnapshot,
      journalCode: lawJournals.code,
    })
    .from(judgments)
    .leftJoin(lawJournals, eq(judgments.journalId, lawJournals.id))
    .leftJoin(courtsRef, eq(judgments.courtId, courtsRef.id))
    .where(
      and(
        eq(judgments.year, 2026),
        eq(judgments.isActive, true)
      )
    );
    
  console.log(`Found ${results.length} 2026 judgments.`);
  if (results.length === 0) process.exit(0);

  // Fetch existing case_law 2026
  const existing = await db.select({ citation: caseLaw.citation }).from(caseLaw).where(eq(caseLaw.citationYear, 2026));
  const existingSet = new Set(existing.map(e => e.citation));
  console.log(`Already in case_law for 2026: ${existingSet.size}`);

  const toInsert = [];
  for (const r of results) {
    if (!r.citationString) continue;
    if (existingSet.has(r.citationString)) continue;

    let courtStr = (r.courtName || r.courtSnapshot || '').trim();
    if (!courtStr) courtStr = 'Unknown Court';
    
    const parties = [r.petitioner, r.respondent].filter(Boolean).join(" vs ");
    let titleStr = (r.title || '').trim();
    if (!titleStr || titleStr.toLowerCase().includes('placeholder') || titleStr === `Case ${r.citationString}`) {
      titleStr = parties || `Case ${r.citationString}`;
    }
    
    let summaryStr = (r.headnotes || '').trim();
    if (!summaryStr || summaryStr.length < 10) {
       summaryStr = (r.fullTextHead || '').substring(0, 1000).trim();
    }
    
    toInsert.push({
      citation: r.citationString,
      citationYear: r.year,
      citationReport: r.journalCode || null,
      citationPage: r.page || null,
      citationRole: "primary",
      court: courtStr,
      title: titleStr.substring(0, 255),
      summary: summaryStr || 'No summary available.',
      keywords: [],
      sourceType: "judgment",
      sourceDocId: null,
      documentClassification: "case_law",
      fallbackExtraction: false
    });
  }

  console.log(`Need to backfill ${toInsert.length} records.`);
  
  if (toInsert.length > 0) {
    let inserted = 0;
    const BATCH_SIZE = 50;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      await db.insert(caseLaw).values(batch);
      inserted += batch.length;
      console.log(`Inserted ${inserted}/${toInsert.length}`);
    }
  }
  console.log("Done.");
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
