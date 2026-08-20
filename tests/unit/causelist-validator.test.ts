import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCaseNumber,
  validateSerialNumber,
  validateJudgeName,
  validateCaseItem,
  validateCauseList,
} from "../../server/services/causelist/validator";
import { computeSha256 } from "../../server/services/causelist/document-archiver";
import { ParsedCauseList, ParsedCaseItem } from "../../server/services/causelist/types";

test("validateCaseNumber accepts standard Pakistani court case formats", () => {
  const validCases = [
    "W.P. No. 12345/2024",
    "W.P. 554/2023",
    "WP 8899/2022",
    "Crl. Misc. No. 450-B/2024",
    "Crl. Appeal 112/2021",
    "C.A. No. 89/2020",
    "C.R. 445/2019",
    "B.A. 1023/2024",
    "I.C.A. 56/2023",
    "F.A.O. 12/2021",
    "R.F.A. 78/2022",
    "Tax Ref. 34/2020",
    "Const. P. 900/2023",
    "Civil Petition 45/2024",
    "Review Petition 10/2022",
    "Suit No. 120/2021",
  ];

  for (const caseNum of validCases) {
    assert.equal(validateCaseNumber(caseNum), true, `Expected "${caseNum}" to be valid`);
  }
});

test("validateCaseNumber rejects non-case text and garbage", () => {
  const invalidCases = [
    "",
    "   ",
    "foo",
    "hello world",
    "page 1 of 5",
    "daily cause list",
  ];

  for (const caseNum of invalidCases) {
    assert.equal(validateCaseNumber(caseNum), false, `Expected "${caseNum}" to be rejected`);
  }
});

test("validateSerialNumber accepts positive integers only", () => {
  assert.equal(validateSerialNumber(1), true);
  assert.equal(validateSerialNumber(45), true);
  assert.equal(validateSerialNumber(0), false);
  assert.equal(validateSerialNumber(-5), false);
  assert.equal(validateSerialNumber(1.5), false);
  assert.equal(validateSerialNumber("1"), false);
});

test("validateJudgeName validates legitimate judicial titles and rejects header text", () => {
  assert.equal(validateJudgeName("Mr. Justice Muhammad Ameer Bhatti"), true);
  assert.equal(validateJudgeName("Hon'ble Chief Justice Aalia Neelum"), true);
  assert.equal(validateJudgeName("Justice Ali Baqar Najafi"), true);
  assert.equal(validateJudgeName("Justice Tariq Saleem Sheikh"), true);

  assert.equal(validateJudgeName("Daily Cause List"), false);
  assert.equal(validateJudgeName("Court Room"), false);
  assert.equal(validateJudgeName("Roster of Sittings"), false);
  assert.equal(validateJudgeName("12345"), false);
  assert.equal(validateJudgeName(""), false);
});

test("validateCauseList accepts a valid parsed roster", () => {
  const mockItems: ParsedCaseItem[] = [
    {
      serialNumber: 1,
      caseNumber: "W.P. No. 12345/2024",
      caseTitle: "Ahmad Ali VS The State",
      petitioner: "Ahmad Ali",
      respondent: "The State",
      petitionerAdvocate: "Chaudhry Aitzaz Ahsan",
      respondentAdvocate: "Advocate General Punjab",
      fixationPurpose: "For Arguments",
      isRedList: false,
    },
    {
      serialNumber: 2,
      caseNumber: "Crl. Misc 450-B/2024",
      caseTitle: "Tariq Mehmood VS Federation of Pakistan",
      petitioner: "Tariq Mehmood",
      respondent: "Federation of Pakistan",
      petitionerAdvocate: "Syed Ali Zafar",
      respondentAdvocate: "DAG",
      fixationPurpose: "For Notice",
      isRedList: true,
    },
  ];

  const causeList: ParsedCauseList = {
    court: "LHC",
    bench: "Principal Seat",
    hearingDate: new Date("2026-08-21T00:00:00.000Z"),
    targetDateStr: "2026-08-21",
    courtNumber: "Court Room No. 3",
    judgeName: "Mr. Justice Ali Baqar Najafi",
    listType: "regular",
    items: mockItems,
  };

  const result = validateCauseList(causeList);
  assert.equal(result.isValid, true);
  assert.equal(result.validItems.length, 2);
  assert.equal(result.rejectedItems.length, 0);
  assert.equal(result.errorRate, 0);
});

test("validateCauseList rejects batches with excessive corruption (>20% errors)", () => {
  const corruptedItems: ParsedCaseItem[] = [
    {
      serialNumber: 1,
      caseNumber: "Invalid Random String",
      caseTitle: "X",
    },
    {
      serialNumber: 2,
      caseNumber: "Another Bad Row",
      caseTitle: "",
    },
    {
      serialNumber: 3,
      caseNumber: "W.P. 123/2024",
      caseTitle: "Valid Title VS State",
    },
  ];

  const causeList: ParsedCauseList = {
    court: "LHC",
    bench: "Principal Seat",
    hearingDate: new Date("2026-08-21T00:00:00.000Z"),
    targetDateStr: "2026-08-21",
    courtNumber: "Court Room No. 1",
    judgeName: "Mr. Justice Muhammad Ameer Bhatti",
    listType: "regular",
    items: corruptedItems,
  };

  const result = validateCauseList(causeList);
  assert.equal(result.isValid, false);
  assert.ok(result.errorRate > 0.2);
  assert.equal(result.validItems.length, 1);
  assert.equal(result.rejectedItems.length, 2);
});

test("computeSha256 generates deterministic 64-char hash", () => {
  const buf1 = Buffer.from("Cause list content for 2026-08-21");
  const buf2 = Buffer.from("Cause list content for 2026-08-21");
  const buf3 = Buffer.from("Different content");

  const hash1 = computeSha256(buf1);
  const hash2 = computeSha256(buf2);
  const hash3 = computeSha256(buf3);

  assert.equal(hash1.length, 64);
  assert.equal(hash1, hash2);
  assert.notEqual(hash1, hash3);
});
