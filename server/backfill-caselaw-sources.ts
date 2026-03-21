import { db } from "./db";
import { caseLaw, githubKnowledge, adminKnowledge } from "../shared/schema";
import { sql, inArray } from "drizzle-orm";

export async function backfillCaseLawSources() {
  console.log("[Backfill] Starting case law source document linking...");

  const unlinkedCount = await db.select({ count: sql<number>`count(*)` })
    .from(caseLaw)
    .where(sql`source_doc_id IS NULL`);

  if (Number(unlinkedCount[0].count) === 0) {
    console.log("[Backfill] All case law entries already have source links.");
    return;
  }

  console.log(`[Backfill] Found ${unlinkedCount[0].count} unlinked case law entries.`);

  const ghDocs = await db.select({
    id: githubKnowledge.id,
    filename: githubKnowledge.filename,
    content: githubKnowledge.content,
  }).from(githubKnowledge);

  const akDocs = await db.select({
    id: adminKnowledge.id,
    filename: adminKnowledge.filename,
    content: adminKnowledge.content,
  }).from(adminKnowledge);

  console.log(`[Backfill] Processing ${ghDocs.length} GitHub docs, ${akDocs.length} admin docs...`);

  let totalLinked = 0;

  for (let i = 0; i < ghDocs.length; i++) {
    const doc = ghDocs[i];
    if (!doc.content || doc.content.length < 10) continue;

    const citations = extractCitationsFromDoc(doc.content);
    if (citations.length === 0) continue;

    let docLinked = 0;
    for (let j = 0; j < citations.length; j += 50) {
      const batch = citations.slice(j, j + 50);
      const conditions = batch.map(c => sql`citation ILIKE ${'%' + c + '%'}`);
      const whereClause = sql.join(conditions, sql` OR `);

      const result = await db.execute(sql`
        UPDATE case_law 
        SET source_doc_id = ${doc.id}, source_type = 'github', source_filename = ${doc.filename}
        WHERE source_doc_id IS NULL AND (${whereClause})
      `);
      docLinked += Number((result as any).rowCount || 0);
    }

    if (docLinked > 0) {
      totalLinked += docLinked;
    }

    if ((i + 1) % 20 === 0 || i === ghDocs.length - 1) {
      console.log(`[Backfill] GitHub docs: ${i + 1}/${ghDocs.length} processed, ${totalLinked} total entries linked`);
    }
  }

  for (let i = 0; i < akDocs.length; i++) {
    const doc = akDocs[i];
    if (!doc.content || doc.content.length < 10) continue;

    const citations = extractCitationsFromDoc(doc.content);
    if (citations.length === 0) continue;

    let docLinked = 0;
    for (let j = 0; j < citations.length; j += 50) {
      const batch = citations.slice(j, j + 50);
      const conditions = batch.map(c => sql`citation ILIKE ${'%' + c + '%'}`);
      const whereClause = sql.join(conditions, sql` OR `);

      const result = await db.execute(sql`
        UPDATE case_law 
        SET source_doc_id = ${doc.id}, source_type = 'admin', source_filename = ${doc.filename}
        WHERE source_doc_id IS NULL AND (${whereClause})
      `);
      docLinked += Number((result as any).rowCount || 0);
    }

    if (docLinked > 0) {
      totalLinked += docLinked;
      console.log(`[Backfill] Admin doc "${doc.filename}": linked ${docLinked} entries`);
    }
  }

  console.log(`[Backfill] Complete. Linked ${totalLinked} case law entries total.`);
}

function extractCitationsFromDoc(content: string): string[] {
  const citations: string[] = [];
  const seen = new Set<string>();
  const reportCodes = ["PLD", "SCMR", "CLC", "YLR", "MLD", "PCRLJ", "PLJ", "PSC", "PLC", "GBLR", "KLR", "SLR", "CLD", "PTD"];
  const reportPattern = reportCodes
    .map((code) => {
      const letters = code.replace(/[^A-Za-z]/g, "").split("");
      return letters.map((ch) => `${ch}\\.?`).join("\\s*");
    })
    .join("|");

  const patterns = [
    new RegExp(`(\\d{4}\\s+(?:${reportPattern})\\s+\\d+)`, "gi"),
    new RegExp(`((?:${reportPattern})\\s+\\d{4}\\s+(?:SC|Supreme Court|Lahore|Karachi|Peshawar|Islamabad|Sindh|Balochistan|Quetta|Federal Shariat|FSC)\\s+\\d+)`, "gi"),
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const citation = String(match[1] || "").trim().replace(/\s+/g, " ");
      if (!seen.has(citation)) {
        seen.add(citation);
        citations.push(citation);
      }
    }
  }

  return citations;
}
