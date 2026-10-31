import test from "node:test";
import assert from "node:assert/strict";
import { assessJudgmentIdentity, prepareJudgmentDetail, judgmentPdfUrl } from "../../server/citation-verify";

const body = (title: string, citation: string, court = "Supreme Court") =>
  `Court Name: ${court}\nTitle: ${title}\nReported As: ${citation}\nResult: allowed\n${"Judgment text. ".repeat(20)}`;
const valid = { citation: "2024 SCMR 1085", title: "Ahmad Khan vs State", court: "Supreme Court", textStatus: "own", opening: body("Ahmad Khan vs State", "2024 SCMR 1085") };

test("matching title and citation pass only an internal identity check", () => {
  assert.equal(assessJudgmentIdentity(valid).textIntegrity, "own");
});

test("different parties, citation or court fail even when marked own", () => {
  for (const opening of [
    body("Bilal Malik vs State", "2024 SCMR 1085"),
    body("Ahmad Khan vs State", "2020 PTD 1703"),
    body("Ahmad Khan vs State", "2024 SCMR 1085", "Lahore High Court"),
  ]) assert.equal(assessJudgmentIdentity({ ...valid, opening }).textIntegrity, "unknown");
});

test("missing header and known mislabeled texts are never accepted", () => {
  assert.equal(assessJudgmentIdentity({ ...valid, opening: "Unstructured judgment ".repeat(20) }).textIntegrity, "unknown");
  assert.equal(assessJudgmentIdentity({ ...valid, textStatus: "unknown" }).textIntegrity, "unknown");
  assert.equal(assessJudgmentIdentity({ ...valid, textStatus: "mislabeled", textTrueCitation: "2020 PLD 123" }).textIntegrity, "mislabeled");
  assert.equal(assessJudgmentIdentity({ ...valid, opening: "short" }).textIntegrity, "missing");
});

const detail = { id: "record", citation: valid.citation, title: valid.title, court: valid.court, fullText: valid.opening, pdfUrl: null as string | null, citations: { made: [], received: [] } };
test("text-only, PDF-only and combined records retain their available sources", () => {
  const textOnly = prepareJudgmentDetail(detail, { opening: valid.opening, textStatus: "own" });
  assert.equal(textOnly.contentFormat, "text");
  assert.equal(textOnly.fullText, valid.opening);
  assert.equal(textOnly.pdfUrl, null);
  const pdfOnly = prepareJudgmentDetail({ ...detail, fullText: "", pdfUrl: "https://example.com/case.pdf" }, { opening: "", textStatus: null });
  assert.equal(pdfOnly.contentFormat, "pdf");
  assert.equal(pdfOnly.pdfUrl, "https://example.com/case.pdf");
  assert.equal(pdfOnly.fullText, "");
  assert.equal(pdfOnly.textIntegrity, "missing");
  assert.match(pdfOnly.textWarning!, /PDF available/);
  const both = prepareJudgmentDetail({ ...detail, pdfUrl: "/judgments/case.pdf" }, { opening: valid.opening, textStatus: "own" });
  assert.equal(both.contentFormat, "text_and_pdf");
});

test("plain text remains readable without a machine-readable header", () => {
  const plain = "This is the stored judgment body without a labelled title header. ".repeat(10);
  const result = prepareJudgmentDetail({ ...detail, fullText: plain }, { opening: plain, textStatus: "own" });
  assert.equal(result.fullText, plain);
  assert.equal(result.contentFormat, "text");
  assert.equal(result.textIntegrity, "unknown");
});

test("PDF presence never bypasses a confirmed identity conflict", () => {
  const result = prepareJudgmentDetail({ ...detail, title: "Different Person vs State", pdfUrl: "https://example.com/case.pdf" }, { opening: valid.opening, textStatus: "own" });
  assert.equal(result.contentFormat, "unavailable");
  assert.equal(result.fullText, "");
  assert.equal(result.pdfUrl, null);
  assert.equal(result.identityConflict, true);
});

