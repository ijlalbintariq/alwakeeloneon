import { useState } from "react";
import { Search, Loader2, ExternalLink, AlertCircle, Gavel } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface CaseLawResult {
  citation: string;
  court: string;
  title: string;
  summary: string;
  keywords?: string[];
  uri?: string;
  source?: string;
}

export default function JudgmentSearchPage() {
  const [query, setQuery] = useState("");
  const [localResults, setLocalResults] = useState<CaseLawResult[]>([]);
  const [externalResults, setExternalResults] = useState<CaseLawResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExternalLoading, setIsExternalLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setSearchError(null);
    setExternalResults([]);

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
      setSearchError("AI research feed unavailable.");
    }
    setIsExternalLoading(false);

    await apiRequest("POST", "/api/search-history", { type: "judgment", query }).catch(() => {});
  };

  const allResults = [...localResults, ...externalResults];

  return (
    <div className="space-y-10 fade-in pb-20" data-testid="judgment-search-page">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-bold text-white italic tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            Judgment Vault
          </h2>
          <p className="text-slate-500 mt-2 font-medium">Verified Chambers Vaults & Grounded Pakistani Legal Search.</p>
        </div>
        <div className="flex flex-col gap-2 w-full lg:w-[35rem]">
          <div className="flex gap-3 bg-[#1e293b] p-3 rounded-[2.5rem] border border-slate-800 shadow-2xl">
            <input
              className="flex-1 bg-transparent border-none px-6 py-3 text-sm text-white focus:ring-0 focus:outline-none placeholder:text-slate-600"
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
              className="p-4 bg-amber-500 text-slate-950 rounded-[2rem] hover:bg-amber-400 transition-all shadow-xl active:scale-95"
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {allResults.map((item, idx) => (
              <div
                key={idx}
                className={`p-8 md:p-10 rounded-[3rem] shadow-2xl transition-all relative border ${
                  item.source === "external"
                    ? "bg-[#1e293b]/80 border-blue-500/10 hover:border-blue-500/30"
                    : "bg-[#1e293b] border-slate-800 hover:border-amber-500/30"
                }`}
                data-testid={`judgment-result-${idx}`}
              >
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
                {item.uri && (
                  <a
                    href={item.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-emerald-600/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest py-3 px-5 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"
                  >
                    <ExternalLink size={14} /> View Source
                  </a>
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
    </div>
  );
}
