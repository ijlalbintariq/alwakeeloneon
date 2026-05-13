import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { AlertTriangle, ArrowLeft, ArrowRight, Calendar, ExternalLink, Gavel, Link2, Loader2, Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentHead } from "@/hooks/use-document-head";

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

type PublicJudgmentPreview = {
  id: string;
  citation: string;
  title: string;
  petitioner: string | null;
  respondent: string | null;
  court: string;
  decisionDate: string | null;
  headnotes: string | null;
  previewText: string;
  previewWordCount: number;
  totalWordCount: number;
  isPreview: true;
  isTruncated: boolean;
};

function formatDate(value: string | null): string {
  if (!value) return "Date not available";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Date not available";
  return d.toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "2-digit" });
}

function typeBadgeClasses(type: string): string {
  if (type === "relied_upon") return "bg-emerald-500/10 border-emerald-500/30 text-emerald-300";
  if (type === "distinguished") return "bg-primary/10 border-primary/30 text-primary";
  if (type === "overruled") return "bg-red-500/10 border-red-500/30 text-red-300";
  return "bg-blue-500/10 border-blue-500/30 text-blue-300";
}

function typeLabel(type: string): string {
  return type.replace(/_/g, " ");
}

function CitationCard({ item }: { item: CitationLinkItem }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2">
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
      {item.linkedTitle ? <p className="text-sm text-foreground">{item.linkedTitle}</p> : null}
      {item.contextExcerpt ? <p className="text-sm italic text-muted-foreground">"{item.contextExcerpt}"</p> : null}
    </div>
  );
}

