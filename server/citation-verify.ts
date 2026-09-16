/**
 * Citation verification, shared by the MCP protocol tools (server/mcp-server.ts)
 * and the REST endpoints under /api/mcp/* (server/routes.ts).
 *
 * Both surfaces answer the same questions and must answer them identically:
 * does this citation name a real judgment, and is the text stored under it
 * actually that judgment's own? Keeping two copies is how one of them drifts
 * back to serving another case's judgment as fact.
 */
import { db } from "./db";
import { judgments, lawJournals } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Universal Pakistani citation normalizer.
 * Converts any citation format (journal-first, year-first, dots, brackets,
 * court-seat codes) into canonical search variants that match the DB.
 *
 * Examples:
 *   "PLD 2013 SC 793"        → ["PLD2013793", "2013PLD793"]
 *   "P Cr. L J 2021 1124"    → ["PCRLJ20211124", "2021PCRLJ1124"]
 *   "PLC (C.S.) 2020 1267"   → ["PLCCS20201267", "2020PLCCS1267"]
 *   "YLR Notes 2023 52"      → ["YLRN202352", "2023YLRN52"]
 *   "2024 SCMR 128"          → ["2024SCMR128", "SCMR2024128"]
 */
export function normalizeCitation(raw: string): string[] {
  let s = raw.toUpperCase().trim();

  // Step 1: Normalize journal aliases BEFORE stripping punctuation
  // Order matters: longer patterns first to avoid partial matches

  // PCrLJ Note variants → PCRLJN
  s = s.replace(/P\s*\.?\s*CR?\s*\.?\s*L\s*\.?\s*J\s*\.?\s*N(?:OTES?)?/gi, 'PCRLJN');
  // PCrLJ variants → PCRLJ
  s = s.replace(/P\s*\.?\s*CR?\s*\.?\s*L\s*\.?\s*J\b/gi, 'PCRLJ');

  // PLC(CS) Note variants → PLCCSN
  s = s.replace(/PLC\s*\(?\s*C\.?\s*S\.?\s*\)?\s*N(?:OTES?)?\s*/gi, 'PLCCSN ');
  // PLC(CS) variants → PLCCS
  s = s.replace(/PLC\s*\(?\s*C\.?\s*S\.?\s*\)?\s*/gi, 'PLCCS ');

  // YLR Note → YLRN
  s = s.replace(/Y\.?\s*L\.?\s*R\.?\s*N(?:OTES?)?/gi, 'YLRN');
  // CLC Note → CLCN
  s = s.replace(/C\.?\s*L\.?\s*C\.?\s*N(?:OTES?)?/gi, 'CLCN');
  // PLC Note → PLCN
  s = s.replace(/PLC\s*N(?:OTES?)?/gi, 'PLCN');

  // Dotted journal codes → canonical
  s = s.replace(/S\.?\s*C\.?\s*M\.?\s*R\.?/gi, 'SCMR');
  s = s.replace(/P\.?\s*L\.?\s*D\.?/gi, 'PLD');
  s = s.replace(/G\.?\s*B\.?\s*L\.?\s*R\.?/gi, 'GBLR');
  s = s.replace(/P\.?\s*S\.?\s*C\.?/gi, 'PSC');

  // Step 2: Strip all remaining dots, brackets, commas
  s = s.replace(/[.,()[\]]/g, '');

  // Step 3: Strip court-seat codes (multi-word first, then single-word)
  const COURT_SEATS = [
    'SUPREME COURT OF PAKISTAN', 'SUPREME COURT',
    'LAHORE HIGH COURT', 'SINDH HIGH COURT', 'PESHAWAR HIGH COURT',
    'BALOCHISTAN HIGH COURT', 'ISLAMABAD HIGH COURT',
    'HIGH COURT',
  ];
  for (const seat of COURT_SEATS) {
    s = s.replace(new RegExp(seat, 'gi'), ' ');
  }
  const SINGLE_SEATS = [
    'LAHORE', 'LAH', 'KARACHI', 'KAR', 'SINDH', 'PESHAWAR', 'PESH',
    'BALOCHISTAN', 'ISLAMABAD', 'QUETTA', 'MULTAN', 'RAWALPINDI',
    'BAHAWALPUR', 'ABBOTTABAD', 'FAISALABAD', 'HYDERABAD', 'SUKKUR',
  ];
  // Only strip standalone "SC" if it's NOT part of SCMR/PSC
  s = s.replace(/\bSC\b(?!MR)/g, ' ');
  for (const seat of SINGLE_SEATS) {
    s = s.replace(new RegExp(`\\b${seat}\\b`, 'gi'), ' ');
  }

  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();

  // Step 4: Extract year + journal + page and build search variants
  const variants: string[] = [];

  // Try stripped version (all spaces removed)
  const fullyStripped = s.replace(/\s+/g, '');
  variants.push(fullyStripped);

  // Detect journal-first: JOURNAL YEAR PAGE (e.g. "PLD 2013 793" or "PCRLJ 2021 1124")
  const journalFirst = s.match(/^([A-Z]+)\s+(\d{4})\s+(.+)$/);
  if (journalFirst) {
    const [, journal, year, rest] = journalFirst;
    const flipped = `${year}${journal}${rest.replace(/\s+/g, '')}`;
    if (!variants.includes(flipped)) variants.push(flipped);
  }

  // Detect year-first: YEAR JOURNAL PAGE (e.g. "2013 PLD 793")
  const yearFirst = s.match(/^(\d{4})\s+([A-Z]+)\s+(.+)$/);
  if (yearFirst) {
    const [, year, journal, rest] = yearFirst;
    const flipped = `${journal}${year}${rest.replace(/\s+/g, '')}`;
    if (!variants.includes(flipped)) variants.push(flipped);
  }

  // Deduplicate
  return [...new Set(variants)];
}

