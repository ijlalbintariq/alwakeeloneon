import assert from "node:assert/strict";
import test from "node:test";
import {
  parseDecisionDate,
  mapCourtToRefId,
  parseJudgmentHeader,
} from "../../scripts/extract-judgment-metadata";

test("parseDecisionDate parses various date formats correctly", () => {
  // YYYY-MM-DD
  const date1 = parseDecisionDate("1969-08-13");
  assert.ok(date1);
  assert.equal(date1.getFullYear(), 1969);
  assert.equal(date1.getMonth(), 7); // August is index 7
  assert.equal(date1.getDate(), 13);

  // DD-MM-YYYY
  const date2 = parseDecisionDate("13-08-1969");
  assert.ok(date2);
  assert.equal(date2.getFullYear(), 1969);
  assert.equal(date2.getMonth(), 7);
  assert.equal(date2.getDate(), 13);

  // Textual date format: "28th July 2017"
  const date3 = parseDecisionDate("28th July 2017");
  assert.ok(date3);
  assert.equal(date3.getFullYear(), 2017);
  assert.equal(date3.getMonth(), 6); // July is index 6
  assert.equal(date3.getDate(), 28);

  // Textual date format: "28 July 2017"
  const date4 = parseDecisionDate("28 July 2017");
  assert.ok(date4);
  assert.equal(date4.getFullYear(), 2017);
  assert.equal(date4.getMonth(), 6);
  assert.equal(date4.getDate(), 28);

  // Invalid date format
  const dateInvalid = parseDecisionDate("not-a-date");
  assert.equal(dateInvalid, null);
});

test("mapCourtToRefId maps standard courts and codes correctly", () => {
  assert.equal(mapCourtToRefId("Supreme Court of Pakistan"), 1);
  assert.equal(mapCourtToRefId("SC"), 1);
  assert.equal(mapCourtToRefId(" Lahore High Court  "), 3); // Trimmed
  assert.equal(mapCourtToRefId("LHC"), 3);
  assert.equal(mapCourtToRefId("Sindh High Court"), 4);
  assert.equal(mapCourtToRefId("SHC"), 4);
  assert.equal(mapCourtToRefId("Federal Shariat Court"), 7);
  assert.equal(mapCourtToRefId("FSC"), 7);
  assert.equal(mapCourtToRefId("Labour Court"), null);
});

test("parseJudgmentHeader extracts title, splits petitioner/respondent, maps dates and courts", () => {
  const sampleText = `
Court Name: Lahore High Court
Judge(s): Muhammad Afzal Cheema
Title: DR. AKHTAR ALI vs THE STATE AND ANOTHER
Case No.: Criminal Revision No. 49 of 1969
Date of Judgment:1969-08-13
Reported As: PLD 1970 Lahore 450
Result: H.

JUDGMENT
This revision petition is directed against the order...
`;

  const parsed = parseJudgmentHeader(sampleText);
  assert.equal(parsed.title, "DR. AKHTAR ALI vs THE STATE AND ANOTHER");
  assert.equal(parsed.petitioner, "DR. AKHTAR ALI");
  assert.equal(parsed.respondent, "THE STATE AND ANOTHER");
  assert.ok(parsed.decisionDate);
  assert.equal(parsed.decisionDate.getFullYear(), 1969);
  assert.equal(parsed.decisionDate.getMonth(), 7); // August
  assert.equal(parsed.courtId, 3);
  assert.equal(parsed.courtNameSnapshot, "Lahore High Court");
});

test("parseJudgmentHeader handles alternate title separators and single parties", () => {
  // Separator v.
  const sampleV = "Title: Federation of Pakistan v. Muhammad Aslam\nCase No.: 123";
  const parsedV = parseJudgmentHeader(sampleV);
  assert.equal(parsedV.petitioner, "Federation of Pakistan");
  assert.equal(parsedV.respondent, "Muhammad Aslam");

  // Separator versus
  const sampleVersus = "Title: State versus John Doe\nCase No.: 123";
  const parsedVersus = parseJudgmentHeader(sampleVersus);
  assert.equal(parsedVersus.petitioner, "State");
  assert.equal(parsedVersus.respondent, "John Doe");

  // Single party / No separator
  const sampleSingle = "Title: In Re: General Company Laws\nCase No.: 123";
  const parsedSingle = parseJudgmentHeader(sampleSingle);
  assert.equal(parsedSingle.petitioner, "In Re: General Company Laws");
  assert.equal(parsedSingle.respondent, null);
});
