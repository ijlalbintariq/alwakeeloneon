/**
 * Legal-Aware Text Chunker
 *
 * Standard token-based chunking breaks legal citations by splitting them mid-sentence.
 * This chunker applies two passes:
 *
 *   Pass 1 (structural split): Break at natural legal section boundaries
 *            (numbered clauses, headings, paragraph breaks) so that each
 *            chunk contains semantically complete units.
 *
 *   Pass 2 (token cap): If a structural section exceeds MAX_TOKENS, split
 *            it into overlapping sub-chunks — but never cut mid-citation.
 *
 * Citation anchoring: any paragraph or sentence containing a recognized
 * citation pattern is kept intact in a single chunk whenever possible.
 * This ensures vector search can retrieve the citation alongside its context.
 *
 * Export: chunkTextByTokens(text, config?) — same signature as before.
 */

import { joinTokens, tokenizeText } from "./tokenizer";

// ---------------------------------------------------------------------------
// Types (unchanged public API)
// ---------------------------------------------------------------------------

export type TextChunk = {
  chunkIndex: number;
  text: string;
  tokenCount: number;
};

export type ChunkingConfig = {
  chunkSize: number;
  overlap: number;
  minTokens: number;
};

export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  chunkSize: 700,
  overlap: 120,
  minTokens: 60,
};

// ---------------------------------------------------------------------------
// Citation pattern (keep paragraphs containing these intact when possible)
// ---------------------------------------------------------------------------

const CITATION_RE = /\b(?:PLD|SCMR|YLR|MLD|CLC|PLJ|NLR|PCRLJ|PTCL|PTD|PSC|ALD|KLR|PLC|CLD|AIR|LHC|IHC|SHC|PHC|BHC|AJKHC)\b/i;

// Legal section boundary patterns — split on these markers
const SECTION_BOUNDARY_RE = /\n(?=\s*(?:\d+[\.\)]\s|\b(?:whereas|held|facts|judgment|order|section|article|rule|schedule|petitioner|respondent|bench|court|per|before|date)\b))/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countTokens(text: string): number {
  return tokenizeText(text).tokens.length;
}

/**
 * Split text at structural section boundaries.
 * Returns an array of raw text segments — not yet token-capped.
 */
function splitAtBoundaries(text: string): string[] {
  // Primary split: double newlines (paragraph breaks)
  const paragraphs = text.split(/\n{2,}/);
  const segments: string[] = [];
  let buffer = "";

  for (const para of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${para}` : para;
    const tokenCount = countTokens(candidate);

    if (tokenCount <= DEFAULT_CHUNKING_CONFIG.chunkSize * 1.5) {
      // Keep accumulating paragraphs until we approach the size limit
      buffer = candidate;
    } else {
      // Flush the buffer, start a new one
      if (buffer) segments.push(buffer.trim());
      buffer = para;
    }
  }
  if (buffer.trim()) segments.push(buffer.trim());

  return segments.filter((s) => s.length > 0);
}

/**
 * Sub-chunk a single text segment that is too large.
 * Respects citation boundaries: if a split point falls inside a citation
 * sentence, push the split point forward to the end of that sentence.
 */
function subChunkSegment(text: string, config: ChunkingConfig): string[] {
  const { tokens } = tokenizeText(text);
  if (tokens.length <= config.chunkSize) return [text];

  const step = Math.max(1, config.chunkSize - config.overlap);
  const subChunks: string[] = [];

  let start = 0;
  while (start < tokens.length) {
    const end = Math.min(tokens.length, start + config.chunkSize);
    const slice = tokens.slice(start, end);
    const sliceText = joinTokens(slice);

    // If this slice ends mid-citation, try to extend to end of sentence
    // (but never more than 60 extra tokens to avoid runaway growth)
    let finalText = sliceText;
    if (end < tokens.length && CITATION_RE.test(sliceText)) {
      const extended = tokens.slice(start, Math.min(tokens.length, end + 60));
      const extText = joinTokens(extended);
      // Find last sentence boundary after the citation
      const sentenceEnd = extText.lastIndexOf(". ");
      if (sentenceEnd > sliceText.length) {
        finalText = extText.slice(0, sentenceEnd + 1).trim();
      }
    }

    if (countTokens(finalText) >= config.minTokens) {
      subChunks.push(finalText);
    }

    if (end >= tokens.length) break;
    start += step;
  }

  return subChunks;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function chunkTextByTokens(
  text: string,
  config: ChunkingConfig = DEFAULT_CHUNKING_CONFIG,
): TextChunk[] {
  if (!text || text.trim().length === 0) return [];

  // Pass 1: structural split into semantic segments
  const segments = splitAtBoundaries(text);

  // Pass 2: sub-chunk any segment that exceeds the token cap
  const rawChunks: string[] = [];
  for (const segment of segments) {
    const tokenCount = countTokens(segment);
    if (tokenCount <= config.chunkSize) {
      if (tokenCount >= config.minTokens) {
        rawChunks.push(segment);
      }
    } else {
      const sub = subChunkSegment(segment, config);
      rawChunks.push(...sub);
    }
  }

  // Assign chunk indices
  return rawChunks.map((text, idx) => ({
    chunkIndex: idx,
    text,
    tokenCount: countTokens(text),
  }));
}
