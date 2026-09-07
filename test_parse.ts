const text = "2026 lhc 2236";
const preCleaned = text
    .replace(/\bP\s*Cr\s*L\s*J(?=\s|$|[^a-zA-Z0-9])/gi, "PCRLJ")
    .replace(/\bP\s*\.\s*L\s*\.\s*D\.?(?=\s|$|[^a-zA-Z0-9])/gi, "PLD")
    .replace(/\bS\s*\.\s*C\s*\.\s*M\s*\.\s*R\.?(?=\s|$|[^a-zA-Z0-9])/gi, "SCMR")
    .replace(/\bC\s*\.\s*L\s*\.\s*C\.?(?=\s|$|[^a-zA-Z0-9])/gi, "CLC")
    .replace(/\bY\s*\.\s*L\s*\.\s*R\.?(?=\s|$|[^a-zA-Z0-9])/gi, "YLR")
    .replace(/\bC\s*\.\s*L\s*\.\s*D\.?(?=\s|$|[^a-zA-Z0-9])/gi, "CLD")
    .replace(/\bP\s*\.\s*T\s*\.\s*D\.?(?=\s|$|[^a-zA-Z0-9])/gi, "PTD")
    .replace(/\bP\s*\.\s*L\s*\.\s*C\.?(?=\s|$|[^a-zA-Z0-9])/gi, "PLC")
    .replace(/\bM\s*\.\s*L\s*\.\s*D\.?(?=\s|$|[^a-zA-Z0-9])/gi, "MLD")
    .replace(/\bL\s*\.\s*H\s*\.\s*C\.?(?=\s|$|[^a-zA-Z0-9])/gi, "LHC")
    .replace(/\bS\s*\.\s*H\s*\.\s*C\.?(?=\s|$|[^a-zA-Z0-9])/gi, "SHC")
    .replace(/\bI\s*\.\s*H\s*\.\s*C\.?(?=\s|$|[^a-zA-Z0-9])/gi, "IHC")
    .replace(/\bP\s*\.\s*H\s*\.\s*C\.?(?=\s|$|[^a-zA-Z0-9])/gi, "PHC")
    .replace(/\bB\s*\.\s*H\s*\.\s*C\.?(?=\s|$|[^a-zA-Z0-9])/gi, "BHC")
    .replace(/\bF\s*\.\s*S\s*\.\s*C\.?(?=\s|$|[^a-zA-Z0-9])/gi, "FSC")
    .replace(/\bS\s*\.\s*C\.?(?=\s|$|[^a-zA-Z0-9])/gi, "SC")
    .replace(/\bF\s*\.\s*C\.?(?=\s|$|[^a-zA-Z0-9])/gi, "FC");

  const normalized = preCleaned
    .replace(/[()[\]{}<>,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const normalizeJournal = (j: string): string => {
    const clean = String(j || "")
      .replace(/\bP\.?\s*Cr\.?\s*L\.?\s*J\b/gi, "PCRLJ")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
    return clean;
  };

  const compactNeutral = normalized.match(
    /\b((?:19|20)\d{2})\s*(LHC|IHC|SHC|PHC|BHC|AJKHC|SC|FSC|FC)\s*(\d{1,6})\b/i
  );
  if (compactNeutral) {
    const year = Number(compactNeutral[1]);
    const journal = normalizeJournal(compactNeutral[2]);
    const page = Number(compactNeutral[3]);
    if (year >= 1947 && page >= 1) {
      console.log("compactNeutral matched:", { year, journal, page, court: journal, isValid: true });
    }
  }

  const yearFirst = normalized.match(
    /\b((?:19|20)\d{2})\s+([A-Za-z][A-Za-z0-9.]{0,12}(?:\s+[A-Za-z][A-Za-z0-9.]{0,12}){0,3})\s+(\d{1,6})\b/i
  );
  if (yearFirst) {
    const year = Number(yearFirst[1]);
    const journal = normalizeJournal(yearFirst[2]);
    const page = Number(yearFirst[3]);
    if (year >= 1947 && page >= 1) {
       console.log("yearFirst matched:", { year, journal, page, isValid: true });
    }
  }

