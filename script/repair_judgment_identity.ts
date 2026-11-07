/** Apply a reviewed source-backed plan. Defaults to a read-only preview.
 * node --import tsx script/repair_judgment_identity.ts --plan plan.json --backup before.json [--keyword-only] [--apply]
 */
import "../server/load-env";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile, open, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { Client } from "pg";
import { assessJudgmentIdentity, judgmentPdfUrl, normalizeCitation, courtIdentity, readJudgmentHeader, extractCitations, parseCitation, splitCitations, canonJournalCode, citationMatchesCourt, citationCourtQualifier, citationIdentifiesJudgment, citationSection } from "../server/citation-verify";
import { extractSubstantiveSummary, cleanCaseTitle } from "../server/storage";
import { citationExtractor } from "../server/services/citation-extractor";
import { cleanLegalDocumentText } from "../server/rag/text-cleaner";

type RecordRow = Record<string, any>;
export type Repair = {
  id: string; citation: string; expectedFingerprint: string;
  evidence: { path: string; sha256: string; url: string; scope: "full_judgment" | "identity_reference"; reviewedPages?: number[]; reviewedLines?: number[] }[];
  caseLawIds?: number[];
  sourceFile?: { id: number; sourceId: number; objectKey: string };
  changes: { citation?: string; title: string; petitioner: string; respondent: string | null; courtName?: string; courtId?: number | null; bench?: string | null; decisionDate?: string | null; pdfUrl?: string | null; fullTextPath?: string; fullTextSha256?: string };
};
export const sha256 = (value: string | Buffer) => crypto.createHash("sha256").update(value).digest("hex");
export const judgmentCourtScope = (row: RecordRow) => row.court_id !== null && row.court_id !== undefined
  ? `id:${row.court_id}` : `court:${String(row.court_name_snapshot || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")}`;

export function recordFingerprint(row: RecordRow): string {
  return sha256(JSON.stringify([row.id, row.year, row.journal_id, row.page, row.is_active, row.canonical_judgment_id, row.citation_section, row.citation_string, row.title, row.petitioner, row.respondent,
    row.court_name_snapshot, row.court_id, row.bench, row.decision_date, row.pdf_url, row.text_status, row.text_true_citation,
    row.full_text, row.formatted_text, row.headnotes]));
}

export async function verifySourceEvidence(evidence: Repair["evidence"]): Promise<void> {
  assert.ok(evidence.length, "Source evidence is required");
  for (const source of evidence) {
    assert.equal(new URL(source.url).protocol, "https:", "Source URL must use HTTPS");
    const locations = source.reviewedPages || source.reviewedLines;
    assert.ok(locations?.length && locations.every(location => Number.isInteger(location) && location > 0), "Reviewed source pages or lines are required");
    assert.equal(sha256(await readFile(source.path)), source.sha256, "Source evidence changed");
  }
}

