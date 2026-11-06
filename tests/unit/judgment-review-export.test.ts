import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { assessJudgmentIdentity } from "../../server/citation-verify";

const source = ts.createSourceFile("review.ts", fs.readFileSync("script/judgment_identity_review.ts", "utf8"), ts.ScriptTarget.Latest, true);
const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "main")!;
const code = ts.transpileModule(`(${declaration.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const opening = `Court Name: Supreme Court\nTitle: Ahmad Khan vs State\nReported As: 2024 SCMR 1085\nResult: allowed\n${"Legal reasoning. ".repeat(30)}`;
const records = [
  { title: "Ahmad Khan vs State", opening, textStatus: "own" },
  { title: "Another Person vs State", opening: opening + "\u2028Paragraph one\u2029Paragraph two", textStatus: "own" },
  { title: "Ahmad Khan vs State", opening, textStatus: "mislabeled" },
  { title: "Ahmad Khan vs State", opening: "Short", textStatus: "own" },
  { title: "Ahmad Khan vs State", opening: "Unstructured legal reasoning. ".repeat(20), textStatus: "unknown" },
].map((row, index) => ({ ...row, id: `00000000-0000-4000-8000-00000000000${index + 1}`, citation: "2024 SCMR 1085", court: "Supreme Court" }));

async function run(limit: number, readOnly = "on") {
  const commands: string[] = [], output: string[] = [];
  let summary: any, synced = false;
  class Client {
    constructor(options: any) { assert.equal(options.options, undefined, "No unsupported PostgreSQL startup settings"); }
    async connect() {} async end() {}
    async query(sql: string, values?: any[]) {
      commands.push(sql);
      if (/^SHOW/.test(sql)) return { rows: [{ transaction_read_only: readOnly }] };
      if (/^SELECT count/.test(sql)) return { rows: [{ total: records.length }] };
      if (/^SELECT id/.test(sql)) return { rows: records.filter(row => !values?.[0] || row.id > values[0]).slice(0, values?.[1]) };
      assert.match(sql, /^(?:BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY|SET LOCAL statement_timeout=30000|ROLLBACK)$/);
      return { rows: [] };
    }
  }
  const dependencies = {
    assert, Client, assessJudgmentIdentity,
    process: { argv: ["node", "review.ts", "--limit", String(limit), "--output", "/tmp/synthetic-review"], env: { DATABASE_URL: "synthetic" } },
    open: async (_path: string, flags: string, mode: number) => { assert.equal(flags, "wx"); assert.equal(mode, 0o600); return { write: async (text: string) => { output.push(text); }, sync: async () => { synced = true; }, close: async () => {} }; },
    writeFile: async (_path: string, value: string) => { summary = JSON.parse(value); },
  };
  const main = new Function(...Object.keys(dependencies), `return ${code}`)(...Object.values(dependencies));
  let error: unknown; try { await main(); } catch (caught) { error = caught; }
  return { commands, output, summary, synced, error };
}

test("full identity review uses a read-only snapshot and accounts for every classification", async () => {
  const result = await run(100);
  assert.equal(result.error, undefined);
  assert.ok(result.commands.includes("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"));
  assert.equal(result.summary.scanned, 5);
  assert.equal(result.summary.internallyConsistent, 1);
  assert.equal(result.summary.queued, 4);
  for (const field of ["identityConflicts", "labelledMislabeled", "missingText", "unconfirmed", "ownLabelConflicts"]) assert.equal(result.summary[field], 1);
  assert.equal(result.output.length, 4);
  assert.ok(!result.output.some(line => /[\u2028\u2029]/.test(line)), "Unicode separators must not split review records");
  assert.equal(JSON.parse(result.output[0]).opening, records[1].opening, "Escaping must preserve the original text");
  assert.equal(result.summary.scopeExhausted, true);
  assert.equal(result.synced, true);
});

test("a capped review does not claim whole-database coverage", async () => {
  const result = await run(2);
  assert.equal(result.summary.scanned, 2);
  assert.equal(result.summary.expectedRecords, 5);
  assert.equal(result.summary.scopeExhausted, false);
});

test("a writable connection fails before reading judgments", async () => {
  const result = await run(100, "off");
  assert.ok(result.error);
  assert.equal(result.summary.complete, false);
  assert.ok(!result.commands.some(sql => /^SELECT/.test(sql)));
});
