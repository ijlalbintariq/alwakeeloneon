import test from "node:test";
import assert from "node:assert/strict";
import { splitRunOnCourtCaption, normalizeCourtReadyDraftingText } from "../../server/routes";

/**
 * Captured from a real Gemini draft: the model emitted the whole cover block as
 * one line with no separators, and echoed the prompt template's own page marker.
 */
const RUN_ON =
  "=== PAGE 1: TITLE / INDEX PAGE ===\n" +
  "IN THE COURT OF THE SESSIONS JUDGE, LAHORECriminal Misc. (Bail) No. ________________ of 2026Asad Mehmood son of Rafiq Mehmood, resident of Model Town, Lahore.... Applicant/AccusedVERSUSThe State.... RespondentAPPLICATION FOR POST-ARREST BAIL UNDER SECTION 497 Cr.P.C.";

test("run-on cover block is split at court-document landmarks", () => {
  const out = splitRunOnCourtCaption(RUN_ON);

  assert.doesNotMatch(out, /LAHORECriminal/, "court name still glued to case number");
  assert.doesNotMatch(out, /2026Asad/, "year still glued to party name");
  assert.doesNotMatch(out, /AccusedVERSUS/, "party role still glued to VERSUS");
  assert.doesNotMatch(out, /RespondentAPPLICATION/, "party role still glued to the title");

  // The landmarks now start their own lines.
  assert.match(out, /^VERSUS$/m);
  assert.match(out, /^Criminal Misc\. \(Bail\) No\./m);
  assert.match(out, /^APPLICATION FOR POST-ARREST BAIL/m);

  // Reformatting only: splitting adds whitespace, so compare with all
  // whitespace stripped. Nothing may be deleted.
  const dense = (s: string) => s.replace(/\s+/g, "");
  assert.equal(dense(out), dense(RUN_ON.replace(/^===.*===$/m, "")));
});

test("template scaffolding markers are removed from the draft", () => {
  const out = splitRunOnCourtCaption(RUN_ON);
  assert.doesNotMatch(out, /PAGE 1: TITLE/, "prompt scaffolding leaked into the draft");
  assert.doesNotMatch(out, /^===/m);
});

test("ordinary drafting text is left alone", () => {
  const clean = [
    "IN THE COURT OF THE SESSIONS JUDGE, LAHORE",
    "",
    "Criminal Misc. (Bail) No. ____ of 2026",
    "",
    "VERSUS",
    "",
    "1. That the accused was arrested under Section 497 Cr.P.C. by the SHO.",
    "2. That the recovery is disputed and CNIC details are on record.",
  ].join("\n");

  assert.equal(splitRunOnCourtCaption(clean), clean);
});

test("the splitter is wired into the normalizer", () => {
  const out = normalizeCourtReadyDraftingText(RUN_ON);
  assert.doesNotMatch(out, /LAHORECriminal/);
  assert.doesNotMatch(out, /PAGE 1: TITLE/);
});
