/**
 * ============================================================================
 * PAKISTANI STATUTES COMPENDIUM SANITIZER & AST PARSER
 * Strictly isolated in client/src/experimental/lib/statuteSanitizer.ts
 * ============================================================================
 * 4-Stage Legal Normalization Pipeline:
 * Stage 1: Macro Header & Gazette Preamble Stripper
 * Stage 2: Section Number & In-Line Title Normalizer
 * Stage 3: Typographic, OCR & Broken Line-Wrap Repairer
 * Stage 4: Structural AST Segmenter (pure cleanText, illustrations, proceduralNotes, amendmentNotes, punishment)
 * ============================================================================
 */

export interface StatuteAST {
  cleanText: string;
  illustrations: string[];
  proceduralNotes: string[];
  amendmentNotes: string[];
  punishment?: string;
  crossReferences?: string[];
}

export interface SanitizedStatutorySection {
  cleanSection: string;
  cleanTitle: string;
  cleanText: string;
  illustrations: string[];
  proceduralNotes: string[];
  amendmentNotes: string[];
  punishment?: string;
  rawText: string;
}

const PREPOSITIONS_LOWER = new Set([
  "and",
  "or",
  "of",
  "in",
  "to",
  "a",
  "an",
  "for",
  "with",
  "on",
  "at",
  "by",
  "from",
  "etc",
  "etc.",
  "within",
  "without",
  "under",
  "against",
  "between",
  "into",
  "through",
  "upon",
  "as",
  "i", // Urdu izafat (e.g. Qatl-i-Amd, Qatl-i-Khata)
  "bis", // e.g. Qatl-bis-Sabab
  "ul", // e.g. Babul-Ilm
  "al", // e.g. Dar-al-Harb
]);

/**
 * Title Case Capitalizer preserving prepositions
 */
