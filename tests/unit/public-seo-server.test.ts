import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";
import { and, count, desc, eq } from "drizzle-orm";
import { judgments, courtsRef, lawJournals } from "../../shared/schema";
import { directoryOptions } from "../../server/judgment-directory";
import { indexableJudgmentCandidateFilter } from "../../server/judgment-indexability";
import { renderPublicMarkdown, serializeJsonLd, isKnownSpaRoute } from "../../server/static";
import { buildCanonicalUrl, injectSeoMeta, lookupSeoMeta } from "../../server/seo-meta";
import { blogReadMinutes, BLOG_REVIEW_NOTICE } from "../../shared/blog-editorial";

test("initial public metadata agrees with marketing canonicals while workspace pages remain noindex", () => {
  for (const [old, target] of [["/preview", "/"], ["/preview/about", "/about"], ["/preview/blog", "/blog"]]) {
    assert.equal(buildCanonicalUrl(old), `https://www.alwakeelo.com${target}`);
    assert.equal(lookupSeoMeta(old).index, true);
  }
  for (const path of ["/cases", "/case-files", "/preview/dashboard", "/auth", "/does-not-exist"]) {
    assert.equal(lookupSeoMeta(path).index, false);
  }
  const template = '<title>Default</title><link id="canonical-link" rel="canonical" href="old" />';
  const html = injectSeoMeta(template, "/judgments/browse", { title: "Directory", description: "Cases", index: true,
    canonicalPath: "/judgments/browse?year=2024&page=2" });
  assert.match(html, /\/judgments\/browse\?year=2024&amp;page=2/);
  assert.equal(isKnownSpaRoute('/pricing'), true);
  assert.equal(buildCanonicalUrl('/preview/pricing'), 'https://www.alwakeelo.com/pricing');
  assert.equal(lookupSeoMeta('/pricing').index, true);
});

test("database titles cannot escape a structured-data script", () => {
  const value = { '@type':'Legislation', name:'</script><script>alert(1)</script>' };
  const serialized = serializeJsonLd(value);
  assert.doesNotMatch(serialized, /<\/script|<script/);
  assert.deepEqual(JSON.parse(serialized), value);
});

test("server Markdown supplies semantic headings, lists and links without executing embedded HTML", () => {
  const html = renderPublicMarkdown('# Already in template\n\n## Legal issue\n\n- First\n- Second\n\n[Source](https://www.pakistancode.gov.pk/english/)\n\n<script>alert(1)</script>\n\n[Unsafe](javascript:alert(1))');
  assert.doesNotMatch(html, /<h1|<script|href="javascript:/);
  assert.match(html, /<h2>Legal issue<\/h2>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<a href="https:\/\/www.pakistancode.gov.pk\/english\/">Source<\/a>/);
  assert.match(BLOG_REVIEW_NOTICE, /reviewer is not recorded/);
  assert.equal(blogReadMinutes("word ".repeat(201)), 2);
});

test("runtime startup preserves the server's canonical and Open Graph URLs", () => {
  const original = 'https://www.alwakeelo.com/judgment/known-case';
  let canonical = original, ogUrl = original;
  vm.runInNewContext(fs.readFileSync('client/public/runtime-init.js', 'utf8'), {
    window: { location: { origin:'https://example.test', hostname:'example.test' } }, navigator: {},
    document: { getElementById(id: string) { return {setAttribute(_name: string, value: string) { if(id==='canonical-link')canonical=value;else ogUrl=value; }}; } },
  });
  assert.equal(canonical, original);
  assert.equal(ogUrl, original);
});

test("directory filters reject invalid or unbounded values", () => {
  assert.deepEqual(directoryOptions(new URLSearchParams('courtId=2&year=2024&page=3&limit=25')),
    { courtId: 2, journalId: undefined, year: 2024, page: 3, limit: 25 });
  for (const input of ['page=-1', 'page=Infinity', 'page=100001', 'limit=1000', 'courtId=no', 'year=1.5']) {
    assert.throws(() => directoryOptions(new URLSearchParams(input)), RangeError);
  }
});

test("public directory omits unsafe headers without dropping remaining pagination slots", async () => {
  const source = ts.createSourceFile('directory.ts', fs.readFileSync('server/judgment-directory.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'getPublicJudgmentDirectory')!;
  const code = ts.transpileModule('(' + node.getText(source).replace(/^export\s+/, '') + ')', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  let call = 0;
  const db = {select() {
    const rows = call++ === 0 ? [{value:101}] : [{id:'safe', title:'Current case'}, {id:'unsafe', title:'Wrong case'}];
    const chain: any = {then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject)};
    for (const method of ['from','where','innerJoin','leftJoin','orderBy','limit','offset']) chain[method] = () => chain;
    return chain;
  }};
  const deps = { db, directoryOptions, and, count, desc, eq, judgments, courtsRef, lawJournals, indexableJudgmentCandidateFilter,
    getIndexableJudgmentIds: async (ids: string[]) => { assert.deepEqual(ids, ['safe','unsafe']); return new Set(['safe']); } };
  const run = new Function(...Object.keys(deps), 'return ' + code)(...Object.values(deps));
  const result = await run(new URLSearchParams());
  assert.deepEqual(result.items.map((row: any) => row.id), ['safe']);
  assert.equal(result.pagination.totalIsEstimate, true);
  assert.equal(result.pagination.hasMore, true);
  assert.equal(result.pagination.totalPages, 3);
});
