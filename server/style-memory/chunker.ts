import { chunkTextByTokens, type TextChunk } from "../rag/chunker";

export const STYLE_MEMORY_CHUNK_CONFIG = {
  chunkSize: 700,
  overlap: 120,
  minTokens: 80,
} as const;

export function chunkStyleText(text: string): TextChunk[] {
  return chunkTextByTokens(text, STYLE_MEMORY_CHUNK_CONFIG);
}

