import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prepareRepair, recordFingerprint, sha256, type Repair } from "../../script/repair_judgment_identity";

const body = `Court Name: Supreme Court\nTitle: Ahmad Khan vs State\nReported As: 2024 SCMR 1085\nResult: allowed\n${"Stored legal reasoning. ".repeat(30)}`;
const row = { id: "00000000-0000-4000-8000-000000000001", citation_string: "2024 SCMR 1085", title: "Incorrect Person vs State", petitioner: "Incorrect Person", respondent: "State", court_name_snapshot: "Supreme Court", decision_date: "2024-01-01T00:00:00.000Z", full_text: body, text_status: "own", text_true_citation: null, pdf_url: null, formatted_text: "Stale caption", headnotes: "Stale headnote", ai_summary: { result: "Stale summary" } };

async function fixture(run: (repair: Repair, directory: string) => Promise<void>) {
  const directory = await mkdtemp(path.join(tmpdir(), "judgment-repair-"));
  try {
    const source = path.join(directory, "source.txt");
    await writeFile(source, body);
    await run({ id: row.id, citation: row.citation_string, expectedFingerprint: recordFingerprint(row), evidence: [{ path: source, sha256: sha256(body), url: "https://example.gov.pk/judgment.pdf", scope: "identity_reference", reviewedPages: [1] }], changes: { title: "Ahmad Khan vs State", petitioner: "Ahmad Khan", respondent: "State", decisionDate: "2024-01-01" } }, directory);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test("a caption repair preserves legal text and clears stale derived fields", async () => fixture(async repair => {
  const result = await prepareRepair(row, repair);
  assert.equal(result.title, "Ahmad Khan vs State");
  assert.equal(result.full_text, body);
  assert.equal(result.citation_string, row.citation_string);
  for (const field of ["formatted_text", "headnotes", "ai_summary"]) assert.equal(result[field], null);
}));

test("stale records, changed evidence and contradictory corrections fail before mutation", async () => fixture(async repair => {
  await assert.rejects(prepareRepair({ ...row, full_text: body + " changed" }, repair), /changed since source review/);
  await assert.rejects(prepareRepair({ ...row, title: "Concurrent title edit" }, repair), /changed since source review/);
  await assert.rejects(prepareRepair(row, { ...repair, evidence: [{ ...repair.evidence[0], sha256: "wrong" }] }), /Source evidence changed/);
  await assert.rejects(prepareRepair(row, { ...repair, changes: { ...repair.changes, title: "Different Person vs Different Party" } }), /internal case identity/);
  await assert.rejects(prepareRepair(row, { ...repair, citation: "2024 SCMR 999" }), /Citation changed/);
}));

test("replacement bodies require a full judgment source and their reviewed hash", async () => fixture(async (repair, directory) => {
  const fullTextPath = path.join(directory, "replacement.txt");
  await writeFile(fullTextPath, body);
  const replacement = { ...repair, changes: { ...repair.changes, fullTextPath, fullTextSha256: sha256(body) } };
  await assert.rejects(prepareRepair(row, replacement), /complete source judgment/);
  const fullSource: Repair = { ...replacement, evidence: [{ ...repair.evidence[0], scope: "full_judgment" }] };
  assert.equal((await prepareRepair(row, fullSource)).full_text, body);
  await assert.rejects(prepareRepair(row, { ...fullSource, changes: { ...fullSource.changes, fullTextSha256: "wrong" } }), /Replacement text changed/);
}));

test("bad dates and unverified existing bodies cannot be silently accepted", async () => fixture(async repair => {
  await assert.rejects(prepareRepair(row, { ...repair, changes: { ...repair.changes, decisionDate: "2024-02-31" } }), /Invalid decision date/);
  const unknown = { ...row, text_status: "unknown" };
  await assert.rejects(prepareRepair(unknown, { ...repair, expectedFingerprint: recordFingerprint(unknown) }), /complete replacement source/);
}));