// Journal codes accepted in a Pakistani citation (dots are stripped before matching).
const CITATION_JOURNALS = "PLD|SCMR|YLR|MLD|CLC|PLJ|NLR|PCRLJ|PCrLJ|PTCL|PTD|PLCCS|PLC|PSC|ALD|KLR|SLS|GBLR|CLD|AIR";
// Court-seat tokens that may sit between the year and the page number.
const CITATION_SEATS = "SC|Supreme Court|Lahore|Lah|Karachi|Kar|Sindh|Peshawar|Pesh|Balochistan|Islamabad|Quetta|Multan|Rawalpindi|Bahawalpur|Abbottabad|Faisalabad|Hyderabad|Sukkur";

/**
 * Pull every citation-shaped token out of a free-text RAG context blob.
 * Dots are stripped first so "P.Cr.L.J" / "P.L.D" match too.
 */
export function extractCitations(text: string): string[] {
  const flat = String(text || "").replace(/\./g, "");
  const out = new Set<string>();
  const patterns = [
    // year-first: 2001 SCMR 1986
    new RegExp(`\\b(?:19|20)\\d{2}\\s*(?:${CITATION_JOURNALS})\\s*(?:\\([^)]{1,20}\\)\\s*)?\\d{1,5}\\b`, "gi"),
    // journal-first: PLD 2013 SC 793
    new RegExp(`\\b(?:${CITATION_JOURNALS})\\s*(?:19|20)\\d{2}\\s*(?:\\([^)]{1,20}\\)\\s*)?(?:${CITATION_SEATS})?\\s*\\d{1,5}\\b`, "gi"),
  ];
  for (const re of patterns) {
    for (const m of flat.matchAll(re)) {
      const c = m[0].replace(/\s+/g, " ").trim();
      if (c) out.add(c);
    }
  }
  return [...out];
}

/**
 * Confirm each citation actually exists in the `judgments` table.
 * Exact normalized match only — never LIKE, which binds to the wrong case.
 * Returns raw citation -> judgment UUID for the ones that are real.
 */
export async function verifyCitations(raws: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (const raw of raws) {
    const match = await resolveJudgment(raw, { id: judgments.id });
    if (match) found.set(raw, String(match.id));
  }
  return found;
}

/**
 * Structured citation resolution.
 *
 * `judgments` has a UNIQUE index on (year, journal_id, page) and its
 * citation_string is uniformly "YEAR JOURNAL PAGE" (e.g. "1968 PLD 281") with
 * no court-seat token. String normalization was therefore fragile: a citation
 * written "PLD1968 SC 281" produced only the variant "PLD1968281" and never
 * matched the stored "1968 PLD 281". Parsing the citation into its three parts
 * and hitting the unique index is exact, index-backed, and immune to spacing,
 * punctuation, journal/year order, and seat tokens.
 */
const PUBLIC_SITE = (process.env.PUBLIC_SITE_URL || process.env.VITE_PUBLIC_SITE_URL || "https://www.alwakeelo.com").replace(/\/+$/, "");

