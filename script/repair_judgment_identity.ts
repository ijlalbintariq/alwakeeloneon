/** Apply a reviewed source-backed plan. Defaults to a read-only preview.
 * node --import tsx script/repair_judgment_identity.ts --plan plan.json --backup before.json [--apply]
 */
import "../server/load-env";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile, open, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { assessJudgmentIdentity, judgmentPdfUrl, normalizeCitation } from "../server/citation-verify";
import { extractSubstantiveSummary } from "../server/storage";

type RecordRow = Record<string, any>;
export type Repair = {
  id: string; citation: string; expectedFingerprint: string;
  evidence: { path: string; sha256: string; url: string; scope: "full_judgment" | "identity_reference"; reviewedPages: number[] }[];
  changes: { title: string; petitioner: string; respondent: string | null; decisionDate: string; pdfUrl?: string; fullTextPath?: string; fullTextSha256?: string };
};
export const sha256 = (value: string | Buffer) => crypto.createHash("sha256").update(value).digest("hex");

export function recordFingerprint(row: RecordRow): string {
  return sha256(JSON.stringify([row.id, row.citation_string, row.title, row.petitioner, row.respondent,
    row.court_name_snapshot, row.decision_date, row.pdf_url, row.text_status, row.text_true_citation,
    row.full_text, row.formatted_text, row.headnotes]));
}

