import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { spawnSync } from "node:child_process";
import { sql, eq, and, inArray, isNull } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { judgments, courtsRef, insertJudgmentSchema } from "../../shared/schema";
import { assessJudgmentIdentity, citationSection, isReportedCitation, citationIdentifiesJudgment, citationCanLinkDirectly, judgmentSourceUrl, citationMatchesCourt, parseCitation, splitCitations, normalizeCitation } from "../../server/citation-verify";
import { judgmentContainsExcerpt } from "../../server/rag/text-cleaner";

const legacy = "11111111-1111-4111-8111-111111111111", ownerId = "22222222-2222-4222-8222-222222222222";
const body = `Court Name: Supreme Court\nTitle: Ahmad Khan vs State\nReported As: 2024 SCMR 1085\nResult: allowed\n${"Actual findings in the original judgment. ".repeat(20)}`;
const owner = { id: ownerId, canonicalId: null, citation: "2024 SCMR 1085", title: "Ahmad Khan vs State", court: "Supreme Court", textStatus: "own", opening: body, body, bodyHash: "hash", isActive: true };
function compile(file: string, name: string, deps: Record<string, any>) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)!;
  const code = ts.transpileModule(`(${node.getText(source).replace(/^export\s+/, "")})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(deps), `return ${code}`)(...Object.values(deps));
}
function mockDb(values: any[][]) {
  return { select: () => { const rows = values.shift() || []; const chain: any = { then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject) }; for (const name of ["from", "leftJoin", "innerJoin", "where", "limit", "orderBy"]) chain[name] = () => chain; return chain; } };
}

test("retired duplicate vectors resolve to a verified canonical case without validating the false citation", async () => {
  const alias = { ...owner, id: legacy, canonicalId: ownerId, citation: "1991 PLD 2910", textStatus: "mislabeled", isActive: false, opening: "", body: null };
  const db = mockDb([[alias], [owner]]);
  const get = compile("server/storage.ts", "getValidatedJudgmentIntegrity", { db, sql, eq, inArray, judgments, courtsRef, UUID_RE: /^[a-f0-9-]{36}$/, assessJudgmentIdentity, cleanCaseTitle: (value: string) => value });
  const identities = new Map();
  const statuses = await get([legacy], identities, [legacy]);
  assert.equal(statuses.get(legacy), "mislabeled");
  assert.equal(statuses.get(ownerId), "own");
  assert.equal(identities.get(legacy).canonicalId, ownerId);
  const drop = compile("server/rag/rag-service.ts", "dropMislabeledJudgmentChunks", { getValidatedJudgmentIntegrity: async (_ids: string[], metadata: Map<string, any>) => { for (const pair of identities) metadata.set(...pair); return statuses; }, judgmentContainsExcerpt, judgmentSourceUrl, console });
  const match = { title: "Wrong old index title", chunkText: "Actual findings in the original judgment.", metadata: { sourceType: "judgment", judgmentId: legacy, citation: "1991 PLD 2910", citationString: "1991 PLD 2910", judgmentBodyHash: "hash" } };
  const [result] = await drop([match]);
  assert.equal(result.metadata.judgmentId, ownerId);
  assert.equal(result.metadata.citation, owner.citation);
  assert.equal(result.metadata.citationString, owner.citation);
  assert.equal(result.metadata.sourceUrl, judgmentSourceUrl(ownerId));
  assert.equal(result.chunkText, match.chunkText);
  assert.deepEqual(await drop([{ ...match, chunkText: "Foreign old parent paragraph" }]), []);
  assert.deepEqual(await drop([{ ...match, matchedText: "Foreign old matched child" }]), []);
  const [childOnly] = await drop([{ ...match, chunkText: "CITATION: 1991 PLD 2910. A stale parent from another case", matchedText: match.chunkText }]);
  assert.equal(childOnly.chunkText, match.chunkText);
  assert.equal(childOnly.metadata.judgmentId, ownerId);
  assert.equal(childOnly.metadata.citationString, owner.citation);
});

test("inactive, unverified and chained owners cannot rescue duplicate vectors", async () => {
  const alias = { ...owner, id: legacy, canonicalId: ownerId, isActive: false, textStatus: "mislabeled" };
  for (const bad of [{ ...owner, isActive: false }, { ...owner, textStatus: "unknown" }, { ...owner, canonicalId: legacy }]) {
    const get = compile("server/storage.ts", "getValidatedJudgmentIntegrity", { db: mockDb([[alias], [bad]]), sql, eq, inArray, judgments, courtsRef, UUID_RE: /^[a-f0-9-]{36}$/, assessJudgmentIdentity, cleanCaseTitle: (value: string) => value });
    const identities = new Map();
    await get([legacy], identities);
    assert.equal(identities.has(legacy), false);
  }
});

test("UUID readers follow only one verified ownership hop and do not expose archived records", async () => {
  const source = ts.createSourceFile("storage.ts", fs.readFileSync("server/storage.ts", "utf8"), ts.ScriptTarget.Latest, true);
  let method: ts.MethodDeclaration | undefined;
  const visit = (node: ts.Node) => { if (ts.isMethodDeclaration(node) && node.name.getText(source) === "getJudgmentDetail") method = node; ts.forEachChild(node, visit); }; visit(source);assert.ok(method);
  const code = ts.transpileModule(`(${method.getText(source).replace(/^async\s+getJudgmentDetail/, "async function")})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const load = (rows: any[][]) => {
    const deps = { db: mockDb(rows), sql, eq, inArray, desc: () => ({}), judgments, courtsRef, lawJournals: {}, citationLinks: {}, assessJudgmentIdentity, citationSection, isReportedCitation, citationIdentifiesJudgment, citationCanLinkDirectly, cleanCaseTitle: (value: string) => value };
    const read = new Function(...Object.keys(deps), `return ${code}`)(...Object.values(deps));
    const instance = { getJudgmentDetail: read };
    return (id: string) => read.call(instance, id);
  };
  const row = { ...owner, canonicalJudgmentId: null, courtName: "Supreme Court", fullText: body };
  const result = await load([[{ id: legacy, canonicalJudgmentId: ownerId, isActive: false }], [row], [], []])(legacy);
  assert.equal(result.id, ownerId);
  assert.equal(result.citation, owner.citation);
  assert.equal(result.fullText, body);
  assert.equal(await load([[{ id: legacy, canonicalJudgmentId: ownerId }], [{ id: ownerId, canonicalJudgmentId: legacy }]])(legacy), undefined);
  assert.equal(await load([[{ id: legacy, canonicalJudgmentId: null, isActive: false }]])(legacy), undefined);
});

