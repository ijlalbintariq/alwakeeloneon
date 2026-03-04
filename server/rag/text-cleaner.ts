function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00A0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripRepeatedLines(text: string, minRepeats: number = 3): string {
  const lines = text.split("\n");
  const counts = new Map<string, number>();
  for (const line of lines) {
    const key = line.trim().toLowerCase();
    if (!key || key.length < 6) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return lines
    .filter((line) => {
      const key = line.trim().toLowerCase();
      if (!key || key.length < 6) return true;
      return (counts.get(key) || 0) < minRepeats;
    })
    .join("\n");
}

export function cleanLegalDocumentText(raw: string): string {
  const normalized = normalizeWhitespace(raw || "");
  if (!normalized) return "";
  return normalizeWhitespace(stripRepeatedLines(normalized));
}
