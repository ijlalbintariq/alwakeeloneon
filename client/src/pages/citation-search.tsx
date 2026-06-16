import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Building2, Calendar, ExternalLink, Hash, Loader2, Search, BookOpen } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

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

function formatDecisionDate(value: string | null): string {
  if (!value) return "Date not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return date.toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "2-digit" });
}

export default function CitationSearchPage() {
  const [, setLocation] = useLocation();
  const currentYear = new Date().getFullYear();

  const years = useMemo(() => {
    const list: number[] = [];
    for (let year = currentYear + 1; year >= 1947; year -= 1) list.push(year);
    return list;
  }, [currentYear]);

  const [year, setYear] = useState<number>(currentYear);
  const [journal, setJournal] = useState<string>("");
  const [page, setPage] = useState<string>("");
  const [court, setCourt] = useState<string>("");

  const [journals, setJournals] = useState<Journal[]>([]);
  const [results, setResults] = useState<CitationResult[]>([]);

  const [loadingJournals, setLoadingJournals] = useState<boolean>(true);
  const [searching, setSearching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  useEffect(() => {
    async function loadJournals() {
      setLoadingJournals(true);
      setError(null);
      try {
        const res = await fetch("/api/journals", { credentials: "include" });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.message || "Failed to load journals");
        }
        const data = (await res.json()) as Journal[];
        setJournals(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load journals");
      } finally {
        setLoadingJournals(false);
      }
    }

    void loadJournals();
  }, []);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    setHasSearched(true);
    setError(null);

    const pageNumber = Number(page);
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      setError("Page must be a positive number.");
      return;
    }

    setSearching(true);
    try {
      const query = new URLSearchParams({
        year: String(year),
        page: String(pageNumber),
      });
      if (journal.trim()) query.set("journal", journal.trim());
      if (court.trim()) query.set("court", court.trim());

      const res = await apiRequest("GET", `/api/citation-search?${query.toString()}`);
      const data = (await res.json()) as CitationResult[];
      setResults(data);
    } catch (err: any) {
      setResults([]);
      setError(err?.message || "Failed to search citation");
    } finally {
      setSearching(false);
    }
  }

  const citationPreview = `${year} ${journal || "ALL"} ${page || "PAGE"}`;

  return (
    <div className="space-y-8 fade-in" data-testid="citation-search-page">
      <div>
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground italic tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
          Citation Search
        </h2>
        <p className="text-muted-foreground mt-2">Search exact Pakistan legal citations by year, journal, and page.</p>
      </div>

      <form onSubmit={handleSearch} className="rounded-3xl border border-border bg-card/75 p-5 md:p-7 shadow-2xl space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground inline-flex items-center gap-2">
              <Calendar size={13} /> Year
            </span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-xl border border-border bg-background/80 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              data-testid="select-citation-year"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground inline-flex items-center gap-2">
              <BookOpen size={13} /> Journal
            </span>
            <select
              value={journal}
              onChange={(e) => setJournal(e.target.value)}
              className="w-full rounded-xl border border-border bg-background/80 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              disabled={loadingJournals}
              data-testid="select-citation-journal"
            >
              {journals.length === 0 ? <option value="">No journals available</option> : null}
              {journals.length > 0 ? <option value="">All Journals</option> : null}
              {journals.map((j) => (
                <option key={j.id} value={j.code}>
                  {j.code} - {j.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground inline-flex items-center gap-2">
              <Hash size={13} /> Page
            </span>
            <input
              type="number"
              min={1}
              value={page}
              onChange={(e) => setPage(e.target.value)}
              placeholder="e.g. 100"
              className="w-full rounded-xl border border-border bg-background/80 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              data-testid="input-citation-page"
            />
          </label>
        </div>

        <label className="space-y-2 block">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground inline-flex items-center gap-2">
            <Building2 size={13} /> Court (Optional)
          </span>
          <input
            value={court}
            onChange={(e) => setCourt(e.target.value)}
            placeholder="Supreme Court, Lahore High Court, etc."
            className="w-full rounded-xl border border-border bg-background/80 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            data-testid="input-citation-court"
          />
        </label>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2">
            <p className="text-[9px] uppercase font-black tracking-[0.2em] text-blue-400">Citation Preview</p>
            <p className="font-mono text-sm text-blue-200" data-testid="text-citation-preview">{citationPreview}</p>
          </div>

          <button
            type="submit"
            disabled={searching || loadingJournals}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-citation-search"
          >
            {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Search
          </button>
        </div>
      </form>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" data-testid="citation-search-error">
          {error}
        </div>
      ) : null}

      {!error && hasSearched && !searching && results.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/40 px-5 py-6 text-muted-foreground" data-testid="citation-search-empty">
          No matching judgments found for this citation.
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="space-y-3" data-testid="citation-search-results">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-black">{results.length} result(s)</p>
          {results.map((item) => (
            <article key={item.id} className="rounded-2xl border border-border bg-card/65 p-4 md:p-5 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="space-y-2 min-w-0">
                  <span className="inline-flex rounded-lg bg-blue-500/15 border border-blue-500/30 px-2.5 py-1 text-[11px] text-blue-200 font-mono">
                    {item.citation}
                  </span>
                  <h3 className="text-lg font-semibold text-foreground leading-snug">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">
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
  );
}
