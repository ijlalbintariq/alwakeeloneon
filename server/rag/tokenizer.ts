export type TokenizedText = {
  tokens: string[];
};

const TOKEN_SPLIT_REGEX = /\s+/;

export function tokenizeText(input: string): TokenizedText {
  const normalized = (input || "").replace(/\u0000/g, " ").trim();
  if (!normalized) return { tokens: [] };
  const tokens = normalized.split(TOKEN_SPLIT_REGEX).filter(Boolean);
  return { tokens };
}

export function joinTokens(tokens: string[]): string {
  return tokens.join(" ").trim();
}
