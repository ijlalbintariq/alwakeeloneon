/** Relabel sources with verified R2 signatures. Original bytes and object keys are preserved. */
import "../server/load-env";
import assert from "node:assert/strict";
import { open, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { sourceFileFormat } from "../shared/source-file-format";

type FileRow = { id: number; parent_id: number; table: string; object_key: string; original_filename: string | null; mime_type: string | null };
export function sourceFormatRepair(row: FileRow, signature: { kind?: string; pdf?: boolean; error?: string } | undefined) {
  if (!signature || signature.error || signature.pdf) return null;
  if (signature.kind === "text_like" && String(row.mime_type).startsWith("text/")) {
    return { ...row, filename: sourceFileFormat(row.original_filename || "source.pdf", row.mime_type).filename, mime: row.mime_type };
  }
  // Preserve damaged uploads for recovery, but stop advertising them as readable PDFs.
  if (signature.kind === "other_binary" || signature.kind === "empty") {
    return { ...row, filename: (row.original_filename || "source.pdf").replace(/\.pdf$/i, ".unreadable.bin"), mime: "application/octet-stream" };
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2), apply = args.includes("--apply");
  const option = (key: string) => args[args.indexOf(key) + 1];
  for (const key of ["--inventory", "--signatures", "--backup"]) assert.ok(args.includes(key) && option(key), `${key} is required`);
  const inventory = JSON.parse(await readFile(option("--inventory"), "utf8"));
  const evidence = JSON.parse(await readFile(option("--signatures"), "utf8"));
  assert.equal(evidence.errors, 0, "Signature audit must be complete");
  const signatures = new Map<string, any>(evidence.results.map((r: any) => [r.key, r]));
  const plan = (inventory.files as FileRow[]).map(row => sourceFormatRepair(row, signatures.get(row.object_key))).filter((r): r is NonNullable<typeof r> => Boolean(r));
  assert.ok(plan.length > 0);
  const tables = ["admin_knowledge_files", "statute_document_files", "document_files"];
  assert.ok(plan.every(r => tables.includes(r.table)));
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000, query_timeout: 65000 });
  let transaction = false;
  let phase = "connect";
  try {
    await client.connect();
    await client.query(apply ? "BEGIN" : "BEGIN READ ONLY"); transaction = true;
    await client.query("SET LOCAL statement_timeout=60000");
    const originals: Record<string, any[]> = {};
    const parents: Record<string, any[]> = {};
    const lock = apply ? " FOR UPDATE" : "";
    for (const table of tables) {
      phase = `read ${table}`;
      const rows = plan.filter(r => r.table === table);
      originals[table] = rows.length ? (await client.query(`SELECT * FROM ${table} WHERE id=ANY($1::int[])${lock}`, [rows.map(r => r.id)])).rows : [];
      assert.equal(originals[table].length, rows.length, "Source record disappeared");
      const byId = new Map(originals[table].map(r => [r.id, r]));
      for (const row of rows) {
        const current = byId.get(row.id);
        for (const field of ["object_key", "original_filename", "mime_type"] as const) assert.equal(current[field], row[field], `Source ${row.id} changed since audit`);
      }
    }
    const adminIds = plan.filter(r => r.table === "admin_knowledge_files").map(r => r.parent_id);
    const userIds = plan.filter(r => r.table === "document_files").map(r => r.parent_id);
    parents.admin = adminIds.length ? (await client.query(`SELECT id,filename FROM admin_knowledge WHERE id=ANY($1::int[])${lock}`, [adminIds])).rows : [];
    parents.user = userIds.length ? (await client.query(`SELECT id,mime_type,file_extension FROM documents WHERE id=ANY($1::int[])${lock}`, [userIds])).rows : [];
    const indexRows = adminIds.length ? (await client.query(`SELECT id,source_filename FROM case_law WHERE source_type='admin' AND source_doc_id=ANY($1::int[])${lock}`, [adminIds])).rows : [];
    const summary = { mode: apply ? "apply" : "preview", sources: plan.length, textSources: plan.filter(r => r.mime?.startsWith("text/")).length, unreadableSources: plan.filter(r => r.mime === "application/octet-stream").length, indexRows: indexRows.length };
    if (!apply) {
      await client.query("ROLLBACK"); transaction = false;
      await writeFile(`${option("--backup")}.preview.json`, JSON.stringify(summary, null, 2), { flag: "wx", mode: 0o600 });
      console.log(JSON.stringify(summary)); return;
    }
    phase = "backup";
    const backup = await open(option("--backup"), "wx", 0o600);
    try { await backup.writeFile(JSON.stringify({ savedAt: new Date().toISOString(), plan, originals, parents, indexRows })); await backup.sync(); }
    finally { await backup.close(); }
    for (const table of tables) {
      const rows = plan.filter(r => r.table === table);
      phase = `update ${table}`;
      for (let offset = 0; offset < rows.length; offset += 250) {
        const batch = rows.slice(offset, offset + 250);
        const result = await client.query(`UPDATE ${table} f SET original_filename=p.filename,mime_type=p.mime FROM jsonb_to_recordset($1::jsonb) AS p(id int,filename text,mime text) WHERE f.id=p.id RETURNING f.id`, [JSON.stringify(batch)]);
        assert.equal(result.rowCount, batch.length);
      }
      if (rows.length) console.log(JSON.stringify({ phase, rows: rows.length }));
    }
    const admin = plan.filter(r => r.table === "admin_knowledge_files");
    for (let offset = 0; offset < admin.length; offset += 250) {
      const batch = admin.slice(offset, offset + 250);
      const payload = JSON.stringify(batch);
      phase = "update parent filenames";
      await client.query(`UPDATE admin_knowledge a SET filename=p.filename FROM jsonb_to_recordset($1::jsonb) AS p(parent_id int,filename text) WHERE a.id=p.parent_id`, [payload]);
      phase = "update source index filenames";
      await client.query(`UPDATE case_law c SET source_filename=p.filename FROM jsonb_to_recordset($1::jsonb) AS p(parent_id int,filename text) WHERE c.source_type='admin' AND c.source_doc_id=p.parent_id`, [payload]);
    }
    for (const row of plan.filter(r => r.table === "document_files")) await client.query("UPDATE documents SET mime_type=$2,file_extension=$3 WHERE id=$1", [row.parent_id, row.mime, row.mime === "application/octet-stream" ? ".bin" : ".txt"]);
    await client.query("COMMIT"); transaction = false;
    await writeFile(`${option("--backup")}.result.json`, JSON.stringify({ ...summary, committedAt: new Date().toISOString() }, null, 2), { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify(summary));
  } catch (error) { console.error(`Source format phase: ${phase}`); throw error; } finally { if (transaction) await client.query("ROLLBACK").catch(() => {}); await client.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error("Format repair failed:", error.code || error.message); process.exitCode = 1; });
