import React, { useState, useEffect, useMemo } from "react";
import {
  FolderTree,
  Gavel,
  BookOpen,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Loader2,
  FileText,
  Filter,
  Layers,
  Search,
  Scale,
  Shield,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parsePakistaniCitation } from "./PinpointCitationParser";

export interface DirectoryIndexData {
  courts: Array<{ id: number; name: string; code: string }>;
  journals: Array<{ id: number; code: string; name: string }>;
  years: number[];
}

export interface BrowseListItem {
  id: string;
  judgmentId?: string;
  year: number;
  page: number;
  citation: string;
  title: string;
  decisionDate: string | null;
  courtName: string | null;
  courtSnapshot: string | null;
  journalCode: string;
  category?: string;
  bench?: string;
  summary?: string;
}

interface DirectoryBrowserProps {
  onSelectJudgment: (judgmentId: string) => void;
}

export interface DirectoryFilterState {
  courtCode?: string;
  category?: string;
  journalCode?: string;
  year?: string;
  search?: string;
  limit?: number;
  sort?: string;
}

export const COURTS_DIRECTORY = [
  { id: 1, name: "Supreme Court of Pakistan", code: "SC" },
  { id: 2, name: "Lahore High Court", code: "LHC" },
  { id: 3, name: "Sindh High Court", code: "SHC" },
  { id: 4, name: "Islamabad High Court", code: "IHC" },
  { id: 5, name: "Peshawar High Court", code: "PHC" },
  { id: 6, name: "High Court of Balochistan", code: "BHC" },
  { id: 7, name: "Federal Shariat Court", code: "FSC" },
];

export const JOURNALS_DIRECTORY = [
  { id: 1, code: "PLD", name: "All Pakistan Legal Decisions" },
  { id: 2, code: "SCMR", name: "Supreme Court Monthly Review" },
  { id: 3, code: "CLC", name: "Civil Law Cases" },
  { id: 4, code: "PCRLJ", name: "Pakistan Criminal Law Journal" },
  { id: 5, code: "YLR", name: "Yearly Law Reports" },
  { id: 6, code: "MLD", name: "Monthly Law Digest" },
  { id: 7, code: "CLD", name: "Corporate Law Decisions" },
  { id: 8, code: "PTD", name: "Pakistan Tax Decisions" },
  { id: 9, code: "PLC", name: "Pakistan Labour Cases" },
  { id: 10, code: "LHC", name: "Lahore High Court Neutral" },
  { id: 11, code: "SCLR", name: "Supreme Court Law Reports" },
  { id: 12, code: "SCP", name: "Supreme Court of Pakistan Neutral" },
];

export const CATEGORIES_DIRECTORY = [
  { code: "all", label: "All Legal Domains" },
  { code: "constitutional", label: "Constitutional Law & Writs (Art. 199/184)" },
  { code: "criminal", label: "Criminal Law, Bail & PPC (S. 497/302)" },
  { code: "civil", label: "Civil Procedure & Specific Relief (S. 115/12)" },
  { code: "family", label: "Family & Child Custody (Guardians Act)" },
  { code: "corporate", label: "Corporate & Banking (Companies Act / FIO)" },
  { code: "tax", label: "Taxation & Revenue (Income Tax S. 122)" },
  { code: "labor", label: "Labor & Employment (Industrial Relations)" },
];

/**
 * Builds the URL for querying /api/case-law/search based on active directory filters.
 */
