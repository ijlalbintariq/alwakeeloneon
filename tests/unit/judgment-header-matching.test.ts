import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { readJudgmentHeader, assessJudgmentIdentity, parseCitation, splitCitations, citationMatchesCourt, citationIdentifiesJudgment, normalizeCitation } from "../../server/citation-verify";

test("citation lookup rejects conflicting numeric keys but preserves exact docket identities", async () => {
  const source = ts.createSourceFile("verify.ts", fs.readFileSync("server/citation-verify.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "resolveJudgment")!;
  const code = ts.transpileModule(`(${declaration.getText(source).replace(/^export\s+/, "")})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const run = async (raw: string, rows: any[]) => {
    const db = { select: () => ({ from: () => ({ where: () => ({ limit: async () => rows.shift() || [] }) }) }) };
    const deps = { db, getJournalCodes: async () => new Map([["SCMR", 1], ["PLD", 2]]), judgments: {}, citationMatchesCourt, citationIdentifiesJudgment, normalizeCitation, parseCitation, splitCitations, eq: () => ({}), and: () => ({}), sql: () => ({}) };
    return new Function(...Object.keys(deps), `return ${code}`)(...Object.values(deps))(raw, { id: true });
  };
  const row = (citation: string) => ({ id: "case", __lookupCitation: citation, __lookupCourt: "Supreme Court" });
  assert.equal(await run("2020 SCMR 10", [[], [row("2020 SCMR 11")]]), undefined);
  assert.deepEqual(await run("SCMR 2020 10", [[], [row("2020 SCMR 10")]]), { id: "case" });
  assert.deepEqual(await run("Const. P. 11/2026 (SHC)", [[{ ...row("Const. P. 11/2026 (SHC)"), __lookupCourt: "Sindh High Court" }]]), { id: "case" });
});

const reported = Array.from({ length: 15 }, (_, index) => `2020 SCMR ${index + 10}`).join(", ") + "\n2020 P SC 1127, 2020 SCMR 2000";
const text = `Court Name: Supreme Court of Pakistan\nJudge(s): ${"Judicial bench ".repeat(70)}\nTitle: Ahmad Khan vs State\nCase No.: 12\nReported As: ${reported}\nResult: allowed\n${"Legal reasoning. ".repeat(30)}`;

test("full wrapped parallel citations survive late headers and the old 160-character limit", () => {
  assert.ok(text.indexOf("Reported As:") > 800);
  assert.ok(reported.indexOf("P SC") > 160);
  assert.equal(readJudgmentHeader(text).reported, reported.replace("\n", ", "));
  assert.equal(assessJudgmentIdentity({ citation: "2020 PSC 1127", title: "Ahmad Khan vs State", court: "Supreme Court", opening: text, textStatus: "own" }).textIntegrity, "own");
  assert.equal(assessJudgmentIdentity({ citation: "1971 PLD 110", title: "Ahmad Khan vs State", court: "Supreme Court", opening: text, textStatus: "own" }).identityConflict, true);
});

test("Markdown metadata is read without rewriting legal text or bypassing mislabeled status", () => {
  const markdown = `## Court Name: Supreme Court\n**Title:** Ahmad Khan vs State\n**Reported As:** 2020 P SC 1127\n**Result:** allowed\n${"**Original legal wording.** ".repeat(30)}`;
  assert.deepEqual(readJudgmentHeader(markdown), { title: "Ahmad Khan vs State", reported: "2020 P SC 1127", court: "Supreme Court" });
  assert.equal(assessJudgmentIdentity({ citation: "2020 PSC 1127", title: "Ahmad Khan vs State", court: "Supreme Court", opening: markdown, textStatus: "own" }).textIntegrity, "own");
  assert.equal(assessJudgmentIdentity({ citation: "2020 PSC 1127", title: "Ahmad Khan vs State", court: "Supreme Court", opening: markdown, textStatus: "mislabeled" }).textIntegrity, "mislabeled");
});

test("an SCMR header cannot verify a body explicitly identified as a High Court judgment", () => {
  const highCourt = text.replace("Supreme Court of Pakistan", "Sindh High Court");
  assert.equal(citationMatchesCourt("2020 SCMR 2000", "Sindh High Court"), false);
  assert.equal(citationMatchesCourt("2020 SCMR 2000", "Supreme Court of Pakistan"), true);
  assert.equal(assessJudgmentIdentity({ citation: "2020 SCMR 2000", title: "Ahmad Khan vs State", court: "Sindh High Court", opening: highCourt, textStatus: "own" }).identityConflict, true);
});

test("the labeling CLI uses complete shared headers and keeps unrelated citations mislabeled", async () => {
  const source = ts.createSourceFile("labels.ts", fs.readFileSync("script/judgment_text_label.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "main")!;
  const code = ts.transpileModule(`(${declaration.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let plan = "";
  const commands: string[] = [];
  const members = [{ id: "psc", year: 2020, journal_id: 1, page: 1127, citation_string: "2020 PSC 1127", journal_code: "PSC" }, { id: "scmr", year: 2020, journal_id: 2, page: 2000, citation_string: "2020 SCMR 2000", journal_code: "SCMR" }, { id: "wrong", year: 1971, journal_id: 3, page: 110, citation_string: "1971 PLD 110", journal_code: "PLD" }];
  class Client {
    async connect() {} async end() {}
    async query(sql: string) {
      commands.push(sql);
      if (/select id, code from law_journals/.test(sql)) return { rows: [{ id: 1, code: "PSC" }, { id: 2, code: "SCMR" }, { id: 3, code: "PLD" }] };
      if (/select year, journal_id, page/.test(sql)) return { rows: members };
      if (/with shared as/.test(sql)) {
        const limit = Number(sql.match(/left\(j\.full_text,\s*(\d+)\)/)?.[1] || 0);
        return { rows: members.map(row => ({ ...row, h: "shared-body", head: text.slice(0, limit) })) };
      }
      if (/count\(\*\)/.test(sql)) return { rows: [{ n: members.length }] };
      throw new Error(`Unexpected query: ${sql}`);
    }
  }
  const dependencies = { Client, loadDatabaseUrl: () => "synthetic", requireColumns: async () => {}, RESET: false, APPLY: false, PLAN_FILE: "synthetic.csv", canonJournalCode: (value: string) => value.toUpperCase(), parseCitation, splitCitations, readJudgmentHeader, citationMatchesCourt, bodyCourt: () => "SC", HIGH_COURT_NEUTRAL: new Set(), SUPREME_COURT_ONLY: new Set(["SCMR"]), writeFileSync: (_path: string, value: string) => { plan = value; }, console: { log() {} } };
  await new Function(...Object.keys(dependencies), `return ${code}`)(...Object.values(dependencies))();
  assert.match(plan, /,own,"2020 PSC 1127"/);
  assert.match(plan, /,own,"2020 SCMR 2000"/);
  assert.match(plan, /,mislabeled,"1971 PLD 110"/);
  assert.ok(!commands.some(sql => /^\s*(?:update|delete|insert)/i.test(sql)));
});
