import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { nlpExtractCases, assignCitationRolesToCases } from "../../server/auto-extract-caselaw";

const text = `2024 SCMR 1085
Ahmad Khan vs State
Reported As: 2024 SCMR 1085
JUDGMENT
HELD: The present appeal is allowed because the evidence in this case does not establish the alleged offence.

${"The court examined the facts and evidence in the present appeal. ".repeat(50)}
Counsel relied on 2019 SCMR 1234. The cited decision was distinguished.
`;

test("cited cases do not inherit the source judgment's title, summary, or topics", () => {
  const rows = nlpExtractCases(text);
  const primary = rows.find(row => row.citation.includes("1085"));
  const cited = rows.find(row => row.citation.includes("1234"));
  assert.equal(primary?.citationRole, "primary");
  assert.equal(cited?.citationRole, "cited");
  assert.doesNotMatch(JSON.stringify(cited), /Ahmad|appeal is allowed|present appeal/);
  assert.deepEqual(cited?.keywords, []);
});

test("a narrative citation is never promoted merely because it appears first", () => {
  const prose = `Ahmad Khan vs State\nJUDGMENT\nCounsel cited 2019 SCMR 1234. ${"We consider that reference below. ".repeat(30)}`;
  const rows = nlpExtractCases(prose);
  assert.ok(rows.length > 0);
  assert.ok(rows.every(row => row.citationRole === "cited"));
  const mapped = assignCitationRolesToCases(prose, [{ citation: "2019 SCMR 1234", court: "Wrong court", title: "Wrong Title", summary: "Wrong holding", keywords: ["wrong topic"] }]);
  assert.equal(mapped[0].citationRole, "cited");
  assert.doesNotMatch(JSON.stringify(mapped), /Wrong|wrong/);
});

test("reported identity wins over a conflicting filename hint", () => {
  const rows = nlpExtractCases(text, { sourceFilename: "2020LHC999.txt" });
  assert.equal(rows.find(row => row.citation.includes("1085"))?.citationRole, "primary");
  assert.equal(rows.find(row => row.citation.includes("999"))?.citationRole, "cited");
});

test("re-extraction caps preserve reference-only results", () => {
  for (const [file, name, normalize] of [
    ["server/routes.ts", "capExtractedCaseRows", "normalizeExtractedCaseRow"],
    ["script/caselaw_reextract_problem_docs.ts", "capExtractedCases", "normalizeExtractedCase"],
  ]) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.ok(declaration);
    const js = ts.transpileModule(`(${declaration.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const cap = new Function(normalize, "buildCaseLawDedupKey", `return ${js}`)((row: any) => row, (row: any) => row.citation);
    const result = cap([{ citation: "2019 SCMR 1234", citationRole: "cited" }], 5);
    assert.equal(result[0].citationRole, "cited", file);
  }
});
