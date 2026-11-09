/**
 * tests/unit/reconcile-unknown-citations.test.ts
 *
 * Tests for deterministic unknown citation reconciliation without AI calls.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  extractEnhancedHeader,
  evaluateJudgmentReconciliation,
} from "../../scripts/reconcile-unknown-citations";

test("extractEnhancedHeader handles spaced law journal acronyms and OCR line breaks", () => {
  const text = `
2000 P L C (C

2000 P L C
(C.S.) 247

[Supreme
Court (AJ&K)]

Present:
Sardar Said Muhammad Khan, CJ., Basharat Ahmad Shaikh and Muhammad Yunus Surakhvi, JJ

MUHAMMAD ARSHAD KHAN, TEHSILDAR and another

Versus

AZAD GOVERNMENT OF THE STATE OF JAMMU AND KASHMIR through Chief Secretary, Muzaffarabad and others
Civil Appeal No. 12 of 1999, decided on 10th November, 1999.
JUDGMENT
`;
  const result = extractEnhancedHeader(text, "2000 PLC(CS) 247");
  assert.equal(result.isMismatch, false);
  assert.ok(result.reportedCitation?.includes("2000"));
});

test("extractEnhancedHeader detects genuine year citation mismatches", () => {
  const text = `
Court Name: Peshawar High Court
Judge(s): Assadullah Khan Chamkani
Title: Akhtar Ali vs STATE
Case No.: Cr.A. No.495-P/2011
Date of Judgment:2014-10-14
Reported As: 2014-PHC 100
Result: N/A

JUDGMENT
ASSADULLAH KHAN CHAMKANI, J.- Appellant Akhtar Ali was tried for murder under section 302 PPC. The trial court convicted him and sentenced him to life imprisonment. Hence this appeal before this honorable court.
`;
  const result = extractEnhancedHeader(text, "2001 PLD 222");
  assert.equal(result.isMismatch, true);
  assert.ok(result.mismatchReason?.includes("conflicts"));
});

test("evaluateJudgmentReconciliation recovers genuine cases with OCR party artifacts", () => {
  const text = `
1968 SCMR 186
Present S. A. Rahman and Hamoodur Rahman, JJ
TAJ MUHAMMAD-Petitioner
Versus
Mst. FATEMA AND 6 OTHERs-Respondents
Civil Review Petition No. 77 of 1967, decided on 22nd December 1967.
JUDGMENT
S. A. RAHMAN, J.-By this petition Taj Muhammad seeks review...
`;
  const decision = evaluateJudgmentReconciliation({
    id: "0007d41f-d8fd-4913-a467-eb0dd7698962",
    citation_string: "1968 SCMR 186",
    title: "TAJ MUHAMMAD VS Mst. FATEMA",
    court_name_snapshot: "SUPREME-COURT",
    full_text: text,
  });

  assert.equal(decision.proposedTextStatus, "own");
  assert.equal(decision.confidence, "high");
});

test("evaluateJudgmentReconciliation flags true mismatches as mislabeled", () => {
  const text = `
Court Name: Peshawar High Court
Title: Akhtar Ali vs STATE
Reported As: 2014-PHC
JUDGMENT
ASSADULLAH KHAN CHAMKANI, J.- Appellant Akhtar Ali was tried for murder under section 302 PPC. The trial court convicted him and sentenced him to life imprisonment. Hence this appeal before this honorable court.
`;
  const decision = evaluateJudgmentReconciliation({
    id: "00093fdc-4b1a-49a0-bd7c-b1fc0b04c368",
    citation_string: "2001 PLD 222",
    title: "Akhtar Ali vs STATE",
    court_name_snapshot: "Peshawar High Court",
    full_text: text,
  });

  assert.equal(decision.proposedTextStatus, "mislabeled");
  assert.ok(decision.reason.includes("conflicts"));
});
