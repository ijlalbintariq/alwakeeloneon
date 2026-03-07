import { embedTextLocal, embedTextsLocal } from "../rag/embedding-local";

export async function embedStyleQuery(text: string): Promise<number[]> {
  return embedTextLocal(text);
}

export async function embedStyleChunks(texts: string[]): Promise<number[][]> {
  return embedTextsLocal(texts);
}

