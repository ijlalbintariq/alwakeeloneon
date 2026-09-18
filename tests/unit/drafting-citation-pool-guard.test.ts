import test from "node:test";
import assert from "node:assert/strict";
import { applyCitationRecordCorrections, caseCitationMatches } from "../../server/routes";

/**
 * Mirrors isInRetrievedPool in resolveLegalDraftReferences. Existing in the
 * database only proves a citation is real. A specific-performance plaint came
 * back citing 2024 SCMR 205 (a bail case) and 2014 SCMR 1365 (constitutional
 * jurisdiction) — both genuine rows, both remembered by the model rather than
 * retrieved, both shipped because verification never asked where they came from.
 */
function inPool(citation: string, pool: string[] | undefined): boolean {
  if (!Array.isArray(pool)) return true; // check disabled
  return pool.some((allowed) => caseCitationMatches(citation, allowed));
}

test("a citation the model was given is kept", () => {
  const pool = ["2024 SCMR 168", "2014 CLC 1229"];
  assert.equal(inPool("2024 SCMR 168", pool), true);
  assert.equal(inPool("2014 CLC 1229", pool), true);
});

test("a real judgment that was never retrieved is rejected", () => {
  const pool = ["2024 SCMR 168", "2014 CLC 1229"];
  // Both exist in the corpus; neither was in this draft's pool.
  assert.equal(inPool("2024 SCMR 205", pool), false);
  assert.equal(inPool("2014 SCMR 1365", pool), false);
});

test("citation formatting differences still match the pool", () => {
  const pool = ["PLD 2023 Supreme Court 617"];
  for (const written of ["PLD 2023 SC 617", "P L D 2023 SC 617", "PLD 2023 Supreme Court 617."]) {
    assert.equal(inPool(written, pool), true, `rejected an equivalent form: ${written}`);
  }
});

test("retrieval that found nothing permits no citations", () => {
  assert.equal(inPool("2024 SCMR 168", []), false);
});

test("callers that retrieve no pool at all skip the check", () => {
  assert.equal(inPool("2024 SCMR 168", undefined), true);
});

/**
 * Calls the real applyCitationRecordCorrections rather than a copy of it. An
 * earlier version of this file mirrored the logic instead, and a double-escaped
 * `\\.` in the production regex meant the party-name branch never matched while
 * every test still passed.
 */
const fix = (
  text: string,
  cited: Array<{ written: string; court?: string; title?: string }>,
) => {
  let out = text;
  const log: string[] = [];
  for (const c of cited) {
    const r = applyCitationRecordCorrections(out, {
      written: c.written,
      court: c.court || "",
      title: c.title || "",
    });
    out = r.text;
    log.push(...r.courtFixes, ...r.titleFixes);
  }
  return { out, log };
};

const SUPREME = "Supreme Court of Pakistan";

test("a misattributed court is corrected to the record", () => {
  // SCMR is the Supreme Court reporter; a live bail draft called it a High Court.
  const { out, log } = fix("As held in 2017 SCMR 956 (Sindh High Court), the recovery...", [
    { written: "2017 SCMR 956", court: SUPREME },
  ]);
  assert.match(out, /2017 SCMR 956 \(Supreme Court of Pakistan\)/);
  assert.doesNotMatch(out, /Sindh High Court/);
  assert.equal(log.length, 1);
});

test("a court already matching the record is left untouched", () => {
  const input = "Reliance is placed on 2009 SCMR 324 (Supreme Court of Pakistan) wherein...";
  const { out, log } = fix(input, [{ written: "2009 SCMR 324", court: SUPREME }]);
  assert.equal(out, input);
  assert.deepEqual(log, []);
});

test("a parenthetical that is neither a court nor a case name is left alone", () => {
  const input = "Section 497(2) Cr.P.C. read with 2017 SCMR 956 (paras 4-6) applies here.";
  assert.equal(fix(input, [{ written: "2017 SCMR 956", court: SUPREME }]).out, input);
});

test("an invented party name is dropped when the record has no title", () => {
  const { out, log } = fix(
    'Reliance is placed on 2021 SCMR 822 titled "Sheikh Abdul Raheem vs The State", wherein...',
    [{ written: "2021 SCMR 822", court: SUPREME, title: "" }],
  );
  assert.doesNotMatch(out, /Sheikh Abdul Raheem/);
  assert.match(out, /2021 SCMR 822, wherein/);
  assert.equal(log.length, 1);
});

test("party names in parentheses are corrected like a court is", () => {
  // The same prompt produced `titled "..."` on one run and `(...)` on the next.
  const { out, log } = fix(
    "Reliance is placed on 2012 YLR 1880 (WAQAR ASLAM vs ZARGHAM HAIDER SHAH). C. That there is no witness...",
    [{ written: "2012 YLR 1880", court: "Lahore High Court", title: "" }],
  );
  assert.doesNotMatch(out, /WAQAR ASLAM/);
  assert.match(out, /2012 YLR 1880\. C\. That there is no witness/);
  assert.equal(log.length, 1);
});

test("a party name that disagrees with the record is replaced by it", () => {
  const { out } = fix('As held in 2009 SCMR 324 titled "Some Other Party vs The State", the accused...', [
    { written: "2009 SCMR 324", court: SUPREME, title: "Muhammad Tanveer vs The State" },
  ]);
  assert.match(out, /2009 SCMR 324 titled "Muhammad Tanveer vs The State"/);
});

test("a party name matching the record survives in either form", () => {
  const cited = [{ written: "2009 SCMR 324", court: SUPREME, title: "Muhammad Tanveer vs The State" }];
  for (const input of [
    '2009 SCMR 324 titled "Muhammad Tanveer vs The State" applies.',
    "2009 SCMR 324 (Muhammad Tanveer vs The State) applies.",
  ]) {
    assert.equal(fix(input, cited).out, input);
  }
});
