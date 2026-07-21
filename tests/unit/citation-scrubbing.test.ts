process.env.DATABASE_URL = "postgresql://localhost:5432/dummy_test_db";
process.env.PGHOST = "localhost";

import test from "node:test";
import assert from "node:assert/strict";
import { enforceProseCitationIntegrity, enforceStatuteSectionIntegrity, verifyReferencesBlock } from "../../server/routes";

test("enforceProseCitationIntegrity behaves correctly based on strictCitations", async () => {
  const trusted = new Set(["2025 SCMR 123", "PLD 2024 SC 100"]);
  
  const text = "As held in **[2025 SCMR 123]** and also **[2024 SCMR 999]**.";
  
  const resultStrict = await enforceProseCitationIntegrity(text, trusted);
  assert.ok(resultStrict.includes("2025 SCMR 123"));
  assert.ok(!resultStrict.includes("2024 SCMR 999"));
});

test("enforceStatuteSectionIntegrity replaces unverified CPC Order Rule mentions", async () => {
  const text = "As per Order XLI Rule 19 of CPC, a restoration can be filed.";
  // Order XLI Rule 19 of CPC is unverified in empty database, and CPC Order pattern does not check actExistsInDb.
  // It should be replaced with "the relevant provision of CPC"
  const result = await enforceStatuteSectionIntegrity(text);
  assert.ok(result.includes("the relevant provision of CPC"));
  assert.ok(!result.includes("Order XLI Rule 19 of CPC"));
});

test("enforceProseCitationIntegrity scrubs citation immediately if it is not in the trusted pool, skipping DB lookup", async () => {
  const trusted = new Set(["2025 SCMR 123"]);
  const text = "See **[2024 SCMR 999]**.";
  const result = await enforceProseCitationIntegrity(text, trusted);
  assert.ok(!result.includes("2024 SCMR 999"));
});

test("verifyReferencesBlock preserves unverified statutes if the Act itself is not present in the database", async () => {
  const text = "We rely on Section 10 of NonExistentDummyAct, 2026.\n\n```references\n{\"laws\":[{\"name\":\"NonExistentDummyAct, 2026\",\"section\":\"Section 10\",\"description\":\"Test description\"}],\"judgments\":[]}\n```";
  const result = await verifyReferencesBlock(text);
  assert.ok(result.includes("NonExistentDummyAct, 2026"));
  assert.ok(result.includes("Section 10"));
});

// Import injectVerifiedCaseLawFallback for testing
import { injectVerifiedCaseLawFallback } from "../../server/routes";

test("injectVerifiedCaseLawFallback populates references card block and respects user intent for prose injection", () => {
  const verifiedHits = [
    { citation: "2021 PLJ 68", title: "JAMEEL AHMED DASHTI vs ABDUL RASHEED", court: "High Court", summary: "Inheritance dispute." }
  ];

  // Case 1: User did NOT request case law, and AI noted "no relevant judgments found".
  // The AI prose should NOT be force-polluted with the fallback case text, but the cards block MUST contain the fallback hits.
  const content = "No relevant judgments were found in our internal database matching this matrix.\n\n```references\n{\"laws\":[{\"name\":\"CPC\",\"section\":\"15\"}],\"judgments\":[]}\n```";
  const result = injectVerifiedCaseLawFallback(content, verifiedHits, "Faisal died in road accident leaving property");
  
  // Prose text should NOT contain "2021 PLJ 68" because user did not request case law
  assert.ok(!result.includes("2021 PLJ 68") || result.indexOf("2021 PLJ 68") > result.indexOf("```references"));
  // References JSON block MUST contain the verified hit
  assert.ok(result.includes("2021 PLJ 68"));

  // Case 2: AI explicitly created a Case Law section, but said "no relevant judgments were found".
  // Even if user requested case law ("show me case law"), we should NOT inject the fallback prose
  // (which would override the AI's honest statement with off-topic results),
  // but the cards block must still have the judgments.
  const contentWithSection = "### Leading Case Law\nNo relevant judgments were found in our internal database specifically matching this.\n\n```references\n{\"laws\":[{\"name\":\"CPC\",\"section\":\"15\"}],\"judgments\":[]}\n```";
  const resultWithSection = injectVerifiedCaseLawFallback(contentWithSection, verifiedHits, "show me case law on inheritance");
  
  // Prose text should NOT contain "2021 PLJ 68" before references block because we shouldn't override the AI's statement
  const refsIndex = resultWithSection.indexOf("```references");
  const citationIndex = resultWithSection.indexOf("2021 PLJ 68");
  assert.ok(citationIndex > refsIndex); // The citation is only inside/after the references block, not in the prose before it
});

