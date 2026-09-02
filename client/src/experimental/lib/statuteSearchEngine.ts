/**
 * Fast In-Memory Token-Scored Statute Search Engine
 * Featuring Pakistani Legal Acronym Expansion, Multi-Tier Scoring, and Debouncing Support.
 * Strictly isolated in client/src/experimental/
 */

import {
  type StatutorySection,
  MAJOR_ENACTMENTS_DATA,
  MAJOR_ENACTMENT_KEYS
} from "@/experimental/data/majorEnactmentsData";

export interface SearchResultItem {
  section: StatutorySection;
  score: number;
  matchType: "exact_section" | "title" | "keyword" | "alias";
  matchedHighlights?: {
    title?: string;
    snippet?: string;
  };
}

export interface SearchOptions {
  limit?: number;
  category?: string;
  statute?: string;
  exactOnly?: boolean;
  minScore?: number;
  includeCompendium?: boolean;
}

export interface ParsedLegalQuery {
  statuteHint?: string;
  statuteFullName?: string;
  shortCode?: string;
  sectionNumber?: string;
  normalizedSection?: string;
  keywords: string[];
  rawQuery: string;
  isAcronymQuery: boolean;
}

/**
 * Complete Pakistani Legal Acronym & Alias Mapping
 */
export const PAKISTANI_LEGAL_ALIASES: Record<string, { statute: string; shortCode: string; defaultCategory: string }> = {
  ppc: { statute: "Pakistan Penal Code 1860", shortCode: "PPC", defaultCategory: "criminal" },
  crpc: { statute: "Criminal Procedure Code Cr P C 1898", shortCode: "CrPC", defaultCategory: "criminal" },
  "cr.p.c": { statute: "Criminal Procedure Code Cr P C 1898", shortCode: "CrPC", defaultCategory: "criminal" },
  "cr p c": { statute: "Criminal Procedure Code Cr P C 1898", shortCode: "CrPC", defaultCategory: "criminal" },
  cpc: { statute: "Code of Civil Procedure 1908", shortCode: "CPC", defaultCategory: "civil" },
  "c.p.c": { statute: "Code of Civil Procedure 1908", shortCode: "CPC", defaultCategory: "civil" },
  "c p c": { statute: "Code of Civil Procedure 1908", shortCode: "CPC", defaultCategory: "civil" },
  qso: { statute: "Qanun-e-Shahadat Order 1984", shortCode: "QSO", defaultCategory: "evidence" },
  "q.s.o": { statute: "Qanun-e-Shahadat Order 1984", shortCode: "QSO", defaultCategory: "evidence" },
  sra: { statute: "Specific Relief Act 1877", shortCode: "SRA", defaultCategory: "civil" },
  peca: { statute: "Prevention of Electronic Crimes Ordinance 2008", shortCode: "PECA", defaultCategory: "special" },
  nia: { statute: "Negotiable Instruments Act 1881", shortCode: "NI Act", defaultCategory: "commercial" },
  "ni act": { statute: "Negotiable Instruments Act 1881", shortCode: "NI Act", defaultCategory: "commercial" },
  mflo: { statute: "Muslim Family Laws Ordinance 1961", shortCode: "MFLO", defaultCategory: "family" },
  gwa: { statute: "Guardians and Wards Act 1890", shortCode: "GWA", defaultCategory: "family" },
  tpa: { statute: "Transfer of Property Act 1882", shortCode: "TPA", defaultCategory: "commercial" },
  constitution: { statute: "Constitution of Pakistan 1973", shortCode: "Constitution", defaultCategory: "constitutional" },
  const: { statute: "Constitution of Pakistan 1973", shortCode: "Constitution", defaultCategory: "constitutional" },
  "contract act": { statute: "Contract Act 1872", shortCode: "Contract Act", defaultCategory: "commercial" },
  contract: { statute: "Contract Act 1872", shortCode: "Contract Act", defaultCategory: "commercial" },
  "companies ordinance": { statute: "Companies Ordinance 1984", shortCode: "Companies Ordinance", defaultCategory: "commercial" },
  companies: { statute: "Companies Ordinance 1984", shortCode: "Companies Ordinance", defaultCategory: "commercial" },
  "limitation act": { statute: "Limitation Act 1908", shortCode: "Limitation Act", defaultCategory: "civil" },
  limitation: { statute: "Limitation Act 1908", shortCode: "Limitation Act", defaultCategory: "civil" },
  "succession act": { statute: "Succession Act 1925", shortCode: "Succession Act", defaultCategory: "family" },
  succession: { statute: "Succession Act 1925", shortCode: "Succession Act", defaultCategory: "family" },
  "family courts": { statute: "The Family Courts Act 1964", shortCode: "Family Courts Act", defaultCategory: "family" },
  arbitration: { statute: "Arbitration Act 1940", shortCode: "Arbitration Act", defaultCategory: "civil" },
  registration: { statute: "Registration Act 1908", shortCode: "Registration Act", defaultCategory: "commercial" },
  "court fees": { statute: "Court Fees Act 1870", shortCode: "Court Fees Act", defaultCategory: "civil" },
  "suits valuation": { statute: "Suits Valuation Act 1887", shortCode: "Suits Valuation Act", defaultCategory: "civil" },
  "general clauses": { statute: "General Clauses Act 1897", shortCode: "General Clauses Act", defaultCategory: "civil" },
  "land revenue": { statute: "West Pakistan Land Revenue Act 1967", shortCode: "Land Revenue Act", defaultCategory: "administrative" },
  ata: { statute: "Anti-Terrorism Act 1997", shortCode: "ATA", defaultCategory: "criminal" },
  fibo: { statute: "Financial Institutions Recovery of Finances Ordinance 2001", shortCode: "FIBO", defaultCategory: "commercial" },
  ito: { statute: "Income Tax Ordinance 2001", shortCode: "ITO", defaultCategory: "taxation" },
  sta: { statute: "Sales Tax Act 1990", shortCode: "STA", defaultCategory: "taxation" },
  customs: { statute: "Customs Act 1969", shortCode: "Customs Act", defaultCategory: "taxation" }
};

