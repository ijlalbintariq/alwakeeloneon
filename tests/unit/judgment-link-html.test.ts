import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { prepareJudgmentDetail, citationMatchesCourt } from "../../server/citation-verify";
import { injectSeoMeta } from "../../server/seo-meta";
import { linkifyCitationsInHtml } from "../../server/static";

const source = ts.createSourceFile("static.ts", fs.readFileSync("server/static.ts", "utf8"), ts.ScriptTarget.Latest, true);
function compile(name: string, deps: Record<string, any>): (...args: any[]) => Promise<any> {
  let declaration: ts.FunctionDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node;
    ts.forEachChild(node, visit);
  };
  visit(source); assert.ok(declaration);
  const js = ts.transpileModule(`(${declaration.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(deps), `return ${js}`)(...Object.values(deps));
}
const id = "00000000-0000-4000-8000-000000000001";
const title = "Sardar Begum Farooqui vs Azhar Masood Farooqui";
const text = `Court Name: Sindh High Court\nTitle: ${title}\nReported As: PLD 2022 Sindh 565\nResult: dismissed\n${"The court considered the evidence and dismissed the appeal. ".repeat(30)}`;
const good = { title, citationString: "2022 PLD 565", courtNameSnapshot: "Sindh High Court", petitioner: "Sardar Begum Farooqui", respondent: "Azhar Masood Farooqui", decisionDate: new Date("2021-11-25T00:00:00Z"), fullText: text, textStatus: "own", headnotes: "UNCHECKED_HEADNOTE", pdfUrl: null };

function harness(initial: any) {
  let row = initial;
  const get = compile("getJudgmentSeoData", {
    db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => [row] }) }) }) },
    judgments: {}, eq: () => "", prepareJudgmentDetail, linkifyCitationsInHtml,
    seoActiveQueries: 0, SEO_MAX_CONCURRENT: 50, SEO_QUERY_TIMEOUT_MS: 8000, setTimeout: () => 0,
  });
  const send = compile("sendIndexWithSeo", {
    getJudgmentSeoData: get, resolveJudgment: async (raw: string) => citationMatchesCourt(raw, row.courtNameSnapshot) ? { id } : undefined,
    judgments: {}, STATIC_PRERENDER: {}, BLOG_ARTICLES: [],
    indexHtmlTemplate: '<html><head><title>Default</title><meta name="robots" content="index, follow" /></head><body><div id="root"></div></body></html>',
    injectSeoMeta, HTML_CACHE_HEADER: "public, s-maxage=300",
  });
  const page = async (url: string) => {
    const res = { headers: {} as Record<string, string>, statusCode: 0, html: "", location: "", setHeader(name: string, value: string) { this.headers[name] = value; }, status(value: number) { this.statusCode = value; return this; }, send(value: string) { this.html = value; return this; }, redirect(status: number, location: string) { this.statusCode = status; this.location = location; return this; } };
    await send({ originalUrl: url, url }, res);
    return res;
  };
  return { get, page, update: (next: any) => { row = next; } };
}

test("both judgment URL aliases publish the same guarded title and text", async () => {
  const h = harness(good);
  const singular = await h.page(`/judgment/${id}`), plural = await h.page(`/judgments/${id}`);
  for (const result of [singular, plural]) {
    assert.equal(result.statusCode, 200);
    assert.equal(result.headers["Cache-Control"], "no-store");
    assert.match(result.html, /Sardar Begum Farooqui vs Azhar Masood Farooqui/);
    assert.match(result.html, /The court considered the evidence/);
    assert.doesNotMatch(result.html, /UNCHECKED_HEADNOTE|Core Holding:|FAQPage/);
  }
  const canonicalize = (html: string) => html.replaceAll(`/judgments/${id}`, `/judgment/${id}`);
  assert.equal(canonicalize(singular.html), canonicalize(plural.html));
});

test("wrong and known mislabeled captions are withheld from HTML, metadata, and structured data", async () => {
  for (const row of [{ ...good, title: "Salman Akram Raja vs Government of Punjab" }, { ...good, textStatus: "mislabeled" }]) {
    const h = harness(row);
    const data = await h.get(id);
    assert.equal(data.meta.index, false);
    assert.equal(data.meta.schemaMarkup, "");
    const result = await h.page(`/judgments/${id}`);
    assert.match(result.html, /Judgment identity unverified/);
    assert.match(result.html, /name="robots" content="noindex/);
    assert.doesNotMatch(result.html, /Salman Akram Raja|Sardar Begum Farooqui|The court considered the evidence|UNCHECKED_HEADNOTE|CourtCase/);
  }
});

test("record repairs are visible on the next render and do not reuse old metadata", async () => {
  const h = harness({ ...good, title: "Salman Akram Raja vs Government of Punjab" });
  assert.match((await h.page(`/judgments/${id}`)).html, /Judgment identity unverified/);
  h.update(good);
  assert.match((await h.page(`/judgments/${id}`)).html, /Sardar Begum Farooqui vs Azhar Masood Farooqui/);
  h.update({ ...good, fullText: text.replace(title, "Different Person vs Different Party") });
  assert.doesNotMatch((await h.page(`/judgments/${id}`)).html, /Sardar Begum Farooqui|Different Person/);
});

test("plain text and PDF-only records remain unconfirmed in crawlable HTML", async () => {
  for (const row of [{ ...good, fullText: "Stored plain text without a usable heading. ".repeat(20) }, { ...good, fullText: "", pdfUrl: "https://example.com/original.pdf" }]) {
    const result = await harness(row).get(id);
    assert.equal(result.meta.index, false);
    assert.match(result.preRenderBlock, /Judgment identity unverified/);
    assert.doesNotMatch(result.preRenderBlock, /Sardar Begum Farooqui|Stored plain text/);
  }
});

test("citation links fail closed on court conflicts and resolve matching court aliases", async () => {
  const h = harness(good);
  assert.equal((await h.page("/judgment/PLD-2022-SC-565")).statusCode, 404);
  const match = await h.page("/judgment/PLD-2022-Sindh-565");
  assert.equal(match.statusCode, 301);
  assert.equal(match.location, `/judgment/${id}`);
});

test("rendered judgment HTML uses citation search for references without a confirmed target", async () => {
  const result = await harness({ ...good, fullText: `${text}\n\nThe court considered 2024 SCMR 1085.` }).page(`/judgment/${id}`);
  assert.match(result.html, /href="\/citation-search\?q=2024%20SCMR%201085"/);
  assert.doesNotMatch(result.html, /href="\/judgment\/2024-SCMR-1085"/);
});
