import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prepareRepair, recordFingerprint, sha256, repairCitationReferences, repairSearchOwner, type Repair } from "../../script/repair_judgment_identity";

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

test("rebuilt references exclude source aliases and preserve qualified and neutral references", () => {
  const source = { id: row.id, citation_string: "2020 PSC 1127", full_text: `Court Name: Supreme Court\nTitle: Ahmad vs State\nReported As: 2020 P SC 1127, 2020 SCMR 976\nResult: dismissed\nJudgment refers to PLD 2013 SC 793 and 2024 LHC 7088. Again PLD 2013 SC 793.` };
  const references = repairCitationReferences(source, new Set(["PSC", "SCMR", "PLD", "LHC"]));
  assert.equal(references.length, 2);
  assert.ok(references.some(reference => reference.raw === "PLD 2013 SC 793"));
  assert.ok(references.some(reference => reference.journal === "LHC" && reference.page === 7088));
  assert.ok(references.every(reference => reference.year !== 2020));
});

test("a case in another publisher section remains a distinct citation reference", () => {
  const source = { id: row.id, citation_string: "NLR 2014 Civil 369", full_text: "Court Name: Lahore High Court\nTitle: Ahmad vs State\nReported As: NLR 2014 Civil 369\nResult: dismissed\nThe court refers to NLR 2014 Criminal 369." };
  const references = repairCitationReferences(source, new Set(["NLR"]));
  assert.equal(references.length, 1);
  assert.equal(references[0].raw, "NLR 2014 Criminal 369");
});

test("keyword repairs reject namespace ambiguity across the entire database, not just the current batch", () => {
  const supreme = { ...row, id: "sc", citation_string: "2024 PLD 565", title: "Ahmad Khan vs State", full_text: body.replace("2024 SCMR 1085", "PLD 2024 SC 565") };
  const sindh = { ...supreme, id: "shc", court_name_snapshot: "Sindh High Court", full_text: supreme.full_text.replace("Supreme Court", "Sindh High Court").replace("SC 565", "Sindh 565") };
  const targets = [supreme, sindh].map(r => ({ ...r, opening: r.full_text }));
  assert.equal(repairSearchOwner({ citation: "2024 PLD 565", court: "" }, [supreme], targets), undefined);
  assert.equal(repairSearchOwner({ citation: "PLD 2024 SC 565", court: "" }, [supreme], targets)?.id, "sc");
  assert.equal(repairSearchOwner({ citation: "2024 PLD 565", court: "Sindh High Court" }, [supreme], targets), undefined);
  assert.equal(repairSearchOwner({ citation: "2024 PLD 565", court: "Sindh High Court" }, [sindh], targets)?.id, "shc");
  assert.equal(repairSearchOwner({ citation: "PLD 2024 SC 565" }, [supreme], [targets[0], targets[0]])?.id, "sc");
});

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

test("complete Markdown evidence supports labels and captions while preserving unspecified dates", async () => fixture(async repair => {
  const markdown: Repair = { ...repair, evidence: [{ ...repair.evidence[0], scope: "full_judgment", reviewedPages: undefined, reviewedLines: [1, 35] }],
    changes: { ...repair.changes, decisionDate: undefined, fullTextPath: repair.evidence[0].path, fullTextSha256: sha256(body), pdfUrl: null } };
  const original = { ...row, text_status: "mislabeled", pdf_url: "https://example.gov.pk/foreign-case.pdf" };
  const result = await prepareRepair(original, { ...markdown, expectedFingerprint: recordFingerprint(original) });
  assert.equal(result.decision_date, original.decision_date);
  assert.equal(result.full_text, body);
  assert.equal(result.pdf_url, null, "An unrelated PDF must not survive a reviewed source replacement");
  assert.equal(result.text_status, "own");
  assert.equal(result.citation_string, original.citation_string);
  const undated = await prepareRepair(row, { ...markdown, changes: { ...markdown.changes, decisionDate: null } });
  assert.equal(undated.decision_date, null);
  const wrongCourt = { ...row, court_id: 4, court_name_snapshot: "Sindh High Court" };
  const courtRepair = await prepareRepair(wrongCourt, { ...markdown, expectedFingerprint: recordFingerprint(wrongCourt),
    changes: { ...markdown.changes, courtName: "Supreme Court", courtId: 1 } });
  assert.equal(courtRepair.court_id, 1);
  assert.equal(courtRepair.court_name_snapshot, "Supreme Court");
  await assert.rejects(prepareRepair(row, { ...markdown, evidence: [{ ...markdown.evidence[0], reviewedLines: [] }] }), /pages or lines/);
}));

test("source-backed citation correction keeps the case body and requires existing party/court agreement", async () => fixture(async repair => {
  const original = { ...row, title: "Ahmad Khan vs State", citation_string: "1991 PLD 2910", text_status: "mislabeled" };
  const plan: Repair = { ...repair, citation: original.citation_string, expectedFingerprint: recordFingerprint(original),
    evidence: [{ ...repair.evidence[0], scope: "full_judgment" }],
    changes: { ...repair.changes, citation: "2024 SCMR 1085", fullTextPath: repair.evidence[0].path, fullTextSha256: sha256(body) } };
  const result = await prepareRepair(original, plan);
  assert.equal(result.citation_string, "2024 SCMR 1085");
  assert.equal(result.full_text, original.full_text);
  assert.equal(original.citation_string, "1991 PLD 2910");
  await assert.rejects(prepareRepair(original, { ...plan, changes: { ...plan.changes, citation: "2024 SCMR 999" } }), /printed in the source header/);
  const differentCase = { ...original, title: "Another Person vs Another Party" };
  await assert.rejects(prepareRepair(differentCase, { ...plan, expectedFingerprint: recordFingerprint(differentCase) }), /Stored parties and court/);
  await assert.rejects(prepareRepair({ ...original, canonical_judgment_id: row.id }, { ...plan, expectedFingerprint: recordFingerprint({ ...original, canonical_judgment_id: row.id }) }), /archived duplicate/);
}));