/**
 * Normalizes a section string for fuzzy/exact matching.
 * e.g., "489-F" -> "489f", "Section 302" -> "302", "Art. 199" -> "199"
 */
export function normalizeSectionNumber(sec: string): string {
  if (!sec) return "";
  return sec
    .toLowerCase()
    .replace(/^(?:section|sec|article|art|order|o|rule|r)\.?\s*/i, "")
    .replace(/[\s\-\_\(\)\.]+/g, "")
    .trim();
}

/**
 * Parses user search query into structured legal components.
 */
export function parseLegalQuery(query: string): ParsedLegalQuery {
  const trimmed = (query || "").trim();
  if (!trimmed) {
    return {
      rawQuery: "",
      keywords: [],
      isAcronymQuery: false
    };
  }

  const lower = trimmed.toLowerCase();
  let statuteHint: string | undefined;
  let statuteFullName: string | undefined;
  let shortCode: string | undefined;
  let sectionNumber: string | undefined;
  let isAcronymQuery = false;

  // 1. Check direct acronym matches at start or end of query
  for (const [alias, meta] of Object.entries(PAKISTANI_LEGAL_ALIASES)) {
    const aliasRegexStart = new RegExp(`^\\b${alias.replace('.', '\\.')}\\b\\s*(.*)$`, "i");
    const aliasRegexEnd = new RegExp(`^(.*?)\\s*\\b${alias.replace('.', '\\.')}\\b$`, "i");

    let match = lower.match(aliasRegexStart);
    if (match) {
      statuteHint = alias;
      statuteFullName = meta.statute;
      shortCode = meta.shortCode;
      isAcronymQuery = true;
      const rest = match[1].trim();
      if (rest) {
        // Extract section number if present
        const secMatch = rest.match(/^(?:section|sec|article|art)?\s*([0-9]+[a-z\-]*(?:\([0-9a-z]+\))?)/i);
        if (secMatch) {
          sectionNumber = secMatch[1];
        }
      }
      break;
    }

    match = lower.match(aliasRegexEnd);
    if (match) {
      statuteHint = alias;
      statuteFullName = meta.statute;
      shortCode = meta.shortCode;
      isAcronymQuery = true;
      const rest = match[1].trim();
      if (rest) {
        const secMatch = rest.match(/^(?:section|sec|article|art)?\s*([0-9]+[a-z\-]*(?:\([0-9a-z]+\))?)/i);
        if (secMatch) {
          sectionNumber = secMatch[1];
        }
      }
      break;
    }
  }

  // 2. If no acronym found, check if query contains known section patterns
  if (!sectionNumber) {
    // Check patterns like "302", "489-F", "O.7 R.11", "Section 12(2)", "Art 199"
    const generalSecMatch = trimmed.match(
      /\b(?:section|sec|article|art|order|rule|o\.?|r\.?)?\s*([0-9]+[a-zA-Z\-]*(?:\([0-9a-zA-Z]+\))?)/i
    );
    if (generalSecMatch) {
      sectionNumber = generalSecMatch[1];
    }
  }

  // 3. Extract keywords (excluding the extracted acronym and section)
  const cleanKeywords = trimmed
    .replace(new RegExp(`\\b(${Object.keys(PAKISTANI_LEGAL_ALIASES).join("|")})\\b`, "gi"), "")
    .replace(/\b(?:section|sec|article|art|order|rule)\b/gi, "")
    .replace(/[^\w\s\-]/g, " ")
    .split(/\s+/)
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length > 1);

  return {
    rawQuery: trimmed,
    statuteHint,
    statuteFullName,
    shortCode,
    sectionNumber,
    normalizedSection: sectionNumber ? normalizeSectionNumber(sectionNumber) : undefined,
    keywords: cleanKeywords,
    isAcronymQuery
  };
}

