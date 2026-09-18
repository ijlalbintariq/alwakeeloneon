import test from "node:test";
import assert from "node:assert/strict";
import { CAUSE_TITLE_PATTERN, PROVISION_MENTION_PATTERN } from "../../server/routes";

const DRAFT = `IN THE COURT OF THE LEARNED SESSIONS JUDGE, LAHORE

Criminal Miscellaneous (Bail) Application No. ____ of 2026

Asad Mehmood son of Rafiq Mehmood, CNIC 35202-1234567-1, resident of House No. 12, Street 4, Gulberg III, Lahore
                                                            ...APPLICANT
VERSUS
The State

APPLICATION UNDER SECTION 497 Cr.P.C. FOR GRANT OF POST-ARREST BAIL IN CASE FIR NO. 412/2026 DATED 14.02.2026 UNDER SECTION 379 PPC, POLICE STATION GULBERG, LAHORE.

4. That no independent witness was associated with the recovery in breach of Section 103 Cr.P.C.

A. That the case falls within further inquiry under Section 497(2) Cr.P.C.
B. That Article 199 of the Constitution is attracted.`;

/**
 * Mirrors caseLawSearchSubject in server/routes.ts. runToolJudgmentSearchOR
 * truncates its input to 300 characters, and a pleading's first 300 characters
 * are the court caption and the party's address. Handed that, the tool-calling
 * model judged that no research was needed and issued zero queries, so every
 * follow-up drafted with an empty case-law pool.
 */
/** Mirrors draftSubjectDigest + caseLawSearchSubject in server/routes.ts. */
function searchSubject(draft: string, prompt: string, _label: string): string {
  // The cause title lives in the header. Scanning the whole draft let a numbered
  // fact ("5. That the plaintiff filed an application under Section 12 for ...")
  // match ahead of it and become the search subject.
  const headerBlock = draft.split("\n").slice(0, 25).join("\n");
  const causeTitle = (headerBlock.match(CAUSE_TITLE_PATTERN)?.[0] || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  const provisions = new Set<string>();
  for (const m of draft.matchAll(PROVISION_MENTION_PATTERN)) {
    const kind = /^art/i.test(m[1]) ? "Article" : /^order/i.test(m[1]) ? "Order" : "Section";
    const act = (m[3] || "").replace(/[.\s]/g, "");
    provisions.add(`${kind} ${m[2]}${act ? ` ${act}` : ""}`);
    if (provisions.size >= 5) break;
  }
  const digest = [causeTitle, [...provisions].join(", ")].filter((x) => x.length > 0).join(". ");
  return digest ? `Pakistani case law. ${digest}. ${prompt}` : prompt;
}

test("the searchable provisions survive the 300-character truncation", () => {
  const subject = searchSubject(DRAFT, "strengthen the grounds", "Post-Arrest Bail Application");
  const seenByTheSearchModel = subject.slice(0, 300);

  for (const provision of ["497 CrPC", "379 PPC", "103 CrPC"]) {
    assert.ok(
      seenByTheSearchModel.includes(provision),
      `"${provision}" was cut off; the search model would not see it`,
    );
  }
  // The caption and the party's address carry nothing searchable and must not
  // be what gets sent.
  assert.doesNotMatch(seenByTheSearchModel, /Gulberg III|CNIC|Criminal Miscellaneous \(Bail\) Application No/);
});

test("Articles and Orders keep their own labels", () => {
  const subject = searchSubject(
    "Order 39 Rules 1 and 2 CPC read with Article 199 of the Constitution.",
    "add grounds",
    "Writ Petition",
  );
  assert.match(subject, /Order 39/);
  assert.match(subject, /Article 199 Constitution/);
});

test("a draft with nothing to distil falls back to the instruction alone", () => {
  const subject = searchSubject("A plain letter with no statutory references.", "draft grounds", "Legal Notice");
  assert.equal(subject, "draft grounds");
});

test("a cause title alone is enough of a subject", () => {
  const subject = searchSubject(
    "IN THE HONOURABLE LAHORE HIGH COURT\n\nCONSTITUTIONAL PETITION UNDER ARTICLE 199 OF THE CONSTITUTION AGAINST AN ARBITRARY EXECUTIVE ORDER.",
    "add grounds",
    "Writ Petition",
  );
  assert.match(subject, /^Pakistani case law\. CONSTITUTIONAL PETITION UNDER ARTICLE 199/);
  assert.match(subject, /add grounds$/);
});

test("the shared pattern is not left with a stale lastIndex between drafts", () => {
  const a = searchSubject(DRAFT, "x", "Bail");
  const b = searchSubject(DRAFT, "x", "Bail");
  assert.equal(a, b, "matchAll left lastIndex advanced on the shared regex");
});

test("the cause title wins over a numbered fact that mentions an application", () => {
  const draft = [
    "IN THE COURT OF THE LEARNED CIVIL JUDGE, LAHORE",
    "",
    "SUIT FOR SPECIFIC PERFORMANCE OF AGREEMENT TO SELL UNDER SECTION 12 OF THE SPECIFIC RELIEF ACT, 1877.",
    "",
    "BRIEF FACTS:",
    "",
    "5. That the plaintiff filed an application under Section 22-A Cr.P.C. for registration of an FIR.",
  ].join("\n");
  const subject = searchSubject(draft, "add case law", "Civil Suit (Plaint)");
  assert.match(subject, /SPECIFIC PERFORMANCE OF AGREEMENT TO SELL/);
  assert.doesNotMatch(subject, /registration of an FIR/);
});

test("party names and addresses never reach the search subject", () => {
  const draft = [
    "IN THE COURT OF THE LEARNED CIVIL JUDGE, LAHORE",
    "",
    "Bilal Ahmad son of Nazir Ahmad, CNIC 35201-9876543-2, resident of House No. 45, Johar Town, Lahore",
    "                                                            ...PLAINTIFF",
    "",
    "SUIT FOR SPECIFIC PERFORMANCE OF AGREEMENT TO SELL UNDER SECTION 12 OF THE SPECIFIC RELIEF ACT, 1877.",
  ].join("\n");
  const subject = searchSubject(draft, "add case law", "Civil Suit (Plaint)");
  for (const leak of ["Bilal Ahmad", "35201-9876543-2", "Johar Town", "House No. 45"]) {
    assert.ok(!subject.includes(leak), `"${leak}" leaked into the retrieval query`);
  }
});
