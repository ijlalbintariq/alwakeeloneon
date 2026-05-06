import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Download,
  Eye,
  FileSearch,
  FileText,
  FolderOpen,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Doc = {
  id: number;
  title: string;
  content?: string;
  createdAt: string;
};

type Category = "all" | "contracts" | "notices" | "evidence" | "other";

type AnalysisRisk = {
  id: string;
  title: string;
  detail: string;
  severity: "danger" | "warning";
};

type AnalysisResult = {
  confidence: number;
  summary: string[];
  risks: AnalysisRisk[];
};

const ACTIVE_CONTEXT_KEY = "case-docs-active-context-v1";
const LEGAL_DRAFT_AUTOSAVE_KEY = "legal-drafting-workspace-v2";
const MAX_CONTEXT_CHARS = 24000;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function inferCategory(doc: Doc): Category {
  const text = `${doc.title} ${doc.content || ""}`.toLowerCase();
  if (/(agreement|contract|lease|deed|nda|employment|sale|purchase)/i.test(text)) return "contracts";
  if (/(notice|summons|legal notice|declaration|intimation)/i.test(text)) return "notices";
  if (/(evidence|photo|image|recording|statement|forensic|proof|exhibit)/i.test(text)) return "evidence";
  return "other";
}

function getCategoryBadge(category: Category): { label: string; iconColor: string; bg: string } {
  if (category === "contracts") return { label: "Contract", iconColor: "text-primary", bg: "bg-primary/10" };
  if (category === "notices") return { label: "Notice", iconColor: "text-primary", bg: "bg-primary/10" };
  if (category === "evidence") return { label: "Evidence", iconColor: "text-emerald-300", bg: "bg-emerald-500/10" };
  return { label: "Document", iconColor: "text-primary", bg: "bg-primary/10" };
}

function buildAnalysisPrompt(doc: Doc): string {
  return `Analyze this Pakistani legal case document and return STRICT JSON only with this schema:
{
  "confidence": 0-100,
  "summary": ["bullet 1", "bullet 2", "bullet 3"],
  "risks": [
    {
      "id": "short-id",
      "title": "Short risk title",
      "detail": "1-2 sentence explanation",
      "severity": "danger" | "warning"
    }
  ]
}

Rules:
- Return up to 5 risks.
- Keep summary concise and practical for legal strategy.
- If no major risk, return empty risks array.
- Return valid JSON only, no markdown.

Document Title: ${doc.title}

Document Content:
${(doc.content || "").slice(0, 12000)}`;
}

function extractJsonObject(raw: string): string | null {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return cleaned.slice(start, end + 1);
  return null;
}

function parseAnalysis(raw: string): AnalysisResult {
  const fallback: AnalysisResult = {
    confidence: 72,
    summary: ["Document indexed successfully.", "Use AI analysis for issue spotting and risk checks."],
    risks: [],
  };

  const jsonText = extractJsonObject(raw);
  if (!jsonText) return fallback;

  try {
    const parsed = JSON.parse(jsonText) as Partial<AnalysisResult>;
    const confidence = clamp(Number(parsed.confidence || fallback.confidence), 0, 100);
    const summary = Array.isArray(parsed.summary)
      ? parsed.summary.map((s) => String(s)).filter(Boolean).slice(0, 5)
      : fallback.summary;
    const risksRaw = Array.isArray(parsed.risks) ? parsed.risks : [];
    const risks: AnalysisRisk[] = risksRaw.slice(0, 5).map((risk: any, idx: number) => ({
      id: String(risk?.id || `risk-${idx + 1}`),
      title: String(risk?.title || `Risk ${idx + 1}`),
      detail: String(risk?.detail || "Potential legal risk identified."),
      severity: risk?.severity === "danger" ? "danger" : "warning",
    }));

    return { confidence, summary: summary.length ? summary : fallback.summary, risks };
  } catch {
    return fallback;
  }
}

