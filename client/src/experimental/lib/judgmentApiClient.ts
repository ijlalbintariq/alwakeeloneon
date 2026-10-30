/**
 * ============================================================================
 * PAKISTANI JUDGMENT API CLIENT & PRECEDENT BRIDGE
 * Strictly isolated in client/src/experimental/
 * ============================================================================
 * Features:
 * 1. Live API querying: /api/case-law/search, /api/citation-search,
 *    /api/judgments/:id, /api/case-law/cite, /api/case-law/lookup, /api/ai/search-judgments.
 * 2. Cross-Module Legal Drafting Studio Triple-Bridge:
 *    - CustomEvent("alwakeelo-drafting-insert")
 *    - LocalStorage("alwakeelo_drafting_insert")
 *    - Structured court citation & ratio decidendi payload builder.
 * 3. API-backed records; synthetic catalogs are confined to test fixtures.
 * ============================================================================
 */

import type { PrecedentCitationItem } from "../components/judgments/OverruledAlertBanner.js";
import type { JudgmentSummaryData } from "../components/judgments/RatioDecidendiCard.js";
import { parsePakistaniCitation } from "../components/judgments/PinpointCitationParser";

export interface JudgmentRatioDecidendi {
  result: string;
  legalPrinciples: string[];
  keyFindings?: string[];
  significance?: string;
}

export interface UnifiedJudgmentResult {
  id: string | number;
  judgmentId?: string | number;
  citation: string;
  court: string;
  courtCode?: "SC" | "LHC" | "SHC" | "IHC" | "PHC" | "BHC" | "FSC" | string;
  title: string;
  summary: string;
  headnotes?: string | null;
  petitioner?: string | null;
  respondent?: string | null;
  decisionDate?: string | null;
  bench?: string | null;
  treatment?: "relied_upon" | "distinguished" | "overruled" | "referred_to" | string;
  category?: "constitutional" | "criminal" | "civil" | "family" | "corporate" | "tax" | "labor" | string;
  keywords?: string[];
  uri?: string | null;
  source?: "tier2_live_api" | "tier1_seed" | "cached" | string;
  citationsMade?: PrecedentCitationItem[];
  citationsReceived?: PrecedentCitationItem[];
  ratioDecidendi?: JudgmentSummaryData | JudgmentRatioDecidendi | null;
  isOverruled?: boolean;
  overrulingCitation?: string | null;
  fullText?: string;
  pdfUrl?: string | null;
}

export interface JudgmentDetailData {
  id: string;
  citation: string;
  title: string;
  petitioner: string | null;
  respondent: string | null;
  court: string;
  decisionDate: string | null;
  headnotes: string | null;
  fullText: string;
  pdfUrl: string | null;
  bench?: string | null;
  ratioDecidendi?: JudgmentSummaryData | null;
  isOverruled?: boolean;
  overrulingCitation?: string | null;
  citations: {
    made: PrecedentCitationItem[];
    received: PrecedentCitationItem[];
  };
}

export interface SavedJudgmentRecord {
  id: number | string;
  citation: string;
  court: string;
  title: string;
  summary: string;
  keywords?: string[] | null;
  uri?: string | null;
  source?: string | null;
  createdAt: string;
}

export interface JudgmentSearchParams {
  query?: string;
  journal?: string;
  court?: string;
  year?: string | number;
  sort?: "relevance" | "latest" | "most_cited";
  limit?: number;
  offset?: number;
}

export interface CitationLookupParams {
  year: number;
  journal?: string;
  page: number;
  court?: string;
  citationRaw?: string;
}

export interface DraftingInsertPayload {
  statute: string;
  section: string;
  title: string;
  clause: string;
  timestamp: number;
}

// ─── Formatters & Drafting Studio Bridge ─────────────────────────────────────

/**
 * Formats a ratio decidendi or reported headnotes excerpt into a court-ready
 * legal pleading clause for the Legal Drafting Studio.
 */
