import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { parseQualityReview } from "../../server/output-quality";
import { qualityScoreLabel } from "../../shared/quality-assessment";

const input = { feature: "chat", query: "Find family maintenance cases about proving the husband's income.", answer: "Revenue tax assessments establish the tax liability of the taxpayer. See 2024 SCMR 100.", sourceContext: "2024 SCMR 100. A supplied excerpt about the taxpayer's tax assessment, not family maintenance." };
const review = { relevance: 1, completeness: 1, caseLawRelevance: 1, requiresCaseLaw: true, requiresSources: true,
  grounding: "unsupported", confidence: 0.95, reason: "The user asks about family maintenance evidence; the answer instead gives revenue assessment law.",
  queryEvidence: "family maintenance cases", answerEvidence: "Revenue tax assessments establish the tax liability", sourceEvidence: "" };

test("polished, long, citation-bearing wrong-domain answers receive a low score", () => {
  const result = parseQualityReview(review, { ...input, answer: input.answer.repeat(50) });
  assert.equal(result.score, 1); assert.equal(result.status, "reviewed");
  assert.ok(result.flags.includes("off_topic")); assert.ok(result.flags.includes("case_law_not_relevant_or_missing"));
});

test("5/5 requires high relevance, completion, case relevance and supplied source support", () => {
  const relevant = { ...input, answer: "The court examined evidence of the husband's salary when assessing maintenance. 2024 SCMR 100.",
    sourceContext: "2024 SCMR 100. The court examined evidence of the husband's salary when assessing maintenance." };
  const high = { ...review, relevance: 5, completeness: 5, caseLawRelevance: 5, grounding: "supported", answerEvidence: "The court examined evidence of the husband's salary", sourceEvidence: relevant.sourceContext };
  assert.equal(parseQualityReview(high, relevant).score, 5);
  const missing = parseQualityReview(high, { ...relevant, sourceContext: "" });
  assert.equal(missing.score, 3); assert.equal(missing.grounding, "not_assessable");
  assert.equal(parseQualityReview({ ...high, grounding: "unsupported" }, relevant).score, 2);
});

test("a model cannot turn cited legal claims into source-free conversation or hide a low case relevance score", () => {
  const result = parseQualityReview({ ...review, relevance: 5, completeness: 5, requiresCaseLaw: false, requiresSources: false, grounding: "not_required", caseLawRelevance: 1 }, input);
  assert.equal(result.score, 1); assert.equal(result.grounding, "not_assessable");
});

test("partial reviews cannot award 5/5; uncertain reviews receive no numeric score", () => {
  const high = { ...review, relevance: 5, completeness: 5, caseLawRelevance: 5, grounding: "supported", sourceEvidence: input.sourceContext };
  const partial = parseQualityReview(high, { ...input, answer: input.answer.repeat(400) });
  assert.equal(partial.score, 4); assert.ok(partial.flags.includes("partial_review"));
  const uncertain = parseQualityReview({ ...review, confidence: 0.4 }, input);
  assert.equal(uncertain.status, "inconclusive"); assert.equal(uncertain.score, null);
});

test("fabricated evidence and malformed scores cannot be recorded as a completed assessment", () => {
  assert.throws(() => parseQualityReview({ ...review, queryEvidence: "fictional user words" }, input));
  assert.throws(() => parseQualityReview({ ...review, answerEvidence: "invented quotation" }, input));
  for (const score of [0, 6, 4.5, "5"]) assert.throws(() => parseQualityReview({ ...review, relevance: score }, input));
  assert.throws(() => parseQualityReview({}, input));
});

test("legacy, operational, pending and unavailable entries never display a numeric quality rating", () => {
  assert.equal(qualityScoreLabel({ qualityScore: 5 }), "Legacy · unassessed");
  for (const status of ["pending", "unavailable", "not_applicable", "inconclusive"] as const) {
    assert.doesNotMatch(qualityScoreLabel({ qualityScore: 5, qualityAssessment: { version: 2, status, score: null, reason: "Not reviewed", flags: [] } }), /5\/5/);
  }
  const assessment = parseQualityReview(review, input);
  assert.equal(qualityScoreLabel({ qualityScore: 5, qualityAssessment: assessment }), "1/5");
});

