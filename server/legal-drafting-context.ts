export const LEGAL_DRAFT_MAX_INPUT_CHARS = 250_000;

export function prepareLegalDraftInput(value: unknown): {
  rawText: string;
  cleanedText: string;
} {
  const rawText = typeof value === "string" ? value.replace(/\0/g, "") : "";
  const cleanedText = rawText
    .replace(/<!--\s*INDEX_TABLE_START\s*-->[\s\S]*?<!--\s*INDEX_TABLE_END\s*-->/gi, "")
    .replace(/<table[\s\S]*?<\/table>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s{3,}/g, "\n\n")
    .replace(/\n*\s*INDEX OF DOCUMENTS\s*:?\s*\n+(?:\s*S\.?\s*No\.?[^\n]{10,}\n?)*/gi, "\n")
    .trim();

  return { rawText, cleanedText };
}
