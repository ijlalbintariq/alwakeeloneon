import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { PreviewShell } from "@/experimental/components/PreviewShell";
import {
  Gavel,
  Search,
  BookOpen,
  Filter,
  ExternalLink,
  Shield,
  Layers,
  ChevronRight,
  Sparkles,
  Bookmark,
  BookmarkCheck,
  Calendar,
  Scale,
  FolderTree,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Zap,
  Clock,
  ArrowRight,
  X,
  FileText,
  MessageSquare,
  Network,
  Copy,
  Check,
  Download,
  Share2,
  Maximize2,
  ShieldAlert,
  FileEdit,
  PenTool,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  PinpointCitationParser,
  parsePakistaniCitation,
} from "@/experimental/components/judgments/PinpointCitationParser";
import { DirectoryBrowser } from "@/experimental/components/judgments/DirectoryBrowser";
import {
  JudgmentReader,
  JudgmentDetailData,
} from "@/experimental/components/judgments/JudgmentReader";
import { PrecedentCitationItem } from "@/experimental/components/judgments/OverruledAlertBanner";
import { PrecedentGraph } from "@/experimental/components/judgments/PrecedentGraph";

import {
  searchJudgments,
  lookupCitation,
  getJudgmentDetail,
  saveJudgmentBookmark,
  getSavedJudgments,
  formatRatioOrHeadnotes,
  createDraftingInsertPayload,
  dispatchDraftingInsert,
  hydrateCitationGraph,
  UnifiedJudgmentResult,
  SavedJudgmentRecord,
} from "@/experimental/lib/judgmentApiClient";
import { useToast } from "@/hooks/use-toast";

type CaseLawSearchResult = UnifiedJudgmentResult;

const LAW_JOURNALS = ["All", "PLD", "SCMR", "LHC", "CLC", "PCrLJ", "YLR", "MLD", "CLD", "PTD", "PLC", "SCLR", "SCP"];

const COURTS_LIST = [
  "All Courts",
  "Supreme Court of Pakistan",
  "Lahore High Court",
  "Sindh High Court",
  "Islamabad High Court",
  "Peshawar High Court",
  "High Court of Balochistan",
  "Federal Shariat Court",
];

const YEARS_LIST = ["All Years", "2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018", "2012", "1955"];

