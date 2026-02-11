import { useState } from "react";
import { Search, Loader2, ExternalLink, AlertCircle, Book, Library, ChevronRight, Scale, FileSearch, Download, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

const COMMON_STATUTES = [
  {
    category: "The Fundamental Ground Rules",
    description: "The supreme law of the land.",
    items: [
      { label: "Constitution of Pakistan, 1973", query: "Constitution of the Islamic Republic of Pakistan 1973", detail: "Articles 8-28 (Fundamental Rights) and Article 199 (Writ Jurisdiction)." },
    ],
  },
  {
    category: "Criminal Law",
    description: "Definitions of crimes and procedure.",
    items: [
      { label: "Pakistan Penal Code (PPC), 1860", query: "Pakistan Penal Code 1860", detail: "Defines crimes from simple scuffle to 489-F cheque dishonour." },
      { label: "Code of Criminal Procedure (CrPC), 1898", query: "Code of Criminal Procedure 1898 Pakistan", detail: "FIRs, arrests, and Bail (Sections 497/498)." },
      { label: "PECA, 2016", query: "Prevention of Electronic Crimes Act 2016 Pakistan", detail: "Cybercrime and digital forensics." },
    ],
  },
  {
    category: "Civil & Property Law",
    description: "Filing suits, injunctions, and property movement.",
    items: [
      { label: "Code of Civil Procedure (CPC), 1908", query: "Code of Civil Procedure 1908 Pakistan", detail: "Suits, injunctions (stay orders), and appeals." },
      { label: "The Contract Act, 1872", query: "The Contract Act 1872 Pakistan", detail: "The foundation of every deal and partnership." },
      { label: "Transfer of Property Act, 1882", query: "The Transfer of Property Act 1882 Pakistan", detail: "Rules on land and property transfers." },
    ],
  },
  {
    category: "Family & Personal Law",
    description: "Marriage, divorce, custody, and inheritance.",
    items: [
      { label: "Family Courts Act, 1964", query: "West Pakistan Family Courts Act 1964", detail: "Khula, maintenance, and dower." },
      { label: "Guardians and Wards Act, 1890", query: "Guardians and Wards Act 1890 Pakistan", detail: "Custody of minors." },
    ],
  },
];

interface StatuteResult {
  shortTitle: string;
  section: string;
  description: string;
  punishment: string;
  uri?: string;
  source?: string;
}

export default function StatuteSearchPage() {
  const [query, setQuery] = useState("");
  const [localResults, setLocalResults] = useState<StatuteResult[]>([]);
  const [externalResults, setExternalResults] = useState<StatuteResult[]>([]);
  const [searchSummary, setSearchSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExternalLoading, setIsExternalLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedBrief, setSelectedBrief] = useState<StatuteResult | null>(null);
  const [briefContent, setBriefContent] = useState("");
  const [isBriefing, setIsBriefing] = useState(false);

  const handleSearch = async (overrideQuery?: string) => {
    const q = (overrideQuery || query).trim();
    if (!q) return;
    setIsLoading(true);
    setSearchError(null);
    setExternalResults([]);
    setSearchSummary("");

    try {
      const localRes = await fetch(`/api/statutes/search?q=${encodeURIComponent(q)}`);
      const local = await localRes.json();
      setLocalResults(local.map((r: any) => ({ ...r, source: "internal" })));
    } catch { setLocalResults([]); }
    setIsLoading(false);

    setIsExternalLoading(true);
    try {
      const extRes = await apiRequest("POST", "/api/ai/search-statutes", { query: q });
      const ext = await extRes.json();
      const raw = Array.isArray(ext) ? ext : (ext.statutes || ext.results || []);
      const results = raw.map((r: any) => ({ ...r, source: "external" }));
      setExternalResults(results);

      if (results.length > 0) {
        setIsSummarizing(true);
        try {
          const sumRes = await apiRequest("POST", "/api/ai/summarize", { query: q, findings: results.slice(0, 5) });
          const sumData = await sumRes.json();
          setSearchSummary(sumData.summary || "");
        } catch {}
        setIsSummarizing(false);
      }
    } catch (e: any) {
      const isLimit = e?.message?.includes("429");
      setSearchError(isLimit ? "Monthly query limit reached. Upgrade your plan for more searches." : "AI research feed unavailable.");
      if (isLimit) queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
    }
    setIsExternalLoading(false);

    await apiRequest("POST", "/api/search-history", { type: "statute", query: q }).catch(() => {});
  };

  const handleBrief = async (statute: StatuteResult) => {
    setSelectedBrief(statute);
    setBriefContent("");
    setIsBriefing(true);
    try {
      const res = await apiRequest("POST", "/api/ai/brief", {
        shortTitle: statute.shortTitle,
        section: statute.section,
        description: statute.description,
      });
      const data = await res.json();
      setBriefContent(data.brief || "Brief generation failed.");
    } catch (e: any) {
      const isLimit = e?.message?.includes("429");
      setBriefContent(isLimit ? "Monthly query limit reached. Upgrade your plan to generate briefs." : "Strategic brief generation failed. Please retry later.");
      if (isLimit) queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
    }
    setIsBriefing(false);
  };

  const allResults = [...localResults, ...externalResults];

  return (
    <div className="space-y-10 fade-in pb-20" data-testid="statute-search-page">
      {selectedBrief && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-[#0f172a]/95 backdrop-blur-md fade-in">
          <div className="bg-[#1e293b] border border-slate-700 w-full max-w-4xl h-[85vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-800 bg-[#0f172a]/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl"><FileSearch size={24} /></div>
                <div>
                  <h3 className="text-xl font-bold text-white uppercase tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                    {selectedBrief.shortTitle} Section {selectedBrief.section}
                  </h3>
                  <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mt-1">Strategic Chambers Briefing</p>
                </div>
              </div>
              <button onClick={() => setSelectedBrief(null)} className="p-3 hover:bg-red-500/10 rounded-xl text-slate-400 hover:text-red-500 transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 md:p-12 bg-white/5 scrollbar-hide">
              {isBriefing ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <Loader2 size={48} className="animate-spin text-blue-500" />
                  <p className="text-sm font-black uppercase tracking-widest text-slate-500 animate-pulse">Drafting Strategic Analysis...</p>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto legal-draft-font whitespace-pre-wrap">{briefContent}</div>
              )}
            </div>
            <div className="p-6 border-t border-slate-800 bg-[#0f172a]/50 flex justify-between items-center">
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-600">Al Wakeelo Digital Chambers</p>
              {!isBriefing && briefContent && (
                <button
                  onClick={() => {
                    const blob = new Blob([briefContent], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `brief-${selectedBrief.shortTitle}-${selectedBrief.section}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all"
                >
                  <Download size={14} /> Export Brief
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-bold text-white italic tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            Statute Registry
          </h2>
          <p className="text-slate-500 mt-2 font-medium">Verified Chambers Vaults & Grounded Pakistani Statutory Search.</p>
        </div>
        <div className="flex flex-col gap-2 w-full lg:w-[35rem]">
          <div className="flex gap-3 bg-[#1e293b] p-3 rounded-[2.5rem] border border-slate-800 shadow-2xl">
            <input
              className="flex-1 bg-transparent border-none px-6 py-3 text-sm text-white focus:ring-0 focus:outline-none placeholder:text-slate-600"
              placeholder="Search statutes, sections, legal provisions..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              data-testid="input-statute-search"
            />
            <button onClick={() => handleSearch()} disabled={isLoading} data-testid="button-statute-search" className="p-4 bg-amber-500 text-slate-950 rounded-[2rem] hover:bg-amber-400 transition-all shadow-xl active:scale-95">
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

      <div className="bg-[#1e293b] border border-slate-800 rounded-[3rem] p-8 md:p-10 shadow-2xl space-y-8 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none scale-150"><Book size={200} /></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl"><Library size={24} /></div>
          <div>
            <h4 className="text-lg font-bold text-white tracking-tight uppercase italic" style={{ fontFamily: "'Playfair Display', serif" }}>
              Pakistani Legal Pillars: Quick Access
            </h4>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1">Direct statutory references.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
          {COMMON_STATUTES.map((cat, idx) => (
            <div key={idx} className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 mb-1">{cat.category}</h5>
                <p className="text-[9px] text-slate-500 leading-relaxed italic">{cat.description}</p>
              </div>
              <div className="space-y-2">
                {cat.items.map((stat, i) => (
                  <button
                    key={i}
                    onClick={() => { setQuery(stat.query); handleSearch(stat.query); }}
                    className="w-full text-left p-4 bg-[#0f172a] border border-slate-800 rounded-2xl transition-all hover:border-amber-500/50 group"
                    data-testid={`statute-quick-${idx}-${i}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-slate-300 group-hover:text-white transition-colors">{stat.label}</span>
                      <ChevronRight size={12} className="text-slate-700 group-hover:text-amber-500 transition-all" />
                    </div>
                    <p className="text-[9px] text-slate-600 group-hover:text-slate-400 transition-colors leading-relaxed line-clamp-2">{stat.detail}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {(searchSummary || isSummarizing) && (
        <div className="p-8 md:p-10 bg-amber-500/5 border border-amber-500/30 rounded-[3rem] shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl"><Scale size={20} /></div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500">Advocate's Take: Chambers Brief</h3>
            {isSummarizing && <Loader2 size={16} className="animate-spin ml-auto text-amber-500" />}
          </div>
          <div className="legal-draft-font italic text-xl leading-relaxed text-slate-200">
            {isSummarizing ? "Synthesizing statutory data for chambers..." : searchSummary}
          </div>
        </div>
      )}

      {allResults.length > 0 && (
        <div className="space-y-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-slate-800" />
            <h3 className="text-[11px] font-black uppercase text-slate-600 tracking-[0.5em] flex items-center gap-4">
              Joint Intelligence Docket ({allResults.length})
              {isExternalLoading && <Loader2 size={14} className="animate-spin text-amber-500" />}
            </h3>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {allResults.map((item, idx) => (
              <div key={idx} className={`p-8 md:p-10 rounded-[3rem] shadow-2xl transition-all relative border ${item.source === "external" ? "bg-[#1e293b]/80 border-blue-500/10 hover:border-blue-500/30" : "bg-[#1e293b] border-slate-800 hover:border-amber-500/30"}`} data-testid={`statute-result-${idx}`}>
                <div className="flex flex-wrap gap-3 mb-6">
                  <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${item.source === "external" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-amber-500/10 border-amber-500/20 text-amber-500"}`}>
                    {item.source === "external" ? "Research Feed" : "Internal Registry"}
                  </span>
                  <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-[9px] font-black uppercase tracking-widest">{item.shortTitle}</span>
                </div>
                <h4 className="text-xl font-bold text-white mb-4 leading-snug" style={{ fontFamily: "'Playfair Display', serif" }}>{item.description}</h4>
                <p className="text-xs leading-relaxed mb-8 text-slate-500 line-clamp-4">{item.punishment}</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={() => handleBrief(item)} className="flex-1 bg-blue-600/10 text-blue-400 text-[10px] font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2">
                    <FileSearch size={16} /> Read Brief
                  </button>
                  {item.uri && (
                    <a href={item.uri} target="_blank" rel="noopener noreferrer" className="flex-1 bg-emerald-600/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all text-center flex items-center justify-center gap-2">
                      <ExternalLink size={16} /> Official Portal
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
