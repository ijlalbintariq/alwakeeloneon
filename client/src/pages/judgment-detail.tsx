import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useRoute } from "wouter";
import { AlertTriangle, ArrowLeft, ArrowRight, Calendar, ChevronDown, Download, ExternalLink, Gavel, Link2, Loader2, Lock, MessageSquare, Send } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentHead } from "@/hooks/use-document-head";
import { apiRequest } from "@/lib/queryClient";
import { LegalMarkdown } from "@/components/legal-markdown";
import { FormattedJudgmentText } from "@/components/formatted-judgment-text";
import jsPDF from "jspdf";

type AiMessage = {
  role: "user" | "assistant";
  content: string;
};

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
  citations?: {
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

function generateDetailPDF(detail: JudgmentDetailPayload) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 22;

  const addText = (text: string, fontSize: number, style: "normal" | "bold" | "italic" = "normal", maxWidth = contentWidth) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", style);
    const paragraphs = text.split(/\r?\n/);
    for (const paragraph of paragraphs) {
      if (paragraph.trim() === "") {
        y += fontSize * 0.45;
        if (y > 272) {
          doc.addPage();
          y = 18;
        }
        continue;
      }
      const lines = doc.splitTextToSize(paragraph, maxWidth);
      for (const line of lines) {
        if (y > 272) {
          doc.addPage();
          y = 18;
        }
        doc.text(line, margin, y);
        y += fontSize * 0.45;
      }
    }
    y += 2;
  };

  const addLine = () => {
    if (y > 272) { doc.addPage(); y = 18; }
    doc.setDrawColor(180);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
  };

  // Header
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("Al Wakeelo — Pakistan's AI Legal Assistant", margin, 14);
  doc.text(new Date().toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" }), pageWidth - margin - 50, 14);
  doc.setTextColor(0);

  addText(detail.title, 15, "bold");
  y += 1;
  addText(`Citation: ${detail.citation}`, 10, "bold");
  addText(`Court: ${detail.court || "N/A"}`, 10);
  if (detail.decisionDate) {
    addText(`Decision Date: ${formatDate(detail.decisionDate)}`, 10);
  }
  if (detail.petitioner || detail.respondent) {
    addText(`${detail.petitioner || "Petitioner"} VS ${detail.respondent || "Respondent"}`, 10, "italic");
  }

  if (detail.headnotes) {
    y += 2;
    addLine();
    addText("HEADNOTES", 11, "bold");
    y += 1;
    addText(detail.headnotes, 9);
  }

  y += 2;
  addLine();
  addText("FULL JUDGMENT TEXT", 11, "bold");
  y += 1;
  addText(detail.fullText || "Full text not available.", 9);

  y += 5;
  addLine();
  doc.setFontSize(7);
  doc.setTextColor(130);
  doc.text("Generated by Al Wakeelo — www.alwakeelo.com", margin, y);

  const filename = `${detail.citation.replace(/[^a-zA-Z0-9]/g, "_")}_judgment.pdf`;
  doc.save(filename);
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

  // Chat State
  const [chatMessages, setChatMessages] = useState<AiMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isChatMinimized, setIsChatMinimized] = useState(() => {
    try {
      return window.innerWidth < 1280;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  async function handleChatSend(overrideText?: string) {
    const text = overrideText || chatInput;
    if (!text.trim() || !detail || isChatLoading) return;
    const userMsg = text.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsChatLoading(true);

    try {
      const res = await apiRequest("POST", "/api/ai/document-chat", {
        documentType: "judgment",
        documentTitle: `${detail.title} (${detail.citation})`,
        documentContent: detail.fullText.slice(0, 15000), // send up to 15k chars for context
        messages: [
          ...chatMessages.map(m => ({ role: m.role, content: m.content })),
          { role: "user", content: userMsg },
        ],
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: "assistant", content: data.content || "I couldn't generate a response." }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Failed to get a response. Please try again." }]);
    }
    setIsChatLoading(false);
  }

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
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              setLocation("/judgments");
            }
          }}
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
    const hasOverruled = preview.citations?.received?.some((item) => item.citationType === "overruled") || false;

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
          <div className="rounded-xl border border-border bg-card/60 p-4 md:p-5">
            <FormattedJudgmentText text={preview.previewText} />
          </div>
          {preview.isTruncated ? (
            <p className="text-xs text-muted-foreground">
              Showing {preview.previewWordCount.toLocaleString()} of {preview.totalWordCount.toLocaleString()} words.
            </p>
          ) : null}
        </section>

        {preview.citations?.made && preview.citations.made.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground inline-flex items-center gap-2"><Link2 size={16} /> Cases Cited ({preview.citations.made.length})</h2>
            <div className="space-y-3">
              {preview.citations.made.map((item) => (
                <CitationCard key={`made-${item.id}`} item={item} />
              ))}
            </div>
          </section>
        ) : null}

        {preview.citations?.received && preview.citations.received.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground inline-flex items-center gap-2"><ArrowRight size={16} /> Cited In ({preview.citations.received.length}) cases</h2>

            {hasOverruled ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 inline-flex items-center gap-2">
                <AlertTriangle size={15} /> This judgment has overruled treatment in citing cases.
              </div>
            ) : null}

            <div className="space-y-3">
              {preview.citations.received.map((item) => (
                <CitationCard key={`received-${item.id}`} item={item} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-border bg-card/60 p-5 md:p-7 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Search Related Judgments</h2>
          <p className="text-xs text-muted-foreground">
            Search our index of 600,000+ judgments by citation, party names, or keyword.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const q = formData.get("q") as string;
              if (q?.trim()) {
                setLocation(`/auth?mode=register&next=${encodeURIComponent(`/judgments?q=${encodeURIComponent(q.trim())}`)}`);
              }
            }}
            className="flex gap-2"
          >
            <input
              name="q"
              className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
              placeholder="Search other judgments..."
              required
            />
            <button
              type="submit"
              className="bg-primary text-primary-foreground rounded-xl h-[42px] px-4 flex items-center justify-center font-bold text-sm hover:bg-primary/90 transition-colors"
            >
              Search
            </button>
          </form>
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
    <div className="flex flex-col xl:flex-row gap-7 fade-in" data-testid="judgment-detail-page">
      <div className="flex-1 space-y-7 min-w-0 pb-24 xl:pb-0">
        <button
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              setLocation("/judgments");
            }
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-card/50"
        >
          <ArrowLeft size={14} /> Back to Judgments
        </button>

      <section className="rounded-3xl border border-border bg-card/75 p-5 md:p-7 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-blue-500/15 border border-blue-500/30 px-3 py-1.5 font-mono text-blue-200">
            {detail.citation}
          </span>
          <button
            onClick={() => generateDetailPDF(detail)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 px-3 py-1.5 text-xs font-bold text-blue-300 hover:bg-blue-500/20 transition-all"
            title="Download as PDF"
          >
            <Download size={13} /> Download PDF
          </button>
          {detail.pdfUrl ? (
            <a
              href={detail.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-300"
            >
              <ExternalLink size={13} /> Original PDF
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
        <div className="rounded-xl border border-border bg-card/60 p-4 md:p-5 max-h-[60vh] overflow-y-auto">
          <FormattedJudgmentText text={detail.fullText} />
        </div>
      </section>
    </div>
      {/* Mobile: Floating AI Button (minimized) — rendered via portal */}
      {isChatMinimized && window.innerWidth < 1280 && createPortal(
        <button
          className="xl:hidden fixed bottom-6 right-4 z-[9999] flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 text-xs font-bold uppercase tracking-wider hover:bg-primary/90 active:scale-95 transition-all"
          onClick={() => setIsChatMinimized(false)}
        >
          <MessageSquare size={16} />
          Ask AI
        </button>,
        document.body
      )}

      {/* Mobile: Full Chat Panel (expanded) — rendered via portal */}
      {!isChatMinimized && window.innerWidth < 1280 && createPortal(
        <div className="xl:hidden fixed bottom-0 left-0 right-0 z-[9999] h-[55vh] bg-background border-t border-border shadow-[0_-8px_30px_rgb(0,0,0,0.15)] flex flex-col rounded-t-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">Ask about this judgment</span>
            </div>
            <button
              className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground text-[10px] font-bold uppercase tracking-wider hover:bg-accent hover:text-foreground active:scale-95 transition-all"
              onClick={() => setIsChatMinimized(true)}
            >
              <ChevronDown size={13} />
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center py-8">
                <Gavel size={28} className="text-foreground/20 mx-auto mb-3" />
                <div className="space-y-2">
                  {[
                    "Summarize this judgment",
                    "What is the ratio decidendi?",
                    "What are the main legal issues?",
                    "List the cited precedents"
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => handleChatSend(suggestion)}
                      disabled={isChatLoading}
                      className="w-full text-left px-4 py-2.5 bg-background border border-border rounded-xl text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-background text-foreground border border-border shadow-sm"}`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-invert prose-sm max-w-none"><LegalMarkdown content={msg.content} /></div>
                  ) : (
                    <div className="whitespace-pre-wrap text-[13px]">{msg.content}</div>
                  )}
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-background border border-border shadow-sm rounded-2xl px-4 py-3">
                  <Loader2 size={16} className="animate-spin text-primary" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 border-t border-border">
            <div className="flex gap-2">
              <input
                className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                placeholder="Ask about this judgment..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSend()}
              />
              <button
                onClick={() => handleChatSend()}
                disabled={!chatInput.trim() || isChatLoading}
                className="bg-primary text-primary-foreground rounded-xl h-[42px] w-[42px] flex items-center justify-center disabled:opacity-50 transition-opacity"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Desktop: Sidebar Chat */}
      <div className="hidden xl:flex xl:flex-col w-full xl:w-[380px] xl:min-w-[340px] flex-shrink-0">
        <div className="xl:sticky xl:top-6 xl:h-[calc(100vh-120px)] flex flex-col border-l border-border">
          <div className="p-4 border-b border-border bg-background/50">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-primary" />
              <span className="text-xs font-black uppercase tracking-[0.2em] text-foreground">
                Talk with AI about this Judgment
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ask for summaries, ratio decidendi, cited precedents, or key legal issues.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.length === 0 && (
              <div className="text-center py-8">
                <Gavel size={32} className="text-foreground/30 mx-auto mb-3" />
                <div className="space-y-2">
                  {[
                    "Summarize this judgment",
                    "What is the ratio decidendi?",
                    "What are the main legal issues?",
                    "List the cited precedents"
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => handleChatSend(suggestion)}
                      disabled={isChatLoading}
                      className="w-full text-left px-4 py-2.5 bg-background border border-border rounded-xl text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-foreground border border-border shadow-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <LegalMarkdown content={msg.content} />
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-[13px]">{msg.content}</div>
                  )}
                </div>
              </div>
            ))}

            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-background border border-border shadow-sm rounded-2xl px-4 py-3">
                  <Loader2 size={16} className="animate-spin text-primary" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 border-t border-border bg-background/50">
            <div className="flex gap-2">
              <input
                className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                placeholder="Ask about this judgment..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSend()}
              />
              <button
                onClick={() => handleChatSend()}
                disabled={!chatInput.trim() || isChatLoading}
                className="bg-primary text-primary-foreground rounded-xl h-[42px] w-[42px] flex items-center justify-center disabled:opacity-50 transition-opacity"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
