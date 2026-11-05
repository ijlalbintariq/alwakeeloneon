export interface CitationItem {
  id?: string | number;
  citationText?: string | null;
  linkedCitation?: string | null;
  linkedJudgmentId?: string | number | null;
  citationType?: string;
}

export type JudgmentCitations = CitationItem[] | { made?: CitationItem[]; received?: CitationItem[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JOURNALS = "PLD|SCMR|YLR|MLD|CLC|PLJ|NLR|PCRLJ|PCrLJ|PTCL|PTD|PLCCS|PLC|PSC|ALD|KLR|SLS|GBLR|CLD|AIR";
const COURTS = "SC|FC|FSC|LHC|SHC|IHC|PHC|BHC|Supreme\\s+Court|High\\s+Court|Lahore|Karachi|Islamabad|Peshawar|Quetta|Multan|Rawalpindi|Bahawalpur|Abbottabad|Faisalabad|Hyderabad|Sukkur";

export const PAKISTANI_CITATION_REGEX = new RegExp(
  `\\b(?:(?:(?:19|20)\\d{2}\\s+(?:${JOURNALS})|(?:${JOURNALS})\\s+(?:19|20)\\d{2})(?:\\s+(?:${COURTS}))?\\s+\\d{1,5})\\b`,
  "gi",
);

export function normalizeCitationToken(raw: string): string {
  return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function buildJudgmentCitationMap(citations?: JudgmentCitations): Map<string, string> {
  const map = new Map<string, string>();
  const ambiguous = new Set<string>();
  const list = Array.isArray(citations)
    ? citations
    : [...(citations?.made || []), ...(citations?.received || [])];

  for (const item of list) {
    const id = String(item.linkedJudgmentId || "").trim().toLowerCase();
    // citationText names the cited case; on incoming edges the linked ID names the citing case.
    const key = normalizeCitationToken(item.linkedCitation || "");
    if (!UUID.test(id) || !key || ambiguous.has(key)) continue;
    if (map.has(key) && map.get(key) !== id) {
      map.delete(key);
      ambiguous.add(key);
    } else {
      map.set(key, id);
    }
  }
  return map;
}

export function judgmentCitationHref(citation: string, citationMap?: Map<string, string>): string {
  const clean = citation.trim().replace(/\s+/g, " ");
  const id = citationMap?.get(normalizeCitationToken(clean));
  return id && UUID.test(id)
    ? `/judgment/${id}`
    : `/citation-search?q=${encodeURIComponent(clean)}`;
}