export const PreviewJudgments: React.FC = () => {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, routeParams] = useRoute("/preview/judgments/:id");

  // Navigation tab: search | pinpoint | directory | bookmarks
  const [activeTab, setActiveTab] = useState<"search" | "pinpoint" | "directory" | "bookmarks">("search");

  // Two-Tier Search State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedJournal, setSelectedJournal] = useState<string>("All");
  const [selectedCourt, setSelectedCourt] = useState<string>("All Courts");
  const [selectedYear, setSelectedYear] = useState<string>("All Years");
  const [sortOrder, setSortOrder] = useState<"relevance" | "latest" | "most_cited">("relevance");
  const [searchResults, setSearchResults] = useState<UnifiedJudgmentResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchFallbackActive, setSearchFallbackActive] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMoreResults, setHasMoreResults] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // Active Selected Judgment for Full-Text Reader
  const [selectedJudgmentId, setSelectedJudgmentId] = useState<string | null>(routeParams?.id || null);
  const [activeJudgmentDetail, setActiveJudgmentDetail] = useState<JudgmentDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Standalone Precedent Graph Modal State
  const [graphModalTarget, setGraphModalTarget] = useState<UnifiedJudgmentResult | null>(null);

  // Inline Ratio Expansion Set (for card inline view)
  const [expandedRatioIds, setExpandedRatioIds] = useState<Set<string>>(new Set());

  // Copied citation feedback
  const [copiedCitationId, setCopiedCitationId] = useState<string | null>(null);

  const [bookmarkCourtFilter, setBookmarkCourtFilter] = useState<string>("All");

  // Saved Bookmarks Query from Backend
  const { data: serverSavedJudgments = [], refetch: refetchSaved } = useQuery<SavedJudgmentRecord[]>({
    queryKey: ["/api/saved-judgments"],
    queryFn: async () => {
      const res = await fetch("/api/saved-judgments", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) return [];
        throw new Error("Failed to fetch saved judgments");
      }
      return res.json();
    },
  });

  const allSavedJudgments = serverSavedJudgments;

  const addBookmarkMutation = useMutation({
    mutationFn: async (target: any) => {
      const res = await fetch("/api/saved-judgments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          citation: target.citation,
          court: target.court || "Pakistani Court",
          title: target.title || "Legal Precedent Authority",
          summary: target.headnotes || target.summary || "Bookmarked authority.",
          keywords: ["precedent"],
        }),
      });
      if (!res.ok) throw new Error("Failed to save bookmark");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/saved-judgments"] })
  });

  const removeBookmarkMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/saved-judgments/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete bookmark");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/saved-judgments"] })
  });

  // Check if active judgment is bookmarked
  const isCurrentBookmarked = useMemo(() => {
    if (!activeJudgmentDetail) return false;
    return allSavedJudgments.some(
      (s) => s.citation === activeJudgmentDetail.citation || s.title === activeJudgmentDetail.title
    );
  }, [activeJudgmentDetail, allSavedJudgments]);

  // Insert into Legal Drafting Studio Action Bridge
  const handleInsertIntoDrafting = (
    caseItem: Partial<UnifiedJudgmentResult | JudgmentDetailData | SavedJudgmentRecord>
  ) => {
    const payload = createDraftingInsertPayload(caseItem);
    dispatchDraftingInsert(payload);
    toast({
      title: "Inserted into Drafting Studio",
      description: `Affixed "${caseItem.citation || "Precedent"}" into Legal Drafting Studio.`,
    });
    setLocation("/preview/drafting");
  };

  // Open Standalone Graph Modal with fully hydrated edges
  const handleOpenGraphModal = async (caseItem: UnifiedJudgmentResult) => {
    // Show a loading toast because fetching the graph might take a second
    toast({
      title: "Loading Precedent Graph...",
      description: "Hydrating citation network from the database.",
    });

    try {
      // We must fetch the full detail because search results don't contain the citation edges
      const detail = await getJudgmentDetail(String(caseItem.judgmentId || caseItem.id));
      
      const edges = hydrateCitationGraph(
        caseItem.citation,
        detail?.citations?.made || caseItem.citationsMade,
        detail?.citations?.received || caseItem.citationsReceived,
        detail?.fullText
      );

      setGraphModalTarget({
        ...caseItem,
        citationsMade: edges.made,
        citationsReceived: edges.received,
      });
    } catch (err) {
      console.error("Failed to load graph edges:", err);
      toast({
        title: "Graph Loading Failed",
        description: "Could not hydrate the citation network for this case.",
        variant: "destructive"
      });
    }
  };

  // Load Judgment details by ID with Two-Tier Resilient Fallback
  const loadJudgmentById = useCallback(async (id: string) => {
    if (!id) return;
    setSelectedJudgmentId(id);
    setLoadingDetail(true);
    setDetailError(null);

    try {
      const detail = await getJudgmentDetail(id);
      if (detail) {
        setActiveJudgmentDetail(detail);
      } else {
        throw new Error(`Judgment not found (${id})`);
      }
    } catch (err: any) {
      console.error("Failed to load judgment detail:", err);
      toast({
        title: "Error Loading Judgment",
        description: err?.message || "The requested case could not be loaded.",
        variant: "destructive"
      });
      setActiveJudgmentDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // Sync with route params if provided
  useEffect(() => {
    if (routeParams?.id && routeParams.id !== selectedJudgmentId) {
      loadJudgmentById(routeParams.id);
    }
  }, [routeParams?.id, loadJudgmentById, selectedJudgmentId]);

  // Two-Tier Search Execution
  const handleExecuteTwoTierSearch = async (
    overrideQuery?: string,
    overrideJournal?: string,
    overrideCourt?: string,
    overrideYear?: string,
    page: number = 1
  ) => {
    if (isSearching || isLoadingMore) return;
    const q = (overrideQuery !== undefined ? overrideQuery : searchQuery).trim();
    const journalToUse = overrideJournal !== undefined ? overrideJournal : selectedJournal;
    const courtToUse = overrideCourt !== undefined ? overrideCourt : selectedCourt;
    const yearToUse = overrideYear !== undefined ? overrideYear : selectedYear;
    
    if (page === 1) {
      setIsSearching(true);
      setHasSearched(true);
      setCurrentPage(1);
      setSearchResults([]);
    } else {
      setIsLoadingMore(true);
      setCurrentPage(page);
    }
    setSearchError(null);
    setSearchFallbackActive(false);

    try {
      const yearFilter = yearToUse === "All Years" ? undefined : yearToUse;
      const dynamicSortOrder = !q ? "latest" : sortOrder;
      
      const results = await searchJudgments({
        query: q,
        journal: journalToUse,
        court: courtToUse,
        year: yearFilter,
        sort: dynamicSortOrder,
        limit: 25,
        offset: (page - 1) * 25,
      });

      setSearchResults(prev => page === 1 ? results : [...prev, ...results]);
      setHasMoreResults(results.length >= 25);
    } catch (err: any) {
      console.error("Search execution error:", err);
      setSearchError(err?.message || "Search failed. Please try again.");
    } finally {
      setIsSearching(false);
      setIsLoadingMore(false);
    }
  };

  // Pinpoint Citation Search Execution
  const handlePinpointSearch = async (params: {
    year: number;
    journal?: string;
    page: number;
    court?: string;
  }) => {
    setIsSearching(true);
    setSearchError(null);
    setSearchFallbackActive(false);
    setHasSearched(true);

    try {
      const match = await lookupCitation(params);
      if (match) {
        setSearchResults([match]);
        // Automatically load into reader!
        loadJudgmentById(String(match.judgmentId || match.id));
      } else {
        setSearchResults([]);
        setSearchError("No judgment found matching this pinpoint citation.");
      }
    } catch (err: any) {
      console.error("Pinpoint citation search error:", err);
      setSearchError(err?.message || "No judgment found matching this pinpoint citation.");
    } finally {
      setIsSearching(false);
      setIsLoadingMore(false);
    }
  };

  // Toggle bookmark / save judgment
  const handleToggleBookmark = async (
    target: JudgmentDetailData | UnifiedJudgmentResult | SavedJudgmentRecord
  ) => {
    const citation = target.citation;
    const existing = allSavedJudgments.find((s) => s.citation === citation);

    if (existing) {
      // Remove bookmark
      removeBookmarkMutation.mutate(existing.id as number);
      toast({
        title: "Bookmark Removed",
        description: `Removed "${citation}" from Chambers Bookmarks Vault.`,
      });
    } else {
      // Add bookmark
      addBookmarkMutation.mutate(target);
      toast({
        title: "Precedent Saved",
        description: `"${citation}" saved to Chambers Bookmarks Vault.`,
      });
    }
  };

  // Copy citation with feedback
  const handleCopyCitation = (id: string, citation: string) => {
    navigator.clipboard.writeText(citation).then(() => {
      setCopiedCitationId(id);
      setTimeout(() => setCopiedCitationId(null), 2000);
      toast({
        title: "Citation Copied",
        description: `"${citation}" copied to clipboard.`,
      });
    });
  };

  // Toggle inline ratio expansion
  const toggleRatioExpansion = (id: string) => {
    setExpandedRatioIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Batch Export Bookmarks
  const handleBatchExportBookmarks = () => {
    if (allSavedJudgments.length === 0) {
      toast({
        title: "No Bookmarks",
        description: "Your Chambers Bookmarks Vault is currently empty.",
      });
      return;
    }

    const lines: string[] = [
      `================================================================`,
      `AL WAKEELO — COUNSEL'S SAVED PRECEDENTS VAULT EXPORT`,
      `================================================================`,
      `Total Saved Authorities: ${allSavedJudgments.length}`,
      `Exported: ${new Date().toLocaleString("en-PK")}`,
      ``,
    ];

    allSavedJudgments.forEach((b, idx) => {
      lines.push(`[${idx + 1}] ${b.citation}`);
      lines.push(`    Court: ${b.court}`);
      lines.push(`    Title: ${b.title}`);
      lines.push(`    Summary: ${b.summary}`);
      lines.push(`    Saved Date: ${new Date(b.createdAt).toLocaleDateString("en-PK")}`);
      lines.push(`----------------------------------------------------------------`);
    });

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AlWakeelo_Chambers_Bookmarks_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Bookmarks Exported",
      description: `Downloaded ${allSavedJudgments.length} precedents summary.`,
    });
  };

  // Initial prompt lookup if query parameter `q` is in URL
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const q = searchParams.get("q");
    if (q) {
      setSearchQuery(q);
      handleExecuteTwoTierSearch(q);
    } else {
      // Default to empty search
      handleExecuteTwoTierSearch("");
    }
  }, []);

  return (
    <PreviewShell>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Research Header */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight flex items-center gap-2.5">
                <Gavel className="w-6 h-6 text-[#105B38]" />
                <span>Pakistani Legal Library & Citation Graph Engine</span>
              </h1>
              <p className="text-xs sm:text-sm text-[#64748B] mt-1">
                Over 600,000+ verified Supreme Court & High Court judgments with interactive precedent treatment graphs and Article 189/201 ratio extraction
              </p>
            </div>

            {/* Quick Stats or Action */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-emerald-50 text-[#105B38] border border-emerald-200 shadow-xs">
                600k+ Precedents Indexed
              </span>
            </div>
          </div>

          {/* Navigation Tabs Switcher */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#E2E8F0] text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveTab("search");
                setSelectedJudgmentId(null);
                setActiveJudgmentDetail(null);
              }}
              className={cn(
                "px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 shadow-xs",
                activeTab === "search"
                  ? "bg-[#105B38] text-white shadow-sm"
                  : "bg-[#F8FAFC] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] border border-[#E2E8F0]"
              )}
            >
              <Search className="w-4 h-4" />
              <span>Legal Library</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("pinpoint");
                setSelectedJudgmentId(null);
                setActiveJudgmentDetail(null);
              }}
              className={cn(
                "px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 shadow-xs",
                activeTab === "pinpoint"
                  ? "bg-[#105B38] text-white shadow-sm"
                  : "bg-[#F8FAFC] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] border border-[#E2E8F0]"
              )}
            >
              <Scale className="w-4 h-4" />
              <span>Pinpoint Citation Lookup</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("directory");
                setSelectedJudgmentId(null);
                setActiveJudgmentDetail(null);
              }}
              className={cn(
                "px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 shadow-xs",
                activeTab === "directory"
                  ? "bg-[#105B38] text-white shadow-sm"
                  : "bg-[#F8FAFC] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] border border-[#E2E8F0]"
              )}
            >
              <FolderTree className="w-4 h-4" />
              <span>Court Hierarchy Directory</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("bookmarks");
                setSelectedJudgmentId(null);
                setActiveJudgmentDetail(null);
              }}
              className={cn(
                "px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 shadow-xs",
                activeTab === "bookmarks"
                  ? "bg-[#105B38] text-white shadow-sm"
                  : "bg-[#F8FAFC] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] border border-[#E2E8F0]"
              )}
            >
              <Bookmark className="w-4 h-4" />
              <span>Chambers Bookmarks Vault ({allSavedJudgments.length})</span>
            </button>
          </div>
        </div>

        {/* Dynamic Content View Area */}
        {loadingDetail ? (
          <div className="py-24 rounded-2xl bg-white border border-[#E2E8F0] flex flex-col items-center justify-center gap-3 text-[#64748B] font-mono text-xs shadow-xs">
            <Loader2 className="w-7 h-7 text-[#105B38] animate-spin" />
            <span className="font-bold text-sm text-[#0F172A]">Loading judgment precedent record & citation graph...</span>
          </div>
        ) : activeJudgmentDetail ? (
          /* Full-Text Judgment Reader View */
          <JudgmentReader
            judgment={activeJudgmentDetail}
            onBack={() => {
              setSelectedJudgmentId(null);
              setActiveJudgmentDetail(null);
            }}
            onSelectJudgment={(id) => loadJudgmentById(id)}
            isBookmarked={isCurrentBookmarked}
            onToggleBookmark={handleToggleBookmark}
          />
        ) : activeTab === "pinpoint" ? (
          /* Pinpoint Citation Tab */
          <div className="space-y-5">
            <PinpointCitationParser
              onSearchCitation={handlePinpointSearch}
              loading={isSearching}
            />

            {/* Results for Pinpoint Lookup */}
            {hasSearched && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[#64748B] font-mono">
                  <span>Pinpoint Matches: {searchResults.length}</span>
                </div>

                {searchResults.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-white border border-[#E2E8F0] text-[#64748B] space-y-2 shadow-xs">
                    <AlertTriangle className="w-8 h-8 mx-auto text-amber-500" />
                    <p className="text-xs font-bold text-[#0F172A]">No judgment found matching this pinpoint citation.</p>
                    <p className="text-[11px] text-[#94A3B8]">Verify the journal volume, year, and page number.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {searchResults.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#105B38]/50 hover:shadow-md transition-all space-y-3.5 group"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              {item.court}
                            </span>
                            <span className="font-mono font-bold text-xs bg-[#F8FAFC] px-2.5 py-0.5 rounded-md border border-[#E2E8F0] text-[#0F172A]">
                              {item.citation}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#105B38] border border-emerald-200 uppercase">
                            Verified Citation
                          </span>
                        </div>

                        <h3 className="font-bold text-[#0F172A] text-sm sm:text-base group-hover:text-[#105B38] transition-colors leading-snug">
                          {item.title}
                        </h3>
                        <p className="text-xs text-[#64748B] leading-relaxed line-clamp-3">
                          {item.summary}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#94A3B8] pt-3 border-t border-[#E2E8F0]">
                          <span>{item.decisionDate ? new Date(item.decisionDate).toLocaleDateString("en-PK") : "Date Recorded"}</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (item.judgmentId || item.id) {
                                loadJudgmentById(String(item.judgmentId || item.id));
                              }
                            }}
                            className="px-4 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs"
                          >
                            <span>Open Full Judgment</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === "directory" ? (
          /* Directory Browser Tab */
          <DirectoryBrowser onSelectJudgment={(id) => loadJudgmentById(id)} />
        ) : activeTab === "bookmarks" ? (
          /* Bookmarked Precedents Tab */
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                  <Bookmark className="w-5 h-5 text-[#105B38]" />
                  <span>Counsel&apos;s Chambers Bookmarks Vault</span>
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Your curated repository of binding High Court and Supreme Court authorities for quick pleading citations
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBatchExportBookmarks}
                  className="px-3.5 py-1.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Batch Export</span>
                </button>
                <span className="text-xs font-mono font-bold text-[#105B38] px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  {allSavedJudgments.length} Saved Precedents
                </span>
              </div>
            </div>

            {allSavedJudgments.length === 0 ? (
              <div className="py-16 text-center rounded-2xl bg-white border border-[#E2E8F0] space-y-2 text-[#64748B] shadow-xs">
                <Bookmark className="w-8 h-8 mx-auto text-[#CBD5E1]" />
                <p className="text-xs font-bold text-[#0F172A]">No bookmarks saved yet.</p>
                <p className="text-[11px] text-[#94A3B8]">While reading any judgment or reviewing search results, click &quot;Bookmark&quot; to pin it to your chambers vault.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {allSavedJudgments.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#105B38]/50 hover:shadow-md transition-all space-y-3 group shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {item.court}
                        </span>
                        <span className="font-mono font-bold text-xs bg-[#F8FAFC] px-2.5 py-0.5 rounded-md border border-[#E2E8F0] text-[#0F172A]">
                          {item.citation}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyCitation(String(item.id), item.citation)}
                          className="text-xs text-[#64748B] hover:text-[#0F172A] font-semibold flex items-center gap-1 p-1"
                          title="Copy Citation"
                        >
                          {copiedCitationId === String(item.id) ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedCitationId === String(item.id) ? "Copied" : "Copy"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleBookmark(item as any)}
                          className="text-xs text-[#94A3B8] hover:text-rose-600 transition-colors font-medium p-1"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <h3 className="font-bold text-[#0F172A] text-sm sm:text-base leading-snug">{item.title}</h3>
                    <p className="text-xs text-[#64748B] leading-relaxed line-clamp-2">{item.summary}</p>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#94A3B8] pt-3 border-t border-[#E2E8F0]">
                      <span>Saved: {new Date(item.createdAt).toLocaleDateString("en-PK")}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleInsertIntoDrafting(item)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#105B38] border border-emerald-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                          title="Insert Precedent & Ratio into Legal Drafting Studio"
                        >
                          <FileEdit className="w-3.5 h-3.5" />
                          <span>Insert into Drafting</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery(item.citation);
                            handleExecuteTwoTierSearch(item.citation);
                            setActiveTab("search");
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold transition-all flex items-center gap-1 shadow-xs"
                        >
                          <span>Open Judgment</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Default: Two-Tier Search Tab with Filter Sidebar & Rich Cards */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Left Filter Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              {/* Bookmarks Quick Pill */}
              <button
                type="button"
                onClick={() => setActiveTab("bookmarks")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#105B38]/40 hover:shadow-xs transition-all text-left shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <Bookmark className="w-4 h-4 text-[#105B38]" />
                  <span className="text-xs font-bold text-[#0F172A]">Chambers Bookmarks</span>
                </div>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#105B38] border border-emerald-200">
                  {allSavedJudgments.length}
                </span>
              </button>

              {/* Jurisdiction / Cases Group */}
              <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                    <Gavel className="w-3.5 h-3.5 text-[#105B38]" />
                    Court Jurisdiction
                  </span>
                </div>
                <div className="space-y-1.5">
                  {COURTS_LIST.map((court) => (
                    <button
                      type="button"
                      key={court}
                      onClick={() => {
                        setSelectedCourt(court);
                        handleExecuteTwoTierSearch(undefined, undefined, court);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-xl text-xs transition-all font-medium",
                        selectedCourt === court
                          ? "bg-[#105B38] text-white font-bold shadow-xs"
                          : "bg-white text-[#475569] hover:bg-[#F8FAFC] border border-[#E2E8F0]"
                      )}
                    >
                      {court}
                    </button>
                  ))}
                </div>
              </div>

              {/* Codes & Acts Group */}
              <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3">
                <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-[#105B38]" />
                  Statutes & Quick Codes
                </span>
                <div className="space-y-1.5">
                  {[
                    "Constitution Article 199 Writs",
                    "CrPC Section 497 Bail",
                    "CPC Section 115 Revisions",
                    "Specific Relief Act S. 12",
                    "Companies Act 2017",
                    "Income Tax Ordinance S. 122",
                    "Industrial Relations Act 2012",
                  ].map((code) => (
                    <button
                      type="button"
                      key={code}
                      onClick={() => {
                        setSelectedJournal("All");
                        setSelectedCourt("All Courts");
                        setSelectedYear("All Years");
                        setSearchQuery(code);
                        handleExecuteTwoTierSearch(code, "All", "All Courts", "All Years");
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium bg-white hover:bg-[#F8FAFC] text-[#475569] hover:text-[#105B38] border border-[#E2E8F0] transition-all"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Main Search Results (3 Cols) */}
            <div className="lg:col-span-3 space-y-4">
              {/* Search Bar with Mode Toggle */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center px-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] focus-within:border-[#105B38] focus-within:bg-white shadow-xs transition-all">
                    <Search className="w-4 h-4 text-[#94A3B8] mr-2.5 flex-shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by Case Title, Legal Issue, Citation (e.g. 2024 SCMR 892), Justice..."
                      className="w-full h-11 bg-transparent text-xs sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none font-medium"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleExecuteTwoTierSearch();
                      }}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          handleExecuteTwoTierSearch("");
                        }}
                        className="p-1 text-[#94A3B8] hover:text-[#0F172A]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleExecuteTwoTierSearch()}
                    disabled={isSearching}
                    className="px-6 py-3 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
                  >
                    {isSearching ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-white" />
                    )}
                    <span>Search</span>
                  </button>
                </div>

                {/* Filter Tags Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E2E8F0]">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-[11px] font-bold text-[#64748B] mr-1">Law Journal:</span>
                    {LAW_JOURNALS.map((j) => (
                      <button
                        type="button"
                        key={j}
                        onClick={() => {
                          setSelectedJournal(j);
                          handleExecuteTwoTierSearch(undefined, j, undefined, undefined);
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all",
                          selectedJournal === j
                            ? "bg-[#105B38] text-white font-bold shadow-xs"
                            : "bg-[#F8FAFC] text-[#475569] hover:bg-[#F1F5F9] border border-[#E2E8F0]"
                        )}
                      >
                        {j}
                      </button>
                    ))}
                  </div>

                  {/* Year Dropdown */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-[11px] font-bold text-[#64748B]">Year:</span>
                    <select
                      value={selectedYear}
                      onChange={(e) => {
                        const newYear = e.target.value;
                        setSelectedYear(newYear);
                        handleExecuteTwoTierSearch(undefined, undefined, undefined, newYear);
                      }}
                      className="h-8 px-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-mono font-medium text-[#0F172A] focus:outline-none focus:border-[#105B38]"
                    >
                      {YEARS_LIST.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Search Results List */}
              {isSearching ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#64748B] font-mono text-xs shadow-xs rounded-2xl bg-white border border-[#E2E8F0]">
                  <Loader2 className="w-6 h-6 text-[#105B38] animate-spin" />
                  <span>Searching 600,000+ Pakistani Precedent Records...</span>
                </div>
              ) : searchError ? (
                <div className="py-16 text-center rounded-2xl bg-red-50 border border-red-100 space-y-2 text-red-600 shadow-xs">
                  <AlertTriangle className="w-8 h-8 mx-auto text-red-500" />
                  <p className="text-xs font-bold">Search Failed</p>
                  <p className="text-[11px] opacity-80">{searchError}</p>
                </div>
              ) : hasSearched && searchResults.length === 0 ? (
                <div className="py-16 text-center rounded-2xl bg-white border border-[#E2E8F0] space-y-2 text-[#64748B] shadow-xs">
                  <Layers className="w-8 h-8 mx-auto text-[#CBD5E1]" />
                  <p className="text-xs font-bold text-[#0F172A]">No judgments found matching the query.</p>
                  <p className="text-[11px] text-[#94A3B8]">Try broader keywords or clear journal filters.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-[#64748B]">
                    <span className="font-bold text-[#0F172A]">
                      {hasSearched ? `Found ${searchResults.length} reported precedents` : "Leading Landmark Jurisprudence"}
                    </span>
                  </div>

                  {/* List of Judgment Cards */}
                  <div className="grid grid-cols-1 gap-4">
                    {searchResults.map((caseItem, idx) => {
                      const caseId = String(caseItem.judgmentId || caseItem.id || `case-${idx}`);
                      const isOverturned = caseItem.treatment === "overruled" || caseItem.citation === "PLD 1955 FC 240";
                      const isRatioExpanded = expandedRatioIds.has(caseId);
                      const isItemBookmarked = allSavedJudgments.some(
                        (s) => s.citation === caseItem.citation || s.title === caseItem.title
                      );

                      return (
                        <div
                          key={caseId}
                          className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#105B38]/50 hover:shadow-md transition-all space-y-4 shadow-xs group"
                        >
                          {/* Header: Court pill + Citation + Treatment Badge */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                {caseItem.court}
                              </span>
                              <span className="font-mono font-bold text-xs bg-[#F8FAFC] px-2.5 py-0.5 rounded-md border border-[#E2E8F0] text-[#0F172A]">
                                {caseItem.citation}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {isOverturned ? (
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase bg-rose-50 text-rose-700 border-rose-200 flex items-center gap-1 animate-pulse">
                                  <ShieldAlert className="w-3 h-3" />
                                  Overruled Authority
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase bg-emerald-50 text-[#105B38] border-emerald-200">
                                  Good Law
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Title */}
                          <h3 className="font-bold text-[#0F172A] text-sm sm:text-base leading-snug group-hover:text-[#105B38] transition-colors">
                            {caseItem.title}
                          </h3>

                          {/* Judge / Bench Info */}
                          {caseItem.bench && (
                            <div className="flex items-center gap-2 text-xs font-semibold text-[#475569]">
                              <Gavel className="w-3.5 h-3.5 text-[#105B38] shrink-0" />
                              <span>Honorable Bench: <span className="text-[#0F172A]">{caseItem.bench}</span></span>
                            </div>
                          )}

                          {/* Summary / Headnotes snippet */}
                          <p className="text-xs text-[#64748B] leading-relaxed line-clamp-3">
                            {caseItem.summary}
                          </p>

                          {/* Inline Ratio Decidendi Accordion (if expanded) */}
                          {isRatioExpanded && caseItem.ratioDecidendi && (
                            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs animate-in fade-in">
                              <h4 className="font-bold text-[#0F172A] flex items-center gap-1.5 text-xs">
                                <Scale className="w-3.5 h-3.5 text-[#105B38]" />
                                <span>Ratio Decidendi Summary</span>
                              </h4>
                              <p className="text-[#334155] font-medium">{caseItem.ratioDecidendi.result}</p>
                              {caseItem.ratioDecidendi.legalPrinciples?.length > 0 && (
                                <ul className="space-y-1 text-[#475569] pl-2 list-disc list-inside">
                                  {caseItem.ratioDecidendi.legalPrinciples.slice(0, 2).map((p: string, pIdx: number) => (
                                    <li key={pIdx}>{p}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}

                          {/* Result Card Action Buttons Toolbar */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-[#E2E8F0]">
                            {/* Action Buttons Group */}
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              {/* 1. Read Judgment Button */}
                              <button
                                type="button"
                                onClick={() => loadJudgmentById(caseId)}
                                className="px-3.5 py-1.5 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>Read Case</span>
                              </button>

                              {/* 2. View Graph Button (Opens Graph Modal with hydrated edges) */}
                              <button
                                type="button"
                                onClick={() => handleOpenGraphModal(caseItem)}
                                className="px-3 py-1.5 rounded-xl bg-[#F8FAFC] hover:bg-emerald-50 hover:text-[#105B38] text-[#334155] border border-[#E2E8F0] font-semibold text-xs transition-all flex items-center gap-1.5 shadow-xs"
                              >
                                <Network className="w-3.5 h-3.5 text-[#105B38]" />
                                <span>View Graph</span>
                              </button>

                              {/* 3. Ratio Decidendi Toggle Button */}
                              <button
                                type="button"
                                onClick={() => toggleRatioExpansion(caseId)}
                                className={cn(
                                  "px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs",
                                  isRatioExpanded
                                    ? "bg-emerald-50 text-[#105B38] border-emerald-200 font-bold"
                                    : "bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#334155] border-[#E2E8F0]"
                                )}
                              >
                                <Scale className="w-3.5 h-3.5" />
                                <span>Ratio</span>
                              </button>

                              {/* 4. Bookmark / Save Button */}
                              <button
                                type="button"
                                onClick={() => handleToggleBookmark(caseItem)}
                                className={cn(
                                  "p-2 rounded-xl border text-xs transition-all shadow-xs",
                                  isItemBookmarked
                                    ? "bg-[#105B38] text-white border-[#105B38]"
                                    : "bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] border-[#E2E8F0]"
                                )}
                                title={isItemBookmarked ? "Bookmarked" : "Save to Chambers Bookmarks"}
                              >
                                {isItemBookmarked ? (
                                  <BookmarkCheck className="w-3.5 h-3.5" />
                                ) : (
                                  <Bookmark className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {/* 5. Copy Citation Button */}
                              <button
                                type="button"
                                onClick={() => handleCopyCitation(caseId, caseItem.citation)}
                                className="p-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0] transition-all shadow-xs"
                                title="Copy Formal Citation"
                              >
                                {copiedCitationId === caseId ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {/* 6. AI Summary Shortcut Button */}
                              <button
                                type="button"
                                onClick={() => loadJudgmentById(caseId)}
                                className="px-3 py-1.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] hover:text-[#105B38] border border-[#E2E8F0] text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
                                title="Open in Reader & AI Sidecar"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-[#105B38]" />
                                <span>AI Summary</span>
                              </button>

                              {/* 7. Insert into Legal Drafting Studio Button */}
                              <button
                                type="button"
                                onClick={() => handleInsertIntoDrafting(caseItem)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#105B38] border border-emerald-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                                title="Insert Precedent & Ratio into Legal Drafting Studio"
                              >
                                <FileEdit className="w-3.5 h-3.5" />
                                <span>Drafting</span>
                              </button>
                            </div>

                            <span className="text-[11px] font-mono text-[#94A3B8]">
                              {caseItem.decisionDate
                                ? new Date(caseItem.decisionDate).toLocaleDateString("en-PK")
                                : "Reported Case"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Pagination / Load More */}
                  {hasMoreResults && !isSearching && searchResults.length > 0 && (
                    <div className="flex justify-center pt-4 pb-12">
                      <button
                        type="button"
                        onClick={() => handleExecuteTwoTierSearch(undefined, undefined, undefined, undefined, currentPage + 1)}
                        disabled={isLoadingMore}
                        className="px-6 py-2.5 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#105B38] text-[#0F172A] text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                      >
                        {isLoadingMore ? (
                          <><Loader2 className="w-4 h-4 animate-spin text-[#105B38]" /> Loading more records...</>
                        ) : (
                          <>Load Next 25 Judgments</>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Standalone Precedent Graph Modal (when clicking 'View Graph' from any result card) */}
        {graphModalTarget && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in">
            <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-[#CBD5E1]">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <div className="flex items-center gap-2">
                  <Network className="w-5 h-5 text-[#105B38]" />
                  <div>
                    <h3 className="font-bold text-[#0F172A] text-base">
                      Precedent Citation Graph: {graphModalTarget.citation}
                    </h3>
                    <p className="text-xs text-[#64748B]">{graphModalTarget.title}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setGraphModalTarget(null)}
                  className="p-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Precedent Graph Instance */}
              <PrecedentGraph
                currentCitation={graphModalTarget.citation}
                currentTitle={graphModalTarget.title}
                citationsMade={graphModalTarget.citationsMade || []}
                citationsReceived={graphModalTarget.citationsReceived || []}
                onSelectJudgment={(targetId) => {
                  setGraphModalTarget(null);
                  loadJudgmentById(targetId);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </PreviewShell>
  );
};

export default PreviewJudgments;
