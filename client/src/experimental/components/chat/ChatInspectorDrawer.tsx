import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Scale,
  Gavel,
  BookOpen,
  Bookmark,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Copy,
  Check,
  FileSignature,
  Loader2,
  Search,
  X,
  ArrowUp,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export interface CitationItem {
  citation: string;
  court?: string;
  title?: string;
  snippet?: string;
  id?: string | number;
  verified?: boolean;
}

export interface StatuteItem {
  name: string;
  section?: string;
  description?: string;
}

export interface BookmarkItem {
  id: number;
  title: string;
  content: string;
  category?: string;
  createdAt?: string;
}

interface ChatInspectorDrawerProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  citations: CitationItem[];
  statutes: StatuteItem[];
  bookmarks: BookmarkItem[];
  onSelectCitation?: (citation: string, id?: string | number) => void;
  activeModelName?: string;
  activeQueryLatencyMs?: number;
  activeTurnTimestamp?: string;
}

export const ChatInspectorDrawer: React.FC<ChatInspectorDrawerProps> = ({
  isOpen,
  onToggleOpen,
  citations,
  statutes,
  bookmarks,
  onSelectCitation,
  activeModelName = "Standard Intelligence",
  activeQueryLatencyMs = 0,
  activeTurnTimestamp,
}) => {
  const [activeTab, setActiveTab] = useState<"citations" | "statutes" | "bookmarks">("citations");
  const [filterQuery, setFilterQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [verifiedMap, setVerifiedMap] = useState<Record<string, { verified: boolean; id?: number; title?: string; court?: string }>>({});
  const [verifyingMap, setVerifyingMap] = useState<Record<string, boolean>>({});
  const [expandedSnippets, setExpandedSnippets] = useState<Record<number, boolean>>({});
  const [expandedBookmarks, setExpandedBookmarks] = useState<Record<number, boolean>>({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Verify citations against /api/caseLaw/lookup
  useEffect(() => {
    citations.forEach((c) => {
      const citeStr = c.citation;
      if (!citeStr || verifiedMap[citeStr] !== undefined || verifyingMap[citeStr]) return;

      setVerifyingMap((prev) => ({ ...prev, [citeStr]: true }));
      fetch(`/api/caseLaw/lookup?q=${encodeURIComponent(citeStr)}`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : { found: false }))
        .then((data) => {
          setVerifiedMap((prev) => ({
            ...prev,
            [citeStr]: {
              verified: !!data.found,
              id: data.id,
              title: data.title,
              court: data.court,
            },
          }));
        })
        .catch(() => {
          setVerifiedMap((prev) => ({ ...prev, [citeStr]: { verified: false } }));
        })
        .finally(() => {
          setVerifyingMap((prev) => ({ ...prev, [citeStr]: false }));
        });
    });
  }, [citations, verifiedMap, verifyingMap]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setShowScrollTop(scrollContainerRef.current.scrollTop > 180);
    }
  };

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Filtered citations
  const filteredCitations = useMemo(() => {
    if (!filterQuery.trim()) return citations;
    const q = filterQuery.toLowerCase();
    return citations.filter(
      (c) =>
        c.citation.toLowerCase().includes(q) ||
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.court && c.court.toLowerCase().includes(q)) ||
        (c.snippet && c.snippet.toLowerCase().includes(q))
    );
  }, [citations, filterQuery]);

  // Filtered statutes
  const filteredStatutes = useMemo(() => {
    if (!filterQuery.trim()) return statutes;
    const q = filterQuery.toLowerCase();
    return statutes.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.section && s.section.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q))
    );
  }, [statutes, filterQuery]);

  // Filtered bookmarks
  const filteredBookmarks = useMemo(() => {
    if (!filterQuery.trim()) return bookmarks;
    const q = filterQuery.toLowerCase();
    return bookmarks.filter(
      (b) =>
        (b.title && b.title.toLowerCase().includes(q)) ||
        (b.content && b.content.toLowerCase().includes(q))
    );
  }, [bookmarks, filterQuery]);

  return (
    <aside
      className={cn(
        "flex flex-col h-full max-h-screen bg-white dark:bg-[#131E2E] transition-all duration-300 ease-in-out shrink-0 overflow-hidden relative select-none z-20",
        isOpen
          ? "w-full sm:w-[420px] md:w-[460px] lg:w-[500px] max-w-[100vw] sm:max-w-[85vw] md:max-w-[80vw] border-l border-[#E2E8F0] dark:border-[#1E2D44] shadow-2xl"
          : "w-0 border-none pointer-events-none"
      )}
    >
      {/* ── 1. Drawer Header ── */}
      <div className="px-4 py-3 border-b border-[#E2E8F0] dark:border-[#1E2D44] flex items-center justify-between gap-3 shrink-0 bg-white dark:bg-[#131E2E] min-h-[60px]">
        {isOpen && (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-[#105B38] shrink-0">
                <Gavel className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight truncate font-sans">
                  Precedent & Ratio Inspector
                </h3>
                <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] flex items-center gap-1">
                  <Scale className="w-3 h-3 text-[#105B38]" />
                  Legal Intelligence Sidecar
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={onToggleOpen}
                className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] transition-colors"
                title="Close Inspector"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {isOpen && (
        <>
          {/* ── 2. Segmented Navigation Tabs ── */}
          <div className="px-3 pt-2.5 pb-2 border-b border-[#E2E8F0] dark:border-[#1E2D44] bg-[#F8FAFC] dark:bg-[#0B131E] shrink-0">
            <div className="grid grid-cols-3 gap-1 p-1 bg-[#F1F5F9] dark:bg-[#1E2D44] rounded-xl text-xs">
              <button
                onClick={() => setActiveTab("citations")}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-semibold transition-all text-[11px] truncate",
                  activeTab === "citations"
                    ? "bg-white dark:bg-[#131E2E] text-[#105B38] shadow-xs border border-[#E2E8F0] dark:border-[#1E2D44]"
                    : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-white dark:bg-[#131E2E]/60"
                )}
              >
                <Gavel className="w-3 h-3 shrink-0" />
                <span className="truncate">Precedents ({citations.length})</span>
              </button>
              <button
                onClick={() => setActiveTab("statutes")}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-semibold transition-all text-[11px] truncate",
                  activeTab === "statutes"
                    ? "bg-white dark:bg-[#131E2E] text-[#105B38] shadow-xs border border-[#E2E8F0] dark:border-[#1E2D44]"
                    : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-white dark:bg-[#131E2E]/60"
                )}
              >
                <BookOpen className="w-3 h-3 shrink-0" />
                <span className="truncate">Statutes ({statutes.length})</span>
              </button>
              <button
                onClick={() => setActiveTab("bookmarks")}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-semibold transition-all text-[11px] truncate",
                  activeTab === "bookmarks"
                    ? "bg-white dark:bg-[#131E2E] text-[#105B38] shadow-xs border border-[#E2E8F0] dark:border-[#1E2D44]"
                    : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-white dark:bg-[#131E2E]/60"
                )}
              >
                <Bookmark className="w-3 h-3 shrink-0" />
                <span className="truncate">Saved ({bookmarks.length})</span>
              </button>
            </div>

            {/* ── 3. Quick Search / Filter Bar ── */}
            <div className="relative mt-2">
              <Search className="w-3.5 h-3.5 text-[#94A3B8] dark:text-[#475569] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder={
                  activeTab === "citations"
                    ? "Filter precedents, court, or ratio..."
                    : activeTab === "statutes"
                    ? "Filter statutes, sections, or description..."
                    : "Search saved turns..."
                }
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:text-[#475569] focus:outline-none focus:border-[#105B38] focus:ring-1 focus:ring-[#105B38]/20 transition-all"
              />
              {filterQuery && (
                <button
                  type="button"
                  onClick={() => setFilterQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* ── 4. Main Scrollable Viewport ── */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar p-3.5 sm:p-4 space-y-3.5"
          >
            {/* ══ TAB 1: Precedents & Ratios ══ */}
            {activeTab === "citations" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] px-1">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">
                    Verified Judicial Citations ({filteredCitations.length})
                  </span>
                  <span className="text-[10px] font-mono text-[#105B38] font-bold">
                    Supreme Court & High Courts
                  </span>
                </div>

                {filteredCitations.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] space-y-3 px-4 bg-[#F8FAFC] dark:bg-[#0B131E] rounded-2xl border border-dashed border-[#E2E8F0] dark:border-[#1E2D44]">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-500/20">
                      <Scale className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {filterQuery ? "No Matching Precedents Found" : "No Precedents in Current Turn"}
                      </p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-1 leading-relaxed max-w-xs mx-auto">
                        {filterQuery
                          ? "Try searching by another citation report name (e.g. SCMR, PLD, YLR) or keyword."
                          : "Ask the AI assistant about Pakistani case law to automatically extract citations and ratio decidendi here."}
                      </p>
                    </div>
                  </div>
                ) : (
                  filteredCitations.map((c, i) => {
                    const verifiedInfo = verifiedMap[c.citation];
                    const isVerifying = verifyingMap[c.citation];
                    const isVerified = verifiedInfo?.verified;
                    const isSnippetExpanded = !!expandedSnippets[i];

                    return (
                      <div
                        key={i}
                        className="p-3.5 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] hover:border-[#105B38]/40 hover:shadow-sm transition-all space-y-2.5 group"
                      >
                        {/* Precedent Citation Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
                                {c.citation}
                              </span>
                              {isVerifying ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" /> Verifying DB...
                                </span>
                              ) : isVerified ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20">
                                  <ShieldCheck className="w-3 h-3 text-[#105B38]" /> Live Database
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#F1F5F9] dark:bg-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] border border-[#E2E8F0] dark:border-[#1E2D44]">
                                  Precedent
                                </span>
                              )}
                            </div>

                            <div className="text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mt-1 leading-snug">
                              {verifiedInfo?.title || c.title || "Pakistani Judicial Precedent"}
                            </div>
                            <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] font-mono mt-0.5">
                              {verifiedInfo?.court || c.court || "Supreme Court of Pakistan"}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopy(c.citation, `cite-${i}`)}
                            className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] transition-colors shrink-0"
                            title="Copy Citation"
                          >
                            {copiedKey === `cite-${i}` ? (
                              <Check className="w-3.5 h-3.5 text-[#105B38]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Ratio Decidendi / Headnote Scrollable Box */}
                        {c.snippet && (
                          <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] p-2.5 sm:p-3 border border-[#E2E8F0] dark:border-[#1E2D44] space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-[#105B38] uppercase tracking-wider">
                              <span className="flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                Ratio Decidendi & Headnote
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedSnippets((prev) => ({ ...prev, [i]: !prev[i] }))
                                }
                                className="text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-0.5"
                              >
                                {isSnippetExpanded ? (
                                  <>
                                    <span>Collapse</span>
                                    <ChevronUp className="w-3 h-3" />
                                  </>
                                ) : (
                                  <>
                                    <span>Expand</span>
                                    <ChevronDown className="w-3 h-3" />
                                  </>
                                )}
                              </button>
                            </div>
                            <div
                              className={cn(
                                "text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed custom-scrollbar overflow-y-auto font-sans italic",
                                isSnippetExpanded ? "max-h-64" : "max-h-24 line-clamp-3"
                              )}
                            >
                              &ldquo;{c.snippet}&rdquo;
                            </div>
                          </div>
                        )}

                        {/* Interactive Deep-Links */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#F1F5F9] text-xs">
                          <Link
                            href={`/preview/judgments?q=${encodeURIComponent(c.citation)}`}
                            className="inline-flex items-center gap-1 font-semibold text-[#105B38] hover:text-[#0D4A2E] hover:underline"
                          >
                            <span>Inspect Judgment Reader</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>

                          <Link
                            href={`/preview/drafting?cite=${encodeURIComponent(c.citation)}`}
                            className="inline-flex items-center gap-1 font-semibold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] transition-colors"
                          >
                            <FileSignature className="w-3.5 h-3.5 text-[#105B38]" />
                            <span>Cite in Draft</span>
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ══ TAB 2: Statutes & Sections ══ */}
            {activeTab === "statutes" && (
              <div className="space-y-3">
                <div className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] uppercase tracking-wider text-[10px] px-1">
                  Pakistani Statutory Provisions ({filteredStatutes.length})
                </div>

                {filteredStatutes.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] space-y-3 px-4 bg-[#F8FAFC] dark:bg-[#0B131E] rounded-2xl border border-dashed border-[#E2E8F0] dark:border-[#1E2D44]">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-500/20">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {filterQuery ? "No Matching Statutes Found" : "No Statutes Detected in Turn"}
                      </p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-1 leading-relaxed max-w-xs mx-auto">
                        Referenced sections from PPC, CrPC, CPC, QSO, or Special Acts will be categorized here.
                      </p>
                    </div>
                  </div>
                ) : (
                  filteredStatutes.map((s, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] space-y-2 hover:border-[#105B38]/40 hover:shadow-xs transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                            {s.name}
                          </div>
                          {s.section && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20 mt-1">
                              Section / Article {s.section}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopy(`${s.name} ${s.section ? `Section ${s.section}` : ""}`, `stat-${i}`)}
                          className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] transition-colors shrink-0"
                          title="Copy Statute Citation"
                        >
                          {copiedKey === `stat-${i}` ? (
                            <Check className="w-3.5 h-3.5 text-[#105B38]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {s.description && (
                        <p className="text-xs text-[#475569] leading-relaxed bg-[#F8FAFC] dark:bg-[#0B131E] p-2.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44]">
                          {s.description}
                        </p>
                      )}

                      <div className="pt-1.5 border-t border-[#F1F5F9] flex items-center justify-between text-xs">
                        <Link
                          href={`/preview/statutes?q=${encodeURIComponent(s.name)}`}
                          className="inline-flex items-center gap-1 font-semibold text-[#105B38] hover:text-[#0D4A2E] hover:underline"
                        >
                          <span>Explore Statute Compendium</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ══ TAB 3: Saved Bookmarks ══ */}
            {activeTab === "bookmarks" && (
              <div className="space-y-3">
                <div className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] uppercase tracking-wider text-[10px] px-1">
                  Chambers Saved Research Bookmarks ({filteredBookmarks.length})
                </div>

                {filteredBookmarks.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] space-y-3 px-4 bg-[#F8FAFC] dark:bg-[#0B131E] rounded-2xl border border-dashed border-[#E2E8F0] dark:border-[#1E2D44]">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-500/20">
                      <Bookmark className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {filterQuery ? "No Matching Bookmarks Found" : "No Bookmarks Saved Yet"}
                      </p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-1 leading-relaxed max-w-xs mx-auto">
                        Click the bookmark icon on any AI assistant response turn to save it for immediate reference.
                      </p>
                    </div>
                  </div>
                ) : (
                  filteredBookmarks.map((b) => {
                    const isExpanded = !!expandedBookmarks[b.id];
                    return (
                      <div
                        key={b.id}
                        onClick={() => setExpandedBookmarks(prev => ({ ...prev, [b.id]: !prev[b.id] }))}
                        className="cursor-pointer p-3.5 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] space-y-2 hover:border-[#105B38]/40 hover:shadow-xs transition-all group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC] truncate">
                            {b.title || "Saved Response Turn"}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleCopy(b.content, `bm-${b.id}`); }}
                            className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] transition-colors shrink-0"
                            title="Copy Content"
                          >
                            {copiedKey === `bm-${b.id}` ? (
                              <Check className="w-3.5 h-3.5 text-[#105B38]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <div className={cn("text-xs text-[#475569] leading-relaxed bg-[#F8FAFC] dark:bg-[#0B131E] p-2.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44] font-sans whitespace-pre-wrap", isExpanded ? "" : "line-clamp-3")}>
                          {b.content}
                        </div>
                        <div className="text-center">
                          <span className="text-[10px] text-[#94A3B8] dark:text-[#475569] font-bold uppercase tracking-wider group-hover:text-[#105B38] transition-colors">
                            {isExpanded ? "Show Less" : "Click to read full"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* ── 5. Floating Scroll to Top Action Button ── */}
          {showScrollTop && (
            <button
              type="button"
              onClick={scrollToTop}
              className="absolute bottom-16 right-4 z-30 p-2 rounded-full bg-[#105B38] text-white shadow-lg hover:bg-[#0D4A2E] transition-all animate-in fade-in"
              title="Scroll to Top"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}

          {/* ── 6. Drawer Footer Status Bar ── */}
          <div className="px-4 py-2.5 border-t border-[#E2E8F0] dark:border-[#1E2D44] bg-[#F8FAFC] dark:bg-[#0B131E] text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] font-mono flex items-center justify-between shrink-0 min-h-[44px]">
            <span className="truncate">Engine: {activeModelName}</span>
            {activeQueryLatencyMs > 0 && (
              <span className="text-[#105B38] font-semibold shrink-0">
                {activeQueryLatencyMs}ms
              </span>
            )}
          </div>
        </>
      )}

      {/* Collapsed tab button when drawer is closed */}
      {!isOpen && (
        <div className="flex-1 flex flex-col items-center py-4 space-y-4">
          <button
            onClick={onToggleOpen}
            className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-500/20 transition-colors shadow-xs"
            title="Open Legal Intelligence Inspector"
          >
            <Gavel className="w-4 h-4" />
          </button>
          <div className="w-6 h-[1px] bg-[#E2E8F0]" />
          <div
            className="text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] font-mono font-bold uppercase tracking-widest -rotate-90 origin-center whitespace-nowrap mt-8"
            style={{ width: "80px" }}
          >
            Inspector
          </div>
        </div>
      )}
    </aside>
  );
};
