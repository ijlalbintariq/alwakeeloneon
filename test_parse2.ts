function parseCaseLawCitationParts(citation: string) {
  const raw = String(citation || "").trim();
  if (!raw) return null;
  const normalized = raw
    .replace(/[()[\],;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const standardMatch = normalized.match(/\b(18|19|20\d\d)\s+([A-Za-z\s]+)\s+(\d+)\b/);
  if (standardMatch) {
    const report = standardMatch[2].replace(/\s+/g, "").toUpperCase();
    return {
      year: parseInt(standardMatch[1], 10),
      report: report,
      page: parseInt(standardMatch[3], 10),
    };
  }
  return null;
}
console.log(parseCaseLawCitationParts('Const. P. 11/2026 (SHC)'));
