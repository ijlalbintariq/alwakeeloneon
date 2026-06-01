import test from "node:test";
import assert from "node:assert/strict";
import { detectQueryComplexity, isFollowUpQuestion } from "../../server/pipeline/intent-classifier";

test("detectQueryComplexity classifies queries correctly based on rules", () => {
  // Simple queries
  assert.equal(detectQueryComplexity("is it bailable?"), "simple");
  assert.equal(detectQueryComplexity("what is the penalty?"), "simple");
  assert.equal(detectQueryComplexity("define khula"), "simple");
  assert.equal(detectQueryComplexity("yes"), "simple");

  // Complex queries (long text or complex indicator keywords)
  assert.equal(
    detectQueryComplexity(
      "Please write a comprehensive partnership deed for a retail pharmacy business with three partners, detailing profit sharing ratios, dispute resolution clauses, and exit strategies step-by-step."
    ),
    "complex"
  );
  assert.equal(detectQueryComplexity("compare partition vs mortgage under Transfer of Property Act"), "complex");
  assert.equal(detectQueryComplexity("analyze the difference between void and voidable contracts"), "complex");

  // Moderate queries
  assert.equal(detectQueryComplexity("What are the requirements for registering a gift deed in Lahore?"), "moderate");
});

test("isFollowUpQuestion detects conversational follow-ups accurately", () => {
  // Clear follow-up starters
  assert.ok(isFollowUpQuestion("is it bailable?", 0));
  assert.ok(isFollowUpQuestion("what about the tenant?", 1000));
  assert.ok(isFollowUpQuestion("does this apply here?", 5000));
  assert.ok(isFollowUpQuestion("why?", 500));

  // Follow-up content/pronoun indicators
  assert.ok(isFollowUpQuestion("what you said about the mortgage", 2000));
  assert.ok(isFollowUpQuestion("referring to the same section", 10000));

  // Not a follow-up if query is too long
  assert.ok(
    !isFollowUpQuestion(
      "This is a very long query that is meant to introduce a completely new topic. We are no longer talking about the previous matter, so there is no continuity or follow-up happening. I need you to explain a totally unrelated concept under the law and give a detailed brief with multiple sections.",
      0
    )
  );

  // Not a follow-up if too much time has elapsed (e.g. 11 minutes)
  assert.ok(!isFollowUpQuestion("is it bailable?", 11 * 60 * 1000));
});
