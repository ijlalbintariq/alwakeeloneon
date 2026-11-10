import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { courtsRef, judgments } from "../../shared/schema";
import { BLOG_ARTICLES } from "../../shared/blog-data";
import { assessJudgmentIdentity } from "../../server/citation-verify";
import { indexableJudgmentCandidateFilter } from "../../server/judgment-indexability";
import { handleSitemapStatic } from "../../server/sitemap";

const one = "11111111-1111-4111-8111-111111111111";
const two = "22222222-2222-4222-8222-222222222222";
const body = `Court Name: Supreme Court\nTitle: Ahmad Khan vs State\nReported As: 2024 SCMR 1085\nResult: allowed\n${"Actual judicial reasoning. ".repeat(20)}`;
const own = { id: one, citation: "2024 SCMR 1085", title: "Ahmad Khan vs State", court: "Supreme Court", opening: body, textStatus: "own", isActive: true, canonicalJudgmentId: null };
function compile(file: string, name: string, deps: Record<string, any>) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)!;
  assert.ok(node, name);
  const code = ts.transpileModule(`(${node.getText(source).replace(/^export\s+/, "")})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(deps), `return ${code}`)(...Object.values(deps));
}
function response() {
  return { statusCode: 200, body: "", headers: {} as Record<string, string>,
    setHeader(key: string, value: string) { this.headers[key] = value; return this; },
    status(value: number) { this.statusCode = value; return this; },
    type(_value: string) { return this; }, send(value: string) { this.body = value; return this; } };
}
function mockDb(batches: any[][]) {
  const captures: { fields: any; predicate?: any; order?: any[] }[] = [];
  const db = { select(fields: any) {
    const capture: any = { fields }; captures.push(capture);
    const rows = batches.shift() ?? [];
    const chain: any = { then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject) };
    for (const name of ["from", "leftJoin", "limit", "offset"]) chain[name] = () => chain;
    chain.where = (predicate: any) => { capture.predicate = predicate; return chain; };
    chain.orderBy = (...order: any[]) => { capture.order = order; return chain; };
    return chain;
  } };
  return { db, captures };
}
const helperDeps = { and, eq, inArray, sql, judgments, courtsRef, assessJudgmentIdentity, indexableJudgmentCandidateFilter };
const compileHelper = (db: any) => compile("server/judgment-indexability.ts", "getIndexableJudgmentIds", { ...helperDeps, db });
const sitemapFunction = (name: string, deps: Record<string, any>) => compile("server/sitemap.ts", name, deps);
const xmlEscape = sitemapFunction("xmlEscape", {});
const isoDate = sitemapFunction("isoDate", {});
const urlBlock = sitemapFunction("urlBlock", { xmlEscape });
const siteOrigin = () => "https://www.alwakeelo.com";
const quietConsole = { error() {} };

test("sitemap candidates require active, stored-own, canonical records", () => {
  const query = new PgDialect().sqlToQuery(indexableJudgmentCandidateFilter!);
  assert.match(query.sql, /"is_active" =/);
  assert.match(query.sql, /"text_status" =/);
  assert.match(query.sql, /"canonical_judgment_id" is null/i);
  assert.deepEqual(query.params, [true, "own"]);
});

test("stored-own metadata cannot index a foreign header, retired record, alias, unknown or missing case", async () => {
  const rows = [own,
    { ...own, id: two, title: "Other Person vs Federation" },
    { ...own, id: two, citation: "1995 SCMR 999" },
    { ...own, id: two, isActive: false },
    { ...own, id: two, canonicalJudgmentId: one },
    { ...own, id: two, textStatus: "unknown" },
    { ...own, id: two, textStatus: "mislabeled" },
  ];
  const mock = mockDb([rows]);
  const ids = await compileHelper(mock.db)([one, two, "33333333-3333-4333-8333-333333333333"]);
  assert.deepEqual([...ids], [one]);
  const projection = new PgDialect().sqlToQuery(mock.captures[0].fields.opening);
  assert.match(projection.sql, /left\("judgments"\."full_text", 16000\)/);
});

test("identity lookups deduplicate IDs, reject invalid UUIDs, bound batches and propagate database failures", async () => {
  const ids = Array.from({ length: 501 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`);
  const mock = mockDb([[], [], []]);
  await compileHelper(mock.db)([...ids, ids[0], "not-a-uuid"]);
  assert.equal(mock.captures.length, 3);
  assert.deepEqual(mock.captures.map(c => new PgDialect().sqlToQuery(c.predicate).params.length), [252, 252, 3]);
  await assert.rejects(compileHelper({ select() { throw new Error("database unavailable"); } })([one]), /database unavailable/);
});

