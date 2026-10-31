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
    const match = await resolveJudgment(raw, {
      id: judgments.id, citation: judgments.citationString, title: judgments.title,
      court: judgments.courtNameSnapshot, textStatus: judgments.textStatus,
      textTrueCitation: judgments.textTrueCitation,
      opening: sql<string>`left(${judgments.fullText}, 16000)`,
    });
    if (match && assessJudgmentIdentity(match).textIntegrity === "own") found.set(raw, String(match.id));
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
  s = s.replace(/PLC\s*\(\s*C\.?\s*S\.?\s*T\.?\s*\)/g, " PLCCST ");

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

  // The rule above only joins a letter to a letter, so "2021 P SC 1345" keeps
  // "P" and "SC" apart and the journal PSC is never seen. Join adjacent
  // alphabetic tokens when, and only when, the join is itself a known journal
  // code: that cannot invent a journal, it can only recognise a spaced one.
  for (let i = 0; i < tokens.length - 1; i++) {
    if (!/^[A-Z]+$/.test(tokens[i])) continue;
    for (let span = 3; span >= 2; span--) {
      const parts = tokens.slice(i, i + span);
      if (parts.length < span) continue;
      if (!parts.every((t) => /^[A-Z]+$/.test(t))) continue;
      const joined = parts.join("");
      if (joined.length <= 8 && knownJournals.has(joined)) {
        tokens.splice(i, span, joined);
        break;
      }
    }
  }

  const yearIdx = tokens.findIndex((t) => /^(?:1[89]|20)\d{2}$/.test(t));
  if (yearIdx === -1) return null;

  const journalIdx = tokens.findIndex((t) => knownJournals.has(t));
  if (journalIdx === -1) return null;
  const journal = tokens[journalIdx];

  // The page is the FIRST number after the year/journal pair, not the last
  // number in the string. Taking the last one made a pin cite resolve to a
  // different real judgment: "2001 SCMR 1986 at 1988" bound to 2001 SCMR 1988.
  // Intervening words are skipped so seat tokens ("PLD 2013 SC 793") and
  // series names ("K.L.R. 2001 Labour & Service Cases 52") still parse.
  const isNum = (t: string) => /^\d{1,5}$/.test(t);
  let page = -1;
  for (let i = Math.max(journalIdx, yearIdx) + 1; i < tokens.length; i++) {
    if (i === yearIdx) continue;
    if (isNum(tokens[i])) { page = Number(tokens[i]); break; }
  }
  // Formats that put the page before the year/journal are rare but legal;
  // fall back to a backward scan only when nothing follows.
  if (page < 0) {
    for (let i = Math.max(journalIdx, yearIdx) - 1; i >= 0; i--) {
      if (i === yearIdx) continue;
      if (isNum(tokens[i])) { page = Number(tokens[i]); break; }
    }
  }
  if (page < 0) return null;

  return { year: Number(tokens[yearIdx]), journal, page };
}

type JudgmentIdentity = {
  citation?: string | null;
  title?: string | null;
  court?: string | null;
  opening?: string | null;
  textStatus?: string | null;
  textTrueCitation?: string | null;
};

export type JudgmentIntegrity = {
  textIntegrity: "missing" | "mislabeled" | "unknown" | "own";
  belongsTo?: string;
  textWarning?: string;
  identityConflict?: boolean;
};

const IDENTITY_JOURNALS = new Set([
  "PLD", "SCMR", "YLR", "YLRN", "MLD", "CLC", "CLCN", "PLJ", "NLR", "PCRLJ", "PCRLJN",
  "PTCL", "PTD", "PLCCS", "PLCCSN", "PLCCST", "PLC", "PLCN", "PSC", "SCP", "ALD", "KLR", "SLS",
  "GBLR", "CLD", "AIR", "LHC", "SHC", "IHC", "PHC", "BHC", "FSC", "AJKHC", "GBCC",
]);

