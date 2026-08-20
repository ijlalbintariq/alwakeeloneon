import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAdvocateName,
  normalizeCaseNumber,
  evaluateMatch,
} from "../../server/services/causelist/causelist-matcher";

test("normalizeAdvocateName removes Pakistani titles, honorifics, and role suffixes", () => {
  assert.equal(normalizeAdvocateName("Chaudhry Aitzaz Ahsan Adv."), "aitzaz ahsan");
  assert.equal(normalizeAdvocateName("Ch. Aitzaz Ahsan"), "aitzaz ahsan");
  assert.equal(normalizeAdvocateName("Aitzaz Ahsan ASC"), "aitzaz ahsan");
  assert.equal(normalizeAdvocateName("Syed Ali Zafar (Petitioner)"), "ali zafar");
  assert.equal(normalizeAdvocateName("Barrister Salman Safdar Adv"), "salman safdar");
  assert.equal(normalizeAdvocateName("Mian Muhammad Kashif Adv."), "muhammad kashif");
  assert.equal(normalizeAdvocateName("Dr. Babar Awan Senior Advocate"), "babar awan");
  assert.equal(normalizeAdvocateName("Malik Qayyum AOR"), "qayyum");
});

test("normalizeCaseNumber standardizes variations in case formatting", () => {
  assert.equal(normalizeCaseNumber("W.P. No. 12345/2024"), "wp12345/2024");
  assert.equal(normalizeCaseNumber("WP 12345/2024"), "wp12345/2024");
  assert.equal(normalizeCaseNumber("W.P.12345/2024"), "wp12345/2024");
  assert.equal(normalizeCaseNumber("Crl. Misc. 450-B/2023"), "crlmisc450b/2023");
});

test("evaluateMatch returns Tier 1 (1.0) on exact case number match", () => {
  const item = {
    id: 101,
    caseNumber: "W.P. No. 12450/2024",
    court: "LHC",
    bench: "Principal Seat",
    judgeName: "Mr. Justice Ali Baqar Najafi",
    courtNumber: "Court Room No. 4",
    hearingDate: new Date("2026-08-21T00:00:00.000Z"),
  };

  const rule = {
    userId: "user-abc-123",
    type: "tracker_case" as const,
    query: "W.P. 12450/2024",
  };

  const match = evaluateMatch(item, rule);
  assert.ok(match !== null);
  assert.equal(match.confidenceScore, 1.0);
  assert.equal(match.matchTier, "tier1_case_number");
  assert.equal(match.userId, "user-abc-123");
  assert.equal(match.causeListItemId, 101);
});

test("evaluateMatch returns Tier 2 (0.85) on advocate name + court match", () => {
  const item = {
    id: 102,
    caseNumber: "Crl. Misc 8901/2023",
    petitionerAdvocate: "Chaudhry Aitzaz Ahsan Adv.",
    respondentAdvocate: "DPG",
    court: "LHC",
    bench: "Principal Seat",
    judgeName: "Mr. Justice Farooq Haider",
    courtNumber: "Court Room No. 2",
    hearingDate: new Date("2026-08-21T00:00:00.000Z"),
  };

  const rule = {
    userId: "user-lawyer-456",
    type: "tracker_advocate" as const,
    query: "Aitzaz Ahsan",
    courtFilter: "LHC",
  };

  const match = evaluateMatch(item, rule);
  assert.ok(match !== null);
  assert.equal(match.confidenceScore, 0.85);
  assert.equal(match.matchTier, "tier2_advocate_court");
});

test("evaluateMatch returns Tier 3 (0.65) on advocate name match without court constraint", () => {
  const item = {
    id: 103,
    caseNumber: "C.A. No. 110/2020",
    petitionerAdvocate: "Barrister Salman Safdar",
    court: "LHC",
    bench: "Principal Seat",
    judgeName: "Mr. Justice Tariq Saleem Sheikh",
    courtNumber: "Court Room No. 3",
    hearingDate: new Date("2026-08-21T00:00:00.000Z"),
  };

  const rule = {
    userId: "user-lawyer-789",
    type: "tracker_advocate" as const,
    query: "Salman Safdar",
    courtFilter: null,
  };

  const match = evaluateMatch(item, rule);
  assert.ok(match !== null);
  assert.equal(match.confidenceScore, 0.65);
  assert.equal(match.matchTier, "tier3_advocate_exact");
});

test("evaluateMatch returns null when there is no match", () => {
  const item = {
    id: 104,
    caseNumber: "W.P. No. 9999/2024",
    petitionerAdvocate: "Malik Tariq",
    court: "LHC",
    bench: "Multan Bench",
    judgeName: "Mr. Justice ABC",
    hearingDate: new Date("2026-08-21T00:00:00.000Z"),
  };

  const rule = {
    userId: "user-xyz",
    type: "tracker_case" as const,
    query: "W.P. 1111/2024",
  };

  const match = evaluateMatch(item, rule);
  assert.equal(match, null);
});
