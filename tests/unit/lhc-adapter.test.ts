import test from "node:test";
import assert from "node:assert/strict";
import { LhcCourtAdapter } from "../../server/services/causelist/adapters/lhc-adapter";
import {
  parseHtmlCauseList,
  parseTextCauseList,
  normalizeCaseType,
  extractCaseYear,
} from "../../server/services/causelist/pdf-roster-parser";

test("LhcCourtAdapter.discoverLists returns documents for all 4 benches", async () => {
  const adapter = new LhcCourtAdapter();
  const docs = await adapter.discoverLists("2026-08-21");

  assert.equal(docs.length, 12); // 4 benches * 3 list types (regular, urgent, supplementary)
  const benches = new Set(docs.map((d) => d.bench));
  assert.equal(benches.has("Principal Seat"), true);
  assert.equal(benches.has("Rawalpindi Bench"), true);
  assert.equal(benches.has("Multan Bench"), true);
  assert.equal(benches.has("Bahawalpur Bench"), true);
});

test("normalizeCaseType accurately categorizes Pakistani cases", () => {
  assert.equal(normalizeCaseType("W.P. No. 12345/2024"), "Writ Petition");
  assert.equal(normalizeCaseType("WP 500/2023"), "Writ Petition");
  assert.equal(normalizeCaseType("Crl. Misc. 450-B/2024"), "Criminal Misc");
  assert.equal(normalizeCaseType("Crl. Appeal 102/2021"), "Criminal Appeal");
  assert.equal(normalizeCaseType("C.A. 89/2020"), "Civil Appeal");
  assert.equal(normalizeCaseType("C.R. 55/2019"), "Civil Revision");
  assert.equal(normalizeCaseType("B.A. 90/2024"), "Bail Application");
  assert.equal(normalizeCaseType("I.C.A. 12/2022"), "Intra Court Appeal");
  assert.equal(normalizeCaseType("F.A.O. 4/2023"), "First Appeal from Order");
  assert.equal(normalizeCaseType("Tax Ref 11/2020"), "Tax Reference");
  assert.equal(normalizeCaseType("Const. P. 99/2024"), "Constitutional Petition");
});

test("extractCaseYear extracts 4-digit and 2-digit years", () => {
  assert.equal(extractCaseYear("W.P. No. 12345/2024"), 2024);
  assert.equal(extractCaseYear("Crl. Misc 450/23"), 2023);
  assert.equal(extractCaseYear("C.A. 11/1998"), 1998);
  assert.equal(extractCaseYear("InvalidCaseNumber"), null);
});

test("parseHtmlCauseList parses realistic LHC courtroom table", () => {
  const sampleHtml = `
    <div class="courtroom-block">
      <h3>Court Room No. 4 - Mr. Justice Ali Baqar Najafi</h3>
      <table class="cause-list-table">
        <thead>
          <tr>
            <th>Sr No</th>
            <th>Case No</th>
            <th>Title</th>
            <th>Advocates</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>W.P. No. 12450/2024</td>
            <td>Ahmad Ali VS Province of Punjab</td>
            <td>Chaudhry Aitzaz Ahsan Adv (Petitioner), Advocate General (Respondent)</td>
            <td>For Arguments</td>
          </tr>
          <tr class="red-list">
            <td>2</td>
            <td>Crl. Misc 8901/2023</td>
            <td>Tariq Khan VS The State</td>
            <td>Syed Ali Zafar (Petitioner), DPG (Respondent)</td>
            <td>For Notice</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  const parsed = parseHtmlCauseList(sampleHtml, "LHC", "Principal Seat", "2026-08-21", "regular");

  assert.equal(parsed.length, 1);
  const roster = parsed[0];
  assert.equal(roster.court, "LHC");
  assert.equal(roster.bench, "Principal Seat");
  assert.ok(roster.judgeName.includes("Ali Baqar Najafi"));
  assert.equal(roster.items.length, 2);

  const item1 = roster.items[0];
  assert.equal(item1.serialNumber, 1);
  assert.equal(item1.caseNumber, "W.P. No. 12450/2024");
  assert.equal(item1.caseType, "Writ Petition");
  assert.equal(item1.caseYear, 2024);
  assert.equal(item1.petitioner, "Ahmad Ali");
  assert.equal(item1.respondent, "Province of Punjab");
  assert.equal(item1.fixationPurpose, "For Arguments");
  assert.equal(item1.isRedList, false);

  const item2 = roster.items[1];
  assert.equal(item2.serialNumber, 2);
  assert.equal(item2.caseNumber, "Crl. Misc 8901/2023");
  assert.equal(item2.caseType, "Criminal Misc");
  assert.equal(item2.caseYear, 2023);
  assert.equal(item2.isRedList, true);
});

test("parseTextCauseList parses division bench and single bench text layouts", () => {
  const sampleText = `
LAHORE HIGH COURT, LAHORE
Daily Cause List for Friday, 21-08-2026

Court Room No. 1
Before: Hon'ble Chief Justice Aalia Neelum & Mr. Justice Farooq Haider

1. W.P. No. 9901/2024
Malik Aslam VS Federation of Pakistan
Petitioner Counsel: Mian Muhammad Kashif Adv
Respondent Counsel: DAG
For Hearing

2. Crl. Appeal 440/2022
State VS Imran Khan
For Arguments

Court Room No. 2
Before: Mr. Justice Tariq Saleem Sheikh

1. C.A. No. 110/2020
ABC Corp VS XYZ Ltd
Petitioner Counsel: Barrister Salman Safdar
For Final Arguments
  `;

  const parsed = parseTextCauseList(sampleText, "LHC", "Principal Seat", "2026-08-21", "regular");

  assert.equal(parsed.length, 2);
  
  // Courtroom 1
  const court1 = parsed[0];
  assert.ok(court1.judgeName.includes("Aalia Neelum"));
  assert.equal(court1.items.length, 2);
  assert.equal(court1.items[0].caseNumber, "W.P. No. 9901/2024");
  assert.equal(court1.items[0].serialNumber, 1);
  assert.equal(court1.items[1].caseNumber, "Crl. Appeal 440/2022");
  assert.equal(court1.items[1].serialNumber, 2);

  // Courtroom 2
  const court2 = parsed[1];
  assert.ok(court2.judgeName.includes("Tariq Saleem Sheikh"));
  assert.equal(court2.items.length, 1);
  assert.equal(court2.items[0].caseNumber, "C.A. No. 110/2020");
  assert.equal(court2.items[0].serialNumber, 1);
});
