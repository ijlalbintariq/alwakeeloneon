import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Gavel,
  Calendar,
  Download,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Copy,
  Check,
  Scale,
  Bot,
  Layers,
  ArrowLeft,
  Share2,
  FileText,
  Sparkles,
  Maximize2,
  Minimize2,
  Type,
  List,
  Printer,
  ChevronDown,
  ChevronUp,
  Link,
  ShieldCheck,
  ShieldAlert,
  FileEdit,
  PenTool,
} from "lucide-react";
import { useLocation } from "wouter";
import { jsPDF } from "jspdf";
import { OverruledAlertBanner, PrecedentCitationItem } from "./OverruledAlertBanner";
import { RatioDecidendiCard, JudgmentSummaryData } from "./RatioDecidendiCard";
import { PrecedentGraph } from "./PrecedentGraph";
import { JudgmentAiSidecar } from "./JudgmentAiSidecar";
import {
  createDraftingInsertPayload,
  dispatchDraftingInsert,
  hydrateCitationGraph,
  JudgmentDetailData,
} from "@/experimental/lib/judgmentApiClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export type { JudgmentDetailData };

interface JudgmentReaderProps {
  judgment: JudgmentDetailData;
  onBack?: () => void;
  onSelectJudgment?: (judgmentId: string) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (judgment: JudgmentDetailData) => void;
}

function formatDate(value: string | null): string {
  if (!value) return "Date not recorded";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Date not recorded";
  return d.toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "2-digit" });
}

function generateCourtPDF(judgment: JudgmentDetailData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 24;

  const addText = (
    text: string,
    fontSize: number,
    style: "normal" | "bold" | "italic" = "normal",
    maxWidth = contentWidth
  ) => {
    doc.setFontSize(fontSize);
    doc.setFont("times", style);
    const paragraphs = text.split(/\r?\n/);
    for (const paragraph of paragraphs) {
      if (paragraph.trim() === "") {
        y += fontSize * 0.45;
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        continue;
      }
      const lines = doc.splitTextToSize(paragraph, maxWidth);
      for (const line of lines) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += fontSize * 0.45;
      }
    }
    y += 2;
  };

  const addLine = () => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setDrawColor(180);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  };

  // Header Banner
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text("AL WAKEELO — PAKISTANI PRECEDENT RESEARCH ENGINE", margin, 14);
  doc.text(
    new Date().toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" }),
    pageWidth - margin - 40,
    14
  );
  doc.setTextColor(0);

  addText(judgment.title, 14, "bold");
  y += 1;
  addText(`Citation: ${judgment.citation}`, 10, "bold");
  addText(`Court: ${judgment.court || "Supreme Court of Pakistan"}`, 10);
  if (judgment.decisionDate) {
    addText(`Decision Date: ${formatDate(judgment.decisionDate)}`, 10);
  }
  if (judgment.petitioner || judgment.respondent) {
    addText(
      `${judgment.petitioner || "Petitioner"} VS ${judgment.respondent || "Respondent"}`,
      10,
      "italic"
    );
  }

  if (judgment.headnotes) {
    y += 2;
    addLine();
    addText("OFFICIAL HEADNOTES & STATUTORY PROPOSITIONS", 11, "bold");
    y += 1;
    addText(judgment.headnotes, 9);
  }

  y += 2;
  addLine();
  addText("FULL JUDGMENT & ORDER OF THE COURT", 11, "bold");
  y += 1;
  addText(judgment.fullText || "Judgment text not available.", 9.5);

  y += 6;
  addLine();
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(
    "Generated from Al Wakeelo Legal Research Workstation — www.alwakeelo.com",
    margin,
    y
  );

  const filename = `${judgment.citation.replace(/[^a-zA-Z0-9]/g, "_")}_Judgment.pdf`;
  doc.save(filename);
}