export function judgmentSourceUrl(judgmentId: string): string {
  return `${PUBLIC_SITE}/judgments/${judgmentId}`;
}

/** "PLC(CS)N" -> "PLCCSN". Same shape parseCitation produces. */
export function canonJournalCode(code: string): string {
  return String(code || "").toUpperCase().replace(/[^A-Z]/g, "");
}

let journalCodeCache: Map<string, number> | null = null;
async function getJournalCodes(): Promise<Map<string, number>> {
  if (journalCodeCache) return journalCodeCache;
  const rows = await db.select({ id: lawJournals.id, code: lawJournals.code }).from(lawJournals);
  const map = new Map<string, number>();
  for (const r of rows) map.set(canonJournalCode(r.code), r.id);
  journalCodeCache = map;
  return map;
}

/**
 * Split a field that crams several citations into one string,
 * e.g. "2023 SCMR 1450 & 2023 PLJ 55" or a "Reported As:" header listing
 * every journal a judgment was reported in, comma separated.
 */
export function splitCitations(raw: string): string[] {
  return String(raw || "")
    // "&" separates citations only between digits ("1450 & 2023 PLJ 55").
    // Inside a journal's category name it is part of the name and must not
    // split ("K.L.R. 2001 Labour & Service Cases 52").
    .split(/(?:\s*[,;]\s*|\s+and\s+|(?<=\d)\s*&\s*)/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Parse a citation into (year, journal code, page). Returns null if not parseable. */
export function parseCitation(raw: string, knownJournals: Set<string>): { year: number; journal: string; page: number } | null {
  let s = String(raw || "").toUpperCase();

  // Canonicalize dotted/spaced journal codes BEFORE punctuation is stripped.
  s = s.replace(/P\s*\.?\s*CR?\s*\.?\s*L\s*\.?\s*J\s*\.?\s*N(?:OTES?)?/g, " PCRLJN ");
  s = s.replace(/P\s*\.?\s*CR?\s*\.?\s*L\s*\.?\s*J/g, " PCRLJ ");
  s = s.replace(/PLC\s*\(?\s*C\.?\s*S\.?\s*\)?\s*N(?:OTES?)?/g, " PLCCSN ");
  s = s.replace(/PLC\s*\(?\s*C\.?\s*S\.?\s*\)?/g, " PLCCS ");
  s = s.replace(/Y\s*\.?\s*L\s*\.?\s*R\s*\.?\s*N(?:OTES?)?/g, " YLRN ");
  s = s.replace(/C\s*\.?\s*L\s*\.?\s*C\s*\.?\s*N(?:OTES?)?/g, " CLCN ");
  s = s.replace(/\bPLC\s*N(?:OTES?)?\b/g, " PLCN ");
  s = s.replace(/S\s*\.?\s*C\s*\.?\s*M\s*\.?\s*R\s*\.?/g, " SCMR ");
  s = s.replace(/P\s*\.?\s*L\s*\.?\s*D\s*\.?/g, " PLD ");
  s = s.replace(/G\s*\.?\s*B\s*\.?\s*L\s*\.?\s*R\s*\.?/g, " GBLR ");

  // Strip remaining punctuation.
  s = s.replace(/[.,()\[\]\/-]/g, " ");

  // KEY FIX: split letter/digit boundaries so "PLD1968281" becomes "PLD 1968 281".
  s = s.replace(/([A-Z])(\d)/g, "$1 $2").replace(/(\d)([A-Z])/g, "$1 $2");

  const rawTokens = s.split(/\s+/).filter(Boolean);

  // Merge runs of single letters so a spaced-out journal code such as
  // "1990 C L C 1439" collapses to "CLC" and matches law_journals.
  const tokens: string[] = [];
  for (const t of rawTokens) {
    const prev = tokens[tokens.length - 1];
    if (t.length === 1 && /^[A-Z]$/.test(t) && prev && /^[A-Z]+$/.test(prev) && prev.length <= 5) {
      tokens[tokens.length - 1] = prev + t;
    } else {
      tokens.push(t);
    }
  }

  const yearIdx = tokens.findIndex((t) => /^(?:1[89]|20)\d{2}$/.test(t));
  if (yearIdx === -1) return null;

  const journal = tokens.find((t) => knownJournals.has(t));
  if (!journal) return null;

  // Page is the last standalone number that is not the year token.
  let page = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (i === yearIdx) continue;
    if (/^\d{1,5}$/.test(tokens[i])) { page = Number(tokens[i]); break; }
  }
  if (page < 0) return null;

  return { year: Number(tokens[yearIdx]), journal, page };
}

/**
 * Resolve a citation string to a real `judgments` row.
 * Structured (year, journal_id, page) lookup first, then the legacy exact
 * normalized-string match as a fallback for shapes the parser rejects.
 * Never LIKE — a substring match binds to a different, wrong judgment.
 */
export async function resolveJudgment<T extends Record<string, any>>(raw: string, selection: T): Promise<any | undefined> {
  const codes = await getJournalCodes();
  const known = new Set(codes.keys());

  for (const part of splitCitations(raw)) {
    const parsed = parseCitation(part, known);
    if (parsed) {
      const journalId = codes.get(parsed.journal);
      if (journalId !== undefined) {
        const [hit] = await db.select(selection)
          .from(judgments)
          .where(and(
            eq(judgments.year, parsed.year),
            eq(judgments.journalId, journalId),
            eq(judgments.page, parsed.page),
          ))
          .limit(1);
        if (hit) return hit;
      }
    }
    for (const variant of normalizeCitation(part)) {
      const [hit] = await db.select(selection)
        .from(judgments)
        .where(sql`upper(replace(replace(replace(replace(replace(${judgments.citationString}, ' ', ''), '.', ''), '(', ''), ')', ''), ',', '')) = ${variant}`)
        .limit(1);
      if (hit) return hit;
    }
  }
  return undefined;
}

/**
 * Judgment text integrity.
 *
 * The original ingest wrote a document's body to every citation that document
 * mentioned, so about 20% of `judgments` rows hold a body belonging to a
 * different case, with a plausible title, headnotes and date. No text is
 * deleted to fix that: script/judgment_text_label.ts records per row whether
 * the stored body is that row's own, and if not, which citation it belongs to.
 *
 * Rows classified before the labelling script has run fall back to an exact
 * sibling lookup, which is correct but scans, so run the script.
 */
export async function assessJudgmentText(
  judgmentId: string,
  fullText: string | null | undefined,
  textStatus?: string | null,
  textTrueCitation?: string | null,
): Promise<{
  textIntegrity: "missing" | "mislabeled" | "shared" | "unique";
  belongsTo?: string;
  sharedWith?: string[];
  textWarning?: string;
}> {
  const body = String(fullText || "").trim();
  if (body.length < 200) {
    return {
      textIntegrity: "missing",
      textWarning: "No usable judgment text is stored for this record. Do not summarise or quote a judgment body for this citation, and do not reconstruct it from memory.",
    };
  }

  if (textStatus === "own") return { textIntegrity: "unique" };

  if (textStatus === "mislabeled") {
    const belongsTo = String(textTrueCitation || "").trim();
    return {
      textIntegrity: "mislabeled",
      belongsTo: belongsTo || undefined,
      textWarning: belongsTo
        ? `The text stored against this citation is the judgment reported as ${belongsTo}, not this case. Do not present it as this citation's judgment or attribute its holdings, facts or quotations to this citation. To read the case this text really is, call get_judgment with ${belongsTo}.`
        : "The text stored against this citation belongs to a different judgment. Do not present it as this citation's judgment.",
    };
  }

  if (textStatus === "unknown") {
    return {
      textIntegrity: "shared",
      textWarning: "This judgment body is stored identically under several citations and the true owner has not been established, so it is not reliably the text of the citation you asked for. Do not attribute holdings, facts or quotations from it to this citation without independent confirmation.",
    };
  }

  // Not yet labelled: fall back to an exact sibling lookup.
  const siblings = await db.select({ citation: judgments.citationString })
    .from(judgments)
    .where(and(eq(judgments.fullText, body), sql`${judgments.id} <> ${judgmentId}`))
    .limit(5);

  if (siblings.length === 0) return { textIntegrity: "unique" };

  const shared = siblings.map((r: { citation: string }) => String(r.citation)).filter(Boolean);
  return {
    textIntegrity: "shared",
    sharedWith: shared,
    textWarning: `This judgment body is stored identically under other citations (${shared.join("; ")}), so it is not uniquely bound to the citation you asked for. Treat the text as unverified: do not attribute holdings, facts, or quotations from it to this citation without independent confirmation.`,
  };
}

