import { joinTokens, tokenizeText } from "./tokenizer";

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
  minTokens: 80,
};

export function chunkTextByTokens(text: string, config: ChunkingConfig = DEFAULT_CHUNKING_CONFIG): TextChunk[] {
  const { tokens } = tokenizeText(text);
  if (tokens.length === 0) return [];

  const chunks: TextChunk[] = [];
  const step = Math.max(1, config.chunkSize - config.overlap);
  let chunkIndex = 0;

  for (let start = 0; start < tokens.length; start += step) {
    const end = Math.min(tokens.length, start + config.chunkSize);
    const slice = tokens.slice(start, end);

    if (slice.length < config.minTokens && end < tokens.length) {
      continue;
    }

    chunks.push({
      chunkIndex,
      text: joinTokens(slice),
      tokenCount: slice.length,
    });

    chunkIndex += 1;
    if (end >= tokens.length) break;
  }

  return chunks;
}