export const JudgmentReader: React.FC<JudgmentReaderProps> = ({
  judgment,
  onBack,
  onSelectJudgment,
  isBookmarked = false,
  onToggleBookmark,
}) => {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [copiedCitation, setCopiedCitation] = useState<boolean>(false);
  const [copiedParaIdx, setCopiedParaIdx] = useState<number | null>(null);
  const [fontSize, setFontSize] = useState<number>(15); // 13 - 18 pt
  const [readingTheme, setReadingTheme] = useState<"obsidian" | "cream" | "light">("cream");
  const [activeSidePanel, setActiveSidePanel] = useState<"ai" | "toc">("ai");

  // Section Refs for TOC smooth navigation
  const headerRef = useRef<HTMLDivElement>(null);
  const ratioRef = useRef<HTMLDivElement>(null);
  const headnotesRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const fullTextRef = useRef<HTMLDivElement>(null);
  const orderRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToParagraph = (paraId: string) => {
    const el = document.getElementById(paraId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleInsertIntoDrafting = () => {
    const payload = createDraftingInsertPayload(judgment);
    dispatchDraftingInsert(payload);
    toast({
      title: "Inserted into Drafting Studio",
      description: `Affixed precedent "${judgment.citation}" into Legal Drafting Studio.`,
    });
    setLocation("/preview/drafting");
  };

  const overrulingCases = useMemo(() => {
    return (judgment.citations?.received || []).filter(
      (c) =>
        c.citationType?.toLowerCase() === "overruled" ||
        c.citationType?.toLowerCase() === "disapproved"
    );
  }, [judgment.citations?.received]);

  const distinguishedCases = useMemo(() => {
    return (judgment.citations?.received || []).filter(
      (c) =>
        c.citationType?.toLowerCase() === "distinguished" ||
        c.citationType?.toLowerCase() === "explained"
    );
  }, [judgment.citations?.received]);

  const handleCopyCitation = () => {
    navigator.clipboard.writeText(judgment.citation).then(() => {
      setCopiedCitation(true);
      setTimeout(() => setCopiedCitation(false), 2000);
      toast({
        title: "Citation Copied",
        description: `"${judgment.citation}" copied to clipboard.`,
      });
    });
  };

  const handleCopyParagraphCitation = (paraNum: number, paraText: string) => {
    const pinpoint = `${judgment.citation} at [${paraNum}]`;
    const fullSnippet = `"${paraText.trim()}" — ${pinpoint}`;
    navigator.clipboard.writeText(fullSnippet).then(() => {
      setCopiedParaIdx(paraNum);
      setTimeout(() => setCopiedParaIdx(null), 2000);
      toast({
        title: "Pinpoint Paragraph Copied",
        description: `${pinpoint} copied to clipboard.`,
      });
    });
  };

  // Split fullText into paragraphs for permalink rendering
  const paragraphs = useMemo(() => {
    if (!judgment.fullText) return [];
    return judgment.fullText
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }, [judgment.fullText]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Workstation Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-bold border border-[#E2E8F0] dark:border-[#1E2D44] transition-colors shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Library</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 font-mono text-xs text-[#105B38] bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3 py-2 rounded-xl shadow-xs">
            <Gavel className="w-3.5 h-3.5" />
            <span className="font-bold">{judgment.citation}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Font Size Selector */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs text-[#475569]">
            <Type className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mr-1" />
            <button
              type="button"
              onClick={() => setFontSize((s) => Math.max(13, s - 1))}
              className="px-1.5 py-0.5 rounded hover:bg-white dark:bg-[#131E2E] font-mono text-xs font-bold"
              title="Decrease Font Size"
            >
              A-
            </button>
            <span className="text-[11px] font-mono text-[#0F172A] dark:text-[#F8FAFC] px-1 font-bold">{fontSize}pt</span>
            <button
              type="button"
              onClick={() => setFontSize((s) => Math.min(18, s + 1))}
              className="px-1.5 py-0.5 rounded hover:bg-white dark:bg-[#131E2E] font-mono text-xs font-bold"
              title="Increase Font Size"
            >
              A+
            </button>
          </div>

          {/* Reading Canvas Theme */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs">
            <button
              type="button"
              onClick={() => setReadingTheme("obsidian")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors",
                readingTheme === "obsidian"
                  ? "bg-[#0B0F17] text-white shadow-xs"
                  : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
              )}
            >
              Obsidian
            </button>
            <button
              type="button"
              onClick={() => setReadingTheme("cream")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors",
                readingTheme === "cream"
                  ? "bg-[#EFE8D8] text-[#78350F] shadow-xs"
                  : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#78350F]"
              )}
            >
              Parchment
            </button>
            <button
              type="button"
              onClick={() => setReadingTheme("light")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors",
                readingTheme === "light"
                  ? "bg-white dark:bg-[#131E2E] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs"
                  : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
              )}
            >
              Print Clean
            </button>
          </div>

          {/* Copy Citation */}
          <button
            type="button"
            onClick={handleCopyCitation}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-bold border border-[#E2E8F0] dark:border-[#1E2D44] transition-colors shadow-xs"
          >
            {copiedCitation ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]" />
                <span>Copy Citation</span>
              </>
            )}
          </button>

          {/* Insert into Legal Drafting Studio */}
          <button
            type="button"
            onClick={handleInsertIntoDrafting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 text-[#105B38] text-xs font-bold border border-emerald-200 dark:border-emerald-500/20 transition-colors shadow-xs"
            title="Insert Ratio & Precedent into Legal Drafting Studio"
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span>Drafting Studio</span>
          </button>

          {/* Bookmark Precedent */}
          {onToggleBookmark && (
            <button
              type="button"
              onClick={() => onToggleBookmark(judgment)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all shadow-xs",
                isBookmarked
                  ? "bg-[#105B38] text-white border-[#105B38]"
                  : "bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] border-[#E2E8F0] dark:border-[#1E2D44]"
              )}
            >
              {isBookmarked ? (
                <>
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span>Bookmarked</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]" />
                  <span>Bookmark</span>
                </>
              )}
            </button>
          )}

          {/* Download Court PDF */}
          <button
            type="button"
            onClick={() => generateCourtPDF(judgment)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white font-bold text-xs transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Court PDF</span>
          </button>

          {/* Original External PDF */}
          {judgment.pdfUrl && (
            <a
              href={judgment.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] text-xs font-bold border border-[#E2E8F0] dark:border-[#1E2D44] transition-colors shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Gazette</span>
            </a>
          )}
        </div>
      </div>

      {/* Prominent Overruled / Distinguished Alert Banner */}
      <OverruledAlertBanner
        overrulingCases={overrulingCases}
        distinguishedCases={distinguishedCases}
        onSelectJudgment={onSelectJudgment}
      />

      {/* Reader Layout: Left Table of Contents / Main Judgment Body / Right AI Sidecar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Main Full-Text Reader Canvas (Col 8) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Case Header Card */}
          <div
            ref={headerRef}
            className="p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] shadow-xs space-y-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#105B38] bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3 py-1 rounded-lg">
                {judgment.citation}
              </span>
              <span className="text-xs text-[#475569] flex items-center gap-1.5 font-bold">
                <Gavel className="w-3.5 h-3.5 text-[#105B38]" />
                {judgment.court || "Supreme Court of Pakistan"}
              </span>
              <span className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] flex items-center gap-1.5 font-mono">
                <Calendar className="w-3.5 h-3.5 text-[#105B38]" />
                {formatDate(judgment.decisionDate)}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold font-serif text-[#0F172A] dark:text-[#F8FAFC] leading-tight">
              {judgment.title}
            </h1>

            {judgment.bench && (
              <p className="text-xs text-[#475569] font-medium flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-[#105B38]" />
                <span>Honorable Bench: <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{judgment.bench}</strong></span>
              </p>
            )}

            {(judgment.petitioner || judgment.respondent) && (
              <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm font-serif">
                <span className="text-[#334155] dark:text-[#CBD5E1]">
                  <strong className="text-[#0F172A] dark:text-[#F8FAFC]">Petitioner / Appellant:</strong>{" "}
                  {judgment.petitioner || "Appellant / Petitioner"}
                </span>
                <span className="text-[#105B38] font-bold px-2 self-center sm:self-auto">VS</span>
                <span className="text-[#334155] dark:text-[#CBD5E1]">
                  <strong className="text-[#0F172A] dark:text-[#F8FAFC]">Respondent / State:</strong>{" "}
                  {judgment.respondent || "Respondent / State"}
                </span>
              </div>
            )}
          </div>

          {/* AI Ratio Decidendi Card */}
          <div ref={ratioRef}>
            <RatioDecidendiCard
              judgmentId={judgment.id}
              headnotes={judgment.headnotes}
              ratioDecidendi={judgment.ratioDecidendi}
            />
          </div>

          {/* Official Headnotes Section */}
          {judgment.headnotes && (
            <div
              ref={headnotesRef}
              className="p-5 sm:p-6 rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] space-y-3 shadow-xs"
            >
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 border-b border-[#E2E8F0] dark:border-[#1E2D44] pb-2.5">
                <FileText className="w-4 h-4 text-[#105B38]" />
                Official Reported Headnotes
              </h3>
              <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] font-sans leading-relaxed whitespace-pre-wrap">
                {judgment.headnotes}
              </div>
            </div>
          )}

          {/* Precedent Citation Network Graph */}
          <div ref={graphRef}>
            {(() => {
              const edges = hydrateCitationGraph(
                judgment.citation,
                judgment.citations?.made || [],
                judgment.citations?.received || [],
                judgment.fullText
              );
              return (
                <PrecedentGraph
                  currentCitation={judgment.citation}
                  currentTitle={judgment.title}
                  citationsMade={edges.made}
                  citationsReceived={edges.received}
                  onSelectJudgment={onSelectJudgment}
                />
              );
            })()}
          </div>

          {/* Full Text Judgment Canvas (Times New Roman Court Typography) */}
          <div
            ref={fullTextRef}
            className={cn(
              "p-6 sm:p-10 rounded-2xl border transition-all shadow-xs space-y-5",
              readingTheme === "obsidian" && "bg-[#0B0F17] text-[#E2E8F0] border-[#1E293B]",
              readingTheme === "cream" && "bg-[#FBF7EE] text-[#1C1917] border-[#E7DEC8]",
              readingTheme === "light" && "bg-white dark:bg-[#131E2E] text-[#0F172A] dark:text-[#F8FAFC] border-[#E2E8F0] dark:border-[#1E2D44]"
            )}
          >
            {/* Header Stamp */}
            <div
              className={cn(
                "text-center pb-6 border-b space-y-1 font-serif uppercase tracking-widest text-xs sm:text-sm font-bold",
                readingTheme === "obsidian" && "border-[#1E293B] text-[#94A3B8] dark:text-[#475569]",
                readingTheme === "cream" && "border-[#E7DEC8] text-[#78350F]",
                readingTheme === "light" && "border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC]"
              )}
            >
              <div>IN THE {judgment.court?.toUpperCase() || "SUPREME COURT OF PAKISTAN"}</div>
              <div className="text-[11px] font-mono tracking-normal font-normal lowercase">
                {judgment.citation}
              </div>
            </div>

            {/* Formatted Judgment Body with Paragraph Permalinks */}
            <div
              className="space-y-4 leading-relaxed font-serif text-justify px-2 sm:px-4 py-2"
              style={{
                fontFamily: "'Times New Roman', Times, 'Gentium Book Plus', Georgia, serif",
                fontSize: `${fontSize}px`,
                lineHeight: "1.9",
                letterSpacing: "0.015em",
              }}
            >
              {paragraphs.length === 0 ? (
                <p>Full text not available.</p>
              ) : (
                paragraphs.map((para, idx) => {
                  const paraNum = idx + 1;
                  const isCopied = copiedParaIdx === paraNum;
                  return (
                    <div
                      key={`para-${paraNum}`}
                      id={`para-${paraNum}`}
                      className="group relative p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white dark:bg-[#131E2E]/5 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 select-text">{para}</div>
                        <button
                          type="button"
                          onClick={() => handleCopyParagraphCitation(paraNum, para)}
                          className={cn(
                            "opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-xs font-mono font-semibold shrink-0 flex items-center gap-1",
                            readingTheme === "obsidian"
                              ? "bg-[#1E293B] text-[#94A3B8] dark:text-[#475569] hover:text-white"
                              : "bg-[#F1F5F9] dark:bg-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
                          )}
                          title={`Copy Pinpoint Citation [${paraNum}]`}
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-[10px] text-emerald-500">Copied</span>
                            </>
                          ) : (
                            <>
                              <Link className="w-3 h-3" />
                              <span className="text-[10px]">#{paraNum}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Operative Order Stamp Footer */}
            <div
              ref={orderRef}
              className={cn(
                "pt-6 border-t text-center text-xs font-mono font-bold tracking-wider uppercase",
                readingTheme === "obsidian" && "border-[#1E293B] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]",
                readingTheme === "cream" && "border-[#E7DEC8] text-[#92400E]",
                readingTheme === "light" && "border-[#E2E8F0] dark:border-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"
              )}
            >
              *** ORDER OF THE BENCH ACCORDINGLY RECORDED ***
            </div>
          </div>
        </div>

        {/* Right Sticky Sidecar Column (Col 4): Table of Contents + AI Sidecar */}
        <div className="lg:col-span-4 space-y-4">
          {/* Sidecar Tabs Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs shadow-xs">
            <button
              type="button"
              onClick={() => setActiveSidePanel("ai")}
              className={cn(
                "flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all text-xs",
                activeSidePanel === "ai"
                  ? "bg-[#105B38] text-white shadow-xs"
                  : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
              )}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI Precedent Q&A</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSidePanel("toc")}
              className={cn(
                "flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all text-xs",
                activeSidePanel === "toc"
                  ? "bg-[#105B38] text-white shadow-xs"
                  : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
              )}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table of Contents</span>
            </button>
          </div>

          {/* AI Precedent Sidecar Panel */}
          {activeSidePanel === "ai" ? (
            <JudgmentAiSidecar
              judgmentTitle={judgment.title}
              citation={judgment.citation}
              fullText={judgment.fullText}
              headnotes={judgment.headnotes}
            />
          ) : (
            /* Table of Contents Navigation Card */
            <div className="p-5 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] space-y-3.5 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wider border-b border-[#E2E8F0] dark:border-[#1E2D44] pb-2.5">
                <List className="w-4 h-4 text-[#105B38]" />
                Judgment Structure Index
              </div>

              <div className="space-y-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => scrollToSection(headerRef)}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-[#F8FAFC] dark:bg-[#0B131E] text-[#334155] dark:text-[#CBD5E1] hover:text-[#105B38] flex items-center justify-between group transition-colors font-medium"
                >
                  <span>I. Court & Cause Header</span>
                  <span className="text-[10px] font-mono text-[#94A3B8] dark:text-[#475569] group-hover:text-[#105B38]">§ 1</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection(ratioRef)}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-[#F8FAFC] dark:bg-[#0B131E] text-[#334155] dark:text-[#CBD5E1] hover:text-[#105B38] flex items-center justify-between group transition-colors font-medium"
                >
                  <span>II. AI Ratio Decidendi</span>
                  <span className="text-[10px] font-mono font-bold text-[#105B38] bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-500/20">AI</span>
                </button>
                {judgment.headnotes && (
                  <button
                    type="button"
                    onClick={() => scrollToSection(headnotesRef)}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-[#F8FAFC] dark:bg-[#0B131E] text-[#334155] dark:text-[#CBD5E1] hover:text-[#105B38] flex items-center justify-between group transition-colors font-medium"
                  >
                    <span>III. Reported Headnotes</span>
                    <span className="text-[10px] font-mono text-[#94A3B8] dark:text-[#475569] group-hover:text-[#105B38]">§ 2</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => scrollToSection(graphRef)}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-[#F8FAFC] dark:bg-[#0B131E] text-[#334155] dark:text-[#CBD5E1] hover:text-[#105B38] flex items-center justify-between group transition-colors font-medium"
                >
                  <span>IV. Precedent Network Graph</span>
                  <span className="text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Nodes</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection(fullTextRef)}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-[#F8FAFC] dark:bg-[#0B131E] text-[#334155] dark:text-[#CBD5E1] hover:text-[#105B38] flex items-center justify-between group transition-colors font-medium"
                >
                  <span>V. Full Judgment Opinion</span>
                  <span className="text-[10px] font-mono text-[#94A3B8] dark:text-[#475569] group-hover:text-[#105B38]">Court</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection(orderRef)}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-[#F8FAFC] dark:bg-[#0B131E] text-[#334155] dark:text-[#CBD5E1] hover:text-[#105B38] flex items-center justify-between group transition-colors font-medium"
                >
                  <span>VI. Operative Order & Relief</span>
                  <span className="text-[10px] font-mono text-[#94A3B8] dark:text-[#475569] group-hover:text-[#105B38]">Order</span>
                </button>
              </div>

              {/* Paragraph Permalinks Quick Jumps */}
              {paragraphs.length > 1 && (
                <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E2D44] space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] font-bold block">
                    Jump to Paragraph:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {paragraphs.map((_, idx) => (
                      <button
                        type="button"
                        key={`jump-para-${idx + 1}`}
                        onClick={() => scrollToParagraph(`para-${idx + 1}`)}
                        className="px-2 py-1 rounded-md bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-emerald-50 dark:bg-emerald-500/10 hover:text-[#105B38] border border-[#E2E8F0] dark:border-[#1E2D44] text-[10px] font-mono font-semibold text-[#475569] transition-colors"
                      >
                        [{idx + 1}]
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Precedent Factsheet Summary */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs space-y-2.5 shadow-xs">
            <h4 className="font-mono font-bold text-[11px] text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-[#105B38]" />
              Precedent Authority Factsheet
            </h4>
            <div className="space-y-2 text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
              <div className="flex justify-between py-1 border-b border-[#E2E8F0] dark:border-[#1E2D44]">
                <span>Binding Under:</span>
                <span className="text-[#0F172A] dark:text-[#F8FAFC] font-mono font-bold">Article 189 / 201</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E2E8F0] dark:border-[#1E2D44]">
                <span>Outbound Citations:</span>
                <span className="text-[#0F172A] dark:text-[#F8FAFC] font-mono font-bold">
                  {judgment.citations?.made?.length || 0} Authorities
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E2E8F0] dark:border-[#1E2D44]">
                <span>Inbound Citing Cases:</span>
                <span className="text-[#0F172A] dark:text-[#F8FAFC] font-mono font-bold">
                  {judgment.citations?.received?.length || 0} Subsequent Cases
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span>Precedent Status:</span>
                <span
                  className={cn(
                    "font-mono font-bold px-2 py-0.5 rounded-md text-[10px] uppercase",
                    overrulingCases.length > 0
                      ? "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20"
                      : distinguishedCases.length > 0
                      ? "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20"
                      : "bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20"
                  )}
                >
                  {overrulingCases.length > 0
                    ? "Overruled"
                    : distinguishedCases.length > 0
                    ? "Distinguished"
                    : "Good Law"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