export async function prepareRepair(row: RecordRow, repair: Repair): Promise<RecordRow> {
  assert.equal(row.id, repair.id, "Record ID changed");
  assert.equal(row.citation_string, repair.citation, "Citation changed");
  assert.equal(recordFingerprint(row), repair.expectedFingerprint, "Record changed since source review");
  assert.ok(repair.evidence.length, "Source evidence is required");
  for (const source of repair.evidence) {
    assert.equal(new URL(source.url).protocol, "https:", "Source URL must use HTTPS");
    assert.ok(source.reviewedPages.length && source.reviewedPages.every(page => Number.isInteger(page) && page > 0), "Reviewed source pages are required");
    assert.equal(sha256(await readFile(source.path)), source.sha256, "Source evidence changed");
  }
  const changes = repair.changes;
  const body = changes.fullTextPath ? await readFile(changes.fullTextPath, "utf8") : row.full_text;
  if (changes.fullTextPath) {
    assert.ok(repair.evidence.some(source => source.scope === "full_judgment"), "Replacing judgment text requires a complete source judgment");
    assert.equal(sha256(body), changes.fullTextSha256, "Replacement text changed");
  }
  assert.ok(row.text_status === "own" || changes.fullTextPath, "Unverified text requires a complete replacement source");
  assert.ok(changes.title.trim() && changes.petitioner.trim(), "A named party or entity is required");
  assert.match(changes.decisionDate, /^\d{4}-\d{2}-\d{2}$/);
  const date = new Date(`${changes.decisionDate}T00:00:00.000Z`);
  assert.equal(date.toISOString().slice(0, 10), changes.decisionDate, "Invalid decision date");
  if (changes.pdfUrl) assert.equal(judgmentPdfUrl(changes.pdfUrl), changes.pdfUrl);
  const corrected = { ...row, title: changes.title, petitioner: changes.petitioner, respondent: changes.respondent,
    decision_date: date.toISOString(), full_text: body, formatted_text: null, headnotes: null,
    ai_summary: null, pdf_url: changes.pdfUrl || row.pdf_url, text_status: "own", text_true_citation: null };
  assert.equal(assessJudgmentIdentity({ citation: corrected.citation_string, title: corrected.title,
    court: corrected.court_name_snapshot, opening: corrected.full_text, textStatus: corrected.text_status }).textIntegrity,
  "own", "Correction does not establish internal case identity");
  return corrected;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const values = args.filter(arg => arg !== "--apply");
  const options = new Map<string, string>();
  for (let i = 0; i < values.length; i += 2) {
    assert.ok(["--plan", "--backup"].includes(values[i]) && values[i + 1], "Use --plan path --backup path [--apply]");
    options.set(values[i], values[i + 1]);
  }
  const planPath = options.get("--plan"), backupPath = options.get("--backup");
  assert.ok(planPath && backupPath, "--plan and --backup are required");
  const plan = JSON.parse(await readFile(planPath, "utf8")) as { repairs: Repair[] };
  assert.ok(plan.repairs.length > 0 && plan.repairs.length <= 100, "Review at most 100 repairs per transaction");
  assert.equal(new Set(plan.repairs.map(repair => repair.id)).size, plan.repairs.length, "Duplicate repair IDs");
  const client = new Client({ connectionString: process.env.DATABASE_URL, options: `-c default_transaction_read_only=${apply ? "off" : "on"}`, connectionTimeoutMillis: 15000, statement_timeout: 30000 });
  let transaction = false;
  try {
    await client.connect();
    await client.query("BEGIN"); transaction = true;
    const lock = apply ? " FOR UPDATE" : "";
    const before = (await client.query(`SELECT * FROM judgments WHERE id=ANY($1::uuid[]) ORDER BY id${lock}`, [plan.repairs.map(repair => repair.id)])).rows;
    assert.equal(before.length, plan.repairs.length, "Missing judgment record");
    const corrected = await Promise.all(before.map(row => prepareRepair(row, plan.repairs.find(repair => repair.id === row.id)!)));
    const variants = corrected.flatMap(row => normalizeCitation(row.citation_string));
    const indexWhere = "upper(regexp_replace(citation, '[^A-Za-z0-9]', '', 'g'))=ANY($1::text[])";
    const indexRows = (await client.query(`SELECT * FROM case_law WHERE ${indexWhere}${lock}`, [variants])).rows;
    const ids = before.map(row => row.id);
    const ragChunks = (await client.query(`SELECT * FROM rag_chunks WHERE metadata->>'judgmentId'=ANY($1::text[])${lock}`, [ids])).rows;
    const ragIds = [...new Set(ragChunks.map(row => row.rag_document_id))];
    const ragDocuments = ragIds.length ? (await client.query(`SELECT * FROM rag_documents WHERE id=ANY($1::bigint[])${lock}`, [ragIds])).rows : [];
    const cachePatterns = before.flatMap(row => [row.id, row.citation_string, row.title].map(value => `%${value.replace(/[\\%_]/g, "\\$&")}%`));
    const cacheWhere = "query_text ILIKE ANY($1::text[]) OR response ILIKE ANY($1::text[])";
    const caches = (await client.query(`SELECT * FROM query_cache WHERE ${cacheWhere}${lock}`, [cachePatterns])).rows;
    const preview = { mode: apply ? "apply" : "preview", repairs: corrected.map(row => ({ id: row.id, citation: row.citation_string, title: row.title, decisionDate: row.decision_date, textHash: sha256(row.full_text) })), searchRows: indexRows.length, staleChunks: ragChunks.length, staleCaches: caches.length };
    if (!apply) {
      await client.query("ROLLBACK"); transaction = false;
      await writeFile(`${backupPath}.preview.json`, JSON.stringify(preview, null, 2), { flag: "wx", mode: 0o600 });
      console.log(JSON.stringify(preview, null, 2)); return;
    }
    // Save and sync complete originals before the first mutation; never overwrite a backup.
    const backup = await open(backupPath, "wx", 0o600);
    try { await backup.writeFile(JSON.stringify({ savedAt: new Date().toISOString(), plan, judgments: before, caseLaw: indexRows, ragChunks, ragDocuments, queryCache: caches })); await backup.sync(); }
    finally { await backup.close(); }
    for (const row of corrected) {
      const result = await client.query(`UPDATE judgments SET title=$2,petitioner=$3,respondent=$4,decision_date=$5,
        full_text=$6,formatted_text=NULL,headnotes=NULL,ai_summary=NULL,pdf_url=$7,text_status='own',text_true_citation=NULL,updated_at=now()
        WHERE id=$1 RETURNING id`, [row.id,row.title,row.petitioner,row.respondent,row.decision_date,row.full_text,row.pdf_url]);
      assert.equal(result.rowCount, 1);
      const summary = extractSubstantiveSummary(row.full_text);
      const keys = normalizeCitation(row.citation_string);
      await client.query(`UPDATE case_law SET title=$2,court=$3,summary=$4,keywords='{}' WHERE ${indexWhere}`, [keys,row.title,row.court_name_snapshot || "",summary]);
    }
    if (ragChunks.length) await client.query("DELETE FROM rag_chunks WHERE id=ANY($1::bigint[])", [ragChunks.map(row => row.id)]);
    if (ragIds.length) await client.query("UPDATE rag_documents SET status='pending' WHERE id=ANY($1::bigint[])", [ragIds]);
    if (caches.length) await client.query("DELETE FROM query_cache WHERE id=ANY($1::int[])", [caches.map(row => row.id)]);
    await client.query("COMMIT"); transaction = false;
    await writeFile(`${backupPath}.result.json`, JSON.stringify({ ...preview, committedAt: new Date().toISOString() }, null, 2), { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify(preview, null, 2));
  } finally {
    if (transaction) await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error("Repair failed:", error.code || error.message); process.exitCode = 1; });
}
