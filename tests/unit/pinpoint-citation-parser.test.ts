import assert from "node:assert/strict";
import test from "node:test";
import { parsePakistaniCitation } from "../../client/src/experimental/components/judgments/PinpointCitationParser";

test("parsePakistaniCitation parses standard reported citations", () => {
  const result1 = parsePakistaniCitation("PLD 2023 SC 451");
  assert.ok(result1);
  assert.equal(result1.year, 2023);
  assert.equal(result1.journal, "PLD");
  assert.equal(result1.page, 451);
  assert.equal(result1.isValid, true);

  const result2 = parsePakistaniCitation("2024 SCMR 892");
  assert.ok(result2);
  assert.equal(result2.year, 2024);
  assert.equal(result2.journal, "SCMR");
  assert.equal(result2.page, 892);
  assert.equal(result2.isValid, true);

  const result3 = parsePakistaniCitation("2023 CLC 1204");
  assert.ok(result3);
  assert.equal(result3.year, 2023);
  assert.equal(result3.journal, "CLC");
  assert.equal(result3.page, 1204);
  assert.equal(result3.isValid, true);
});

test("parsePakistaniCitation parses compact neutral and court citations", () => {
  const result1 = parsePakistaniCitation("2025 LHC 639");
  assert.ok(result1);
  assert.equal(result1.year, 2025);
  assert.equal(result1.journal, "LHC");
  assert.equal(result1.page, 639);

  const result2 = parsePakistaniCitation("2022 PCrLJ 150");
  assert.ok(result2);
  assert.equal(result2.year, 2022);
  assert.equal(result2.journal, "PCRLJ");
  assert.equal(result2.page, 150);

  const result3 = parsePakistaniCitation("2021 YLR 880");
  assert.ok(result3);
  assert.equal(result3.year, 2021);
  assert.equal(result3.journal, "YLR");
  assert.equal(result3.page, 880);
});

test("parsePakistaniCitation returns null for invalid input", () => {
  assert.equal(parsePakistaniCitation(""), null);
  assert.equal(parsePakistaniCitation("Random text without legal citation"), null);
  assert.equal(parsePakistaniCitation("1850 ABC 12"), null); // year before 1947
});