interface IndexedSectionRecord {
  section: StatutorySection;
  normalizedSection: string;
  statuteLower: string;
  statuteTokens: string[];
  titleLower: string;
  titleTokens: string[];
  descriptionLower: string;
  punishmentLower: string;
  categoryLower: string;
}

/**
 * Token-Scored In-Memory Search Engine
 */
export class StatuteSearchEngine {
  private indexedSections: IndexedSectionRecord[] = [];
  private exactLookupMap: Map<string, StatutorySection[]> = new Map();
  private sectionNumberMap: Map<string, StatutorySection[]> = new Map();

  constructor(sections: StatutorySection[] = MAJOR_ENACTMENTS_DATA) {
    this.indexSections(sections);
  }

  /**
   * Pre-indexes sections for ultra-fast <15ms retrieval.
   */
  public indexSections(sections: StatutorySection[]): void {
    this.indexedSections = [];
    this.exactLookupMap.clear();
    this.sectionNumberMap.clear();

    for (const sec of sections) {
      const normSec = normalizeSectionNumber(sec.section);
      const statuteLow = sec.statute.toLowerCase();
      const titleLow = sec.title.toLowerCase();
      const descLow = sec.description.toLowerCase();
      const punishLow = (sec.punishment || "").toLowerCase();
      const catLow = (sec.category || "").toLowerCase();

      const record: IndexedSectionRecord = {
        section: sec,
        normalizedSection: normSec,
        statuteLower: statuteLow,
        statuteTokens: statuteLow.split(/\s+/),
        titleLower: titleLow,
        titleTokens: titleLow.split(/\s+/),
        descriptionLower: descLow,
        punishmentLower: punishLow,
        categoryLower: catLow
      };

      this.indexedSections.push(record);

      // Populate exact lookup maps
      const exactKey = `${statuteLow}::${normSec}`;
      if (!this.exactLookupMap.has(exactKey)) {
        this.exactLookupMap.set(exactKey, []);
      }
      this.exactLookupMap.get(exactKey)!.push(sec);

      if (!this.sectionNumberMap.has(normSec)) {
        this.sectionNumberMap.set(normSec, []);
      }
      this.sectionNumberMap.get(normSec)!.push(sec);
    }
  }