export async function prepareRepair(row: RecordRow, repair: Repair): Promise<RecordRow> {
  assert.equal(row.id, repair.id, "Record ID changed");
  assert.ok(row.is_active !== false && !row.canonical_judgment_id, "A canonical repair cannot rewrite an archived duplicate");
  assert.equal(row.citation_string, repair.citation, "Citation changed");
  assert.equal(recordFingerprint(row), repair.expectedFingerprint, "Record changed since source review");
  await verifySourceEvidence(repair.evidence);
  const changes = repair.changes;
  const body = changes.fullTextPath ? await readFile(changes.fullTextPath, "utf8") : row.full_text;
  if (changes.fullTextPath) {
    assert.ok(repair.evidence.some(source => source.scope === "full_judgment"), "Replacing judgment text requires a complete source judgment");
    assert.equal(sha256(body), changes.fullTextSha256, "Replacement text changed");
  }
  if (changes.citation !== undefined) {
    assert.ok(changes.fullTextPath && repair.evidence.some(source => source.scope === "full_judgment"), "Citation corrections require the complete original source");
    assert.equal(body, row.full_text, "Citation reassignment cannot replace the case body");
    if (changes.citation !== row.citation_string) {
      assert.ok(splitCitations(readJudgmentHeader(body).reported || "").some(part => part.trim() === changes.citation!.trim()), "Corrected citation must be printed in the source header");
      const oldTitle = cleanCaseTitle(String(row.title).replace(/\b(?:JUDGMENT|Reported\s+As|Case\s+No)\b[\s\S]*$/i, "").trim());
      assert.equal(assessJudgmentIdentity({ citation: changes.citation, title: oldTitle, court: row.court_name_snapshot, opening: body, textStatus: "own" }).textIntegrity,
        "own", "Stored parties and court do not establish the same case under the source citation");
    }
  }
  assert.ok(row.text_status === "own" || changes.fullTextPath, "Unverified text requires a complete replacement source");
  if (changes.courtName !== undefined || changes.courtId !== undefined) {
    assert.ok(changes.fullTextPath && repair.evidence.some(source => source.scope === "full_judgment"), "Court corrections require the complete source judgment");
    assert.ok(changes.courtName && changes.courtId !== undefined, "Court corrections require a reviewed reference or explicit null");
  }
  assert.ok(changes.title.trim() && changes.petitioner.trim(), "A named party or entity is required");
  let decisionDate = row.decision_date;
  if (changes.decisionDate !== undefined) {
    decisionDate = null;
    if (changes.decisionDate !== null) {
      assert.match(changes.decisionDate, /^\d{4}-\d{2}-\d{2}$/);
      const date = new Date(`${changes.decisionDate}T00:00:00.000Z`);
      assert.equal(date.toISOString().slice(0, 10), changes.decisionDate, "Invalid decision date");
      decisionDate = date.toISOString();
    }
  }
  if (changes.pdfUrl) assert.equal(judgmentPdfUrl(changes.pdfUrl), changes.pdfUrl);
  const corrected = { ...row, citation_section: citationSection(changes.citation || row.citation_string) || "", citation_string: changes.citation === undefined ? row.citation_string : changes.citation, title: changes.title, petitioner: changes.petitioner, respondent: changes.respondent,
    court_name_snapshot: changes.courtName === undefined ? row.court_name_snapshot : changes.courtName,
    court_id: changes.courtId === undefined ? row.court_id : changes.courtId,
    bench: changes.bench === undefined ? row.bench : changes.bench,
    decision_date: decisionDate, full_text: body, formatted_text: null, headnotes: null,
    ai_summary: null, pdf_url: changes.pdfUrl === undefined ? row.pdf_url : changes.pdfUrl, text_status: "own", text_true_citation: null };
  assert.equal(assessJudgmentIdentity({ citation: corrected.citation_string, title: corrected.title,
    court: corrected.court_name_snapshot, opening: corrected.full_text, textStatus: corrected.text_status }).textIntegrity,
  "own", "Correction does not establish internal case identity");
  return corrected;
}

export function repairCitationReferences(row: RecordRow, journals: Set<string>) {
  const key = (value: { year: number; journal: string; page: number }) => `${value.year}|${value.journal}|${value.page}`;
  const own = new Set(splitCitations(readJudgmentHeader(row.full_text).reported || row.citation_string)
    .map(raw => parseCitation(raw, journals)).filter(Boolean).map(value => key(value!)));
  const seen = new Set<string>();
  return [...extractCitations(row.full_text), ...citationExtractor.extractFromText(row.full_text, row.id).map(item => item.rawCitation)].flatMap(raw => {
    const parsed = parseCitation(raw, journals);
    if (!parsed || own.has(key(parsed))) return [];
    const identity = `${key(parsed)}|${citationCourtQualifier(raw) || ""}|${citationSection(raw) || ""}`;
    if (seen.has(identity)) return [];
    seen.add(identity);
    const offset = row.full_text.indexOf(raw);
    return [{ source_id: row.id, raw, year: parsed.year, journal: parsed.journal, page: parsed.page,
      context: offset < 0 ? null : row.full_text.slice(Math.max(0, offset - 100), offset + raw.length + 100), offset: offset < 0 ? null : offset }];
  });
}