function titleParties(value: string): string[][] | null {
  let parts = value.split(/\s+(?:v(?:s)?\.?|versus)\s+/i);
  if (parts.length === 1) {
    const entity = value.match(/^\s*(?:in\s+the\s+matter\s+of|in\s+re)\s*:?\s*(.+)$/i)?.[1]
      || value.match(/^(.+?):\s*in\s+the\s+matter\s+of\s*$/i)?.[1];
    if (!entity) return null;
    parts = [entity];
  } else if (parts.length !== 2) return null;
  const ignored = new Set(["the", "and", "another", "others", "other", "through", "legal", "heirs", "petitioner", "respondent", "appellant", "mr", "mrs", "mst", "matter", "not", "unknown", "nil", "none", "case", "company", "limited", "ltd", "messrs"]);
  const tokens = parts.map((part) => [...new Set((part.toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter((word) => word.length >= 3 && !ignored.has(word)))]);
  return tokens.every((part) => part.length > 0) ? tokens : null;
}

function reportedCitationHeader(header: string): string | undefined {
  const match = /\bReported\s+As\s*:[ \t]*/i.exec(header);
  if (!match) return undefined;
  const lines = header.slice(match.index + match[0].length).split(/\r?\n/);
  const parts: string[] = [];
  const citationWords = new Set([...IDENTITY_JOURNALS, ..."SC SUPREME COURT FEDERAL SHARIAT LAHORE LAH KARACHI KAR SINDH PESHAWAR PESH BALOCHISTAN ISLAMABAD QUETTA MULTAN RAWALPINDI BAHAWALPUR ABBOTTABAD HYDERABAD SUKKUR TRIB TRIBUNAL CS CST CR C CIVIL CRIMINAL CASES CL LABOUR SERVICE NOTES NOTE".split(" ")]);
  for (const line of lines.slice(0, 20)) {
    const field = line.split(/\s*\b(?:Result|Case\s+No\.?|Date\s+of\s+Judgment|Court\s+Name|Title)\s*:/i)[0].trim();
    if (!parts.length && !line.trim()) continue;
    if (!field) break;
    // Only citation vocabulary may continue the field; never absorb narrative authorities.
    const words = field.replace(/\./g, "").toUpperCase().match(/[A-Z]+/g) || [];
    if (parts.length && (!/\d/.test(field) || words.some(word => !citationWords.has(word) && word.length !== 1))) break;
    parts.push(field);
    if (field !== line.trim()) break;
  }
  return parts.join(" ") || undefined;
}

function courtIdentity(value: string): string | null {
  const court = value.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  if (/\bsupreme court\b/.test(court) || court === "sc") return /azad|kashmir|ajk/.test(court) ? "supreme:ajk" : "supreme:pakistan";
  if (/federal shariat court/.test(court) || court === "fsc") return "shariat:federal";
  const aliases: Record<string, string> = { lhc: "lahore", shc: "sindh", ihc: "islamabad", phc: "peshawar", bhc: "balochistan" };
  if (aliases[court]) return `high:${aliases[court]}`;
  if (/high court/.test(court)) {
    const seat = /lahore|sindh|karachi|islamabad|peshawar|balochistan|quetta|azad|kashmir/.exec(court)?.[0];
    return `high:${seat === "karachi" ? "sindh" : seat === "quetta" ? "balochistan" : seat === "azad" || seat === "kashmir" ? "ajk" : seat || "unspecified"}`;
  }
  if (/tribunal|labou?r court/.test(court)) {
    const kind = /service|customs|labou?r|tax|banking|election/.exec(court)?.[0]?.replace("labor", "labour");
    if (!kind) return null;
    const seat = /federal|punjab|sindh|balochistan|khyber pakhtunkhwa/.exec(court)?.[0] || "unspecified";
    return `${kind}-${/tribunal/.test(court) ? "tribunal" : "court"}:${seat}`;
  }
  return null;
}

/** Check internal consistency only; source authenticity still requires independent verification. */
export function assessJudgmentIdentity(record: JudgmentIdentity): JudgmentIntegrity {
  const body = String(record.opening || "").trim();
  if (record.textStatus === "mislabeled") return {
    textIntegrity: "mislabeled", belongsTo: String(record.textTrueCitation || "").trim() || undefined,
    identityConflict: true,
    textWarning: "The stored text belongs to a different judgment and must not be attributed to this citation.",
  };
  if (body.length < 200) return { textIntegrity: "missing", textWarning: "No usable judgment text is stored for this record." };

  const header = body.slice(0, 16000);
  let title = header.match(/(?:^|\n)\s*Title\s*:\s*([\s\S]*?)(?=\s*(?:Case\s+No\.?|Date\s+of\s+Judgment|Reported\s+As|Result)\s*:)/i)?.[1]
    ?.replace(/\bJUDGMENT\b[\s\S]*$/i, "").trim();
  // Printed reporter pages often use a standalone Versus instead of labelled metadata.
  if (!title) {
    const opening = header.slice(0, 3500);
    const versus = /\n\s*Versus\s*\n/i.exec(opening);
    if (versus) {
      const petitioner = opening.slice(0, versus.index).trim().split(/\n\s*\n/).at(-1)
        ?.replace(/^Before[\s\S]*?\bMembers?\b\s*/i, "").trim();
      const respondent = opening.slice(versus.index + versus[0].length).trim().split(/\n\s*\n/)[0];
      if (petitioner && respondent) title = `${petitioner} vs ${respondent}`;
    }
  }
  const reported = reportedCitationHeader(header)
    || header.split(/\r?\n/).slice(0, 10).find((line) => line.trim().length <= 100
      && /^(?:(?:19|20)\d{2}\s+|[A-Z. ]+\s+(?:19|20)\d{2}\b)/i.test(line.trim())
      && parseCitation(line, IDENTITY_JOURNALS));
  const storedParties = titleParties(String(record.title || ""));
  const bodyParties = titleParties(title || "");
  const malformedTitle = /\b(?:JUDGMENT|Reported\s+As|Case\s+No)\b|Honou?rable\s+Justice|(?:^|\s)(?:v(?:s)?\.?|versus)\s+(?:NOT|N\/A|NIL|NONE|UNKNOWN)\s*$|^(?:NOT|N\/A|NIL|NONE|UNKNOWN)\s+(?:v(?:s)?\.?|versus)\s/i;
  if (malformedTitle.test(String(record.title || "")) || (title && malformedTitle.test(title))) return {
    textIntegrity: "unknown", identityConflict: true,
    textWarning: "The case title contains incomplete party names or extraction artifacts; it cannot identify this judgment reliably.",
  };
  const sameParties = storedParties && bodyParties && storedParties.length === bodyParties.length && storedParties.every((party, index) => {
    const other = bodyParties[index];
    const shorter = party.length <= other.length ? party : other;
    const longer = party.length <= other.length ? other : party;
    return shorter.every((token) => longer.includes(token));
  });
  if (storedParties && bodyParties && !sameParties) return { textIntegrity: "unknown", identityConflict: true, textWarning: "The stored case title conflicts with the parties named in the judgment text." };

  const expected = parseCitation(String(record.citation || ""), IDENTITY_JOURNALS);
  const reportedCitations = splitCitations(reported || "").map((part) => parseCitation(part, IDENTITY_JOURNALS)).filter(Boolean);
  if (expected && reportedCitations.length && !reportedCitations.some((item) => item!.year === expected.year && item!.journal === expected.journal && item!.page === expected.page)) {
    return { textIntegrity: "unknown", identityConflict: true, textWarning: "The stored citation does not match a citation in the judgment header." };
  }
  const court = String(record.court || "").toLowerCase().replace(/\s+/g, " ").trim();
  const bodyCourt = (header.match(/(?:^|\n)\s*(?:Court Name|COURT)\s*:\s*([^\r\n]+)/i)?.[1]
    || header.slice(0, 3500).match(/(?:^|\n)\s*\[([^\]\r\n]*(?:Court|Tribunal)[^\]\r\n]*)\]/i)?.[1]
    || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (court && bodyCourt && court !== bodyCourt) {
    const storedCourt = courtIdentity(court);
    const reportedCourt = courtIdentity(bodyCourt);
    if (!storedCourt || !reportedCourt || (storedCourt !== reportedCourt && storedCourt.split(":")[0] === reportedCourt.split(":")[0] && [storedCourt, reportedCourt].some((name) => name.endsWith(":unspecified")))) {
      return { textIntegrity: "unknown", textWarning: "The court names could not be reconciled; case identity remains unverified." };
    }
    if (storedCourt !== reportedCourt) return { textIntegrity: "unknown", identityConflict: true, textWarning: "The stored court conflicts with the judgment header." };
  }
  if (!sameParties || !reported || !expected || !reportedCitations.length) return { textIntegrity: "unknown", textWarning: "The citation and case title cannot be confirmed from the judgment header." };
  if (record.textStatus !== "own") return { textIntegrity: "unknown", textWarning: "The stored judgment text has not been verified for this citation." };
  return { textIntegrity: "own" };
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

  // Exact stored citation first. About 4,940 judgments carry a citation_string
  // that is not a journal citation at all - case numbers such as
  // "Const. P. 11/2026 (SHC)", or a citation with a seat appended - and those
  // rows hold a synthetic page number. Parsing their text yields a (year,
  // journal, page) triple that belongs to a DIFFERENT judgment, so the literal
  // string has to win before any parsing is attempted.
  const literal = String(raw || "").trim();
  if (literal) {
    const [exact] = await db.select(selection)
      .from(judgments)
      .where(eq(judgments.citationString, literal))
      .limit(1);
    if (exact) return exact;
  }

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
      // The parser already produced year/journal/page. The string fallback
      // below exists only for shapes the parser rejects, and it is an
      // unindexed scan of all 234,837 rows (~176 ms each). Running it after a
      // clean parse just burns a scan to reach the same answer, and
      // legal_research does this once per citation in a RAG context.
      continue;
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
 * A provenance label alone cannot establish identity. Compare the stored
 * citation and parties against the body header before returning the text.
 */
export async function assessJudgmentText(
  judgmentId: string,
  fullText: string | null | undefined,
  textStatus?: string | null,
  textTrueCitation?: string | null,
  identity?: { citation?: string | null; title?: string | null; court?: string | null },
): Promise<JudgmentIntegrity> {
  return assessJudgmentIdentity({ ...identity, opening: fullText, textStatus, textTrueCitation });
}

export function judgmentPdfUrl(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (raw.startsWith("/") && !raw.startsWith("//") && !/[\\\r\n]/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

/** Availability is separate from verification: plain text and PDF records remain readable. */
export function prepareJudgmentDetail<T extends {
  id: string; citation: string; title: string; court: string; fullText: string; pdfUrl?: string | null;
}>(detail: T, stored: { opening?: string | null; textStatus?: string | null; textTrueCitation?: string | null } | undefined): T & JudgmentIntegrity & { contentFormat: string } {
  const identity = { citation: detail.citation, title: detail.title, court: detail.court, ...stored };
  const check: JudgmentIntegrity = stored ? assessJudgmentIdentity(identity) : { textIntegrity: "unknown", textWarning: "Judgment identity could not be checked." };
  if (check.identityConflict || !stored) return {
    ...detail, title: "Judgment identity unverified", court: "", petitioner: null, respondent: null,
    decisionDate: null, headnotes: null, fullText: "", formattedText: null, pdfUrl: null,
    citations: { made: [], received: [] }, ...check, contentFormat: "unavailable",
  } as T & JudgmentIntegrity & { contentFormat: string };
  // Prefer the stored body if formatting introduced a different or uncheckable header.
  const renderedCheck = assessJudgmentIdentity({ ...identity, opening: detail.fullText });
  const fullText = (renderedCheck.identityConflict || (check.textIntegrity === "own" && renderedCheck.textIntegrity !== "own"))
    ? String(stored.opening || "") : String(detail.fullText || stored.opening || "");
  const pdfUrl = judgmentPdfUrl(detail.pdfUrl);
  const hasText = fullText.trim().length >= 200;
  return {
    ...detail, ...check, fullText: hasText ? fullText : "", pdfUrl, headnotes: null,
    formattedText: hasText && (detail as any).formattedText === fullText ? fullText : null,
    citations: check.textIntegrity === "own" ? (detail as any).citations : { made: [], received: [] },
    contentFormat: hasText ? (pdfUrl ? "text_and_pdf" : "text") : (pdfUrl ? "pdf" : "unavailable"),
    textWarning: check.textIntegrity === "own" ? undefined : pdfUrl && !hasText
      ? "PDF available. Searchable text and case identity have not been verified. Open the PDF to read this record."
      : check.textWarning,
  } as T & JudgmentIntegrity & { contentFormat: string };
}

/** Validate stored identity while preserving available text and PDF sources. */
export async function protectJudgmentDetail<T extends {
  id: string; citation: string; title: string; court: string; fullText: string; pdfUrl?: string | null;
}>(detail: T): Promise<T & JudgmentIntegrity & { contentFormat: string }> {
  const [stored] = await db.select({
    textStatus: judgments.textStatus, textTrueCitation: judgments.textTrueCitation,
    opening: judgments.fullText,
  }).from(judgments).where(eq(judgments.id, detail.id)).limit(1);
  return prepareJudgmentDetail(detail, stored);
}

