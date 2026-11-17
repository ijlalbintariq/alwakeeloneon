import type { PublicJudgmentData } from "@shared/public-judgment-data";
import { readPublicJudgmentBootstrap } from "@/lib/public-judgment-bootstrap";
import { publicJudgmentSeo, JudgmentCitationSummary } from "@shared/judgment-public-seo";
import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useParams } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Scale, ChevronRight, FileText, Share2, Printer, Download, Sparkles, Building2, Calendar, User, Gavel } from 'lucide-react';
import { useDocumentHead } from '@/hooks/use-document-head';
import { renderTextWithCitationLinks, buildJudgmentCitationMap } from '@/components/formatted-judgment-text';

interface ParsedHeadnotePoint {
  label: string;
  catchwords: string[];
  holding: string;
}

function parsePakistaniHeadnotes(raw: string | null | undefined): ParsedHeadnotePoint[] | null {
  if (!raw || typeof raw !== "string" || !raw.trim()) return null;

  // 1. Clean OCR page markers (e.g. --- \n\n ## Page 5)
  let clean = raw.replace(/---\s*\r?\n+##\s*Page\s*\d+\s*\r?\n*/gi, "\n\n");
  clean = clean.replace(/---\s*\r?\n+/g, "\n\n");
  clean = clean.trim();

  // 2. Split into points by (a), (b), (c) or Roman numerals, numbers, or double newlines
  const pointRegex = /(?:^|\n\s*)(?=\([a-z0-9]+\)|\b[A-Z]\b\.\s*)/g;
  let rawBlocks = clean.split(pointRegex).map((b) => b.trim()).filter(Boolean);

  if (rawBlocks.length <= 1) {
    const paragraphs = clean.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
    if (paragraphs.length > 1 && paragraphs.some((p) => p.includes("---") || p.includes("--"))) {
      rawBlocks = paragraphs;
    }
  }

  const parsedPoints = rawBlocks.map((block, idx) => {
    const labelMatch = block.match(/^(\([a-z0-9]+\)|\b[A-Z]\b\.)\s*/i);
    const label = labelMatch ? labelMatch[1] : (rawBlocks.length > 1 ? `(${String.fromCharCode(97 + (idx % 26))})` : "Point");
    const content = labelMatch ? block.slice(labelMatch[0].length).trim() : block;

    if (content.includes("---") || content.includes("--")) {
      const parts = content.split(/\s*(?:---+|--)\s*/).map((p) => p.trim()).filter(Boolean);
      const catchwords: string[] = [];
      let holding = "";

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isHolding = /(?:held|holding|principle|question|held that|held:|view that)/i.test(part) || (i > 1 && part.length > 80 && part.includes("."));
        if (isHolding || holding) {
          holding = holding ? (/[.!?:]\s*$/.test(holding) ? `${holding} ${part}` : `${holding} — ${part}`) : part;
        } else {
          catchwords.push(part);
        }
      }

      if (!holding && catchwords.length > 0) {
        holding = catchwords.pop() || "";
      }

      return {
        label,
        catchwords,
        holding: holding.trim(),
      };
    } else {
      const heldMatch = content.match(/^(.*?)\b(held(?:\s*that|:|-)?|was pleased to hold:?|is held:?)\s*(.*)$/is);
      if (heldMatch) {
        return {
          label,
          catchwords: heldMatch[1].trim() ? [heldMatch[1].trim().replace(/[:—-]+$/, "")] : [],
          holding: (heldMatch[2] + " " + heldMatch[3]).trim(),
        };
      }
      return {
        label,
        catchwords: [],
        holding: content,
      };
    }
  });

  return parsedPoints.length > 0 ? parsedPoints : null;
}

interface PreviewPublicJudgmentProps {
  id?: string;
  params?: { id?: string };
}