/** Reuse vectors only for unchanged excerpts supported by the corrected source. */
export function partitionSupportedRepairChunks(corrected: RecordRow[], chunks: RecordRow[]) {
  const normalize = (text: string) => String(text || "").replace(/\u0000/g, " ").replace(/\s+/g, " ").trim();
  const sources = new Map(corrected.map(row => [row.id, [normalize(row.full_text), normalize(cleanLegalDocumentText(row.full_text))]]));
  const keep: RecordRow[] = [], remove: RecordRow[] = [];
  for (const chunk of chunks) {
    const text = normalize(chunk.chunk_text), source = sources.get(String(chunk.metadata?.judgmentId || ""));
    assert.ok(source, "Chunk owner is outside the reviewed repair scope");
    (text && source?.some(body => body.includes(text)) ? keep : remove).push(chunk);
  }
  return { keep, remove };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const keywordOnly = args.includes("--keyword-only");
  const values = args.filter(arg => arg !== "--apply" && arg !== "--keyword-only");
  const options = new Map<string, string>();
  for (let i = 0; i < values.length; i += 2) {
    assert.ok(["--plan", "--backup"].includes(values[i]) && values[i + 1], "Use --plan path --backup path [--keyword-only] [--apply]");
    options.set(values[i], values[i + 1]);
  }
  const planPath = options.get("--plan"), backupPath = options.get("--backup");
  assert.ok(planPath && backupPath, "--plan and --backup are required");
  const plan = JSON.parse(await readFile(planPath, "utf8")) as { repairs: Repair[] };
  assert.ok(plan.repairs.length > 0 && plan.repairs.length <= 100, "Review at most 100 repairs per transaction");
  assert.equal(new Set(plan.repairs.map(repair => repair.id)).size, plan.repairs.length, "Duplicate repair IDs");
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000, query_timeout: 125000 });
  let transaction = false;
  let phase = "connect";
  try {
    await client.connect();
    await client.query(apply ? "BEGIN" : "BEGIN READ ONLY"); transaction = true;
    await client.query("SET LOCAL statement_timeout=120000");
    const lock = apply ? " FOR UPDATE" : "";
    const before = (await client.query(`SELECT * FROM judgments WHERE id=ANY($1::uuid[]) ORDER BY id${lock}`, [plan.repairs.map(repair => repair.id)])).rows;
    assert.equal(before.length, plan.repairs.length, "Missing judgment record");
    const journalRows = (await client.query("SELECT id,code FROM law_journals")).rows;
    const journalIds = new Map<string, number>(journalRows.map(row => [canonJournalCode(row.code), row.id]));
    for (const row of before) {
      const parsed = parseCitation(row.citation_string, new Set(journalIds.keys()));
      if (plan.repairs.find(repair => repair.id === row.id)!.changes.citation === undefined) assert.ok(parsed && row.year === parsed.year && row.page === parsed.page && row.journal_id === journalIds.get(parsed.journal), "Canonical numeric key conflicts with the stored citation");
    }
    const corrected = await Promise.all(before.map(row => prepareRepair(row, plan.repairs.find(repair => repair.id === row.id)!)));
    for (const row of corrected) if (plan.repairs.find(repair => repair.id === row.id)!.changes.citation !== undefined) {
      const key = parseCitation(row.citation_string, new Set(journalIds.keys()));
      assert.ok(key && journalIds.has(key.journal), "Unknown corrected citation key");
      row.year = key.year; row.journal_id = journalIds.get(key.journal); row.page = key.page;
    }
    const courts = (await client.query("SELECT id,name FROM courts_ref WHERE id=ANY($1::int[])", [[...new Set(corrected.map(row => row.court_id).filter(id => id !== null && id !== undefined))]])).rows;
    for (const row of corrected) if (row.court_id !== null && row.court_id !== undefined) {
      const court = courts.find(court => court.id === row.court_id);
      const identity = courtIdentity(String(row.court_name_snapshot || ""));
      assert.ok(court && (court.name.toLowerCase().trim() === String(row.court_name_snapshot).toLowerCase().trim()
        || (identity && courtIdentity(court.name) === identity)), "Court reference conflicts with the corrected source");
    }
    const rekeys = corrected.filter(row => plan.repairs.find(repair => repair.id === row.id)!.changes.citation !== undefined);
    if (rekeys.length) {
      const wanted = rekeys.map(row => ({year:row.year,journal_id:row.journal_id,page:row.page}));
      const occupied = (await client.query(`SELECT j.id,j.year,j.journal_id,j.page,j.court_id,j.court_name_snapshot,j.is_active,j.citation_section
        FROM judgments j JOIN jsonb_to_recordset($1::jsonb) AS p(year int,journal_id int,page int)
        ON j.year=p.year AND j.journal_id=p.journal_id AND j.page=p.page WHERE j.canonical_judgment_id IS NULL`,[JSON.stringify(wanted)])).rows;
      const planned = new Set<string>();
      for (const row of rekeys) {
        const key = `${row.year}|${row.journal_id}|${row.page}|${judgmentCourtScope(row)}|${row.citation_section}`;
        assert.ok(!planned.has(key), "Two repairs claim the same court citation"); planned.add(key);
        const others = occupied.filter(other => other.id !== row.id && other.year === row.year && other.journal_id === row.journal_id && other.page === row.page);
        assert.ok(!others.some(other => (judgmentCourtScope(other) === judgmentCourtScope(row) || (courtIdentity(String(other.court_name_snapshot || "")) && courtIdentity(String(other.court_name_snapshot || "")) === courtIdentity(String(row.court_name_snapshot || "")))) && other.citation_section === row.citation_section), "Corrected court citation is already occupied");
        assert.ok(!others.some(other => other.is_active) || (citationCourtQualifier(row.citation_string) || citationSection(row.citation_string)), "A colliding citation requires an explicit source court or reporter section");
      }
    }
    const variants = corrected.flatMap(row => normalizeCitation(row.citation_string));
    const indexWhere = "upper(regexp_replace(citation, '[^A-Za-z0-9]', '', 'g'))=ANY($1::text[])";
    phase = "read matching search rows";
    const explicitIds = plan.repairs.every(repair => repair.caseLawIds !== undefined)
      ? [...new Set(plan.repairs.flatMap(repair => repair.caseLawIds!))] : null;
    const indexRows = (await client.query(`SELECT * FROM case_law WHERE ${explicitIds ? "id=ANY($1::int[])" : indexWhere}${lock}`, [explicitIds || variants])).rows;
    const sourceFiles = plan.repairs.flatMap(repair => repair.sourceFile ? [repair.sourceFile] : []);
    const currentFiles = sourceFiles.length ? (await client.query(`SELECT id,admin_knowledge_id,object_key FROM admin_knowledge_files WHERE id=ANY($1::int[])${lock}`, [sourceFiles.map(file => file.id)])).rows : [];
    for (const file of sourceFiles) {
      const current = currentFiles.find(row => row.id === file.id);
      assert.ok(current && current.admin_knowledge_id === file.sourceId && current.object_key === file.objectKey, "Original source association changed");
    }
    const ids = before.map(row => row.id);
    const changedBodies = corrected.filter(row => row.full_text !== before.find(original => original.id === row.id)!.full_text);
    const citationChanged = corrected.filter(row => row.citation_string !== before.find(original => original.id === row.id)!.citation_string);
    const rebuiltBodies = corrected.filter(row => changedBodies.includes(row) || citationChanged.includes(row));
    const changedIds = rebuiltBodies.map(row => row.id);
    const incomingLinks = citationChanged.length ? (await client.query(`SELECT * FROM citation_links WHERE target_judgment_id=ANY($1::uuid[]) AND NOT(source_judgment_id=ANY($2::uuid[]))${lock}`, [citationChanged.map(row => row.id), changedIds])).rows : [];
    const invalidIncoming = incomingLinks.filter(link => {
      const target = corrected.find(row => row.id === link.target_judgment_id)!;
      return !citationIdentifiesJudgment(link.citation_text, { citation: target.citation_string, court: target.court_name_snapshot });
    });
    const judgeLinks = (await client.query(`SELECT * FROM judge_case_links WHERE judgment_id=ANY($1::uuid[])${lock}`, [ids])).rows;
    const oldLinks = changedIds.length ? (await client.query(`SELECT * FROM citation_links WHERE source_judgment_id=ANY($1::uuid[])${lock}`, [changedIds])).rows : [];
    const oldUnresolved = changedIds.length ? (await client.query(`SELECT * FROM unresolved_citations WHERE source_judgment_id=ANY($1::uuid[])${lock}`, [changedIds])).rows : [];
    phase = "read stale judgment chunks";
    // Judgment indexing uses this source ID and the existing tenant/source index.
    const sourceIds = ids.map(id => Math.abs(parseInt(id.replace(/-/g, "").slice(0, 8), 16)));
    const candidates = keywordOnly ? [] : (await client.query(`SELECT * FROM rag_documents WHERE user_id='global-admin-judgments' AND source_document_id=ANY($1::bigint[])${lock}`, [sourceIds])).rows;
    const candidateIds = candidates.map(row => row.id);
    const ragChunks = candidateIds.length ? (await client.query(`SELECT * FROM rag_chunks WHERE rag_document_id=ANY($1::bigint[]) AND metadata->>'judgmentId'=ANY($2::text[])${lock}`, [candidateIds, ids])).rows : [];
    const supported = partitionSupportedRepairChunks(corrected, ragChunks);
    const removedChunkIds = supported.remove.map(row => row.id);
    const dependentChunks = removedChunkIds.length ? (await client.query(`SELECT * FROM rag_chunks WHERE parent_chunk_id=ANY($1::bigint[])${lock}`, [removedChunkIds])).rows : [];
    const ragIds = [...new Set(ragChunks.map(row => row.rag_document_id))];
    const ragDocuments = candidates.filter(row => ragIds.includes(row.id));
    const cachePatterns = [...before, ...corrected].flatMap(row => [row.id, row.citation_string].map(value => `%${value.replace(/[\\%_]/g, "\\$&")}%`));
    const cacheWhere = "query_text ILIKE ANY($1::text[]) OR response ILIKE ANY($1::text[])";
    phase = "read stale cached responses";
    const caches = (await client.query(`SELECT * FROM query_cache WHERE ${cacheWhere}${lock}`, [cachePatterns])).rows;
    const preview = { mode: apply ? "apply" : "preview", keywordOnly, repairs: corrected.map(row => ({ id: row.id, citation: row.citation_string, title: row.title, decisionDate: row.decision_date, textHash: sha256(row.full_text) })), searchRows: indexRows.length,
      reusedChunks: supported.keep.length, reusedVectors: supported.keep.filter(row => row.embedding !== null).length,
      staleChunks: supported.remove.length, staleCaches: caches.length, changedBodies: changedBodies.length, citationChanges: citationChanged.length, rebuiltCitationSources: changedIds.length, invalidIncomingLinks: invalidIncoming.length,
      staleCitationLinks: oldLinks.length, staleUnresolvedCitations: oldUnresolved.length, embeddingApiCalls: 0 };
    if (!apply) {
      await client.query("ROLLBACK"); transaction = false;
      await writeFile(`${backupPath}.preview.json`, JSON.stringify(preview, null, 2), { flag: "wx", mode: 0o600 });
      console.log(JSON.stringify(preview, null, 2)); return;
    }
    // Save and sync complete originals before the first mutation; never overwrite a backup.
    const backup = await open(backupPath, "wx", 0o600);
    try {
      const original = JSON.stringify({ savedAt: new Date().toISOString(), plan, judgments: before, judgeCaseLinks: judgeLinks, caseLaw: indexRows, sourceFiles: currentFiles, citationLinks: oldLinks, incomingLinks, unresolvedCitations: oldUnresolved, ragChunks, dependentChunks, ragDocuments, queryCache: caches });
      await backup.writeFile(backupPath.endsWith(".gz") ? gzipSync(original) : original);
      await backup.sync();
    }
    finally { await backup.close(); }
    const updates = corrected.map(row => {
      const dateChanged = plan.repairs.find(repair => repair.id === row.id)!.changes.decisionDate !== undefined;
      return { id: row.id, year: row.year, journal_id: row.journal_id, page: row.page, citation_section: row.citation_section, citation: row.citation_string, title: row.title, petitioner: row.petitioner, respondent: row.respondent,
        court: row.court_name_snapshot, court_id: row.court_id, bench: row.bench, full_text: row.full_text, pdf_url: row.pdf_url,
        body_changed: row.full_text !== before.find(original => original.id === row.id)!.full_text,
        date_changed: dateChanged, decision_date: dateChanged ? row.decision_date : null };
    });
    phase = "update canonical judgments";
    const result = await client.query(`UPDATE judgments j SET year=p.year,journal_id=p.journal_id,page=p.page,citation_section=p.citation_section,citation_string=p.citation,title=p.title,petitioner=p.petitioner,respondent=p.respondent,
      court_name_snapshot=p.court,court_id=p.court_id,bench=p.bench,
      decision_date=CASE WHEN p.date_changed THEN p.decision_date ELSE j.decision_date END,
      full_text=CASE WHEN p.body_changed THEN p.full_text ELSE j.full_text END,formatted_text=NULL,headnotes=NULL,ai_summary=NULL,pdf_url=p.pdf_url,text_status='own',text_true_citation=NULL,updated_at=now()
      FROM jsonb_to_recordset($1::jsonb) AS p(id uuid,year int,journal_id int,page int,citation_section text,citation text,title text,petitioner text,respondent text,court text,court_id int,bench text,body_changed boolean,date_changed boolean,decision_date timestamp,full_text text,pdf_url text)
      WHERE j.id=p.id RETURNING j.id`, [JSON.stringify(updates)]);
    assert.equal(result.rowCount, corrected.length);
    await client.query(`UPDATE judge_case_links l SET year=p.year,court_name=p.court FROM jsonb_to_recordset($1::jsonb) AS p(id uuid,year int,court text) WHERE l.judgment_id=p.id`, [JSON.stringify(updates)]);
    const searchUpdates = indexRows.flatMap(indexRow => {
      const owner = corrected.find(row => {
        const repair = plan.repairs.find(repair => repair.id === row.id)!;
        return (!repair.caseLawIds || repair.caseLawIds.includes(indexRow.id)) && assessJudgmentIdentity({ citation: indexRow.citation,
          title: row.title, court: indexRow.court || row.court_name_snapshot, opening: row.full_text, textStatus: "own" }).textIntegrity === "own";
      });
      return owner ? [{ id: indexRow.id, title: owner.title, court: owner.court_name_snapshot || "", summary: extractSubstantiveSummary(owner.full_text) }] : [];
    });
    phase = "update keyword search rows";
    if (searchUpdates.length) await client.query(`UPDATE case_law c SET title=p.title,court=p.court,summary=p.summary,keywords='{}'
      FROM jsonb_to_recordset($1::jsonb) AS p(id int,title text,court text,summary text) WHERE c.id=p.id`, [JSON.stringify(searchUpdates)]);
    if (changedIds.length) {
      phase = "rebuild citation references";
      const references = rebuiltBodies.flatMap(row => repairCitationReferences(row, new Set(journalIds.keys())));
      const keys = [...new Map(references.map(reference => [`${reference.year}|${reference.journal}|${reference.page}`,
        { year: reference.year, journal_id: journalIds.get(reference.journal), page: reference.page }])).values()];
      const targets = keys.length ? (await client.query(`SELECT j.id,j.year,j.journal_id,j.page,j.citation_string,j.title,j.court_name_snapshot,j.text_status,j.text_true_citation,left(j.full_text,16000) AS opening
        FROM judgments j JOIN jsonb_to_recordset($1::jsonb) AS p(year int,journal_id int,page int)
        ON j.year=p.year AND j.journal_id=p.journal_id AND j.page=p.page WHERE j.is_active=true`, [JSON.stringify(keys)])).rows : [];
      const links: any[] = [], pending: any[] = [];
      for (const reference of references) {
        const matches = targets.filter(target => target.year === reference.year && target.journal_id === journalIds.get(reference.journal) && target.page === reference.page
          && target.id !== reference.source_id && !(reference.journal === "PLD" && !citationCourtQualifier(reference.raw))
          && citationIdentifiesJudgment(reference.raw, { citation: target.citation_string, court: target.court_name_snapshot })
          && assessJudgmentIdentity({ citation: target.citation_string, title: target.title, court: target.court_name_snapshot,
            opening: target.opening, textStatus: target.text_status, textTrueCitation: target.text_true_citation }).textIntegrity === "own");
        const target = matches.length === 1 ? matches[0] : undefined;
        const valid = Boolean(target);
        (valid ? links : pending).push({ ...reference, target_id: valid ? target.id : null });
      }
      await client.query("DELETE FROM citation_links WHERE source_judgment_id=ANY($1::uuid[])", [changedIds]);
      await client.query("DELETE FROM unresolved_citations WHERE source_judgment_id=ANY($1::uuid[])", [changedIds]);
      if (links.length) await client.query(`INSERT INTO citation_links(source_judgment_id,target_judgment_id,citation_type,treatment,context_excerpt,citation_text,start_offset)
        SELECT source_id,target_id,'referred_to','cited',context,raw,offset_value FROM jsonb_to_recordset($1::jsonb)
        AS p(source_id uuid,target_id uuid,context text,raw text,offset_value int) ON CONFLICT DO NOTHING`, [JSON.stringify(links.map(row => ({ ...row, offset_value: row.offset })))]);
      if (pending.length) await client.query(`INSERT INTO unresolved_citations(source_judgment_id,raw_citation,year,journal_code,page,context_excerpt,status)
        SELECT source_id,raw,year,journal,page,context,'pending' FROM jsonb_to_recordset($1::jsonb)
        AS p(source_id uuid,raw text,year int,journal text,page int,context text)`, [JSON.stringify(pending)]);
    }
    if (invalidIncoming.length) {
      phase = "quarantine obsolete incoming references";
      await client.query("DELETE FROM citation_links WHERE id=ANY($1::int[])", [invalidIncoming.map(row => row.id)]);
      const pending = invalidIncoming.map(row => {
        const parsed = parseCitation(row.citation_text, new Set(journalIds.keys()));
        return { source_id: row.source_judgment_id, raw: row.citation_text, year: parsed?.year || null, journal: parsed?.journal || null, page: parsed?.page || null, context: row.context_excerpt };
      });
      await client.query(`INSERT INTO unresolved_citations(source_judgment_id,raw_citation,year,journal_code,page,context_excerpt,status)
        SELECT source_id,raw,year,journal,page,context,'pending' FROM jsonb_to_recordset($1::jsonb)
        AS p(source_id uuid,raw text,year int,journal text,page int,context text)`, [JSON.stringify(pending)]);
    }
    if (removedChunkIds.length) {
      phase = "remove unsupported search excerpts";
      // Detach first: deleting a parent must not cascade into supported excerpts.
      const removed = new Set(removedChunkIds.map(String));
      const survivingChildren = dependentChunks.filter(row => !removed.has(String(row.id))).map(row => row.id);
      if (survivingChildren.length) await client.query("UPDATE rag_chunks SET parent_chunk_id=NULL WHERE id=ANY($1::bigint[])", [survivingChildren]);
      await client.query("DELETE FROM rag_chunks WHERE id=ANY($1::bigint[])", [removedChunkIds]);
    }
    if (supported.keep.length) {
      phase = "refresh retained vector metadata";
      const metadata = corrected.map(row => ({ id: row.id, title: row.title, citation: row.citation_string, court: row.court_name_snapshot,
        hash: crypto.createHash("md5").update(row.full_text).digest("hex") }));
      await client.query(`UPDATE rag_chunks c SET metadata=c.metadata || jsonb_build_object('sourceType','judgment','judgmentId',p.id,
        'title',p.title,'citationString',p.citation,'citation',p.citation,'court',p.court,'textIntegrity','own','sourceVerified',false,
        'sourceUrl','https://www.alwakeelo.com/judgment/' || p.id,'judgmentBodyHash',p.hash)
        FROM jsonb_to_recordset($1::jsonb) AS p(id text,title text,citation text,court text,hash text)
        WHERE c.id=ANY($2::bigint[]) AND c.metadata->>'judgmentId'=p.id`, [JSON.stringify(metadata), supported.keep.map(row => row.id)]);
    }
    phase = "refresh search document counts";
    if (ragIds.length) await client.query(`UPDATE rag_documents d SET chunk_count=(SELECT count(*) FROM rag_chunks c WHERE c.rag_document_id=d.id),
      status=CASE WHEN EXISTS(SELECT 1 FROM rag_chunks c WHERE c.rag_document_id=d.id) THEN d.status ELSE 'pending' END,updated_at=now()
      WHERE d.id=ANY($1::bigint[])`, [ragIds]);
    if (caches.length) await client.query("DELETE FROM query_cache WHERE id=ANY($1::int[])", [caches.map(row => row.id)]);
    await client.query("COMMIT"); transaction = false;
    await writeFile(`${backupPath}.result.json`, JSON.stringify({ ...preview, committedAt: new Date().toISOString() }, null, 2), { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify(preview, null, 2));
  } catch (error) { console.error(`Judgment repair phase: ${phase}`); throw error; } finally {
    if (transaction) await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error("Repair failed:", error.code || error.message); process.exitCode = 1; });
}
