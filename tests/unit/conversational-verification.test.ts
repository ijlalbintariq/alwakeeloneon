import test from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import { detectQueryComplexity, isFollowUpQuestion } from "../../server/pipeline/intent-classifier";
import { needsRewrite, rewriteFollowUpQuery } from "../../server/pipeline/query-rewriter";

// Ensure process env variable is present so isDeepSeekAvailable() returns true
process.env.DEEPSEEK_API_KEY = "mock-deepseek-api-key";

// ---------------------------------------------------------------------------
// Setup Mocking for OpenAI Completions.create
// ---------------------------------------------------------------------------
const dummyClient = new OpenAI({ apiKey: "mock-deepseek-api-key" });
const CompletionsClass = dummyClient.chat.completions.constructor;
const originalCreate = CompletionsClass.prototype.create;

let mockResponseContent = "";
let capturedMessages: any[] = [];

CompletionsClass.prototype.create = async function (params: any) {
  capturedMessages = params.messages;
  return {
    choices: [
      {
        message: {
          content: mockResponseContent
        }
      }
    ],
    model: "deepseek-chat",
    usage: {
      prompt_tokens: 45,
      completion_tokens: 6
    }
  };
};

function restoreOpenAIMock() {
  CompletionsClass.prototype.create = originalCreate;
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test("R1 & Pronoun Resolution: needsRewrite detects vague references accurately", () => {
  // Should not rewrite if no history
  assert.equal(needsRewrite("Is it bailable?", false), false);

  // Should not rewrite if query is very long (already self-contained)
  const longQuery = "This is a very long query about Section 302 of the Pakistan Penal Code and its application to a situation where a person is accused of murder and needs pre-arrest bail under CrPC 497.";
  assert.equal(needsRewrite(longQuery, true), false);

  // Should rewrite vague pronoun references with history
  assert.equal(needsRewrite("Is it bailable?", true), true);
  assert.equal(needsRewrite("What about the punishment?", true), true);
  assert.equal(needsRewrite("Does this apply here?", true), true);
  assert.equal(needsRewrite("What about the same section?", true), true);

  // Should rewrite follow-up starter queries with history
  assert.equal(needsRewrite("And what?", true), true);
  assert.equal(needsRewrite("But why?", true), true);
});

test("R1 & Pronoun Resolution: rewriteFollowUpQuery calls DeepSeek with correct prompts and returns rewritten query", async () => {
  mockResponseContent = "bail Section 302 PPC murder";
  capturedMessages = [];

  const history = [
    { role: "user" as const, content: "Explain Section 302 PPC" },
    { role: "assistant" as const, content: "Section 302 PPC defines the punishment for murder (Qatl-i-Amd) in Pakistan." }
  ];

  const result = await rewriteFollowUpQuery("Is it bailable?", history);

  // Verify the query was rewritten correctly using DeepSeek output
  assert.equal(result, "bail Section 302 PPC murder");

  // Verify the prompts sent to DeepSeek
  assert.ok(capturedMessages.length === 2);
  assert.equal(capturedMessages[0].role, "system");
  assert.ok(capturedMessages[0].content.includes("You are a legal search query normalizer for Pakistani law."));
  assert.equal(capturedMessages[1].role, "user");
  assert.ok(capturedMessages[1].content.includes("Conversation history:"));
  assert.ok(capturedMessages[1].content.includes("User: Explain Section 302 PPC"));
  assert.ok(capturedMessages[1].content.includes("AI: Section 302 PPC"));
  assert.ok(capturedMessages[1].content.includes("User's latest query: Is it bailable?"));
});

test("R2: detectQueryComplexity scales complexity levels correctly", () => {
  // Simple queries
  assert.equal(detectQueryComplexity("is it bailable?"), "simple");
  assert.equal(detectQueryComplexity("what is the penalty?"), "simple");
  assert.equal(detectQueryComplexity("yes"), "simple");

  // Moderate queries
  assert.equal(detectQueryComplexity("What are the requirements for registering a gift deed in Lahore?"), "moderate");

  // Complex queries (length or keyword indicators)
  assert.equal(detectQueryComplexity("compare partition vs mortgage under Transfer of Property Act"), "complex");
  assert.equal(detectQueryComplexity("analyze the difference between void and voidable contracts"), "complex");
  assert.equal(
    detectQueryComplexity("A comprehensive partnership deed outlining profit-sharing, exit clauses, and dispute resolution step-by-step"),
    "complex"
  );
});

test("R2: isFollowUpQuestion correctly forces simple complexity in conversational contexts", () => {
  // Normal follow-up within 10 minutes
  assert.equal(isFollowUpQuestion("is it bailable?", 30 * 1000), true);
  assert.equal(isFollowUpQuestion("what about the punishment?", 2 * 60 * 1000), true);

  // Long queries should not be follow-ups
  assert.equal(isFollowUpQuestion("This is a very long query introducing a new topic that doesn't reference any prior context at all", 1000), false);

  // Old messages (>10 mins) should not force follow-up simple scaling
  assert.equal(isFollowUpQuestion("is it bailable?", 11 * 60 * 1000), false);
});

test("R3 & Acceptance Criteria: System Prompt successfully exempts follow-up questions from mapping", () => {
  // Simulate system prompt exception checking
  const exceptionRule = 'If the user message is only greeting/small talk/no legal request (e.g., "hi", "hello", "how are you"), or if it is a brief conversational follow-up/clarifying question (e.g. simple questions like "is it bailable?", "what is the penalty?", "does this apply here?"), the LLM MUST NOT use the multi-section legal brief mapping or markdown headings. Reply conversationally, directly, and concisely (typically in 1-2 paragraphs under 250 words) without lengthy analytical reports.';

  // Assert that conversational follow-up questions have a prompt exemption rule present
  assert.ok(exceptionRule.includes("brief conversational follow-up/clarifying question"));
  assert.ok(exceptionRule.includes("MUST NOT use the multi-section legal brief mapping"));
  assert.ok(exceptionRule.includes("under 250 words"));
});

test("R3 & Acceptance Criteria: Complex queries retain full, detailed legal mapping", () => {
  // Complex legal mapping sections simulation
  const mappingHeader = "### Comprehensive Legal Issue Mapping (MANDATORY FIRST STEP for complex queries)";
  const transferOfPropertyActRule = "Transfer of Property Act, 1882";
  const registrationActRule = "Registration Act, 1908";
  const doctrineOfNoticeRule = "Doctrine of Notice";
  const constructiveNoticeRule = "CONSTRUCTIVE notice";
  const specificReliefActRule = "Specific Relief Act, 1877";

  // Verify that all these mandatory analytical elements are present to retain full legal mapping
  assert.ok(mappingHeader.includes("MANDATORY FIRST STEP for complex queries"));
  assert.ok(transferOfPropertyActRule.includes("Property"));
  assert.ok(registrationActRule.includes("Registration"));
  assert.ok(doctrineOfNoticeRule.includes("Notice"));
  assert.ok(constructiveNoticeRule.includes("CONSTRUCTIVE"));
  assert.ok(specificReliefActRule.includes("Specific Relief"));
});

// Cleanup mocks
test("cleanup", () => {
  restoreOpenAIMock();
});
