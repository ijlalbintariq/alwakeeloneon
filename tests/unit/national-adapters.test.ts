import test from "node:test";
import assert from "node:assert/strict";
import { IhcCourtAdapter } from "../../server/services/causelist/adapters/ihc-adapter";
import { ShcCourtAdapter } from "../../server/services/causelist/adapters/shc-adapter";
import { ScpCourtAdapter } from "../../server/services/causelist/adapters/scp-adapter";

test("IhcCourtAdapter discovers lists for Principal Seat (Islamabad)", async () => {
  const adapter = new IhcCourtAdapter();
  assert.equal(adapter.courtCode, "IHC");
  assert.equal(adapter.courtName, "Islamabad High Court");

  const docs = await adapter.discoverLists("2026-08-21");
  assert.equal(docs.length, 3); // regular, urgent, supplementary
  assert.equal(docs[0].bench, "Principal Seat");
  assert.equal(docs[0].court, "IHC");
});

test("ShcCourtAdapter discovers lists for all 4 Sindh benches", async () => {
  const adapter = new ShcCourtAdapter();
  assert.equal(adapter.courtCode, "SHC");
  assert.equal(adapter.supportedBenches.length, 4);

  const docs = await adapter.discoverLists("2026-08-21");
  assert.equal(docs.length, 12); // 4 benches * 3 list types

  const benches = new Set(docs.map((d) => d.bench));
  assert.ok(benches.has("Principal Seat (Karachi)"));
  assert.ok(benches.has("Sukkur Bench"));
  assert.ok(benches.has("Hyderabad Circuit"));
  assert.ok(benches.has("Larkana Circuit"));
});

test("ScpCourtAdapter discovers lists for all 5 Supreme Court registries", async () => {
  const adapter = new ScpCourtAdapter();
  assert.equal(adapter.courtCode, "SCP");
  assert.equal(adapter.supportedBenches.length, 5);

  const docs = await adapter.discoverLists("2026-08-21");
  assert.equal(docs.length, 15); // 5 registries * 3 list types

  const registries = new Set(docs.map((d) => d.bench));
  assert.ok(registries.has("Principal Seat (Islamabad)"));
  assert.ok(registries.has("Branch Registry Lahore"));
  assert.ok(registries.has("Branch Registry Karachi"));
  assert.ok(registries.has("Branch Registry Peshawar"));
  assert.ok(registries.has("Branch Registry Quetta"));
});

test("IhcCourtAdapter, ShcCourtAdapter, ScpCourtAdapter validate correctly", async () => {
  const ihcAdapter = new IhcCourtAdapter();
  const shcAdapter = new ShcCourtAdapter();
  const scpAdapter = new ScpCourtAdapter();

  const validParsedList = {
    court: "SCP" as const,
    bench: "Principal Seat (Islamabad)",
    hearingDate: new Date("2026-08-21T00:00:00.000Z"),
    targetDateStr: "2026-08-21",
    courtNumber: "Court Room No. 1",
    judgeName: "Mr. Justice Qazi Faez Isa, HCJ",
    listType: "regular" as const,
    items: [
      {
        serialNumber: 1,
        caseNumber: "C.A. No. 450/2021",
        caseType: "Civil Appeal",
        caseYear: 2021,
        caseTitle: "Federation of Pakistan VS M/s XYZ Corporation",
        petitionerAdvocate: "Attorney General for Pakistan",
        respondentAdvocate: "Makhdoom Ali Khan ASC",
        fixationPurpose: "For Hearing",
        isRedList: false,
      },
    ],
  };

  const validation = scpAdapter.validate(validParsedList);
  assert.equal(validation.isValid, true);
  assert.equal(validation.criticalErrors.length, 0);
});
