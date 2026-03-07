import type { RetrievedStyleChunk, StyleRetrievalResult, StyleMemoryScope } from "./types";

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil((text || "").length / 4));
}

function trimToTokenBudget(text: string, maxTokens: number): string {
  const maxChars = Math.max(400, maxTokens * 4);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}...`;
}

export function buildStyleContext(chunks: RetrievedStyleChunk[], strictness: "strict" | "balanced" | "flexible", maxTokens: number): string {
  if (chunks.length === 0) return "";
  const styleDirective =
    strictness === "strict"
      ? "Mirror style closely while preserving legal correctness."
      : strictness === "flexible"
        ? "Use the examples as guidance, allowing creative adaptation."
        : "Match tone and structure while keeping concise legal drafting.";

  const blocks = chunks.map((chunk, idx) => {
    const excerpt = trimToTokenBudget(chunk.content, 220);
    return [
      `[Style Example ${idx + 1}]`,
      `Title: ${chunk.title}`,
      `Source Type: ${chunk.sourceType}`,
      `Chunk: ${chunk.chunkIndex}`,
      `Text: ${excerpt}`,
    ].join("\n");
  });

  const raw = [
    "STYLE MEMORY POLICY:",
    "- Apply writing style, structure, and tone from examples.",
    "- Do not copy case-specific facts unless user asks.",
    "- Do not fabricate legal authorities.",
    `- ${styleDirective}`,
    "",
    ...blocks,
  ].join("\n");

  return trimToTokenBudget(raw, maxTokens);
}

export function toStyleRetrievalResult(args: {
  chunks: RetrievedStyleChunk[];
  confidence: number;
  scopeUsed: StyleMemoryScope;
  strictness: "strict" | "balanced" | "flexible";
  maxContextTokens: number;
}): StyleRetrievalResult {
  const applied = args.chunks.length > 0;
  return {
    applied,
    confidence: Number(args.confidence.toFixed(3)),
    scopeUsed: args.scopeUsed,
    chunks: args.chunks,
    contextText: applied ? buildStyleContext(args.chunks, args.strictness, args.maxContextTokens) : "",
  };
}

export function styleContextTokenUsage(text: string): number {
  return estimateTokens(text);
}

