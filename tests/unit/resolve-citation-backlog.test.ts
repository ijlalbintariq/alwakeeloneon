import assert from "node:assert/strict";
import test from "node:test";
import { inferCitationType, resolveCitationBacklog } from "../../scripts/resolve-citation-backlog";

test("inferCitationType correctly handles all required cases", () => {
  // Case 1: Relied upon / relied on / followed / following
  assert.equal(inferCitationType("The court relied on the previous ruling."), "relied_upon");
  assert.equal(inferCitationType("We are following the principles established in X."), "relied_upon");
  assert.equal(inferCitationType("This was followed by subsequent decisions."), "relied_upon");
  assert.equal(inferCitationType("The precedent was relied upon by both parties."), "relied_upon");

  // Case 2: Distinguish / distinguished
  assert.equal(inferCitationType("We must distinguish this case from the current facts."), "distinguished");
  assert.equal(inferCitationType("The present case is distinguished because of the distinct timeline."), "distinguished");

  // Case 3: Overrule / overruled
  assert.equal(inferCitationType("This court has chosen to overrule the prior view."), "overruled");
  assert.equal(inferCitationType("That judgment was explicitly overruled in 2020."), "overruled");

  // Case 4: Default / referred to
  assert.equal(inferCitationType("The counsel referred to the 2018 judgment."), "referred_to");
  assert.equal(inferCitationType(null), "referred_to");
  assert.equal(inferCitationType(""), "referred_to");
});

test("resolveCitationBacklog successfully processes, maps, inserts, and deletes citations", async () => {
  const mockCitations = [
    {
      id: 101,
      sourceJudgmentId: "source-uuid-1",
      rawCitation: "2020 PLD 15",
      contextExcerpt: "The court relied upon 2020 PLD 15.",
      status: "pending"
    },
    {
      id: 102,
      sourceJudgmentId: "source-uuid-1",
      rawCitation: "2021 SCMR 200",
      contextExcerpt: "We must distinguish 2021 SCMR 200.",
      status: "pending"
    },
    {
      id: 103,
      sourceJudgmentId: "source-uuid-2",
      rawCitation: "2019 MLD 45",
      contextExcerpt: "As referenced in 2019 MLD 45.",
      status: "pending"
    }
  ];

  const mockJudgments = [
    {
      id: "target-uuid-15",
      citationString: "2020 PLD 15"
    },
    {
      id: "target-uuid-200",
      citationString: "2021 SCMR 200"
    }
    // "2019 MLD 45" is not in the database (unresolved)
  ];

  const insertCalls: any[] = [];
  const deleteCalls: any[] = [];
  let transactionCalled = false;

  const mockTx = {
    insert: (table: any) => ({
      values: (values: any[]) => ({
        onConflictDoNothing: async () => {
          insertCalls.push(...values);
        }
      })
    }),
    delete: (table: any) => ({
      where: async (whereClause: any) => {
        deleteCalls.push(whereClause);
      }
    })
  };

  const mockDb: any = {
    select: () => ({
      from: (table: any) => ({
        where: (whereClause: any) => ({
          orderBy: (orderClause: any) => ({
            limit: async (limitSize: number) => {
              // Return citations on first chunk request, then empty array to stop loop
              if (limitSize === 5000 && !transactionCalled) {
                return mockCitations;
              }
              return [];
            }
          })
        })
      }),
      // Query judgments for matches
      fromJudgments: (table: any) => ({
        where: async (whereClause: any) => {
          return mockJudgments;
        }
      })
    }),
    transaction: async (cb: any) => {
      transactionCalled = true;
      await cb(mockTx);
    }
  };

  // Override select for the second part (judgments query)
  const originalSelect = mockDb.select;
  mockDb.select = (selectFields?: any) => {
    // If it's selecting judgments, route to judgments query mock
    if (selectFields && selectFields.id && selectFields.citationString) {
      return {
        from: (table: any) => ({
          where: async (whereClause: any) => {
            return mockJudgments;
          }
        })
      };
    }
    return originalSelect();
  };

  const result = await resolveCitationBacklog(mockDb, 5000);

  // We should have processed 3 citations
  assert.equal(result.totalProcessed, 3);
  // We should have resolved 2 citations (the ones with matching judgments)
  assert.equal(result.totalResolved, 2);

  // Verification of the transaction inserts
  assert.equal(transactionCalled, true);
  assert.equal(insertCalls.length, 2);

  // Validate properties of the inserted links
  assert.equal(insertCalls[0].sourceJudgmentId, "source-uuid-1");
  assert.equal(insertCalls[0].targetJudgmentId, "target-uuid-15");
  assert.equal(insertCalls[0].citationText, "2020 PLD 15");
  assert.equal(insertCalls[0].citationType, "relied_upon");

  assert.equal(insertCalls[1].sourceJudgmentId, "source-uuid-1");
  assert.equal(insertCalls[1].targetJudgmentId, "target-uuid-200");
  assert.equal(insertCalls[1].citationText, "2021 SCMR 200");
  assert.equal(insertCalls[1].citationType, "distinguished");

  // Validate deletes were initiated
  assert.equal(deleteCalls.length, 1);
});
