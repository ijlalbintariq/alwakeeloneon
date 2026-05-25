import test from "node:test";
import assert from "node:assert/strict";
import { parseSectionsFromText, extractPunishment } from "../../scripts/parse-statutes";

test("extractPunishment detects death penalty", () => {
  const text = "Whoever commits qatl-i-amd shall be punished with death as qisas.";
  const punishment = extractPunishment(text);
  assert.match(punishment, /death/i);
});

test("extractPunishment detects life imprisonment", () => {
  const text = "The offender shall be punished with imprisonment for life and fine.";
  const punishment = extractPunishment(text);
  assert.match(punishment, /imprisonment for life/i);
});

test("extractPunishment detects standard imprisonment sentences", () => {
  const text = "He shall be punished with imprisonment of either description for a term which may extend to five years.";
  const punishment = extractPunishment(text);
  assert.match(punishment, /imprisonment of either description/i);
});

test("extractPunishment detects fine only", () => {
  const text = "He shall be punished with fine up to one thousand rupees.";
  const punishment = extractPunishment(text);
  assert.match(punishment, /fine/i);
});

test("parseSectionsFromText extracts en-dash style sections", () => {
  const mockDocText = `
THE WEST PAKISTAN MUSLIM PERSONAL LAW ACT
1. Short title and extent.– (1) This Act may be called the West Pakistan Muslim Personal Law Shariat Application Act.
2. Application of Muslim Personal Law.– In all questions regarding succession, the rule of decision shall be the Muslim Personal Law.
  `;
  const result = parseSectionsFromText("Muslim Personal Law Act, 1962", mockDocText);
  assert.equal(result.length, 2);
  assert.equal(result[0].section, "Section 1");
  assert.ok(result[0].description.includes("Short title and extent"));
  assert.equal(result[1].section, "Section 2");
  assert.ok(result[1].description.includes("Application of Muslim Personal Law"));
});

test("parseSectionsFromText extracts dot style sections", () => {
  const mockDocText = `
PUNJAB DEVELOPMENT ACT
1. Definitions. In this Act, unless there is anything repugnant in the subject or context:
(a) Authority means the Punjab Development Authority.
2. Alteration of Boundaries. The Government may by notification alter the boundaries of the area.
  `;
  const result = parseSectionsFromText("Punjab Development Act, 1975", mockDocText);
  assert.equal(result.length, 2);
  assert.equal(result[0].section, "Section 1");
  assert.ok(result[0].description.includes("Definitions"));
  assert.equal(result[1].section, "Section 2");
  assert.ok(result[1].description.includes("Alteration of Boundaries"));
});

test("parseSectionsFromText extracts CPC Order and Rule sections", () => {
  const mockDocText = `
THE CODE OF CIVIL PROCEDURE, 1908
O RDER IX
Appearance of Parties and Consequence of Non-appearance
1. Parties to appear on day fixed.– The parties shall appear on the day fixed in the summons.
2. Dismissal of suit.– Where the summons has not been served in consequence of the plaintiff's failure to pay costs, the court shall dismiss the suit.
  `;
  const result = parseSectionsFromText("Code of Civil Procedure, 1908", mockDocText);
  assert.equal(result.length, 2);
  assert.equal(result[0].section, "Order IX Rule 1");
  assert.ok(result[0].description.includes("Parties to appear on day fixed"));
  assert.equal(result[1].section, "Order IX Rule 2");
  assert.ok(result[1].description.includes("Dismissal of suit"));
});

test("parseSectionsFromText extracts multi-line fallback sections (Strategy 4)", () => {
  const mockDocText = `
Section 1. Short title and extent
This Act may be called the Multi-line Test Act.
It shall extend to the whole of Pakistan.

Section 2. Definitions
In this Act, the following expressions shall have
the meanings hereby assigned to them:
(a) "Act" means the Multi-line Test Act.
  `;
  const result = parseSectionsFromText("Multi-line Test Act, 2026", mockDocText);
  assert.equal(result.length, 2);
  assert.equal(result[0].section, "Section 1");
  assert.ok(result[0].description.includes("This Act may be called the Multi-line Test Act."));
  assert.ok(result[0].description.includes("It shall extend to the whole of Pakistan."));
  assert.equal(result[1].section, "Section 2");
  assert.ok(result[1].description.includes("the meanings hereby assigned to them:"));
});

test("parseSectionsFromText extracts standard hyphen-minus split sections", () => {
  const mockDocText = `
1. Short title - This Act may be called the Hyphen Split Act.
2. Application - In all questions regarding application, this Act shall apply.
  `;
  const result = parseSectionsFromText("Hyphen Split Act, 2026", mockDocText);
  assert.equal(result.length, 2);
  assert.equal(result[0].section, "Section 1");
  assert.ok(result[0].description.includes("Short title"));
  assert.ok(result[0].description.includes("This Act may be called the Hyphen Split Act."));
  assert.equal(result[1].section, "Section 2");
  assert.ok(result[1].description.includes("Application"));
  assert.ok(result[1].description.includes("In all questions regarding application"));
});
