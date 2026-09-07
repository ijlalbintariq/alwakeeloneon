import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { sanitizeStatuteText } from "../client/src/experimental/lib/statuteSanitizer";
import { MAJOR_ENACTMENTS_DATA } from "../client/src/experimental/data/majorEnactmentsData";
import { findSeedPrecedentsForSection } from "../client/src/experimental/data/seedJudgmentsData";

describe("Empirical Full-Dataset Audit across 4,100 Major Sections", () => {
  const macroLeakPatterns = [
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
    { name: "PPC Macro Header", regex: /^THE\s+PAKISTAN\s+PENAL\s+CODE\b/m },
    { name: "CrPC Macro Header", regex: /^THE\s+CODE\s+OF\s+CRIMINAL\s+PROCEDURE\b/m },
    { name: "CPC Macro Header", regex: /^THE\s+CODE\s+OF\s+CIVIL\s+PROCEDURE\b/m },
    { name: "Specific Relief Macro Header", regex: /^THE\s+SPECIFIC\s+RELIEF\s+ACT\b/m },
    { name: "Succession Act Macro Header", regex: /^SUCCESSION\s+ACT\s*1925\b/m },
    { name: "Family Courts Act Macro Header", regex: /^\[?\d*\]*THE\s+FAMILY\s+COURTS\s+ACT\b/m },
    { name: "Muslim Family Laws Macro Header", regex: /^(?:MITSLIM|MUSLIM)\s+FAMILY\s+LAWS\s+ORDINANCE\b/m },
  ];

  it("Audits all 4,100 sections in MAJOR_ENACTMENTS_DATA for non-empty sanitized output and 0 macro header leaks", () => {
    let count = 0;
    let gazetteLeaked = 0;
    const leakedExamples: any[] = [];

    const entries = Object.entries(MAJOR_ENACTMENTS_DATA);
    assert.equal(entries.length, 4100, "Dataset must contain exactly 4,100 sections");

    for (const [id, sec] of entries) {
      count++;
      const res = sanitizeStatuteText(sec.description, sec.statute, sec.section, sec.title);
      assert.ok(res.cleanSection, `cleanSection must exist for ${id}`);
      assert.ok(res.cleanTitle, `cleanTitle must exist for ${id}`);
      assert.ok(typeof res.cleanText === "string", `cleanText must be string for ${id}`);
      assert.ok(
        res.cleanText.length > 0 || res.amendmentNotes.length > 0,
        `Section must have cleanText or amendmentNotes for ${id}`
      );

      // Check all macro leak patterns against cleanText
      for (const check of macroLeakPatterns) {
        if (check.regex.test(res.cleanText)) {
          gazetteLeaked++;
          if (leakedExamples.length < 10) {
            leakedExamples.push({
              id,
              statute: sec.statute,
              section: sec.section,
              pattern: check.name,
              preview: res.cleanText.slice(0, 150).replace(/\n/g, " ↵ "),
            });
          }
          break;
        }
      }
    }

    console.log(`Audited ${count} sections. Macro noise leaked in ${gazetteLeaked} sections.`);
    if (leakedExamples.length > 0) {
      console.log("Leaked examples:", JSON.stringify(leakedExamples, null, 2));
    }
    assert.equal(
      gazetteLeaked,
      0,
      `Must leak 0 macro noise headers across all 4,100 sections, but leaked in ${gazetteLeaked}: ${JSON.stringify(leakedExamples, null, 2)}`
    );
  });

  it("Audits precedent resolution across ALL 4,100 sections for 100% coverage, landmark ratio depth, and zero 401 blocker", () => {
    let precCount = 0;
    for (const [id, sec] of Object.entries(MAJOR_ENACTMENTS_DATA)) {
      const precs = findSeedPrecedentsForSection(sec.statute, sec.section, sec.title, sec.category);
      assert.ok(Array.isArray(precs), `Must return array for ${id}`);
      assert.ok(precs.length >= 1, `Must have at least 1 landmark authority for ${id}`);
      assert.ok(precs[0].citation, `Must have citation for ${id}`);
      assert.ok(precs[0].court, `Must have court for ${id}`);
      assert.ok(precs[0].year > 1900, `Must have valid year for ${id}`);
      assert.ok(precs[0].ratio && precs[0].ratio.length > 20, `Must have comprehensive ratio for ${id}`);
      precCount++;
    }
    assert.equal(precCount, 4100, "All 4,100 sections must resolve landmark precedent authorities");
  });
});