export default function JudgmentDetailPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/judgment/:id");
  const judgmentId = params?.id;
  const { user, isLoading: authLoading } = useAuth();
  const isAuthed = !!user;

  const [detail, setDetail] = useState<JudgmentDetailPayload | null>(null);
  const [preview, setPreview] = useState<PublicJudgmentPreview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Per-judgment SEO meta. Server already injects a generic title at the HTML
  // layer; this client-side hook refines it once the title/citation are known.
  const headTitle = preview?.title || detail?.title;
  const headCitation = preview?.citation || detail?.citation;
  useDocumentHead({
    title: headTitle
      ? `${headTitle}${headCitation ? ` (${headCitation})` : ""} | Al Wakeelo`
      : "Pakistani Judgment — Full Text & Citations | Al Wakeelo",
    description: headTitle
      ? `Read ${headTitle}${headCitation ? `, ${headCitation}` : ""} on Al Wakeelo — Pakistan's AI legal assistant. Verified case-law text, court, and related citations.`
      : "Read the full text of this Pakistani judgment with verified citation, court, and related case-law references on Al Wakeelo.",
    path: judgmentId ? `/judgment/${judgmentId}` : undefined,
  });

  useEffect(() => {
    // Wait until we know whether the visitor is signed in — picks the right
    // endpoint without flickering between preview and full views.
    if (authLoading) return;

    async function load() {
      if (!judgmentId) {
        setLocation("/judgments");
        return;
      }

      setLoading(true);
      setError(null);
      try {
        if (isAuthed) {
          const res = await fetch(`/api/judgments/${encodeURIComponent(judgmentId)}`, { credentials: "include" });
          if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            throw new Error(payload?.message || "Failed to load judgment");
          }
          const data = (await res.json()) as JudgmentDetailPayload;
          setDetail(data);
          setPreview(null);
        } else {
          const res = await fetch(`/api/public/judgments/${encodeURIComponent(judgmentId)}`);
          if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            throw new Error(payload?.message || "Failed to load judgment");
          }
          const data = (await res.json()) as PublicJudgmentPreview;
          setPreview(data);
          setDetail(null);
        }
      } catch (err: any) {
        setDetail(null);
        setPreview(null);
        setError(err?.message || "Failed to load judgment");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [judgmentId, isAuthed, authLoading, setLocation]);

  const fullTextParagraphs = useMemo(() => {
    if (!detail?.fullText) return [];
    return detail.fullText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  }, [detail?.fullText]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center py-20">
        <div className="inline-flex items-center gap-3 text-muted-foreground">
          <Loader2 size={20} className="animate-spin" />
          Loading judgment details...
        </div>
      </div>
    );
  }

  if (error || (!detail && !preview)) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setLocation("/judgments")}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-card/50"
        >
          <ArrowLeft size={14} /> Back to Judgments
        </button>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
          {error || "Judgment not found"}
        </div>
      </div>
    );
  }

  // Public preview view — anonymous visitors and search crawlers.
  if (preview) {
    const previewParagraphs = preview.previewText
      ? preview.previewText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
      : [];
    return (
      <div className="space-y-7 fade-in" data-testid="judgment-detail-page-public">
        <section className="rounded-3xl border border-border bg-card/75 p-5 md:p-7 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-blue-500/15 border border-blue-500/30 px-3 py-1.5 font-mono text-blue-200">
              {preview.citation}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            {preview.title}
          </h1>
          {(preview.petitioner || preview.respondent) ? (
            <p className="text-foreground text-sm">
              <span className="font-semibold">{preview.petitioner || "Petitioner"}</span> VS <span className="font-semibold">{preview.respondent || "Respondent"}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2"><Gavel size={14} /> {preview.court || "Court not available"}</span>
            <span className="inline-flex items-center gap-2"><Calendar size={14} /> {formatDate(preview.decisionDate)}</span>
          </div>
        </section>

        {preview.headnotes ? (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Headnotes</h2>
            <div className="rounded-xl border border-border bg-card/60 p-4 text-foreground whitespace-pre-wrap text-sm leading-relaxed">
              {preview.headnotes}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Judgment Excerpt</h2>
          <div className="rounded-xl border border-border bg-card/60 p-4 md:p-5 space-y-4">
            {previewParagraphs.length === 0 ? (
              <p className="text-muted-foreground">Excerpt is not available.</p>
            ) : (
              previewParagraphs.map((paragraph, index) => (
                <p key={index} className="text-foreground leading-relaxed text-sm">
                  {paragraph}
                </p>
              ))
            )}
          </div>
          {preview.isTruncated ? (
            <p className="text-xs text-muted-foreground">
              Showing {preview.previewWordCount.toLocaleString()} of {preview.totalWordCount.toLocaleString()} words.
            </p>
          ) : null}
        </section>

        {preview.isTruncated ? (
          <section className="rounded-3xl border border-primary/30 bg-primary/10 p-5 md:p-7 space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <Lock size={16} />
              <h2 className="text-base font-bold uppercase tracking-wide">Sign up to read the full judgment</h2>
            </div>
            <p className="text-sm text-foreground">
              Free Al Wakeelo account unlocks the complete judgment text, related case citations,
              AI analysis, drafting tools, and search across 600,000+ Pakistani judgments.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href="/auth?mode=register"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
              >
                Sign up free
              </Link>
              <Link
                href="/auth?mode=login"
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card/70"
              >
                Sign in
              </Link>
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  if (!detail) return null;
  const hasOverruled = detail.citations.received.some((item) => item.citationType === "overruled");

  return (
    <div className="space-y-7 fade-in" data-testid="judgment-detail-page">
      <button
        onClick={() => setLocation("/judgments")}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-card/50"
      >
        <ArrowLeft size={14} /> Back to Judgments
      </button>

      <section className="rounded-3xl border border-border bg-card/75 p-5 md:p-7 space-y-4">
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

        <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
          {detail.title}
        </h1>

        {(detail.petitioner || detail.respondent) ? (
          <p className="text-foreground text-sm">
            <span className="font-semibold">{detail.petitioner || "Petitioner"}</span> VS <span className="font-semibold">{detail.respondent || "Respondent"}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2"><Gavel size={14} /> {detail.court || "Court not available"}</span>
          <span className="inline-flex items-center gap-2"><Calendar size={14} /> {formatDate(detail.decisionDate)}</span>
        </div>
      </section>

      {detail.citations.made.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground inline-flex items-center gap-2"><Link2 size={16} /> Cases Cited ({detail.citations.made.length})</h2>
          <div className="space-y-3">
            {detail.citations.made.map((item) => (
              <CitationCard key={`made-${item.id}`} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {detail.citations.received.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground inline-flex items-center gap-2"><ArrowRight size={16} /> Cited In ({detail.citations.received.length}) cases</h2>

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
          <h2 className="text-lg font-semibold text-foreground">Headnotes</h2>
          <div className="rounded-xl border border-border bg-card/60 p-4 text-foreground whitespace-pre-wrap text-sm leading-relaxed">
            {detail.headnotes}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Full Judgment</h2>
        <div className="rounded-xl border border-border bg-card/60 p-4 md:p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {fullTextParagraphs.length === 0 ? (
            <p className="text-muted-foreground">Full text is not available.</p>
          ) : (
            fullTextParagraphs.map((paragraph, index) => (
              <p key={index} className="text-foreground leading-relaxed text-sm">
                {paragraph}
              </p>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
