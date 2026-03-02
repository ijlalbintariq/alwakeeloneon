import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, Loader2, ExternalLink, AlertCircle, Gavel, Sparkles, ChevronDown, ChevronUp, FileText, X, BookOpen, ShieldCheck, ShieldAlert, Eye, BookmarkPlus, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { LegalMarkdown } from "@/components/legal-markdown";
import { setJudgmentForView } from "./judgment-view";

interface CaseLawResult {
  citation: string;
  court: string;
  title: string;
  summary: string;
  keywords?: string[];
  uri?: string;
  source?: string;
}

interface JudgmentSummaryData {
  summary: string;
  fullText: string | null;
  source: string | null;
  verified: boolean;
}

interface SavedJudgment {
  id: number;
  citation: string;
  court: string;
  title: string;
  summary: string;
  keywords?: string[] | null;
  uri?: string | null;
  source?: string | null;
  aiAnalysis?: string | null;
  createdAt: string;
}

export default function JudgmentSearchPage() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [autoSearchDone, setAutoSearchDone] = useState(false);
  const [localResults, setLocalResults] = useState<CaseLawResult[]>([]);
  const [externalResults, setExternalResults] = useState<CaseLawResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExternalLoading, setIsExternalLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState<Record<number, boolean>>({});
  const [summaries, setSummaries] = useState<Record<number, JudgmentSummaryData>>({});
  const [expandedSummary, setExpandedSummary] = useState<number | null>(null);
  const [showFullText, setShowFullText] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState<"search" | "saved">("search");

  const { data: savedJudgments = [], refetch: refetchSaved } = useQuery<SavedJudgment[]>({
    queryKey: ["/api/saved-judgments"],
    enabled: activeTab === "saved",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q && !autoSearchDone) {
      setQuery(q);
      setAutoSearchDone(true);
      setTimeout(() => {
        handleSearchWithQuery(q);
      }, 100);
    }
  }, []);

  const handleSearchWithQuery = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setSearchError(null);
    setExternalResults([]);
    setSummaries({});
    setExpandedSummary(null);

    try {
      const localRes = await fetch(`/api/case-law/search?q=${encodeURIComponent(searchQuery)}`);
      const local = await localRes.json();
      setLocalResults(local.map((r: any) => ({ ...r, source: "internal" })));
    } catch { setLocalResults([]); }
    setIsLoading(false);

    setIsExternalLoading(true);
    try {
      const extRes = await apiRequest("POST", "/api/ai/search-judgments", { query: searchQuery });
      const ext = await extRes.json();
      const items = Array.isArray(ext) ? ext : (ext.judgments || ext.results || []);
      setExternalResults(items.map((r: any) => ({ ...r, source: "external" })));
    } catch (e: any) {
      console.error("[Judgment Search] AI search error:", e?.message || e);
      const isLimit = e?.message?.includes("429");
      setSearchError(isLimit ? "Monthly query limit reached. Upgrade your plan for more searches." : "AI research feed temporarily unavailable. Please try again.");
      if (isLimit) queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
    }
    setIsExternalLoading(false);

    await apiRequest("POST", "/api/search-history", { type: "judgment", query: searchQuery }).catch(() => {});
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setActiveTab("search");
    setIsLoading(true);
    setSearchError(null);
    setExternalResults([]);
    setSummaries({});
    setExpandedSummary(null);

    try {
      const localRes = await fetch(`/api/case-law/search?q=${encodeURIComponent(query)}`);
      const local = await localRes.json();
      setLocalResults(local.map((r: any) => ({ ...r, source: "internal" })));
    } catch { setLocalResults([]); }
    setIsLoading(false);

    setIsExternalLoading(true);
    try {
      const extRes = await apiRequest("POST", "/api/ai/search-judgments", { query });
      const ext = await extRes.json();
      const items = Array.isArray(ext) ? ext : (ext.judgments || ext.results || []);
      setExternalResults(items.map((r: any) => ({ ...r, source: "external" })));
    } catch (e: any) {
      console.error("[Judgment Search] AI search error:", e?.message || e);
      const isLimit = e?.message?.includes("429");
      setSearchError(isLimit ? "Monthly query limit reached. Upgrade your plan for more searches." : "AI research feed temporarily unavailable. Please try again.");
      if (isLimit) queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
    }
    setIsExternalLoading(false);

    await apiRequest("POST", "/api/search-history", { type: "judgment", query }).catch(() => {});
  };

  const handleGetSummary = async (item: CaseLawResult, idx: number) => {
    if (summaries[idx]) {
      setExpandedSummary(expandedSummary === idx ? null : idx);
      return;
    }

    setSummaryLoading(prev => ({ ...prev, [idx]: true }));
    setExpandedSummary(idx);

    try {
      const res = await apiRequest("POST", "/api/ai/judgment-summary", {
        citation: item.citation,
        title: item.title,
        court: item.court,
        summary: item.summary,
      });
      const data = await res.json();
      setSummaries(prev => ({ ...prev, [idx]: data }));
    } catch (e: any) {
      const isLimit = e?.message?.includes("429");
      setSummaries(prev => ({
        ...prev,
        [idx]: {
          summary: isLimit
            ? "Monthly query limit reached. Please upgrade your plan for more AI analyses."
            : "Failed to generate summary. Please try again.",
          fullText: null,
          source: null,
          verified: false,
        }
      }));
      if (isLimit) queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
    }

    setSummaryLoading(prev => ({ ...prev, [idx]: false }));
  };

  const handleDeleteSaved = async (id: number) => {
    try {
      await apiRequest("DELETE", `/api/saved-judgments/${id}`);
      refetchSaved();
    } catch {}
  };

  const allResults = [...localResults, ...externalResults];

  return (
    <div className="space-y-7 md:space-y-10 fade-in pb-20" data-testid="judgment-search-page">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white italic tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            Judgment Vault
          </h2>
          <p className="text-slate-500 mt-2 font-medium">Verified Chambers Vaults & Grounded Pakistani Legal Search.</p>
        </div>
        <div className="flex flex-col gap-2 w-full lg:w-[35rem]">
          <div className="flex gap-2 sm:gap-3 bg-[#1e293b] p-2.5 sm:p-3 rounded-[1.5rem] sm:rounded-[2.5rem] border border-slate-800 shadow-2xl">
            <input
              className="flex-1 bg-transparent border-none px-3 sm:px-6 py-2.5 sm:py-3 text-sm text-white focus:ring-0 focus:outline-none placeholder:text-slate-600"
              placeholder="Search case law, citations, keywords..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              data-testid="input-judgment-search"
            />
            <button
              onClick={handleSearch}
              disabled={isLoading}
              data-testid="button-judgment-search"
              className="p-3 sm:p-4 bg-amber-500 text-slate-950 rounded-[1rem] sm:rounded-[2rem] hover:bg-amber-400 transition-all shadow-xl active:scale-95"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
            </button>
          </div>
          {searchError && (
            <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2">
              <AlertCircle size={14} className="text-red-500" />
              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">{searchError}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-800 pb-0">
        <button
          onClick={() => setActiveTab("search")}
          className={`pb-3 px-1 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === "search"
              ? "text-amber-500 border-amber-500"
              : "text-slate-500 border-transparent hover:text-slate-300"
          }`}
        >
          <Search size={13} className="inline mr-2" />
          Search Results {allResults.length > 0 && `(${allResults.length})`}
        </button>
        <button
          onClick={() => { setActiveTab("saved"); refetchSaved(); }}
          className={`pb-3 px-1 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === "saved"
              ? "text-amber-500 border-amber-500"
              : "text-slate-500 border-transparent hover:text-slate-300"
          }`}
        >
          <BookmarkPlus size={13} className="inline mr-2" />
          Saved Judgments {savedJudgments.length > 0 && `(${savedJudgments.length})`}
        </button>
      </div>

      {activeTab === "search" && (
        <>
          {(allResults.length > 0 || isExternalLoading) && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 h-px bg-slate-800" />
                <h3 className="text-[11px] font-black uppercase text-slate-600 tracking-[0.5em] flex items-center gap-4">
                  Joint Intelligence Docket ({allResults.length})
                  {isExternalLoading && <Loader2 size={14} className="animate-spin text-amber-500" />}
                </h3>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                {allResults.map((item, idx) => (
                  <div
                    key={idx}
                    className={`rounded-[1.5rem] md:rounded-[3rem] shadow-2xl transition-all relative border ${
                      expandedSummary === idx ? "md:col-span-2" : ""
                    } ${
                      item.source === "external"
                        ? "bg-[#1e293b]/80 border-blue-500/10 hover:border-blue-500/30"
                        : "bg-[#1e293b] border-slate-800 hover:border-amber-500/30"
                    }`}
                    data-testid={`judgment-result-${idx}`}
                  >
                    <div className="p-4 sm:p-6 md:p-10">
                      <div className="flex flex-wrap gap-3 mb-6">
                        <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                          item.source === "external"
                            ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                            : "bg-amber-500/10 border-amber-500/20 text-amber-500"
                        }`}>
                          {item.source === "external" ? "Research Feed" : "Internal Registry"}
                        </span>
                        <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-[9px] font-black uppercase tracking-widest">
                          {item.court}
                        </span>
                      </div>
                      <h4 className="text-xl font-bold text-white mb-4 leading-snug" style={{ fontFamily: "'Playfair Display', serif" }}>
                        {item.title}
                      </h4>
                      <p className="text-[10px] text-amber-500/60 font-black uppercase tracking-widest mb-3">{item.citation}</p>
                      <p className="text-xs leading-relaxed text-slate-500 line-clamp-4 mb-6">{item.summary}</p>
                      <div className="flex flex-wrap items-center gap-3">
                        {item.uri && (
                          <a
                            href={item.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-emerald-600/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest py-3 px-5 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"
                            data-testid={`link-view-source-${idx}`}
                          >
                            <ExternalLink size={14} /> View Source
                          </a>
                        )}
                        <button
                          onClick={() => {
                            setJudgmentForView(item);
                            setLocation("/judgment-view");
                          }}
                          data-testid={`button-open-judgment-${idx}`}
                          className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest py-3 px-5 rounded-xl transition-all bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20"
                        >
                          <Eye size={14} /> Open & Chat
                        </button>
                        <button
                          onClick={() => handleGetSummary(item, idx)}
                          disabled={summaryLoading[idx]}
                          data-testid={`button-ai-summary-${idx}`}
                          className={`inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest py-3 px-5 rounded-xl transition-all ${
                            expandedSummary === idx && summaries[idx]
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20"
                          }`}
                        >
                          {summaryLoading[idx] ? (
                            <><Loader2 size={14} className="animate-spin" /> Analyzing...</>
                          ) : expandedSummary === idx && summaries[idx] ? (
                            <><ChevronUp size={14} /> Hide Analysis</>
                          ) : summaries[idx] ? (
                            <><ChevronDown size={14} /> Show Analysis</>
                          ) : (
                            <><Sparkles size={14} /> AI Analysis</>
                          )}
                        </button>
                      </div>
                    </div>

                    {expandedSummary === idx && (summaryLoading[idx] || summaries[idx]) && (
                      <div className="border-t border-slate-800" data-testid={`judgment-summary-panel-${idx}`}>
                        {summaryLoading[idx] ? (
                          <div className="p-10 flex flex-col items-center justify-center gap-4">
                            <div className="w-12 h-12 rounded-[1.5rem] bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                              <Sparkles size={20} className="text-purple-400 animate-pulse" />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                              Al Wakeelo is analyzing this judgment...
                            </p>
                          </div>
                        ) : summaries[idx] && (
                          <div className="p-8 md:p-10 space-y-8">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div className="flex flex-wrap items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                                  <Sparkles size={14} className="text-purple-400" />
                                </div>
                                <h5 className="text-[11px] font-black uppercase tracking-widest text-purple-400">
                                  AI Judgment Analysis
                                </h5>
                                {summaries[idx].verified ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" data-testid={`badge-verified-${idx}`}>
                                    <ShieldCheck size={12} /> Verified Source
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 text-amber-400" data-testid={`badge-ai-only-${idx}`}>
                                    <ShieldAlert size={12} /> AI General Knowledge
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => setExpandedSummary(null)}
                                className="p-2 rounded-xl text-slate-600 hover:text-slate-400 transition-colors"
                                data-testid={`button-close-summary-${idx}`}
                              >
                                <X size={16} />
                              </button>
                            </div>

                            <div className="prose prose-invert prose-sm max-w-none" data-testid={`text-judgment-summary-${idx}`}>
                              <LegalMarkdown content={summaries[idx].summary} />
                            </div>

                            {summaries[idx].fullText && (
                              <div className="mt-8">
                                <button
                                  onClick={() => setShowFullText(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                  data-testid={`button-full-text-${idx}`}
                                  className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest py-3 px-5 rounded-xl hover:bg-amber-500/20 transition-all"
                                >
                                  <BookOpen size={14} />
                                  {showFullText[idx] ? "Hide Full Judgment" : "View Full Judgment"}
                                  {showFullText[idx] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>

                                {summaries[idx].source && (
                                  <span className="ml-3 text-[9px] font-black uppercase tracking-widest text-emerald-500/60">
                                    <FileText size={10} className="inline mr-1" />
                                    Source: Knowledge Vault
                                  </span>
                                )}

                                {showFullText[idx] && (
                                  <div
                                    className="mt-6 p-6 md:p-8 bg-slate-900/50 border border-slate-800 rounded-[2rem] max-h-[600px] overflow-y-auto"
                                    data-testid={`text-full-judgment-${idx}`}
                                  >
                                    <pre className="whitespace-pre-wrap text-xs leading-relaxed text-slate-400 font-mono">
                                      {summaries[idx].fullText}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isLoading && !isExternalLoading && allResults.length === 0 && query && (
            <div className="py-20 text-center bg-[#1e293b]/30 border border-dashed border-slate-800 rounded-[3rem]">
              <Gavel size={48} className="mx-auto text-slate-700 mb-6" />
              <p className="text-slate-600 italic font-medium">No judgments found matching your query.</p>
            </div>
          )}
        </>
      )}

      {activeTab === "saved" && (
        <div className="space-y-6">
          {savedJudgments.length === 0 ? (
            <div className="py-20 text-center bg-[#1e293b]/30 border border-dashed border-slate-800 rounded-[3rem]">
              <BookmarkPlus size={48} className="mx-auto text-slate-700 mb-6" />
              <p className="text-slate-500 font-medium">No saved judgments yet.</p>
              <p className="text-slate-600 text-sm mt-2">Search for judgments and save them to access later.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {savedJudgments.map((saved) => (
                <div
                  key={saved.id}
                  className="bg-[#1e293b] border border-slate-800 rounded-[2rem] p-8 hover:border-amber-500/30 transition-all"
                >
                  <div className="flex flex-wrap gap-3 mb-4">
                    <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-amber-500">
                      {saved.citation}
                    </span>
                    <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-[9px] font-black uppercase tracking-widest">
                      {saved.court}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-white mb-3 leading-snug" style={{ fontFamily: "'Playfair Display', serif" }}>
                    {saved.title}
                  </h4>
                  <p className="text-xs leading-relaxed text-slate-500 line-clamp-3 mb-4">{saved.summary}</p>
                  {saved.keywords && saved.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {saved.keywords.slice(0, 5).map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-800/50 border border-slate-700 rounded text-[9px] text-slate-500">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-4">
                    <button
                      onClick={() => {
                        setJudgmentForView({
                          citation: saved.citation,
                          court: saved.court,
                          title: saved.title,
                          summary: saved.summary,
                          keywords: saved.keywords || undefined,
                          uri: saved.uri || undefined,
                          source: saved.source || undefined,
                        });
                        setLocation("/judgment-view");
                      }}
                      className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest py-2.5 px-4 rounded-xl transition-all bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20"
                    >
                      <Eye size={13} /> Open & Chat
                    </button>
                    <button
                      onClick={() => handleDeleteSaved(saved.id)}
                      className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest py-2.5 px-4 rounded-xl transition-all bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                  <p className="text-[8px] text-slate-600 mt-4 uppercase tracking-widest">
                    Saved {new Date(saved.createdAt).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
