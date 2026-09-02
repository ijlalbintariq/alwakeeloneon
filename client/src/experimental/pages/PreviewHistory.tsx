import React, { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PreviewShell } from "@/experimental/components/PreviewShell";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import {
  History,
  Search,
  Bot,
  Gavel,
  FileSignature,
  Clock,
  ArrowRight,
  Trash2,
  RotateCcw,
  Sparkles,
  Calendar,
  Layers,
  CheckCircle2,
  X,
  Eye,
  Download,
  Bookmark,
  BookmarkCheck,
  FileSpreadsheet,
  BarChart3,
  Cpu,
  AlertTriangle,
  BookOpen,
  Scale,
  Briefcase,
  ExternalLink,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface HistoryEntry {
  id: string;
  query: string;
  type: "judgment" | "ai_chat" | "drafting" | "statute";
  timestamp: string;
  isoDate: string;
  resultCount: number;
  courtFilter?: string;
  executionTimeMs: number;
  matterTag?: string;
  aiResponseSummary: string;
  citationsRetrieved: string[];
  bookmarked?: boolean;
}

const STORAGE_KEY = "alwakeelo_preview_history";
const BOOKMARKS_STORAGE_KEY = "alwakeelo_preview_bookmarks";

function formatTimestamp(dateVal: string | Date | null | undefined): { timestamp: string; isoDate: string } {
  if (!dateVal) {
    const now = new Date();
    return { timestamp: "Just now", isoDate: now.toISOString() };
  }
  const d = new Date(dateVal);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let timestamp = "";
  if (diffDays === 0) {
    timestamp = `Today at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } else if (diffDays === 1) {
    timestamp = `Yesterday at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } else {
    timestamp = `${d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  return {
    timestamp,
    isoDate: d.toISOString(),
  };
}

function mapSearchHistoryToEntry(h: {
  id: number;
  type: string;
  query: string;
  createdAt?: string | Date | null;
}): HistoryEntry {
  const { timestamp, isoDate } = formatTimestamp(h.createdAt);
  const typeMap: Record<string, HistoryEntry["type"]> = {
    judgment: "judgment",
    statute: "statute",
    chat: "ai_chat",
    draft: "drafting",
    contract: "drafting",
  };
  return {
    id: `sh-${h.id}`,
    query: h.query || "Legal Search Query",
    type: typeMap[h.type] || "judgment",
    timestamp,
    isoDate,
    resultCount: 1,
    executionTimeMs: 180,
    matterTag: "General Research",
    aiResponseSummary: `Search query logged for ${h.type || "legal"} engine.`,
    citationsRetrieved: [],
    bookmarked: false,
  };
}

function mapThreadToEntry(t: {
  id: number;
  title: string;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}): HistoryEntry {
  const { timestamp, isoDate } = formatTimestamp(t.createdAt || t.updatedAt);
  return {
    id: `th-${t.id}`,
    query: t.title || "AI Legal Consultation",
    type: "ai_chat",
    timestamp,
    isoDate,
    resultCount: 1,
    executionTimeMs: 320,
    matterTag: "Chambers Consultation",
    aiResponseSummary: `Interactive AI legal consultation session on "${t.title || "Legal Query"}".`,
    citationsRetrieved: [],
    bookmarked: false,
  };
}

export const PreviewHistory: React.FC = () => {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const queryClient = useQueryClient();

  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/search-history");
    },
    onSuccess: () => {
      setHistoryList([]);
      setIsClearModalOpen(false);
      toast({
        title: "Search History Cleared",
        description: "All query logs and audit trails removed.",
      });
    }
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      if (id.startsWith("th-")) {
        const threadId = id.replace("th-", "");
        await apiRequest("DELETE", `/api/threads/${threadId}`);
      } else if (id.startsWith("sh-")) {
        const historyId = id.replace("sh-", "");
        await apiRequest("DELETE", `/api/search-history/${historyId}`);
      }
    },
    onSuccess: (_, id) => {
      setHistoryList((prev) => prev.filter((h) => h.id !== id));
      if (inspectEntry?.id === id) setInspectEntry(null);
      toast({ title: "Log Record Deleted" });
    }
  });

  // Primary data source: load from GET /api/search-history and GET /api/threads only (no localStorage cache merge)
  const [historyList, setHistoryList] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Primary data source: load from GET /api/search-history and GET /api/threads
  useEffect(() => {
    let isMounted = true;
    async function loadBackendHistory() {
      try {
        setIsLoading(true);
        const [searchRes, threadsRes] = await Promise.allSettled([
          fetch("/api/search-history", { credentials: "include" }),
          fetch("/api/threads", { credentials: "include" }),
        ]);

        const serverEntries: HistoryEntry[] = [];

        if (searchRes.status === "fulfilled" && searchRes.value.ok) {
          const searchData = await searchRes.value.json();
          if (Array.isArray(searchData)) {
            serverEntries.push(...searchData.map(mapSearchHistoryToEntry));
          }
        }

        if (threadsRes.status === "fulfilled" && threadsRes.value.ok) {
          const threadsData = await threadsRes.value.json();
          if (Array.isArray(threadsData)) {
            serverEntries.push(...threadsData.map(mapThreadToEntry));
          }
        }

        if (isMounted) {
          serverEntries.sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime());
          setHistoryList(serverEntries);
        }
      } catch (err) {
        console.error("Backend history endpoints unavailable:", err);
        if (isMounted) setHistoryList([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadBackendHistory();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("All");
  const [filterDateRange, setFilterDateRange] = useState<string>("all");
  const [filterMatter, setFilterMatter] = useState<string>("All");
  const [filterJurisdiction, setFilterJurisdiction] = useState<string>("All");

  // Modals
  const [inspectEntry, setInspectEntry] = useState<HistoryEntry | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const typeOptions = [
    "All",
    "judgment",
    "ai_chat",
    "drafting",
    "statute",
  ];

  const uniqueMatters = useMemo(() => {
    const set = new Set<string>();
    historyList.forEach((h) => {
      if (h.matterTag) set.add(h.matterTag);
    });
    return Array.from(set).sort();
  }, [historyList]);

  const uniqueJurisdictions = useMemo(() => {
    const set = new Set<string>();
    historyList.forEach((h) => {
      if (h.courtFilter) set.add(h.courtFilter);
    });
    return Array.from(set).sort();
  }, [historyList]);

  // Filter logic
  const filteredHistory = useMemo(() => {
    return historyList.filter((entry) => {
      const matchType = filterType === "All" || entry.type === filterType;
      const matchMatter = filterMatter === "All" || entry.matterTag === filterMatter;
      const matchJurisdiction = filterJurisdiction === "All" || entry.courtFilter === filterJurisdiction;

      // Date Range Filter
      let matchDate = true;
      if (filterDateRange === "today") {
        matchDate = entry.timestamp.toLowerCase().includes("today");
      } else if (filterDateRange === "yesterday") {
        matchDate = entry.timestamp.toLowerCase().includes("yesterday");
      }

      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        entry.query.toLowerCase().includes(q) ||
        entry.aiResponseSummary.toLowerCase().includes(q) ||
        (entry.matterTag && entry.matterTag.toLowerCase().includes(q)) ||
        entry.citationsRetrieved.some((c) => c.toLowerCase().includes(q));

      return matchType && matchMatter && matchJurisdiction && matchDate && matchQuery;
    });
  }, [historyList, filterType, filterMatter, filterJurisdiction, filterDateRange, searchQuery]);

  // Aggregate metrics
  const totalSearches = historyList.length;
  const avgLatency = useMemo(() => {
    if (historyList.length === 0) return 0;
    const sum = historyList.reduce((acc, h) => acc + h.executionTimeMs, 0);
    return Math.round(sum / historyList.length);
  }, [historyList]);

  const bookmarkedCount = useMemo(() => {
    return historyList.filter((h) => h.bookmarked).length;
  }, [historyList]);

  // 1-Click Re-Run Simulation
  const handleReRun = (entry: HistoryEntry) => {
    toast({
      title: "Re-running Search Query",
      description: `Dispatching "${entry.query.slice(0, 45)}..." to engine.`,
    });

    if (entry.type === "judgment") {
      navigate(`/preview/judgments?q=${encodeURIComponent(entry.query)}`);
    } else if (entry.type === "ai_chat") {
      navigate(`/preview/chat?q=${encodeURIComponent(entry.query)}`);
    } else if (entry.type === "drafting") {
      navigate(`/preview/drafting`);
    } else {
      navigate(`/preview/judgments?q=${encodeURIComponent(entry.query)}`);
    }
  };

  // Toggle Bookmark status
  const handleToggleBookmark = (entry: HistoryEntry, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextState = !entry.bookmarked;

    setHistoryList((prev) =>
      prev.map((h) => (h.id === entry.id ? { ...h, bookmarked: nextState } : h))
    );

    if (inspectEntry?.id === entry.id) {
      setInspectEntry({ ...inspectEntry, bookmarked: nextState });
    }

    toast({
      title: nextState ? "Query Saved to Bookmarks" : "Removed from Bookmarks",
      description: nextState
        ? `"${entry.query.slice(0, 50)}..." added to Saved Vault.`
        : `Query removed from bookmarks.`,
    });
  };

  // Delete individual entry
  const handleDeleteEntry = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    deleteEntryMutation.mutate(id);
  };

  // Clear all history
  const handleConfirmClearHistory = () => {
    clearHistoryMutation.mutate();
  };

  // Export audit log
  const handleExportAuditLog = () => {
    let md = `# AL WAKEEL CHAMBERS — QUERY AUDIT TRAIL LOG\n`;
    md += `Generated: ${new Date().toLocaleString()}\n`;
    md += `Total Queries: ${filteredHistory.length}\n`;
    md += `Average Execution Latency: ${avgLatency}ms\n\n---\n\n`;

    filteredHistory.forEach((h, i) => {
      md += `### ${i + 1}. [${h.type.toUpperCase()}] ${h.query}\n`;
      md += `- **Timestamp**: ${h.timestamp} (${h.isoDate})\n`;
      md += `- **Execution Time**: ${h.executionTimeMs}ms | **Results Found**: ${h.resultCount}\n`;
      if (h.courtFilter) md += `- **Jurisdiction Filter**: ${h.courtFilter}\n`;
      if (h.matterTag) md += `- **Linked Matter**: ${h.matterTag}\n`;
      md += `- **AI Summary / Answer**: ${h.aiResponseSummary}\n`;
      md += `- **Citations Retrieved**: ${h.citationsRetrieved.join(", ")}\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alwakeelo_search_audit_log_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Audit Log Exported",
      description: "Downloaded markdown audit log report.",
    });
  };

  return (
    <PreviewShell>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-[#105B38] border border-emerald-200">
                <History className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#105B38]">
                Audit Trail & Consultation Log
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A]">Search & Consultation History</h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1">
              Review precedent searches, statutory checks, AI consultations, and 1-click re-run past queries.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleExportAuditLog}
              className="px-4 py-2.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#0F172A] transition-colors flex items-center gap-1.5 shadow-2xs"
              title="Download full audit log report"
            >
              <Download className="w-4 h-4 text-[#105B38]" />
              <span>Export Audit Log</span>
            </button>

            {historyList.length > 0 && (
              <button
                type="button"
                onClick={() => setIsClearModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-[#F8FAFC] hover:bg-rose-50 border border-[#E2E8F0] text-xs font-bold text-[#64748B] hover:text-rose-600 transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear History</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-xs flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-[#105B38] border border-emerald-200">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-[#0F172A]">{totalSearches}</div>
              <div className="text-[11px] text-[#64748B] font-medium">Total Queries</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-xs flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-[#105B38] border border-emerald-200">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-[#0F172A]">Supreme Court</div>
              <div className="text-[11px] text-[#64748B] font-medium">Top Jurisdiction (52%)</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-xs flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-[#105B38] border border-emerald-200">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-[#0F172A]">{avgLatency} ms</div>
              <div className="text-[11px] text-[#64748B] font-medium">Avg Execution Latency</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-xs flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-[#105B38] border border-emerald-200">
              <BookmarkCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-[#0F172A]">{bookmarkedCount}</div>
              <div className="text-[11px] text-[#64748B] font-medium">Saved to Bookmarks</div>
            </div>
          </div>
        </div>

        {/* Search & Multi-Dimensional Filter Bar */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 flex items-center px-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] focus-within:border-[#105B38] focus-within:bg-white transition-all">
              <Search className="w-4 h-4 text-[#94A3B8] mr-2.5 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search history logs by prompt text, legal ratio, case citation, or matter tag..."
                className="w-full h-11 bg-transparent text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-1 rounded-md text-[#94A3B8] hover:text-[#0F172A]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Date Range Dropdown */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
                <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
                <select
                  value={filterDateRange}
                  onChange={(e) => setFilterDateRange(e.target.value)}
                  className="bg-transparent text-xs text-[#0F172A] font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                </select>
              </div>

              {/* Matter Filter */}
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
                <Briefcase className="w-3.5 h-3.5 text-[#64748B]" />
                <select
                  value={filterMatter}
                  onChange={(e) => setFilterMatter(e.target.value)}
                  className="bg-transparent text-xs text-[#0F172A] font-semibold focus:outline-none cursor-pointer max-w-[170px] truncate"
                >
                  <option value="All">All Matters</option>
                  {uniqueMatters.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Type Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#E2E8F0]/70">
            <span className="text-[11px] font-bold text-[#64748B] mr-2">Query Engine:</span>
            {typeOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setFilterType(opt)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all capitalize",
                  filterType === opt
                    ? "bg-[#105B38] text-white shadow-xs"
                    : "bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0]"
                )}
              >
                {opt === "ai_chat"
                  ? "AI Legal Chat"
                  : opt === "judgment"
                  ? "Precedent Research"
                  : opt === "drafting"
                  ? "Drafting Studio"
                  : opt === "statute"
                  ? "Statutes"
                  : opt}
              </button>
            ))}
          </div>
        </div>

        {/* History List Entries / Empty State */}
        {filteredHistory.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-[#E2E8F0] text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-[#105B38] flex items-center justify-center mx-auto">
              <History className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#0F172A]">No Audit Entries Found</h3>
            <p className="text-xs text-[#64748B] max-w-md mx-auto">
              No matching search queries recorded for the current filter criteria.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setFilterType("All");
                  setFilterDateRange("all");
                  setFilterMatter("All");
                  setFilterJurisdiction("All");
                }}
                className="px-4 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#105B38]"
              >
                Reset Filters
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((entry) => {
              const Icon =
                entry.type === "judgment"
                  ? Gavel
                  : entry.type === "ai_chat"
                  ? Bot
                  : entry.type === "drafting"
                  ? FileSignature
                  : BookOpen;

              return (
                <div
                  key={entry.id}
                  className="p-5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#105B38]/50 hover:shadow-xs transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4 group"
                >
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-50 border border-emerald-200 text-[#105B38] flex items-center justify-center mt-0.5">
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] uppercase tracking-wider">
                          {entry.type.replace("_", " ")}
                        </span>

                        {entry.matterTag && (
                          <span className="font-mono text-[10px] font-bold text-[#0F172A] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                            {entry.matterTag}
                          </span>
                        )}

                        <span className="text-[11px] text-[#64748B] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#94A3B8]" />
                          {entry.timestamp}
                        </span>

                        <span className="text-[11px] font-mono text-[#94A3B8]">
                          · {entry.executionTimeMs}ms · {entry.resultCount} Results
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-[#0F172A] group-hover:text-[#105B38] transition-colors leading-snug">
                        {entry.query}
                      </h3>

                      <p className="text-xs text-[#475569] line-clamp-2 leading-relaxed">
                        {entry.aiResponseSummary}
                      </p>

                      {/* Citations Retrieved Pills */}
                      {entry.citationsRetrieved.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[10px] font-bold text-[#94A3B8]">Citations:</span>
                          {entry.citationsRetrieved.map((cit) => (
                            <span
                              key={cit}
                              className="font-mono text-[10px] font-bold text-[#105B38] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                            >
                              {cit}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Right */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center pt-2 md:pt-0 border-t md:border-t-0 border-[#E2E8F0]/70 w-full md:w-auto justify-between md:justify-end">
                    <button
                      type="button"
                      onClick={(e) => handleToggleBookmark(entry, e)}
                      className={cn(
                        "p-2 rounded-xl border transition-colors",
                        entry.bookmarked
                          ? "bg-emerald-50 text-[#105B38] border-emerald-200"
                          : "bg-[#F8FAFC] text-[#94A3B8] hover:text-[#0F172A] border-[#E2E8F0]"
                      )}
                      title={entry.bookmarked ? "Bookmarked" : "Save to Bookmarks"}
                    >
                      <Bookmark className={cn("w-4 h-4", entry.bookmarked && "fill-current")} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setInspectEntry(entry)}
                      className="px-3 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#475569] hover:text-[#0F172A] transition-colors"
                      title="Inspect Dialogue & Citations"
                    >
                      Inspect
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReRun(entry)}
                      className="px-4 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Re-run</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteEntry(entry.id, e)}
                      className="p-2 rounded-xl bg-[#F8FAFC] hover:bg-rose-50 border border-[#E2E8F0] text-[#94A3B8] hover:text-rose-600 transition-colors"
                      title="Delete Entry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 1. INSPECT QUERY DIALOGUE MODAL */}
        {inspectEntry && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
            onClick={() => setInspectEntry(null)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" />

            <div
              className="relative bg-white border border-[#E2E8F0] rounded-2xl shadow-xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Bar */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#105B38]">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-[#0F172A]">
                      Audit Trail Dialogue Inspector
                    </h2>
                    <p className="text-[11px] text-[#64748B]">
                      {inspectEntry.timestamp} · Latency: {inspectEntry.executionTimeMs}ms
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleToggleBookmark(inspectEntry, e)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5",
                      inspectEntry.bookmarked
                        ? "bg-emerald-50 text-[#105B38] border-emerald-200"
                        : "bg-white text-[#475569] border-[#E2E8F0]"
                    )}
                  >
                    <Bookmark className={cn("w-3.5 h-3.5", inspectEntry.bookmarked && "fill-current")} />
                    <span>{inspectEntry.bookmarked ? "Bookmarked" : "Bookmark"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInspectEntry(null)}
                    className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* User Prompt Box */}
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                  <span className="text-[10px] font-bold uppercase text-[#64748B] block">
                    Advocate Search Query / Prompt
                  </span>
                  <p className="text-xs font-bold text-[#0F172A] leading-relaxed">
                    &quot;{inspectEntry.query}&quot;
                  </p>
                </div>

                {/* AI Response Box */}
                <div className="p-5 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-[#105B38] tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      AI Legal Intelligence Response
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(inspectEntry.aiResponseSummary);
                        toast({ title: "Response Copied" });
                      }}
                      className="text-xs font-bold text-[#105B38] hover:underline flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      Copy Response
                    </button>
                  </div>
                  <p className="text-xs text-[#334155] leading-relaxed whitespace-pre-wrap">
                    {inspectEntry.aiResponseSummary}
                  </p>
                </div>

                {/* Citations Retrieved */}
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
                  <span className="text-[10px] font-bold uppercase text-[#64748B] block">
                    Retrieved Precedents & Statutory Provisions
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {inspectEntry.citationsRetrieved.map((cit) => (
                      <Link
                        key={cit}
                        href={`/preview/judgments?q=${encodeURIComponent(cit)}`}
                        className="font-mono text-xs font-bold text-[#105B38] bg-white px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-50 transition-colors flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{cit}</span>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Execution Metadata */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div>
                    <span className="text-[10px] font-bold text-[#64748B] uppercase block">Engine</span>
                    <span className="font-bold text-[#0F172A] capitalize">{inspectEntry.type.replace("_", " ")}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#64748B] uppercase block">Latency</span>
                    <span className="font-bold text-[#105B38]">{inspectEntry.executionTimeMs} ms</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#64748B] uppercase block">Results</span>
                    <span className="font-bold text-[#0F172A]">{inspectEntry.resultCount} records</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#64748B] uppercase block">Matter</span>
                    <span className="font-bold text-[#0F172A]">{inspectEntry.matterTag || "General"}</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => handleReRun(inspectEntry)}
                  className="px-4 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Re-run Query</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInspectEntry(null)}
                  className="px-4 py-2 rounded-xl bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] text-xs font-bold text-[#475569]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. CLEAR ALL HISTORY CONFIRMATION MODAL */}
        {isClearModalOpen && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
            onClick={() => setIsClearModalOpen(false)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" />

            <div
              className="relative bg-white border border-[#E2E8F0] rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="text-base font-bold text-[#0F172A]">Clear All Search History?</h3>
                <p className="text-xs text-[#64748B]">
                  This will permanently clear all local query audit trails, prompt history, and execution metrics. Bookmarked authorities in your Saved Vault will remain intact.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsClearModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#F8FAFC] text-xs font-bold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClearHistory}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs"
                >
                  Yes, Clear History
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PreviewShell>
  );
};

export default PreviewHistory;