export function buildDirectorySearchUrl(filters: DirectoryFilterState): string {
  const searchParams = new URLSearchParams();

  if (filters.courtCode && filters.courtCode !== "ALL") {
    searchParams.set("court", filters.courtCode);
  }

  if (filters.journalCode && filters.journalCode !== "ALL") {
    searchParams.set("report", filters.journalCode);
  }

  if (filters.year && filters.year !== "ALL") {
    searchParams.set("year", filters.year);
  }

  const searchTerms: string[] = [];
  if (filters.search?.trim()) {
    searchTerms.push(filters.search.trim());
  }
  if (filters.category && filters.category !== "all") {
    searchTerms.push(filters.category);
  }

  if (searchTerms.length > 0) {
    searchParams.set("q", searchTerms.join(" "));
  }

  // No fallback - allow global search

  searchParams.set("limit", String(filters.limit || 50));
  searchParams.set("sort", filters.sort || "latest");

  return `/api/case-law/search?${searchParams.toString()}`;
}

export const DirectoryBrowser: React.FC<DirectoryBrowserProps> = ({ onSelectJudgment }) => {
  const [indexData] = useState<DirectoryIndexData>({
    courts: COURTS_DIRECTORY,
    journals: JOURNALS_DIRECTORY,
    years: Array.from({ length: 2026 - 1947 + 1 }, (_, i) => 2026 - i),
  });

  // Selected 4-Tier Filters
  const [selectedCourtCode, setSelectedCourtCode] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedJournalCode, setSelectedJournalCode] = useState<string>("ALL");
  const [selectedYear, setSelectedYear] = useState<string>("ALL");
  const [directorySearch, setDirectorySearch] = useState<string>("" );
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  // Data & Fetch Status
  const [fetchedCases, setFetchedCases] = useState<BrowseListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(directorySearch);
    }, 350);
    return () => clearTimeout(timer);
  }, [directorySearch]);

  // Dynamic API Fetch Effect
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function executeFetch() {
      setIsLoading(true);
      setFetchError(null);

      try {
        const url = buildDirectorySearchUrl({
          courtCode: selectedCourtCode,
          category: selectedCategory,
          journalCode: selectedJournalCode,
          year: selectedYear,
          search: debouncedSearch,
          limit: 50,
          sort: "latest",
        });

        const res = await fetch(url, {
          credentials: "include",
          signal,
        });

        if (!res.ok) {
          throw new Error(`API returned status ${res.status}`);
        }

        const rawData = await res.json();
        const rawItems = Array.isArray(rawData)
          ? rawData
          : Array.isArray(rawData?.results)
          ? rawData.results
          : Array.isArray(rawData?.data)
          ? rawData.data
          : Array.isArray(rawData?.judgments)
          ? rawData.judgments
          : [];

        const mapped: BrowseListItem[] = rawItems.map((j: any) => {
          const parsed = j.citation ? parsePakistaniCitation(j.citation) : null;
          const yr = Number(
            j.year || j.citationYear || parsed?.year || (j.decisionDate ? new Date(j.decisionDate).getFullYear() : 2024)
          );
          const pg = Number(j.page || j.citationPage || parsed?.page || 1);
          const jCode = j.journal || j.journalCode || j.citationReport || parsed?.journal || "PLD";
          const cCode =
            j.courtCode ||
            j.courtSnapshot ||
            (j.court?.includes("Supreme")
              ? "SC"
              : j.court?.includes("Lahore")
              ? "LHC"
              : j.court?.includes("Sindh")
              ? "SHC"
              : j.court?.includes("Islamabad")
              ? "IHC"
              : j.court?.includes("Peshawar")
              ? "PHC"
              : j.court?.includes("Balochistan")
              ? "BHC"
              : j.court?.includes("Shariat")
              ? "FSC"
              : "SC");

          const itemId = String(j.judgmentId || j.id);

          return {
            id: itemId,
            judgmentId: j.judgmentId ? String(j.judgmentId) : undefined,
            year: yr,
            page: pg,
            citation: j.citation || "Citation Pending",
            title: j.title || "Reported Superior Court Authority",
            decisionDate: j.decisionDate || null,
            courtName: j.court || "Supreme Court of Pakistan",
            courtSnapshot: cCode,
            journalCode: jCode,
            category:
              j.category ||
              (j.keywords && j.keywords.length > 0 ? j.keywords[0] : selectedCategory !== "all" ? selectedCategory : undefined),
            bench: j.bench || (Array.isArray(j.judges) ? j.judges.join(", ") : j.judges || undefined),
            summary: j.summary || j.headnotes,
          };
        });

        setFetchedCases(mapped);
        setCurrentPage(1);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("[DirectoryBrowser] Fetch failed:", err);
          setFetchError("Failed to retrieve directory judgments. Please check your connection.");
          setFetchedCases([]);
        }
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    executeFetch();

    return () => {
      controller.abort();
    };
  }, [selectedCourtCode, selectedCategory, selectedJournalCode, selectedYear, debouncedSearch, retryCount]);

  const totalPages = Math.max(1, Math.ceil(fetchedCases.length / itemsPerPage));
  const paginatedCases = fetchedCases.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleResetFilters = () => {
    setSelectedCourtCode("ALL");
    setSelectedCategory("all");
    setSelectedJournalCode("ALL");
    setSelectedYear("ALL");
    setDirectorySearch("");
    setDebouncedSearch("");
    setCurrentPage(1);
    setFetchError(null);
    setRetryCount((c) => c + 1);
  };

  return (
    <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#1E2D44] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-[#105B38] shadow-xs">
            <FolderTree className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
              <span>Court Hierarchy Directory & Law Journal Archive</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20">
                1947–2026 Archive
              </span>
            </h3>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
              4-tier hierarchical browsing: Court Jurisdiction → Subject Matter Domain → Annual Volumes & Journals → Reported Judgments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-[#105B38] bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3 py-1.5 rounded-xl">
            {fetchedCases.length} Precedents Indexed
          </span>
        </div>
      </div>

      {/* 4-Tier Filter Matrix Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Tier 1: Court Filter */}
        <div>
          <label className="text-[10px] font-mono font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mb-1 flex items-center gap-1">
            <Gavel className="w-3 h-3 text-[#105B38]" />
            Tier 1: Court Forum
          </label>
          <select
            value={selectedCourtCode}
            onChange={(e) => {
              setSelectedCourtCode(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-10 px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#105B38] focus:bg-white dark:bg-[#131E2E] text-xs font-medium"
          >
            <option value="ALL">All Pakistani Forums</option>
            {COURTS_DIRECTORY.map((c) => (
              <option key={c.id} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tier 2: Subject Matter Category */}
        <div>
          <label className="text-[10px] font-mono font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mb-1 flex items-center gap-1">
            <Scale className="w-3 h-3 text-[#105B38]" />
            Tier 2: Subject Matter
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-10 px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#105B38] focus:bg-white dark:bg-[#131E2E] text-xs font-medium"
          >
            {CATEGORIES_DIRECTORY.map((cat) => (
              <option key={cat.code} value={cat.code}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Tier 3A: Journal Filter */}
        <div>
          <label className="text-[10px] font-mono font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mb-1 flex items-center gap-1">
            <BookOpen className="w-3 h-3 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]" />
            Tier 3: Law Journal Reporter
          </label>
          <select
            value={selectedJournalCode}
            onChange={(e) => {
              setSelectedJournalCode(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-10 px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#105B38] focus:bg-white dark:bg-[#131E2E] text-xs font-mono font-medium"
          >
            <option value="ALL">All Reporters (PLD, SCMR, CLC...)</option>
            {JOURNALS_DIRECTORY.map((j) => (
              <option key={j.id} value={j.code}>
                {j.code} — {j.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tier 3B: Year Filter */}
        <div>
          <label className="text-[10px] font-mono font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-[#105B38]" />
            Volume Year
          </label>
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-10 px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#105B38] focus:bg-white dark:bg-[#131E2E] text-xs font-mono font-medium"
          >
            <option value="ALL">All Volume Years (1947–2026)</option>
            {indexData?.years?.map((y) => (
              <option key={y} value={String(y)}>
                Volume Year {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Directory Search & Filter Quick Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 relative">
          <Search className="w-3.5 h-3.5 text-[#94A3B8] dark:text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={directorySearch}
            onChange={(e) => {
              setDirectorySearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search directory by title, citation, justice, or keywords..."
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:text-[#475569] focus:outline-none focus:border-[#105B38] focus:bg-white dark:bg-[#131E2E] transition-all font-medium"
          />
        </div>

        {(selectedCourtCode !== "ALL" || selectedCategory !== "all" || selectedJournalCode !== "ALL" || selectedYear !== "ALL" || directorySearch) && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-3.5 py-2 rounded-xl bg-[#F1F5F9] dark:bg-[#1E2D44] hover:bg-[#E2E8F0] text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] text-xs font-semibold transition-all shrink-0"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Directory Results List */}
      <div className="space-y-3 pt-1">
        {isLoading ? (
          <div className="py-14 text-center space-y-2 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] bg-[#F8FAFC] dark:bg-[#0B131E] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] p-6">
            <Loader2 className="w-8 h-8 mx-auto text-[#105B38] animate-spin" />
            <p className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">Fetching authoritative directory judgments...</p>
            <p className="text-[11px] text-[#94A3B8] dark:text-[#475569]">Querying Pakistan Law Site & Apex Court Case Law archives</p>
          </div>
        ) : fetchError ? (
          <div className="py-12 text-center space-y-3 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] bg-[#FEF2F2] rounded-2xl border border-[#FCA5A5] p-6">
            <AlertCircle className="w-8 h-8 mx-auto text-[#DC2626]" />
            <p className="text-xs font-bold text-[#991B1B]">{fetchError}</p>
            <button
              type="button"
              onClick={() => setRetryCount((c) => c + 1)}
              className="px-4 py-1.5 rounded-xl bg-white dark:bg-[#131E2E] border border-[#FCA5A5] text-[#991B1B] hover:bg-[#FEE2E2] text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : paginatedCases.length === 0 ? (
          <div className="py-14 text-center space-y-2 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] bg-[#F8FAFC] dark:bg-[#0B131E] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] p-6">
            <Layers className="w-8 h-8 mx-auto text-[#CBD5E1]" />
            <p className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">No reported judgments match the selected directory criteria.</p>
            <p className="text-[11px] text-[#94A3B8] dark:text-[#475569]">Try selecting &quot;All Pakistani Forums&quot; or resetting the volume year and category filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {paginatedCases.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectJudgment(item.judgmentId || item.id)}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] hover:border-[#105B38]/50 hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-[#105B38] text-xs bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20">
                      {item.citation}
                    </span>
                    <span className="text-xs font-semibold text-[#475569]">
                      {item.courtName || "Supreme Court of Pakistan"}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#F1F5F9] dark:bg-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                      Page {item.page}
                    </span>
                    {item.category && (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                        {item.category}
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#105B38] transition-colors leading-snug">
                    {item.title}
                  </h4>
                  {item.bench && (
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] flex items-center gap-1.5">
                      <Gavel className="w-3 h-3 text-[#105B38]" />
                      <span>Bench: {item.bench}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
                  <span className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                    {item.decisionDate
                      ? new Date(item.decisionDate).toLocaleDateString("en-PK", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : `${item.year}`}
                  </span>
                  <div className="p-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] group-hover:bg-[#105B38] group-hover:text-white text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] transition-all shadow-xs">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-[#E2E8F0] dark:border-[#1E2D44] text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] font-mono">
            <span>
              Page {currentPage} of {totalPages} ({fetchedCases.length} judgments)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-2 rounded-xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] hover:bg-[#F8FAFC] dark:bg-[#0B131E] disabled:opacity-40 shadow-xs"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-2 rounded-xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] hover:bg-[#F8FAFC] dark:bg-[#0B131E] disabled:opacity-40 shadow-xs"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