function compileReview(create: (...args: any[]) => any) {
  const source = ts.createSourceFile('quality.ts', fs.readFileSync('server/output-quality.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'reviewOutputQuality')!;
  const code = ts.transpileModule(node.getText(source).replace(/^export\s+/, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function('getClient', 'getOpenRouterToolModelName', 'parseQualityReview', `let activeReviews = 0; ${code}; return reviewOutputQuality;`)(() => ({ chat: { completions: { create } } }), () => 'unit-reviewer', parseQualityReview);
}

test("reviewer outage, invalid JSON and evidence failures remain explicitly unassessed", async () => {
  for (const create of [async () => { throw new Error('Timeout'); }, async () => ({ choices: [{ message: { content: 'invalid JSON' } }] }), async () => ({ choices: [{ message: { content: '{}' } }] })]) {
    const result = await compileReview(create)(input);
    assert.equal(result.status, 'unavailable'); assert.equal(result.score, null);
  }
});

test("review calls are bounded, non-retrying, and do not retain a backlog during bursts", async () => {
  let finish: ((value: any) => void) | undefined;
  let options: any;
  const run = compileReview((_body, requestOptions) => { options = requestOptions; return new Promise(resolve => { finish = resolve; }); });
  const first = run(input);
  const busy = await run(input);
  assert.equal(busy.status, 'unavailable'); assert.equal(busy.score, null);
  assert.equal(options.maxRetries, 0); assert.ok(options.signal instanceof AbortSignal);
  finish!({ choices: [{ message: { content: JSON.stringify(review) } }], usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } });
  const result = await first;
  assert.equal(result.score, 1); assert.equal(result.tokenUsage.total, 150);
});

test("an unsupported citation blocks a high rating even when the reviewer claims source support", () => {
  const result = parseQualityReview({ ...review, relevance: 5, completeness: 5, caseLawRelevance: 5, grounding: "supported", sourceEvidence: "A supplied excerpt about the taxpayer's tax assessment, not family maintenance." }, { ...input, sourceContext: "2023 SCMR 999. A supplied excerpt about the taxpayer's tax assessment, not family maintenance." });
  assert.notEqual(result.score, 5);
  assert.ok(result.flags.includes("citations_not_in_supplied_sources"));
});

function compile(file: string, name: string, dependencies: Record<string, any>) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  let node: ts.Node | undefined;
  const visit = (n: ts.Node) => { if ((ts.isMethodDeclaration(n) || ts.isFunctionDeclaration(n)) && n.name?.getText(source) === name) node = n; ts.forEachChild(n, visit); };
  visit(source); assert.ok(node);
  let text = node.getText(source).replace(/^export\s+/, '');
  if (ts.isMethodDeclaration(node)) text = text.replace(/^async\s+\w+/, 'async function');
  const code = ts.transpileModule(`(${text})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(dependencies), `return ${code}`)(...Object.values(dependencies));
}

test("logs persist an unscored pending record before review, then save its evidence and score", async () => {
  const saved: any[] = [];
  const run = compile('server/routes.ts', 'logOutputQuality', {
    storage: { logOutputQuality: async (entry: any) => { saved.push(entry); return 7; }, updateOutputQuality: async (id: number, review: any) => { saved.push({ id, review }); } },
    reviewOutputQuality: async (request: any) => { assert.equal(request.query, input.query); assert.equal(request.sourceContext, input.sourceContext); assert.equal(saved[0].qualityScore, 0); return parseQualityReview(review, input); }, console,
  });
  await run('user', 'chat', 'generator', 'System prompt is not the user question.', input.answer, { userQuery: input.query, sourceContext: input.sourceContext });
  assert.equal(saved[0].qualityAssessment.status, 'pending');
  assert.equal(saved[1].id, 7); assert.equal(saved[1].review.score, 1);
  saved.length = 0;
  await run('user', 'search-judgments', 'mcp-tool', '', '', { userQuery: 'get_judgment:id', operational: true });
  assert.equal(saved.length, 1); assert.equal(saved[0].qualityAssessment.status, 'not_applicable'); assert.equal(saved[0].qualityScore, 0);
});

test("quality averages, distributions and feature rankings exclude legacy and incomplete reviews", async () => {
  const { sql, count, desc, eq, gte, lte, and } = await import('drizzle-orm');
  const { PgDialect } = await import('drizzle-orm/pg-core');
  const { aiOutputLog, users } = await import('../../shared/schema');
  const predicates: any[] = [], projections: any[] = [];
  const values = [[{ total: 10, reviewed: 2, flagged: 1, avg: 2.5 }], [{ score: 1, cnt: 1 }, { score: 4, cnt: 1 }], [{ feature: 'chat', cnt: 2, avg: 2.5 }], [{ qualityFlags: ['off_topic'] }]];
  const db = { select(fields: any) {
    projections.push(fields); const rows = values.shift() || [];
    const chain: any = { then: (yes: any, no: any) => Promise.resolve(rows).then(yes, no) };
    for (const name of ['from','leftJoin','groupBy','orderBy','limit','offset']) chain[name] = () => chain;
    chain.where = (predicate: any) => { predicates.push(predicate); return chain; };
    return chain;
  } };
  const deps = { db, aiOutputLog, users, sql, count, desc, eq, gte, lte, and, console };
  const run = compile('server/storage.ts', 'getOutputQualityStats', deps);
  const result = await run();
  assert.equal(result.totalLogs, 10); assert.equal(result.reviewedLogs, 2); assert.equal(result.unassessedLogs, 8);
  assert.equal(result.flaggedLogs, 1); assert.equal(result.avgScore, 2.5); assert.deepEqual(result.scoreDistribution, { 1: 1, 4: 1 });
  const dialect = new PgDialect();
  const averageSql = dialect.sqlToQuery(projections[0].avg).sql;
  assert.match(averageSql, /FILTER/); assert.match(averageSql, /reviewed/); assert.match(averageSql, /version/);
  for (const predicate of predicates.slice(0,2)) {
    const text = dialect.sqlToQuery(predicate).sql; assert.match(text, /reviewed/); assert.match(text, /BETWEEN 1 AND 5/);
  }
});
