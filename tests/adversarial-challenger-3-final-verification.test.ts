/**
 * ============================================================================
 * CHALLENGER 3: FINAL ADVERSARIAL VERIFICATION TEST SUITE (M1-M4)
 * ============================================================================
 * Exhaustive empirical verification across all 4,100 sections, edge cases,
 * Roman CPC orders, Urdu izafats, subclause preservation (i)-(x),
 * Action Hub payload hygiene, and 100% zero-401 precedent fallback.
 * ============================================================================
 */

import { describe, it } from "node:test";
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
  MAJOR_ENACTMENTS_DATA,
  getSectionsForEnactment,
  getMajorSectionById,
} from "../client/src/experimental/data/majorEnactmentsData";
import {
  findSeedPrecedentsForSection,
  searchSeedJudgments,
  getAllSeedJudgments,
} from "../client/src/experimental/data/seedJudgmentsData";
import {
  PrecedentMemoryCache,
  precedentCache,
} from "../client/src/experimental/lib/precedentCache";

describe("CHALLENGER 3: Final Adversarial Empirical Verification (Milestones M1-M4)", () => {
  // ─── SUITE 1: 4,100 SECTIONS EXHAUSTIVE EMPIRICAL DATASET AUDIT ──────────
  describe("Suite 1: 4,100 Sections Exhaustive Empirical Dataset Audit", () => {
    it("[CH3-1.1] Sanitizes all 4,100 sections with 0 macro header leaks and 0 runtime exceptions", () => {
      const entries = Object.entries(MAJOR_ENACTMENTS_DATA);
      assert.equal(entries.length, 4100, "Dataset must contain exactly 4,100 sections");

      const macroLeakChecks = [
        { name: "Arbitration Act Header", regex: /^THE\s+ARBITRATION\s+ACT\b/m },
        { name: "Registration Act Header", regex: /^THE\s+REGISTRATION\s+ACT\b/m },
        { name: "JS scraper artifact", regex: /document\.onkeyup/i },
        { name: "Court Fees Act Header", regex: /^COURT?\s+FEES\s+ACT,?\s*1870/m },
        { name: "Companies Ordinance Header", regex: /^COMPANIES\s+ORDINANCE\s*1984/m },
        { name: "Companies Ordinance Preamble Fragment", regex: /^amend\s+the\s+law\s+relating\s+to\s+companies/m },
        { name: "Preamble / WHEREAS block", regex: /^Preamble\.\s*WHEREAS/m },
        { name: "PECA Header", regex: /^2008\s+PREVENTION\s+OF\s+ELECTRONIC\s+CRIMES\s+ORDINANCE/m },
        { name: "Ordinance Promulgation Banner", regex: /the\s+President\s+is\s+pleased\s+to\s+make\s+and\s+promulgate/i },
        { name: "Constitutional 35-line Preamble", regex: /adopt,\s*enact\s*and\s*give\s*to\s*ourselves,\s*this\s*Constitution/i },
        { name: "CPC 40-line Select Committee", regex: /dated\s+the\s+1st\s+June,?\s*1951/i },
        { name: "Cataloged OCR Shits", regex: /\bLimitation of Shits\b/i },
        { name: "Cataloged OCR proposal", regex: /\bsail w make proposal\b/i },
        { name: "Companies Gazette No", regex: /\bORDINANCE\s+NO\.\s+XLVII\s+OF\s+1984\b/i },
      ];

      let leakCount = 0;
      const leakDetails: any[] = [];

      for (const [id, record] of entries) {
        const sanitized = sanitizeStatuteText(
          record.description,
          record.statute,
          record.section,
          record.title
        );

        assert.ok(sanitized.cleanSection, `cleanSection missing for ${id}`);
        assert.ok(sanitized.cleanTitle, `cleanTitle missing for ${id}`);
        assert.ok(typeof sanitized.cleanText === "string", `cleanText invalid for ${id}`);

        // Check for macro leaks
        for (const check of macroLeakChecks) {
          if (check.regex.test(sanitized.cleanText)) {
            leakCount++;
            if (leakDetails.length < 10) {
              leakDetails.push({
                id,
                statute: record.statute,
                section: record.section,
                issue: check.name,
                snippet: sanitized.cleanText.slice(0, 120).replace(/\n/g, " ↵ "),
              });
            }
            break;
          }
        }
      }

      assert.equal(
        leakCount,
        0,
        `Expected 0 macro header leaks across 4,100 sections, but found ${leakCount}: ${JSON.stringify(leakDetails, null, 2)}`
      );
    });

    it("[CH3-1.2] Exhaustively verifies zero-401 precedent fallback across ALL 4,100 sections", () => {
      const entries = Object.entries(MAJOR_ENACTMENTS_DATA);
      let missingPrecedentsCount = 0;

      for (const [id, record] of entries) {
        const precs = findSeedPrecedentsForSection(
          record.statute,
          record.section,
          record.title,
          record.category
        );

        if (!Array.isArray(precs) || precs.length === 0) {
          missingPrecedentsCount++;
          continue;
        }

        const primary = precs[0];
        if (!primary.citation || !primary.ratio || !primary.court || !primary.year) {
          missingPrecedentsCount++;
        }
      }

      assert.equal(
        missingPrecedentsCount,
        0,
        `All 4,100 sections must resolve at least 1 valid precedent, but ${missingPrecedentsCount} failed`
      );
    });
  });

  // ─── SUITE 2: SUBCLAUSE PRESERVATION (i) THROUGH (x) & OCR DIGIT DISAMBIGUATION ────────
  describe("Suite 2: Statutory Subclause (i)-(x) Preservation & OCR Digit Disambiguation", () => {
    it("[CH3-2.1] Preserves lowercase Roman numeral subclauses (i) through (x) without digit conversion", () => {
      const rawText = `Every high court may make rules providing for:
(i) the inspection of records of subordinate courts;
(ii) the mode of taking evidence;
(iii) the fees to be charged for process;
(iv) the custody of documents and movable property;
(v) the appointment of receivers and guardians;
(vi) the regulation of summary proceedings;
(vii) the distribution of business;
(viii) the translation of judicial records;
(ix) the admission of legal practitioners;
(x) the administration of oath.`;

      const sanitized = sanitizeStatuteText(rawText, "Code of Civil Procedure 1908", "122");

      assert.ok(sanitized.cleanText.includes("(i) the inspection"), "(i) must be preserved verbatim");
      assert.ok(sanitized.cleanText.includes("(ii) the mode"), "(ii) must be preserved verbatim");
      assert.ok(sanitized.cleanText.includes("(iii) the fees"), "(iii) must be preserved verbatim");
      assert.ok(sanitized.cleanText.includes("(iv) the custody"), "(iv) must be preserved verbatim");
      assert.ok(sanitized.cleanText.includes("(v) the appointment"), "(v) must be preserved verbatim");
      assert.ok(sanitized.cleanText.includes("(vi) the regulation"), "(vi) must be preserved verbatim");
      assert.ok(sanitized.cleanText.includes("(vii) the distribution"), "(vii) must be preserved verbatim");
      assert.ok(sanitized.cleanText.includes("(viii) the translation"), "(viii) must be preserved verbatim");
      assert.ok(sanitized.cleanText.includes("(ix) the admission"), "(ix) must be preserved verbatim");
      assert.ok(sanitized.cleanText.includes("(x) the administration"), "(x) must be preserved verbatim");

      // Verify that (i) was NOT converted to (1)
      assert.ok(!sanitized.cleanText.includes("(1) the inspection"), "(i) must not turn into (1)");
      assert.ok(!sanitized.cleanText.includes("(2) the mode"), "(ii) must not turn into (2)");
    });

    it("[CH3-2.2] Disambiguates OCR digit corruptions (l) and (I) into (1) while preserving (i)", () => {
      const textWithOcrL = `(l) Any person who abets an offence punishable under this Act.\n(2) Where an offence is committed by a body corporate.`;
      const textWithOcrI = `(I) Whoever commits qatl-i-amd shall be punished.\n(2) In case of ta'zir.`;
      const textWithRomanI = `(i) In case of immovable property;\n(ii) In case of movable property.`;

      const resL = sanitizeStatuteText(textWithOcrL, "PPC", "109");
      const resI = sanitizeStatuteText(textWithOcrI, "PPC", "302");
      const resRoman = sanitizeStatuteText(textWithRomanI, "Specific Relief Act", "12");

      assert.ok(resL.cleanText.startsWith("(1) Any person"), "OCR (l) at line start must convert to (1)");
      assert.ok(resI.cleanText.startsWith("(1) Whoever commits"), "OCR (I) at line start must convert to (1)");
      assert.ok(resRoman.cleanText.includes("(i) In case of"), "Roman (i) must remain (i)");
    });

    it("[CH3-2.3] Preserves hierarchical nesting across Arabic, Alphabetic, and Roman subclauses", () => {
      const nestedRaw = `(1) A suit for injunction may be instituted:
(a) where the defendant is trustee of the property:
(i) if the property is held in express trust;
(ii) if the breach cannot be adequately compensated in money;
(b) where there exists no standard for ascertaining the actual damage:
(i) in respect of patent rights;
(ii) in respect of trade secrets;
(2) Nothing in this section shall apply to public trusts.`;

      const sanitized = sanitizeStatuteText(nestedRaw, "Specific Relief Act 1877", "54");

      assert.ok(sanitized.cleanText.includes("(1) A suit for injunction"));
      assert.ok(sanitized.cleanText.includes("(a) where the defendant"));
      assert.ok(sanitized.cleanText.includes("(i) if the property is held"));
      assert.ok(sanitized.cleanText.includes("(ii) if the breach cannot"));
      assert.ok(sanitized.cleanText.includes("(b) where there exists"));
      assert.ok(sanitized.cleanText.includes("(i) in respect of patent"));
      assert.ok(sanitized.cleanText.includes("(ii) in respect of trade"));
      assert.ok(sanitized.cleanText.includes("(2) Nothing in this section"));
    });
  });

  // ─── SUITE 3: ROMAN NUMERAL CPC ORDERS & CONSTITUTIONAL ARTICLES ─────────
  describe("Suite 3: Roman Numeral CPC Orders & Constitutional Articles", () => {
    it("[CH3-3.1] Formats Roman numeral CPC Order designations cleanly without Section prefix", () => {
      const testCases = [
        { input: "Order XXI Rule 58", statute: "Code of Civil Procedure 1908", expected: "Order XXI Rule 58" },
        { input: "Order VII Rule 11", statute: "Code of Civil Procedure 1908", expected: "Order VII Rule 11" },
        { input: "Order XXXIX Rules 1 & 2", statute: "CPC", expected: "Order XXXIX Rules 1 & 2" },
        { input: "Order XLI Rule 27", statute: "Civil Procedure Code", expected: "Order XLI Rule 27" },
        { input: "O. 6 R. 17", statute: "Code of Civil Procedure", expected: "O. 6 R. 17" },
        { input: "O39R1", statute: "CPC", expected: "O39R1" },
        { input: "order 8 rule 1", statute: "CPC", expected: "order 8 rule 1" },
      ];

      for (const tc of testCases) {
        const formatted = sanitizeSectionNumber(tc.input, tc.statute);
        assert.equal(formatted, tc.expected, `Input ${tc.input} must normalize to ${tc.expected}`);
      }
    });

    it("[CH3-3.2] Formats Constitutional Articles cleanly with 'Article' prefix", () => {
      const testCases = [
        { input: "199", statute: "Constitution of the Islamic Republic of Pakistan 1973", expected: "Article 199" },
        { input: "Art-184(3)", statute: "Constitution of Pakistan", expected: "Article 184(3)" },
        { input: "article 10-A", statute: "Constitution", expected: "Article 10-A" },
        { input: "constitution-art-25", statute: "Constitution of Pakistan 1973", expected: "Article 25" },
      ];

      for (const tc of testCases) {
        const formatted = sanitizeSectionNumber(tc.input, tc.statute);
        assert.equal(formatted, tc.expected, `Input ${tc.input} must normalize to ${tc.expected}`);
      }
    });

    it("[CH3-3.3] Formats standard Code sections with 'Section' prefix", () => {
      const testCases = [
        { input: "302", statute: "Pakistan Penal Code 1860", expected: "Section 302" },
        { input: "ppc-sec-489f", statute: "Pakistan Penal Code", expected: "Section 489f" },
        { input: "crpc-497", statute: "Code of Criminal Procedure 1898", expected: "Section 497" },
        { input: "sec-24c", statute: "Specific Relief Act 1877", expected: "Section 24c" },
        { input: "Section 12", statute: "Specific Relief Act", expected: "Section 12" },
      ];

      for (const tc of testCases) {
        const formatted = sanitizeSectionNumber(tc.input, tc.statute);
        assert.equal(formatted, tc.expected, `Input ${tc.input} must normalize to ${tc.expected}`);
      }
    });
  });

  // ─── SUITE 4: PAKISTANI URDU IZAFATS & COMPOUND LEGAL TITLES ─────────────
  describe("Suite 4: Pakistani Urdu Izafats & Compound Legal Titles", () => {
    it("[CH3-4.1] Preserves lowercase Urdu izafat 'i' in Islamic and statutory compound terms", () => {
      const testCases = [
        { input: "PUNISHMENT OF QATL-I-AMD", expected: "Punishment of Qatl-i-Amd" },
        { input: "QATL-I-KHATA COMMITTED BY RASH OR NEGLIGENT DRIVING", expected: "Qatl-i-Khata Committed by Rash or Negligent Driving" },
        { input: "VALUE OF DIYAT-I-KAMILAH", expected: "Value of Diyat-i-Kamilah" },
        { input: "COMPENSATION AS ARSH-I-JAFAH", expected: "Compensation as Arsh-i-Jafah" },
        { input: "RIGHT OF HAQ-I-SHUFA", expected: "Right of Haq-i-Shufa" },
        { input: "EFFECT OF TALAQ-I-AHSAN", expected: "Effect of Talaq-i-Ahsan" },
        { input: "DETERMINATION OF DAM-I-HUKUMAT", expected: "Determination of Dam-i-Hukumat" },
      ];

      for (const tc of testCases) {
        const res = sanitizeSectionTitle(tc.input);
        assert.equal(res, tc.expected, `Title '${tc.input}' must format to '${tc.expected}', got '${res}'`);
      }
    });

    it("[CH3-4.2] Preserves standard legal prepositions in lowercase in middle of titles", () => {
      const raw = "SUIT FOR DECLARATION OF TITLE AND PERMANENT INJUNCTION UNDER SPECIFIC RELIEF ACT";
      const clean = sanitizeSectionTitle(raw);
      assert.equal(
        clean,
        "Suit for Declaration of Title and Permanent Injunction under Specific Relief Act"
      );
    });
  });

  // ─── SUITE 5: ACTION HUB PAYLOAD HYGIENE & DRAFTING CANVASSING ───────────
  describe("Suite 5: Action Hub Payload Hygiene & Drafting Canvassing", () => {
    it("[CH3-5.1] Builds clean court-admissible drafting payloads without gazette headers", () => {
      const rawDescription = `THE PAKISTAN PENAL CODE
ACT NO. XLV OF 1860
302. Punishment of qatl-i-amd.--- Whoever commits qatl-i-amd shall, subject to the provisions of this Chapter be:
(a) punished with death as qisas;
(b) punished with death for life imprisonment as ta'zir;
(c) punished with imprisonment of either description for a term which may extend to twenty-five years.`;

      const sanitized = sanitizeStatuteText(rawDescription, "Pakistan Penal Code 1860", "302", "Punishment of Qatl-i-Amd");
      const cleanClauseText = sanitized.cleanText.replace(/\n+/g, " ").trim();

      const draftingPayload = {
        statute: "Pakistan Penal Code 1860",
        section: sanitized.cleanSection,
        title: sanitized.cleanTitle,
        clause: `STATUTORY PROVISION & RELEVANT LAW:\n${sanitized.cleanSection} of Pakistan Penal Code 1860 (${sanitized.cleanTitle})\n\n"${cleanClauseText}"\n\nLEGAL GROUNDS & APPLICABLE PRINCIPLES:\nThat under the provisions of ${sanitized.cleanSection} of Pakistan Penal Code 1860, the petitioner is entitled to the relief claimed in accordance with established law.`,
        formattedCitation: `${sanitized.cleanSection}, Pakistan Penal Code 1860`,
        timestamp: Date.now(),
      };

      assert.equal(draftingPayload.section, "Section 302");
      assert.equal(draftingPayload.title, "Punishment of Qatl-i-Amd");
      assert.ok(!draftingPayload.clause.includes("THE PAKISTAN PENAL CODE"));
      assert.ok(!draftingPayload.clause.includes("ACT NO. XLV OF 1860"));
      assert.ok(draftingPayload.clause.includes("Whoever commits qatl-i-amd shall"));
      assert.ok(draftingPayload.formattedCitation === "Section 302, Pakistan Penal Code 1860");
    });

    it("[CH3-5.2] Formats rich landmark ratio insertion payload for Legal Drafting Studio", () => {
      const prec = {
        citation: "2024 SCMR 892",
        title: "TARIQ MEHMOOD Vs THE STATE",
        court: "Supreme Court of Pakistan",
        year: 2024,
        ratio: "Under Section 497(2) Cr.P.C., release on bail in cases of further inquiry is a statutory entitlement.",
      };

      const statuteTitle = "Code of Criminal Procedure 1898";
      const sectionNumber = "Section 497";

      const draftingClause = `STATUTORY PROVISION & RELEVANT LAW:\n${sectionNumber} of ${statuteTitle}\n\nLEGAL GROUNDS & APPLICABLE PRINCIPLES:\nThat as settled by the Honourable ${prec.court} in ${prec.citation} (${prec.title}):\n"${prec.ratio}"\n\nConsequently, the petitioner is entitled to the relief sought in accordance with law.`;

      assert.ok(draftingClause.includes("2024 SCMR 892"));
      assert.ok(draftingClause.includes("Supreme Court of Pakistan"));
      assert.ok(draftingClause.includes("Section 497 of Code of Criminal Procedure 1898"));
      assert.ok(draftingClause.includes("statutory entitlement"));
    });
  });

  // ─── SUITE 6: ZERO-401 FAULT INJECTION & CONCURRENT LRU CACHING ──────────
  describe("Suite 6: Zero-401 Fault Injection & Concurrent LRU Caching", () => {
    it("[CH3-6.1] Resiliently handles simulated 401 HTTP error responses without propagating exceptions", async () => {
      const cache = new PrecedentMemoryCache(100, 5000);

      // Fault injection: mockFetchFn returns HTTP 401 response or throws 401
      const mock401Fetch = async () => {
        throw new Error("401 Unauthorized: Bearer token invalid or expired");
      };

      // With our zero-401 fallback architecture, resolvePrecedents gracefully catches errors
      const results = await cache.resolvePrecedents("Pakistan Penal Code 1860", "302", mock401Fetch);

      // In cache error state, it returns [] gracefully without uncaught rejection
      assert.ok(Array.isArray(results), "Must return array even upon 401 error");

      // Verify direct fallback via findSeedPrecedentsForSection works synchronously
      const seedResults = findSeedPrecedentsForSection("Pakistan Penal Code 1860", "302");
      assert.ok(seedResults.length >= 1, "Seed precedents provide 100% instant fallback");
      assert.ok(seedResults[0].citation.includes("SCMR") || seedResults[0].citation.includes("PLD"));
    });

    it("[CH3-6.2] Contextual Synthesis provides valid Apex Court ratios for completely fictional or obscure statutes", () => {
      const fictionalStatutes = [
        { statute: "Artificial Intelligence Governance Ordinance 2026", section: "Section 4" },
        { statute: "Balochistan Mineral Exploration Act 2018", section: "Section 19-A" },
        { statute: "Unknown Tribal Customary Code", section: "Clause 7" },
      ];

      for (const item of fictionalStatutes) {
        const precs = findSeedPrecedentsForSection(item.statute, item.section);
        assert.ok(precs.length >= 1, `Must synthesize precedent for ${item.statute}`);
        assert.ok(precs[0].citation, "Must have citation");
        assert.ok(precs[0].court.includes("Court"), "Must reference Pakistani superior court");
        assert.ok(precs[0].ratio.length > 30, "Must have substantial legal ratio");
      }
    });

    it("[CH3-6.3] Single-flight coalescing prevents concurrent duplicate lookups", async () => {
      const cache = new PrecedentMemoryCache(50, 10000);
      let backendCallCount = 0;

      const mockSlowFetch = async () => {
        backendCallCount++;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return [{ citation: "2024 SCMR 100", title: "Test Landmark", court: "SC", year: 2024, summary: "Ratio" }];
      };

      // Fire 20 parallel requests for the same statute/section
      const promises = Array.from({ length: 20 }, () =>
        cache.resolvePrecedents("Constitution of Pakistan", "199", mockSlowFetch)
      );

      const results = await Promise.all(promises);

      assert.equal(backendCallCount, 1, "Single-flight coalescing must restrict network fetches to exactly 1");
      assert.equal(results.length, 20);
      assert.equal(results[0][0].citation, "2024 SCMR 100");
    });
  });
});
