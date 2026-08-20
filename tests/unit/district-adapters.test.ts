import test from "node:test";
import assert from "node:assert/strict";
import { PunjabDistrictCourtAdapter } from "../../server/services/causelist/adapters/punjab-district-adapter";
import { IsbDistrictCourtAdapter } from "../../server/services/causelist/adapters/isb-district-adapter";

test("PunjabDistrictCourtAdapter discovers lists for all Lahore District Court complexes", async () => {
  const adapter = new PunjabDistrictCourtAdapter("LHR_DIST");
  assert.equal(adapter.courtCode, "LHR_DIST");
  assert.equal(adapter.courtName, "Lahore District Courts");
  assert.equal(adapter.supportedBenches.length, 6);

  const docs = await adapter.discoverLists("2026-08-21");
  assert.equal(docs.length, 18); // 6 complexes * 3 list types

  const complexes = new Set(docs.map((d) => d.bench));
  assert.ok(complexes.has("Aiwan-e-Adl (Sessions Division)"));
  assert.ok(complexes.has("Civil Courts Complex"));
  assert.ok(complexes.has("Model Town Courts"));
  assert.ok(complexes.has("Cantt Courts"));
  assert.ok(complexes.has("Family & Guardian Courts"));
  assert.ok(complexes.has("Special / Banking Courts"));
});

test("IsbDistrictCourtAdapter discovers lists for Islamabad East & West Divisions", async () => {
  const adapter = new IsbDistrictCourtAdapter();
  assert.equal(adapter.courtCode, "ISB_DIST");
  assert.equal(adapter.courtName, "Islamabad District Courts");

  const docs = await adapter.discoverLists("2026-08-21");
  assert.equal(docs.length, 12); // 4 divisions * 3 list types

  const divisions = new Set(docs.map((d) => d.bench));
  assert.ok(divisions.has("District East (G-11 Judicial Complex)"));
  assert.ok(divisions.has("District West (G-11 Judicial Complex)"));
});

test("PunjabDistrictCourtAdapter discovers lists for Rawalpindi District Courts", async () => {
  const adapter = new PunjabDistrictCourtAdapter("RWP_DIST");
  assert.equal(adapter.courtCode, "RWP_DIST");

  const docs = await adapter.discoverLists("2026-08-21");
  assert.equal(docs.length, 12); // 4 complexes * 3 list types

  const complexes = new Set(docs.map((d) => d.bench));
  assert.ok(complexes.has("Judicial Complex Rawalpindi"));
  assert.ok(complexes.has("Civil Courts Rawalpindi"));
  assert.ok(complexes.has("Gujar Khan Courts"));
  assert.ok(complexes.has("Taxila Courts"));
});

test("District Court adapters parse and validate typical trial court matters", async () => {
  const adapter = new PunjabDistrictCourtAdapter("LHR_DIST");

  const validDistrictList = {
    court: "LHR_DIST" as const,
    bench: "Civil Courts Complex",
    hearingDate: new Date("2026-08-21T00:00:00.000Z"),
    targetDateStr: "2026-08-21",
    courtNumber: "Court Room No. 12",
    judgeName: "Mr. Muhammad Tariq, Civil Judge Class-I",
    listType: "regular" as const,
    items: [
      {
        serialNumber: 1,
        caseNumber: "Suit No. 145/2023",
        caseType: "Suit for Declaration",
        caseYear: 2023,
        caseTitle: "Tariq Mahmood VS Province of Punjab",
        petitionerAdvocate: "Ch. Aftab Ahmad Adv.",
        respondentAdvocate: "District Attorney",
        fixationPurpose: "For Evidence / Shahadat",
        isRedList: false,
      },
      {
        serialNumber: 2,
        caseNumber: "B.A. No. 890/2024",
        caseType: "Pre-Arrest Bail",
        caseYear: 2024,
        caseTitle: "Muhammad Usman VS The State",
        petitionerAdvocate: "Syed Zafar Ali Adv.",
        respondentAdvocate: "ADPP",
        fixationPurpose: "For Arguments",
        isRedList: true,
      },
    ],
  };

  const validation = adapter.validate(validDistrictList);
  assert.equal(validation.isValid, true);
  assert.equal(validation.validItems.length, 2);
  assert.equal(validation.criticalErrors.length, 0);
});
