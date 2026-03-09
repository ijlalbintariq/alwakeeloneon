import { Gavel, Link2 } from "lucide-react";
import { useLocation } from "wouter";
import JudgmentSearchPage from "./judgment-search";
import CitationSearchPage from "./citation-search";

type JudgmentTab = "keywords" | "citation";

function resolveTab(): JudgmentTab {
  const params = new URLSearchParams(window.location.search);
  return params.get("tab") === "citation" ? "citation" : "keywords";
}

export default function JudgmentsPage() {
  const [, setLocation] = useLocation();
  const activeTab = resolveTab();

  const setTab = (tab: JudgmentTab) => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    const query = params.toString();
    setLocation(query ? `/judgments?${query}` : "/judgments");
  };

  return (
    <div className="space-y-4" data-testid="judgments-unified-page">
      <div className="rounded-2xl border border-slate-800 bg-[#1e293b]/65 p-2 inline-flex items-center gap-2">
        <button
          onClick={() => setTab("keywords")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all ${
            activeTab === "keywords"
              ? "bg-amber-500 text-slate-950"
              : "text-slate-300 hover:bg-white/5"
          }`}
          data-testid="button-tab-judgments-keywords"
        >
          <Gavel size={14} />
          By Keywords
        </button>
        <button
          onClick={() => setTab("citation")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all ${
            activeTab === "citation"
              ? "bg-amber-500 text-slate-950"
              : "text-slate-300 hover:bg-white/5"
          }`}
          data-testid="button-tab-judgments-citation"
        >
          <Link2 size={14} />
          By Citation
        </button>
      </div>

      {activeTab === "keywords" ? <JudgmentSearchPage /> : <CitationSearchPage />}
    </div>
  );
}
