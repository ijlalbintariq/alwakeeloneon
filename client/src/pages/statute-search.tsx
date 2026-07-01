import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Search, Loader2, X, Book, ChevronRight, FileText } from "lucide-react";
import { useDocumentHead } from "@/hooks/use-document-head";

type StatuteDocResult = {
  id: number;
  title: string;
  category: string;
  filename: string;
};

const COMMON_STATUTES = [
  {
    category: "The Fundamental Ground Rules",
    description: "The supreme law of the land.",
    items: [
      { label: "Constitution of Pakistan, 1973", query: "Constitution", detail: "Articles 8-28 (Fundamental Rights) and Article 199 (Writ Jurisdiction)." },
    ],
  },
  {
    category: "Criminal Law",
    description: "Definitions of crimes and procedure.",
    items: [
      { label: "Pakistan Penal Code (PPC), 1860", query: "Pakistan Penal Code", detail: "Defines crimes from simple scuffle to 489-F cheque dishonour." },
      { label: "Code of Criminal Procedure (CrPC), 1898", query: "Criminal Procedure", detail: "FIRs, arrests, and Bail (Sections 497/498)." },
      { label: "PECA, 2016", query: "Electronic Crimes", detail: "Cybercrime and digital forensics." },
    ],
  },
  {
    category: "Civil & Property Law",
    description: "Filing suits, injunctions, and property movement.",
    items: [
      { label: "Code of Civil Procedure (CPC), 1908", query: "Civil Procedure", detail: "Suits, injunctions (stay orders), and appeals." },
      { label: "The Contract Act, 1872", query: "Contract Act", detail: "The foundation of every deal and partnership." },
      { label: "Transfer of Property Act, 1882", query: "Transfer of Property", detail: "Rules on land and property transfers." },
    ],
  },
  {
    category: "Family & Personal Law",
    description: "Marriage, divorce, custody, and inheritance.",
    items: [
      { label: "Family Courts Act, 1964", query: "Family Courts", detail: "Khula, maintenance, and dower." },
      { label: "Guardians and Wards Act, 1890", query: "Guardians and Wards", detail: "Custody of minors." },
    ],
  },
];

