/** Export a source-review queue without changing the database.
 * node --import tsx script/judgment_identity_review.ts --limit 1000 --output /tmp/judgment-review.jsonl
 * Resume using --after <lastId> from the companion summary file.
 */
import "../server/load-env";
import assert from "node:assert/strict";
import { open, writeFile } from "node:fs/promises";
import { Client } from "pg";
import { assessJudgmentIdentity } from "../server/citation-verify";

async function main() {
  const args = process.argv.slice(2);
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    assert.ok(["--limit", "--output", "--after"].includes(args[index]) && args[index + 1], "Use --limit N --output path [--after UUID]");
    options.set(args[index], args[index + 1]);
  }
  const limit = Number(options.get("--limit") || 1000);
  const output = options.get("--output");
  let cursor = options.get("--after") || null;
  assert.ok(output, "--output is required");
  assert.ok(Number.isInteger(limit) && limit > 0 && limit <= 250000, "--limit must be between 1 and 250000");
  assert.ok(!cursor || /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(cursor), "--after must be a UUID");
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required");
  const file = await open(output, "wx", 0o600);
  const client = new Client({ connectionString: process.env.DATABASE_URL, options: "-c default_transaction_read_only=on", connectionTimeoutMillis: 15000, statement_timeout: 30000 });
  const summary = { startedAt: new Date().toISOString(), scanned: 0, queued: 0, internallyConsistent: 0, after: cursor, lastId: cursor, complete: false };
  try {
    await client.connect();
    assert.equal((await client.query("SHOW transaction_read_only")).rows[0].transaction_read_only, "on");
    while (summary.scanned < limit) {
      const result = await client.query(`SELECT id, citation_string AS citation, title, court_name_snapshot AS court,
        text_status AS "textStatus", text_true_citation AS "textTrueCitation", pdf_url AS "pdfUrl",
        updated_at AS "updatedAt", md5(full_text) AS "bodyHash", left(full_text,16000) AS opening
        FROM judgments WHERE ($1::uuid IS NULL OR id > $1::uuid) ORDER BY id LIMIT $2`, [cursor, Math.min(100, limit - summary.scanned)]);
      if (!result.rows.length) break;
      for (const row of result.rows) {
        const check = assessJudgmentIdentity(row);
        summary.scanned++;
        if (check.textIntegrity === "own") summary.internallyConsistent++;
        else {
          await file.write(JSON.stringify({ ...row, check, action: "source_review_required", sourceAuthenticated: false }) + "\n");
          summary.queued++;
        }
        cursor = row.id;
      }
      summary.lastId = cursor;
      console.log(`Scanned ${summary.scanned}; queued ${summary.queued}`);
    }
    assert.equal(summary.scanned, summary.queued + summary.internallyConsistent);
    summary.complete = true;
  } finally {
    await file.close();
    await client.end();
    await writeFile(`${output}.summary.json`, JSON.stringify({ ...summary, finishedAt: new Date().toISOString() }, null, 2), { flag: "wx", mode: 0o600 });
  }
}

main().catch(error => { console.error("Review export failed:", error.code || error.message); process.exitCode = 1; });
