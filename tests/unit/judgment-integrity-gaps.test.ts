import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import ts from "typescript";
import { jsPDF } from "jspdf";
import { assessJudgmentIdentity, prepareJudgmentDetail } from "../../server/citation-verify";

const routes = ts.createSourceFile("routes.ts", fs.readFileSync("server/routes.ts", "utf8"), ts.ScriptTarget.Latest, true);
function compile(node: ts.Node, source: ts.SourceFile, deps: Record<string, any>) {
  // Replace only the provider import so generation tests cannot call an external AI.
  const code = node.getText(source).replace(/^export\s+/, "").replace('await import("./openrouter")', "await loadOpenRouter()");
  const js = ts.transpileModule(`(${code})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(deps), `return ${js}`)(...Object.values(deps));
}
function handler(method: string, pathExpression: string, deps: Record<string, any>) {
  let callback: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(routes) === `app.${method}` && node.arguments[0]?.getText(routes) === pathExpression) callback = node.arguments.at(-1);
    ts.forEachChild(node, visit);
  };
  visit(routes); assert.ok(callback);
  return compile(callback, routes, deps);
}
function response() {
  return { statusCode: 200, payload: null as any, status(code: number) { this.statusCode = code; return this; }, sendStatus(code: number) { this.statusCode = code; return this; }, json(data: any) { this.payload = data; return this; } };
}
const id = "11111111-1111-4111-8111-111111111111";
const text = `Court Name: Supreme Court\nTitle: Ahmad Khan vs State\nReported As: 2024 SCMR 1085\nResult: allowed\n${"Validated body excerpt. ".repeat(30)}`;
const record = { id, citation: "2024 SCMR 1085", title: "Ahmad Khan vs State", court: "Supreme Court", fullText: text, textStatus: "own", opening: text, body_hash: "body-hash" };
const sql = (strings: TemplateStringsArray, ...values: any[]) => ({ strings, values });
const protect = (detail: typeof record) => prepareJudgmentDetail(detail, { opening: text, textStatus: "own" });

for (const conflict of [false, true]) test(`raw-text endpoint ${conflict ? "withholds conflicts without an index fallback" : "returns checked text"}`, async () => {
  const detail = { ...record, title: conflict ? "Different Person vs State" : record.title };
  const res = response();
  await handler("get", '"/api/judgment-text"', { getUserId: () => "test", resolveJudgment: async () => ({ id }), judgments: {}, storage: { getJudgmentDetail: async () => detail }, protectJudgmentDetail: protect })({ query: { citation: record.citation } }, res);
  assert.equal(res.statusCode, conflict ? 409 : 200);
  assert.equal(res.payload.fullText, conflict ? null : text);
});

test("cached summaries cannot bypass an identity conflict", async () => {
  const res = response();
  await handler("get", '"/api/judgments/:id/summary"', { getUserId: () => "test", sql, assessJudgmentIdentity, db: { execute: async () => ({ rows: [{ ...record, title: "Different Person vs State", ai_summary: { result: "STALE" } }] }) } })({ params: { id } }, res);
  assert.equal(res.statusCode, 409);
  assert.doesNotMatch(JSON.stringify(res.payload), /STALE/);
});

test("summary cache requires current source hash and version", async () => {
  const sourceHash = crypto.createHash("sha256").update(JSON.stringify([record.citation, record.title, record.court, record.body_hash])).digest("hex");
  for (const cached of [{ result: "legacy" }, { version: 2, sourceHash: "outdated", summary: { result: "old source" } }, { version: 2, sourceHash, summary: { result: "current source" } }]) {
    const res = response();
    await handler("get", '"/api/judgments/:id/summary"', { getUserId: () => "test", sql, assessJudgmentIdentity, crypto, process: { env: {} }, db: { execute: async () => ({ rows: [{ ...record, ai_summary: cached }] }) } })({ params: { id } }, res);
    assert.equal(res.statusCode, cached.sourceHash === sourceHash ? 200 : 503);
    if (res.statusCode === 200) assert.deepEqual(res.payload, { result: "current source" });
  }
});

test("fresh summary uses body only and stores a source-bound cache", async () => {
  const queries: any[] = [];
  let prompt = "";
  const summary = { result: "Outcome", legalPrinciples: [], keyFindings: [], significance: "Limited excerpt" };
  const res = response();
  await handler("get", '"/api/judgments/:id/summary"', {
    getUserId: () => "test", sql, assessJudgmentIdentity, crypto, process: { env: { OPENROUTER_API_KEY: "synthetic-test-key" } },
    db: { execute: async (query: any) => { queries.push(query); return { rows: [{ ...record, headnotes: "STALE_HEADNOTES", ai_summary: { result: "LEGACY_CACHE" } }] }; } },
    checkUsageLimit: async () => true, storage: { logUsage: async () => {} },
    loadOpenRouter: async () => ({ chatWithOpenRouter: async (args: any) => { prompt = JSON.stringify(args.messages); return { content: JSON.stringify(summary) }; } }),
  })({ params: { id } }, res);
  assert.equal(res.statusCode, 200);
  assert.match(prompt, /Validated body excerpt/);
  assert.doesNotMatch(prompt, /STALE_HEADNOTES|LEGACY_CACHE/);
  assert.equal(queries.length, 2);
  const cached = JSON.parse(queries[1].values[0]);
  assert.equal(cached.version, 2);
  assert.equal(cached.sourceHash.length, 64);
  assert.deepEqual(cached.summary, summary);
});

test("POST summary rejects conflicts before cache lookup or generation", async () => {
  const res = response();
  const detail = { ...record, title: "Different Person vs State" };
  await handler("post", "api.ai.judgmentSummary.path", { getUserId: () => "test", checkUsageLimit: async () => true, storage: { getJudgmentDetail: async () => detail }, protectJudgmentDetail: protect })({ body: { id, title: "STALE_TITLE", summary: "STALE_HEADNOTE" } }, res);
  assert.equal(res.statusCode, 409);
});

test("POST summary ignores request metadata and binds its cache to checked content", async () => {
  const res = response();
  let prompt = "";
  let key = "";
  await handler("post", "api.ai.judgmentSummary.path", {
    getUserId: () => "test", checkUsageLimit: async () => true,
    storage: { getJudgmentDetail: async () => record }, protectJudgmentDetail: protect, crypto,
    getCachedOrCall: async (_endpoint: string, cacheKey: string, generate: () => Promise<string>) => { key = cacheKey; return { content: await generate() }; },
    extractSmartJudgmentExcerpt: (body: string) => body, TOKEN_LIMITS: { "judgment-summary": 1000 },
    chatWithDeepSeek: async (args: any) => { prompt = JSON.stringify(args.messages); return { content: "Summary", model: "test" }; }, logUsageCost: async () => {},
  })({ body: { id, title: "STALE_TITLE", summary: "STALE_HEADNOTE", court: "STALE_COURT" } }, res);
  assert.equal(res.statusCode, 200);
  assert.match(key, /^judgment-summary-v5::[a-f0-9]{64}$/);
  assert.doesNotMatch(prompt, /STALE_/);
  assert.match(prompt, /Ahmad Khan vs State/);
  assert.match(prompt, /Validated body excerpt/);
});

const pdfSource = ts.createSourceFile("pdf.ts", fs.readFileSync("client/src/experimental/lib/judgmentPdfGenerator.ts", "utf8"), ts.ScriptTarget.Latest, true);
function pdfFunction(name: string, deps: Record<string, any>) {
  const declaration = pdfSource.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(declaration); return compile(declaration, pdfSource, deps);
}
function pdfHarness(detail: any) {
  let output = ""; let opened = ""; let saved = false;
  const generator = pdfFunction("generateAndDownloadCourtPdf", {
    getJudgmentDetail: async () => detail,
    jsPDF: function (options: any) { const doc = new jsPDF(options); doc.save = (() => { output = doc.output(); saved = true; return doc; }) as any; return doc; },
    formatDate: pdfFunction("formatDate", {}), sanitizeTextForPdf: pdfFunction("sanitizeTextForPdf", {}),
    document: { createElement: () => ({ href: "", click() { opened = this.href; } }) },
  });
  return { generator, result: () => ({ output, opened, saved }) };
}

test("PDF export rejects blocked or failed detail even when caller supplies stale text", async () => {
  for (const detail of [null, { textIntegrity: "unknown", contentFormat: "unavailable", fullText: "", textWarning: "Known conflict" }]) {
    const h = pdfHarness(detail);
    await assert.rejects(h.generator({ citation: record.citation, title: "STALE_TITLE", summary: "STALE_SUMMARY", fullText: "STALE_BODY" }));
    assert.equal(h.result().saved, false);
  }
});

test("PDF export takes title and body together and drops caller headnotes and AI summaries", async () => {
  const h = pdfHarness({ ...record, textIntegrity: "own", contentFormat: "text" });
  await h.generator({ citation: "WRONG_CITATION", title: "STALE_TITLE", fullText: "STALE_BODY", summary: "STALE_SUMMARY", ratioDecidendi: { result: "STALE_AI" } });
  assert.equal(h.result().saved, true);
  assert.match(h.result().output, /Ahmad Khan vs State/);
  assert.match(h.result().output, /Validated body excerpt/);
  assert.doesNotMatch(h.result().output, /STALE_|WRONG_CITATION|Authenticated from/);
});

test("PDF-only export opens the original and does not synthesize a judgment", async () => {
  const h = pdfHarness({ ...record, fullText: "", pdfUrl: "/original.pdf", textIntegrity: "missing", contentFormat: "pdf" });
  const result = await h.generator(record);
  assert.equal(result.openedOriginal, true);
  assert.equal(h.result().opened, "/original.pdf");
  assert.equal(h.result().saved, false);
});

test("unverified plain text exports retain their warning", async () => {
  const h = pdfHarness({ ...record, textIntegrity: "unknown", contentFormat: "text", textWarning: "IDENTITY_UNVERIFIED" });
  await h.generator(record);
  assert.match(h.result().output, /IDENTITY_UNVERIFIED/);
});
