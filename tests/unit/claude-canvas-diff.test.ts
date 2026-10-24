import test from "node:test";
import assert from "node:assert/strict";
import { computeWordDiff } from "../../client/src/experimental/lib/text-diff";

test("computeWordDiff: identical text returns no changes", () => {
  const text = "That the Petitioner is a law-abiding citizen of Pakistan.";
  const result = computeWordDiff(text, text);

  assert.equal(result.hasChanges, false);
  assert.equal(result.additionsCount, 0);
  assert.equal(result.deletionsCount, 0);
  assert.equal(result.tokens.length, 1);
  assert.equal(result.tokens[0].type, "eq");
  assert.equal(result.tokens[0].value, text);
});

test("computeWordDiff: detects single word replacement", () => {
  const original = "That the Petitioner has no other alternate remedy.";
  const revised = "That the Petitioner has no other efficacious remedy.";
  const result = computeWordDiff(original, revised);

  assert.equal(result.hasChanges, true);
  assert.equal(result.additionsCount, 1);
  assert.equal(result.deletionsCount, 1);

  const delToken = result.tokens.find((t) => t.type === "del");
  const addToken = result.tokens.find((t) => t.type === "add");

  assert.ok(delToken, "Should contain deleted token");
  assert.ok(addToken, "Should contain added token");
  assert.equal(delToken?.value.trim(), "alternate");
  assert.equal(addToken?.value.trim(), "efficacious");
});

test("computeWordDiff: detects appended text (pure addition)", () => {
  const original = "Order 39 Rules 1 & 2 CPC";
  const revised = "Order 39 Rules 1 & 2 CPC read with Section 151 CPC";
  const result = computeWordDiff(original, revised);

  assert.equal(result.hasChanges, true);
  assert.ok(result.additionsCount >= 4);
  assert.equal(result.deletionsCount, 0);

  const addTokens = result.tokens.filter((t) => t.type === "add");
  const addedString = addTokens.map((t) => t.value).join("");
  assert.ok(addedString.includes("read with Section 151 CPC"));
});

test("computeWordDiff: detects deleted text (pure deletion)", () => {
  const original = "Under Article 199 of the Constitution of Pakistan, 1973.";
  const revised = "Under Article 199.";
  const result = computeWordDiff(original, revised);

  assert.equal(result.hasChanges, true);
  assert.equal(result.additionsCount, 0);
  assert.ok(result.deletionsCount >= 5);

  const delTokens = result.tokens.filter((t) => t.type === "del");
  const deletedString = delTokens.map((t) => t.value).join("");
  assert.ok(deletedString.includes("Constitution of Pakistan"));
});

test("computeWordDiff: handles empty and whitespace strings safely", () => {
  const result1 = computeWordDiff("", "");
  assert.equal(result1.hasChanges, false);

  const result2 = computeWordDiff("Initial text", "");
  assert.equal(result2.hasChanges, true);
  assert.ok(result2.deletionsCount > 0);

  const result3 = computeWordDiff("", "New text");
  assert.equal(result3.hasChanges, true);
  assert.ok(result3.additionsCount > 0);
});

test("computeWordDiff: handles multi-paragraph legal pleading diffs", () => {
  const original = `1. That the Petitioner filed suit on 01-01-2026.
2. That the learned Trial Court dismissed the application without lawful justification.`;

  const revised = `1. That the Petitioner filed suit for declaration on 01-01-2026.
2. That the learned Civil Judge dismissed the application arbitrarily without lawful justification.`;

  const result = computeWordDiff(original, revised);

  assert.equal(result.hasChanges, true);
  assert.ok(result.additionsCount >= 2);

  const addedWords = result.tokens
    .filter((t) => t.type === "add")
    .map((t) => t.value)
    .join(" ");

  assert.ok(addedWords.includes("for declaration"));
  assert.ok(addedWords.includes("Civil Judge"));
});

test("computeWordDiff: handles legal statutory citations and symbols (&, §, /)", () => {
  const original = "Section 9 & 10 of the Specific Relief Act, 1877";
  const revised = "Section 9, 10 & 12 of the Specific Relief Act, 1877 (I of 1877)";
  const result = computeWordDiff(original, revised);

  assert.equal(result.hasChanges, true);
  assert.ok(result.additionsCount >= 2);
  const additions = result.tokens.filter(t => t.type === "add").map(t => t.value).join("");
  assert.ok(additions.includes("12"));
});

test("computeWordDiff: preserves sentence structure and line breaks in tokens", () => {
  const original = "Paragraph A.\nParagraph B.";
  const revised = "Paragraph A (amended).\nParagraph B.";
  const result = computeWordDiff(original, revised);

  assert.equal(result.hasChanges, true);
  const fullText = result.tokens.map(t => t.value).join("");
  // Reconstructed text should account for the new additions cleanly
  assert.ok(fullText.includes("(amended)"));
});

test("computeWordDiff: handles large documents without call stack overflow", () => {
  const lineCount = 1200;
  const originalLines = Array.from({ length: lineCount }, (_, i) => `Paragraph line ${i} of legal filing text.`);
  const revisedLines = Array.from({ length: lineCount }, (_, i) =>
    i % 10 === 0 ? `Updated paragraph line ${i} with modified legal clause.` : `Paragraph line ${i} of legal filing text.`
  );

  const original = originalLines.join("\n");
  const revised = revisedLines.join("\n");

  // This would throw RangeError: Maximum call stack size exceeded with recursive LCS
  assert.doesNotThrow(() => {
    const result = computeWordDiff(original, revised);
    assert.ok(result.hasChanges);
    assert.ok(result.additionsCount > 0);
    assert.ok(result.deletionsCount > 0);
  });
});
