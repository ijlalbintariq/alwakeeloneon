import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { AlertTriangle, ArrowLeft, ArrowRight, Calendar, ExternalLink, Gavel, Link2, Loader2 } from "lucide-react";

type CitationLinkItem = {
  id: number;
  citationType: "relied_upon" | "referred_to" | "distinguished" | "overruled" | string;
  contextExcerpt: string | null;
  citationText: string;
  linkedJudgmentId: string | null;
  linkedCitation: string | null;
  linkedTitle: string | null;
};

type JudgmentDetailPayload = {
  id: string;
  citation: string;
  title: string;
  petitioner: string | null;
  respondent: string | null;
  court: string;
  decisionDate: string | null;
  headnotes: string | null;
  fullText: string;
  pdfUrl: string | null;
  citations: {
    made: CitationLinkItem[];
    received: CitationLinkItem[];
  };
};

function formatDate(value: string | null): string {
  if (!value) return "Date not available";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Date not available";
  return d.toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "2-digit" });
}

function typeBadgeClasses(type: string): string {
  if (type === "relied_upon") return "bg-emerald-500/10 border-emerald-500/30 text-emerald-300";
  if (type === "distinguished") return "bg-amber-500/10 border-amber-500/30 text-amber-300";
  if (type === "overruled") return "bg-red-500/10 border-red-500/30 text-red-300";
  return "bg-blue-500/10 border-blue-500/30 text-blue-300";
}

function typeLabel(type: string): string {
  return type.replace(/_/g, " ");
}

function CitationCard({ item }: { item: CitationLinkItem }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#1e293b]/60 p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {item.linkedJudgmentId ? (
          <Link href={`/judgment/${item.linkedJudgmentId}`} className="font-mono text-sm text-blue-300 hover:text-blue-200 underline">
            {item.linkedCitation || item.citationText}
          </Link>
        ) : (
          <span className="font-mono text-sm text-blue-300">{item.linkedCitation || item.citationText}</span>
        )}
        <span className={`text-[10px] uppercase tracking-[0.18em] font-black rounded-md border px-2 py-1 ${typeBadgeClasses(item.citationType)}`}>
          {typeLabel(item.citationType)}
        </span>
      </div>
      {item.linkedTitle ? <p className="text-sm text-slate-200">{item.linkedTitle}</p> : null}
      {item.contextExcerpt ? <p className="text-sm italic text-slate-400">"{item.contextExcerpt}"</p> : null}
    </div>
  );
}

export default function JudgmentDetailPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/judgment/:id");
  const judgmentId = params?.id;

  const [detail, setDetail] = useState<JudgmentDetailPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!judgmentId) {
        setLocation("/citation-search");
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/judgments/${encodeURIComponent(judgmentId)}`, { credentials: "include" });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.message || "Failed to load judgment");
        }
        const data = (await res.json()) as JudgmentDetailPayload;
        setDetail(data);
      } catch (err: any) {
        setDetail(null);
        setError(err?.message || "Failed to load judgment");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [judgmentId, setLocation]);

  const fullTextParagraphs = useMemo(() => {
    if (!detail?.fullText) return [];
    return detail.fullText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  }, [detail?.fullText]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center py-20">
        <div className="inline-flex items-center gap-3 text-slate-400">
          <Loader2 size={20} className="animate-spin" />
          Loading judgment details...
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setLocation("/citation-search")}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/50"
        >
          <ArrowLeft size={14} /> Back to Citation Search
        </button>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
          {error || "Judgment not found"}
        </div>
      </div>
    );
  }

  const hasOverruled = detail.citations.received.some((item) => item.citationType === "overruled");

  return (
    <div className="space-y-7 fade-in" data-testid="judgment-detail-page">
      <button
        onClick={() => setLocation("/citation-search")}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/50"
      >
        <ArrowLeft size={14} /> Back to Citation Search
      </button>

      <section className="rounded-3xl border border-slate-800 bg-[#1e293b]/75 p-5 md:p-7 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-blue-500/15 border border-blue-500/30 px-3 py-1.5 font-mono text-blue-200">
            {detail.citation}
          </span>
          {detail.pdfUrl ? (
            <a
              href={detail.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-300"
            >
              <ExternalLink size={13} /> PDF
            </a>
          ) : null}
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
          {detail.title}
        </h1>

        {(detail.petitioner || detail.respondent) ? (
          <p className="text-slate-300 text-sm">
            <span className="font-semibold">{detail.petitioner || "Petitioner"}</span> VS <span className="font-semibold">{detail.respondent || "Respondent"}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-5 text-sm text-slate-400">
          <span className="inline-flex items-center gap-2"><Gavel size={14} /> {detail.court || "Court not available"}</span>
          <span className="inline-flex items-center gap-2"><Calendar size={14} /> {formatDate(detail.decisionDate)}</span>
        </div>
      </section>

      {detail.citations.made.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white inline-flex items-center gap-2"><Link2 size={16} /> Cases Cited ({detail.citations.made.length})</h2>
          <div className="space-y-3">
            {detail.citations.made.map((item) => (
              <CitationCard key={`made-${item.id}`} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {detail.citations.received.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white inline-flex items-center gap-2"><ArrowRight size={16} /> Cited In ({detail.citations.received.length}) cases</h2>

          {hasOverruled ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 inline-flex items-center gap-2">
              <AlertTriangle size={15} /> This judgment has overruled treatment in citing cases.
            </div>
          ) : null}

          <div className="space-y-3">
            {detail.citations.received.map((item) => (
              <CitationCard key={`received-${item.id}`} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {detail.headnotes ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-white">Headnotes</h2>
          <div className="rounded-xl border border-slate-800 bg-[#1e293b]/60 p-4 text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
            {detail.headnotes}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Full Judgment</h2>
        <div className="rounded-xl border border-slate-800 bg-[#1e293b]/60 p-4 md:p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {fullTextParagraphs.length === 0 ? (
            <p className="text-slate-400">Full text is not available.</p>
          ) : (
            fullTextParagraphs.map((paragraph, index) => (
              <p key={index} className="text-slate-200 leading-relaxed text-sm">
                {paragraph}
              </p>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