test("missing header fields cannot conceal a contradiction in another field", () => {
  const withoutReport = valid.opening.replace(/Reported As:[^\n]*\n/, "");
  assert.equal(assessJudgmentIdentity({ ...valid, title: "Different Person vs State", opening: withoutReport }).identityConflict, true);
  const withoutTitle = valid.opening.replace(/Title:[^\n]*\n/, "");
  assert.equal(assessJudgmentIdentity({ ...valid, citation: "2020 PTD 1703", opening: withoutTitle }).identityConflict, true);
});

test("an unreported citation remains readable without a false mismatch", () => {
  const unreported = prepareJudgmentDetail({ ...detail, citation: "Civil Appeal 123/2024" }, { opening: valid.opening, textStatus: "own" });
  assert.equal(unreported.contentFormat, "text");
  assert.equal(unreported.textIntegrity, "unknown");
  assert.equal(unreported.identityConflict, undefined);
});

test("printed reporter captions support matching text and reject wrong parties", () => {
  const printed = `1995 P L C (C.S.) 500\n\n[Federal Service Tribunal]\n\nBefore Example Judge, Members AHMAD\nKHAN\n\nVersus\n\nTHE STATE\n\nAppeal No. 1 of 1994.\n${"Judgment text. ".repeat(30)}`;
  assert.equal(assessJudgmentIdentity({ ...valid, court: "Federal Service Tribunal", citation: "1995 PLC(CS) 500", opening: printed }).textIntegrity, "own");
  assert.equal(assessJudgmentIdentity({ ...valid, court: "Federal Service Tribunal", title: "Different Person vs State", citation: "1995 PLC(CS) 500", opening: printed }).identityConflict, true);
});

test("CST reporter categories retain year and journal mismatches", () => {
  assert.equal(assessJudgmentIdentity({ ...valid, citation: "1963 PLD 295", opening: body(valid.title, "1978 PLC (C. S. T.) 106") }).identityConflict, true);
});

test("a citation inside a long narrative is not treated as its reporting header", () => {
  const narrative = `Judgment sheet. Ahmad Khan vs State. ${"Narrative text. ".repeat(20)} In 2018 SCMR 99 the court observed further matters.`;
  const result = assessJudgmentIdentity({ ...valid, opening: narrative });
  assert.equal(result.textIntegrity, "unknown");
  assert.equal(result.identityConflict, undefined);
});

test("PDF links reject executable URLs and ambiguous relative paths", () => {
  for (const url of ["javascript:alert(1)", "data:application/pdf,abc", "//example.com/case.pdf", "/\\example.com/case.pdf", "https://user:password@example.com/case.pdf"]) assert.equal(judgmentPdfUrl(url), null);
  assert.equal(judgmentPdfUrl("/files/case.pdf"), "/files/case.pdf");
});

test("court checks reject tribunals under Supreme Court metadata and reconcile High Court aliases", () => {
  const tribunal = assessJudgmentIdentity({ ...valid, opening: body(valid.title, valid.citation, "Federal Service Tribunal") });
  assert.equal(tribunal.identityConflict, true);
  assert.equal(tribunal.textIntegrity, "unknown");
  assert.equal(assessJudgmentIdentity({ ...valid, court: "Sindh High Court", opening: body(valid.title, valid.citation, "High Court of Sindh") }).textIntegrity, "own");
  assert.equal(assessJudgmentIdentity({ ...valid, opening: body(valid.title, valid.citation, "Unrecognized Judicial Forum") }).textIntegrity, "unknown");
});

test("a rejected formatted body is removed from every response body field", () => {
  const rejected = body("Different Person vs Different Party", valid.citation);
  const result = prepareJudgmentDetail({ ...detail, fullText: rejected, formattedText: rejected }, { opening: valid.opening, textStatus: "own" });
  assert.equal(result.fullText, valid.opening);
  assert.equal(result.formattedText, null);
  assert.doesNotMatch(JSON.stringify(result), /Different Person/);
  const alternate = prepareJudgmentDetail({ ...detail, formattedText: rejected }, { opening: valid.opening, textStatus: "own" });
  assert.equal(alternate.formattedText, null);
});