export function formatRatioOrHeadnotes(
  item: Partial<UnifiedJudgmentResult & JudgmentDetailData & SavedJudgmentRecord> | any
): string {
  const parts: string[] = [];
  const citation = item?.citation || "Reported Authority";
  const court = item?.court || "Supreme Court of Pakistan";
  const title = item?.title || "Judicial Precedent";

  parts.push(`LEGAL PRECEDENT & BINDING RATIO DECIDENDI:`);
  parts.push(`Authority: ${title} (${citation})`);
  parts.push(`Forum: ${court}`);
  if (item?.decisionDate) {
    parts.push(`Date of Decision: ${item.decisionDate}`);
  }
  if (item?.bench) {
    parts.push(`Honorable Bench: ${item.bench}`);
  }
  parts.push(``);

  if (item?.ratioDecidendi) {
    const ratio = item.ratioDecidendi;
    if (ratio.result) {
      parts.push(`Operative Holding:`);
      parts.push(ratio.result);
      parts.push(``);
    }
    if (ratio.legalPrinciples && ratio.legalPrinciples.length > 0) {
      parts.push(`Legal Principles Enunciated:`);
      ratio.legalPrinciples.forEach((p: string, idx: number) => {
        parts.push(`(${idx + 1}) ${p}`);
      });
      parts.push(``);
    }
  }

  if (item?.headnotes) {
    parts.push(`Reported Headnotes & Statutory Propositions:`);
    parts.push(item.headnotes);
    parts.push(``);
  } else if (item?.summary) {
    parts.push(`Precedent Ratio Summary:`);
    parts.push(item.summary);
    parts.push(``);
  }

  parts.push(
    `Constitutional Mandate: Cited as binding apex precedent pursuant to Article 189 / 201 of the Constitution of the Islamic Republic of Pakistan, 1973.`
  );

  return parts.join("\n").trim();
}

/**
 * Builds the canonical DraftingInsertPayload schema for cross-module integration.
 */
export function createDraftingInsertPayload(
  item: Partial<UnifiedJudgmentResult & JudgmentDetailData & SavedJudgmentRecord> | any
): DraftingInsertPayload {
  return {
    statute: item?.court || "Supreme Court of Pakistan",
    section: item?.citation || "Precedent Authority",
    title: item?.title || "Pakistani Superior Court Precedent",
    clause: formatRatioOrHeadnotes(item),
    timestamp: Date.now(),
  };
}

/**
 * Dispatches the drafting insert event and persists to localStorage.
 */
export function dispatchDraftingInsert(payload: DraftingInsertPayload): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("alwakeelo_drafting_insert", JSON.stringify(payload));
    }
  } catch (err) {
    console.warn("Failed to write to localStorage for drafting insert:", err);
  }

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent("alwakeelo-drafting-insert", { detail: payload })
      );
    } catch {}
    try {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "alwakeelo_drafting_insert",
          newValue: JSON.stringify(payload),
        })
      );
    } catch {}
  }
}

export function getPrecedentTarget(item?: Partial<PrecedentCitationItem> | null): string {
  const linkedId = String(item?.linkedJudgmentId ?? "").trim();
  if (linkedId && !/^extracted-/i.test(linkedId)) return linkedId;
  return String(item?.linkedCitation || "").trim() || String(item?.citationText || "").trim();
}