test("static sitemap contains every article exactly once with its real published date and no invented homepage date", () => {
  const res = response();
  handleSitemapStatic({} as any, res as any);
  for (const article of BLOG_ARTICLES) {
    const loc = `https://www.alwakeelo.com/blog/${article.slug}`;
    assert.equal(res.body.split(`<loc>${loc}</loc>`).length - 1, 1, article.slug);
    assert.ok(res.body.includes(`<loc>${loc}</loc>\n    <lastmod>${article.publishedAt}</lastmod>`));
  }
  const homepage = res.body.match(/<url>\s*<loc>https:\/\/www\.alwakeelo\.com\/<\/loc>[\s\S]*?<\/url>/)![0];
  assert.doesNotMatch(homepage, /lastmod/);
});

test("sitemap index reports database failure instead of publishing an apparently complete empty index", async () => {
  const handler = sitemapFunction("handleSitemapIndex", { siteOrigin, countActiveJudgments: async () => { throw new Error("database unavailable"); }, console: quietConsole });
  const res = response();
  await handler({}, res);
  assert.equal(res.statusCode, 500);
  assert.doesNotMatch(res.body, /sitemapindex/);
});

test("judgment pages omit unconfirmed candidates and sort tied dates deterministically", async () => {
  const mock = mockDb([[{ id: one, updatedAt: new Date("2026-11-01Z") }, { id: two, updatedAt: null }]]);
  const handler = sitemapFunction("handleSitemapJudgments", { db: mock.db, judgments, indexableJudgmentCandidateFilter, desc, asc, PAGE_SIZE: 10000,
    parsePageNumber: () => 1, getIndexableJudgmentIds: async () => new Set([one]), siteOrigin, urlBlock, isoDate, console: quietConsole });
  const res = response();
  await handler({ params: { n: "1" } }, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.body, new RegExp(one));
  assert.doesNotMatch(res.body, new RegExp(two));
  assert.match(res.body, /<lastmod>2026-11-01<\/lastmod>/);
  assert.equal(mock.captures[0].order?.length, 2);
  assert.match(new PgDialect().sqlToQuery(mock.captures[0].order![1]).sql, /"id" asc/);
  assert.deepEqual(new PgDialect().sqlToQuery(mock.captures[0].predicate).params, [true, "own"]);
});

test("a page whose stored-own candidates all fail identity remains a safe empty XML response", async () => {
  const mock = mockDb([[{ id: one, updatedAt: null }]]);
  const handler = sitemapFunction("handleSitemapJudgments", { db: mock.db, judgments, indexableJudgmentCandidateFilter, desc, asc, PAGE_SIZE: 10000,
    parsePageNumber: () => 1, getIndexableJudgmentIds: async () => new Set(), siteOrigin, urlBlock, isoDate, console: quietConsole });
  const res = response(); await handler({ params: { n: "1" } }, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /<urlset/);
  assert.doesNotMatch(res.body, /<loc>/);
});

test("curated priority and tier2 use current confirmed IDs and actual modification dates", async () => {
  const mock = mockDb([[{ id: one, updatedAt: new Date("2026-11-02Z") }]]);
  const build = sitemapFunction("listedJudgmentBlocks", { db: mock.db, judgments, and, inArray, indexableJudgmentCandidateFilter, getIndexableJudgmentIds: async () => new Set([one]), urlBlock, isoDate });
  const blocks = await build([one, two], siteOrigin(), "weekly", "1.0");
  assert.equal(blocks.length, 1);
  assert.match(blocks[0], /<lastmod>2026-11-02<\/lastmod>/);
  assert.doesNotMatch(blocks[0], new RegExp(two));
  for (const name of ["handleSitemapJudgmentsPriority", "handleSitemapJudgmentsTier2"]) {
    const handler = sitemapFunction(name, { siteOrigin, path: { resolve: () => "list.json" }, process,
      fs: { readFileSync: () => JSON.stringify([{ id: one, date: "1999-01-01" }]) },
      listedJudgmentBlocks: async () => { throw new Error("database unavailable"); }, console: quietConsole });
    const res = response(); await handler({}, res);
    assert.equal(res.statusCode, 500);
    assert.doesNotMatch(res.body, /<loc>/);
  }
});
