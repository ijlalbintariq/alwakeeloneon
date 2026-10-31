import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { assessJudgmentIdentity, judgmentPdfUrl, prepareJudgmentDetail } from "../../server/citation-verify";
import { extractSubstantiveSummary } from "../../server/storage";

const source = ts.createSourceFile("mcp-server.ts", fs.readFileSync("server/mcp-server.ts", "utf8"), ts.ScriptTarget.Latest, true);
function handler(name: string, deps: Record<string, any>): (input: any) => Promise<any> {
  let callback: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "server.registerTool" && node.arguments[0]?.getText(source) === JSON.stringify(name)) callback = node.arguments.at(-1);
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(callback, `missing MCP tool ${name}`);
  const js = ts.transpileModule(`(${callback.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(deps), `return ${js}`)(...Object.values(deps));
}
const base = { VERSION: "test", SOURCE: "test", RETRIEVAL_VERSION: "test", PUBLIC_SITE: "https://example.test", getAuthenticatedUserId: () => "test", enforceQuota: async () => {}, logToolUsage: async () => {} };
const opening = `Court Name: Supreme Court\nTitle: Ahmad Khan vs State\nReported As: 2024 SCMR 1085\nResult: allowed\n${"Judgment body. ".repeat(40)}`;
const row = { id: "record", citation: "2024 SCMR 1085", title: "Ahmad Khan vs State", court: "Supreme Court", textStatus: "own", opening };

test("MCP search withholds mismatches and never uses index summaries", async () => {
  const deps = { ...base, judgments: {}, sql: () => "", resolveJudgment: async () => row, judgmentSourceUrl: () => "link", assessJudgmentIdentity, judgmentPdfUrl, extractSubstantiveSummary, retrieveLegalCaseLaw: async () => ({ rows: [{ id: 1, citation: row.citation, summary: "WRONG INDEX SUMMARY" }] }) };
  const search = handler("search_case_law", deps);
  const good = (await search({ query: "test", limit: 5, includeUnverified: false })).structuredContent;
  assert.equal(good.judgments[0].verified, true);
  assert.equal(good.judgments[0].sourceVerified, false);
  assert.doesNotMatch(JSON.stringify(good), /WRONG INDEX SUMMARY/);
  row.title = "Different Person vs State";
  try {
    const hidden = (await search({ query: "test", limit: 5, includeUnverified: false })).structuredContent;
    assert.equal(hidden.judgments.length, 0);
    const lead = (await search({ query: "test", limit: 5, includeUnverified: true })).structuredContent.judgments[0];
    assert.equal(lead.verified, false);
    assert.equal(lead.title, undefined);
    assert.equal(lead.summary, undefined);
  } finally { row.title = "Ahmad Khan vs State"; }
});

test("MCP detail returns PDF-only records without claiming readable or verified text", async () => {
  const record = { id: "00000000-0000-4000-8000-000000000001", citation: "2024 SCMR 1085", title: "Ahmad Khan vs State", court: "Supreme Court", fullText: "", pdfUrl: "https://example.com/case.pdf" };
  const get = handler("get_judgment", { ...base, storage: { getJudgmentDetail: async () => record }, protectJudgmentDetail: async () => prepareJudgmentDetail(record, { opening: "", textStatus: null }), judgmentSourceUrl: () => "link" });
  const result = (await get({ id: record.id })).structuredContent;
  assert.equal(result.contentFormat, "pdf");
  assert.equal(result.pdfUrl, record.pdfUrl);
  assert.equal(result.pdfKind, "original");
  assert.equal(result.fullText, undefined);
  assert.equal(result.textIntegrity, "missing");
});

test("MCP research never verifies arbitrary context through citation existence", async () => {
  const research = handler("legal_research", { ...base, gatherKnowledgeContextV2: async () => "2024 SCMR 1085: unrelated holding", extractCitations: () => ["2024 SCMR 1085"], verifyCitations: async () => new Map([["2024 SCMR 1085", "record"]]) });
  const result = (await research({ query: "test" })).structuredContent;
  assert.equal(result.citations[0].verified, false);
  assert.match(result.context, /Context excerpts are unverified/);
});

test("search storage preserves PDF-only and plain-text leads while dropping conflicts", async () => {
  const storageSource = ts.createSourceFile("storage.ts", fs.readFileSync("server/storage.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const declaration = storageSource.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "applyJudgmentTextIntegrity");
  assert.ok(declaration);
  const records = [
    { ...row, id: "00000000-0000-4000-8000-000000000001", opening: "", pdfUrl: "https://example.com/case.pdf" },
    { ...row, id: "00000000-0000-4000-8000-000000000002", opening: "Plain stored judgment text. ".repeat(20), pdfUrl: null },
    { ...row, id: "00000000-0000-4000-8000-000000000003", title: "Different Person vs State", pdfUrl: "https://example.com/wrong.pdf" },
  ];
  const deps = { db: { select: () => ({ from: () => ({ where: async () => records }) }) }, judgments: {}, sql: () => "", inArray: () => "", UUID_RE: /^[0-9a-f-]{36}$/i, assessJudgmentIdentity, judgmentPdfUrl, extractSubstantiveSummary };
  const js = ts.transpileModule(`(${declaration.getText(storageSource).replace(/^export\s+/, "")})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const apply = new Function(...Object.keys(deps), `return ${js}`)(...Object.values(deps));
  const result = await apply(records.map(record => ({ judgmentId: record.id, summary: "WRONG INDEX SUMMARY" })));
  assert.equal(result.length, 2);
  assert.equal(result[0].pdfUrl, "https://example.com/case.pdf");
  assert.equal(result[0].textIntegrity, "unverified");
  assert.equal(result[0].summary, "");
  assert.equal(result[1].textIntegrity, "unverified");
  assert.doesNotMatch(JSON.stringify(result), /WRONG INDEX SUMMARY|wrong.pdf/);
});

