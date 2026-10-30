/**
 * Pure TypeScript Word-Level Diff Utility for Claude-Like Document Editing.
 * Computes additions, deletions, and unchanged segments between two texts
 * without external npm dependencies.
 */

export type DiffChangeType = "add" | "del" | "eq";

export interface DiffToken {
  type: DiffChangeType;
  value: string;
}

export interface DiffResult {
  tokens: DiffToken[];
  additionsCount: number;
  deletionsCount: number;
  unchangedCount: number;
  hasChanges: boolean;
  originalText: string;
  revisedText: string;
}

/**
 * Tokenizes text by words, spaces, and punctuation for natural word-level comparison.
 */
function tokenizeWords(text: string): string[] {
  if (!text) return [];
  // Tokenize into words, punctuation, and whitespace chunks
  return text.match(/\s+|[^\s\p{P}]+|\p{P}/gu) || [text];
}

/**
 * Computes the Longest Common Subsequence (LCS) matrix for two token arrays.
 * Uses an optimized linear or bounded dynamic programming table.
 */
function computeLCS(tokensA: string[], tokensB: string[]): number[][] {
  const m = tokensA.length;
  const n = tokensB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (tokensA[i - 1] === tokensB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

/**
 * Backtracks the LCS table iteratively to build the diff tokens array.
 * Iterative backtracking prevents call stack overflows on long legal filings.
 */
function backtrackLCS(
  dp: number[][],
  tokensA: string[],
  tokensB: string[],
  startI: number,
  startJ: number,
  result: DiffToken[]
): void {
  let i = startI;
  let j = startJ;
  const reversed: DiffToken[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && tokensA[i - 1] === tokensB[j - 1]) {
      reversed.push({ type: "eq", value: tokensA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      reversed.push({ type: "add", value: tokensB[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      reversed.push({ type: "del", value: tokensA[i - 1] });
      i--;
    }
  }

  for (let k = reversed.length - 1; k >= 0; k--) {
    result.push(reversed[k]);
  }
}

/**
 * Merge adjacent tokens of the same diff type for cleaner DOM rendering.
 */
function mergeAdjacentTokens(tokens: DiffToken[]): DiffToken[] {
  if (tokens.length <= 1) return tokens;

  const merged: DiffToken[] = [];
  let current = { ...tokens[0] };

  for (let i = 1; i < tokens.length; i++) {
    const next = tokens[i];
    if (next.type === current.type) {
      current.value += next.value;
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Main word-level diff function.
 * Compares original text with revised text and returns structured diff tokens and stats.
 */
export function computeWordDiff(originalText: string = "", revisedText: string = ""): DiffResult {
  const normOriginal = originalText.trim();
  const normRevised = revisedText.trim();

  if (normOriginal === normRevised) {
    return {
      tokens: normOriginal ? [{ type: "eq", value: originalText }] : [],
      additionsCount: 0,
      deletionsCount: 0,
      unchangedCount: normOriginal.split(/\s+/).filter(Boolean).length,
      hasChanges: false,
      originalText,
      revisedText,
    };
  }

  // Tokenize
  const tokensA = tokenizeWords(originalText);
  const tokensB = tokenizeWords(revisedText);

  // Common prefix optimization (human-friendly diffs and O(N) short-circuit)
  let prefixCount = 0;
  while (
    prefixCount < tokensA.length &&
    prefixCount < tokensB.length &&
    tokensA[prefixCount] === tokensB[prefixCount]
  ) {
    prefixCount++;
  }

  // Common suffix optimization
  let suffixA = tokensA.length - 1;
  let suffixB = tokensB.length - 1;
  while (
    suffixA >= prefixCount &&
    suffixB >= prefixCount &&
    tokensA[suffixA] === tokensB[suffixB]
  ) {
    suffixA--;
    suffixB--;
  }

  const prefixTokens: DiffToken[] = tokensA.slice(0, prefixCount).map((t) => ({ type: "eq", value: t }));
  const middleA = tokensA.slice(prefixCount, suffixA + 1);
  const middleB = tokensB.slice(prefixCount, suffixB + 1);
  const suffixTokens: DiffToken[] = tokensA.slice(suffixA + 1).map((t) => ({ type: "eq", value: t }));

  const rawMiddle: DiffToken[] = [];
  if (middleA.length === 0 && middleB.length > 0) {
    for (const t of middleB) {
      rawMiddle.push({ type: "add", value: t });
    }
  } else if (middleB.length === 0 && middleA.length > 0) {
    for (const t of middleA) {
      rawMiddle.push({ type: "del", value: t });
    }
  } else if (middleA.length > 0 && middleB.length > 0) {
    // If text is excessively large (> 1500 tokens each), fallback to line/paragraph diff for performance
    if (middleA.length * middleB.length > 2500000) {
      return computeParagraphDiff(originalText, revisedText);
    }
    const dp = computeLCS(middleA, middleB);
    backtrackLCS(dp, middleA, middleB, middleA.length, middleB.length, rawMiddle);
  }

  const rawTokens: DiffToken[] = [...prefixTokens, ...rawMiddle, ...suffixTokens];
  const merged = mergeAdjacentTokens(rawTokens);

  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  for (const t of merged) {
    const wordCount = t.value.trim().split(/\s+/).filter(Boolean).length;
    if (t.type === "add") additions += wordCount;
    else if (t.type === "del") deletions += wordCount;
    else unchanged += wordCount;
  }

  return {
    tokens: merged,
    additionsCount: additions,
    deletionsCount: deletions,
    unchangedCount: unchanged,
    hasChanges: merged.some((token) => token.type !== "eq"),
    originalText,
    revisedText,
  };
}

/**
 * Fallback paragraph/line diff for very long documents to avoid O(N*M) table overflow.
 */
function computeParagraphDiff(originalText: string, revisedText: string): DiffResult {
  // Keep line terminators in the tokens so copying either side is lossless.
  const linesA = originalText.match(/[^\n]*\n|[^\n]+$/g) || [];
  const linesB = revisedText.match(/[^\n]*\n|[^\n]+$/g) || [];
  const tokens: DiffToken[] = [];
  // The fallback must itself be bounded: thousands of changed one-line
  // paragraphs otherwise allocate an even larger quadratic table.
  if (linesA.length * linesB.length > 2_500_000) {
    if (originalText) tokens.push({ type: "del", value: originalText });
    if (revisedText) tokens.push({ type: "add", value: revisedText });
  } else {
    const dp = computeLCS(linesA, linesB);
    backtrackLCS(dp, linesA, linesB, linesA.length, linesB.length, tokens);
  }

  const merged = mergeAdjacentTokens(tokens);

  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  for (const t of merged) {
    const wordCount = t.value.trim().split(/\s+/).filter(Boolean).length;
    if (t.type === "add") additions += wordCount;
    else if (t.type === "del") deletions += wordCount;
    else unchanged += wordCount;
  }

  return {
    tokens: merged,
    additionsCount: additions,
    deletionsCount: deletions,
    unchangedCount: unchanged,
    hasChanges: merged.some((token) => token.type !== "eq"),
    originalText,
    revisedText,
  };
}