export function sanitizeSectionTitle(rawTitle: string): string {
  if (!rawTitle) return "";
  let clean = rawTitle
    .replace(/\s+/g, " ")
    .replace(/^["']+|["']+$/g, "")
    .trim();

  const words = clean.toLowerCase().split(" ");
  clean = words
    .map((word, idx) => {
      // Keep hyphenated sub-parts capitalized (e.g. Extra-Territorial, Qatl-i-Amd)
      if (word.includes("-")) {
        return word
          .split("-")
          .map((sub, sIdx) => {
            if (idx === 0 && sIdx === 0) return sub.charAt(0).toUpperCase() + sub.slice(1);
            if (PREPOSITIONS_LOWER.has(sub)) return sub;
            return sub.charAt(0).toUpperCase() + sub.slice(1);
          })
          .join("-");
      }
      if (idx > 0 && PREPOSITIONS_LOWER.has(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");

  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Normalizes section number to standard format (e.g. "Section 302", "Article 199", "Order 7 Rule 11", "Order XXI Rule 58")
 */
export function sanitizeSectionNumber(rawSection: string, statuteName?: string): string {
  if (!rawSection) return "Section";
  let s = rawSection.trim();

  // Strip prefix like "ppc-sec-", "crpc-", "sec-", "art-"
  s = s.replace(/^[a-z0-9_\-]+-sec-/i, "");
  s = s.replace(/^[a-z0-9_\-]+-art-/i, "");
  s = s.replace(/^[a-z0-9_\-]+-sec/i, "");
  s = s.replace(/^[a-z0-9_\-]+-art/i, "");
  s = s.replace(/^[a-z0-9_\-]+-/i, "");

  const isConstitution = statuteName && statuteName.toLowerCase().includes("constitution");
  const isCpcOrder = /^(?:o\.|order)\s*(?:\d+|[ivxlcdm]+)/i.test(s) || /o[0-9ivxlcdm]+r[0-9ivxlcdm]+/i.test(s);

  if (isCpcOrder) {
    return s;
  }

  if (isConstitution || /^art(?:icle)?\b/i.test(s)) {
    const num = s.replace(/^art(?:icle)?\.?\s*/i, "").trim();
    return `Article ${num}`;
  }

  if (/^(?:section|sec)\b/i.test(s)) {
    const num = s.replace(/^(?:section|sec)\.?\s*/i, "").trim();
    return `Section ${num}`;
  }

  return `Section ${s}`;
}

/**
 * Stage 1: Macro Header & Gazette Preamble Stripper
 */
export function stripGazetteAndPreambles(text: string): string {
  if (!text) return "";
  let clean = text.replace(/\0/g, "").trim();

  // 1. Strip top-level web scraping artifacts & HTML comments
  clean = clean.replace(/^(?:document\.[^\n]+\n*|<!--[\s\S]*?-->|-->\s*\n*)+/gi, "");

  // 2. Strip Islamic Invocations (Arabic and English translation)
  clean = clean.replace(
    /^(?:(?:OF\s+)?PAKISTAN\s*\n*)?(?:بِسْمِ[^\n]*\n*|\(In\s+the[\s\S]*?Merciful[^\)]*\)\s*\n*)+/gi,
    ""
  );

  // 3. Normalize OCR apostrophes in CHAPTER and PART
  clean = clean.replace(/CHAP['’`‛′]TER/gi, "CHAPTER");

  // 4. Strip Provincial Government Banners
  clean = clean.replace(/^(?:GOVERNMENT\s+OF[^\n]*\n*|LAW\s+AND\s+PARLIAMENTARY[^\n]*\n*)+/gi, "");

  // 5. Strip leading section ID / number / title tokens prepended before macro headers
  clean = clean.replace(
    /^[^\n]{1,250}\n+(?=(?:Preamble\.\s*)?(?:WHEREAS\b|WHERE\s+it\s+is\s+(?:expedient|necessary|declared)\b))/i,
    ""
  );

  const statuteHeaderPattern =
    "(?:THE\\s+(?:PAKISTAN|CODE|CONSTITUTION|PUNJAB|SPECIFIC|CONTRACT|LIMITATION|ARBITRATION|REGISTRATION|GUARDIANS|COURT\\s+FEES|SUITS\\s+VALUATION|GENERAL\\s+CLAUSES|FAMILY\\s+COURTS|FIRST\\s+SCHEDULE|ISLAMIC|QANUN)|CONSTITUTION\\s+OF|PAKISTAN\\s+PENAL|COMPANIES\\s+ORDINANCE|SUCCESSION\\s+ACT|LIMITATION\\s+ACT|PREVENTION\\s+OF\\s+ELECTRONIC|ORDINANCE\\s+(?:IX|NO\\.|[IVXLCDM0-9]+)|MITSLIM|MUSLIM\\s+FAMILY|TRANSFER\\s+OF\\s+PROPERTY|CHAPTER\\s+[IVXLCDM0-9]+|ORDER\\s+[IVXLCDM0-9]+|ACT\\s+(?:NO\\.\\s+)?[IVXLCDM0-9]+\\s+OF\\s+\\d{4}|COURT?\\s+FEES|SUITS\\s+VALUATION|GENERAL\\s+CLAUSES|QANUN|CONTRACT\\s+ACT|GUARDIANS\\s+AND\\s+WARDS|REGISTRATION\\s+ACT|ARBITRATION\\s+ACT|PART\\s+[IVXLCDM0-9]+|\\[(?:ORDINANCE|ACT|ORDER)|\\(?ACT\\s+(?:NO\\.\\s+)?[IVXLCDM0-9]+\\s+OF\\s+\\d{4}|\\(?ORDINANCE\\s+(?:NO\\.\\s+)?[IVXLCDM0-9]+\\s+OF\\s+\\d{4}|\\(For\\s+Statement|\\(Statement|Statement\\s+of|Reasons,?\\s+see|Preamble\\.\\s*WHERE|WHEREAS\\b|WHERE\\s+it\s+is\\s+(?:expedient|necessary|declared)\\b)";

  const multiLineScrapRegex = new RegExp(
    `^(?:[^\\n]+\\n+){1,3}(?=(?:\\[\\d+\\])*${statuteHeaderPattern})`,
    "i"
  );
  clean = clean.replace(multiLineScrapRegex, "");

  const whileScrapRegex = new RegExp(
    `^(?:[0-9]+[A-Za-z\\-]*|[^\\n]{1,400})\\n+(?=(?:[0-9]+[A-Za-z\\-]*\\n+)?(?:\\[\\d+\\])*${statuteHeaderPattern})`,
    "i"
  );
  while (whileScrapRegex.test(clean)) {
    clean = clean.replace(whileScrapRegex, "");
  }
  clean = clean.replace(/^(?:[0-9]+[A-Za-z\-]*|Pakistan\s+Penal\s+Code)\s+(?=THE\s+PAKISTAN\s+PENAL\s+CODE)/i, "");

  // Handle specific multi-line pre-header fragments like in First Schedule Companies Ordinance (ID 2351)
  clean = clean.replace(/^\([a-z0-9]+\)\s+unless\s+the\s+company[\s\S]*?(?=COMPANIES\s+ORDINANCE\s*1984)/i, "");
  // Handle Court Fees Act variants (IDs 4006, 4007, 4026)
  clean = clean.replace(/^[^\n]{1,200}\n+(?=COURT\s+FEES\s+ACT)/i, "");

  // 6. Iteratively strip macro Act titles & Ordinance banners
  let prevClean = "";
  while (prevClean !== clean) {
    prevClean = clean;

    // Web scraper / JS / comment artifacts inside loop
    clean = clean.replace(/^(?:document\.[^\n]+\n*|<!--[\s\S]*?-->|-->\s*\n*)+/gi, "");

    // Islamic invocations inside loop
    clean = clean.replace(
      /^(?:(?:OF\s+)?PAKISTAN\s*\n*)?(?:بِسْمِ[^\n]*\n*|\(In\s+the[\s\S]*?Merciful[^\)]*\)\s*\n*)+/gi,
      ""
    );
    clean = clean.replace(/^(?:(?:OF\s+)?PAKISTAN\s*\n*)+(?=\[?\d+(?:st|nd|rd|th)?|\(In\s+the|Preamble|THE\s+CONSTITUTION)/i, "");

    // Provincial Government Banners inside loop
    clean = clean.replace(/^(?:GOVERNMENT\s+OF[^\n]*\n*|LAW\s+AND\s+PARLIAMENTARY[^\n]*\n*)+/gi, "");

    // Leading partial title scraps before WHEREAS, Statement of Objects, or Act headers
    clean = clean.replace(/^[^\n]{1,250}\n+(?=(?:Preamble\.\s*)?WHEREAS\b|WHERE\s+it\s+is\s+(?:expedient|necessary|declared)\b|\(?(?:For\s+)?Statement\s+of\s+Objects|Reasons,?\s+see\s+Gazette)/i, "");

    // A. Strip Constitutional 35-line Preamble (Constitution of Pakistan 1973 Article 1)
    clean = clean.replace(
      /^(?:[^\n]+\n+)?(?:(?:THE\s+)?CONSTITUTION\s+OF\s+THE\s+ISLAMIC\s+REPUBLIC[\s\S]*?adopt,\s*enact\s*and\s*give\s*to\s*ourselves,\s*this\s*Constitution\.[\s\S]*?(?:PART\s+[IVXLCDM0-9]+[^\n]*\n+)?(?:[A-Z\s,]+\n+)?)/i,
      ""
    );
    clean = clean.replace(
      /^(?:Preamble[\.\:\-\s]*Whereas\s+sovereignty[\s\S]*?adopt,\s*enact\s*and\s*give\s*to\s*ourselves,\s*this\s*Constitution\.[\s\S]*?(?:PART\s+[IVXLCDM0-9]+[^\n]*\n+)?(?:[A-Z\s,]+\n+)?)/i,
      ""
    );

    // B. Strip Constitutional macro headers across ALL articles (e.g. Art 199, Art 6, etc.)
    clean = clean.replace(
      /^(?:(?:THE\s+)?CONSTITUTION\s+OF\s+THE\s+ISLAMIC\s+REPUBLIC[\s\S]*?(?:OF\s+PAKISTAN\s*\n+|OF\s*\n+|PAKISTAN\s*\n+))(?:\[\d+th\s+[A-Za-z]+,?\s*\d{4}\]\s*\n+)?(?:PART\s+[IVXLCDM0-9]+[^\n]*\n+)?(?:[A-Z\s,\-\d]+\n+)?(?:CHAPTER\s+[IVXLCDM0-9\-\s:]+[^\n]*\n+)?/i,
      ""
    );
    clean = clean.replace(/^(?:(?:THE\s+)?CONSTITUTION\s+OF\s+THE\s+ISLAMIC\s+REPUBLIC[^\n]*\n*)+/i, "");

    // C. Strip Pakistan Penal Code repeated titles & Act XLV header
    clean = clean.replace(
      /^(?:(?:THE\s+)?PAKISTAN\s+PENAL\s+CODE[\s\S]*?(?:ACT\s+NO\.\s+XLV\s+OF\s+1860\b|XLV\s+OF\s+1860\b)\.?\s*\n*)/i,
      ""
    );
    clean = clean.replace(/^(?:(?:THE\s+)?PAKISTAN\s+PENAL\s+CODE(?:,?\s*1860)?\s*\n*)+/i, "");

    // D. Strip Code of Criminal Procedure repeated titles & Act V header
    clean = clean.replace(
      /^(?:THE\s+CODE\s+OF\s+CRIMINAL\s+PROCEDURE[\s\S]*?(?:\(?ACT\s+V\s+OF\s+1898\)?|\bACT\s+V\s+OF\s+1898\b)\.?\s*\n*)/i,
      ""
    );
    clean = clean.replace(/^(?:THE\s+CODE\s+OF\s+CRIMINAL\s+PROCEDURE[^\n]*\n*)+/i, "");

    // E. Strip Code of Civil Procedure 1908 Gazette, Select Committee, and Order headers
    clean = clean.replace(
      /^(?:THE\s+CODE\s+OF\s+CIVIL\s+PROCEDURE[\s\S]*?(?:dated\s+the\s+1st\s+June,?\s*1951\.?\s*\n*|PRELIMINARY\n+|PART\s+[IVXLCDM0-9]+[^\n]*\n+))/i,
      ""
    );
    clean = clean.replace(/^(?:THE\s+CODE\s+OF\s+CIVIL\s+PROCEDURE(?:,\s*1908)?\s*\n*)+/i, "");

    // F. Strip Specific Relief Act 1877 repeated titles & Act I header
    clean = clean.replace(
      /^(?:THE\s+SPECIFIC\s+RELIEF\s+ACT[\s\S]*?(?:ACT\s+NO\.\s+I\s+OF\s+1877|\(?I\s+OF\s+1877\)?)\.?\s*\n*)/i,
      ""
    );
    clean = clean.replace(/^(?:(?:PART\s+[IVXLCDM0-9]+\s+)?THE\s+SPECIFIC\s+RELIEF\s+ACT,?\s*1877(?:\s*\([^\)]+\))?\s*\n*)+/i, "");

    // G. Strip Companies Ordinance 1984 repeated titles & Ordinance XLVII header
    clean = clean.replace(
      /^(?:COMPANIES\s+ORDINANCE[\s\S]*?(?:\(?ORDINANCE\s+(?:NO\.\s+)?XLVII\s+OF\s+1984\)?|\[\d+th\s+October,?\s*1984\])\.?\s*\n*)/i,
      ""
    );
    clean = clean.replace(/^(?:COMPANIES\s+ORDINANCE\s*1984\s*\n*)+/i, "");

    // H. Strip Succession Act 1925 repeated titles & Act XXXIX header
    clean = clean.replace(
      /^(?:SUCCESSION\s+ACT[\s\S]*?(?:ACT\s+No\.\s+XXXIX\s+of\s+1925|\[\d+th\s+September,?\s*1925\])\.?\s*\n*)/i,
      ""
    );
    clean = clean.replace(/^(?:SUCCESSION\s+ACT\s*1925\s*\n*)+/i, "");

    // I. Strip Qanun-e-Shahadat Order 1984 titles & (X OF 1894/1984) header
    clean = clean.replace(
      /^(?:(?:(?:PART|CHAPTER)\s+[IVXLCDM0-9]+\s*\n+)?(?:THE\s+)?QANUN[\u2011\-\s]*E[\u2011\-\s]*SHAHADAT\s+ORDER[\s\S]*?(?:\[\d+th\s+October,?\s*1984[\]\)]|\(X\s+OF\s+\d{4}\)\.?)\s*\n*)/i,
      ""
    );
    clean = clean.replace(/^(?:THE\s+QANUN[\u2011\-\s]*E[\u2011\-\s]*SHAHADAT\s+ORDER,?\s*1984\s*\n*)+/i, "");

    // J. Strip Contract Act 1872 repeated title & header
    clean = clean.replace(
      /^(?:THE\s+CONTRACT\s+ACT[\s\S]*?(?:\[25th\s+April,?\s*1872\]|\(IX\s+of\s+1872\))\s*\n*)/i,
      ""
    );
    clean = clean.replace(/^(?:THE\s+CONTRACT\s+ACT\s*\n*)+/i, "");

    // K. Strip Limitation Act 1908 repeated title & header
    clean = clean.replace(
      /^(?:LIMITATION\s+ACT[\s\S]*?(?:\[7th\s+August,?\s*1908\]|\(IX\s+OF\s+1908\))\s*\n*)/i,
      ""
    );
    clean = clean.replace(/^(?:LIMITATION\s+ACT\s*\n*)+/i, "");

    // L. Strip PECA 2008 Ordinance IX Promulgation Banner & repeated headers
    clean = clean.replace(
      /^(?:(?:ORDINANCE\s+IX\s+OF\s+2008\s*\n+)?(?:PREVENTION\s+OF\s+ELECTRONIC\s+CRIMES\s+ORDINANCE,?\s*2008\.?\s*\n+)?[\s\S]*?(?:the\s+President\s+is\s+pleased\s+to\s+make\s+and\s+promulgate[\s\S]*?[:\-\u2011]+\s*\n*|\[Gazette\s+of\s+Pakistan[\s\S]*?\d+\-\d+\-\d+\.?[^\n]*\n+|CHAPTER\s*--?\s*[IVXLCDM0-9]+[^\n]*\n+))/i,
      ""
    );
    clean = clean.replace(/^(?:ORDINANCE\s+IX\s+OF\s+2008\s*\n*)+/i, "");
    clean = clean.replace(/^(?:PREVENTION\s+OF\s+ELECTRONIC\s+CRIMES\s+ORDINANCE,?\s*2008\.?\s*\n*)+/i, "");

    // M. Strip Family Courts Act, Muslim Family Laws, Arbitration, Guardians & Wards, Registration, Court Fees, Suits Valuation, General Clauses, Negotiable Instruments, Transfer of Property
    clean = clean.replace(
      /^(?:\[\d+\])*(?:(?:PART|CHAPTER)\s+[IVXLCDM0-9]+\s*\n+)?(?:THE\s+)?(?:FAMILY\s+COURTS\s+ACT,?\s*1964|MITSLIM\s+FAMILY\s+LAWS\s+ORDINANCE,?\s*1961|MUSLIM\s+FAMILY\s+LAWS\s+ORDINANCE,?\s*1961|ARBITRATION\s+ACT,?\s*1940|GUARDIANS\s+AND\s+WARDS\s+ACT|REGISTRATION\s+ACT\s*1908|COURT?\s+FEES\s+ACT\s*1870|COURT\s+FEES\s+ACT,?\s*1870|COURT[\s\n]+FEES[\s\n]+ACT,?\s*1870|SUITS\s+VALUATION\s+ACT,?\s*1887|GENERAL\s+CLAUSES\s+ACT|NEGOTIABLE\s+INSTRUMENTS\s+ACT,?\s*1881|TRANSFER\s+OF\s+PROPERTY\s+ACT,?\s*1882|TRANSFER\s+OF\s+PROPERTY)\s*\n*/i,
      ""
    );

    // N. Generic Multi-Act Preamble & Promulgation Banner across all Federal and Provincial Acts
    clean = clean.replace(
      /^(?:\[\d+\])*(?:THE\s+)?[A-Z0-9\s,\(\)\-\'\.]{4,120}\n+(?:ACT|ORDINANCE|ORDER)\s+(?:NO\.\s+)?[IVXLCDM0-9]+\s+OF\s+\d{4}[\s\S]*?(?:WHEREAS[\s\S]*?(?:(?:It\s+is\s+hereby\s+)?enacted\s+as\s+follows|promulgate\s+the\s+following\s+Ordinance)[:\-\s]*\n*|PART\s+[IVXLCDM0-9]+[^\n]*\n+|CHAPTER\s+[IVXLCDM0-9]+[^\n]*\n+)/i,
      ""
    );
    clean = clean.replace(
      /^(?:\[\d+\])*(?:(?:\[|\()?(?:ACT|ORDINANCE|ORDER)\s+(?:NO\.\s+)?[IVXLCDM0-9]+\s+OF\s+\d{4}(?:\]|\))?\.?|\(?Act\s+No\.\s*\([IVXLCDM0-9]+\s+OF\s+\d{4}\)\.?|\[ORDINANCE\s+NO\.\s+[IVXLCDM0-9]+\s+OF\s+\d{4}\]|\([A-Z0-9\s\.\-]+\s+OF\s+\d{4}\)\.?)\s*\n*/i,
      ""
    );
    clean = clean.replace(/^(?:AN?\s+(?:ACT|ORDINANCE)\s*\n*)+/i, "");

    // O. Strip Date brackets [12th April 1973], [21st March 1908], [11th February, 18871], [18 July 1964], etc.
    clean = clean.replace(/^\[\d+(?:st|nd|rd|th)?[\s\S]*?\d{4}[0-9A-Za-z\s]*[\]\)]*\s*\n*/i, "");
    clean = clean.replace(/^\[\d+\s+[A-Za-z]+,?\s*\d{4}[0-9A-Za-z\s]*[\]\)]*\s*\n*/i, "");

    // P. Strip multi-line Statement of Objects and Reasons / Gazette of India notes
    clean = clean.replace(
      /^\(?(?:For\s+)?(?:Statement\s+of\s+Objects\s+and\s+Reasons|Reasons),?\s+see\s+Gazette[\s\S]*?(?:WHERE(?:AS)?\b|WHERE\s+it\s+is\b|PRELIMINARY|PART\s+[IVXLCDM0-9]+|\b1\.\s+[A-Z]|\b\d+\.\s+[A-Z])/i,
      ""
    );

    // Q. Strip multi-line "An Act to..." or "An Ordinance to..."
    clean = clean.replace(
      /^(?:An\s+(?:Act|Ordinance)\s*(?:\n+to|\s+to|\n+[^\n]+\n+to)\s+|to\s+provide\s+for\s+)[\s\S]*?(?:harassment|workplace|associations|Arbitration|Property|Registration|Documents|Courts|matters|Marriage|hereby|follows|enacted|purposes|Relief|crimes|tribunals|disputes)(?:[:\-\s.]*\n*|(?=\s*(?:For\s+Statement|Statement\s+of|Reasons,?\s+see|WHERE(?:AS)?\b|WHERE\s+it\s+is\b|\[\d|\b1\.\s+[A-Z]|\b\d+\.\s+[A-Z])))/i,
      ""
    );

    // R. Strip Preamble / WHEREAS blocks
    clean = clean.replace(
      /^(?:relating\s+to[^\n]+\n+)?(?:Preamble\.\s*)?WHERE(?:AS)?\s+[\s\S]*?(?:(?:It\s+is\s+hereby\s+)?enacted\s+as\s+follows[:\-\s.]*|promulgate\s+the\s+following\s+Ordinance[:\-\s.]*|following\s+Ordinance[:\-\s.]*|;\s*(?:\n+(?:It\s+is\s+hereby\s+)?enacted\s+as\s+follows[:\-\s.]*|(?:\n+|$)))/i,
      ""
    );

    // Strip NOW, THEREFORE promulgation clauses
    clean = clean.replace(
      /^(?:NOW,\s*THEREFORE|in\s+exercise\s+of\s+the\s+powers)[\s\S]*?(?:promulgate\s+the\s+following\s+Ordinance|enacted\s+as\s+follows)[:\-\s.]*\n*/i,
      ""
    );

    // S. Iteratively strip residual leading chapter/part/preliminary/order headers
    while (
      /^[\-:\s]*(?:PART\s*(?:--?|\.)?\s*[IVXLCDM0-9\-]+[^\n]*|CHAPTER\s*(?:--?|\.)?\s*[IVXLCDM0-9\-]+[^\n]*|ORDER\s*(?:--?|\.)?\s*[IVXLCDM0-9\-]+[^\n]*|PRELIMINARY|INTRODUCTION|INTRODUCTORY|PLATING|PLEADING|THE\s+JUDICATURE|THE\s+HIGH\s+COURTS|OFFENCES\s+AND\s+PUNISHMENTS|FEES\s+IN\s+OTHER\s+COURTS[^\n]*|MISCELLANEOUS\s+FINANCIAL\s+PROVISIONS|GENERAL\s+DEFINITIONS|MISCELLANEOUS|PART\s+V\s+INFORMATION[^\n]*|PART\s+III\s+SUPPLEMENTAL[^\n]*|SUITS\s+RELATING\s+TO\s+LAND[^\n]*|ON\s+PROOF|FACTS\s+WHICH\s+NEED\s+NOT\s+BE\s+PROVED|OF\s+DOCUMENTARY\s+EVIDENCE|JURISDICTION\s+OF\s+COURTS|CORPORATE\s+LAW\s+AUTHORITY|AUDIT|MEETINGS\s+AND\s+PROCEEDINGS|ARBITRATION\s+WITHOUT\s+INTERVENTION[^\n]*|Statement\s+of\s+Objects\s+and\s+Reasons[^\n]*|Reasons,?\s+see\s+Gazette[^\n]*|For\s+Statement[^\n]*|Limitation\s+of\s+(?:Shits|Suits)[^\n]*|An\s+Act\s+to\s+consolidate[^\n]*|It\s+has\s+been\s+declared[^\n]*|see\s+N\.W\.F\.P\.[^\n]*|Distribution\s+where[^\n]*|SERVICE\s+AND\s+AUTHENTICATION[^\n]*|INCORPORATION\s+OF\s+COMPANIES[^\n]*|Of\s+Currency[^\n]*|OF\s+THE\s+CONSTITUTION\s+OF\s+CRIMINAL\s+COURTS[^\n]*|CONSTITUTION\s+AND\s+POWERS\s+OF\s+CRIMINAL\s+COURTS[^\n]*|[A-Z]\.\s+CLAUSSES\s+OF\s+CRIMINAL\s+COURTS[^\n]*|PLACE\s+OF\s+SUING|OF\s+SUING|(?:It\s+is\s+hereby\s+)?enacted\s+as\s+follows[^\n]*|(?:NOW,\s*THEREFORE|in\s+exercise\s+of\s+the\s+powers)[^\n]*)\n+/i.test(
        clean
      )
    ) {
      clean = clean.replace(
        /^[\-:\s]*(?:PART\s*(?:--?|\.)?\s*[IVXLCDM0-9\-]+[^\n]*|CHAPTER\s*(?:--?|\.)?\s*[IVXLCDM0-9\-]+[^\n]*|ORDER\s*(?:--?|\.)?\s*[IVXLCDM0-9\-]+[^\n]*|PRELIMINARY|INTRODUCTION|INTRODUCTORY|PLATING|PLEADING|THE\s+JUDICATURE|THE\s+HIGH\s+COURTS|OFFENCES\s+AND\s+PUNISHMENTS|FEES\s+IN\s+OTHER\s+COURTS[^\n]*|MISCELLANEOUS\s+FINANCIAL\s+PROVISIONS|GENERAL\s+DEFINITIONS|MISCELLANEOUS|PART\s+V\s+INFORMATION[^\n]*|PART\s+III\s+SUPPLEMENTAL[^\n]*|SUITS\s+RELATING\s+TO\s+LAND[^\n]*|ON\s+PROOF|FACTS\s+WHICH\s+NEED\s+NOT\s+BE\s+PROVED|OF\s+DOCUMENTARY\s+EVIDENCE|JURISDICTION\s+OF\s+COURTS|CORPORATE\s+LAW\s+AUTHORITY|AUDIT|MEETINGS\s+AND\s+PROCEEDINGS|ARBITRATION\s+WITHOUT\s+INTERVENTION[^\n]*|Statement\s+of\s+Objects\s+and\s+Reasons[^\n]*|Reasons,?\s+see\s+Gazette[^\n]*|For\s+Statement[^\n]*|Limitation\s+of\s+(?:Shits|Suits)[^\n]*|An\s+Act\s+to\s+consolidate[^\n]*|It\s+has\s+been\s+declared[^\n]*|see\s+N\.W\.F\.P\.[^\n]*|Distribution\s+where[^\n]*|SERVICE\s+AND\s+AUTHENTICATION[^\n]*|INCORPORATION\s+OF\s+COMPANIES[^\n]*|Of\s+Currency[^\n]*|OF\s+THE\s+CONSTITUTION\s+OF\s+CRIMINAL\s+COURTS[^\n]*|CONSTITUTION\s+AND\s+POWERS\s+OF\s+CRIMINAL\s+COURTS[^\n]*|[A-Z]\.\s+CLAUSSES\s+OF\s+CRIMINAL\s+COURTS[^\n]*|PLACE\s+OF\s+SUING|OF\s+SUING|(?:It\s+is\s+hereby\s+)?enacted\s+as\s+follows[^\n]*|(?:NOW,\s*THEREFORE|in\s+exercise\s+of\s+the\s+powers)[^\n]*)\n+/i,
        ""
      );
    }
  }

  // Strip residual leading punctuation like ". ", "- ", ": "
  clean = clean.replace(/^[\.\:\-\s—]+\s*(?=[A-Za-z0-9\"\'\(\[])/, "");

  return clean.trim();
}

/**
 * Stage 2: Section Number & In-line Title Normalizer
 */
export function normalizeSectionPrefixAndHeading(text: string, title?: string): string {
  if (!text) return "";
  let clean = text.trim();

  // Strip duplicate leading section title line if it matches or echoes the title
  if (title) {
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const leadingTitleRegex = new RegExp(`^${escapedTitle}\\s*\\n+`, "i");
    clean = clean.replace(leadingTitleRegex, "");

    // Also strip "1. Title of the section. Body..." if it starts with the title
    const inlineTitleRegex = new RegExp(`^(?:(?:Section|Sec\\.|Article|Art\\.|Order|Rule|S\\.)\\s*)?[0-9]+[A-Za-z\\-]*\\.\\s*${escapedTitle}[\\.\\:\\-\\s—]+`, "i");
    clean = clean.replace(inlineTitleRegex, "");
  }

  // Strip general first line if it's identical to the in-line heading
  clean = clean.replace(/^([A-Z][\w\s,\-\(\)\/]{2,80})\n+\1\b/i, "$1");

  // Strip leading footnote brackets like [2][60][ before section numbers
  clean = clean.replace(/^(?:\[\d+\])+\s*(?=\d+\.)/, "");

  // Strip in-line section header with explicit delimiter like .---, .--, :---, :--, ---, --, :-, —, or long dash
  clean = clean.replace(
    /^(?:(?:Section|Sec\.|Article|Art\.|Order|Rule|S\.)\s*)?[0-9]+[A-Za-z\-]*\.\s*(?:[A-Z\d][\w\s,\-\(\)\/]{1,160}?(?:\.---|\.--|:---|:--|---|--|\:\-|\s*—\s*|\s*----\s*))(?=\s*(?:\([0-9a-zA-Z]+\)|[A-Z0-9\"\'\[]))/i,
    ""
  );

  // Strip in-line section header with soft delimiter (. / : / -) if followed by subclause OR standard legal clause starter
  clean = clean.replace(
    /^(?:(?:Section|Sec\.|Article|Art\.|Order|Rule|S\.)\s*)?[0-9]+[A-Za-z\-]*\.\s*(?:[A-Z\d][\w\s,\-\(\)\/]{1,120}?(?:\.\s+|\:\s+|\-\s+))(?=\s*(?:\([0-9a-zA-Z]+\)|Whoever\b|Every\s+person\b|Any\s+person\b|No\s+person\b|This\s+Act\b|For\s+the\s+purposes\b|In\s+this\b|Where\b|When\b|If\b|All\b|The\s+Court\b|A\s+person\b))/i,
    ""
  );

  // Strip bare section number prefix (e.g. "1. (1)" -> "(1)" or "1. ")
  clean = clean.replace(/^(?:(?:Section|Sec\.|Article|Art\.|S\.)\s*)?[0-9]+[A-Za-z\-]*\.\s*(?=\([0-9a-zA-Z]+\)|[A-Z0-9\"\'\[])/, "");

  // Normalize "S. 2(2) 'decree'" -> "(2) 'decree'"
  clean = clean.replace(/^S\.\s*([0-9]+[A-Za-z\-]*\s*)?\(([0-9a-zA-Z]+)\)/i, "($2)");
  clean = clean.replace(/\nS\.\s*([0-9]+[A-Za-z\-]*\s*)?\(([0-9a-zA-Z]+)\)/gi, "\n($2)");

  // Strip residual leading punctuation
  clean = clean.replace(/^[\.\:\-\s—]+\s*(?=[A-Za-z0-9\"\'\(\[])/, "");

  return clean.trim();
}

/**
 * Stage 3: Typographic, OCR & Broken Line-Wrap Repairer
 */
export function repairTypographyAndLineWraps(text: string): string {
  if (!text) return "";
  let clean = text;

  // 1. Unicode Normalization
  clean = clean.replace(/\u00a0/g, " "); // Non-breaking space
  clean = clean.replace(/[\u2011\u2012]/g, "-"); // Non-breaking hyphen
  clean = clean.replace(/[\u2018\u2019]/g, "'"); // Smart single quotes
  clean = clean.replace(/[\u201c\u201d]/g, '"'); // Smart double quotes
  clean = clean.replace(/\u2013/g, "-"); // En-dash
  clean = clean.replace(/\u2014/g, "—"); // Em-dash

  // 2. OCR Corrections
  clean = clean.replace(/\bLimitation\s+of\s+Shits\b/gi, "Limitation of Suits");
  clean = clean.replace(/\bsail\s+w\s+make\s+proposal\b/gi, "said to make a proposal");
  clean = clean.replace(/\bA;s\s+proposal\b/gi, "A's proposal");
  clean = clean.replace(/\bproper,\s*but\s+not\s+afterwards\b/gi, "proposer, but not afterwards");
  clean = clean.replace(/\bat\s+the\s+opinion\s+of\s+one\s+or\s+more\b/gi, "at the option of one or more");
  clean = clean.replace(/\ba\s+contractor\s+which\s+ceases\b/gi, "a contract which ceases");
  clean = clean.replace(/\barty\s+time\b/gi, "any time");
  clean = clean.replace(/\bPakitan\b/gi, "Pakistan");
  clean = clean.replace(/\bfrotn\b/gi, "from");
  clean = clean.replace(/\bcompete\s+as\s+against\b/gi, "complete as against");
  clean = clean.replace(/\belectron\s+or\s+device\b/gi, "electronic device");
  clean = clean.replace(/\bmanger\b/gi, "manager");
  clean = clean.replace(/\bBaluchistan\b/gi, "Balochistan");
  clean = clean.replace(/\bNorth\s+West\s+Frontier\b/gi, "Khyber Pakhtunkhwa");

  // 3. Fix OCR alphanumeric digit misreads: (l) -> (1), (I) -> (1)
  // Preserves lowercase Roman numeral subclauses like (i), (ii), (iii)
  clean = clean.replace(/^\([lI]\)\s+/gm, "(1) ");
  clean = clean.replace(/\n\([lI]\)\s+/gm, "\n(1) ");

  // 4. Broken Line-Wrap Joiner
  // Re-join hyphenated words split across lines: "re-\nopens" -> "re-opens"
  clean = clean.replace(/(\b[a-zA-Z]+)-\n([a-zA-Z]+\b)/g, "$1-$2");

  // Re-join sentences broken by mid-sentence hard newlines
  // Only join if the line does NOT end with a period, colon, semicolon or quote,
  // and the next line does NOT start with a list bullet, parenthesis, or uppercase section header
  const lines = clean.split("\n");
  const merged: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const curr = lines[i].trim();
    if (!curr) {
      merged.push("");
      continue;
    }

    if (merged.length > 0) {
      const prev = merged[merged.length - 1];
      const isPrevEnding = /[.:;!?—]["']?$/.test(prev) || prev === "";
      const isCurrListOrHeader = /^(?:\([0-9a-zA-Z]+\)|[0-9]+\.|\([a-z]\)|[A-Z\s]{3,}:|Illustrations|Explanation|Notes:|Exception|Clause\s*\([0-9]+\))/i.test(
        curr
      );

      if (!isPrevEnding && !isCurrListOrHeader && prev !== "") {
        merged[merged.length - 1] = `${prev} ${curr}`;
        continue;
      }
    }

    merged.push(curr);
  }

  return merged.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Stage 4: Structural AST Segmenter
 */
export function segmentStatuteAST(text: string): StatuteAST {
  if (!text) {
    return {
      cleanText: "",
      illustrations: [],
      proceduralNotes: [],
      amendmentNotes: [],
    };
  }

  const lines = text.split("\n");
  const cleanBodyLines: string[] = [];
  const illustrations: string[] = [];
  const proceduralNotes: string[] = [];
  const amendmentNotes: string[] = [];
  let punishment: string | undefined = undefined;

  let currentMode: "body" | "illustrations" | "notes" | "amendments" = "body";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentMode === "body") cleanBodyLines.push("");
      continue;
    }

    // 1. Detect Illustrations Section
    if (/^Illustrations?\b/i.test(trimmed)) {
      currentMode = "illustrations";
      continue;
    }

    // 2. Detect Judicial & Case-Law Notes Section
    if (/^(?:Notes?|Judicial\s+Notes?|Case\s*Law|Commentary)\s*:/i.test(trimmed)) {
      currentMode = "notes";
      const noteContent = trimmed.replace(/^(?:Notes?|Judicial\s+Notes?|Case\s*Law|Commentary)\s*:\s*/i, "");
      if (noteContent) proceduralNotes.push(noteContent);
      continue;
    }

    // 3. Detect Legislative Amendment Footnotes (must start with bracket or footnote marker)
    const isAmendmentLine =
      // 1. Bracketed amendment notes: e.g. [Subs. by...], [Added by...], [1. Subs. by...]
      /^\[\s*(?:subs\b\.?|added|inserted|omitted|deleted|substituted|rep\.)/i.test(trimmed) ||
      /^[0-9]+\.?\s*\[\s*(?:subs\b\.?|added|inserted|omitted|deleted|substituted)/i.test(trimmed) ||
      // 2. Numbered footnote markers: e.g. 1. Subs. by..., 18. The words "..." omitted by..., 1. Words Baluchistan substituted by...
      /^[0-9]+\.\s*(?:Subs\b\.?|Added\s+by|Inserted\s+by|Omitted\s+by|Deleted\s+by|Substituted\s+by|Rep\b\.?\s+by|Re-numbered|Words?\b|The\s+words?\b|Proviso\b|Explanation\b|Sub-section\b|Clause\b|Section\b)/i.test(trimmed) ||
      // 3. Direct unnumbered amendment notes: e.g. Subs. by Ord..., Omitted by Act..., Inserted by Federal...
      /^(?:Subs\b\.?|Omitted\s+by|Inserted\s+by|Added\s+by|Substituted\s+by|Deleted\s+by|Rep\b\.?\s+by)\s+(?:Ord\.|Act|A\.O\.|Federal|P\.O\.|the\b|[0-9]+)/i.test(trimmed) ||
      // 4. Clause/Section level amendment notes: e.g. Clause (2) subs. by..., Sub-section (1) added by...
      /^(?:Clause|Section|Article|Sub-section|Proviso|Paragraph|Para)\s*(?:\([0-9a-zA-Z]+\)|[0-9]+)?\s+(?:subs\b\.?|added|inserted|omitted|deleted|substituted)/i.test(trimmed) ||
      // 5. Ibid references: e.g. [Subs. Ibid., ...], [Added Ibid...]
      /^\[\s*(?:Subs|Inserted|Added|Omitted|Substituted)\s+Ibid/i.test(trimmed) ||
      // 6. Cross-reference markers: e.g. 1. See..., 2. Vide..., 3. Ins...
      /^[0-9]+\.\s*(?:See|Vide|Ref\b\.?|Ins\b\.?|Amended\s+by)\b/i.test(trimmed);

    if (isAmendmentLine) {
      currentMode = "amendments";
      amendmentNotes.push(trimmed);
      continue;
    }

    // Process line according to active mode
    if (currentMode === "illustrations") {
      if (/^\([a-z]\)\s+/i.test(trimmed) || illustrations.length === 0) {
        illustrations.push(trimmed);
      } else {
        illustrations[illustrations.length - 1] += " " + trimmed;
      }
    } else if (currentMode === "notes") {
      proceduralNotes.push(trimmed);
    } else if (currentMode === "amendments") {
      amendmentNotes.push(trimmed);
    } else {
      // Check for inline punishment description
      if (
        /shall\s+be\s+punished\s+with\s+(?:death|imprisonment|fine|rigorous|simple)/i.test(trimmed) &&
        !punishment
      ) {
        punishment = trimmed;
      }
      cleanBodyLines.push(trimmed);
    }
  }

  let finalCleanText = cleanBodyLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!finalCleanText && amendmentNotes.length > 0) {
    finalCleanText = amendmentNotes.join("\n").trim();
  } else if (!finalCleanText && proceduralNotes.length > 0) {
    finalCleanText = proceduralNotes.join("\n").trim();
  }

  return {
    cleanText: finalCleanText,
    illustrations,
    proceduralNotes,
    amendmentNotes,
    punishment,
  };
}

/**
 * Extracts section title from description when title is not explicitly provided
 */
function extractTitleFromDescription(raw: string): string | undefined {
  const match = raw.match(
    /^(?:(?:Section|Sec\.|Article|Art\.|Order|Rule|S\.)\s*)?[0-9]+[A-Za-z\-]*\.\s*([A-Z][\w\s,\-\(\)\/]{2,120}?)(?:\.---|\.--|:---|:--|---|--|\:\-|\.\s+|\:\s+|\-\s+|\s*—\s*)/m
  );
  if (match && match[1]) {
    return match[1].trim();
  }
  return undefined;
}

/**
 * MASTER ENTRYPOINT: Sanitize Statute Text Pipeline
 * Runs all 4 stages sequentially and returns fully formatted, structured result.
 */
export function sanitizeStatuteText(
  rawText: string,
  statuteName?: string,
  rawSection?: string,
  rawTitle?: string
): SanitizedStatutorySection {
  if (!rawText) {
    return {
      cleanSection: rawSection || "Section",
      cleanTitle: rawTitle || "Statutory Provision",
      cleanText: "",
      illustrations: [],
      proceduralNotes: [],
      amendmentNotes: [],
      rawText: "",
    };
  }

  // Extract or infer clean title
  const extractedTitle = !rawTitle || rawTitle === statuteName ? extractTitleFromDescription(rawText) : rawTitle;
  const cleanTitle = sanitizeSectionTitle(extractedTitle || rawTitle || statuteName || "Statutory Provision");
  const cleanSection = sanitizeSectionNumber(rawSection || "Section", statuteName);

  // Stage 1: Strip Gazette & Macro Preambles
  const stage1 = stripGazetteAndPreambles(rawText);

  // Stage 2: Normalize Section Prefix & In-line Heading
  const stage2 = normalizeSectionPrefixAndHeading(stage1, extractedTitle || rawTitle);

  // Stage 3: Typographic, OCR & Line-Wrap Repair
  const stage3 = repairTypographyAndLineWraps(stage2);

  // Stage 4: Structural AST Segmentation
  const ast = segmentStatuteAST(stage3);

  let finalCleanText = ast.cleanText;
  if (!finalCleanText) {
    finalCleanText = stage1
      .replace(/^[0-9]+[A-Za-z\-]*\.\s*/, "")
      .replace(/^(?:[A-Z\d][\w\s,\-\(\)\/]{1,80}\n+)/, "")
      .trim();
  }

  return {
    cleanSection,
    cleanTitle,
    cleanText: finalCleanText,
    illustrations: ast.illustrations,
    proceduralNotes: ast.proceduralNotes,
    amendmentNotes: ast.amendmentNotes,
    punishment: ast.punishment,
    rawText,
  };
}
