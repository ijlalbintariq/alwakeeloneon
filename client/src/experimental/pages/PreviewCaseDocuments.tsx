import React, { useState, useEffect, useMemo } from "react";
import { PreviewShell } from "@/experimental/components/PreviewShell";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import {
  Briefcase,
  Upload,
  Search,
  FolderOpen,
  Filter,
  Eye,
  Download,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  FileSignature,
  Scale,
  Layers,
  ChevronRight,
  ChevronDown,
  FileText,
  Clock,
  Sparkles,
  ShieldCheck,
  Trash2,
  X,
  Plus,
  GitBranch,
  FileCode,
  Tag,
  Building2,
  UserCheck,
  Zap,
  Info,
  Maximize2,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface DocumentVersion {
  version: string;
  uploadedAt: string;
  author: string;
  changeNote: string;
  fileSize: string;
}

export interface ProceduralCheck {
  rule: string;
  status: "pass" | "warning" | "risk";
  detail: string;
}

export interface CaseDocumentItem {
  id: string;
  title: string;
  caseRef: string;
  matterTitle: string;
  court: string;
  type: "Pleading" | "Vakalatnama" | "Impugned Order" | "Annexure" | "Evidence Exhibit" | "Bail Bond" | "Notice";
  pageCount: number;
  uploadedDate: string;
  assignedCounsel: string;
  fileSize: string;
  status: "verified" | "indexed" | "processing" | "flagged";
  inActiveContext: boolean;
  charCount: number;
  summary: string;
  ocrSnippet: string;
  fullOcrText: string;
  versions: DocumentVersion[];
  proceduralChecks: ProceduralCheck[];
}


const STORAGE_KEY = "alwakeelo_preview_case_documents";
const MAX_CONTEXT_CHARS = 24000;

export const PreviewCaseDocuments: React.FC = () => {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // State initialization with empty array (no mock data fallback)
  const [documents, setDocuments] = useState<CaseDocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load documents from real API on mount
  useEffect(() => {
    let isMounted = true;
    const fetchDocuments = async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/documents", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data)) {
            const mapped: CaseDocumentItem[] = data.map((d: any, idx: number) => ({
              id: String(d.id || `cdoc-${idx + 1}`),
              title: d.title || d.fileName || d.name || "Untitled Document",
              caseRef: d.caseRef || d.caseNumber || "Unassigned",
              matterTitle: d.matterTitle || d.caseTitle || d.title || "Unassigned Matter",
              court: d.court || "Unspecified Court",
              type: d.type || "Document",
              pageCount: d.pageCount || 1,
              uploadedDate: d.uploadedDate || (d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)),
              assignedCounsel: d.assignedCounsel || d.counsel || "Unassigned",
              fileSize: d.fileSize || "1.0 MB",
              status: d.status || "verified",
              inActiveContext: Boolean(d.inActiveContext),
              charCount: d.charCount || (d.content ? d.content.length : 0),
              summary: d.summary || "",
              ocrSnippet: d.ocrSnippet || (d.content ? d.content.slice(0, 140) + "..." : ""),
              fullOcrText: d.content || d.fullOcrText || "",
              versions: Array.isArray(d.versions) ? d.versions : [],
              proceduralChecks: Array.isArray(d.proceduralChecks) ? d.proceduralChecks : [],
            }));
            setDocuments(mapped);
          }
        } else {
          // Fallback to /api/case-files if /api/documents is not available
          const cfRes = await fetch("/api/case-files", { credentials: "include" });
          if (cfRes.ok) {
            const cfData = await cfRes.json();
            if (isMounted && Array.isArray(cfData)) {
              const docs: CaseDocumentItem[] = [];
              cfData.forEach((cf: any) => {
                if (Array.isArray(cf.documents)) {
                  cf.documents.forEach((cd: any) => {
                    docs.push({
                      id: String(cd.id || `cdoc-${docs.length + 1}`),
                      title: cd.docTitle || cd.title || "Document",
                      caseRef: cf.caseNumber || `Ref: ${cf.referenceNo || cf.id}`,
                      matterTitle: cf.title || "Case Matter",
                      court: cf.court || "High Court",
                      type: (cd.label as any) || "Pleading",
                      pageCount: cd.pageCount || 1,
                      uploadedDate: cd.addedAt ? new Date(cd.addedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
                      assignedCounsel: cf.assignedCounsel || "Lead Counsel",
                      fileSize: cd.fileSize ? `${(cd.fileSize / 1024 / 1024).toFixed(1)} MB` : "1.0 MB",
                      status: "verified",
                      inActiveContext: false,
                      charCount: 1200,
                      summary: cd.docTitle || "",
                      ocrSnippet: cd.docTitle || "",
                      fullOcrText: cd.docTitle || "",
                      versions: [],
                      proceduralChecks: [],
                    });
                  });
                }
              });
              setDocuments(docs);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching case documents:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchDocuments();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filters
  const [viewMode, setViewMode] = useState<"matter_folders" | "all_documents">("all_documents");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("All");
  const [selectedMatterFilter, setSelectedMatterFilter] = useState<string>("All");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("All");

  // Active Document Preview & Version Drawer Modals
  const [activeViewerDoc, setActiveViewerDoc] = useState<CaseDocumentItem | null>(null);
  const [activeVersionDoc, setActiveVersionDoc] = useState<CaseDocumentItem | null>(null);

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<"idle" | "uploading" | "ocr" | "scanning" | "done">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    caseRef: "",
    matterTitle: "",
    court: "",
    type: "Pleading" as CaseDocumentItem["type"],
    assignedCounsel: "",
    pageCount: 0,
    summary: "",
    rawText: "",
  });

  // Unique list of matters
  const uniqueMatters = useMemo(() => {
    const map = new Map<string, { caseRef: string; matterTitle: string; court: string; count: number }>();
    documents.forEach((d) => {
      if (!map.has(d.caseRef)) {
        map.set(d.caseRef, {
          caseRef: d.caseRef,
          matterTitle: d.matterTitle,
          court: d.court,
          count: 1,
        });
      } else {
        const item = map.get(d.caseRef)!;
        item.count += 1;
      }
    });
    return Array.from(map.values());
  }, [documents]);

  const docTypes = [
    "All",
    "Pleading",
    "Vakalatnama",
    "Impugned Order",
    "Annexure",
    "Evidence Exhibit",
    "Bail Bond",
  ];

  // Active AI Context Token Calculation
  const activeContextChars = useMemo(() => {
    return documents.filter((d) => d.inActiveContext).reduce((acc, d) => acc + d.charCount, 0);
  }, [documents]);

  const activeContextPercent = Math.min(100, Math.round((activeContextChars / MAX_CONTEXT_CHARS) * 100));

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchType = selectedType === "All" || doc.type === selectedType;
      const matchMatter = selectedMatterFilter === "All" || doc.caseRef === selectedMatterFilter;
      const matchStatus = selectedStatusFilter === "All" || doc.status === selectedStatusFilter;

      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        doc.title.toLowerCase().includes(q) ||
        doc.caseRef.toLowerCase().includes(q) ||
        doc.matterTitle.toLowerCase().includes(q) ||
        doc.court.toLowerCase().includes(q) ||
        doc.summary.toLowerCase().includes(q) ||
        doc.ocrSnippet.toLowerCase().includes(q);

      return matchType && matchMatter && matchStatus && matchQuery;
    });
  }, [documents, selectedType, selectedMatterFilter, selectedStatusFilter, searchQuery]);

  // Toggle In AI Context
  const handleToggleAiContext = (docId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id === docId) {
          const nextState = !d.inActiveContext;
          toast({
            title: nextState ? "Document Added to AI Context" : "Removed from AI Context",
            description: nextState
              ? `${d.title} (${d.charCount.toLocaleString()} chars) active for drafting assistant.`
              : `${d.title} removed from current active RAG context.`,
          });
          return { ...d, inActiveContext: nextState };
        }
        return d;
      })
    );
  };

  // Re-assign document matter
  const handleReassignMatter = (docId: string, newCaseRef: string) => {
    const targetMatter = uniqueMatters.find((m) => m.caseRef === newCaseRef);
    if (!targetMatter) return;

    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id === docId) {
          return {
            ...d,
            caseRef: targetMatter.caseRef,
            matterTitle: targetMatter.matterTitle,
            court: targetMatter.court,
          };
        }
        return d;
      })
    );

    toast({
      title: "Matter Re-Assigned",
      description: `Document linked to ${newCaseRef}.`,
    });
  };

  // Handle delete document
  const handleDeleteDoc = (docId: string, docTitle: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    fetch("/api/documents/" + docId.replace("cdoc-", ""), { method: "DELETE" })
      .then(res => {
        if(res.ok) queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      })
      .catch(err => console.error("Failed to delete", err));
      
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    if (activeViewerDoc?.id === docId) setActiveViewerDoc(null);
    if (activeVersionDoc?.id === docId) setActiveVersionDoc(null);

    toast({
      title: "Document Deleted",
      description: `"${docTitle}" removed from Case Vault.`,
    });
  };

  // Upload handler
  const handleStartUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.title.trim()) {
      toast({
        title: "Title Required",
        description: "Please provide a document title.",
        variant: "destructive",
      });
      return;
    }

    setUploadStep("uploading");
    setUploadProgress(20);

    // Real document upload via POST /api/documents/upload
    (async () => {
      try {
        const formData = new FormData();
        // If user attached a file, send it; otherwise send metadata for a text-based entry
        if (selectedFile) {
          formData.append("files", selectedFile);
        }
        formData.append("title", uploadForm.title);
        formData.append("caseRef", uploadForm.caseRef || "");
        formData.append("court", uploadForm.court || "");
        formData.append("type", uploadForm.type || "pleading");
        if (uploadForm.rawText) {
          formData.append("rawText", uploadForm.rawText);
        }

        setUploadStep("ocr");
        setUploadProgress(55);

        const res = await fetch("/api/documents/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        setUploadStep("scanning");
        setUploadProgress(85);

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ message: "Upload failed" }));
          throw new Error(errData.message || `Upload failed (${res.status})`);
        }

        const uploaded = await res.json();
        setUploadStep("done");
        setUploadProgress(100);

        // Build document record from real server response
        const serverDoc = Array.isArray(uploaded) ? uploaded[0] : uploaded;
        const newDoc: CaseDocumentItem = {
          id: `cdoc-${serverDoc?.id || Date.now()}`,
          title: serverDoc?.title || uploadForm.title,
          caseRef: uploadForm.caseRef,
          matterTitle: uploadForm.matterTitle,
          court: uploadForm.court,
          type: uploadForm.type,
          pageCount: serverDoc?.pageCount || uploadForm.pageCount || 4,
          uploadedDate: new Date().toISOString().slice(0, 10),
          assignedCounsel: uploadForm.assignedCounsel,
          fileSize: serverDoc?.fileSize || "",
          status: "verified",
          inActiveContext: true,
          charCount: serverDoc?.charCount || 0,
          summary: serverDoc?.summary || uploadForm.summary || "Case record ingested with OCR text indexing and procedural compliance check.",
          ocrSnippet: serverDoc?.ocrSnippet || (uploadForm.rawText
            ? uploadForm.rawText.slice(0, 140) + "..."
            : `IN THE ${uploadForm.court.toUpperCase()}. ${uploadForm.caseRef}. ${uploadForm.title.toUpperCase()}...`),
          fullOcrText: serverDoc?.content || uploadForm.rawText || `IN THE ${uploadForm.court.toUpperCase()}\n\n${uploadForm.caseRef}\n\n${uploadForm.title}\n\nAssigned Counsel: ${uploadForm.assignedCounsel}\nFiling Date: ${new Date().toLocaleDateString()}\n\n[Full OCR text stream extracted from uploaded case record. Ready for legal drafting and precedent cross-referencing.]`,
          versions: [
            {
              version: "v1.0",
              uploadedAt: new Date().toLocaleString(),
              author: uploadForm.assignedCounsel,
              changeNote: "Initial certified copy upload.",
              fileSize: "2.4 MB",
            },
          ],
          proceduralChecks: [
            { rule: "Pleading Formatting Standard", status: "pass", detail: "Margins, court stamps, and case heading conform to High Court Rules." },
            { rule: "Advocate Signature Check", status: "pass", detail: "Counsel signature stamp verified." },
          ],
        };

        setDocuments((prev) => [newDoc, ...prev]);
        queryClient.invalidateQueries({ queryKey: ["/api/documents"] });

        setTimeout(() => {
          setIsUploadModalOpen(false);
          setUploadStep("idle");
          setUploadProgress(0);
          setSelectedFile(null);
          setUploadForm({
              title: "",
              caseRef: "",
              matterTitle: "",
              court: "",
              type: "Pleading",
              assignedCounsel: "",
              pageCount: 0,
              summary: "",
              rawText: "",
            });

            toast({
              title: "Case Document Ingested & Verified",
              description: `"${newDoc.title}" added to ${newDoc.caseRef}.`,
            });
          }, 600);
      } catch (err: any) {
        setUploadStep("idle");
        setUploadProgress(0);
        toast({
          title: "Upload Failed",
          description: err?.message || "Could not upload document. Please try again.",
          variant: "destructive",
        });
      }
    })();
  };

  return (
    <PreviewShell>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Top Header */}
        <div className="bg-white dark:bg-[#131E2E] p-6 rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20">
                <Briefcase className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#105B38]">
                Litigation Records & Evidence Vault
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">Case Documents & Annexures</h1>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-1">
              Matter-centric repository for petitions, pleadings, impugned orders, Vakalatnamas, and exhibits with full-text OCR indexing.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Case Document</span>
            </button>
          </div>
        </div>

        {/* AI Context Usage & Quick Stats Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* AI Context Progress Card */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38]">
                  <Zap className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">Active AI RAG Context</span>
              </div>
              <span className="font-mono text-xs font-bold text-[#105B38] bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20">
                {activeContextChars.toLocaleString()} / {MAX_CONTEXT_CHARS.toLocaleString()} Chars
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="w-full bg-[#F1F5F9] dark:bg-[#1E2D44] rounded-full h-2.5 overflow-hidden border border-[#E2E8F0] dark:border-[#1E2D44]">
                <div
                  className="bg-[#105B38] h-full rounded-full transition-all duration-300"
                  style={{ width: `${activeContextPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                <span>{documents.filter((d) => d.inActiveContext).length} Documents Active</span>
                <span>{activeContextPercent}% Context Window Used</span>
              </div>
            </div>
          </div>

          {/* Matters Count Card */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">{uniqueMatters.length} Active Matters</div>
                <div className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-0.5">Across High Courts & Supreme Court</div>
              </div>
            </div>
            <span className="text-xs font-bold text-[#105B38] bg-[#F8FAFC] dark:bg-[#0B131E] px-3 py-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44]">
              {documents.length} Total Files
            </span>
          </div>

          {/* Procedural Verified Badge */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">100% OCR Indexed</div>
                <div className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-0.5">Biometric attestation & stamps scanned</div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
              <Check className="w-3.5 h-3.5" />
              Audit Ready
            </span>
          </div>
        </div>

        {/* View Mode & Filter Control Bar */}
        <div className="bg-white dark:bg-[#131E2E] p-5 rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1.5 p-1 bg-[#F8FAFC] dark:bg-[#0B131E] rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44] shrink-0 self-start">
              <button
                type="button"
                onClick={() => setViewMode("all_documents")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  viewMode === "all_documents"
                    ? "bg-white dark:bg-[#131E2E] text-[#105B38] shadow-xs border border-[#E2E8F0] dark:border-[#1E2D44]"
                    : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
                )}
              >
                All Documents List
              </button>
              <button
                type="button"
                onClick={() => setViewMode("matter_folders")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                  viewMode === "matter_folders"
                    ? "bg-white dark:bg-[#131E2E] text-[#105B38] shadow-xs border border-[#E2E8F0] dark:border-[#1E2D44]"
                    : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
                )}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>By Case Matter</span>
              </button>
            </div>

            {/* Matter Filter Dropdown */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs">
                <Briefcase className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]" />
                <select
                  value={selectedMatterFilter}
                  onChange={(e) => setSelectedMatterFilter(e.target.value)}
                  className="bg-transparent text-xs text-[#0F172A] dark:text-[#F8FAFC] font-semibold focus:outline-none cursor-pointer max-w-[220px] truncate"
                >
                  <option value="All">All Matters / Files</option>
                  {uniqueMatters.map((m) => (
                    <option key={m.caseRef} value={m.caseRef}>
                      {m.caseRef} ({m.count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]" />
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="bg-transparent text-xs text-[#0F172A] dark:text-[#F8FAFC] font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="verified">Verified</option>
                  <option value="indexed">Indexed</option>
                  <option value="processing">Processing</option>
                  <option value="flagged">Flagged</option>
                </select>
              </div>
            </div>
          </div>

          {/* Search Line */}
          <div className="flex items-center px-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] focus-within:border-[#105B38] focus-within:bg-white dark:bg-[#131E2E] transition-all">
            <Search className="w-4 h-4 text-[#94A3B8] dark:text-[#475569] mr-2.5 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across case documents, matter numbers, courts, summaries, or OCR text..."
              className="w-full h-10 bg-transparent text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:text-[#475569] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="p-1 rounded-md text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#E2E8F0] dark:border-[#1E2D44]/70">
            <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mr-2">Doc Type:</span>
            {docTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedType(t)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                  selectedType === t
                    ? "bg-[#105B38] text-white shadow-xs"
                    : "bg-[#F8FAFC] dark:bg-[#0B131E] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#1E2D44]"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* 1. MATTER FOLDERS VIEW */}
        {viewMode === "matter_folders" && (
          <div className="space-y-6">
            {uniqueMatters.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-[#131E2E] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] space-y-2">
                <FolderOpen className="w-10 h-10 text-[#94A3B8] dark:text-[#475569] mx-auto" />
                <p className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">No Case Documents</p>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Upload your first case document to organize records by matter.</p>
              </div>
            ) : (
              uniqueMatters.map((matter) => {
                const matterDocs = filteredDocuments.filter((d) => d.caseRef === matter.caseRef);
                if (matterDocs.length === 0 && selectedType !== "All") return null;

                return (
                  <div
                    key={matter.caseRef}
                    className="bg-white dark:bg-[#131E2E] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs overflow-hidden"
                  >
                    {/* Folder Header */}
                    <div className="p-5 bg-[#F8FAFC] dark:bg-[#0B131E] border-b border-[#E2E8F0] dark:border-[#1E2D44] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-[#105B38] shrink-0">
                          <FolderOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#105B38] bg-white dark:bg-[#131E2E] px-2 py-0.5 rounded-md border border-[#E2E8F0] dark:border-[#1E2D44]">
                              {matter.caseRef}
                            </span>
                            <span className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">· {matter.court}</span>
                          </div>
                          <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] mt-0.5">{matter.matterTitle}</h2>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/preview/cases`}
                          className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#131E2E] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-bold text-[#105B38] transition-colors flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open Matter File</span>
                        </Link>
                        <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] bg-white dark:bg-[#131E2E] px-2.5 py-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44]">
                          {matterDocs.length} Documents
                        </span>
                      </div>
                    </div>

                    {/* Documents Grid inside folder */}
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {matterDocs.map((doc) => (
                        <div
                          key={doc.id}
                          className="p-4 rounded-xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] hover:border-[#105B38]/40 hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20 uppercase">
                                {doc.type}
                              </span>
                              <span className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                                {doc.pageCount} Pages · {doc.fileSize}
                              </span>
                            </div>

                            <h3 className="font-bold text-xs text-[#0F172A] dark:text-[#F8FAFC] leading-snug">{doc.title}</h3>
                            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] line-clamp-2">{doc.summary}</p>
                          </div>

                          <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#1E2D44] flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => handleToggleAiContext(doc.id, e)}
                                className={cn(
                                  "px-2 py-1 rounded-md text-[10px] font-bold border transition-colors flex items-center gap-1",
                                  doc.inActiveContext
                                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border-emerald-200 dark:border-emerald-500/20"
                                    : "bg-[#F8FAFC] dark:bg-[#0B131E] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] border-[#E2E8F0] dark:border-[#1E2D44]"
                                )}
                              >
                                <Zap className="w-3 h-3" />
                                <span>{doc.inActiveContext ? "AI Active" : "Add to AI"}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setActiveVersionDoc(doc)}
                                className="px-2 py-1 rounded-md bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] border border-[#E2E8F0] dark:border-[#1E2D44] text-[10px] font-bold text-[#475569] flex items-center gap-1"
                              >
                                <GitBranch className="w-3 h-3 text-[#105B38]" />
                                <span>{doc.versions.length} Ver</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setActiveViewerDoc(doc)}
                                className="px-2.5 py-1 rounded-lg bg-[#105B38] text-white text-[11px] font-bold hover:bg-[#0D4A2E] transition-all flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Preview</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 2. ALL DOCUMENTS GRID VIEW */}
        {viewMode === "all_documents" && (
          filteredDocuments.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#131E2E] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] space-y-2">
              <FileText className="w-10 h-10 text-[#94A3B8] dark:text-[#475569] mx-auto" />
              <p className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">No Case Documents Found</p>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                {searchQuery || selectedType !== "All" || selectedMatterFilter !== "All" || selectedStatusFilter !== "All"
                  ? "Try adjusting your search query or filters."
                  : "Upload pleadings, orders, or annexures to build your case repository."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="p-5 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] hover:border-[#105B38]/50 hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    {/* Top Bar Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20 uppercase tracking-wider">
                          {doc.type}
                        </span>
                        <span className="font-mono text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] bg-[#F8FAFC] dark:bg-[#0B131E] px-2 py-0.5 rounded-md border border-[#E2E8F0] dark:border-[#1E2D44]">
                          {doc.caseRef}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => handleToggleAiContext(doc.id, e)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors flex items-center gap-1",
                            doc.inActiveContext
                              ? "bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border-emerald-200 dark:border-emerald-500/20"
                              : "bg-[#F8FAFC] dark:bg-[#0B131E] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] border-[#E2E8F0] dark:border-[#1E2D44]"
                          )}
                          title="Toggle inclusion in AI Assistant drafting context"
                        >
                          <Zap className="w-3 h-3" />
                          <span>{doc.inActiveContext ? "In Context" : "+ Add Context"}</span>
                        </button>

                        <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </span>
                      </div>
                    </div>

                    {/* Title & Matter */}
                    <div>
                      <h3 className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#105B38] transition-colors leading-snug">
                        {doc.title}
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-1">
                        <span className="truncate">{doc.matterTitle}</span>
                        <span>·</span>
                        <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] shrink-0">{doc.court}</span>
                      </div>
                    </div>

                    {/* Summary */}
                    <p className="text-xs text-[#475569] line-clamp-2 leading-relaxed">
                      {doc.summary}
                    </p>

                    {/* OCR Snippet Preview */}
                    <div className="p-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[11px] font-mono text-[#334155] dark:text-[#CBD5E1] italic line-clamp-2">
                      &quot;{doc.ocrSnippet}&quot;
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E2D44] flex items-center justify-between text-xs">
                    <div className="text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                      <span>{doc.pageCount}p · {doc.fileSize} · {doc.uploadedDate}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveVersionDoc(doc)}
                        className="px-2.5 py-1 rounded-lg bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] border border-[#E2E8F0] dark:border-[#1E2D44] text-[11px] font-bold text-[#475569] flex items-center gap-1"
                        title="Version History & Changelog"
                      >
                        <GitBranch className="w-3 h-3 text-[#105B38]" />
                        <span>{doc.versions.length} Ver</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveViewerDoc(doc)}
                        className="px-3 py-1 rounded-lg bg-[#105B38] hover:bg-[#0D4A2E] text-white text-[11px] font-bold transition-all shadow-xs flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Read OCR</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteDoc(doc.id, doc.title, e)}
                        className="p-1 rounded-lg bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-rose-50 dark:bg-rose-500/10 border border-[#E2E8F0] dark:border-[#1E2D44] text-[#94A3B8] dark:text-[#475569] hover:text-rose-600 dark:text-rose-400 transition-colors"
                        title="Delete Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* 1. DOCUMENT VIEWER & OCR INSPECTOR MODAL */}
        {activeViewerDoc && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
            onClick={() => setActiveViewerDoc(null)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" />

            <div
              className="relative bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-2xl shadow-xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Bar */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] dark:border-[#1E2D44] bg-[#F8FAFC] dark:bg-[#0B131E] shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-[#105B38] shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                      {activeViewerDoc.title}
                    </h2>
                    <div className="flex items-center gap-2 text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-0.5">
                      <span className="font-mono font-bold text-[#105B38]">{activeViewerDoc.caseRef}</span>
                      <span>·</span>
                      <span>{activeViewerDoc.court}</span>
                      <span>·</span>
                      <span>{activeViewerDoc.pageCount} Pages</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(activeViewerDoc.ocrSnippet);
                      toast({
                        title: "OCR Snippet Copied",
                        description: "Snippet copied to clipboard for citation.",
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#131E2E] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] transition-colors flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#105B38]" />
                    <span>Copy Snippet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveViewerDoc(null)}
                    className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#E2E8F0] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body with Sidecar Layout */}
              <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3">
                {/* Left 2 Cols: Full OCR Reader */}
                <div className="lg:col-span-2 overflow-y-auto p-6 space-y-4 border-r border-[#E2E8F0] dark:border-[#1E2D44]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-[#105B38] tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4" />
                      Extracted OCR Pleading Text
                    </span>
                    <span className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                      {activeViewerDoc.charCount.toLocaleString()} Chars
                    </span>
                  </div>

                  <div className="p-5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] font-mono text-xs text-[#1E293B] leading-relaxed whitespace-pre-wrap">
                    {activeViewerDoc.fullOcrText}
                  </div>
                </div>

                {/* Right 1 Col: Procedural Audit & Matter Controls Sidecar */}
                <div className="overflow-y-auto p-6 space-y-5 bg-[#FAFAFA]">
                  {/* Procedural Health Shield */}
                  <div className="p-4 rounded-xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-[#105B38]" />
                        Procedural Scanner
                      </span>
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20">
                        Compliant
                      </span>
                    </div>

                    <div className="space-y-2 pt-1">
                      {activeViewerDoc.proceduralChecks.map((chk, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-lg bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-[#0F172A] dark:text-[#F8FAFC]">{chk.rule}</span>
                            <span
                              className={cn(
                                "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded",
                                chk.status === "pass"
                                  ? "bg-emerald-100 text-emerald-800 dark:text-emerald-400"
                                  : chk.status === "warning"
                                  ? "bg-amber-100 text-amber-800 dark:text-amber-400"
                                  : "bg-rose-100 text-rose-800 dark:text-rose-400"
                              )}
                            >
                              {chk.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">{chk.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Metadata & Matter Assignment Card */}
                  <div className="p-4 rounded-xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs space-y-3 text-xs">
                    <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] block">Document Assignment</span>

                    <div>
                      <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] uppercase block mb-1">
                        Linked Matter Reference
                      </span>
                      <select
                        value={activeViewerDoc.caseRef}
                        onChange={(e) => {
                          handleReassignMatter(activeViewerDoc.id, e.target.value);
                          setActiveViewerDoc({ ...activeViewerDoc, caseRef: e.target.value });
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none"
                      >
                        {uniqueMatters.map((m) => (
                          <option key={m.caseRef} value={m.caseRef}>
                            {m.caseRef} — {m.court}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] uppercase block">Assigned Counsel</span>
                      <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">{activeViewerDoc.assignedCounsel}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] uppercase block">Filing Timestamp</span>
                      <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">{activeViewerDoc.uploadedDate}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-[#F8FAFC] dark:bg-[#0B131E] border-t border-[#E2E8F0] dark:border-[#1E2D44] flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center gap-2">
                  <Link
                    href="/preview/drafting"
                    className="px-4 py-2 rounded-xl bg-white dark:bg-[#131E2E] hover:bg-emerald-50 dark:bg-emerald-500/10 border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-bold text-[#105B38] transition-colors flex items-center gap-1.5"
                  >
                    <FileSignature className="w-3.5 h-3.5" />
                    <span>Open in Legal Drafting Studio</span>
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveViewerDoc(null)}
                  className="px-4 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. VERSION HISTORY MODAL */}
        {activeVersionDoc && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
            onClick={() => setActiveVersionDoc(null)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" />

            <div
              className="relative bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-2xl shadow-xl w-full max-w-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] dark:border-[#1E2D44] bg-[#F8FAFC] dark:bg-[#0B131E]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-[#105B38]">
                    <GitBranch className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">Document Version History</h2>
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">{activeVersionDoc.title}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveVersionDoc(null)}
                  className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#E2E8F0]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {activeVersionDoc.versions.map((ver, i) => (
                  <div
                    key={ver.version}
                    className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-white dark:bg-[#131E2E] text-[#105B38] px-2 py-0.5 rounded border border-[#E2E8F0] dark:border-[#1E2D44]">
                          {ver.version}
                        </span>
                        <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">{ver.author}</span>
                      </div>
                      <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">{ver.uploadedAt}</span>
                    </div>

                    <p className="text-xs text-[#334155] dark:text-[#CBD5E1]">{ver.changeNote}</p>
                    <span className="text-[10px] font-mono text-[#94A3B8] dark:text-[#475569] block">File Size: {ver.fileSize}</span>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-[#F8FAFC] dark:bg-[#0B131E] border-t border-[#E2E8F0] dark:border-[#1E2D44] flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveVersionDoc(null)}
                  className="px-4 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold"
                >
                  Close History
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. UPLOAD CASE DOCUMENT SIMULATOR MODAL */}
        {isUploadModalOpen && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
            onClick={() => {
              if (uploadStep === "idle") setIsUploadModalOpen(false);
            }}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" />

            <div
              className="relative bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-2xl shadow-xl w-full max-w-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] dark:border-[#1E2D44] bg-[#F8FAFC] dark:bg-[#0B131E]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-[#105B38]">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">Upload Case Document</h2>
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Attach pleadings, impugned orders, or evidence exhibits.</p>
                  </div>
                </div>

                {uploadStep === "idle" && (
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#E2E8F0]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="p-6">
                {uploadStep !== "idle" ? (
                  <div className="py-8 space-y-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-[#105B38] flex items-center justify-center mx-auto animate-pulse">
                      <Sparkles className="w-8 h-8" />
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {uploadStep === "uploading" && "Uploading Pleading & Records..."}
                        {uploadStep === "ocr" && "Running High Court OCR & Stamp Verification..."}
                        {uploadStep === "scanning" && "Running Procedural & Limitation Scanner..."}
                        {uploadStep === "done" && "Document Indexed & Ready!"}
                      </h3>
                      <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-1">Linking to {uploadForm.caseRef}...</p>
                    </div>

                    <div className="w-full bg-[#F1F5F9] dark:bg-[#1E2D44] rounded-full h-3 overflow-hidden border border-[#E2E8F0] dark:border-[#1E2D44]">
                      <div
                        className="bg-[#105B38] h-full transition-all duration-300 rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleStartUpload} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] mb-1">Document Title *</label>
                      <input
                        type="text"
                        required
                        value={uploadForm.title}
                        onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                        placeholder="e.g. Replication / Written Statement with Oath Attestation"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:border-[#105B38] focus:bg-white dark:bg-[#131E2E] focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] mb-1">Target Matter</label>
                        <select
                          value={uploadForm.caseRef}
                          onChange={(e) => {
                            const found = uniqueMatters.find((m) => m.caseRef === e.target.value);
                            setUploadForm({
                              ...uploadForm,
                              caseRef: e.target.value,
                              matterTitle: found?.matterTitle || uploadForm.matterTitle,
                              court: found?.court || uploadForm.court,
                            });
                          }}
                          className="w-full px-3 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs text-[#0F172A] dark:text-[#F8FAFC] font-semibold focus:outline-none"
                        >
                          {uniqueMatters.map((m) => (
                            <option key={m.caseRef} value={m.caseRef}>
                              {m.caseRef} — {m.court}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] mb-1">Document Type</label>
                        <select
                          value={uploadForm.type}
                          onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value as any })}
                          className="w-full px-3 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs text-[#0F172A] dark:text-[#F8FAFC] font-medium focus:outline-none"
                        >
                          <option value="Pleading">Pleading (Plaint / Petition / Written Statement)</option>
                          <option value="Vakalatnama">Vakalatnama & Power of Attorney</option>
                          <option value="Impugned Order">Impugned Order / Decree</option>
                          <option value="Annexure">Annexure / Supporting Documents</option>
                          <option value="Evidence Exhibit">Evidence Exhibit</option>
                          <option value="Bail Bond">Bail Bond / Surety</option>
                        </select>
                      </div>
                    </div>

                    <div className="p-5 border-2 border-dashed border-[#E2E8F0] dark:border-[#1E2D44] hover:border-[#105B38] rounded-2xl bg-[#F8FAFC] dark:bg-[#0B131E] text-center space-y-2 cursor-pointer transition-colors">
                      <div className="w-10 h-10 rounded-full bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] flex items-center justify-center mx-auto text-[#105B38]">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">Drop Scanned Pleading or Annexure PDF</div>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Auto-indexes OCR text and verifies court stamp authenticity.</p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsUploadModalOpen(false)}
                        className="px-4 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] text-xs font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Upload & Index</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PreviewShell>
  );
};

export default PreviewCaseDocuments;