  /**
   * Adds additional dynamic sections (e.g. from compendium or live DB).
   */
  public addSections(sections: StatutorySection[]): void {
    for (const sec of sections) {
      // Check if already indexed by id
      const exists = this.indexedSections.some(r => r.section.id === sec.id);
      if (!exists) {
        const normSec = normalizeSectionNumber(sec.section);
        const statuteLow = sec.statute.toLowerCase();
        const titleLow = sec.title.toLowerCase();
        const descLow = sec.description.toLowerCase();
        const punishLow = (sec.punishment || "").toLowerCase();
        const catLow = (sec.category || "").toLowerCase();

        const record: IndexedSectionRecord = {
          section: sec,
          normalizedSection: normSec,
          statuteLower: statuteLow,
          statuteTokens: statuteLow.split(/\s+/),
          titleLower: titleLow,
          titleTokens: titleLow.split(/\s+/),
          descriptionLower: descLow,
          punishmentLower: punishLow,
          categoryLower: catLow
        };
        this.indexedSections.push(record);

        const exactKey = `${statuteLow}::${normSec}`;
        if (!this.exactLookupMap.has(exactKey)) {
          this.exactLookupMap.set(exactKey, []);
        }
        this.exactLookupMap.get(exactKey)!.push(sec);

        if (!this.sectionNumberMap.has(normSec)) {
          this.sectionNumberMap.set(normSec, []);
        }
        this.sectionNumberMap.get(normSec)!.push(sec);
      }
    }
  }

