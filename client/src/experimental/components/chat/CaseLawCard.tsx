import React, { useState, useMemo } from "react";
import {
  ScrollText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Star,
  Database,
  Loader2,
  Sparkles,
  Gavel,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export interface CaseLawHit {
  id?: string | number;
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
  aiCitedCitations?: Set<string>;
  onCitationClick?: (citation: string, id?: string | number) => void;
  defaultExpanded?: boolean;
}

interface AiSummary {
  result: string;
  legalPrinciples: string[];
  keyFindings: string[];
  significance: string;
}

const DEFAULT_VISIBLE = 4;

export const CaseLawCard: React.FC<CaseLawCardProps> = ({
  data,
  aiCitedCitations,
  onCitationClick,
  defaultExpanded = false,
}) => {
  const [sectionExpanded, setSectionExpanded] = useState(defaultExpanded);
  const [expandedAll, setExpandedAll] = useState(false);
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
    if (expandedHitIdx === idx) {
      setExpandedHitIdx(null);
      return;
    }

    setExpandedHitIdx(idx);
    if (idx in summaryData) return;

    setSummaryLoading((prev) => ({ ...prev, [idx]: true }));
    try {
      let jId = resolvedJudgmentIds[idx];
      if (jId === undefined) {
        if (hit.id) {
          jId = String(hit.id);
        } else {
          const lookupRes = await fetch(
            `/api/caseLaw/lookup?q=${encodeURIComponent(hit.citation)}`,
            { credentials: "include" }
          );
          if (lookupRes.ok) {
            const lookupData = await lookupRes.json();
            jId = lookupData.found && lookupData.id ? String(lookupData.id) : null;
          } else {
            jId = null;
          }
        }
        setResolvedJudgmentIds((prev) => ({ ...prev, [idx]: jId }));
      }

      if (!jId) {
        setSummaryData((prev) => ({ ...prev, [idx]: null }));
        return;
      }

      const res = await fetch(`/api/judgments/${jId}/summary`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setSummaryData((prev) => ({ ...prev, [idx]: d }));
      } else {
        setSummaryData((prev) => ({ ...prev, [idx]: null }));
      }
    } catch (err) {
      console.error("Failed to fetch AI summary:", err);
      setSummaryData((prev) => ({ ...prev, [idx]: null }));
    } finally {
      setSummaryLoading((prev) => ({ ...prev, [idx]: false }));
    }
  };

  if (!data.hits || data.hits.length === 0) return null;

  const visibleHits = expandedAll ? data.hits : data.hits.slice(0, DEFAULT_VISIBLE);
  const hasMore = data.hits.length > DEFAULT_VISIBLE;

  return (
    <div className="my-3 rounded-xl border border-[#1A1A1A]/20 bg-white/70 backdrop-blur-sm overflow-hidden shadow-lg shadow-black/30 transition-all">
      {/* Header Button */}
      <button
        type="button"
        onClick={() => setSectionExpanded((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between px-3.5 py-2.5 bg-[#FAFAF9] hover:bg-[#F5F5F4] transition-all text-left group",
          sectionExpanded && "border-b border-[#1A1A1A]/15"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-[#1A1A1A]/8 border border-[#1A1A1A]/20 flex items-center justify-center text-[#1A1A1A]">
            <Database className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform duration-200" />
          </div>
          <span className="text-xs font-bold font-mono uppercase tracking-wider text-[#1A1A1A]">
            Verified Precedents from Database
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1A1A1A]/10 text-[#1A1A1A] border border-[#1A1A1A]/20">
            {data.totalFound} match{data.totalFound !== 1 ? "es" : ""}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[#666666] group-hover:text-[#1A1A1A] transition-colors">
          <span className="text-[10px] hidden sm:inline font-mono">
            {sectionExpanded ? "Collapse Precedents" : "View Precedents"}
          </span>
          {sectionExpanded ? (
            <ChevronUp className="w-4 h-4 text-[#1A1A1A]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#1A1A1A]" />
          )}
        </div>
      </button>

      {/* Accordion Content */}
      {sectionExpanded && (
        <div className="p-2 sm:p-3 space-y-2">
          {visibleHits.map((hit, idx) => {
            const isAiCited = wasAiCited(hit.citation);
            const isHitExpanded = expandedHitIdx === idx;
            const summary = summaryData[idx];
            const loading = summaryLoading[idx];

            return (
              <div
                key={`${hit.citation}-${idx}`}
                className="rounded-lg border border-[#E5E4E2] bg-[#FAFAF9] hover:border-[#D9D8D6] transition-all overflow-hidden"
              >
                <div
                  onClick={() => handleHitClick(hit, idx)}
                  className="p-3 cursor-pointer select-none space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold font-mono text-[#1A1A1A]">
                        {hit.citation}
                      </span>
                      {isAiCited && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1A1A1A]/10 border border-[#1A1A1A]/30 text-[#1A1A1A] text-[9px] font-bold uppercase tracking-wider">
                          <Star className="w-2.5 h-2.5 fill-[#1A1A1A]" />
                          AI Cited
                        </span>
                      )}
                      <span className="text-[10px] text-[#666666] font-mono">
                        {hit.court}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-[#666666] group-hover:text-[#2D2D2D] shrink-0">
                      {isHitExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-[#1A1A1A]" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </div>

                  {hit.title && (
                    <div className="text-xs font-medium text-[#2D2D2D] line-clamp-1">
                      {hit.title}
                    </div>
                  )}

                  {hit.snippet && (
                    <p className="text-[11px] text-[#666666] line-clamp-2 leading-relaxed">
                      {hit.snippet}
                    </p>
                  )}
                </div>

                {/* Expanded Ratio & AI Synthesis Panel */}
                {isHitExpanded && (
                  <div className="p-3 border-t border-[#E5E4E2] bg-black/20 space-y-2.5 text-xs">
                    {loading ? (
                      <div className="flex items-center gap-2 text-[#666666] py-2 font-mono text-[11px]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1A1A1A]" />
                        <span>Synthesizing precedent ratio from judgment repository...</span>
                      </div>
                    ) : summary ? (
                      <>
                        <div>
                          <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-[#1A1A1A]">
                            Precedent Holding / Ratio:
                          </span>
                          <p className="text-[#2D2D2D] mt-0.5 leading-relaxed">
                            {summary.result}
                          </p>
                        </div>

                        {summary.legalPrinciples?.length > 0 && (
                          <div>
                            <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-[#1A1A1A]">
                              Legal Principles Established:
                            </span>
                            <ul className="mt-1 space-y-1 text-[#4A4A4A]">
                              {summary.legalPrinciples.map((p, pIdx) => (
                                <li key={pIdx} className="flex items-start gap-1.5">
                                  <span className="text-[#1A1A1A] mt-1">•</span>
                                  <span>{p}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="pt-2 flex items-center gap-3 border-t border-[#E5E4E2]">
                          <Link
                            href={`/preview/judgments?q=${encodeURIComponent(hit.citation)}`}
                            className="inline-flex items-center gap-1 text-[11px] text-[#1A1A1A] hover:text-[#1A1A1A] font-semibold"
                          >
                            <span>Open in Full Judgment Reader</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                          <span className="text-[#999999]">·</span>
                          <Link
                            href={`/preview/drafting?cite=${encodeURIComponent(hit.citation)}`}
                            className="inline-flex items-center gap-1 text-[11px] text-[#666666] hover:text-[#666666] font-semibold"
                          >
                            <Gavel className="w-3 h-3" />
                            <span>Insert into Petition</span>
                          </Link>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between text-[11px] py-1">
                        <span className="text-[#666666]">
                          Full judgment text available in library.
                        </span>
                        <Link
                          href={`/preview/judgments?q=${encodeURIComponent(hit.citation)}`}
                          className="inline-flex items-center gap-1 text-[#1A1A1A] hover:text-[#1A1A1A] font-semibold"
                        >
                          <span>Read Full Judgment</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Show More / Less Toggle */}
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpandedAll((v) => !v)}
              className="w-full py-1.5 text-center text-[10px] font-mono uppercase tracking-widest text-[#1A1A1A] hover:text-[#1A1A1A] hover:bg-[#FAFAF9] rounded-lg border border-[#E5E4E2] transition-colors"
            >
              {expandedAll ? `Show top ${DEFAULT_VISIBLE}` : `Show all ${data.hits.length} precedents`}
            </button>
          )}

          {/* Queries Searched Footer */}
          {data.queriesUsed && data.queriesUsed.length > 0 && (
            <div className="pt-2 border-t border-[#E5E4E2] flex items-center gap-1 text-[10px] text-[#666666] font-mono">
              <span>Searched Precedent Queries:</span>
              <span className="text-[#666666]">{data.queriesUsed.join(" · ")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
