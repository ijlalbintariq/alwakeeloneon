import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertOctagon,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FolderOpen,
  Gavel,
  Loader2,
  Lock,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Cpu,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DocumentViewer } from "@/components/document-viewer";

type Doc = {
  id: number;
  title: string;
  content?: string | null;
  summary?: string | null;
  sourceType?: TypeFilter;
  mimeType?: string | null;
  fileExtension?: string | null;
  detectedDomain?: string;
  detectedDomainLabel?: string;
  classificationMethod?: "rule" | "ml" | "fallback";
  classificationConfidence?: number; // API value 0-1
  createdAt: string;
};

type VaultView = "home" | "uploads" | "results" | "processing";
type TypeFilter = "all" | "pdf" | "docx" | "txt" | "json" | "csv" | "other";
type StatusFilter = "all" | "trained" | "failed";
type DateFilter = "any" | "year" | "month";
type JurisdictionFilter = "all" | "supreme-court" | "high-court" | "district-court";

type UploadState = {
  total: number;
  completed: number;
  currentFile: string;
  errors: string[];
  extractedDocs: Doc[];
};

type VaultDoc = Doc & {
  extension: TypeFilter;
  status: Exclude<StatusFilter, "all">;
  approxBytes: number;
  domainKey: string;
  domainLabel: string;
  jurisdiction: JurisdictionFilter;
};

type VaultInsights = {
  totalDocuments: number;
  sourceCounts: Array<{ key: string; label: string; count: number }>;
  domainCounts: Array<{ key: string; label: string; count: number }>;
  unclassifiedCount: number;
};

const LEGAL_CONCEPTS = [
  "jurisdiction",
  "maintainability",
  "locus standi",
  "due process",
  "fundamental rights",
  "estoppel",
  "habeas corpus",
  "article 199",
  "breach of contract",
  "specific performance",
];

function extensionFromTitle(title: string): TypeFilter {
  const dot = title.lastIndexOf(".");
  if (dot === -1) return "other";
  const ext = title.slice(dot + 1).toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "doc") return "docx";
  if (ext === "txt" || ext === "md") return "txt";
  if (ext === "json") return "json";
  if (ext === "csv") return "csv";
  return "other";
}

function inferJurisdiction(text: string): JurisdictionFilter {
  const lower = text.toLowerCase();
  if (/(supreme court|scmr|pld)/.test(lower)) return "supreme-court";
  if (/(high court|lhc|shc|ihc|bhc|phc)/.test(lower)) return "high-court";
  if (/(district court|civil judge|sessions judge)/.test(lower)) return "district-court";
  return "all";
}

