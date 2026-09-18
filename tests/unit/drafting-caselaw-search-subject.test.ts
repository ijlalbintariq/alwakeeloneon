import test from "node:test";
import assert from "node:assert/strict";
import { PROVISION_MENTION_PATTERN } from "../../server/routes";

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
function searchSubject(draft: string, prompt: string, label: string): string {
  const provisions = new Set<string>();
  for (const m of draft.matchAll(PROVISION_MENTION_PATTERN)) {
    const kind = /^art/i.test(m[1]) ? "Article" : /^order/i.test(m[1]) ? "Order" : "Section";
    const act = (m[3] || "").replace(/[.\s]/g, "");
    provisions.add(`${kind} ${m[2]}${act ? ` ${act}` : ""}`);
    if (provisions.size >= 6) break;
  }
  const cited = provisions.size > 0 ? `: ${[...provisions].join(", ")}` : "";
  return `Pakistani case law for a ${label}${cited}. ${prompt}`;
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

test("a draft naming no provisions still yields a usable subject", () => {
  const subject = searchSubject("A plain letter with no statutory references.", "draft grounds", "Legal Notice");
  assert.equal(subject, "Pakistani case law for a Legal Notice. draft grounds");
});

test("the shared pattern is not left with a stale lastIndex between drafts", () => {
  const a = searchSubject(DRAFT, "x", "Bail");
  const b = searchSubject(DRAFT, "x", "Bail");
  assert.equal(a, b, "matchAll left lastIndex advanced on the shared regex");
});