export function getCitationTreatment(type?: string | null): string {
  const key = String(type || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (["reliedupon", "followed", "approved"].includes(key)) return "relied_upon";
  if (["distinguished", "explained"].includes(key)) return "distinguished";
  if (["overruled", "overruledby", "disapproved", "reversed"].includes(key)) return "overruled";
  return "referred_to";
}

export function normalizePrecedentCitation(value?: string | null): string {
  let text = String(value || "");
  try { text = decodeURIComponent(text); if (text.includes("%")) text = decodeURIComponent(text); } catch {}
  text = text.replace(/[-_]+/g, " ");
  const parsed = parsePakistaniCitation(text);
  if (!parsed) return text.toLowerCase().replace(/[^a-z0-9]/g, "");
  let journal = parsed.journal;
  let court = String(parsed.court || "").toUpperCase().replace(/\s/g, "");
  const pldCourt = journal.match(/^PLD(SC|FC|FSC|LHC|SHC|IHC|PHC|BHC)$/);
  if (pldCourt) { journal = "PLD"; court = pldCourt[1]; }
  const courts: Record<string, string> = { LAHORE: "LHC", KARACHI: "SHC", ISLAMABAD: "IHC", PESHAWAR: "PHC", QUETTA: "BHC", SUPREMECOURT: "SC", FEDERALCOURT: "FC" };
  return `${parsed.year}:${journal}:${journal === "PLD" ? courts[court] || court : ""}:${parsed.page}`;
}

/** Keep recorded treatments and add only citations actually present in the text. */
export function hydrateCitationGraph(
  citation: string,
  existingMade?: PrecedentCitationItem[],
  existingReceived?: PrecedentCitationItem[],
  fullText?: string
): { made: PrecedentCitationItem[]; received: PrecedentCitationItem[] } {
  const anchorKey = normalizePrecedentCitation(citation);
  const cleanEdges = (edges?: PrecedentCitationItem[]) => {
    const unique = new Map<string, PrecedentCitationItem>();
    for (const edge of Array.isArray(edges) ? edges : []) {
      if (!edge) continue;
      const key = normalizePrecedentCitation(edge.linkedCitation || edge.citationText);
      if (!key || key === anchorKey) continue;
      const identity = `${key}:${String(edge.citationType || "referred_to").toLowerCase().replace(/[\s-]+/g, "_")}`;
      const previous = unique.get(identity);
      unique.set(identity, previous ? {
        ...edge, ...previous,
        linkedJudgmentId: previous.linkedJudgmentId && !/^extracted-/i.test(String(previous.linkedJudgmentId)) ? previous.linkedJudgmentId : edge.linkedJudgmentId || previous.linkedJudgmentId,
        linkedTitle: previous.linkedTitle || edge.linkedTitle,
        contextExcerpt: previous.contextExcerpt || edge.contextExcerpt,
      } : { ...edge, citationType: edge.citationType || "referred_to" });
    }
    return [...unique.values()];
  };
  const made = cleanEdges(existingMade);
  const received = cleanEdges(existingReceived);
  const found = new Set(made.map((edge) => normalizePrecedentCitation(edge.linkedCitation || edge.citationText)));
  const journals = ["PLD", "SCMR", "PLJ", "LHC", "SHC", "PHC", "BHC", "IHC", "FSC", "CLC", "PCRLJ", "YLR", "MLD", "CLD", "PTD", "PLC"].map((journal) => journal.split("").join("\\s*\\.?\\s*") + "\\.?").join("|");
  const courts = "SC|FC|FSC|LHC|SHC|IHC|PHC|BHC|Lahore|Karachi|Islamabad|Peshawar|Quetta";
  const pattern = new RegExp(`\\b(?:(?:${journals})\\s+(?:19|20)\\d{2}|(?:19|20)\\d{2}\\s+(?:${journals}))(?:\\s+(?:${courts}))?\\s+\\d{1,6}\\b`, "gi");
  for (const match of String(fullText || "").matchAll(pattern)) {
    const parsed = parsePakistaniCitation(match[0]);
    if (!parsed) continue;
    const pldCourt = parsed.journal.match(/^PLD(SC|FC|FSC|LHC|SHC|IHC|PHC|BHC)$/);
    const cited = (parsed.journal === "PLD" || pldCourt
      ? `PLD ${parsed.year} ${parsed.court || pldCourt?.[1] || ""} ${parsed.page}`
      : `${parsed.year} ${parsed.journal} ${parsed.page}`).replace(/\s+/g, " ").trim();
    const key = normalizePrecedentCitation(cited);
    if (key === anchorKey || found.has(key)) continue;
    found.add(key);
    made.push({
      id: `extracted-${key.replace(/[^a-z0-9]/gi, "")}`,
      linkedCitation: cited, citationText: cited, citationType: "referred_to",
      contextExcerpt: String(fullText).slice(Math.max(0, match.index! - 100), match.index! + match[0].length + 100).replace(/\s+/g, " ").trim(),
      linkedTitle: null, linkedJudgmentId: null,
    });
  }
  return { made, received };
}

// ─── Two-Tier Judgment Search ───────────────────────────────────────────────

/**
 * Searches live case-law endpoints. Unavailable endpoints produce an empty list,
 * never invented fallback authorities.
 */
export async function searchJudgments(
  params: JudgmentSearchParams
): Promise<UnifiedJudgmentResult[]> {
  const query = (params.query || "").trim();
  const journal = params.journal || "All";
  const court = params.court || "All Courts";
  const year = params.year ? String(params.year) : undefined;
  const sort = params.sort || "relevance";
  const limit = params.limit || 25;
  const offset = params.offset || 0;

  const results: UnifiedJudgmentResult[] = [];

  // Tier 2 (Live Primary): Live Case-Law Endpoints
  if (typeof fetch !== "undefined") {
    try {
      const searchParams = new URLSearchParams();
      if (query) searchParams.set("q", query);
      if (journal !== "All") searchParams.set("report", journal);
      if (court !== "All Courts") searchParams.set("court", court);
      if (year && year !== "All Years") searchParams.set("year", year);
      searchParams.set("sort", sort);
      searchParams.set("limit", String(limit));
      searchParams.set("offset", String(offset));

      let res: Response | null = null;
      try {
        res = await fetch(`/api/case-law/search?${searchParams.toString()}`, {
          credentials: "include",
        });
      } catch {}

      // Free tier quota exhausted — stop immediately, don't fall through to AI search
      if (res && res.status === 403) {
        const errBody = await res.json().catch(() => ({}));
        if (errBody.upgradeRequired) {
          throw new Error(errBody.message || "Free quota exhausted. Please upgrade to continue.");
        }
      }

      if (!res || !res.ok) {
        if (query.length >= 3) {
          try {
            res = await fetch(`/api/case-law/cite?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`, {
              credentials: "include",
            });
          } catch {}
        }
      }

      // If no local DB match, trigger live AI RAG precedent search
      if (!res || !res.ok) {
        if (query.length >= 3) {
          try {
            res = await fetch(`/api/ai/search-judgments`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ query, journal: journal !== "All" ? journal : undefined, court: court !== "All Courts" ? court : undefined, offset }),
            });
          } catch {}
        }
      }

      if (res && res.ok) {
        const liveItems = await res.json();
        const itemsArray = Array.isArray(liveItems) ? liveItems : Array.isArray(liveItems?.results) ? liveItems.results : [];
        if (itemsArray.length > 0) {
          itemsArray.forEach((ar: any) => {
            const rawCitation = String(ar.citation || "").trim();
            if (!rawCitation) return;
            const alreadyExists = results.some(
              (r) => r.citation.toLowerCase() === rawCitation.toLowerCase()
            );
            if (!alreadyExists) {
              results.push({
                id: String(ar.id || `live-${ar.judgmentId || Date.now()}`),
                judgmentId: String(ar.judgmentId || ar.id || ""),
                citation: rawCitation,
                court: ar.court || "Pakistani Court",
                title: ar.title || "Reported Judgment",
                summary: ar.summary || ar.headnotes || "Reported judgment record.",
                headnotes: ar.headnotes || ar.summary,
                decisionDate: ar.decisionDate || null,
                bench: ar.bench || null,
                treatment: ar.treatment || "referred_to",
                isOverruled: ar.isOverruled === true,
                category: ar.category || "civil",
                source: "tier2_live_api",
                citationsMade: ar.citationsMade || [],
                citationsReceived: ar.citationsReceived || [],
                ratioDecidendi: ar.ratioDecidendi || null,
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn("[Judgment Search] Live query encountered issue:", e);
    }
  }

  return results;
}

// ─── Two-Tier Pinpoint Citation Lookup ───────────────────────────────────────

/**
 * Resolves a precise law journal citation (e.g. 2024 SCMR 892) across
 * live backend endpoint and Tier 1 seed database fallback.
 */
export async function lookupCitation(
  params: CitationLookupParams
): Promise<UnifiedJudgmentResult | null> {
  // Live Backend Citation Search
  if (typeof fetch !== "undefined") {
    try {
      const qp = new URLSearchParams();
      qp.set("year", String(params.year));
      qp.set("page", String(params.page));
      if (params.journal && params.journal !== "ALL" && params.journal !== "All") {
        qp.set("journal", params.journal);
      }
      if (params.court && params.court !== "All Courts") {
        qp.set("court", params.court);
      }

      let res = await fetch(`/api/citation-search?${qp.toString()}`, { credentials: "include" });
      if (!res.ok) {
        const citationStr = params.citationRaw || `${params.year} ${params.journal || ""} ${params.page}`;
        res = await fetch(`/api/case-law/lookup?citation=${encodeURIComponent(citationStr)}`, {
          credentials: "include",
        });
      }

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const m = data[0];
          return {
            id: m.id,
            judgmentId: m.id,
            citation: m.citation,
            court: m.court,
            title: m.title,
            summary: m.headnotes || m.summary || m.fullText || "Reported judgment record.",
            headnotes: m.headnotes || m.summary,
            bench: m.bench || null,
            category: m.category,
            ratioDecidendi: m.ratioDecidendi || null,
            decisionDate: m.decisionDate || null,
            treatment: "relied_upon",
            source: "tier2_live_api",
            citationsMade: m.citationsMade || [],
            citationsReceived: m.citationsReceived || [],
          };
        } else if (data && data.found && data.citation) {
          return {
            id: data.id,
            judgmentId: data.id,
            citation: data.citation,
            court: data.court,
            title: data.title,
            summary: data.summary || "Reported judgment record.",
            headnotes: data.summary,
            bench: data.bench || null,
            category: data.category,
            ratioDecidendi: data.ratioDecidendi || null,
            decisionDate: null,
            treatment: "relied_upon",
            source: "tier2_live_api",
            citationsMade: [],
            citationsReceived: [],
          };
        }
      }
    } catch {
      // Silent fallback
    }
  }

  return null;
}

// ─── Two-Tier Judgment Detail Retrieval ──────────────────────────────────────

/**
 * Loads the full judgment detail record including official headnotes,
 * ratio decidendi, full judgment text, and citation graph nodes.
 */
export async function getJudgmentDetail(
  id: string | number
): Promise<JudgmentDetailData | null> {
  let rawId = String(id || "").trim();
  try {
    rawId = decodeURIComponent(rawId);
    if (rawId.includes("%")) rawId = decodeURIComponent(rawId);
  } catch {}
  const cleanId = rawId.trim();
  if (!cleanId) return null;

  // Live Backend /api/judgments/:id
  if (typeof fetch !== "undefined") {
    try {
      let res = await fetch(`/api/judgments/${encodeURIComponent(cleanId)}`, {
        credentials: "include",
      });

      if (!res.ok && (res.status === 401 || res.status === 404)) {
        res = await fetch(`/api/public/judgments/${encodeURIComponent(cleanId)}`, {
          credentials: "include",
        });
      }

      if (res && res.ok) {
        const data = await res.json();
        const graphEdges = hydrateCitationGraph(
          data.citation || "",
          data.citations?.made,
          data.citations?.received,
          data.fullText || data.previewText
        );

        return {
          id: String(data.id || cleanId),
          citation: data.citation || "Unreported / Citation Pending",
          title: data.title || "Pakistani Court Judgment",
          petitioner: data.petitioner || null,
          respondent: data.respondent || null,
          court: data.court || data.courtName || "Supreme Court / High Court of Pakistan",
          decisionDate: data.decisionDate || null,
          headnotes: data.headnotes || data.summary || null,
          fullText: data.fullText || data.previewText || data.summary || "Full text record.",
          pdfUrl: data.pdfUrl || null,
          bench: data.bench || null,
          ratioDecidendi: data.ratioDecidendi || null,
          isOverruled: data.isOverruled || false,
          overrulingCitation: data.overrulingCitation || null,
          citations: {
            made: graphEdges.made,
            received: graphEdges.received,
          },
        };
      }

      // Fallback 1: Try /api/case-law/lookup
      const normalizedQuery = cleanId.replace(/^extracted-/i, "").replace(/[-_]+/g, " ").trim();
      const lookupRes = await fetch(`/api/case-law/lookup?citation=${encodeURIComponent(normalizedQuery)}`, {
        credentials: "include",
      });

      if (lookupRes.ok) {
        const lookupData = await lookupRes.json();
        if (lookupData && lookupData.found) {
          // If full text is available from /api/judgment-text, grab it
          let fetchedFullText = lookupData.summary || lookupData.content || "";
          try {
            const textRes = await fetch(`/api/judgment-text?citation=${encodeURIComponent(lookupData.citation || normalizedQuery)}`, {
              credentials: "include",
            });
            if (textRes.ok) {
              const textJson = await textRes.json();
              if (textJson.fullText) fetchedFullText = textJson.fullText;
            }
          } catch {}

          const graphEdges = hydrateCitationGraph(
            lookupData.citation || normalizedQuery,
            [],
            [],
            fetchedFullText
          );

          return {
            id: String(lookupData.id || cleanId),
            citation: lookupData.citation || normalizedQuery,
            title: lookupData.title || `Precedent Authority (${normalizedQuery})`,
            petitioner: null,
            respondent: null,
            court: lookupData.court || "Pakistani Court",
            decisionDate: null,
            headnotes: lookupData.summary || null,
            fullText: fetchedFullText || "Full text record.",
            pdfUrl: null,
            bench: null,
            ratioDecidendi: null,
            isOverruled: false,
            overrulingCitation: null,
            citations: {
              made: graphEdges.made,
              received: graphEdges.received,
            },
          };
        }
      }
    } catch (err) {
      console.warn("getJudgmentDetail lookup failed:", err);
    }
  }

  return null;
}

// ─── Bookmark Vault Management ───────────────────────────────────────────────

/**
 * Saves or updates a judgment bookmark in localStorage and backend database.
 */
export async function saveJudgmentBookmark(
  item: Partial<UnifiedJudgmentResult | JudgmentDetailData | SavedJudgmentRecord>
): Promise<boolean> {
  const citation = item.citation || "";
  if (!citation) return false;

  const newBookmark: SavedJudgmentRecord = {
    id: Date.now(),
    citation,
    court: item.court || "Pakistani Court",
    title: item.title || "Legal Precedent Authority",
    summary:
      (item as any).headnotes ||
      (item as any).summary ||
      "Curated authority saved in Chambers Vault.",
    createdAt: new Date().toISOString(),
  };

  // Local storage persistence
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("alwakeelo_saved_judgments");
      const list: SavedJudgmentRecord[] = stored ? JSON.parse(stored) : [];
      if (!list.some((s) => s.citation === citation)) {
        list.unshift(newBookmark);
        localStorage.setItem("alwakeelo_saved_judgments", JSON.stringify(list));
      }
    }
  } catch {}

  // Progressive backend sync
  if (typeof fetch !== "undefined") {
    try {
      await fetch("/api/saved-judgments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          citation: newBookmark.citation,
          court: newBookmark.court,
          title: newBookmark.title,
          summary: newBookmark.summary,
          keywords: ["precedent", newBookmark.court],
          source: "workstation_reader",
        }),
      });
    } catch {}
  }

  return true;
}

/**
 * Retrieves local stored bookmarks.
 */
export function getSavedJudgments(): SavedJudgmentRecord[] {
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("alwakeelo_saved_judgments");
      if (stored) return JSON.parse(stored);
    }
  } catch {}

  return [];
}
