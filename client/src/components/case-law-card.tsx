import { useState, useMemo } from "react";
import { ScrollText, ExternalLink, ChevronDown, ChevronUp, Star, Database } from "lucide-react";

export interface CaseLawHit {
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
  onCitationClick: (citation: string) => void;
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
  const [expanded, setExpanded] = useState(false);

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

  if (!data.hits || data.hits.length === 0) return null;

  const visible = expanded ? data.hits : data.hits.slice(0, DEFAULT_VISIBLE);
  const hasMore = data.hits.length > DEFAULT_VISIBLE;

  return (
    <div className="mt-3 mb-3 rounded-xl border border-border dark:border-cyan-500/30 bg-muted/30 dark:bg-cyan-500/5 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border dark:border-cyan-500/20 bg-muted/50 dark:bg-cyan-500/10">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-foreground dark:text-cyan-400" />
          <span className="text-[11px] font-black uppercase tracking-widest text-foreground dark:text-cyan-200">
            Case Law from Database
          </span>
          <span className="text-[10px] text-muted-foreground dark:text-cyan-300/70 font-mono">
            {data.totalFound} result{data.totalFound !== 1 ? "s" : ""}
          </span>
        </div>
        <span className="text-[9px] text-muted-foreground dark:text-cyan-400/60 italic">
          Direct DB results · no AI processing
        </span>
      </div>

      <div className="p-2 space-y-1.5">
        {visible.map((hit, idx) => {
          const cited = wasAiCited(hit.citation);
          return (
            <button
              key={`${hit.citation}-${idx}`}
              type="button"
              onClick={() => onCitationClick(hit.citation)}
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
                <ExternalLink
                  size={11}
                  className="text-muted-foreground dark:text-cyan-400/50 group-hover:text-foreground dark:group-hover:text-cyan-300 mt-1 flex-shrink-0"
                />
              </div>
            </button>
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
  );
}
