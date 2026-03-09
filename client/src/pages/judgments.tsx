import { Gavel, Link2 } from "lucide-react";
import JudgmentSearchPage from "./judgment-search";
import CitationSearchPage from "./citation-search";

export default function JudgmentsPage() {
  return (
    <div className="space-y-6 md:space-y-8 fade-in" data-testid="judgments-unified-page">
      <div className="rounded-3xl border border-slate-800 bg-[#1e293b]/75 p-5 md:p-6 shadow-2xl">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-500/70">Judgments Workspace</p>
        <h2
          className="mt-2 text-2xl md:text-3xl font-bold text-white italic tracking-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Search by Keywords and Citation on one screen
        </h2>
      </div>

      <section className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-amber-300">
          <Gavel size={14} />
          By Keywords
        </div>
        <JudgmentSearchPage />
      </section>

      <section className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/10 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-blue-300">
          <Link2 size={14} />
          By Citation
        </div>
        <CitationSearchPage />
      </section>
    </div>
  );
}
