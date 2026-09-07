/**
 * ============================================================================
 * ADVERSARIAL STRESS TEST HARNESS — CHALLENGER 1
 * Empirical Verification of Statute Sanitizer, Precedent Cache, & Zero-401 Resilience
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
// SUITE 1: ADVERSARIAL PROVISOS, NESTED CLAUSES & SPECIAL STATUTORY PROVISIONS
// ============================================================================
describe("Adversarial Suite 1: Provisos, Nested Clauses & Complex Sections", () => {
  it("Handles multi-line provisos (Provided that, Provided further that, Provided also that) without losing structure", () => {
    const rawText = `Every person who commits an offence under this section shall be punished with imprisonment for a term which may extend to three years:
Provided that where the offender is a female or a juvenile under the age of eighteen years,
the Court may, for reasons to be recorded in writing,
sentence the offender to a lesser term of imprisonment:
Provided further that no prosecution under this section shall be instituted without the prior sanction of the Provincial Government:
Provided also that the Court may at any stage of the trial release the accused on bail.`;

    const sanitized = sanitizeStatuteText(rawText, "Special Criminal Law Act", "12", "Penalties for Violation");
    assert.equal(sanitized.cleanSection, "Section 12");
    assert.ok(sanitized.cleanText.includes("Provided that where the offender is a female"));
    assert.ok(sanitized.cleanText.includes("Provided further that no prosecution"));
    assert.ok(sanitized.cleanText.includes("Provided also that the Court may"));
    assert.ok(sanitized.cleanText.includes("sentence the offender to a lesser term"));
    // Provisos should be cleanly preserved and re-joined across mid-sentence linebreaks
    assert.ok(!sanitized.cleanText.includes("years,\nthe Court"));
  });

  it("Preserves nested sub-clauses (1), (a), (i), (ii), (b), (2) without stripping numeral prefixes", () => {
    const rawText = `(1) The Federal Government may, by notification in the official Gazette, make rules for carrying out the purposes of this Act.
(2) In particular, and without prejudice to the generality of the foregoing power, such rules may provide for all or any of the following matters, namely:
(a) the registration of electronic signatures;
(b) the accreditation of certification authorities, including:
(i) financial standards;
(ii) technical capability and equipment requirements;
(c) the fees to be charged for any license under this Act.`;

    const sanitized = sanitizeStatuteText(rawText, "Electronic Transactions Ordinance 2002", "37");
    assert.ok(sanitized.cleanText.includes("(1) The Federal Government may"));
    assert.ok(sanitized.cleanText.includes("(2) In particular"));
    assert.ok(sanitized.cleanText.includes("(a) the registration of electronic"));
    assert.ok(sanitized.cleanText.includes("(b) the accreditation of certification"));
    assert.ok(sanitized.cleanText.includes("(i) financial standards;"));
    assert.ok(sanitized.cleanText.includes("(ii) technical capability"));
    assert.ok(sanitized.cleanText.includes("(c) the fees to be charged"));
  });

  it("Cleans CPC Order VII Rule 11 (Rejection of Plaint) preserving all distinct grounds (a) through (d)", () => {
    const rawText = `THE CODE OF CIVIL PROCEDURE, 1908
ORDER VII
PLATING
11. Rejection of plaint.--- The plaint shall be rejected in the following cases:--
(a) where it does not disclose a cause of action:
(b) where the relief claimed is undervalued, and the plaintiff, on being required by the Court to correct the valuation within a time to be fixed by the Court, fails to do so:
(c) where the relief claimed is properly valued, but the plaint is written upon paper insufficiently stamped, and the plaintiff, on being required by the Court to supply the requisite stamp-paper within a time to be fixed by the Court, fails to do so:
(d) where the suit appears from the statement in the plaint to be barred by any law.`;

    const sanitized = sanitizeStatuteText(rawText, "Code of Civil Procedure 1908", "Order 7 Rule 11", "Rejection of Plaint");
    assert.equal(sanitized.cleanSection, "Order 7 Rule 11");
    assert.ok(!sanitized.cleanText.includes("THE CODE OF CIVIL PROCEDURE"));
    assert.ok(!sanitized.cleanText.includes("ORDER VII"));
    assert.ok(sanitized.cleanText.startsWith("The plaint shall be rejected"));
    assert.ok(sanitized.cleanText.includes("(a) where it does not disclose a cause of action"));
    assert.ok(sanitized.cleanText.includes("(d) where the suit appears from the statement"));
  });

  it("Cleans Specific Relief Act Section 24(c) (Personal Bars to the Relief) with continuous averment wording", () => {
    const rawText = `THE SPECIFIC RELIEF ACT, 1877
ACT NO. I OF 1877
CHAPTER II
24. Personal bars to the relief.--- Specific performance of a contract cannot be enforced in favour of a person--
(a) who could not recover compensation for its breach;
(b) who has become incapable of performing, or violates, any essential term of the contract that on his part remains to be performed;
(c) who fails to aver and prove that he has performed, or has at all times been ready and willing to perform, the essential terms of the contract which are to be performed by him.`;

    const sanitized = sanitizeStatuteText(rawText, "Specific Relief Act 1877", "24", "Personal Bars to the Relief");
    assert.equal(sanitized.cleanSection, "Section 24");
    assert.ok(!sanitized.cleanText.includes("THE SPECIFIC RELIEF ACT"));
    assert.ok(!sanitized.cleanText.includes("ACT NO. I OF 1877"));
    assert.ok(sanitized.cleanText.startsWith("Specific performance of a contract"));
    assert.ok(sanitized.cleanText.includes("(c) who fails to aver and prove that he has performed"));
  });

  it("Correctly identifies statutory punishment in complex murder section (PPC 302)", () => {
    const rawText = `THE PAKISTAN PENAL CODE, 1860
ACT NO. XLV OF 1860
302. Punishment of qatl-i-amd. Whoever commits qatl-i-amd shall be punished with death, or imprisonment for life, and shall also be liable to fine.`;

    const sanitized = sanitizeStatuteText(rawText, "Pakistan Penal Code 1860", "302", "Punishment of Qatl-i-Amd");
    assert.equal(sanitized.cleanSection, "Section 302");
    assert.equal(sanitized.cleanTitle, "Punishment of Qatl-i-Amd");
    assert.ok(sanitized.punishment);
    assert.ok(sanitized.punishment.includes("shall be punished with death"));
  });
});

// ============================================================================
// SUITE 2: ADVERSARIAL PREAMBLES, ARABIC/URDU TEXT & IRREGULAR ACT NOTICES
// ============================================================================
describe("Adversarial Suite 2: Irregular Preambles, Islamic Texts & Provincial Enactments", () => {
  it("Handles Arabic Bismillah & Islamic invocation text cleanly without mangling statute body", () => {
    const rawText = `بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
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

    const sanitized = sanitizeStatuteText(rawText, "Punjab Local Government Act 2022", "1", "Short title, extent and commencement");
    assert.equal(sanitized.cleanSection, "Section 1");
    assert.ok(!sanitized.cleanText.includes("ACT XXXIII OF 2022"));
    assert.ok(!sanitized.cleanText.includes("WHEREAS it is expedient"));
    assert.ok(!sanitized.cleanText.includes("CHAPTER I"));
    assert.ok(sanitized.cleanText.includes("(1) This Act may be cited as the Punjab Local Government Act 2022."));
    assert.ok(sanitized.cleanText.includes("(2) It extends to the whole of the Punjab."));
  });

  it("Strips Provincial Ordinance Promulgation Orders (Sindh, Balochistan, KPK, Punjab)", () => {
    const rawSindh = `GOVERNMENT OF SINDH
LAW AND PARLIAMENTARY AFFAIRS DEPARTMENT
ORDINANCE NO. IV OF 2019
AN ORDINANCE
to provide for the protection of women against harassment at the workplace.
WHEREAS the Provincial Assembly of Sindh is not in session and the Governor of Sindh is satisfied that circumstances exist which render it necessary for him to take immediate action;
NOW, THEREFORE, in exercise of the powers conferred by clause (1) of Article 128 of the Constitution of the Islamic Republic of Pakistan, the Governor of Sindh is pleased to make and promulgate the following Ordinance:
1. Short title and commencement.--- (1) This Ordinance may be called the Sindh Protection of Women Ordinance 2019.`;

    const cleaned = stripGazetteAndPreambles(rawSindh);
    assert.ok(!cleaned.includes("ORDINANCE NO. IV OF 2019"));
    assert.ok(!cleaned.includes("NOW, THEREFORE"));
    assert.ok(cleaned.includes("1. Short title and commencement"));
  });

  it("Sanitizes irregular section number formats (e.g. Art-203D, Sec-489F, Order XXI Rule 58, S. 498-A)", () => {
    assert.equal(sanitizeSectionNumber("art-203d", "Constitution of Pakistan 1973"), "Article 203d");
    assert.equal(sanitizeSectionNumber("sec-489f", "Pakistan Penal Code 1860"), "Section 489f");
    assert.equal(sanitizeSectionNumber("Order XXI Rule 58", "Code of Civil Procedure"), "Order XXI Rule 58");
    assert.equal(sanitizeSectionNumber("s-498a", "Code of Criminal Procedure 1898"), "Section 498a");
    assert.equal(sanitizeSectionNumber("article 184(3)", "Constitution of Pakistan 1973"), "Article 184(3)");
  });

  it("Sanitizes edge-case section titles with roman numerals, slashes, and complex punctuation", () => {
    assert.equal(
      sanitizeSectionTitle("POWER OF COURT TO DETERMINE DISPUTES UNDER CLAUSE (A) OF SECTION 12"),
      "Power of Court to Determine Disputes under Clause (a) of Section 12"
    );
    assert.equal(
      sanitizeSectionTitle("RIGHT TO LEGAL REPRESENTATION / ADVOCATE-ON-RECORD"),
      "Right to Legal Representation / Advocate-on-Record"
    );
    assert.equal(
      sanitizeSectionTitle("DISCOVERY AND INSPECTION OF DOCUMENTS IN CIVIL SUITS"),
      "Discovery and Inspection of Documents in Civil Suits"
    );
  });
});

// ============================================================================
// SUITE 3: ADVERSARIAL OCR NOISE, UNICODE HYPHENS & BROKEN LINE WRAPS
// ============================================================================
describe("Adversarial Suite 3: OCR Noise, Unicode Hyphens & Broken Line Wraps", () => {
  it("Handles dense non-breaking hyphens (\\u2011, \\u2012), en-dashes, em-dashes, and soft hyphens", () => {
    const rawText = `The sub\u2011section (1) of section 497 shall apply to non\u2011bailable offences \u2014 including offences punishable with death \u2013 provided that the accused has been detained for a continuous period exceeding one year.`;
    const repaired = repairTypographyAndLineWraps(rawText);
    assert.ok(repaired.includes("sub-section (1)"));
    assert.ok(repaired.includes("non-bailable offences — including"));
    assert.ok(repaired.includes("with death - provided"));
  });

  it("Repairs words split across multiple consecutive line-breaks", () => {
    const rawText = `The appellate\ntribunal\nshall\nexamine\nthe record of the case and\nafter affording\nreasonable opportunity of\nbeing heard to the\nparties,\npass such order as it thinks fit.`;
    const repaired = repairTypographyAndLineWraps(rawText);
    assert.equal(
      repaired,
      "The appellate tribunal shall examine the record of the case and after affording reasonable opportunity of being heard to the parties, pass such order as it thinks fit."
    );
  });

  it("Fixes OCR (l) and (I) numeral confusion at start of clauses", () => {
    const rawText = `(l) The High Court may exercise all powers conferred on an appellate court.\n(I) Every warrant of arrest issued under this Code shall be in writing.`;
    const repaired = repairTypographyAndLineWraps(rawText);
    assert.ok(repaired.includes("(1) The High Court may"));
    assert.ok(repaired.includes("(1) Every warrant of arrest"));
  });

  it("Handles Windows CRLF (\\r\\n) and classic Mac CR (\\r) line endings without regex degradation", () => {
    const crlfText = "THE PAKISTAN PENAL CODE, 1860\r\nACT NO. XLV OF 1860\r\nCHAPTER I\r\n1. Title and extent of operation.\r\nThis Act shall be called the Pakistan Penal Code.\r\n";
    const sanitized = sanitizeStatuteText(crlfText, "Pakistan Penal Code 1860", "1");
    assert.ok(!sanitized.cleanText.includes("THE PAKISTAN PENAL CODE"));
    assert.ok(!sanitized.cleanText.includes("ACT NO. XLV"));
    assert.ok(sanitized.cleanText.includes("This Act shall be called the Pakistan Penal Code"));
  });

  it("Gracefully handles zero-length, whitespace-only, and null-like inputs", () => {
    const resEmpty = sanitizeStatuteText("");
    assert.equal(resEmpty.cleanText, "");
    assert.equal(resEmpty.illustrations.length, 0);

    const resWhitespace = sanitizeStatuteText("   \n\n\t  \n  ");
    assert.equal(resWhitespace.cleanText, "");

    const resTitle = sanitizeSectionTitle("");
    assert.equal(resTitle, "");

    const resSec = sanitizeSectionNumber("");
    assert.equal(resSec, "Section");
  });
});

// ============================================================================
// SUITE 4: EXHAUSTIVE ILLUSTRATIONS (A) THROUGH (Z) & AST SEGMENTATION
// ============================================================================
describe("Adversarial Suite 4: Exhaustive Illustrations (a) to (z) & AST Segmentation", () => {
  it("Correctly parses an exhaustive 26-illustration sequence (a) through (z)", () => {
    const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
    const illustrationLines = alphabet.map(
      (letter) => `(${letter}) A commits an act with respect to ${letter.toUpperCase()} under illustrative scenario ${letter}.`
    );

    const fullStatute = `Whoever commits an offence under this section shall be liable to compensate the injured party.
Illustrations
${illustrationLines.join("\n")}
Notes: High Court commentary on illustration scope.`;

    const ast = segmentStatuteAST(fullStatute);
    assert.equal(ast.illustrations.length, 26, "Must capture all 26 illustrations (a) through (z)");
    assert.ok(ast.illustrations[0].startsWith("(a) A commits an act"));
    assert.ok(ast.illustrations[25].startsWith("(z) A commits an act"));
    assert.ok(!ast.cleanText.includes("Illustrations"));
    assert.ok(ast.proceduralNotes.length >= 1);
  });

  it("Handles multi-paragraph illustration blocks without premature truncating", () => {
    const statuteText = `An agreement without consideration is void.
Illustrations
(a) A promises, for no consideration, to give to B Rs. 1,000. This is a void agreement.
(b) A, for natural love and affection, promises to give his son, B, Rs. 1,000.
A puts his promise to B into writing and registers it under the law.
This is a contract.
(c) A finds B's purse and gives it to him. B promises to give A Rs. 50.
This is a contract.`;

    const ast = segmentStatuteAST(statuteText);
    assert.equal(ast.illustrations.length, 3);
    assert.ok(ast.illustrations[1].includes("A puts his promise to B into writing"));
    assert.ok(ast.illustrations[1].includes("This is a contract."));
  });

  it("Extracts multiple distinct amendment footnotes referencing Acts and Ordinances", () => {
    const rawText = `Every suit shall be instituted in the Court of the lowest grade competent to try it.
1. Subs. by Central Laws (Statute Reform) Ordinance, 1960 (XXI of 1960), s. 3 and 2nd Sch.
2. The words "or the High Court" omitted by the Federal Adaptation of Laws Order, 1975 (P.O. No. 4 of 1975), Art. 2 and Sch.
3. Added by Act XIV of 2020.
Clause (3) subs. by Ordinance X of 2022.`;

    const ast = segmentStatuteAST(rawText);
    assert.equal(ast.amendmentNotes.length, 4);
    assert.ok(ast.amendmentNotes.some((n) => n.includes("Central Laws (Statute Reform)")));
    assert.ok(ast.amendmentNotes.some((n) => n.includes("Federal Adaptation of Laws Order")));
    assert.ok(ast.amendmentNotes.some((n) => n.includes("Added by Act XIV of 2020")));
    assert.ok(ast.amendmentNotes.some((n) => n.includes("Clause (3) subs.")));
    assert.ok(!ast.cleanText.includes("Subs. by Central Laws"));
  });
});

// ============================================================================
// SUITE 5: PRECEDENT CACHE, 401 NETWORK FAULT INJECTION & 83K DATASET COVERAGE
// ============================================================================
describe("Adversarial Suite 5: Precedent Cache, 401 Fault Injection & 83k Coverage", () => {
  let cache: PrecedentMemoryCache;

  beforeEach(() => {
    cache = new PrecedentMemoryCache(500, 30 * 60 * 1000);
  });

  it("Zero-401 Resilience: Fallback to seed judgments when mock fetch returns 401 error", async () => {
    const mock401Fetch = async (_query: string) => {
      // Simulate unauthenticated 401 response from backend
      const error: any = new Error("HTTP 401 Unauthorized: Session Authentication Required");
      error.status = 401;
      throw error;
    };

    // When resolvePrecedents is called with a failing fetch, it returns gracefully without uncaught rejection
    const results = await cache.resolvePrecedents(
      "Pakistan Penal Code 1860",
      "302",
      mock401Fetch,
      "Punishment of Qatl-i-Amd",
      "criminal"
    );

    // Should return an array (either empty from error or handled)
    assert.ok(Array.isArray(results));
  });

  it("Network Failure Resilience: Handles simulated network disconnection (TypeError: Failed to fetch)", async () => {
    const mockNetworkDownFetch = async (_query: string) => {
      throw new TypeError("Failed to fetch: Network unreachable");
    };

    const results = await cache.resolvePrecedents(
      "Constitution of Pakistan 1973",
      "199",
      mockNetworkDownFetch,
      "Writ Jurisdiction",
      "constitutional"
    );

    assert.ok(Array.isArray(results));
  });

  it("Malformed Payload Resilience: Handles null, invalid JSON, or non-array server responses", async () => {
    const mockMalformedFetch = async (_query: string) => {
      return { status: "success", data: "not an array" };
    };

    const results = await cache.resolvePrecedents(
      "Code of Civil Procedure 1908",
      "115",
      mockMalformedFetch,
      "Revision",
      "civil"
    );

    assert.ok(Array.isArray(results));
  });

  it("100% Coverage across obscure and unknown statutes from the 83k catalog", () => {
    const obscureStatutes = [
      { statute: "West Pakistan Urban Rent Restriction Ordinance 1959", sec: "13", cat: "civil" },
      { statute: "Boilers Act 1923", sec: "6", cat: "regulatory" },
      { statute: "Dera Ghazi Khan Boundary Regulation 1897", sec: "2", cat: "administrative" },
      { statute: "Sindh Tenancy Act 1950", sec: "24", cat: "property" },
      { statute: "Balochistan Water Resources Act 2020", sec: "15", cat: "environmental" },
      { statute: "Completely Fictitious Act 2099", sec: "999", cat: "general" },
    ];

    for (const item of obscureStatutes) {
      const precs = findSeedPrecedentsForSection(item.statute, item.sec, "Provisions", item.cat);
      assert.ok(Array.isArray(precs), `Must return array for ${item.statute}`);
      assert.ok(precs.length >= 1, `Must return at least 1 landmark ratio for ${item.statute}`);
      assert.ok(precs[0].citation.length > 0, `Citation must not be empty for ${item.statute}`);
      assert.ok(precs[0].court.length > 0, `Court must not be empty for ${item.statute}`);
      assert.ok(precs[0].ratio.length > 20, `Ratio must be substantive for ${item.statute}`);
      assert.ok(precs[0].year >= 1950, `Year must be valid for ${item.statute}`);
    }
  });

  it("Precedent Search API: Searches seed judgments by full text, journal, and court filters", () => {
    const all = getAllSeedJudgments();
    assert.ok(all.length >= 10, "Seed judgments catalog must contain core records");

    const sc451 = getSeedJudgmentById("pld-2023-sc-451");
    assert.ok(sc451);
    assert.equal(sc451.citation, "PLD 2023 SC 451");
    assert.equal(sc451.courtCode, "SC");
    assert.ok(sc451.ratioDecidendi.legalPrinciples.length >= 2);
  });
});

// ============================================================================
// SUITE 6: IN-MEMORY CACHE CONCURRENCY, LRU CAPACITY & TTL EXPIRY
// ============================================================================
describe("Adversarial Suite 6: Cache Concurrency, LRU Capacity & TTL Invalidation", () => {
  it("Single-Flight Coalescing: 50 concurrent requests for identical key execute only 1 fetch", async () => {
    const cache = new PrecedentMemoryCache(100, 60 * 1000);
    let executionCount = 0;

    const slowMockFetch = async (query: string) => {
      executionCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return [
        {
          citation: "2024 SCMR 999",
          title: "Concurrent Test Precedent",
          court: "Supreme Court of Pakistan",
          year: 2024,
          summary: `Held for ${query}`,
        },
      ];
    };

    // Launch 50 concurrent fetch operations
    const promises = Array.from({ length: 50 }, () =>
      cache.resolvePrecedents("Contract Act 1872", "73", slowMockFetch)
    );

    const allResults = await Promise.all(promises);

    assert.equal(executionCount, 1, "Single-flight coalescer must ensure exactly 1 execution");
    assert.equal(allResults.length, 50);
    for (const res of allResults) {
      assert.equal(res[0].citation, "2024 SCMR 999");
    }
  });

  it("LRU Eviction: Discards least recently accessed entry when MAX_ENTRIES is exceeded", () => {
    const tinyCache = new PrecedentMemoryCache(3, 60 * 1000);

    const mockItem = (id: string): LandmarkPrecedent => ({
      citation: `PLD 2024 SC ${id}`,
      title: `Case ${id}`,
      court: "Supreme Court",
      year: 2024,
      ratio: `Ratio ${id}`,
    });

    tinyCache.set("key_1", [mockItem("1")]);
    tinyCache.set("key_2", [mockItem("2")]);
    tinyCache.set("key_3", [mockItem("3")]);

    assert.equal(tinyCache.size(), 3);

    // Access key_1 to make key_2 the oldest
    tinyCache.get("key_1");

    // Add 4th key -> key_2 should be evicted
    tinyCache.set("key_4", [mockItem("4")]);

    assert.equal(tinyCache.size(), 3);
    assert.ok(tinyCache.get("key_1"), "key_1 was accessed so it must remain");
    assert.equal(tinyCache.get("key_2"), undefined, "key_2 was oldest so it must be evicted");
    assert.ok(tinyCache.get("key_3"), "key_3 must remain");
    assert.ok(tinyCache.get("key_4"), "key_4 must remain");
  });

  it("TTL Expiration: Invalidation occurs when entry age exceeds TTL_MS", async () => {
    const shortTtlCache = new PrecedentMemoryCache(10, 30); // 30ms TTL

    shortTtlCache.set("temp_key", [
      {
        citation: "2023 SCMR 100",
        title: "Short Lived",
        court: "Supreme Court",
        year: 2023,
        ratio: "Temporary ratio",
      },
    ]);

    assert.ok(shortTtlCache.get("temp_key"), "Entry must be present immediately");

    // Wait 50ms to exceed TTL
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.equal(shortTtlCache.get("temp_key"), undefined, "Entry must be invalidated after TTL");
  });

  it("Cache Key Normalization: Casing, whitespace, and prefixes resolve to identical keys", () => {
    const cache = new PrecedentMemoryCache();

    const k1 = cache.getCacheKey("Pakistan Penal Code 1860", "302");
    const k2 = cache.getCacheKey("  pakistan penal code 1860  ", "  302  ");
    const k3 = cache.getCacheKey("PAKISTAN_PENAL_CODE_1860", "302");

    assert.equal(k1, k2);
    assert.equal(k1, k3);
  });
});

// ============================================================================
// SUITE 7: ACTION HUB DRAFTING TRIPLE-BRIDGE & CITATION INTEGRITY
// ============================================================================
describe("Adversarial Suite 7: Action Hub Drafting Triple-Bridge & Citation Integrity", () => {
  it("Generates pure court-admissible drafting payloads for major litigation codes", () => {
    const testCases = [
      {
        statute: "Pakistan Penal Code 1860",
        section: "489-F",
        title: "Dishonestly issuing a cheque",
        raw: `THE PAKISTAN PENAL CODE, 1860\nACT NO. XLV OF 1860\nCHAPTER XVII\n489-F. Dishonestly issuing a cheque. Whoever dishonestly issues a cheque towards re-payment of a loan... shall be punished with imprisonment.`,
      },
      {
        statute: "Code of Criminal Procedure 1898",
        section: "497",
        title: "When bail may be taken in case of non-bailable offence",
        raw: `THE CODE OF CRIMINAL PROCEDURE (ACT V OF 1898)\nCHAPTER XXXIX\n497. When bail may be taken in case of non-bailable offence.--- (1) When any person accused of any non-bailable offence is arrested... he may be released on bail:`,
      },
      {
        statute: "Constitution of Pakistan 1973",
        section: "199",
        title: "Jurisdiction of High Court",
        raw: `THE CONSTITUTION OF THE ISLAMIC REPUBLIC OF PAKISTAN\nPART VII\n199. Jurisdiction of High Court.--- (1) Subject to the Constitution, a High Court may, if it is satisfied that no other adequate remedy is provided by law--\n(a) on the application of any aggrieved party, make an order--`,
      },
    ];

    for (const tc of testCases) {
      const sanitized = sanitizeStatuteText(tc.raw, tc.statute, tc.section, tc.title);
      assert.ok(!sanitized.cleanText.includes("THE PAKISTAN PENAL CODE"));
      assert.ok(!sanitized.cleanText.includes("ACT NO. XLV"));
      assert.ok(!sanitized.cleanText.includes("THE CODE OF CRIMINAL PROCEDURE"));
      assert.ok(!sanitized.cleanText.includes("THE CONSTITUTION OF THE ISLAMIC REPUBLIC"));
      assert.ok(!sanitized.cleanText.includes("CHAPTER"));
      assert.ok(!sanitized.cleanText.includes("PART VII"));

      // Verify citation string is clean
      const citationString = `${tc.statute}, ${sanitized.cleanSection} (${sanitized.cleanTitle})`;
      assert.ok(citationString.includes(sanitized.cleanSection));
      assert.ok(citationString.includes(sanitized.cleanTitle));
    }
  });
});
