import { useState, useMemo } from "react";
import { ScrollText, ExternalLink, ChevronDown, ChevronUp, Star, Database, Loader2 } from "lucide-react";

export interface CaseLawHit {
  id?: string;
  citation: string;
  title: string;
  court: string;
  snippet: string;
}

export interface CaseLawCardData {
  hits: CaseLawHit[];
  totalFound: number;
  queriesUsed: string[];
}

interface CaseLawCardProps {
  data: CaseLawCardData;
  /** Set of citations the AI also cited in its response. Used to mark them with a ★. */
  aiCitedCitations?: Set<string>;
  /** Click handler — opens the judgment detail page. */
  onCitationClick: (citation: string, id?: string) => void;
}

interface AiSummary {
  result: string;
  legalPrinciples: string[];
  keyFindings: string[];
  significance: string;
}

const DEFAULT_VISIBLE = 5;

/**
 * Case Law Card — raw, AI-untouched judgment results from the database.
 * Renders alongside the AI's prose so the user always sees authoritative
 * search results, even when the AI's compliance with citation rules slips.
 *
 * The component is independent: data comes straight from the tool-search SSE
 * event ({@link CaseLawCardData}), no AI processing in between.
 */
export function CaseLawCard({ data, aiCitedCitations, onCitationClick }: CaseLawCardProps) {
  const [sectionExpanded, setSectionExpanded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedHitIdx, setExpandedHitIdx] = useState<number | null>(null);
  const [summaryData, setSummaryData] = useState<Record<number, AiSummary | null>>({});
  const [summaryLoading, setSummaryLoading] = useState<Record<number, boolean>>({});
  const [resolvedJudgmentIds, setResolvedJudgmentIds] = useState<Record<number, string | null>>({});

  const normalizedCited = useMemo(() => {
    if (!aiCitedCitations) return new Set<string>();
    const out = new Set<string>();
    for (const c of aiCitedCitations) {
      out.add(String(c || "").toLowerCase().replace(/\s+/g, " ").trim());
    }
    return out;
  }, [aiCitedCitations]);

  const wasAiCited = (citation: string): boolean => {
    const k = String(citation || "").toLowerCase().replace(/\s+/g, " ").trim();
    return normalizedCited.has(k);
  };

  const handleHitClick = async (hit: CaseLawHit, idx: number) => {
    // Toggle off if already expanded
    if (expandedHitIdx === idx) {
      setExpandedHitIdx(null);
      return;
    }

    setExpandedHitIdx(idx);

    // If we already have summary data (or already attempted and got null), don't re-fetch
    if (idx in summaryData) return;

    setSummaryLoading(prev => ({ ...prev, [idx]: true }));
    try {
      // Step 1: Resolve judgmentId via /api/caseLaw/lookup or local hit.id
      let jId = resolvedJudgmentIds[idx];
      if (jId === undefined) {
        if (hit.id) {
          jId = String(hit.id);
        } else {
          const lookupRes = await fetch(`/api/caseLaw/lookup?q=${encodeURIComponent(hit.citation)}`, {
            credentials: "include",
          });
          if (lookupRes.ok) {
            const lookupData = await lookupRes.json();
            if (lookupData.found && lookupData.id) {
              jId = String(lookupData.id);
            } else {
              jId = null;
            }
          } else {
            jId = null;
          }
        }
        setResolvedJudgmentIds(prev => ({ ...prev, [idx]: jId }));
      }

      if (!jId) {
        // No judgment in DB — can't generate summary
        setSummaryData(prev => ({ ...prev, [idx]: null }));
        return;
      }

      // Step 2: Fetch AI summary
      const res = await fetch(`/api/judgments/${jId}/summary`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setSummaryData(prev => ({ ...prev, [idx]: data }));
      } else {
        setSummaryData(prev => ({ ...prev, [idx]: null }));
      }
    } catch (err) {
      console.error("Failed to fetch AI summary:", err);
      setSummaryData(prev => ({ ...prev, [idx]: null }));
    } finally {
      setSummaryLoading(prev => ({ ...prev, [idx]: false }));
    }
  };

  if (!data.hits || data.hits.length === 0) return null;

  const visible = expanded ? data.hits : data.hits.slice(0, DEFAULT_VISIBLE);
  const hasMore = data.hits.length > DEFAULT_VISIBLE;

  return (
    <div className="mt-3 mb-3 rounded-xl border border-border dark:border-cyan-500/30 bg-muted/20 dark:bg-cyan-500/5 overflow-hidden transition-all duration-300 shadow-sm shadow-cyan-950/5">
      <button
        type="button"
        onClick={() => setSectionExpanded((v) => !v)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-muted/40 dark:bg-cyan-500/10 hover:bg-muted/60 dark:hover:bg-cyan-500/15 active:bg-muted/70 dark:active:bg-cyan-500/20 transition-all duration-200 text-left group ${
          sectionExpanded ? "border-b border-border dark:border-cyan-500/20" : ""
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <Database size={14} className="text-foreground dark:text-cyan-400 group-hover:scale-110 transition-transform duration-200" />
            {!sectionExpanded && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
            )}
          </div>
          <span className="text-[11px] font-black uppercase tracking-widest text-foreground dark:text-cyan-200 font-sans">
            Case Law from Database
          </span>
          <span className="text-[10px] text-muted-foreground dark:text-cyan-300 font-mono bg-background/50 dark:bg-cyan-950/40 border border-border dark:border-cyan-500/20 px-1.5 py-0.5 rounded">
            {data.totalFound} result{data.totalFound !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground dark:text-cyan-400/60 group-hover:text-muted-foreground dark:group-hover:text-cyan-300/80 transition-colors hidden sm:inline">
            {sectionExpanded ? "Click to collapse" : "Click to view results"}
          </span>
          {sectionExpanded ? (
            <ChevronUp size={13} className="text-muted-foreground dark:text-cyan-400/80 group-hover:text-foreground dark:group-hover:text-cyan-300 transition-colors" />
          ) : (
            <ChevronDown size={13} className="text-muted-foreground dark:text-cyan-400/80 group-hover:text-foreground dark:group-hover:text-cyan-300 transition-colors" />
          )}
        </div>
      </button>

      <div
        className={`transition-all duration-300 ease-in-out ${
          sectionExpanded ? "max-h-[1200px] opacity-100 animate-in fade-in slide-in-from-top-2 duration-200" : "max-h-0 opacity-0 pointer-events-none"
        } overflow-hidden`}
      >
        <div className="p-2 space-y-1.5">
          {visible.map((hit, idx) => {
            const cited = wasAiCited(hit.citation);
            const isExpanded = expandedHitIdx === idx;
            const summary = summaryData[idx];
            const loading = summaryLoading[idx];
            const jId = resolvedJudgmentIds[idx];
            return (
              <div key={`${hit.citation}-${idx}`}>
                <button
                  type="button"
                  onClick={() => handleHitClick(hit, idx)}
                  className="w-full text-left rounded-lg bg-background/40 border border-border/50 dark:border-cyan-500/15 hover:border-primary/40 dark:hover:border-cyan-400/50 hover:bg-background/60 transition-all p-2.5 group"
                  data-testid={`case-law-card-hit-${idx}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <ScrollText size={13} className="text-foreground dark:text-cyan-400 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[12px] font-bold text-foreground dark:text-cyan-100 font-mono">
                            {hit.citation}
                          </span>
                          {cited && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/15 border border-primary/30"
                              title="AI also cited this case in its analysis"
                            >
                              <Star size={9} className="text-primary fill-amber-400" />
                              <span className="text-[8px] font-bold uppercase tracking-wider text-primary">
                                AI cited
                              </span>
                            </span>
                          )}
                        </div>
                        {hit.title && (
                          <div className="text-[11px] text-foreground mt-0.5 line-clamp-1">
                            {hit.title}
                          </div>
                        )}
                        {hit.court && (
                          <div className="text-[10px] text-muted-foreground dark:text-cyan-400/70 mt-0.5">
                            {hit.court}
                          </div>
                        )}
                        {hit.snippet && (
                          <div className="text-[10.5px] text-foreground/80 mt-1.5 line-clamp-2 leading-relaxed">
                            {hit.snippet}
                          </div>
                        )}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp
                        size={11}
                        className="text-primary mt-1 flex-shrink-0"
                      />
                    ) : (
                      <ExternalLink
                        size={11}
                        className="text-muted-foreground dark:text-cyan-400/50 group-hover:text-foreground dark:group-hover:text-cyan-300 mt-1 flex-shrink-0"
                      />
                    )}
                  </div>
                </button>

                {/* Expandable AI Summary Panel */}
                <div
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  {isExpanded && (
                    <div className="mt-1 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      {loading ? (
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-2">
                          <Loader2 size={12} className="animate-spin" /> Generating AI summary…
                        </div>
                      ) : summary ? (
                        <>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Result</span>
                            <p className="text-[11px] text-foreground mt-0.5">{summary.result}</p>
                          </div>
                          {summary.legalPrinciples.length > 0 && (
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Legal Principles</span>
                              <ul className="text-[11px] text-foreground mt-0.5 space-y-0.5">
                                {summary.legalPrinciples.map((p: string, i: number) => <li key={i}>• {p}</li>)}
                              </ul>
                            </div>
                          )}
                          {summary.keyFindings.length > 0 && (
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Key Findings</span>
                              <ul className="text-[11px] text-foreground mt-0.5 space-y-0.5">
                                {summary.keyFindings.map((f: string, i: number) => <li key={i}>• {f}</li>)}
                              </ul>
                            </div>
                          )}
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Significance</span>
                            <p className="text-[11px] text-foreground mt-0.5">{summary.significance}</p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCitationClick(hit.citation, hit.id);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline mt-1"
                          >
                            View Full Judgment → <ExternalLink size={10} />
                          </button>
                        </>
                      ) : (
                        <div className="space-y-1.5">
                          <p className="text-[10px] text-muted-foreground">Summary not available for this judgment.</p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCitationClick(hit.citation, hit.id);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                          >
                            View Full Judgment → <ExternalLink size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-foreground dark:text-cyan-300 hover:bg-muted dark:hover:bg-cyan-500/10 transition-colors flex items-center justify-center gap-1 border-t border-border dark:border-cyan-500/20"
            data-testid="case-law-card-toggle"
          >
            {expanded ? (
              <>
                <ChevronUp size={11} />
                Show top {DEFAULT_VISIBLE}
              </>
            ) : (
              <>
                <ChevronDown size={11} />
                Show all {data.hits.length}
              </>
            )}
          </button>
        )}

        {data.queriesUsed && data.queriesUsed.length > 0 && (
          <div className="px-3 py-1.5 border-t border-border dark:border-cyan-500/15 bg-background/30">
            <span className="text-[9px] text-muted-foreground dark:text-cyan-400/50 font-mono">
              Searched: {data.queriesUsed.join(" · ")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
