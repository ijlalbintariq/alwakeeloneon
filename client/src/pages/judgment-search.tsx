import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle,
  BookOpen,
  BookmarkPlus,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Eye,
  ExternalLink,
  FileText,
  Gavel,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
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

type Journal = {
  id: number;
  code: string;
  name: string;
};

type CitationResult = {
  id: string;
  citation: string;
  title: string;
  court: string;
  decisionDate: string | null;
  pdfUrl: string | null;
};

type CitationSearchParams = {
  year: number;
  journal?: string;
  page: number;
  court?: string;
};

function formatDecisionDate(value: string | null): string {
  if (!value) return "Date not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return date.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatJournalCodeLabel(code: string): string {
  return String(code || "").toUpperCase() === "PCRLJ" ? "P Cr. L J" : code;
}

function parseCitationFromText(value: string): { year: number; journal: string; page: number } | null {
  const raw = value.trim();
  if (!raw) return null;
  const normalized = raw
    .replace(/[()[\],;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const normalizeJournal = (input: string): string => String(input || "")
    .replace(/\bP\.?\s*Cr\.?\s*L\.?\s*J\b/gi, "PCRLJ")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  const compactNeutral = normalized.match(/\b((?:19|20)\d{2})\s*(LHC|IHC|SHC|PHC|BHC|AJKHC)\s*(\d{1,6})\b/i);
  if (compactNeutral) {
    const year = Number(compactNeutral[1]);
    const page = Number(compactNeutral[3]);
    if (!Number.isInteger(year) || !Number.isInteger(page) || page < 1) return null;
    return {
      year,
      journal: normalizeJournal(compactNeutral[2]),
      page,
    };
  }

  const yearFirst =
    normalized.match(/\b((?:19|20)\d{2})\s+([A-Za-z][A-Za-z0-9.]{0,12}(?:\s+[A-Za-z][A-Za-z0-9.]{0,12}){0,4})\s+(\d{1,6})\b/i);
  if (yearFirst) {
    const year = Number(yearFirst[1]);
    const page = Number(yearFirst[3]);
    if (!Number.isInteger(year) || !Number.isInteger(page) || page < 1) return null;
    return {
      year,
      journal: normalizeJournal(yearFirst[2]),
      page,
    };
  }

  const reportFirst =
    normalized.match(/\b([A-Za-z][A-Za-z0-9.]{0,12}(?:\s+[A-Za-z][A-Za-z0-9.]{0,12}){0,4})\s+((?:19|20)\d{2})\s+(\d{1,6})\b/i);
  if (!reportFirst) return null;
  const year = Number(reportFirst[2]);
  const page = Number(reportFirst[3]);
  if (!Number.isInteger(year) || !Number.isInteger(page) || page < 1) return null;
  return {
    year,
    journal: normalizeJournal(reportFirst[1]),
    page,
  };
}

export default function JudgmentSearchPage() {
  const [, setLocation] = useLocation();
  const currentYear = new Date().getFullYear();

  const years = useMemo(() => {
    const list: number[] = [];
    for (let year = currentYear + 1; year >= 1947; year -= 1) list.push(year);
    return list;
  }, [currentYear]);

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

  const [year, setYear] = useState<number>(currentYear);
  const [citationJournal, setCitationJournal] = useState<string>("");
  const [page, setPage] = useState<string>("");
  const [keywordCourt, setKeywordCourt] = useState<string>("");
  const [citationCourt, setCitationCourt] = useState<string>("");
  const [searchMode, setSearchMode] = useState<"keyword" | "citation">("keyword");
  const [keywordSort, setKeywordSort] = useState<"relevance" | "latest">("relevance");

  const [journals, setJournals] = useState<Journal[]>([]);
  const [loadingJournals, setLoadingJournals] = useState<boolean>(true);
  const [citationSearching, setCitationSearching] = useState<boolean>(false);
  const [citationError, setCitationError] = useState<string | null>(null);
  const [citationResults, setCitationResults] = useState<CitationResult[]>([]);
  const [hasCitationSearched, setHasCitationSearched] = useState<boolean>(false);
  const [pendingAutoCitation, setPendingAutoCitation] = useState<CitationSearchParams | null>(null);

  const { data: savedJudgments = [], refetch: refetchSaved } = useQuery<SavedJudgment[]>({
    queryKey: ["/api/saved-judgments"],
  });

  const allResults = useMemo(
    () => [...localResults, ...externalResults],
    [localResults, externalResults],
  );

  const citationPreview = `${year} ${citationJournal || "ALL"} ${page || "PAGE"}`;

  const runKeywordSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setSearchError(null);
    setSummaries({});
    setExpandedSummary(null);

    const requestParams = new URLSearchParams({
      q: searchQuery.trim(),
      sort: keywordSort,
    });
    if (keywordCourt.trim()) requestParams.set("court", keywordCourt.trim());

    let localItems: CaseLawResult[] = [];
    try {
      const localRes = await fetch(`/api/case-law/search?${requestParams.toString()}`);
      const local = await localRes.json();
      localItems = local.map((r: any) => ({ ...r, source: "internal" }));
      setLocalResults(localItems);
    } catch {
      setLocalResults([]);
    }
    setIsLoading(false);

    if (localItems.length > 0) {
      setExternalResults([]);
      setIsExternalLoading(false);
      await apiRequest("POST", "/api/search-history", {
        type: "judgment",
        query: searchQuery,
      }).catch(() => {});
      return;
    }

    setIsExternalLoading(true);
    try {
      const extRes = await apiRequest("POST", "/api/ai/search-judgments", {
        query: searchQuery.trim(),
        court: keywordCourt.trim() || undefined,
        sort: keywordSort,
      });
      const ext = await extRes.json();
      const items = Array.isArray(ext) ? ext : ext.judgments || ext.results || [];
      setExternalResults(items.map((r: any) => ({ ...r, source: "external" })));
    } catch (e: any) {
      console.error("[Judgment Search] AI search error:", e?.message || e);
      const isLimit = e?.message?.includes("429");
      setSearchError(
        isLimit
          ? "Monthly AI action limit reached. Upgrade your plan for more searches."
          : "AI research feed temporarily unavailable. Please try again.",
      );
      if (isLimit) queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
      setExternalResults([]);
    }
    setIsExternalLoading(false);

    await apiRequest("POST", "/api/search-history", {
      type: "judgment",
      query: searchQuery,
    }).catch(() => {});
  };

  const runCitationSearch = async (params: CitationSearchParams) => {
    setHasCitationSearched(true);
    setCitationError(null);
    setCitationSearching(true);

    try {
      const queryParams = new URLSearchParams({
        year: String(params.year),
        page: String(params.page),
      });
      if (params.journal?.trim()) queryParams.set("journal", params.journal.trim());
      if (params.court?.trim()) queryParams.set("court", params.court.trim());

      const res = await apiRequest("GET", `/api/citation-search?${queryParams.toString()}`);
      const data = (await res.json()) as CitationResult[];
      setCitationResults(data);
    } catch (err: any) {
      setCitationResults([]);
      setCitationError(err?.message || "Failed to search citation");
    } finally {
      setCitationSearching(false);
    }
  };

  const handleSearch = async () => {
    await runKeywordSearch(query);
  };

  const handleCitationSearch = async (event: FormEvent) => {
    event.preventDefault();

    const pageNumber = Number(page);
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      setCitationError("Page must be a positive number.");
      return;
    }

    await runCitationSearch({
      year,
      journal: citationJournal,
      page: pageNumber,
      court: citationCourt,
    });
  };

  const handleGetSummary = async (item: CaseLawResult, idx: number) => {
    if (summaries[idx]) {
      setExpandedSummary(expandedSummary === idx ? null : idx);
      return;
    }

    setSummaryLoading((prev) => ({ ...prev, [idx]: true }));
    setExpandedSummary(idx);

    try {
      const res = await apiRequest("POST", "/api/ai/judgment-summary", {
        citation: item.citation,
        title: item.title,
        court: item.court,
        summary: item.summary,
      });
      const data = await res.json();
      setSummaries((prev) => ({ ...prev, [idx]: data }));
    } catch (e: any) {
      const isLimit = e?.message?.includes("429");
      setSummaries((prev) => ({
        ...prev,
        [idx]: {
          summary: isLimit
            ? "Monthly AI action limit reached. Please upgrade your plan for more AI analyses."
            : "Failed to generate summary. Please try again.",
          fullText: null,
          source: null,
          verified: false,
        },
      }));
      if (isLimit) queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
    }

    setSummaryLoading((prev) => ({ ...prev, [idx]: false }));
  };

  const handleDeleteSaved = async (id: number) => {
    try {
      await apiRequest("DELETE", `/api/saved-judgments/${id}`);
      refetchSaved();
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    async function loadJournals() {
      setLoadingJournals(true);
      setCitationError(null);
      try {
        const res = await fetch("/api/journals", { credentials: "include" });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.message || "Failed to load journals");
        }
        const data = (await res.json()) as Journal[];
        setJournals(data);
      } catch (err: any) {
        setCitationError(err?.message || "Failed to load journals");
      } finally {
        setLoadingJournals(false);
      }
    }

    void loadJournals();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q && !autoSearchDone) {
      setQuery(q);
      setSearchMode("keyword");
      setAutoSearchDone(true);
      setTimeout(() => {
        void runKeywordSearch(q);
      }, 100);
    }

    const citationValue = params.get("citation");
    const yearParam = params.get("year");
    const journalParam = params.get("journal");
    const pageParam = params.get("page");
    const courtParam = params.get("court") || "";

    if (citationValue) {
      const parsed = parseCitationFromText(citationValue);
      if (parsed) {
        setSearchMode("citation");
        setPendingAutoCitation({
          year: parsed.year,
          journal: parsed.journal,
          page: parsed.page,
          court: courtParam,
        });
      }
      return;
    }

    if (yearParam && journalParam && pageParam) {
      const yearValue = Number(yearParam);
      const pageValue = Number(pageParam);
      if (Number.isInteger(yearValue) && Number.isInteger(pageValue) && pageValue > 0) {
        setSearchMode("citation");
        setPendingAutoCitation({
          year: yearValue,
          journal: journalParam.toUpperCase(),
          page: pageValue,
          court: courtParam,
        });
      }
    }
  }, [autoSearchDone]);

  useEffect(() => {
    if (!pendingAutoCitation || loadingJournals) return;
    setSearchMode("citation");

    const matchedJournal = journals.find(
      (j) => j.code.toUpperCase() === (pendingAutoCitation.journal ?? "").toUpperCase(),
    );

    const selectedJournal = matchedJournal?.code || "";

    setYear(pendingAutoCitation.year);
    setCitationJournal(selectedJournal);
    setPage(String(pendingAutoCitation.page));
    setCitationCourt(pendingAutoCitation.court || "");

    void runCitationSearch({
      year: pendingAutoCitation.year,
      journal: selectedJournal,
      page: pendingAutoCitation.page,
      court: pendingAutoCitation.court,
    });

    setPendingAutoCitation(null);
  }, [pendingAutoCitation, loadingJournals, journals]);

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 fade-in" data-testid="judgment-search-page">
      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-background p-3">
        <div className="pointer-events-none absolute -top-12 right-5 h-24 w-24 rounded-full bg-primary/10 blur-3xl" />
        <div className="max-w-2xl space-y-2">
          <h2 className="text-xl md:text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            Judgment <span className="text-primary">Vault</span>
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground leading-relaxed max-w-xl">
            Access Pakistan case law with unified keyword and citation search, verified sources, and AI-assisted analysis for faster legal research.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-border/80 bg-background/90 p-3 shadow-2xl">
        <div className="mb-3 flex justify-center">
          <div className="inline-flex rounded-xl border border-border/90 bg-black/40 p-1">
            <button
              type="button"
              onClick={() => setSearchMode("keyword")}
              className={`rounded-lg px-5 py-2 text-sm font-bold transition-all ${
                searchMode === "keyword"
                  ? "bg-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Keyword Search
            </button>
            <button
              type="button"
              onClick={() => setSearchMode("citation")}
              className={`rounded-lg px-5 py-2 text-sm font-bold transition-all ${
                searchMode === "citation"
                  ? "bg-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Citation Search
            </button>
          </div>
        </div>

        {searchMode === "keyword" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-2.5">
              <div className="relative">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="w-full rounded-xl border border-border bg-black/50 pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Search with Keywords, Booleans or Sentences"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
                  data-testid="input-judgment-search"
                />
              </div>
              <button
                onClick={() => void handleSearch()}
                disabled={isLoading || isExternalLoading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-muted px-6 text-base font-bold text-foreground hover:bg-white disabled:opacity-60"
                data-testid="button-judgment-search"
              >
                {isLoading || isExternalLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={17} />}
                Search
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Jurisdiction</span>
                <select
                  className="w-full rounded-xl border border-border bg-black/50 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  value="Pakistan"
                  disabled
                >
                  <option value="Pakistan">Pakistan</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Court</span>
                <input
                  value={keywordCourt}
                  onChange={(e) => setKeywordCourt(e.target.value)}
                  className="w-full rounded-xl border border-border bg-black/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="All Courts"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Filter By</span>
                <select
                  value={keywordSort}
                  onChange={(e) => setKeywordSort(e.target.value as "relevance" | "latest")}
                  className="w-full rounded-xl border border-border bg-black/50 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="relevance">Relevance</option>
                  <option value="latest">Latest</option>
                </select>
              </label>
            </div>

            {searchError ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300 flex items-center gap-2">
                <AlertCircle size={14} /> {searchError}
              </div>
            ) : null}
          </div>
        ) : (
          <form onSubmit={(e) => void handleCitationSearch(e)} className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] gap-2.5">
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Jurisdiction</span>
                <select
                  className="w-full rounded-xl border border-border bg-black/50 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  value="Pakistan"
                  disabled
                >
                  <option value="Pakistan">Pakistan</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Year</span>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-black/50 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  data-testid="select-citation-year"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Journal</span>
                <select
                  value={citationJournal}
                  onChange={(e) => setCitationJournal(e.target.value)}
                  className="w-full rounded-xl border border-border bg-black/50 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  disabled={loadingJournals}
                  data-testid="select-citation-journal"
                >
                  {journals.length === 0 ? <option value="">No journals available</option> : null}
                  {journals.length > 0 ? <option value="">All Journals</option> : null}
                  {journals.map((j) => (
                    <option key={j.id} value={j.code}>
                      {formatJournalCodeLabel(j.code)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Page</span>
                <input
                  type="number"
                  min={1}
                  value={page}
                  onChange={(e) => setPage(e.target.value)}
                  className="w-full rounded-xl border border-border bg-black/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="e.g. 123"
                  data-testid="input-citation-page"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Court (Optional)</span>
                <input
                  value={citationCourt}
                  onChange={(e) => setCitationCourt(e.target.value)}
                  className="w-full rounded-xl border border-border bg-black/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="All Courts"
                  data-testid="input-citation-court"
                />
              </label>

              <button
                type="submit"
                disabled={citationSearching || loadingJournals}
                className="h-11 self-end inline-flex items-center justify-center gap-2 rounded-xl bg-muted px-6 text-base font-bold text-foreground hover:bg-white disabled:opacity-60"
                data-testid="button-citation-search"
              >
                {citationSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={17} />}
                Search
              </button>
            </div>

            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1.5">
              <p className="text-[9px] uppercase font-black tracking-[0.18em] text-blue-300">Citation Preview</p>
              <p className="text-sm font-mono text-blue-200" data-testid="text-citation-preview">
                {citationPreview}
              </p>
            </div>

            {citationError ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                {citationError}
              </div>
            ) : null}
          </form>
        )}
      </section>

      <section className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 min-h-0 space-y-4 overflow-y-auto pr-1">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Recent Judgments
            </h3>
            <span className="text-primary text-xs font-black uppercase tracking-widest">
              {allResults.length} Result{allResults.length === 1 ? "" : "s"}
            </span>
          </div>

          {isLoading || isExternalLoading ? (
            <div className="rounded-2xl border border-border bg-card/40 px-5 py-8 text-muted-foreground flex items-center gap-3">
              <Loader2 size={16} className="animate-spin text-primary" />
              Searching judgments...
            </div>
          ) : null}

          {!isLoading && !isExternalLoading && allResults.length === 0 && !query ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/35 px-6 py-10 text-center text-muted-foreground">
              Enter keywords above to search verified Pakistani judgments.
            </div>
          ) : null}

          {!isLoading && !isExternalLoading && allResults.length === 0 && query ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/35 px-6 py-10 text-center text-muted-foreground">
              No judgments found matching your keyword query.
            </div>
          ) : null}

          {allResults.map((item, idx) => (
            <article
              key={`${item.source || "internal"}-${item.citation}-${idx}`}
              className={`rounded-xl border shadow-xl overflow-hidden ${
                item.source === "external"
                  ? "border-blue-500/25 bg-card/70"
                  : "border-border bg-card/55"
              }`}
              data-testid={`judgment-result-${idx}`}
            >
              <div className="p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="space-y-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                        item.source === "external"
                          ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                          : "border-primary/30 bg-primary/10 text-primary"
                      }`}
                    >
                      {item.court || "Court"}
                    </span>
                    <h4 className="text-xl font-bold text-foreground leading-snug" style={{ fontFamily: "'Playfair Display', serif" }}>
                      {item.title}
                    </h4>
                  </div>
                  <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-mono font-bold text-primary">
                    {item.citation}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-3">{item.summary}</p>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setJudgmentForView(item);
                      setLocation("/judgment-view");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary/35 bg-primary/10 px-3 py-2 text-[11px] font-bold text-primary hover:bg-primary/20"
                    data-testid={`button-open-judgment-${idx}`}
                  >
                    <Eye size={13} /> Open & Chat
                  </button>

                  {item.uri ? (
                    <a
                      href={item.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20"
                      data-testid={`link-view-source-${idx}`}
                    >
                      <ExternalLink size={13} /> View Source
                    </a>
                  ) : null}

                  <button
                    onClick={() => void handleGetSummary(item, idx)}
                    disabled={summaryLoading[idx]}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/50 px-3 py-2 text-[11px] font-bold text-foreground hover:border-primary/40 hover:text-foreground"
                    data-testid={`button-ai-summary-${idx}`}
                  >
                    {summaryLoading[idx] ? (
                      <>
                        <Loader2 size={13} className="animate-spin" /> Analyzing...
                      </>
                    ) : expandedSummary === idx && summaries[idx] ? (
                      <>
                        <ChevronUp size={13} /> Hide Analysis
                      </>
                    ) : summaries[idx] ? (
                      <>
                        <ChevronDown size={13} /> Show Analysis
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} /> AI Analysis
                      </>
                    )}
                  </button>
                </div>
              </div>

              {expandedSummary === idx && (summaryLoading[idx] || summaries[idx]) ? (
                <div className="border-t border-border p-5 md:p-6" data-testid={`judgment-summary-panel-${idx}`}>
                  {summaryLoading[idx] ? (
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Loader2 size={14} className="animate-spin text-primary" />
                      Al Wakeelo is analyzing this judgment...
                    </div>
                  ) : summaries[idx] ? (
                    <div className="space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
                            <Sparkles size={11} /> AI Judgment Analysis
                          </span>
                          {summaries[idx].verified ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300" data-testid={`badge-verified-${idx}`}>
                              <ShieldCheck size={11} /> Verified Source
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-primary" data-testid={`badge-ai-only-${idx}`}>
                              <ShieldAlert size={11} /> AI General Knowledge
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setExpandedSummary(null)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground"
                          data-testid={`button-close-summary-${idx}`}
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="prose prose-invert prose-sm max-w-none" data-testid={`text-judgment-summary-${idx}`}>
                        <LegalMarkdown content={summaries[idx].summary} />
                      </div>

                      {summaries[idx].fullText ? (
                        <div>
                          <button
                            onClick={() => setShowFullText((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                            data-testid={`button-full-text-${idx}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/35 bg-primary/10 px-3 py-2 text-[11px] font-bold text-primary hover:bg-primary/20"
                          >
                            <BookOpen size={13} />
                            {showFullText[idx] ? "Hide Full Judgment" : "View Full Judgment"}
                            {showFullText[idx] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>

                          {summaries[idx].source ? (
                            <span className="ml-3 text-[10px] uppercase tracking-widest text-emerald-300/80">
                              <FileText size={10} className="inline mr-1" /> Source: Knowledge Vault
                            </span>
                          ) : null}

                          {showFullText[idx] ? (
                            <div
                              className="mt-4 max-h-[520px] overflow-y-auto rounded-xl border border-border bg-background/50 p-4"
                              data-testid={`text-full-judgment-${idx}`}
                            >
                              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground font-mono">
                                {summaries[idx].fullText}
                              </pre>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}

          <div className="pt-3 border-t border-border">
            <h4 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Citation Matches
            </h4>
            <p className="text-xs text-muted-foreground mt-1">Exact journal/year/page lookup results.</p>
          </div>

          {citationSearching ? (
            <div className="rounded-2xl border border-border bg-card/40 px-5 py-6 text-muted-foreground flex items-center gap-3">
              <Loader2 size={16} className="animate-spin text-primary" />
              Looking up citation...
            </div>
          ) : null}

          {!citationSearching && !citationError && hasCitationSearched && citationResults.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card/40 px-5 py-6 text-muted-foreground" data-testid="citation-search-empty">
              No matching judgments found for this citation.
            </div>
          ) : null}

          {citationResults.length > 0 ? (
            <div className="space-y-3" data-testid="citation-search-results">
              {citationResults.map((item) => (
                <article key={item.id} className="rounded-xl border border-border bg-card/55 p-4 md:p-5 shadow-lg">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-2 min-w-0">
                      <span className="inline-flex rounded-lg bg-blue-500/15 border border-blue-500/30 px-2.5 py-1 text-[11px] text-blue-200 font-mono">
                        {item.citation}
                      </span>
                      <h5 className="text-base font-semibold text-foreground leading-snug">{item.title}</h5>
                      <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                        <CalendarDays size={12} />
                        {item.court || "Court not available"} • {formatDecisionDate(item.decisionDate)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setLocation(`/judgment/${item.id}`)}
                        className="rounded-lg bg-primary/15 border border-primary/30 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20"
                        data-testid={`button-view-judgment-${item.id}`}
                      >
                        View Full Judgment →
                      </button>
                      {item.pdfUrl ? (
                        <a
                          href={item.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20"
                        >
                          <ExternalLink size={13} /> PDF
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>

        <aside className="min-h-0 space-y-4 overflow-y-auto pr-1">
          <section className="overflow-hidden rounded-xl border border-primary/25 bg-card/70">
            <div className="bg-primary px-4 py-3">
              <h4 className="inline-flex items-center gap-2 text-sm font-black text-foreground uppercase tracking-wider">
                <BookmarkPlus size={14} /> Saved Judgments
              </h4>
            </div>
            <div className="p-4 space-y-3">
              {savedJudgments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No saved judgments yet.</p>
              ) : (
                savedJudgments.slice(0, 6).map((saved) => (
                  <div key={saved.id} className="rounded-lg border border-border bg-background/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{saved.title}</p>
                        <p className="text-[10px] font-mono text-primary mt-1">{saved.citation}</p>
                      </div>
                      <button
                        onClick={() => void handleDeleteSaved(saved.id)}
                        className="text-muted-foreground hover:text-red-300"
                        title="Remove saved judgment"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
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
                      className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:text-foreground"
                    >
                      <Eye size={11} /> Open
                    </button>
                  </div>
                ))
              )}

              <button
                onClick={() => setLocation("/bookmarks")}
                className="w-full rounded-lg border border-border bg-background/35 px-3 py-2 text-xs font-semibold text-foreground hover:text-foreground hover:border-primary/30"
              >
                View Library
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card/55 p-4">
            <h4 className="text-sm font-black uppercase tracking-wider text-foreground mb-3 inline-flex items-center gap-2">
              <Gavel size={14} className="text-primary" /> Database Insights
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-background/35 p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Total Judgments</p>
                <p className="text-2xl font-bold text-foreground mt-1">{allResults.length}</p>
              </div>
              <div className="rounded-lg border border-border bg-background/35 p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Citation Hits</p>
                <p className="text-2xl font-bold text-foreground mt-1">{citationResults.length}</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Verified Content</p>
              <p className="text-xs text-muted-foreground mt-1">
                Results are grounded in your internal case-law registry and connected citation database.
              </p>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