export default function CaseDocumentsPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: documents = [], isLoading } = useQuery<Doc[]>({ queryKey: ["/api/documents"] });

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [activeContextIds, setActiveContextIds] = useState<Set<number>>(new Set());
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(ACTIVE_CONTEXT_KEY);
    if (!raw) return;
    try {
      const ids = JSON.parse(raw) as number[];
      if (Array.isArray(ids)) {
        setActiveContextIds(new Set(ids.filter((n) => Number.isFinite(n))));
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(ACTIVE_CONTEXT_KEY, JSON.stringify(Array.from(activeContextIds)));
  }, [activeContextIds]);

  useEffect(() => {
    if (documents.length === 0 || activeContextIds.size > 0) return;
    const defaults = documents.slice(0, 3).map((d) => d.id);
    setActiveContextIds(new Set(defaults));
  }, [documents, activeContextIds.size]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Document removed" });
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err?.message || "Could not remove document.", variant: "destructive" });
    },
  });

  const filteredDocuments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((doc) => {
      const cat = inferCategory(doc);
      const categoryOk = category === "all" || cat === category;
      const searchOk = !q || doc.title.toLowerCase().includes(q) || (doc.content || "").toLowerCase().includes(q);
      return categoryOk && searchOk;
    });
  }, [documents, search, category]);

  const activeDocs = useMemo(
    () => documents.filter((d) => activeContextIds.has(d.id)).slice(0, 6),
    [documents, activeContextIds],
  );

  const contextUsagePercent = useMemo(() => {
    const usedChars = activeDocs.reduce((sum, d) => sum + (d.content?.length || 0), 0);
    return clamp(Math.round((usedChars / MAX_CONTEXT_CHARS) * 100), 0, 100);
  }, [activeDocs]);

  const handleDownload = (doc: Doc) => {
    const blob = new Blob([doc.content || ""], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.title.replace(/\s+/g, "-").toLowerCase() || "case-document"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async (doc: Doc) => {
    const payloadText = `${doc.title}\n\n${(doc.content || "").slice(0, 6000)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: doc.title, text: payloadText });
      } else {
        await navigator.clipboard.writeText(payloadText);
        toast({ title: "Copied", description: "Document copied to clipboard." });
      }
    } catch {
      toast({ title: "Share canceled" });
    }
  };

  const toggleContext = (id: number) => {
    setActiveContextIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openInEditor = (doc: Doc) => {
    localStorage.setItem(LEGAL_DRAFT_AUTOSAVE_KEY, doc.content || "");
    window.location.href = "/legal-drafting";
  };

  const runAnalysis = async (doc: Doc) => {
    setAnalysisLoading(true);
    try {
      const res = await apiRequest("POST", "/api/ai/document-chat", {
        documentType: "statute",
        documentTitle: doc.title,
        documentContent: doc.content || "",
        messages: [{ role: "user", content: buildAnalysisPrompt(doc) }],
      });
      const data = await res.json();
      setAnalysis(parseAnalysis(String(data?.content || "")));
    } catch (err: any) {
      setAnalysis(null);
      toast({
        title: "AI analysis unavailable",
        description: err?.message || "Could not analyze this document.",
        variant: "destructive",
      });
    } finally {
      setAnalysisLoading(false);
    }
  };

  const openPreview = (doc: Doc) => {
    setPreviewDoc(doc);
    setAnalysis(null);
    runAnalysis(doc).catch(() => {});
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const selected = Array.from(files);
      for (const file of selected) {
        const text = await file.text();
        await apiRequest("POST", "/api/documents", {
          title: file.name.replace(/\.[^/.]+$/, "") || file.name,
          content: text,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Upload complete", description: `${files.length} file${files.length > 1 ? "s" : ""} indexed.` });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message || "Could not upload files.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="h-full overflow-hidden rounded-[1.4rem] border border-[hsl(var(--preview-border))] preview-bg text-foreground" data-testid="case-documents-page">
      <div className="flex h-full min-h-[620px]">
        <main className="flex-1 min-w-0 flex flex-col preview-bg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[440px] h-[440px] bg-primary/5 rounded-full blur-[90px] pointer-events-none" />

          <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-[hsl(var(--preview-border))] glass-shell px-4 md:px-8 py-4">
            <div className="hidden md:flex items-center gap-3 shrink-0">
              <div className="size-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <ScaleIcon />
              </div>
              <div>
                <h1 className="text-sm font-black tracking-wide text-foreground">Al Wakeelo</h1>
                <p className="text-[10px] uppercase text-primary font-bold tracking-widest">AI Legal Assistant</p>
              </div>
            </div>

            <div className="hidden md:block h-8 w-px bg-white/10" />

            <div className="min-w-0 shrink-0">
              <h2 className="text-lg md:text-2xl font-bold">Case Documents</h2>
            </div>

            <div className="flex-1 max-w-2xl ml-auto">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search case files, evidence, or specific clauses..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none"
                />
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scrollbar-hide">
            <div className="flex flex-wrap items-center gap-2 mb-6">
              {([
                { id: "all", label: "All Documents" },
                { id: "contracts", label: "Contracts" },
                { id: "notices", label: "Notices" },
                { id: "evidence", label: "Evidence" },
              ] as Array<{ id: Category; label: string }>).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCategory(tab.id)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                    category === tab.id
                      ? "bg-primary text-foreground shadow-lg shadow-primary/20"
                      : "border border-white/10 bg-white/5 text-foreground hover:border-primary/40"
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              <div className="ml-auto">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.md,.json,.csv"
                  className="hidden"
                  onChange={(e) => handleUploadFiles(e.target.files)}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-primary/40 hover:bg-primary/10 text-sm font-bold"
                >
                  <Upload size={15} />
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
              {filteredDocuments.map((doc) => {
                const cat = inferCategory(doc);
                const badge = getCategoryBadge(cat);
                const active = activeContextIds.has(doc.id);
                return (
                  <article
                    key={doc.id}
                    className="rounded-2xl p-4 lg:p-5 border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface-elevated)/0.55)] backdrop-blur-lg hover:border-[hsl(var(--preview-border-active))/0.55] transition-all"
                    data-testid={`document-${doc.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className={`p-3 rounded-xl ${badge.bg}`}>
                        <FileText className={`${badge.iconColor}`} size={20} />
                      </div>
                      {active && (
                        <div className="px-2 py-1 rounded-md border border-primary/30 bg-primary/10 text-[10px] uppercase tracking-widest font-bold text-primary">
                          Context Active
                        </div>
                      )}
                    </div>

                    <div className="mt-4">
                      <h3 className="text-lg font-bold text-foreground line-clamp-1">{doc.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">Modified: {new Date(doc.createdAt).toLocaleDateString()}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 uppercase tracking-widest">{badge.label}</p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2">
                      <button
                        onClick={() => openPreview(doc)}
                        className="flex-1 py-2 rounded-lg bg-[hsl(var(--preview-surface)/0.65)] hover:bg-primary hover:text-foreground text-sm font-bold transition-all"
                        data-testid={`button-view-doc-${doc.id}`}
                      >
                        View
                      </button>
                      <button onClick={() => handleDownload(doc)} className="p-2 rounded-lg hover:bg-white/10 text-foreground" title="Download">
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => toggleContext(doc.id)}
                        className={`p-2 rounded-lg ${active ? "bg-primary/20 text-primary" : "text-foreground hover:bg-white/10"}`}
                        title="Toggle AI context"
                      >
                        <Brain size={16} />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(doc.id)}
                        className="p-2 rounded-lg text-foreground hover:bg-red-500/10 hover:text-red-300"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                );
              })}

              {!isLoading && filteredDocuments.length === 0 && (
                <div className="col-span-full py-16 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                  <FileSearch size={40} className="mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No documents match this filter.</p>
                </div>
              )}
            </div>
          </div>
        </main>

        <aside className="hidden lg:flex w-80 border-l border-[hsl(var(--preview-border))] glass-shell p-5 flex-col gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="text-primary" size={18} />
              <h3 className="text-lg font-bold">Active AI Knowledge</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The AI is currently referencing <span className="text-primary font-bold">{activeDocs.length} document{activeDocs.length === 1 ? "" : "s"}</span> for this case context.
            </p>
          </div>

          <div className="space-y-2 overflow-y-auto scrollbar-hide">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Processing Now</p>
            {activeDocs.length === 0 && <p className="text-xs text-muted-foreground">No active context documents selected.</p>}
            {activeDocs.map((doc) => (
              <div key={doc.id} className="p-3 rounded-xl border border-primary/25 bg-primary/5">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-primary" />
                  <p className="text-sm font-semibold line-clamp-1">{doc.title}</p>
                </div>
                <p className="text-[11px] text-primary/80 mt-1">Live Syncing</p>
              </div>
            ))}
          </div>

          <div className="mt-auto p-3 rounded-xl border border-white/10 bg-white/5">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-muted-foreground">Context Window</span>
              <span className="text-primary font-bold">{contextUsagePercent}% Used</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${contextUsagePercent}%` }} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Large files are summarized automatically to fit within AI context.</p>
          </div>
        </aside>
      </div>

      {previewDoc && (
        <div className="fixed inset-0 z-[140] p-3 md:p-6 bg-black/70 backdrop-blur-sm">
          <div className="h-full w-full rounded-2xl border border-[hsl(var(--preview-border-active))/0.45] preview-surface overflow-hidden flex flex-col">
            <div className="px-4 md:px-6 py-3 border-b border-[hsl(var(--preview-border))] glass-shell flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-primary/15 text-primary"><FileText size={18} /></div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-foreground truncate">{previewDoc.title}</h3>
                  <p className="text-[11px] uppercase tracking-widest text-primary/80">Legal Draft • Indexed</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleDownload(previewDoc)} className="p-2 rounded-lg hover:bg-white/10 text-foreground" title="Download">
                  <Download size={18} />
                </button>
                <button onClick={() => handleShare(previewDoc)} className="p-2 rounded-lg hover:bg-white/10 text-foreground" title="Share">
                  <Share2 size={18} />
                </button>
                <button onClick={() => setPreviewDoc(null)} className="p-2 rounded-full bg-primary text-foreground hover:brightness-110" title="Close">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_320px]">
              <div className="overflow-auto p-4 md:p-6 bg-[hsl(var(--preview-bg)/0.55)]">
                <div className="mx-auto max-w-[760px] min-h-full bg-white text-[#1b1b1b] rounded-sm shadow-2xl p-6 md:p-10 legal-draft-font whitespace-pre-wrap leading-relaxed">
                  {previewDoc.content || "No document content available."}
                </div>
              </div>

              <aside className="border-l border-[hsl(var(--preview-border))] glass-shell p-4 md:p-5 overflow-y-auto">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={16} className="text-primary" />
                  <h4 className="text-lg font-bold">AI Analysis</h4>
                </div>

                <div className="rounded-xl border border-primary/25 bg-primary/10 p-3 mb-4">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-foreground">Confidence Score</span>
                    <span className="font-bold text-primary">{analysis?.confidence ?? 0}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${analysis?.confidence ?? 0}%` }} />
                  </div>
                </div>

                {analysisLoading ? (
                  <p className="text-sm text-muted-foreground">Analyzing document...</p>
                ) : (
                  <>
                    <div className="mb-5">
                      <h5 className="font-bold text-2xl mb-2">Document Summary</h5>
                      <div className="space-y-2">
                        {(analysis?.summary || []).map((line, i) => (
                          <div key={`${line}-${i}`} className="flex items-start gap-2 text-sm text-foreground">
                            <span className="text-primary mt-0.5">•</span>
                            <p>{line}</p>
                          </div>
                        ))}
                        {(!analysis || analysis.summary.length === 0) && (
                          <p className="text-sm text-muted-foreground">No summary generated yet.</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <h5 className="font-bold text-2xl mb-2">Detected Legal Risks</h5>
                      <div className="space-y-2">
                        {(analysis?.risks || []).map((risk) => (
                          <div
                            key={risk.id}
                            className={`rounded-xl border p-3 ${risk.severity === "danger" ? "border-red-400/30 bg-red-500/10" : "border-primary/30 bg-primary/10"}`}
                          >
                            <div className="flex items-center gap-2 text-sm font-bold">
                              {risk.severity === "danger" ? <AlertTriangle size={14} className="text-red-300" /> : <CheckCircle2 size={14} className="text-primary" />}
                              <span>{risk.title}</span>
                            </div>
                            <p className="text-xs text-foreground mt-1">{risk.detail}</p>
                          </div>
                        ))}
                        {analysis && analysis.risks.length === 0 && (
                          <p className="text-sm text-muted-foreground">No high-priority legal risks detected.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <button
                  onClick={() => openInEditor(previewDoc)}
                  className="mt-5 w-full py-3 rounded-full bg-primary text-foreground font-bold hover:brightness-105 inline-flex items-center justify-center gap-2"
                >
                  <FolderOpen size={16} /> Open in Editor
                </button>
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m16 16 3-8 3 8c0 1.7-1.3 3-3 3s-3-1.3-3-3Z" />
      <path d="m2 16 3-8 3 8c0 1.7-1.3 3-3 3s-3-1.3-3-3Z" />
      <path d="M7 21h10" />
      <path d="M12 3v18" />
      <path d="M3 7h18" />
    </svg>
  );
}