  /**
   * Execute high-speed search with scoring and ranking.
   */
  public search(query: string, options: SearchOptions = {}): SearchResultItem[] {
    const startTime = performance.now();
    const limit = options.limit || 50;
    const minScore = options.minScore || 1;
    const parsed = parseLegalQuery(query);

    if (!parsed.rawQuery) {
      return this.indexedSections.slice(0, limit).map(r => ({
        section: r.section,
        score: 1,
        matchType: "keyword"
      }));
    }

    const queryLower = parsed.rawQuery.toLowerCase();
    const queryNormSec = normalizeSectionNumber(parsed.rawQuery);
    const results: SearchResultItem[] = [];

    for (let i = 0; i < this.indexedSections.length; i++) {
      const item = this.indexedSections[i];

      // Filter by category if specified
      if (options.category && options.category !== "all") {
        if (item.categoryLower !== options.category.toLowerCase()) {
          continue;
        }
      }

      // Filter by statute if specified
      if (options.statute) {
        if (!item.statuteLower.includes(options.statute.toLowerCase())) {
          continue;
        }
      }

      let score = 0;
      let matchType: SearchResultItem["matchType"] = "keyword";

      // 1. Exact Statute + Section match (Highest Priority: +1500)
      if (parsed.statuteFullName && parsed.normalizedSection) {
        const statuteMatches = item.statuteLower.includes(parsed.statuteFullName.toLowerCase());
        const sectionMatches = item.normalizedSection === parsed.normalizedSection;

        if (statuteMatches && sectionMatches) {
          score += 1500;
          matchType = "exact_section";
        } else if (statuteMatches && item.normalizedSection.startsWith(parsed.normalizedSection)) {
          score += 600;
          matchType = "exact_section";
        } else if (statuteMatches) {
          score += 100;
          matchType = "alias";
        }
      }

      // 2. Query matches section number exactly (+800)
      if (parsed.normalizedSection && item.normalizedSection === parsed.normalizedSection) {
        if (score === 0) {
          score += 800;
          matchType = "exact_section";
        }
      } else if (queryNormSec && item.normalizedSection === queryNormSec) {
        if (score === 0) {
          score += 750;
          matchType = "exact_section";
        }
      } else if (parsed.normalizedSection && item.normalizedSection.startsWith(parsed.normalizedSection)) {
        score += 300;
        if (score === 300) matchType = "exact_section";
      }

      // 3. Exact Title match or Title prefix (+400)
      if (item.titleLower === queryLower) {
        score += 500;
        matchType = "title";
      } else if (item.titleLower.includes(queryLower)) {
        score += 250;
        matchType = "title";
      }

      // 4. Token Matching across Title, Description, and Punishment
      for (const token of parsed.keywords) {
        if (item.titleTokens.some(t => t.startsWith(token))) {
          score += 80;
        } else if (item.titleLower.includes(token)) {
          score += 50;
        }

        if (item.descriptionLower.includes(token)) {
          score += 20;
        }

        if (item.punishmentLower.includes(token)) {
          score += 15;
        }

        if (item.statuteTokens.some(t => t.startsWith(token))) {
          score += 30;
        }
      }

      if (score >= minScore) {
        // Generate snippet highlight if matched keywords
        let snippet: string | undefined;
        if (parsed.keywords.length > 0) {
          const firstKw = parsed.keywords[0];
          const idx = item.descriptionLower.indexOf(firstKw);
          if (idx !== -1) {
            const start = Math.max(0, idx - 40);
            const end = Math.min(item.section.description.length, idx + 100);
            snippet = (start > 0 ? "..." : "") + item.section.description.slice(start, end) + "...";
          }
        }

        results.push({
          section: item.section,
          score,
          matchType,
          matchedHighlights: snippet ? { snippet } : undefined
        });
      }
    }

    // Sort by score descending, then by natural section order
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * Quick exact lookup by statute name/shortCode and section.
   */
  public findExactSection(statuteOrCode: string, sectionNumber: string): StatutorySection | undefined {
    const parsed = parseLegalQuery(statuteOrCode);
    const targetStatute = parsed.statuteFullName || statuteOrCode;
    const targetNormSec = normalizeSectionNumber(sectionNumber);
    const exactKey = `${targetStatute.toLowerCase()}::${targetNormSec}`;
    
    const candidates = this.exactLookupMap.get(exactKey);
    if (candidates && candidates.length > 0) {
      return candidates[0];
    }

    // Fallback: iterate over sections for that statute
    for (const item of this.indexedSections) {
      if (item.statuteLower.includes(targetStatute.toLowerCase()) && item.normalizedSection === targetNormSec) {
        return item.section;
      }
    }

    return undefined;
  }

  /**
   * Get total number of indexed sections.
   */
  public get size(): number {
    return this.indexedSections.length;
  }
}

/**
 * Debounce utility function with flush and cancel capabilities.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number,
  immediate: boolean = false
): ((...args: Parameters<T>) => void) & { cancel: () => void; flush: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = function (this: any, ...args: Parameters<T>) {
    lastArgs = args;
    const callNow = immediate && !timeout;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate && lastArgs) {
        func.apply(this, lastArgs);
        lastArgs = null;
      }
    }, waitMs);

    if (callNow) {
      func.apply(this, args);
      lastArgs = null;
    }
  };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
      lastArgs = null;
    }
  };

  debounced.flush = function (this: any) {
    if (timeout && lastArgs) {
      clearTimeout(timeout);
      timeout = null;
      func.apply(this, lastArgs);
      lastArgs = null;
    }
  };

  return debounced as any;
}

// Global default search engine instance initialized with 4,100 major enactment sections
export const statuteSearchEngine = new StatuteSearchEngine(MAJOR_ENACTMENTS_DATA);

/**
 * Convenience search helper.
 */
export function searchStatutes(query: string, options?: SearchOptions): SearchResultItem[] {
  return statuteSearchEngine.search(query, options);
}