test("citation queries explicitly exclude duplicate identities and reject court ambiguity", async () => {
  let predicate: any;
  const db = { select: () => ({ from: () => ({ where: (value: any) => { predicate = value; return { limit: async () => [] }; } }) }) };
  const resolve = compile("server/citation-verify.ts", "resolveJudgment", { db, getJournalCodes: async () => new Map([["PLD", 1]]), judgments, sql, eq, and, isNull, citationSection, isReportedCitation, citationMatchesCourt, citationIdentifiesJudgment, parseCitation, splitCitations, normalizeCitation });
  await resolve("PLD 2022 Sindh 565", { id: judgments.id });
  const query = new PgDialect().sqlToQuery(predicate);
  assert.match(query.sql, /"is_active" = \$\d/);
  assert.match(query.sql, /"canonical_judgment_id" is null/i);
  assert.ok(query.params.includes(true));
});

test("normal insertion cannot manufacture canonical redirects and legacy exporters cannot invent pages", () => {
  assert.deepEqual(insertJudgmentSchema.partial().parse({ canonicalJudgmentId: ownerId }), {});
  for (const file of ["scripts/export-sqlite-missing.py", "scripts/prepare_missing_payload.py"]) {
    const result = spawnSync("python3", [file], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unsafe legacy export disabled/);
    assert.doesNotMatch(result.stdout, /Loading production|Existing Neon/);
  }
});

test("a suggested text-owner link requires the complete original body, not citation existence", async () => {
  const deps = { db: mockDb([[{ bodyHash: "source-hash" }]]), judgments, sql, eq,
    UUID_RE: /^[a-f0-9-]{36}$/i, splitCitations, assessJudgmentIdentity,
    resolveJudgment: async () => ({ ...owner, bodyHash: "different-case-hash" }) };
  const find = compile("server/storage.ts", "findTextOwnerJudgment", deps);
  assert.equal(await find(owner.citation, legacy), null);
  const confirmed = compile("server/storage.ts", "findTextOwnerJudgment", { ...deps,
    db: mockDb([[{ bodyHash: "source-hash" }]]), resolveJudgment: async () => ({ ...owner, bodyHash: "source-hash" }) });
  assert.deepEqual(await confirmed(owner.citation, legacy), { id: ownerId, citation: owner.citation });
  assert.equal(await find(owner.citation), null);
});

test("bulk reference resolution preserves court sections instead of taking the last numeric match", async () => {
  const source = ts.createSourceFile('extractor.ts',fs.readFileSync('server/services/citation-extractor.ts','utf8'),ts.ScriptTarget.Latest,true);
  let method:ts.MethodDeclaration|undefined;
  const visit=(node:ts.Node)=>{if(ts.isMethodDeclaration(node)&&node.name.getText(source)==='resolveCitations')method=node;ts.forEachChild(node,visit);};visit(source);assert.ok(method);
  const make=(id:string,court:string,seat:string)=>({id,year:2022,page:565,journal_code:'PLD',citation:`2022 PLD 565`,title:'Ahmad Khan vs State',court,textStatus:'own',opening:`Court Name: ${court}\nTitle: Ahmad Khan vs State\nReported As: PLD 2022 ${seat} 565\nResult: allowed\n${'Legal findings. '.repeat(30)}`});
  const sc=make('sc','Supreme Court','SC'),shc=make('shc','Sindh High Court','Sindh');
  const db={execute:async()=>({rows:[sc,sc,shc]})};
  const deps={db,sql,citationIdentifiesJudgment,citationCanLinkDirectly,assessJudgmentIdentity};
  const code=ts.transpileModule(`(${method.getText(source).replace(/^async\s+resolveCitations/,'async function')})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const resolve=new Function(...Object.keys(deps),`return ${code}`)(...Object.values(deps));
  const input=['PLD 2022 SC 565','PLD 2022 Sindh 565','2022 PLD 565'].map(rawCitation=>({rawCitation,year:2022,page:565,journalCode:'PLD',startOffset:0,contextExcerpt:''}));
  const results=await resolve(input);
  assert.deepEqual(results.map((r:any)=>r.citedJudgmentId),['sc','shc',null]);
  sc.textStatus='unknown';
  assert.equal((await resolve(input))[0].citedJudgmentId,null);
});
