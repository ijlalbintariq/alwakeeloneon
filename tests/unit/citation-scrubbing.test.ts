process.env.DATABASE_URL = "postgresql://localhost:5432/dummy_test_db";
process.env.PGHOST = "localhost";

import test from "node:test";
import assert from "node:assert/strict";
import { enforceProseCitationIntegrity, enforceStatuteSectionIntegrity } from "../../server/routes";

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