function statusFromDoc(doc: Doc): Exclude<StatusFilter, "all"> {
  return (doc.content || "").trim().length > 0 ? "trained" : "failed";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function labelForJurisdiction(jurisdiction: JurisdictionFilter): string {
  if (jurisdiction === "supreme-court") return "Supreme Court";
  if (jurisdiction === "high-court") return "High Court";
  if (jurisdiction === "district-court") return "District Court";
  return "All Jurisdictions";
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query: string) {
  const terms = tokenizeQuery(query);
  if (terms.length === 0) return text;
  const regex = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "ig");
  const parts = text.split(regex);
  return parts.map((part, idx) =>
    terms.some((term) => term === part.toLowerCase()) ? (
      <mark key={`${part}-${idx}`} className="bg-amber-500/25 text-amber-300 rounded px-0.5">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${idx}`}>{part}</span>
    ),
  );
}

function makeSnippet(content: string, query: string): string {
  const text = (content || "").replace(/\s+/g, " ").trim();
  if (!text) return "No extractable text in this document.";
  const lower = text.toLowerCase();
  const terms = tokenizeQuery(query);
  let index = -1;
  for (const term of terms) {
    const found = lower.indexOf(term);
    if (found !== -1) {
      index = found;
      break;
    }
  }
  if (index === -1) return `${text.slice(0, 260)}${text.length > 260 ? "..." : ""}`;
  const start = Math.max(0, index - 90);
  const end = Math.min(text.length, index + 180);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

function scoreMatch(doc: VaultDoc, query: string): number {
  const terms = tokenizeQuery(query);
  if (terms.length === 0) return 0;
  const title = doc.title.toLowerCase();
  const body = (doc.content || "").toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 4;
    if (body.includes(term)) score += 2;
  }
  return score;
}

function topExtractedTerms(text: string): string[] {
  const words = (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .filter((w) => !["that", "with", "from", "have", "this", "your", "shall", "case", "file", "court", "section"].includes(w));

  const freq = new Map<string, number>();
  for (const word of words) freq.set(word, (freq.get(word) || 0) + 1);

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([word]) => word.replace(/\b\w/g, (c) => c.toUpperCase()));
}

function detectedConcepts(text: string): string[] {
  const lower = (text || "").toLowerCase();
  return LEGAL_CONCEPTS.filter((concept) => lower.includes(concept)).slice(0, 6);
}

export default function KnowledgeVaultPage() {
  const { toast } = useToast();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const hasRequestedBackfillRef = useRef(false);

  const { data: documents = [], isLoading } = useQuery<Doc[]>({ queryKey: ["/api/documents"] });
  const { data: insightsData } = useQuery<VaultInsights>({ queryKey: ["/api/documents/insights"] });

  const [previewDoc, setPreviewDoc] = useState<VaultDoc | null>(null);
  const [view, setView] = useState<VaultView>("home");
  const [searchInput, setSearchInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [uploadSearch, setUploadSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [uploadPage, setUploadPage] = useState(1);
  const [resultPage, setResultPage] = useState(1);
  const [dateFilter, setDateFilter] = useState<DateFilter>("any");
  const [jurisdictionFilter, setJurisdictionFilter] = useState<JurisdictionFilter>("all");
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [domainFilters, setDomainFilters] = useState<Record<string, boolean>>({});
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [ragIndexingIds, setRagIndexingIds] = useState<Record<number, boolean>>({});
  const [isBulkRagIndexing, setIsBulkRagIndexing] = useState(false);

  const [uploadState, setUploadState] = useState<UploadState>({
    total: 0,
    completed: 0,
    currentFile: "",
    errors: [],
    extractedDocs: [],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/insights"] });
      toast({ title: "Document deleted" });
      setPreviewDoc(null);
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err?.message || "Could not delete document.", variant: "destructive" });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/documents");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/insights"] });
      setShowDeleteAllConfirm(false);
      setPreviewDoc(null);
      const deleted = Number(data?.deleted || 0);
      toast({ title: `${deleted} document${deleted === 1 ? "" : "s"} deleted` });
    },
    onError: (err: any) => {
      setShowDeleteAllConfirm(false);
      toast({ title: "Delete failed", description: err?.message || "Could not delete documents.", variant: "destructive" });
    },
  });

  useEffect(() => {
    const domainCounts = insightsData?.domainCounts || [];
    if (domainCounts.length === 0) return;
    setDomainFilters((prev) => {
      const next: Record<string, boolean> = {};
      for (const item of domainCounts) {
        next[item.key] = prev[item.key] ?? true;
      }
      return next;
    });
  }, [insightsData?.domainCounts]);

  useEffect(() => {
    if (!insightsData?.unclassifiedCount || insightsData.unclassifiedCount <= 0) return;
    if (hasRequestedBackfillRef.current || isBackfilling) return;

    hasRequestedBackfillRef.current = true;
    let cancelled = false;

    const runBackfill = async () => {
      setIsBackfilling(true);
      try {
        let remaining = insightsData.unclassifiedCount;
        while (remaining > 0 && !cancelled) {
          const response = await fetch("/api/documents/backfill-metadata", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ limit: 50 }),
          });
          if (!response.ok) break;
          const payload = await response.json().catch(() => null);
          remaining = Number(payload?.remainingUnclassified || 0);
          await queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/documents/insights"] });
          if (remaining > 0) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
      } finally {
        if (!cancelled) setIsBackfilling(false);
      }
    };

    runBackfill();
    return () => {
      cancelled = true;
    };
  }, [insightsData?.unclassifiedCount, isBackfilling]);

  const vaultDocs = useMemo<VaultDoc[]>(() => {
    return documents.map((doc) => {
      const extension = (doc.sourceType && doc.sourceType !== "all" ? doc.sourceType : extensionFromTitle(doc.title)) as TypeFilter;
      const content = doc.content || "";
      const status = statusFromDoc(doc);
      const approxBytes = new TextEncoder().encode(content).length;
      const merged = `${doc.title}\n${content}`;
      return {
        ...doc,
        extension,
        status,
        approxBytes,
        domainKey: doc.detectedDomain || "other",
        domainLabel: doc.detectedDomainLabel || "Other",
        jurisdiction: inferJurisdiction(merged),
      };
    });
  }, [documents]);

  const stats = useMemo(() => {
    const total = vaultDocs.length;
    const trained = vaultDocs.filter((d) => d.status === "trained").length;
    const failed = vaultDocs.filter((d) => d.status === "failed").length;
    const processing = Math.max(0, uploadState.total - uploadState.completed);
    return { total, trained, failed, processing };
  }, [uploadState.completed, uploadState.total, vaultDocs]);

  const insights = useMemo(() => {
    const latest = vaultDocs.slice(0, 4).map((doc) => ({
      title: `${doc.title} indexed`,
      description: `Added on ${formatDate(doc.createdAt)} as ${doc.extension.toUpperCase()}.`,
      tag: doc.status === "trained" ? "Indexed" : "Issue",
    }));
    if (latest.length === 0) {
      return [{ title: "Vault is empty", description: "Upload documents to start building your private legal vault.", tag: "Info" }];
    }
    return latest;
  }, [vaultDocs]);

  const sourceCounts = insightsData?.sourceCounts || [];
  const domainCounts = insightsData?.domainCounts || [];

  const topDomainCards = useMemo(() => {
    const nonZero = domainCounts.filter((item) => item.count > 0);
    const top = nonZero.slice(0, 3);
    if (top.length >= 3) return top;
    const hasOther = top.some((d) => d.key === "other");
    const other = nonZero.find((d) => d.key === "other");
    if (!hasOther && other && top.length < 3) return [...top, other];
    return top;
  }, [domainCounts]);

  const filteredUploads = useMemo(() => {
    const query = uploadSearch.trim().toLowerCase();
    return vaultDocs.filter((doc) => {
      const typeOk = typeFilter === "all" || doc.extension === typeFilter;
      const statusOk = statusFilter === "all" || doc.status === statusFilter;
      const queryOk =
        !query ||
        doc.title.toLowerCase().includes(query) ||
        (doc.content || "").toLowerCase().includes(query);
      return typeOk && statusOk && queryOk;
    });
  }, [vaultDocs, uploadSearch, typeFilter, statusFilter]);

  const uploadPageSize = 6;
  const uploadPageCount = Math.max(1, Math.ceil(filteredUploads.length / uploadPageSize));
  const uploadRows = filteredUploads.slice((uploadPage - 1) * uploadPageSize, uploadPage * uploadPageSize);

  const results = useMemo(() => {
    const query = activeQuery.trim();
    if (!query) return [];

    const includeTypes = Object.entries(domainFilters)
      .filter(([, checked]) => checked)
      .map(([key]) => key);

    const now = Date.now();
    return vaultDocs
      .map((doc) => {
        const score = scoreMatch(doc, query);
        const snippet = makeSnippet(doc.content || "", query);
        return { doc, score, snippet };
      })
      .filter(({ doc, score }) => {
        if (score <= 0) return false;
        if (includeTypes.length > 0 && !includeTypes.includes(doc.domainKey)) return false;
        if (jurisdictionFilter !== "all" && doc.jurisdiction !== jurisdictionFilter) return false;
        if (dateFilter !== "any") {
          const ageMs = now - new Date(doc.createdAt).getTime();
          if (dateFilter === "month" && ageMs > 1000 * 60 * 60 * 24 * 31) return false;
          if (dateFilter === "year" && ageMs > 1000 * 60 * 60 * 24 * 366) return false;
        }
        return true;
      })
      .sort((a, b) => b.score - a.score);
  }, [activeQuery, domainFilters, dateFilter, jurisdictionFilter, vaultDocs]);

  const resultPageSize = 4;
  const resultPageCount = Math.max(1, Math.ceil(results.length / resultPageSize));
  const resultRows = results.slice((resultPage - 1) * resultPageSize, resultPage * resultPageSize);

  const processingPercent = uploadState.total > 0 ? Math.round((uploadState.completed / uploadState.total) * 100) : 0;
  const processingText = useMemo(
    () => uploadState.extractedDocs.map((d) => d.content || "").join("\n"),
    [uploadState.extractedDocs],
  );
  const terms = useMemo(() => topExtractedTerms(processingText), [processingText]);
  const concepts = useMemo(() => detectedConcepts(processingText), [processingText]);

  const clearFilters = () => {
    const reset: Record<string, boolean> = {};
    for (const item of domainCounts) reset[item.key] = true;
    setDomainFilters(reset);
    setDateFilter("any");
    setJurisdictionFilter("all");
    setResultPage(1);
  };

  const indexDocumentForRag = async (doc: Doc) => {
    if (!doc?.id || ragIndexingIds[doc.id]) return;
    setRagIndexingIds((prev) => ({ ...prev, [doc.id]: true }));
    try {
      const response = await apiRequest("POST", "/api/rag/index-document", { documentId: doc.id });
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Indexed for RAG",
        description: `${doc.title} (${Number(payload?.chunks || 0)} chunks)`,
      });
    } catch (err: any) {
      toast({
        title: "RAG indexing failed",
        description: err?.message || `Could not index ${doc.title}`,
        variant: "destructive",
      });
    } finally {
      setRagIndexingIds((prev) => ({ ...prev, [doc.id]: false }));
    }
  };

  const indexAllForRag = async () => {
    if (isBulkRagIndexing || documents.length === 0) return;
    setIsBulkRagIndexing(true);
    let success = 0;
    let failed = 0;
    for (const doc of documents) {
      if (!doc?.id) continue;
      setRagIndexingIds((prev) => ({ ...prev, [doc.id]: true }));
      try {
        await apiRequest("POST", "/api/rag/index-document", { documentId: doc.id });
        success += 1;
      } catch {
        failed += 1;
      } finally {
        setRagIndexingIds((prev) => ({ ...prev, [doc.id]: false }));
      }
    }
    setIsBulkRagIndexing(false);
    toast({
      title: "RAG indexing complete",
      description: `${success} indexed${failed ? `, ${failed} failed` : ""}.`,
      variant: failed > 0 ? "destructive" : "default",
    });
  };

  const openUploader = () => uploadInputRef.current?.click();

  const downloadDoc = (doc: VaultDoc) => {
    const blob = new Blob([doc.content || ""], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const fallbackName = doc.title || `document-${doc.id}`;
    a.href = url;
    a.download = fallbackName.toLowerCase().endsWith(".txt") ? fallbackName : `${fallbackName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openSourceDoc = async (doc: VaultDoc) => {
    const fileUrl = `/api/documents/${doc.id}/file`;
    try {
      const probe = await fetch(fileUrl, { method: "HEAD", credentials: "include" });
      if (probe.ok || probe.status === 302) {
        window.open(fileUrl, "_blank", "noopener,noreferrer");
        return;
      }
    } catch {
      // Fallback below.
    }
    setPreviewDoc(doc);
  };

  const citeResult = async (doc: VaultDoc, snippet: string) => {
    const citeText = `${doc.title} (${formatDate(doc.createdAt)})\n${snippet}`;
    try {
      await navigator.clipboard.writeText(citeText);
      toast({ title: "Citation copied", description: "Use it in chat or drafting." });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleSearch = (query?: string) => {
    const q = (query ?? searchInput).trim();
    setSearchInput(q);
    setActiveQuery(q);
    setResultPage(1);
    if (q) setView("results");
  };

  const handleFilesChosen = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setView("processing");
    setUploadState({
      total: files.length,
      completed: 0,
      currentFile: files[0].name,
      errors: [],
      extractedDocs: [],
    });

    const errors: string[] = [];
    const extracted: Doc[] = [];
    let completed = 0;

    for (const file of files) {
      setUploadState((prev) => ({ ...prev, currentFile: file.name }));
      const formData = new FormData();
      formData.append("files", file);

      try {
        const response = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          errors.push(payload?.message || `Failed to upload ${file.name}`);
        } else {
          const docs = Array.isArray(payload?.documents) ? (payload.documents as Doc[]) : [];
          extracted.push(...docs);
          if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
            errors.push(...payload.errors.map(String));
          }
        }
      } catch (err: any) {
        errors.push(err?.message || `Failed to upload ${file.name}`);
      }

      completed += 1;
      setUploadState((prev) => ({
        ...prev,
        completed,
        currentFile: completed < files.length ? files[completed].name : "",
        errors: [...errors],
        extractedDocs: [...extracted],
      }));
    }

    await queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/documents/insights"] });
    if (uploadInputRef.current) uploadInputRef.current.value = "";

    if (errors.length === files.length) {
      toast({ title: "Upload failed", description: errors[0] || "No files were uploaded.", variant: "destructive" });
    } else if (errors.length > 0) {
      toast({ title: "Upload partially complete", description: `${files.length - errors.length} uploaded, ${errors.length} failed.` });
    } else {
      toast({ title: "Upload complete", description: `${files.length} file${files.length > 1 ? "s" : ""} added to your vault.` });
    }

    if (extracted.length > 0) {
      for (const doc of extracted) {
        if (!doc?.id) continue;
        try {
          await apiRequest("POST", "/api/rag/index-document", { documentId: doc.id });
        } catch {
          // Indexing errors are non-fatal for upload flow.
        }
      }
    }

    setView("uploads");
  };

  return (
    <div className="h-full overflow-hidden rounded-[1.25rem] border border-[hsl(var(--preview-border))] preview-bg text-slate-100 shadow-2xl" data-testid="knowledge-vault-page">
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        accept=".txt,.json,.csv,.pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => handleFilesChosen(e.target.files)}
      />

      {view !== "home" && (
        <div className="border-b border-[hsl(var(--preview-border))] glass-shell px-4 md:px-6 py-3 flex items-center justify-end">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("home")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition ${
                (view as string) === "home" ? "bg-amber-500 text-[#1e1406] border-amber-400" : "border-amber-500/30 text-slate-300 hover:text-white"
              }`}
            >
              Home
            </button>
            <button
              onClick={() => setView("uploads")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition ${
                (view as string) === "uploads" ? "bg-amber-500 text-[#1e1406] border-amber-400" : "border-amber-500/30 text-slate-300 hover:text-white"
              }`}
            >
              My Uploads
            </button>
          </div>
        </div>
      )}

      <div className={view === "home" || view === "processing" ? "h-full overflow-y-auto" : "h-[calc(100%-61px)] overflow-hidden"}>
        {view === "processing" && (
          <div className="min-h-full px-5 md:px-8 py-8 md:py-12">
            <div className="max-w-[1600px] w-full mx-auto flex flex-col items-center gap-8">
              <div className="relative size-64 md:size-72">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 220 220">
                  <circle cx="110" cy="110" r="88" stroke="rgba(255,255,255,0.08)" strokeWidth="8" fill="transparent" />
                  <circle
                    cx="110"
                    cy="110"
                    r="88"
                    stroke="#f9a406"
                    strokeWidth="8"
                    fill="transparent"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 88}
                    strokeDashoffset={(1 - processingPercent / 100) * (2 * Math.PI * 88)}
                    className="drop-shadow-[0_0_12px_rgba(249,164,6,0.5)] transition-all duration-300"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <div className="text-5xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
                    {processingPercent}
                    <span className="text-2xl text-amber-400">%</span>
                  </div>
                  <p className="text-[11px] text-amber-400 uppercase tracking-widest font-black mt-1">Processing</p>
                  <p className="text-sm text-slate-400 mt-2">Analyzing {uploadState.total} document{uploadState.total !== 1 ? "s" : ""}...</p>
                  {uploadState.currentFile && (
                    <p className="text-xs text-slate-500 mt-1 max-w-[210px] truncate">{uploadState.currentFile}</p>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5 w-full">
                <div className="rounded-2xl border border-amber-500/20 bg-black/20 backdrop-blur-xl p-5">
                  <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                    <Sparkles size={16} className="text-amber-400" /> Extracted Key Terms
                  </h3>
                  <div className="space-y-2 text-sm">
                    {terms.length > 0 ? (
                      terms.map((term, i) => (
                        <div key={`${term}-${i}`} className="flex items-center justify-between text-slate-300">
                          <span>{term}</span>
                          <span className="text-emerald-400 text-xs font-mono">{i < Math.max(1, uploadState.completed) ? "Found" : "Indexing..."}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-500 text-sm">Waiting for extracted text...</div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-500/20 bg-black/20 backdrop-blur-xl p-5">
                  <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                    <BookOpen size={16} className="text-amber-400" /> Concepts Identified
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(concepts.length > 0 ? concepts : ["Pending extraction"]).map((concept, i) => (
                      <span
                        key={`${concept}-${i}`}
                        className={`px-3 py-1 rounded-full text-xs border ${
                          concepts.length > 0
                            ? "bg-amber-500/10 border-amber-500/25 text-amber-300"
                            : "bg-white/5 border-white/10 text-slate-500"
                        }`}
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 py-3 rounded-xl border border-amber-500/20 bg-black/20 text-slate-400 text-sm">
                {processingPercent < 100 ? "Please wait while we calibrate your vault..." : "Finalizing vault index..."}
              </div>
            </div>
          </div>
        )}

        {view === "home" && (
          <div className="px-4 md:px-6 lg:px-8 py-5 md:py-6 space-y-5">
            <div className="w-full rounded-3xl border border-amber-500/25 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(245,158,11,0.16),rgba(15,23,42,0.82)_45%,rgba(2,6,23,0.95)_100%)] p-4 md:p-6 shadow-[0_28px_48px_-34px_rgba(2,6,23,1)]">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] font-black text-amber-200/75 mb-2">Knowledge Vault</p>
                  <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight text-left" style={{ fontFamily: "'Playfair Display', serif" }}>
                    Your Personalized <span className="text-amber-300">AI Legal Vault</span>
                  </h1>
                  <p className="text-sm text-slate-300 mt-2">Private legal memory, trained on your own uploaded case material.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setView("home")}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition ${
                      (view as string) === "home" ? "bg-amber-500 text-[#1e1406] border-amber-400" : "border-amber-500/30 text-slate-300 hover:text-white"
                    }`}
                  >
                    Home
                  </button>
                  <button
                    onClick={() => setView("uploads")}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition ${
                      (view as string) === "uploads" ? "bg-amber-500 text-[#1e1406] border-amber-400" : "border-amber-500/30 text-slate-300 hover:text-white"
                    }`}
                  >
                    My Uploads
                  </button>
                </div>
              </div>
              <div className="mt-5 w-full rounded-2xl border border-amber-300/25 bg-[#0b1222]/70 p-2.5 backdrop-blur-md">
                <div className="flex items-center gap-2 rounded-xl bg-black/25 border border-white/5">
                  <Search size={18} className="text-amber-300 ml-4" />
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearch();
                    }}
                    placeholder="Search your private files..."
                    className="w-full bg-transparent py-3 text-white placeholder:text-slate-500 outline-none"
                  />
                  <button
                    onClick={() => handleSearch()}
                    className="mr-2 px-5 py-2 rounded-lg bg-gradient-to-r from-amber-300 to-amber-400 hover:from-amber-200 hover:to-amber-300 text-[#211507] font-black text-sm"
                  >
                    Search Vault
                  </button>
                </div>
              </div>

            </div>

            <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-4">
              <div className="xl:col-span-8 space-y-4">
                <div className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/12 to-transparent p-5 md:p-6 flex flex-col md:flex-row gap-5 justify-between shadow-[0_20px_40px_-30px_rgba(251,191,36,0.5)]">
                  <div className="flex-1">
                    <h3 className="text-xl text-white font-bold flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                      <Sparkles size={18} className="text-amber-400" />
                      Personal AI Training
                    </h3>
                    <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                      Upload your case files and legal drafts. These documents stay private to your account and are used as context for your AI workflows.
                    </p>
                    <p className="text-xs text-slate-500 mt-2">End-to-end encrypted • Private to your account</p>
                  </div>
                  <button
                    onClick={openUploader}
                    className="shrink-0 rounded-xl border-2 border-dashed border-amber-500/40 hover:border-amber-400 bg-black/20 hover:bg-amber-500/10 px-8 py-5 text-center"
                  >
                    <div className="w-10 h-10 mx-auto rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center">
                      <Upload size={18} />
                    </div>
                    <p className="text-sm text-slate-200 mt-2 font-medium">Upload for AI Training</p>
                    <p className="text-xs text-slate-500 mt-1">PDF, DOCX, TXT, CSV, JSON</p>
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-2xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>Legal Domains</h3>
                    <button onClick={() => setView("uploads")} className="text-sm text-amber-300 hover:text-white font-semibold">
                      Manage Sources
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 hover:border-amber-400/60 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-[#2a1904] flex items-center justify-center">
                          <FolderOpen size={17} />
                        </div>
                        <span className="text-xs text-amber-300 font-bold uppercase">Active</span>
                      </div>
                      <p className="text-white text-lg mt-3 font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>My Uploaded Files</p>
                      <p className="text-sm text-slate-400 mt-1">Private files in your account vault.</p>
                      <p className="text-2xl text-white mt-3 font-bold">{stats.total} <span className="text-sm text-slate-400 font-medium">Documents</span></p>
                    </div>
                    {topDomainCards.map((item) => (
                      <div key={item.key} className="rounded-2xl border border-amber-500/20 bg-black/20 p-5 hover:border-amber-400/40 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                            <Gavel size={16} />
                          </div>
                          <span className="text-xs text-slate-500 font-mono">Live</span>
                        </div>
                        <p className="text-white text-lg mt-3 font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>{item.label}</p>
                        <p className="text-sm text-slate-400 mt-1">Detected from your uploaded document content.</p>
                        <p className="text-xl text-white mt-3 font-bold">{item.count}</p>
                      </div>
                    ))}
                    {stats.total === 0 && (
                      <div className="rounded-2xl border border-amber-500/20 bg-black/20 p-5 sm:col-span-2">
                        <p className="text-slate-300 text-sm">Upload documents to generate domains and sources.</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 rounded-2xl border border-amber-500/20 bg-black/20 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-lg text-white font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>Sources</h4>
                      {isBackfilling && <span className="text-xs text-amber-300">Updating domain insights...</span>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {sourceCounts.length > 0 ? sourceCounts.map((source) => (
                        <span key={source.key} className="px-3 py-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 text-xs text-amber-200">
                          {source.label}: <span className="font-bold text-white">{source.count}</span>
                        </span>
                      )) : (
                        <span className="text-sm text-slate-500">No upload sources detected yet.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <aside className="xl:col-span-4">
                <div className="rounded-2xl border border-amber-500/20 bg-black/20 h-full p-4 shadow-[0_20px_36px_-30px_rgba(2,6,23,1)]">
                  <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
                    <h3 className="text-lg text-white font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>AI Insights & Updates</h3>
                    <Sparkles size={16} className="text-amber-400" />
                  </div>
                  <div className="mt-3 space-y-2">
                    {insights.map((item, idx) => (
                      <div key={`${item.title}-${idx}`} className="p-3 rounded-xl border border-amber-500/15 bg-amber-500/5 hover:border-amber-400/35 transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500 text-[#291904] font-black uppercase">{item.tag}</span>
                          <span className="text-xs text-slate-500">{idx === 0 ? "Just now" : "Recent"}</span>
                        </div>
                        <p className="text-sm text-white font-medium">{item.title}</p>
                        <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}

        {view === "uploads" && (
          <div className="h-full px-4 md:px-6 lg:px-8 py-4 md:py-5 flex flex-col gap-4">
            <div className="rounded-3xl border border-amber-500/25 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(245,158,11,0.14),rgba(15,23,42,0.82)_46%,rgba(2,6,23,0.95)_100%)] p-4 md:p-5 shadow-[0_24px_42px_-32px_rgba(2,6,23,1)]">
              <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] font-black text-amber-200/75 mb-2">Knowledge Vault</p>
                  <h1 className="text-2xl md:text-4xl font-bold text-white mt-1" style={{ fontFamily: "'Playfair Display', serif" }}>My Uploaded Files</h1>
                  <p className="text-slate-300 mt-2 text-sm">Manage private legal documents, indexing status, and source health.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(documents.length > 0 && !showDeleteAllConfirm) && (
                    <button
                      onClick={() => setShowDeleteAllConfirm(true)}
                      className="px-4 py-2.5 rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/10 font-black text-xs uppercase tracking-widest flex items-center gap-2"
                    >
                      <Trash2 size={14} /> Delete All
                    </button>
                  )}

                  {showDeleteAllConfirm && (
                    <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
                      <AlertOctagon size={14} className="text-red-300" />
                      <span className="text-[11px] text-red-200 font-bold">Delete all {documents.length} files?</span>
                      <button
                        onClick={() => deleteAllMutation.mutate()}
                        disabled={deleteAllMutation.isPending}
                        className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest"
                      >
                        {deleteAllMutation.isPending ? "Deleting..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => setShowDeleteAllConfirm(false)}
                        className="px-3 py-1.5 rounded-lg border border-white/15 text-slate-300 text-[10px] font-black uppercase tracking-widest"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  <button
                    onClick={openUploader}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-300 to-amber-400 hover:from-amber-200 hover:to-amber-300 text-[#251607] font-black flex items-center gap-2"
                  >
                    <Upload size={16} /> Upload New
                  </button>
                  {documents.length > 0 && (
                    <button
                      onClick={indexAllForRag}
                      disabled={isBulkRagIndexing}
                      className="px-4 py-2.5 rounded-xl border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 font-black text-xs uppercase tracking-widest flex items-center gap-2 disabled:opacity-60"
                    >
                      {isBulkRagIndexing ? <Loader2 size={14} className="animate-spin" /> : <Cpu size={14} />}
                      {isBulkRagIndexing ? "Indexing..." : "Index All for RAG"}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-amber-500/25 bg-black/25 p-3.5">
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Total Files</p>
                  <p className="text-2xl text-white font-bold mt-1">{stats.total}</p>
                </div>
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3.5">
                  <p className="text-[11px] uppercase tracking-wider text-emerald-300 font-bold">Fully Trained</p>
                  <p className="text-2xl text-white font-bold mt-1">{stats.trained}</p>
                </div>
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5">
                  <p className="text-[11px] uppercase tracking-wider text-amber-300 font-bold">Processing</p>
                  <p className="text-2xl text-white font-bold mt-1">{stats.processing}</p>
                </div>
                <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3.5">
                  <p className="text-[11px] uppercase tracking-wider text-red-300 font-bold">Issues</p>
                  <p className="text-2xl text-white font-bold mt-1">{stats.failed}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 rounded-2xl border border-amber-500/20 bg-black/20 overflow-hidden flex flex-col">
              <div className="p-3 md:p-4 border-b border-amber-500/15 flex flex-col lg:flex-row gap-3 justify-between">
                <div className="relative w-full lg:max-w-sm">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={uploadSearch}
                    onChange={(e) => {
                      setUploadSearch(e.target.value);
                      setUploadPage(1);
                    }}
                    placeholder="Search documents..."
                    className="w-full rounded-lg border border-white/15 bg-white/5 pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-500/40"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={typeFilter}
                    onChange={(e) => {
                      setTypeFilter(e.target.value as TypeFilter);
                      setUploadPage(1);
                    }}
                    className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-200 outline-none"
                  >
                    <option value="all">All Types</option>
                    <option value="pdf">PDF</option>
                    <option value="docx">DOCX</option>
                    <option value="txt">TXT</option>
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value as StatusFilter);
                      setUploadPage(1);
                    }}
                    className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-200 outline-none"
                  >
                    <option value="all">All Status</option>
                    <option value="trained">Trained</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-auto w-full">
                <table className="w-full min-w-[980px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="text-left text-xs uppercase tracking-wider text-slate-400 bg-[#111a2c]">
                      <th className="px-8 py-4">Document Name</th>
                      <th className="px-8 py-4">Upload Date</th>
                      <th className="px-8 py-4">File Size</th>
                      <th className="px-8 py-4">AI Status</th>
                      <th className="px-8 py-4 text-right">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadRows.map((doc) => (
                      <tr key={doc.id} className="border-t border-white/10 hover:bg-amber-500/5">
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg border border-white/10 bg-black/30 flex items-center justify-center text-[10px] font-bold text-amber-300 uppercase">
                              {doc.extension === "other" ? "FILE" : doc.extension}
                            </div>
                            <div>
                              <p className="text-sm text-white font-medium">{doc.title}</p>
                              <p className="text-xs text-slate-500">{doc.domainLabel}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-4 text-sm text-slate-300">{formatDate(doc.createdAt)}</td>
                        <td className="px-8 py-4 text-sm text-slate-400">{formatBytes(doc.approxBytes)}</td>
                        <td className="px-8 py-4">
                          {doc.status === "trained" ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 size={12} /> Fully Trained
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">
                              <AlertCircle size={12} /> Failed
                            </span>
                          )}
                        </td>
                        <td className="px-8 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => void openSourceDoc(doc)}
                              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
                              title="View"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => downloadDoc(doc)}
                              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
                              title="Download"
                            >
                              <Download size={16} />
                            </button>
                            <button
                              onClick={() => indexDocumentForRag(doc)}
                              disabled={Boolean(ragIndexingIds[doc.id])}
                              className="p-2 rounded-lg text-slate-300 hover:text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-50"
                              title="Index for RAG"
                            >
                              {ragIndexingIds[doc.id] ? <Loader2 size={16} className="animate-spin" /> : <Cpu size={16} />}
                            </button>
                            <button
                              onClick={() => deleteMutation.mutate(doc.id)}
                              disabled={deleteMutation.isPending}
                              className="p-2 rounded-lg text-slate-300 hover:text-red-300 hover:bg-red-500/15 disabled:opacity-60"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!isLoading && uploadRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-8 py-10 text-center text-slate-500">
                          No documents match your current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-5 py-3 border-t border-amber-500/15 flex items-center justify-between text-sm text-slate-500">
                <span>
                  Showing {uploadRows.length === 0 ? 0 : (uploadPage - 1) * uploadPageSize + 1}-
                  {Math.min(uploadPage * uploadPageSize, filteredUploads.length)} of {filteredUploads.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUploadPage((p) => Math.max(1, p - 1))}
                    disabled={uploadPage <= 1}
                    className="p-2 rounded-lg border border-white/10 disabled:opacity-40"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="px-3 py-1 rounded-lg bg-amber-500 text-[#2b1b06] font-bold">{uploadPage}</span>
                  <button
                    onClick={() => setUploadPage((p) => Math.min(uploadPageCount, p + 1))}
                    disabled={uploadPage >= uploadPageCount}
                    className="p-2 rounded-lg border border-white/10 disabled:opacity-40"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === "results" && (
          <div className="h-full px-4 md:px-6 lg:px-8 py-4 md:py-5 flex flex-col gap-4">
            <div className="rounded-3xl border border-amber-500/25 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(245,158,11,0.14),rgba(15,23,42,0.82)_46%,rgba(2,6,23,0.95)_100%)] p-4 md:p-5 shadow-[0_24px_42px_-32px_rgba(2,6,23,1)]">
              <div className="flex flex-col xl:flex-row xl:items-center gap-4 justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] font-black text-amber-200/75 mb-2">Knowledge Vault Search</p>
                  <h2 className="text-2xl md:text-4xl text-white font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>Results from Your Private Files</h2>
                  <p className="text-sm text-slate-300 mt-2">Fast semantic retrieval with citation-ready snippets.</p>
                </div>
                <div className="text-sm text-slate-300">
                  Found <strong className="text-white">{results.length}</strong> result{results.length !== 1 ? "s" : ""}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-amber-300/25 bg-[#0b1222]/70 p-2.5 backdrop-blur-md">
                <div className="flex items-center gap-2 rounded-xl bg-black/25 border border-white/5">
                  <Search size={17} className="text-amber-400 ml-4" />
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearch();
                    }}
                    className="w-full bg-transparent py-2.5 text-white placeholder:text-slate-500 outline-none"
                  />
                  <button onClick={() => handleSearch()} className="mr-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-300 to-amber-400 text-[#2b1b06] font-black text-sm">
                    Search
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 grid lg:grid-cols-12 gap-4">
              <aside className="lg:col-span-3 rounded-2xl border border-amber-500/20 bg-black/20 p-4 overflow-y-auto">
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                  <h3 className="text-lg font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>Filters</h3>
                  <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-amber-300">Clear All</button>
                </div>

                <div className="mt-4">
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">Legal Domain</p>
                  <div className="space-y-2 text-sm">
                    {domainCounts.map((item) => (
                      <label key={item.key} className="flex items-center gap-2 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={domainFilters[item.key] ?? true}
                          onChange={(e) => {
                            setDomainFilters((prev) => ({ ...prev, [item.key]: e.target.checked }));
                            setResultPage(1);
                          }}
                          className="rounded border-slate-600 bg-transparent text-amber-500 focus:ring-amber-500/40"
                        />
                        {item.label} ({item.count})
                      </label>
                    ))}
                    {domainCounts.length === 0 && <p className="text-xs text-slate-500">Upload documents to enable domain filters.</p>}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">Date Range</p>
                  <div className="space-y-2 text-sm text-slate-300">
                    {([
                      { key: "any", label: "Any time" },
                      { key: "year", label: "Past Year" },
                      { key: "month", label: "Past Month" },
                    ] as Array<{ key: DateFilter; label: string }>).map((item) => (
                      <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="date-filter"
                          checked={dateFilter === item.key}
                          onChange={() => {
                            setDateFilter(item.key);
                            setResultPage(1);
                          }}
                          className="border-slate-600 bg-transparent text-amber-500 focus:ring-amber-500/40"
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">Jurisdiction</p>
                  <select
                    value={jurisdictionFilter}
                    onChange={(e) => {
                      setJurisdictionFilter(e.target.value as JurisdictionFilter);
                      setResultPage(1);
                    }}
                    className="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="all">All Jurisdictions</option>
                    <option value="supreme-court">Supreme Court</option>
                    <option value="high-court">High Court</option>
                    <option value="district-court">District Court</option>
                  </select>
                </div>

                <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-slate-300">
                  <p className="text-amber-300 font-bold mb-1">Search Tip</p>
                  Use focused legal phrases for better ranking across your private documents.
                </div>
              </aside>

              <section className="lg:col-span-9 rounded-2xl border border-amber-500/20 bg-black/20 p-3 md:p-4 min-h-0 overflow-y-auto space-y-3">
                {resultRows.map(({ doc, score, snippet }) => (
                  <article key={doc.id} className="rounded-2xl border border-amber-500/20 bg-black/20 p-4 hover:border-amber-400/30 transition">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="px-2 py-0.5 rounded border border-white/15 bg-black/30 uppercase">{doc.extension}</span>
                        <span>Uploaded on {formatDate(doc.createdAt)}</span>
                      </div>
                      <button
                        onClick={() => citeResult(doc, snippet)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-[#291904] text-xs font-bold hover:bg-amber-400"
                      >
                        Cite in Chat
                      </button>
                    </div>

                    <h3 className="mt-2 text-xl text-white font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
                      {doc.title}
                    </h3>

                    <p className="mt-2 text-sm text-slate-300 leading-relaxed border-l-2 border-amber-500/60 pl-3">
                      {highlightText(snippet, activeQuery)}
                    </p>

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>/{doc.domainLabel.replace(/\s+/g, "-")}/{new Date(doc.createdAt).getFullYear()}</span>
                      <span className="text-emerald-400">{Math.min(99, 60 + score * 4)}% Match</span>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => void openSourceDoc(doc)}
                        className="px-3 py-1.5 rounded-lg border border-white/15 text-sm text-slate-200 hover:bg-white/10"
                      >
                        Open Source
                      </button>
                      <button
                        onClick={() => indexDocumentForRag(doc)}
                        disabled={Boolean(ragIndexingIds[doc.id])}
                        className="px-3 py-1.5 rounded-lg border border-emerald-500/30 text-sm text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                      >
                        {ragIndexingIds[doc.id] ? "Indexing..." : "Index for RAG"}
                      </button>
                      <button
                        onClick={() => downloadDoc(doc)}
                        className="px-3 py-1.5 rounded-lg border border-white/15 text-sm text-slate-200 hover:bg-white/10"
                      >
                        Download
                      </button>
                      <span className="ml-auto text-xs text-slate-500">{labelForJurisdiction(doc.jurisdiction)}</span>
                    </div>
                  </article>
                ))}

                {!isLoading && resultRows.length === 0 && (
                  <div className="rounded-2xl border border-amber-500/20 bg-black/20 p-8 text-center">
                    <p className="text-lg text-white font-semibold">No matching documents found.</p>
                    <p className="text-sm text-slate-500 mt-2">Try a broader query or clear filters.</p>
                  </div>
                )}

                {results.length > 0 && (
                  <div className="flex justify-center gap-2 pt-2">
                    <button
                      onClick={() => setResultPage((p) => Math.max(1, p - 1))}
                      disabled={resultPage <= 1}
                      className="p-2 rounded-lg border border-white/15 disabled:opacity-40"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <span className="px-3 py-1.5 rounded-lg bg-amber-500 text-[#281806] font-bold">{resultPage}</span>
                    <button
                      onClick={() => setResultPage((p) => Math.min(resultPageCount, p + 1))}
                      disabled={resultPage >= resultPageCount}
                      className="p-2 rounded-lg border border-white/15 disabled:opacity-40"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>

      {previewDoc && (
        <DocumentViewer
          title={previewDoc.title}
          filename={previewDoc.title}
          content={previewDoc.content || ""}
          sourceLabel="Knowledge Vault"
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {deleteMutation.isPending && (
        <div className="fixed bottom-6 right-6 z-[130] flex items-center gap-2 rounded-xl border border-amber-500/30 bg-[#2b2113] px-4 py-3 text-amber-300 text-sm shadow-xl">
          <Loader2 size={15} className="animate-spin" />
          Deleting document...
        </div>
      )}
    </div>
  );
}
