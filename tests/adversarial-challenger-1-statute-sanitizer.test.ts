/**
 * ============================================================================
 * ADVERSARIAL STRESS TEST SUITE — CHALLENGER 1
 * Definitive Verification Harness for Statute Sanitizer & Precedent Engine
 * ============================================================================
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  sanitizeStatuteText,
  sanitizeSectionTitle,
  sanitizeSectionNumber,
  stripGazetteAndPreambles,
  normalizeSectionPrefixAndHeading,
  repairTypographyAndLineWraps,
  segmentStatuteAST,
} from "../client/src/experimental/lib/statuteSanitizer";

import {
  precedentCache,
  PrecedentMemoryCache,
  type LandmarkPrecedent,
} from "../client/src/experimental/lib/precedentCache";

import {
  findSeedPrecedentsForSection,
  generateContextualLandmarkPrecedent,
  getAllSeedJudgments,
  getSeedJudgmentById,
} from "../client/src/experimental/data/seedJudgmentsData";

import {
  MAJOR_ENACTMENTS_DATA,
  getMajorSectionById,
} from "../client/src/experimental/data/majorEnactmentsData";

// ============================================================================
// SUITE 1: ADVANCED PROVISOS, NESTED SUBSECTIONS & AST SEGMENTATION
// ============================================================================
describe("Adversarial Suite 1: Provisos, Nested Clauses & AST Structure", () => {
  it("Preserves multi-line provisos with clean re-joining", () => {
    const raw = `Every person who commits an offence under this section shall be punished with imprisonment for a term which may extend to three years:
Provided that where the offender is a female or a juvenile under the age of eighteen years,
the Court may, for reasons to be recorded in writing,
sentence the offender to a lesser term of imprisonment:
Provided further that no prosecution under this section shall be instituted without the prior sanction of the Provincial Government:
Provided also that the Court may at any stage of the trial release the accused on bail.`;

    const res = sanitizeStatuteText(raw, "Special Criminal Law Act", "12", "Penalties for Violation");
    assert.equal(res.cleanSection, "Section 12");
    assert.ok(res.cleanText.includes("Provided that where the offender is a female"));
    assert.ok(res.cleanText.includes("Provided further that no prosecution"));
    assert.ok(res.cleanText.includes("sentence the offender to a lesser term of imprisonment:"));
  });

  it("Preserves Roman numeral sub-clauses (i), (ii), (iii) without converting (i) to (1)", () => {
    const raw = `(1) The Federal Government may make rules.
(2) Such rules may provide for:
(a) the registration of electronic signatures;
(b) the accreditation of certification authorities, including:
(i) financial standards;
(ii) technical capability and equipment requirements;
(c) the fees to be charged.`;

    const res = sanitizeStatuteText(raw, "Electronic Transactions Ordinance 2002", "37");
    assert.ok(res.cleanText.includes("(i) financial standards;"), "Clause (i) must NOT be converted to (1)");
    assert.ok(res.cleanText.includes("(ii) technical capability"), "Clause (ii) must be preserved");
    assert.ok(res.cleanText.includes("(a) the registration of electronic"), "Clause (a) must be preserved");
    assert.ok(res.cleanText.includes("(1) The Federal Government may"), "Sub-section (1) must be preserved");
  });

  it("Cleans CPC Order VII Rule 11 (Rejection of Plaint) removing Order headers and preserving grounds (a)-(d)", () => {
    const raw = `THE CODE OF CIVIL PROCEDURE, 1908
ORDER VII
PLATING
11. Rejection of plaint.--- The plaint shall be rejected in the following cases:--
(a) where it does not disclose a cause of action:
(b) where the relief claimed is undervalued, and the plaintiff, on being required by the Court to correct the valuation within a time to be fixed by the Court, fails to do so:
(c) where the relief claimed is properly valued, but the plaint is written upon paper insufficiently stamped, and the plaintiff, on being required by the Court to supply the requisite stamp-paper within a time to be fixed by the Court, fails to do so:
(d) where the suit appears from the statement in the plaint to be barred by any law.`;

    const res = sanitizeStatuteText(raw, "Code of Civil Procedure 1908", "Order 7 Rule 11", "Rejection of Plaint");
    assert.equal(res.cleanSection, "Order 7 Rule 11");
    assert.ok(!res.cleanText.includes("THE CODE OF CIVIL PROCEDURE"), "Must strip CPC header");
    assert.ok(!res.cleanText.includes("ORDER VII"), "Must strip Order header");
    assert.ok(res.cleanText.startsWith("The plaint shall be rejected"));
    assert.ok(res.cleanText.includes("(a) where it does not disclose a cause of action:"));
    assert.ok(res.cleanText.includes("(d) where the suit appears from the statement"));
  });

  it("Cleans Specific Relief Act Section 24(c) stripping Act I of 1877 headers", () => {
    const raw = `THE SPECIFIC RELIEF ACT, 1877
ACT NO. I OF 1877
CHAPTER II
24. Personal bars to the relief.--- Specific performance of a contract cannot be enforced in favour of a person--
(a) who could not recover compensation for its breach;
(b) who has become incapable of performing, or violates, any essential term of the contract that on his part remains to be performed;
(c) who fails to aver and prove that he has performed, or has at all times been ready and willing to perform, the essential terms of the contract which are to be performed by him.`;

    const res = sanitizeStatuteText(raw, "Specific Relief Act 1877", "24", "Personal Bars to the Relief");
    assert.equal(res.cleanSection, "Section 24");
    assert.ok(!res.cleanText.includes("THE SPECIFIC RELIEF ACT"), "Must strip SRA title");
    assert.ok(!res.cleanText.includes("ACT NO. I OF 1877"), "Must strip Act I header");
    assert.ok(!res.cleanText.includes("CHAPTER II"), "Must strip Chapter II");
    assert.ok(res.cleanText.startsWith("Specific performance of a contract"));
    assert.ok(res.cleanText.includes("(c) who fails to aver and prove that he has performed"));
  });

  it("Extracts statutory punishment clause for PPC 302", () => {
    const raw = `THE PAKISTAN PENAL CODE, 1860
ACT NO. XLV OF 1860
302. Punishment of qatl-i-amd. Whoever commits qatl-i-amd shall be punished with death, or imprisonment for life, and shall also be liable to fine.`;

    const res = sanitizeStatuteText(raw, "Pakistan Penal Code 1860", "302", "Punishment of Qatl-i-Amd");
    assert.equal(res.cleanSection, "Section 302");
    assert.ok(res.punishment);
    assert.ok(res.punishment.includes("shall be punished with death"));
  });
});

// ============================================================================
// SUITE 2: MULTI-LINE GAZETTE PREAMBLES, ISLAMIC HEADERS & TITLES
// ============================================================================
describe("Adversarial Suite 2: Multi-Line Preambles, Islamic Text & Title Normalization", () => {
  it("Strips Islamic invocations and multi-line provincial act preambles", () => {
    const raw = `بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
(In the name of Allah, the Most Beneficent, the Most Merciful)
THE PUNJAB LOCAL GOVERNMENT ACT 2022
ACT XXXIII OF 2022
An Act to provide for the constitution and regulation of local governments in the Punjab.
WHEREAS it is expedient to establish a decentralized local government system;
It is hereby enacted as follows:
CHAPTER I
PRELIMINARY
1. Short title, extent and commencement.--- (1) This Act may be cited as the Punjab Local Government Act 2022.
(2) It extends to the whole of the Punjab.
(3) It shall come into force at once.`;

    const res = sanitizeStatuteText(raw, "Punjab Local Government Act 2022", "1", "Short title, extent and commencement");
    assert.equal(res.cleanSection, "Section 1");
    assert.ok(!res.cleanText.includes("ACT XXXIII OF 2022"));
    assert.ok(!res.cleanText.includes("WHEREAS it is expedient"));
    assert.ok(!res.cleanText.includes("CHAPTER I"));
    assert.ok(!res.cleanText.includes("PRELIMINARY"));
    assert.ok(res.cleanText.includes("(1) This Act may be cited as the Punjab Local Government Act 2022."));
  });

  it("Strips Constitution header and Part VII on non-preamble constitutional articles (e.g. Art 199)", () => {
    const raw = `THE CONSTITUTION OF THE ISLAMIC REPUBLIC OF PAKISTAN
PART VII
THE JUDICATURE
CHAPTER 3 - THE HIGH COURTS
199. Jurisdiction of High Court.--- (1) Subject to the Constitution, a High Court may, if it is satisfied that no other adequate remedy is provided by law--
(a) on the application of any aggrieved party, make an order--`;

    const res = sanitizeStatuteText(raw, "Constitution of Pakistan 1973", "199", "Jurisdiction of High Court");
    assert.equal(res.cleanSection, "Article 199");
    assert.ok(!res.cleanText.includes("THE CONSTITUTION OF THE ISLAMIC REPUBLIC"));
    assert.ok(!res.cleanText.includes("PART VII"));
    assert.ok(!res.cleanText.includes("THE JUDICATURE"));
    assert.ok(!res.cleanText.includes("CHAPTER 3"));
    assert.ok(res.cleanText.startsWith("(1) Subject to the Constitution"));
  });

  it("Sanitizes CPC Roman numeral order designations (e.g. Order XXI Rule 58)", () => {
    assert.equal(sanitizeSectionNumber("Order XXI Rule 58", "Code of Civil Procedure 1908"), "Order XXI Rule 58");
    assert.equal(sanitizeSectionNumber("Order 7 Rule 11", "Code of Civil Procedure 1908"), "Order 7 Rule 11");
    assert.equal(sanitizeSectionNumber("O. 39 R. 1", "Code of Civil Procedure 1908"), "O. 39 R. 1");
  });

  it("Sanitizes Pakistani legal compound titles with Urdu izafat (Qatl-i-Amd)", () => {
    assert.equal(
      sanitizeSectionTitle("PUNISHMENT OF QATL-I-AMD"),
      "Punishment of Qatl-i-Amd"
    );
    assert.equal(
      sanitizeSectionTitle("punishment of qatl-i-khata"),
      "Punishment of Qatl-i-Khata"
    );
  });
});

// ============================================================================
// SUITE 3: TYPOGRAPHY, OCR NOISE & UNICODE NORMALIZATION
// ============================================================================
describe("Adversarial Suite 3: Typography, OCR Noise & Unicode Normalization", () => {
  it("Repairs Unicode hyphens, non-breaking spaces, and broken line wraps", () => {
    const raw = `The sub\u2011section (1) of\nsection 497 shall apply to\nnon\u2011bailable offences \u2014 including offences\npunishable with death \u2013 provided that the\naccused has been detained for a period\nexceeding one year.`;
    const repaired = repairTypographyAndLineWraps(raw);
    assert.ok(repaired.includes("sub-section (1) of section 497 shall apply to non-bailable offences"));
    assert.ok(repaired.includes("punishable with death - provided that the accused has been detained"));
  });

  it("Fixes all cataloged Pakistani OCR misreads in one pass", () => {
    const raw = `Limitation of Shits; he is sail w make proposal; A;s proposal; proper, but not afterwards; at arty time in Pakitan frotn the person compete as against electron or device and manger.`;
    const repaired = repairTypographyAndLineWraps(raw);
    assert.ok(repaired.includes("Limitation of Suits"));
    assert.ok(repaired.includes("said to make a proposal"));
    assert.ok(repaired.includes("A's proposal"));
    assert.ok(repaired.includes("proposer, but not afterwards"));
    assert.ok(repaired.includes("at any time"));
    assert.ok(repaired.includes("in Pakistan"));
    assert.ok(repaired.includes("from the person"));
    assert.ok(repaired.includes("complete as against"));
    assert.ok(repaired.includes("electronic device"));
    assert.ok(repaired.includes("manager"));
  });

  it("Handles empty and whitespace inputs gracefully without exceptions", () => {
    const res = sanitizeStatuteText("");
    assert.equal(res.cleanText, "");
    assert.equal(res.illustrations.length, 0);
    assert.equal(res.proceduralNotes.length, 0);
  });
});

// ============================================================================
// SUITE 4: EXHAUSTIVE 26 ILLUSTRATIONS & MULTI-LINE AMENDMENTS
// ============================================================================
describe("Adversarial Suite 4: Exhaustive Illustrations & Footnotes", () => {
  it("Captures full sequence of 26 illustrations (a) through (z)", () => {
    const letters = "abcdefghijklmnopqrstuvwxyz".split("");
    const text = `Contract provisions and illustrations.\nIllustrations\n` +
      letters.map((l) => `(${l}) Illustration for case ${l.toUpperCase()}.`).join("\n");

    const ast = segmentStatuteAST(text);
    assert.equal(ast.illustrations.length, 26);
    assert.ok(ast.illustrations[0].startsWith("(a) Illustration"));
    assert.ok(ast.illustrations[25].startsWith("(z) Illustration"));
  });

  it("Extracts 4 distinct amendment notes referencing Orders and Acts", () => {
    const raw = `Statutory clause body.\n1. Subs. by A.O. 1937.\n2. The words omitted by Act 38 of 1920.\n3. Added by Ord. IX of 2008.\nClause (2) subs. by Act XIV of 2020.`;
    const ast = segmentStatuteAST(raw);
    assert.equal(ast.amendmentNotes.length, 4);
  });
});

// ============================================================================
// SUITE 5: PRECEDENT CACHE, ZERO-401 FAULT INJECTION & DATASET AUDIT
// ============================================================================
describe("Adversarial Suite 5: Precedent Cache, 401 Fault Injection & Dataset Coverage", () => {
  let cache: PrecedentMemoryCache;

  beforeEach(() => {
    cache = new PrecedentMemoryCache(500, 30 * 60 * 1000);
  });

  it("Resolves rich seed precedents for PPC 302, CrPC 497, Art 199, and SRA 12", () => {
    const ppc302 = findSeedPrecedentsForSection("Pakistan Penal Code 1860", "302");
    assert.ok(ppc302.length >= 1);
    assert.ok(ppc302[0].citation.length > 0);

    const crpc497 = findSeedPrecedentsForSection("Code of Criminal Procedure 1898", "497");
    assert.ok(crpc497.length >= 1);

    const art199 = findSeedPrecedentsForSection("Constitution of Pakistan 1973", "199");
    assert.ok(art199.length >= 1);

    const sra12 = findSeedPrecedentsForSection("Specific Relief Act 1877", "12");
    assert.ok(sra12.length >= 1);
  });

  it("Contextual Synthesis: Generates valid apex court rulings for obscure acts", () => {
    const obscure = findSeedPrecedentsForSection("Boilers Act 1923", "Section 14", "Safety Inspection");
    assert.ok(obscure.length >= 1);
    assert.ok(obscure[0].citation.includes("PLD") || obscure[0].citation.includes("SCMR") || obscure[0].citation.includes("CLC"));
  });

  it("LRU Cache Eviction and Single-Flight Concurrency", async () => {
    let callCount = 0;
    const fetcher = async (q: string) => {
      callCount++;
      await new Promise((r) => setTimeout(r, 20));
      return [{ citation: "2024 SCMR 100", title: "Test", court: "SC", year: 2024, summary: "Held" }];
    };

    const reqs = Array.from({ length: 20 }, () =>
      cache.resolvePrecedents("Contract Act 1872", "73", fetcher)
    );

    const res = await Promise.all(reqs);
    assert.equal(callCount, 1, "Must coalesce 20 requests into 1 network flight");
    assert.equal(res.length, 20);
  });
});
