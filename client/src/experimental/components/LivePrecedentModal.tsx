import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  X,
  Scale,
  Landmark,
  FileText,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Database,
  Calendar,
  Users,
  AlertCircle,
  Loader2,
  ChevronRight,
  BookOpen,
  Share2,
  Bookmark,
  Gavel,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export interface LivePrecedentData {
  id?: string | number;
  citation: string;
  title: string;
  court: string;
  year?: number;
  bench?: string;
  decisionDate?: string | null;
  headnotes?: string;
  ratio?: string;
  legalPrinciples?: string[];
  keyFindings?: string[];
  significance?: string;
  fullText?: string;
  petitioner?: string | null;
  respondent?: string | null;
  isLiveDb?: boolean;
  citationsMade?: Array<{
    id?: number | string;
    citation?: string;
    citationText?: string;
    court?: string;
    treatment?: string;
    citationType?: string;
    contextExcerpt?: string | null;
    linkedCitation?: string | null;
    linkedTitle?: string | null;
  }>;
  citationsReceived?: Array<{
    id?: number | string;
    citation?: string;
    citationText?: string;
    court?: string;
    treatment?: string;
    citationType?: string;
    contextExcerpt?: string | null;
    linkedCitation?: string | null;
    linkedTitle?: string | null;
  }>;
}

export interface LivePrecedentModalProps {
  isOpen: boolean;
  onClose: () => void;
  citation?: string | null;
  judgmentId?: string | number | null;
  initialPrecedent?: {
    citation?: string;
    court?: string;
    year?: number;
    title?: string;
    ratio?: string;
    bench?: string;
  } | null;
}