export default function StatuteSearchPage() {
  useDocumentHead({
    title: "Pakistani Statute Search — Constitution, PPC, CPC, CrPC, Family Laws",
    description: "Search Pakistani statutes by name, section, or keyword. Constitution of Pakistan, Pakistan Penal Code, CPC, CrPC, Family Laws, Contract Act, and more.",
    path: "/statute-search",
  });
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<StatuteDocResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [autoSearchDone, setAutoSearchDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q && !autoSearchDone) {
      setAutoSearchDone(true);
      handleQuickSearch(q);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/statute-documents/search?q=${encodeURIComponent(value.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
          setShowDropdown(data.length > 0);
        }
      } catch {}
      setIsSearching(false);
    }, 300);
  }

  function handleSelectStatute(doc: StatuteDocResult) {
    setShowDropdown(false);
    setLocation(`/statute-view/${doc.id}`);
  }

  async function handleQuickSearch(searchQuery: string) {
    setQuery(searchQuery);
    setIsSearching(true);
    try {
      const res = await fetch(`/api/statute-documents/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
        setShowDropdown(data.length > 0);
      }
    } catch {}
    setIsSearching(false);
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-2.5 fade-in" data-testid="statute-search-page">
      <section className="relative rounded-2xl border border-slate-200 dark:border-primary/20 bg-white dark:bg-[radial-gradient(120%_120%_at_0%_0%,rgba(245,158,11,0.20),rgba(15,23,42,0.85)_45%,rgba(2,6,23,0.95)_100%)] px-4 py-4 sm:px-5 sm:py-5 shadow-sm dark:shadow-[0_24px_40px_-28px_rgba(2,6,23,0.95)]">
        <div className="pointer-events-none absolute -left-8 -top-10 h-36 w-36 rounded-full bg-transparent dark:bg-primary/15 blur-2xl" />
        <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-transparent dark:bg-blue-400/10 blur-2xl" />
        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.22em] font-black text-slate-400 dark:text-foreground/80">Pakistani Statute Library</p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-none tracking-tight text-slate-900 dark:text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
                Statute Search
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-foreground/85">Search, open, and navigate Acts, Codes, Ordinances, and Rules.</p>
            </div>
            <div className="hidden sm:inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 dark:border-primary/25 bg-slate-50 dark:bg-card/70 text-slate-800 dark:text-primary shadow-sm dark:shadow-[0_16px_30px_-22px_rgba(251,191,36,0.9)]">
              <Book size={18} />
            </div>
          </div>

          <div className="relative" ref={searchRef}>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-primary/20 bg-slate-50 dark:bg-background/75 p-2 shadow-sm dark:shadow-[0_24px_42px_-28px_rgba(2,6,23,1)] backdrop-blur-md">
              <div className="flex items-center px-2">
                <Search size={17} className="text-slate-400 dark:text-primary/80" />
              </div>
              <input
                className="flex-1 bg-transparent border-none py-2 text-sm text-slate-900 dark:text-foreground focus:ring-0 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-muted-foreground"
                placeholder="Search statutes, acts, ordinances..."
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                data-testid="input-statute-search"
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery("");
                    setSuggestions([]);
                    setShowDropdown(false);
                  }}
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-clear-search"
                >
                  <X size={16} />
                </button>
              )}
              {isSearching && <Loader2 size={18} className="text-primary animate-spin self-center mr-1" />}
              <button
                onClick={() => handleQuickSearch(query)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/70 bg-primary px-3 py-2 text-xs font-black uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-all active:scale-95"
                data-testid="button-statute-search"
              >
                <Search size={13} />
                Search
              </button>
            </div>

            {showDropdown && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-[hsl(var(--preview-border))] bg-card shadow-2xl z-50 overflow-hidden max-h-[420px] overflow-y-auto" data-testid="search-dropdown">
                {suggestions.map((doc) => (
                  <button
                    key={doc.id}
                    className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border/80 last:border-b-0 flex items-center gap-3"
                    onClick={() => handleSelectStatute(doc)}
                    data-testid={`dropdown-item-${doc.id}`}
                  >
                    <div className="h-8 w-8 flex-shrink-0 rounded-lg border border-[hsl(var(--preview-border))] bg-background flex items-center justify-center">
                      <FileText size={14} className="text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{doc.title}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.18em]">{doc.category}</p>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground flex-shrink-0 ml-auto" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="flex-1 min-h-0 rounded-2xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))/0.85] backdrop-blur-xl p-2.5 sm:p-3 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 opacity-[0.03] pointer-events-none scale-[1.6]">
          <Book size={220} />
        </div>
        <div className="relative z-10 h-full flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[hsl(var(--preview-border))] bg-card text-primary">
              <Book size={12} />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                Quick Statute Access
              </h4>
              <p className="text-[9px] text-muted-foreground uppercase tracking-[0.12em] font-bold">
                Tap any reference to search instantly
              </p>
            </div>
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
            {COMMON_STATUTES.map((cat, idx) => (
              <article key={idx} className="h-full rounded-xl border border-[hsl(var(--preview-border))] bg-background/90 backdrop-blur-md p-4 space-y-2.5">
                <div className="pb-1 border-b border-[hsl(var(--preview-border))]">
                  <h5 className="text-[10px] font-black uppercase tracking-[0.12em] text-primary mb-1">{cat.category}</h5>
                  <p className="text-[11px] text-muted-foreground leading-snug text-justify">{cat.description}</p>
                </div>
                <div className="space-y-1.5">
                  {cat.items.map((stat, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickSearch(stat.query)}
                      className="w-full text-left rounded-lg border border-[hsl(var(--preview-border))] bg-card/95 backdrop-blur-sm px-3 py-2 transition-all hover:border-primary/45 hover:bg-card group"
                      data-testid={`statute-quick-${idx}-${i}`}
                    >
                      <div className="flex items-start justify-between gap-1.5 mb-0.5">
                        <span className="text-[11px] font-semibold text-foreground group-hover:text-foreground transition-colors">{stat.label}</span>
                        <ChevronRight size={11} className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                      </div>
                      <p className="text-[10px] text-muted-foreground group-hover:text-muted-foreground transition-colors leading-snug text-justify">{stat.detail}</p>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
