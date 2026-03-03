import assert from "node:assert/strict";
import test from "node:test";

import { CitationExtractor } from "../../server/services/citation-extractor";
import { storage } from "../../server/storage";

test("extractFromText parses supported citation formats and removes duplicates", () => {
  const extractor = new CitationExtractor();
  const text = "See 2022 PLD 100 and also 2022 pld 100, then 2021 SCMR 77 in support.";

  const citations = extractor.extractFromText(text, "judgment-1");

  assert.equal(citations.length, 2);
  assert.equal(citations[0].rawCitation, "2022 PLD 100");
  assert.equal(citations[0].journalCode, "PLD");
  assert.equal(citations[1].rawCitation, "2021 SCMR 77");
  assert.ok(citations[0].contextExcerpt.length > 0);
});

test("inferCitationType returns expected treatment", () => {
  const extractor = new CitationExtractor();

  assert.equal(extractor.inferCitationType("This precedent was overruled by a later bench."), "overruled");
  assert.equal(extractor.inferCitationType("The case is clearly distinguished on facts."), "distinguished");
  assert.equal(extractor.inferCitationType("This ratio was relied upon and followed."), "relied_upon");
  assert.equal(extractor.inferCitationType("Reference is made to earlier authority."), "referred_to");
});

test("processJudgment creates resolved and unresolved citation records", async () => {
  const extractor = new CitationExtractor();
  const originalSearch = (storage as any).searchJudgmentsByCitation;
  const originalCreateLinks = (storage as any).createCitationLinks;
  const originalCreateUnresolved = (storage as any).createUnresolvedCitations;

  const resolvedLinks: any[] = [];
  const unresolvedRows: any[] = [];

  (storage as any).searchJudgmentsByCitation = async ({ year, journalCode, page }: any) => {
    if (year === 2022 && journalCode === "PLD" && page === 100) {
      return [{
        id: "target-judgment-id",
        citation: "2022 PLD 100",
        title: "Sample Judgment",
        court: "Supreme Court of Pakistan",
        decisionDate: null,
        pdfUrl: null,
      }];
    }
    return [];
  };

  (storage as any).createCitationLinks = async (entries: any[]) => {
    resolvedLinks.push(...entries);
    return entries.length;
  };

  (storage as any).createUnresolvedCitations = async (entries: any[]) => {
    unresolvedRows.push(...entries);
    return entries.length;
  };

  try {
    const stats = await extractor.processJudgment(
      "source-judgment-id",
      "The court relied upon 2022 PLD 100. It also refers to 2021 SCMR 77 for comparison.",
    );

    assert.deepEqual(stats, { totalFound: 2, resolved: 1, unresolved: 1 });
    assert.equal(resolvedLinks.length, 1);
    assert.equal(resolvedLinks[0].targetJudgmentId, "target-judgment-id");
    assert.equal(resolvedLinks[0].citationType, "relied_upon");
    assert.equal(unresolvedRows.length, 1);
    assert.equal(unresolvedRows[0].rawCitation, "2021 SCMR 77");
  } finally {
    (storage as any).searchJudgmentsByCitation = originalSearch;
    (storage as any).createCitationLinks = originalCreateLinks;
    (storage as any).createUnresolvedCitations = originalCreateUnresolved;
  }
});