export default function PreviewPublicJudgment(props?: PreviewPublicJudgmentProps) {
  // Mounted on /judgment/:id, /preview/p/:id and /preview/public/judgments/:id
  const params = useParams<{ id: string }>();
  const targetId = props?.id || props?.params?.id || params?.id;
  const [data, setData] = useState<PublicJudgmentData | null>(() => readPublicJudgmentBootstrap(targetId));
  const [loading, setLoading] = useState(() => !data);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const controller = new AbortController();
    // Keep the initial, server-verified record while refreshing supplementary data.
    const initialRecord = data?.id === targetId ? data : null;
    setData(initialRecord);
    setError(null);
    setLoading(Boolean(targetId) && !initialRecord);
    if (!targetId) return;

    const fetchJudgment = async () => {
      try {
        const res = await fetch(`/api/public/judgments/${encodeURIComponent(targetId)}`, { signal: controller.signal });
        if (!res.ok) {
          if (res.status === 404 || res.status === 410) {
            if (!controller.signal.aborted) setData(null);
            throw new Error("Judgment not found");
          }
          if (res.status === 429) throw new Error("Too many requests. Please try again later.");
          throw new Error("Failed to load judgment");
        }
        const json = await res.json();
        if (!controller.signal.aborted) setData(json);
      } catch (err: any) {
        if (controller.signal.aborted) return;
        console.error("Public judgment fetch error:", err);
        if (!initialRecord || err.message === "Judgment not found") setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchJudgment();
    return () => controller.abort();
  }, [targetId]);

  const seo = publicJudgmentSeo(data || { id: targetId || "" });
  useDocumentHead({
    title: loading ? "Loading judgment | Al Wakeelo" : seo.title,
    description: seo.description,
    path: data?.id ? `/judgment/${data.id}` : targetId ? `/judgment/${targetId}` : undefined,
    index: data?.textIntegrity === "own",
  });

  const parsedHeadnotes = useMemo(() => {
    return parsePakistaniHeadnotes(data?.headnotes);
  }, [data?.headnotes]);

  const schemaGraph = seo.schema;
  useEffect(() => {
    // React owns the current record after mount, including noindex/loading states.
    document.getElementById("server-judgment-jsonld")?.remove();
  }, []);

  useEffect(() => {
    if (!data && !error && readPublicJudgmentBootstrap(targetId)) return;
    document.getElementById("seo-prerender")?.remove();
  }, [data, error, targetId]);

  const formattedParagraphs = useMemo(() => {
    if (!data?.previewText) return [];
    let t = data.previewText.replace(/\r\n/g, "\n");
    t = t.replace(/\n\n+/g, "\n__PARAGRAPH__\n");
    
    const lines = t.split("\n");
    let result = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === "__PARAGRAPH__") {
        result += "\n\n";
        continue;
      }
      result += line;
      
      const nextLine = lines[i+1] || "";
      const isNextLineNewParagraph = /^\s*(\d+\.|[A-Z]\.|[ivx]+\.)\s/.test(nextLine) || /^\s*(JUDGMENT|ORDER|BACKGROUND|FACTS|HELD|DECISION|COURT|CASE DETAILS)\b/.test(nextLine) || nextLine === "__PARAGRAPH__";
      
      const isNextLineHeader = /^(Date of hearing|Appellant|Complainant|State|Respondent|Petitioner)/i.test(nextLine);
      const isCurrentLineHeader = /^(Date of hearing|Appellant|Complainant|State|Respondent|Petitioner|Criminal Appeal|Murder Reference|Civil Appeal|Writ Petition)/i.test(line.trim());

      if (line.trim().length > 33 && !isNextLineNewParagraph && !isNextLineHeader && !isCurrentLineHeader) {
        result += " ";
      } else {
        result += "\n";
      }
    }
    return result.split("\n").map(p => p.trim()).filter(Boolean);
  }, [data?.previewText]);

  const citationMap = useMemo(() => buildJudgmentCitationMap(data?.citations), [data?.citations]);

  const handleSignup = () => {
    setLocation('/preview/register?mode=register');
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B131E] flex flex-col font-sans">
        <header className="bg-white dark:bg-[#131E2E] border-b border-slate-200 dark:border-slate-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center cursor-pointer" onClick={() => setLocation("/preview")}>
            <img src="/logo.svg" alt="Al Wakeelo" className="w-8 h-8 object-contain mr-3" />
            <span className="font-bold font-serif text-xl text-slate-900 tracking-tight">AL WAKEELO</span>
          </div>
          <Button onClick={() => setLocation("/preview/login")} variant="outline" className="border-slate-300 dark:border-slate-500/30 text-slate-700 dark:text-slate-400">
            Sign In
          </Button>
        </div>
      </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Record Not Found</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">{error}</p>
            <Button onClick={() => setLocation('/preview')} className="bg-[#105B38] hover:bg-[#0D4B2E]">
              Return to Homepage
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B131E] flex flex-col font-sans selection:bg-[#105B38]/20">
      <header className="bg-white dark:bg-[#131E2E] border-b border-slate-200 dark:border-slate-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center cursor-pointer" onClick={() => setLocation("/preview")}>
            <div className="w-8 h-8 rounded-lg bg-[#105B38] flex items-center justify-center mr-3">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold font-serif text-xl text-slate-900 tracking-tight">AL WAKEELO</span>
          </div>
          <Button onClick={() => setLocation("/preview/login")} variant="outline" className="border-slate-300 dark:border-slate-500/30 text-slate-700 dark:text-slate-400">
            Sign In
          </Button>
        </div>
      </header>
      
      {/* Search Header Bar (SEO pattern) */}
      <div className="bg-white dark:bg-[#131E2E] border-b border-slate-200 dark:border-slate-500/20 py-3 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center text-xs text-slate-500 font-medium">
            <span className="hover:text-[#105B38] cursor-pointer" onClick={() => setLocation('/preview')}>Library</span>
            <ChevronRight className="w-3 h-3 mx-1" />
            <span>Pakistan</span>
            <ChevronRight className="w-3 h-3 mx-1" />
            {loading ? <Skeleton className="w-20 h-4" /> : <span>{data?.court || 'Appellate Courts'}</span>}
            <ChevronRight className="w-3 h-3 mx-1" />
            {loading ? <Skeleton className="w-16 h-4" /> : <span className="text-slate-900">{data?.citation}</span>}
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          
          {/* Document Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Badge className="bg-[#105B38]/10 text-[#105B38] hover:bg-[#105B38]/20 border-0 rounded-md font-mono">
                {loading ? <Skeleton className="w-24 h-4 bg-[#105B38]/20" /> : data?.citation}
              </Badge>
              <Badge variant="outline" className="text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-500/20">
                Public Record
              </Badge>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold font-serif text-slate-900 mb-6 leading-tight">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="w-full h-10" />
                  <Skeleton className="w-3/4 h-10" />
                </div>
              ) : (
                data?.title
              )}
            </h1>

            {data && <JudgmentCitationSummary record={data} />}
            {data?.isTruncated && (
              <p className="mb-4 text-sm text-slate-600">
                Showing an initial text preview. The full record loads automatically when available. If it does not load, reload this page or use the PDF link below.
              </p>
            )}

            <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600 dark:text-slate-400 border-t border-b border-slate-200 dark:border-slate-500/20 py-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                {loading ? <Skeleton className="w-32 h-4" /> : <span className="font-medium">{data?.court}</span>}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                {loading ? <Skeleton className="w-24 h-4" /> : <span>{data?.decisionDate ? new Date(data.decisionDate).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Date not recorded'}</span>}
              </div>
              <div className="flex items-center gap-2">
                <Gavel className="w-4 h-4 text-slate-400" />
                {loading ? (
                  <Skeleton className="w-36 h-4" />
                ) : (
                  <span className="flex items-center gap-1.5">
                    <strong className="font-medium text-slate-700 dark:text-slate-300">Bench:</strong>
                    <span className="text-slate-900 dark:text-slate-100">{data?.bench || "Bench not specified"}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-500 hover:text-[#105B38]" onClick={() => {
                  const url = window.location.href;
                  const title = data?.citation ? `${data.citation} - ${data.title}` : document.title;
                  if (navigator.share) {
                    navigator.share({ title, url }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(url).then(() => {
                      toast({ title: "Link copied", description: "Judgment URL copied to clipboard" });
                    });
                  }
                }}>
                  <Share2 className="w-4 h-4 mr-1.5" /> Share
                </Button>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-500 hover:text-[#105B38]" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-1.5" /> Print
                </Button>
                {data?.id && (data.pdfUrl || data.textIntegrity === "own") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-slate-500 hover:text-[#105B38]"
                    onClick={() => {
                      window.open(data.pdfUrl || `/api/public/judgments/${encodeURIComponent(data.id)}/pdf`, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    <Download className="w-4 h-4 mr-1.5" /> {data.pdfUrl ? "Original PDF" : "Download text as PDF"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Judgment Body */}
          <Card className="bg-white dark:bg-[#131E2E] shadow-sm border-slate-200 dark:border-slate-500/20 rounded-xl overflow-hidden relative">
            <CardContent className="p-8 md:p-12">
              
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="w-full h-4" />
                  <Skeleton className="w-full h-4" />
                  <Skeleton className="w-5/6 h-4" />
                  <Skeleton className="w-full h-4 mt-8" />
                  <Skeleton className="w-4/5 h-4" />
                </div>
              ) : (
                <>
                  {/* Presiding Bench / Coram Card */}
                  {data?.bench && (
                    <div className="mb-6 p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-800/30 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#105B38]/10 flex items-center justify-center shrink-0 mt-0.5 text-[#105B38]">
                        <Gavel className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-[#105B38] uppercase tracking-wider mb-1 flex items-center gap-1">
                          <User className="w-3 h-3" /> Presiding Bench / Coram
                        </div>
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                          {data.bench}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Parties */}
                  {(data?.petitioner || data?.respondent) && (
                    <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-500/20 text-center font-serif text-lg">
                      <div className="font-semibold text-slate-900">{data?.petitioner || 'UNKNOWN PETITIONER'}</div>
                      <div className="my-3 text-sm text-slate-400 italic font-sans">— VERSUS —</div>
                      <div className="font-semibold text-slate-900">{data?.respondent || 'UNKNOWN RESPONDENT'}</div>
                    </div>
                  )}

                  {/* Enhanced Headnotes Section */}
                  {parsedHeadnotes && parsedHeadnotes.length > 0 ? (
                    <div className="mb-8">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#105B38]" /> Reported Headnotes &amp; Statutory Catchwords
                      </h4>
                      <div className="space-y-4">
                        {parsedHeadnotes.map((pt, pIdx) => (
                          <div
                            key={pIdx}
                            className="p-5 bg-[#FBFBFA] dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 border-l-4 border-l-[#105B38] shadow-sm transition-all"
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#105B38]/10 text-[#105B38] dark:bg-[#105B38]/20">
                                {pt.label}
                              </span>
                              <span className="text-xs text-slate-400 font-medium">Headnote Point</span>
                            </div>

                            {/* Catchwords / Statutory references */}
                            {pt.catchwords.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-3.5">
                                {pt.catchwords.map((cw, cwIdx) => {
                                  const isStatute = /(?:Act|Ordinance|Code|Constitution|Section|Order|Rule|\bSs?\b\.|\bArt\b\.)/i.test(cw);
                                  return (
                                    <span
                                      key={cwIdx}
                                      className={`inline-flex items-center text-xs px-2.5 py-1 rounded-md font-medium leading-normal ${
                                        isStatute
                                          ? "bg-emerald-100/70 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/40"
                                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                      }`}
                                    >
                                      {cw}
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {/* Holding / Point text */}
                            <div className="text-slate-800 dark:text-slate-200 leading-relaxed text-sm font-sans">
                              {pt.holding}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Graceful fallback when headnotes are null or not reported */
                    <div className="mb-8 p-5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-sm">
                      <div className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                            Official Editorial Headnotes Not Reported
                          </h4>
                          <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                            This judgment record does not contain official law report editorial catchwords. You can read the verbatim judgment text below or unlock AI case analysis for instant ratio decidendi extraction.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* The text stored under this citation belongs to another case;
                      the server withholds it and names the real owner. */}
                  {data?.textIntegrity === "mislabeled" && (
                    <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                      <p className="font-semibold mb-1">Judgment text unavailable for {data.citation}</p>
                      <p>
                        The text in our database under this citation belongs to a different judgment
                        {data.textBelongsTo?.citation ? <> (<strong>{data.textBelongsTo.citation}</strong>)</> : null}, so it is not shown here.
                      </p>
                      {data.textBelongsTo?.id && (
                        <Button
                          onClick={() => setLocation(`/judgment/${data.textBelongsTo!.id}`)}
                          className="mt-3 bg-[#105B38] hover:bg-[#0D4B2E] text-white"
                          size="sm"
                        >
                          Read {data.textBelongsTo.citation || "that judgment"}
                        </Button>
                      )}
                    </div>
                  )}
                  {data?.textWarning && data.textIntegrity !== "mislabeled" && (
                    <div role="alert" className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
                      {data.textWarning || "Judgment text unavailable because its identity could not be confirmed."}
                    </div>
                  )}
                  {!data?.previewText && data?.pdfUrl && (
                    <div className="mb-8 space-y-3">
                      <a className="text-emerald-800 underline" href={data.pdfUrl} target="_blank" rel="noopener noreferrer">Open original PDF</a>
                      <iframe title="Judgment PDF" src={data.pdfUrl} className="h-[75vh] w-full rounded-lg border" sandbox="allow-scripts allow-downloads" referrerPolicy="no-referrer" />
                    </div>
                  )}

                  {/* Body Text */}
                  <div className="prose prose-slate max-w-none font-serif text-lg leading-loose text-slate-800 dark:text-slate-400">
                    {formattedParagraphs.map((p, idx) => (
                      <p key={idx} className="mb-6">{renderTextWithCitationLinks(p, citationMap)}</p>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-[320px] shrink-0 space-y-6">
          <Card className="border shadow-lg overflow-hidden relative" style={{ backgroundColor: "#f0fdf4", borderColor: "#105B38", color: "#111827" }}>
            <div className="absolute top-0 right-0 p-4" style={{ opacity: 0.06 }}>
              <Sparkles className="w-24 h-24" />
            </div>
            <CardContent className="p-6 relative z-10">
              <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-md mb-4" style={{ backgroundColor: "#105B38", color: "#ffffff" }}>AL WAKEELO AI</span>
              <h3 className="text-xl font-bold font-serif mb-2" style={{ color: "#111827" }}>Analyze this Case</h3>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: "#374151" }}>
                Unlock our Style-Memory AI to extract the Ratio Decidendi, identify precedents, or draft an appeal instantly based on this judgment.
              </p>
              <Button onClick={handleSignup} className="w-full font-bold" style={{ backgroundColor: "#105B38", color: "#ffffff" }}>
                Unlock AI Features
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 dark:border-slate-500/20 shadow-sm bg-white dark:bg-[#131E2E]">
            <CardContent className="p-5">
              <h4 className="font-semibold text-slate-900 mb-4 flex items-center">
                <FileText className="w-4 h-4 mr-2 text-slate-400" />
                Case Meta
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-500/20">
                  <span className="text-slate-500">Citation</span>
                  <span className="font-medium text-slate-900">{loading ? <Skeleton className="w-16 h-4" /> : data?.citation}</span>
                </div>
                {data?.bench && (
                  <div className="flex justify-between items-start py-2 border-b border-slate-100 dark:border-slate-500/20">
                    <span className="text-slate-500 shrink-0 mr-2">Bench</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100 text-right text-xs leading-relaxed">{data.bench}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-500/20">
                  <span className="text-slate-500">Word Count</span>
                  <span className="font-medium text-slate-900">{loading ? <Skeleton className="w-12 h-4" /> : data?.totalWordCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-500/20">
                  <span className="text-slate-500">Citations Made</span>
                  <span className="font-medium text-slate-900">{loading ? <Skeleton className="w-8 h-4" /> : (data?.citations?.made?.length || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500">Cited By</span>
                  <span className="font-medium text-slate-900">{loading ? <Skeleton className="w-8 h-4" /> : (data?.citations?.received?.length || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Shared public judgment structured data */}
      {schemaGraph && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaGraph).replace(/</g, "\\u003c") }}
        />
      )}
    </div>
  );
}