test("MCP search and detail reject malformed captions and accept wrapped citations", async () => {
  const cases = [
    { citation: "2014 CLD 755", title: "In the matter of vs NOT Case No", header: "CONTINENTAL INSURANCE COMPANY LIMITED: In the matter of vs NOT", report: "2014 CLD 755, 2014 CLD 686", accepted: false },
    { citation: "2019 PSC 631", title: "Dr. Tariq Iqbal vs Government of KPK", header: "Dr. Tariq Iqbal vs Government of KPK", report: "2019 SCMR 859, 2019 SCP\n260, 2019 P.S.C. 631", accepted: true },
  ];
  for (const item of cases) {
    const opening = `Court Name: Supreme Court\nTitle: ${item.header}\nReported As: ${item.report}\nResult: disposed\n${"Stored judgment body. ".repeat(30)}`;
    const record = { ...row, id: "00000000-0000-4000-8000-000000000001", citation: item.citation, title: item.title, opening, fullText: opening };
    const search = handler("search_case_law", { ...base, judgments: {}, sql: () => "", resolveJudgment: async () => record, judgmentSourceUrl: () => "link", assessJudgmentIdentity, judgmentPdfUrl, extractSubstantiveSummary, retrieveLegalCaseLaw: async () => ({ rows: [{ id: 1, citation: item.citation }] }) });
    const result = (await search({ query: item.citation, limit: 5, includeUnverified: false })).structuredContent;
    assert.equal(result.judgments.length, item.accepted ? 1 : 0);
    const get = handler("get_judgment", { ...base, storage: { getJudgmentDetail: async () => record }, protectJudgmentDetail: async () => prepareJudgmentDetail(record, record), judgmentSourceUrl: () => "link" });
    const detail = (await get({ id: record.id })).structuredContent;
    assert.equal(detail.contentFormat, item.accepted ? "text" : "unavailable");
    assert.equal(detail.fullText, item.accepted ? opening : undefined);
    assert.equal(detail.title, item.accepted ? item.title : undefined);
  }
});