test("generic captions and extraction artifacts never verify a case identity", () => {
  for (const [title, headerTitle] of [
    ["In the matter of vs NOT Case No", "CONTINENTAL INSURANCE COMPANY LIMITED: In the matter of vs NOT"],
    ["In the matter of vs NOT", "CONTINENTAL INSURANCE COMPANY LIMITED: In the matter of vs NOT"],
    ["Ahmad Khan vs State JUDGMENT Reported As", valid.title],
    ["Ahmad Khan vs StateHonorable Justice Example Judge", valid.title],
    ["NOT vs Administrator", "NOT vs Administrator"],
  ]) {
    const opening = body(headerTitle, valid.citation);
    const result = prepareJudgmentDetail({ ...detail, title, fullText: opening }, { opening, textStatus: "own" });
    assert.equal(result.identityConflict, true);
    assert.equal(result.contentFormat, "unavailable");
    assert.equal(result.fullText, "");
    assert.equal(result.title, "Judgment identity unverified");
  }
  assert.equal(assessJudgmentIdentity({ ...valid, title: "Company vs State", opening: body("Continental Insurance Company vs State", valid.citation) }).textIntegrity, "unknown");
});

test("non-adversarial captions require the named entity and no invented opposing party", () => {
  const opening = body("CONTINENTAL INSURANCE COMPANY LIMITED: In the matter of", valid.citation);
  assert.equal(assessJudgmentIdentity({ ...valid, title: "In the matter of Continental Insurance Company Limited", opening }).textIntegrity, "own");
  assert.equal(assessJudgmentIdentity({ ...valid, title: "In re Different Insurance Company Limited", opening }).identityConflict, true);
  assert.equal(assessJudgmentIdentity({ ...valid, title: "In the matter of", opening }).textIntegrity, "unknown");
  assert.equal(assessJudgmentIdentity({ ...valid, opening }).identityConflict, true);
});

test("wrapped parallel citations are read through their continuation lines", () => {
  const record = { ...valid, citation: "2019 PSC 631", title: "Dr. Tariq Iqbal vs The Govt. of KPK through Secretary Administration" };
  const report = "KLR 2019 Supreme Court 417, 2019 PLC (C.S) 821, 2019 SCMR 859, 2019 SCP\n260, 2019 P.S.C. 631";
  for (const separator of ["\n", "\r\n"]) {
    const opening = body(record.title, report).replace(/\n/g, separator);
    assert.equal(assessJudgmentIdentity({ ...record, opening }).textIntegrity, "own");
    const result = prepareJudgmentDetail({ ...detail, ...record, fullText: opening }, { opening, textStatus: "own" });
    assert.equal(result.contentFormat, "text");
    assert.equal(result.fullText, opening);
  }
  assert.equal(assessJudgmentIdentity({ ...record, opening: body(record.title, `\n${report}`) }).textIntegrity, "own");
});

test("citation continuations stop before judgment text and other metadata", () => {
  for (const boundary of ["Result: allowed", "JUDGMENT", "ORDER", "Date of Judgment: 2024-01-01", "", "The Court cited the following authority:", "2019 PSC 631 was cited by counsel."]) {
    const opening = `Court Name: Supreme Court\nTitle: ${valid.title}\nReported As: 2020 SCMR 420\n${boundary}\n2019 PSC 631\n${"Judgment body. ".repeat(30)}`;
    assert.equal(assessJudgmentIdentity({ ...valid, citation: "2019 PSC 631", opening }).identityConflict, true, boundary);
  }
  const inline = body(valid.title, "2020 SCMR 420 Result: cited 2019 PSC 631");
  assert.equal(assessJudgmentIdentity({ ...valid, citation: "2019 PSC 631", opening: inline }).identityConflict, true);
});
