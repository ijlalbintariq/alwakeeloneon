import test from "node:test";
import assert from "node:assert/strict";
import { citationCourtQualifier, citationMatchesCourt, resolveJudgment, assessJudgmentIdentity, splitCitations } from "../../server/citation-verify";
import { db } from "../../server/db";
import { lawJournals } from "../../shared/schema";

test("citation court qualifiers survive formatting, reporter order and pin cites", () => {
  for (const raw of ["PLD 1972 SC 70", "1972 PLD SC 70", "P. L. D. 1972 S. C. 70", "PLD1972SC70", "PLD 1972 70 (SC)", "PLD 1972 70 (Supreme Court)", "PLD 1972 SC 70 at 73"]) {
    assert.equal(citationCourtQualifier(raw), "supreme:pakistan", raw);
    assert.equal(citationMatchesCourt(raw, "High Court of Azad Jammu and Kashmir"), false, raw);
  }
  assert.equal(citationMatchesCourt("PLD 1972 Azad J & K 70", "High Court of Azad Jammu and Kashmir"), true);
  assert.equal(citationMatchesCourt("PLD 1986 SC AJK 56", "Supreme Court of Pakistan"), false);
  assert.equal(citationMatchesCourt("PLD 1986 SC AJK 56", "Supreme Court of Azad Jammu and Kashmir"), true);
  assert.equal(citationMatchesCourt("PLD 1986 Supreme Court of Azad Jammu and Kashmir 56", "Supreme Court of Pakistan"), false);
  assert.equal(citationMatchesCourt("PLD 1972 High Court of Azad Jammu and Kashmir 70", "High Court of Azad Jammu and Kashmir"), true);
  assert.deepEqual(splitCitations("PLD 1972 SC 70 and 1972 SCMR 100"), ["PLD 1972 SC 70", "1972 SCMR 100"]);
  assert.deepEqual(splitCitations("KLR 2001 Labour and Service Cases 52"), ["KLR 2001 Labour and Service Cases 52"]);
  assert.equal(citationMatchesCourt("PLD 1972 SC 70", null), false);
  assert.equal(citationMatchesCourt("PLD 1972 SC 70, 1972 PLD 70", "High Court of Azad Jammu and Kashmir"), false);
});

test("journal acronyms and narrative terms do not invent court qualifiers", () => {
  for (const raw of ["2024 SCMR 1085", "S C M R 2024 1085", "2019 P.S.C. 631", "1972 PLD 70", "bail before the Supreme Court", "2024 SCMR 1085 concerning Punjab Government"]) assert.equal(citationCourtQualifier(raw), null, raw);
  assert.equal(citationMatchesCourt("2024 SCMR 1085", "Supreme Court of Pakistan"), true);
  assert.equal(citationMatchesCourt("PLD 2022 Sindh 565", "High Court of Sindh"), true);
  assert.equal(citationMatchesCourt("PLD 2022 Sindh 565", "Lahore High Court"), false);
  assert.equal(citationMatchesCourt("PLD 1955 FC 240", "Federal Court of Pakistan"), true);
  assert.equal(citationMatchesCourt("PLD 1970 Dacca 338", "High Court of East Pakistan"), true);
  assert.equal(citationMatchesCourt("PLD 2022 S. H. C. 565", "Sindh High Court"), true);
  assert.equal(citationMatchesCourt("PLD 2022 565 (S. H. C.)", "Supreme Court of Pakistan"), false);
  assert.equal(citationMatchesCourt("PLD 2022 High Court 565", "Supreme Court of Pakistan"), false);
  assert.equal(citationMatchesCourt("2025 LHC 7088", "Supreme Court of Pakistan"), false);
  assert.equal(citationMatchesCourt("2025 LHC 7088", "Lahore High Court"), true);
});

test("record checks reject a reporting court qualifier even without a Court Name field", () => {
  const record = { citation: "1972 PLD 70", title: "Example Government vs Example Khan", court: "Supreme Court of Pakistan", textStatus: "own", opening: `Title: Example Government vs Example Khan\nReported As: PLD 1972 Azad J & K 70\nResult: allowed\n${"Judgment body. ".repeat(30)}` };
  assert.equal(assessJudgmentIdentity(record).identityConflict, true);
});

test("actual resolver refuses wrong-court rows and removes private lookup fields", async () => {
  const original = db.select;
  let candidate: any = { id: "ajk-record", __lookupCourt: "High Court of Azad Jammu and Kashmir" };
  (db as any).select = () => ({ from: (table: any) => table === lawJournals
    ? Promise.resolve([{ id: 1, code: "PLD" }])
    : { where: () => ({ limit: async () => candidate ? [candidate] : [] }) } });
  try {
    // Literal and structured paths must both enforce the requested court.
    assert.equal(await resolveJudgment("PLD 1972 SC 70", { id: "id" }), undefined);
    let query = 0;
    (db as any).select = () => ({ from: () => ({ where: () => ({ limit: async () => ++query === 1 ? [] : [candidate] }) }) });
    assert.equal(await resolveJudgment("PLD 1972 SC 70", { id: "id" }), undefined);
    (db as any).select = () => ({ from: () => ({ where: () => ({ limit: async () => [candidate] }) }) });
    assert.deepEqual(await resolveJudgment("PLD 1972 Azad J & K 70", { id: "id" }), { id: "ajk-record" });
    candidate = { id: "unknown-court", __lookupCourt: null };
    assert.equal(await resolveJudgment("PLD 1972 SC 70", { id: "id" }), undefined);
    assert.deepEqual(await resolveJudgment("1972 PLD 70", { id: "id" }), { id: "unknown-court" });
  } finally { (db as any).select = original; }
});
