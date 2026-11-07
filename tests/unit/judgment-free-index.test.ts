import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { sql, eq, inArray } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { judgments, courtsRef } from "../../shared/schema";
import { partitionSupportedRepairChunks } from "../../script/repair_judgment_identity";
import { assessJudgmentIdentity, citationIdentifiesJudgment, judgmentSourceUrl } from "../../server/citation-verify";

const id = "11111111-1111-4111-8111-111111111111";
const body = `Court Name: Supreme Court\nTitle: Ahmad Khan vs State\nReported As: 2024 SCMR 1085\nResult: allowed\n${"Actual legal findings from this judgment. ".repeat(30)}`;

test("free index reuse retains exact supported inputs and vectors and rejects foreign ownership", () => {
  const vector = [0.2, 0.4], child = { id: 1, chunk_text: "Actual legal findings from this judgment.", embedding: vector, metadata: { judgmentId: id } };
  const foreignHeader = { id: 2, chunk_text: "CITATION: 1971 PLD 110 TITLE: Different Person vs State", embedding: [0.3, 0.6], metadata: { judgmentId: id } };
  const result = partitionSupportedRepairChunks([{ id, full_text: body }], [child, foreignHeader]);
  assert.deepEqual(result.keep, [child]);
  assert.strictEqual(result.keep[0].embedding, vector, "A reused embedding must remain unchanged");
  assert.equal(result.keep[0].chunk_text, child.chunk_text);
  assert.deepEqual(result.remove, [foreignHeader]);
  assert.throws(() => partitionSupportedRepairChunks([{ id, full_text: body }], [{ ...child, metadata: { judgmentId: "another-owner" } }]), /outside the reviewed repair scope/);
});

function compileFunction(file: string, name: string, dependencies: Record<string, any>) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)!;
  const code = ts.transpileModule(`(${declaration.getText(source).replace(/^export\s+/, "")})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(dependencies), `return ${code}`)(...Object.values(dependencies));
}

test("body-hash checks bind multiple judgment IDs as valid PostgreSQL parameters", async () => {
  let projection: any;
  const db = { select: (fields: any) => { projection = fields; return { from: () => ({ leftJoin: () => ({ where: async () => [] }) }) }; } };
  const get = compileFunction("server/storage.ts", "getValidatedJudgmentIntegrity", { db, sql, eq, inArray, judgments, courtsRef,
    UUID_RE: /^[a-f0-9-]{36}$/, assessJudgmentIdentity, cleanCaseTitle: (s: string) => s });
  const ids = [id, "22222222-2222-4222-8222-222222222222"];
  await get(ids, new Map(), ids);
  const query = new PgDialect().sqlToQuery(projection.bodyHash);
  assert.match(query.sql, / in \(\$1, \$2\)/);
  assert.deepEqual(query.params, ids);
});

test("RAG uses the canonical case title and withholds reused vectors after a body change", async () => {
  let currentHash = "current-body";
  const drop = compileFunction("server/rag/rag-service.ts", "dropMislabeledJudgmentChunks", {
    getValidatedJudgmentIntegrity: async (_ids: string[], metadata: Map<string, any>) => {
      metadata.set(id, { citation: "2024 SCMR 1085", title: "Ahmad Khan vs State", court: "Supreme Court", bodyHash: currentHash });
      return new Map([[id, "own"]]);
    }, judgmentSourceUrl, console,
  });
  const match = { title: "A different case from a colliding index ID", metadata: { sourceType: "judgment", judgmentId: id, judgmentBodyHash: "current-body", sourceUrl: "https://example.invalid/wrong-case" } };
  const [result] = await drop([match]);
  assert.equal(result.title, "2024 SCMR 1085 — Ahmad Khan vs State");
  assert.equal(result.metadata.sourceUrl, judgmentSourceUrl(id));
  currentHash = "changed-body";
  assert.deepEqual(await drop([match]), []);
});

test("linked authorities match citation, court and verified identity before exposing a case link", async () => {
  const source = ts.createSourceFile("storage.ts", fs.readFileSync("server/storage.ts", "utf8"), ts.ScriptTarget.Latest, true);
  let method: ts.MethodDeclaration | undefined;
  const visit = (node: ts.Node) => { if (ts.isMethodDeclaration(node) && node.name.getText(source) === "getJudgmentDetail") method = node; ts.forEachChild(node, visit); };
  visit(source); assert.ok(method);
  const good = "22222222-2222-4222-8222-222222222222", bad = "33333333-3333-4333-8333-333333333333";
  const edge = (linkedJudgmentId: string, citationText = "2024 SCMR 1085") => ({ id: linkedJudgmentId, linkedJudgmentId, citationText, citationType: "referred_to", contextExcerpt: null });
  const values = [[{ id, citation: "2024 SCMR 1085", title: "Ahmad Khan vs State", courtName: "Supreme Court", fullText: body }], [edge(good), edge(bad), edge(good, "2024 SCMR 999")], [edge(good), edge(bad)], [
    { id: good, citation: "2024 SCMR 1085", title: "Ahmad Khan vs State", court: "Supreme Court", opening: body, textStatus: "own", isActive: true },
    { id: bad, citation: "2024 SCMR 1085", title: "Different Person vs State", court: "Supreme Court", opening: body, textStatus: "own", isActive: true },
  ]];
  let query = 0;
  const db = { select: () => { const rows = values[query++]; const chain: any = { then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject) }; for (const name of ["from", "leftJoin", "innerJoin", "where", "limit", "orderBy"]) chain[name] = () => chain; return chain; } };
  const dependencies = { db, judgments: {}, courtsRef: {}, lawJournals: {}, citationLinks: {}, eq() {}, desc() {}, inArray() {}, sql: () => ({}), assessJudgmentIdentity, citationIdentifiesJudgment, cleanCaseTitle: (value: string) => value };
  const code = ts.transpileModule(`(${method.getText(source).replace(/^async\s+getJudgmentDetail/, "async function")})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const detail = await new Function(...Object.keys(dependencies), `return ${code}`)(...Object.values(dependencies))(id);
  assert.equal(detail.citations.made[0].linkedJudgmentId, good);
  assert.equal(detail.citations.made[1].linkedJudgmentId, null);
  assert.equal(detail.citations.made[2].linkedJudgmentId, null, "A different page must not link to a real but unrelated case");
  assert.equal(detail.citations.received.length, 1);
  assert.equal(detail.citations.received[0].linkedJudgmentId, good);
});