export const LivePrecedentModal: React.FC<LivePrecedentModalProps> = ({
  isOpen,
  onClose,
  citation,
  judgmentId,
  initialPrecedent,
}) => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [activeSegment, setActiveSegment] = useState<"ratio" | "headnotes" | "fulltext" | "citations">("ratio");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LivePrecedentData | null>(null);

  const [copiedCitation, setCopiedCitation] = useState<boolean>(false);
  const [copiedRatio, setCopiedRatio] = useState<boolean>(false);

  const localSeedMatch = null;

  useEffect(() => {
    if (!isOpen) {
      setData(null);
      setError(null);
      return;
    }

    const activeCitation = citation || initialPrecedent?.citation;
    const activeId = judgmentId;

    if (!activeCitation && !activeId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    // Seed initial baseline from props or local data
    if (initialPrecedent) {
      setData({
        citation: initialPrecedent.citation || "Case Law Precedent",
        title: initialPrecedent.title || "Pakistani Superior Court Authority",
        court: initialPrecedent.court || "Supreme Court of Pakistan",
        year: initialPrecedent.year,
        ratio: initialPrecedent.ratio,
        bench: initialPrecedent.bench,
        isLiveDb: false,
      });
    }

    async function fetchLivePrecedent() {
      try {
        let liveRecord: any = null;

        // 1. Direct ID lookup if available
        if (activeId) {
          try {
            const res = await fetch(`/api/judgments/${encodeURIComponent(activeId)}`, {
              credentials: "include",
            });
            if (res.ok) {
              const resJson = await res.json();
              if (resJson && (resJson.id || resJson.citation)) {
                liveRecord = resJson;
              }
            }
          } catch {}
        }

        // 2. Citation lookup via /api/case-law/lookup
        if (!liveRecord && activeCitation) {
          try {
            const clRes = await fetch(`/api/case-law/lookup?citation=${encodeURIComponent(activeCitation)}`, {
              credentials: "include",
            });
            if (clRes.ok) {
              const clJson = await clRes.json();
              if (clJson && clJson.found && clJson.id) {
                // Fetch deep detail from /api/judgments/:id
                const deepRes = await fetch(`/api/judgments/${clJson.id}`, {
                  credentials: "include",
                });
                if (deepRes.ok) {
                  liveRecord = await deepRes.json();
                } else {
                  liveRecord = {
                    id: clJson.id,
                    citation: clJson.citation,
                    court: clJson.court,
                    title: clJson.title,
                    headnotes: clJson.summary,
                    fullText: clJson.summary,
                  };
                }
              }
            }
          } catch {}
        }

        // 3. Fallback to public caseLaw lookup if still not found
        if (!liveRecord && activeCitation && activeCitation.length >= 5) {
          try {
            const pubRes = await fetch(`/api/caseLaw/lookup?q=${encodeURIComponent(activeCitation)}`, {
              credentials: "include",
            });
            if (pubRes.ok) {
              const pubJson = await pubRes.json();
              if (pubJson && pubJson.found) {
                if (pubJson.id) {
                  const detailRes = await fetch(`/api/judgments/${pubJson.id}`, {
                    credentials: "include",
                  });
                  if (detailRes.ok) {
                    liveRecord = await detailRes.json();
                  }
                }
                if (!liveRecord && pubJson.judgment) {
                  liveRecord = {
                    id: pubJson.id,
                    citation: pubJson.judgment.citation,
                    title: pubJson.judgment.title,
                    court: pubJson.judgment.court,
                    decisionDate: pubJson.judgment.decisionDate,
                  };
                }
              }
            }
          } catch {}
        }

        // 4. Try fetching raw text snippet if needed
        let rawSnippet = "";
        if (activeCitation) {
          try {
            const textRes = await fetch(`/api/judgment-text?citation=${encodeURIComponent(activeCitation)}`, {
              credentials: "include",
            });
            if (textRes.ok) {
              const textJson = await textRes.json();
              if (textJson && textJson.text) {
                rawSnippet = textJson.text;
              }
            }
          } catch {}
        }

        if (!isMounted) return;

        if (liveRecord) {
          setData({
            id: liveRecord.id,
            citation: liveRecord.citation || liveRecord.citationString || activeCitation || "Authority",
            title: liveRecord.title || initialPrecedent?.title || "Judicial Landmark",
            court: liveRecord.court || liveRecord.courtNameSnapshot || initialPrecedent?.court || "Supreme Court of Pakistan",
            year: liveRecord.year || initialPrecedent?.year || 2024,
            bench: liveRecord.bench || liveRecord.courtNameSnapshot || initialPrecedent?.bench,
            decisionDate: liveRecord.decisionDate,
            headnotes: liveRecord.headnotes || liveRecord.summary || initialPrecedent?.ratio || "Headnotes recorded in law report.",
            ratio: liveRecord.ratio || liveRecord.headnotes || initialPrecedent?.ratio || liveRecord.summary,
            legalPrinciples: liveRecord.aiSummary?.legalPrinciples || liveRecord.legalPrinciples,
            keyFindings: liveRecord.aiSummary?.keyFindings || liveRecord.keyFindings,
            significance: liveRecord.aiSummary?.significance || liveRecord.significance,
            fullText: liveRecord.fullText || rawSnippet || liveRecord.headnotes || liveRecord.summary,
            petitioner: liveRecord.petitioner,
            respondent: liveRecord.respondent,
            citationsMade: liveRecord.citations?.made || liveRecord.citationsMade || [],
            citationsReceived: liveRecord.citations?.received || liveRecord.citationsReceived || [],
            isLiveDb: true,
          });
        } else if (!initialPrecedent) {
          setError("No matching precedent found in live database for this citation.");
        }
      } catch (err: any) {
        if (isMounted && !data) {
          setError(err.message || "Failed to load live precedent details");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchLivePrecedent();

    return () => {
      isMounted = false;
    };
  }, [isOpen, citation, judgmentId, initialPrecedent]);

  if (!isOpen) return null;

  const currentPrecedent = data || {
    citation: citation || initialPrecedent?.citation || "Authority",
    title: initialPrecedent?.title || "Judicial Landmark Authority",
    court: initialPrecedent?.court || "Supreme Court of Pakistan",
    year: initialPrecedent?.year || 2024,
    ratio: initialPrecedent?.ratio || "Binding legal ratio under Pakistan Superior Judiciary jurisprudence.",
    headnotes: initialPrecedent?.ratio,
    isLiveDb: false,
  };

  // 1. Copy Citation Action
  const handleCopyCitation = () => {
    const text = `${currentPrecedent.citation} — ${currentPrecedent.title} (${currentPrecedent.court}${
      currentPrecedent.year ? `, ${currentPrecedent.year}` : ""
    })`;
    navigator.clipboard.writeText(text);
    setCopiedCitation(true);
    setTimeout(() => setCopiedCitation(false), 2000);
    toast({
      title: "Citation Copied",
      description: `Copied "${currentPrecedent.citation}" to clipboard.`,
    });
  };

  // 2. Copy Legal Ratio Action
  const handleCopyRatio = () => {
    const ratioText =
      currentPrecedent.ratio ||
      currentPrecedent.headnotes ||
      `Held in ${currentPrecedent.citation}: Legal principle established by ${currentPrecedent.court}.`;
    navigator.clipboard.writeText(
      `[${currentPrecedent.citation} - ${currentPrecedent.court}]\n"${ratioText}"`
    );
    setCopiedRatio(true);
    setTimeout(() => setCopiedRatio(false), 2000);
    toast({
      title: "Legal Ratio Copied",
      description: `Copied ratio decidendi for ${currentPrecedent.citation} to clipboard.`,
    });
  };

  // 3. Insert Precedent into Drafting Studio (Triple-Bridge)
  const handleInsertIntoDrafting = () => {
    const ratioSnippet =
      currentPrecedent.ratio ||
      currentPrecedent.headnotes ||
      "Settled ratio decidendi established by the Superior Courts of Pakistan.";

    const formattedClause = `AUTHORITATIVE CASE LAW & LEGAL RATIO:
Citation: ${currentPrecedent.citation}
Title: ${currentPrecedent.title}
Court: ${currentPrecedent.court} ${currentPrecedent.year ? `(${currentPrecedent.year})` : ""}
${currentPrecedent.bench ? `Bench: ${currentPrecedent.bench}\n` : ""}${
      currentPrecedent.decisionDate ? `Date of Decision: ${new Date(currentPrecedent.decisionDate).toLocaleDateString("en-GB")}\n` : ""
    }
HEADNOTES & RATIO DECIDENDI:
"${ratioSnippet.replace(/\n+/g, " ")}"

LEGAL SUBMISSION & GROUNDS:
1. That under the binding precedent of the Superior Judiciary reported as ${currentPrecedent.citation} (${currentPrecedent.title}), the legal principle laid down squarely supports the petitioner's stance.
2. That the ratio decidendi established in the cited authority has reached finality and is binding upon all subordinate courts under Articles 189/201 of the Constitution of Pakistan.`;

    const payload = {
      statute: currentPrecedent.court,
      section: currentPrecedent.citation,
      title: currentPrecedent.title,
      clause: formattedClause,
      timestamp: Date.now(),
    };

    localStorage.setItem("alwakeelo_drafting_insert", JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("alwakeelo-drafting-insert", { detail: payload }));
    onClose();
    setLocation("/preview/drafting");

    toast({
      title: "Precedent Inserted into Drafting Studio",
      description: `Transferred ${currentPrecedent.citation} and ratio decidendi to the drafting canvas.`,
    });
  };

  // 4. Open in Judgments Workstation
  const handleOpenInJudgments = () => {
    onClose();
    const query = currentPrecedent.citation || currentPrecedent.title;
    setLocation(`/preview/judgments?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-[#131E2E] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-500/20 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-500/20 bg-linear-to-r from-slate-50 to-white">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-[#105B38] text-white text-xs font-bold font-mono shadow-2xs">
                  {currentPrecedent.citation}
                </span>

                {currentPrecedent.isLiveDb ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 inline-flex items-center gap-1.5 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <Database className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Live Database Record</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-500/20 inline-flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-slate-500" />
                    <span>Compendium Landmark</span>
                  </span>
                )}

                {currentPrecedent.year && (
                  <span className="text-xs text-slate-500 font-mono">
                    Year: {currentPrecedent.year}
                  </span>
                )}
              </div>

              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">
                {currentPrecedent.title}
              </h2>

              <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                <span className="flex items-center gap-1 font-semibold text-[#105B38]">
                  <Landmark className="w-3.5 h-3.5" />
                  {currentPrecedent.court}
                </span>
                {currentPrecedent.bench && (
                  <span className="flex items-center gap-1 text-slate-500">
                    <Users className="w-3.5 h-3.5" />
                    {currentPrecedent.bench}
                  </span>
                )}
                {currentPrecedent.decisionDate && (
                  <span className="flex items-center gap-1 text-slate-500 font-mono">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(currentPrecedent.decisionDate).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 transition-all shrink-0"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Hub Buttons Toolbar */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-500/20 flex-wrap">
            {/* 1. Copy Citation */}
            <button
              onClick={handleCopyCitation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#131E2E] hover:bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500/20 text-xs font-semibold text-slate-800 dark:text-slate-400 shadow-2xs transition-all"
            >
              {copiedCitation ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Citation</span>
                </>
              )}
            </button>

            {/* 2. Copy Legal Ratio */}
            <button
              onClick={handleCopyRatio}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#131E2E] hover:bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500/20 text-xs font-semibold text-slate-800 dark:text-slate-400 shadow-2xs transition-all"
            >
              {copiedRatio ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">Ratio Copied!</span>
                </>
              ) : (
                <>
                  <Scale className="w-3.5 h-3.5 text-[#105B38]" />
                  <span>Copy Legal Ratio</span>
                </>
              )}
            </button>

            {/* 3. Insert into Drafting Studio */}
            <button
              onClick={handleInsertIntoDrafting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Insert into Drafting</span>
            </button>

            {/* 4. Open in Judgments Workstation */}
            <button
              onClick={handleOpenInJudgments}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 dark:text-slate-400 transition-all ml-auto"
            >
              <span>Full Workstation</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Modal Segment Navigation */}
        <div className="flex items-center gap-2 px-5 sm:px-6 pt-3 pb-2 border-b border-slate-200 dark:border-slate-500/20 bg-slate-50/70 dark:bg-slate-500/10 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveSegment("ratio")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all",
              activeSegment === "ratio"
                ? "bg-white dark:bg-[#131E2E] text-[#105B38] shadow-2xs border border-slate-200 dark:border-slate-500/20"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            )}
          >
            Ratio Decidendi & Principles
          </button>
          <button
            onClick={() => setActiveSegment("headnotes")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all",
              activeSegment === "headnotes"
                ? "bg-white dark:bg-[#131E2E] text-[#105B38] shadow-2xs border border-slate-200 dark:border-slate-500/20"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            )}
          >
            Statutory Headnotes
          </button>
          {currentPrecedent.fullText && (
            <button
              onClick={() => setActiveSegment("fulltext")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all",
                activeSegment === "fulltext"
                  ? "bg-white dark:bg-[#131E2E] text-[#105B38] shadow-2xs border border-slate-200 dark:border-slate-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              Verbatim Text Excerpt
            </button>
          )}
          {((currentPrecedent.citationsMade && currentPrecedent.citationsMade.length > 0) ||
            (currentPrecedent.citationsReceived && currentPrecedent.citationsReceived.length > 0)) && (
            <button
              onClick={() => setActiveSegment("citations")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all",
                activeSegment === "citations"
                  ? "bg-white dark:bg-[#131E2E] text-[#105B38] shadow-2xs border border-slate-200 dark:border-slate-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              Citations Graph ({ (currentPrecedent.citationsMade?.length || 0) + (currentPrecedent.citationsReceived?.length || 0) })
            </button>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto max-h-[58vh] space-y-5 custom-scrollbar bg-white dark:bg-[#131E2E]">
          {loading && !data && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#105B38]" />
              <p className="text-xs font-semibold">Querying Live PostgreSQL Precedent Database...</p>
            </div>
          )}

          {error && !data && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-900 dark:text-amber-300">Precedent Lookup Note</p>
                <p className="text-xs text-amber-800 dark:text-amber-400 mt-0.5">{error}</p>
                <button
                  onClick={handleOpenInJudgments}
                  className="mt-2 text-xs font-bold text-[#105B38] hover:underline inline-flex items-center gap-1"
                >
                  <span>Search across full Judgments Workstation</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Segment 1: Ratio Decidendi & Legal Principles */}
          {activeSegment === "ratio" && (
            <div className="space-y-4">
              {/* Primary Ratio Quote Box */}
              <div className="p-5 rounded-2xl bg-linear-to-br from-emerald-50/60 to-slate-50 border border-emerald-200 dark:border-emerald-500/20/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-[#105B38]" />
                    <span>Binding Ratio Decidendi</span>
                  </span>
                  <span className="text-[11px] font-mono text-emerald-800 dark:text-emerald-400 font-semibold">
                    {currentPrecedent.court}
                  </span>
                </div>
                <blockquote className="text-sm text-slate-800 dark:text-slate-400 font-serif italic leading-relaxed pl-4 border-l-3 border-[#105B38]">
                  "{currentPrecedent.ratio || currentPrecedent.headnotes || "Settled ratio decidendi established in this authority."}"
                </blockquote>
              </div>

              {/* Legal Principles List if available */}
              {currentPrecedent.legalPrinciples && currentPrecedent.legalPrinciples.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Gavel className="w-3.5 h-3.5 text-[#105B38]" />
                    <span>Key Legal Principles Established</span>
                  </h4>
                  <div className="space-y-2">
                    {currentPrecedent.legalPrinciples.map((principle, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500/20 text-xs text-slate-800 dark:text-slate-400 flex items-start gap-2.5"
                      >
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 dark:text-emerald-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="leading-relaxed">{principle}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Case Parties */}
              {(currentPrecedent.petitioner || currentPrecedent.respondent) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {currentPrecedent.petitioner && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500/20">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                        Petitioner / Appellant
                      </span>
                      <p className="text-xs font-bold text-slate-900">{currentPrecedent.petitioner}</p>
                    </div>
                  )}
                  {currentPrecedent.respondent && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500/20">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                        Respondent / State
                      </span>
                      <p className="text-xs font-bold text-slate-900">{currentPrecedent.respondent}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Segment 2: Headnotes */}
          {activeSegment === "headnotes" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#105B38]" />
                  <span>Verbatim Law Report Headnotes</span>
                </h4>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500/20 text-xs text-slate-800 dark:text-slate-400 font-serif leading-relaxed whitespace-pre-line select-text">
                {currentPrecedent.headnotes || currentPrecedent.ratio || "No detailed headnotes available for this record."}
              </div>
            </div>
          )}

          {/* Segment 3: Verbatim Text Excerpt */}
          {activeSegment === "fulltext" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#105B38]" />
                  <span>Judgment Text Excerpt</span>
                </h4>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500/20 text-xs text-slate-800 dark:text-slate-400 font-mono leading-relaxed max-h-[350px] overflow-y-auto whitespace-pre-wrap select-text custom-scrollbar">
                {currentPrecedent.fullText || "Full text not available."}
              </div>
            </div>
          )}

          {/* Segment 4: Citations Graph */}
          {activeSegment === "citations" && (
            <div className="space-y-4">
              {currentPrecedent.citationsMade && currentPrecedent.citationsMade.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
                    Authorities Cited In This Judgment ({currentPrecedent.citationsMade.length})
                  </h4>
                  <div className="space-y-2">
                    {currentPrecedent.citationsMade.map((cit, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500/20 text-xs flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-[#105B38] font-mono block truncate">
                            {cit.citation || cit.citationText}
                          </span>
                          {cit.contextExcerpt && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
                              {cit.contextExcerpt}
                            </p>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 dark:text-slate-400 shrink-0">
                          {cit.treatment || cit.citationType || "cited"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentPrecedent.citationsReceived && currentPrecedent.citationsReceived.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
                    Subsequent Judgments Citing This Case ({currentPrecedent.citationsReceived.length})
                  </h4>
                  <div className="space-y-2">
                    {currentPrecedent.citationsReceived.map((cit, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500/20 text-xs flex items-center justify-between gap-3"
                      >
                        <span className="font-bold text-[#105B38] font-mono">
                          {cit.citation || cit.citationText}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:text-blue-400 shrink-0">
                          {cit.treatment || cit.citationType || "followed"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-500/20 bg-slate-50 dark:bg-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-[#105B38]" />
            <span>Alwakeelo Case Law & Superior Courts Precedents Engine</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white dark:bg-[#131E2E] hover:bg-slate-100 border border-slate-200 dark:border-slate-500/20 text-slate-700 dark:text-slate-400 font-semibold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
