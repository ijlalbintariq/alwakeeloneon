import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PreviewShell } from "@/experimental/components/PreviewShell";
import {
  Briefcase,
  ShieldCheck,
  Plus,
  Search,
  FileText,
  Users,
  CalendarDays,
  StickyNote,
  Scale,
  Gavel,
  Trash2,
  Loader2,
  AlertTriangle,
  ChevronRight,
  Filter,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  MapPin,
  Clock,
  Check,
  Copy,
  Upload,
  Eye,
  Layers,
  FolderOpen,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SixPillarChecklist } from "@/experimental/components/cases/SixPillarChecklist";
import { PartiesManager } from "@/experimental/components/cases/PartiesManager";
import { DocumentsVault } from "@/experimental/components/cases/DocumentsVault";
import { HearingsScheduler } from "@/experimental/components/cases/HearingsScheduler";
import { CaseNotesManager } from "@/experimental/components/cases/CaseNotesManager";
import { CreateCaseModal } from "@/experimental/components/cases/CreateCaseModal";

export interface CaseFileListItem {
  id: number;
  title: string;
  caseType: string;
  court?: string | null;
  caseNumber?: string | null;
  referenceNo?: string | null;
  status: "active" | "pending" | "closed" | "archived";
  priority: "low" | "normal" | "high" | "urgent";
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  clientCount?: number;
  documentCount?: number;
  complianceCount?: number;
  primaryClient?: string | null;
  nextHearing?: { title: string; dueDate: string } | null;
}

export interface CaseFileFullDetail extends CaseFileListItem {
  clients?: any[];
  documents?: any[];
  compliance?: any[];
  notes?: any[];
}



const CATEGORY_TABS = [
  { id: "all", label: "All Matters" },
  { id: "constitutional", label: "Constitutional" },
  { id: "criminal", label: "Criminal" },
  { id: "civil", label: "Civil" },
  { id: "corporate", label: "Corporate" },
  { id: "tax", label: "Tax & Customs" },
  { id: "banking", label: "Banking" },
  { id: "family", label: "Family" },
  { id: "property", label: "Property" },
  { id: "other", label: "Other" },
];

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  active: { label: "Active", badge: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" },
  pending: { label: "Pending", badge: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20" },
  closed: { label: "Disposed / Closed", badge: "bg-[#F8FAFC] dark:bg-[#0B131E] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] border-[#E2E8F0] dark:border-[#1E2D44]" },
  archived: { label: "Archived", badge: "bg-[#F8FAFC] dark:bg-[#0B131E] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] border-[#E2E8F0] dark:border-[#1E2D44]" },
};

// Cohesive badge design system: soft background + visible border + high-contrast text
const PRIORITY_BADGES: Record<string, string> = {
  urgent: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20",
  high: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
  normal: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
  low: "bg-[#F8FAFC] dark:bg-[#0B131E] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] border-[#E2E8F0] dark:border-[#1E2D44]",
};

interface PreviewCaseFilesProps {
  initialTab?: "dossiers" | "compliance" | "documents" | "parties" | "hearings" | "notes";
}

export const PreviewCaseFiles: React.FC<PreviewCaseFilesProps> = ({ initialTab = "dossiers" }) => {
  const { toast } = useToast();
  const [workstationMode, setWorkstationMode] = useState<"dossiers" | "all_documents" | "all_compliance">("dossiers");
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [caseActiveTab, setCaseActiveTab] = useState<
    "compliance" | "documents" | "parties" | "hearings" | "notes"
  >("compliance");

  // 1. Fetch Case Files List (direct API without mock fallback)
  const { data: dbCases, isLoading: isListLoading } = useQuery<CaseFileListItem[]>({
    queryKey: ["/api/case-files"],
    queryFn: async () => {
      const res = await fetch("/api/case-files", {
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const errorMsg = errorData?.message || `Request failed with status ${res.status}`;
        const err = new Error(errorMsg) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      return await res.json();
    },
    retry: (failureCount, error: any) => {
      if (error?.status && [401, 403, 404].includes(error.status)) return false;
      return failureCount < 2;
    },
  });

  const cases: CaseFileFullDetail[] = useMemo(() => {
    if (Array.isArray(dbCases)) {
      return dbCases as CaseFileFullDetail[];
    }
    return [];
  }, [dbCases]);

  // Sync with URL query param ?tab=documents
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam === "documents") {
      setWorkstationMode("all_documents");
      setCaseActiveTab("documents");
    } else if (tabParam === "compliance") {
      setWorkstationMode("all_compliance");
      setCaseActiveTab("compliance");
    } else if (initialTab === "documents") {
      setWorkstationMode("all_documents");
      setCaseActiveTab("documents");
    } else if (initialTab === "compliance") {
      setWorkstationMode("all_compliance");
      setCaseActiveTab("compliance");
    }
  }, [initialTab]);

  // Auto-select first case
  useEffect(() => {
    if (cases.length > 0) {
      if (selectedCaseId === null || !cases.some((c) => c.id === selectedCaseId)) {
        setSelectedCaseId(cases[0].id);
      }
    } else {
      setSelectedCaseId(null);
    }
  }, [cases, selectedCaseId]);

  // 2. Fetch Selected Case Full Detail (direct API without mock fallback)
  const { data: dbDetail, isLoading: isDetailLoading } = useQuery<CaseFileFullDetail>({
    queryKey: [`/api/case-files/${selectedCaseId}`],
    queryFn: async () => {
      if (!selectedCaseId) return null;
      const res = await fetch(`/api/case-files/${selectedCaseId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const errorMsg = errorData?.message || `Request failed with status ${res.status}`;
        const err = new Error(errorMsg) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      return await res.json();
    },
    enabled: selectedCaseId !== null && Number(selectedCaseId) > 0,
    retry: (failureCount, error: any) => {
      if (error?.status && [401, 403, 404].includes(error.status)) return false;
      return failureCount < 2;
    },
  });

  const selectedCase: CaseFileFullDetail | undefined = useMemo(() => {
    if (dbDetail) return dbDetail;
    return cases.find((c) => c.id === selectedCaseId);
  }, [dbDetail, cases, selectedCaseId]);

  // 3. Update Case
  const updateCaseMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<CaseFileListItem>;
    }) => {
      const res = await apiRequest("PATCH", `/api/case-files/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/case-files/${selectedCaseId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/case-files"] });
      toast({ title: "Case Dossier Updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update case",
        description: error?.message || "An error occurred while updating the case file.",
        variant: "destructive",
      });
    },
  });

  // 4. Delete Case
  const deleteCaseMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/case-files/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-files"] });
      toast({ title: "Case File Deleted" });
      setSelectedCaseId((prev) => {
        const remaining = cases.filter((c) => c.id !== selectedCaseId);
        return remaining[0]?.id || null;
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete case",
        description: error?.message || "An error occurred while deleting the case file.",
        variant: "destructive",
      });
    },
  });

  // Filter Cases
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.title.toLowerCase().includes(q) ||
        (c.caseNumber && c.caseNumber.toLowerCase().includes(q)) ||
        (c.court && c.court.toLowerCase().includes(q)) ||
        (c.referenceNo && c.referenceNo.toLowerCase().includes(q)) ||
        (c.primaryClient && c.primaryClient.toLowerCase().includes(q));

      const matchCat =
        selectedCategory === "all" ||
        c.caseType.toLowerCase() === selectedCategory.toLowerCase();

      const matchStatus =
        statusFilter === "all" || c.status === statusFilter;

      return matchSearch && matchCat && matchStatus;
    });
  }, [cases, searchQuery, selectedCategory, statusFilter]);

  // All documents across all cases
  const allVaultDocuments = useMemo(() => {
    return cases.flatMap((c) =>
      (c.documents || []).map((doc) => ({
        ...doc,
        caseTitle: c.title,
        caseNumber: c.caseNumber || c.referenceNo || `Ref ${c.id}`,
        court: c.court || "High Court",
      }))
    );
  }, [cases]);

  // Overall Quick Stats
  const totalActive = cases.filter((c) => c.status === "active").length;
  const totalUrgent = cases.filter((c) => c.priority === "urgent" || c.priority === "high").length;
  const totalDocuments = allVaultDocuments.length;

  return (
    <PreviewShell>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* 1. Workstation Header (Semantic H1) */}
        <div className="bg-white dark:bg-[#131E2E] p-5 rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20">
                <Briefcase className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-[#105B38]">
                Litigation Management & 6-Pillar Procedural Audit
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
              Case Files, Compliance & Documents Vault
            </h1>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
              Unified litigation records, procedural 6-pillar compliance audit, and court documents vault.
            </p>
          </div>

          {/* Header Action & Quick Metrics */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-semibold">
              <span className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                Active: <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{totalActive}</strong>
              </span>
              <span className="text-[#CBD5E1]">|</span>
              <span className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                Vault Docs: <strong className="text-[#105B38]">{totalDocuments}</strong>
              </span>
              <span className="text-[#CBD5E1]">|</span>
              <span className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                Urgent: <strong className="text-rose-600 dark:text-rose-400">{totalUrgent}</strong>
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white font-bold text-xs transition-all shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Case File</span>
            </button>
          </div>
        </div>

        {/* 2. Top Workstation Mode Switcher (Secondary Navigation) */}
        <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-[#131E2E] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setWorkstationMode("dossiers")}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0",
              workstationMode === "dossiers"
                ? "bg-[#105B38] text-white shadow-xs"
                : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E]"
            )}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Case Dossiers & Matters</span>
            <span
              className={cn(
                "text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold",
                workstationMode === "dossiers" ? "bg-white dark:bg-[#131E2E]/20 text-white" : "bg-[#F8FAFC] dark:bg-[#0B131E] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] border border-[#E2E8F0] dark:border-[#1E2D44]"
              )}
            >
              {cases.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setWorkstationMode("all_documents")}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0",
              workstationMode === "all_documents"
                ? "bg-[#105B38] text-white shadow-xs"
                : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E]"
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Case Documents & Annexures Vault</span>
            <span
              className={cn(
                "text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold",
                workstationMode === "all_documents" ? "bg-white dark:bg-[#131E2E]/20 text-white" : "bg-[#F8FAFC] dark:bg-[#0B131E] text-[#105B38] border border-[#E2E8F0] dark:border-[#1E2D44]"
              )}
            >
              {totalDocuments}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setWorkstationMode("all_compliance")}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0",
              workstationMode === "all_compliance"
                ? "bg-[#105B38] text-white shadow-xs"
                : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E]"
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>6-Pillar Procedural Compliance Audit</span>
            <span
              className={cn(
                "text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold",
                workstationMode === "all_compliance" ? "bg-white dark:bg-[#131E2E]/20 text-white" : "bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20"
              )}
            >
              6/6 Passed
            </span>
          </button>
        </div>

        {/* ── View 1: Dossiers & Split-Pane Workstation ─────────────── */}
        {workstationMode === "dossiers" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Filter & Case List */}
            <div className="lg:col-span-5 space-y-3">
              {/* Search Input */}
              <div className="relative">
                <Search className="w-4 h-4 text-[#94A3B8] dark:text-[#475569] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search matters, courts, CNIC, or case #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-xl pl-9 pr-4 py-2 text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:text-[#475569] outline-none focus:border-[#105B38] transition-all shadow-xs"
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs custom-scrollbar">
                {CATEGORY_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedCategory(tab.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all text-xs",
                      selectedCategory === tab.id
                        ? "bg-[#105B38] text-white shadow-xs"
                        : "bg-white dark:bg-[#131E2E] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#1E2D44]"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Cases List (Tightened density, subtle border selection) */}
              <div className="space-y-2 max-h-[640px] overflow-y-auto custom-scrollbar pr-1">
                {isListLoading ? (
                  <div className="p-8 text-center bg-white dark:bg-[#131E2E] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-[#105B38] mx-auto" />
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Loading case dossiers...</p>
                  </div>
                ) : filteredCases.length === 0 ? (
                  <div className="p-8 text-center bg-white dark:bg-[#131E2E] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] space-y-3">
                    <FolderOpen className="w-8 h-8 text-[#94A3B8] dark:text-[#475569] mx-auto" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {searchQuery || selectedCategory !== "all" || statusFilter !== "all"
                          ? "No matching cases"
                          : "No case files found"}
                      </p>
                      <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                        {searchQuery || selectedCategory !== "all" || statusFilter !== "all"
                          ? "Try adjusting your search query or filters."
                          : "Open a new case file to start managing litigation records."}
                      </p>
                    </div>
                    {cases.length === 0 && (
                      <button
                        type="button"
                        onClick={() => setShowCreateModal(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#105B38] text-white font-bold text-xs shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New Case File</span>
                      </button>
                    )}
                  </div>
                ) : (
                  filteredCases.map((c) => {
                    const isSelected = selectedCaseId === c.id;
                    const priorityClass = PRIORITY_BADGES[c.priority] || PRIORITY_BADGES.normal;

                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCaseId(c.id)}
                        className={cn(
                          "p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2",
                          isSelected
                            ? "bg-emerald-50/3 dark:bg-emerald-500/100 dark:bg-emerald-500/10 border-[#105B38] border-l-4 border-l-[#105B38] shadow-xs"
                            : "bg-white dark:bg-[#131E2E] border-[#E2E8F0] dark:border-[#1E2D44] hover:border-[#105B38]/40 hover:shadow-xs"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 min-w-0">
                            <span className="font-mono text-xs font-bold text-[#105B38]">
                              {c.caseNumber || `Ref: ${c.referenceNo || c.id}`}
                            </span>
                            <h2 className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                              {c.title}
                            </h2>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", priorityClass)}>
                              {c.priority}
                            </span>
                          </div>
                        </div>

                        {c.court && (
                          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-[#94A3B8] dark:text-[#475569]" />
                            <span>{c.court}</span>
                          </p>
                        )}

                        <div className="pt-1.5 border-t border-[#E2E8F0] dark:border-[#1E2D44] flex items-center justify-between text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                          <span className="capitalize">{c.caseType}</span>
                          <span>{c.primaryClient || "Client not set"}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Active Case Workspace Detail */}
            <div className="lg:col-span-7">
              {isDetailLoading && !selectedCase ? (
                <div className="p-12 text-center bg-white dark:bg-[#131E2E] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-[#105B38]" />
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Loading case details...</p>
                </div>
              ) : selectedCase ? (
                <div className="space-y-4">
                  {/* Case Top Info Header */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] space-y-3.5 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-[#105B38] bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
                            {selectedCase.caseNumber || `Ref: ${selectedCase.referenceNo || selectedCase.id}`}
                          </span>
                          <span className="text-xs font-semibold capitalize px-2 py-0.5 rounded-full bg-[#F8FAFC] dark:bg-[#0B131E] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] border border-[#E2E8F0] dark:border-[#1E2D44]">
                            {selectedCase.caseType}
                          </span>
                        </div>
                        <h2 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] leading-snug">
                          {selectedCase.title}
                        </h2>
                        {selectedCase.court && (
                          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#105B38]" />
                            <span>{selectedCase.court}</span>
                          </p>
                        )}
                      </div>

                      {/* Quick Status / Priority & Delete Action */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <select
                          value={selectedCase.status}
                          onChange={(e) =>
                            updateCaseMutation.mutate({
                              id: selectedCase.id,
                              data: { status: e.target.value as any },
                            })
                          }
                          className="bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-xl px-2.5 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] font-semibold outline-none focus:border-[#105B38]"
                        >
                          <option value="active">Active</option>
                          <option value="pending">Pending</option>
                          <option value="closed">Disposed / Closed</option>
                          <option value="archived">Archived</option>
                        </select>

                        <select
                          value={selectedCase.priority}
                          onChange={(e) =>
                            updateCaseMutation.mutate({
                              id: selectedCase.id,
                              data: { priority: e.target.value as any },
                            })
                          }
                          className="bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-xl px-2.5 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] font-semibold outline-none focus:border-[#105B38]"
                        >
                          <option value="urgent">Urgent</option>
                          <option value="high">High</option>
                          <option value="normal">Normal</option>
                          <option value="low">Low</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this case file?")) {
                              deleteCaseMutation.mutate(selectedCase.id);
                            }
                          }}
                          className="p-2 rounded-xl text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:bg-rose-500/10 border border-transparent hover:border-rose-200 dark:border-rose-500/20 transition-colors"
                          title="Delete Case File"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Case Internal Tabs Nav */}
                    <div className="flex items-center gap-1.5 border-t border-[#E2E8F0] dark:border-[#1E2D44] pt-3 overflow-x-auto text-xs font-semibold custom-scrollbar">
                      {[
                        {
                          id: "compliance",
                          label: "6-Pillar Compliance",
                          icon: ShieldCheck,
                          badge: `${selectedCase.compliance?.filter((c: any) => c.status === "done" || c.status === "verified").length || 0}/6`,
                        },
                        {
                          id: "documents",
                          label: "Case Documents Vault",
                          icon: FileText,
                          count: selectedCase.documents?.length || 0,
                        },
                        {
                          id: "parties",
                          label: "Parties & Clients",
                          icon: Users,
                          count: selectedCase.clients?.length || 0,
                        },
                        {
                          id: "hearings",
                          label: "Diary Hearings",
                          icon: CalendarDays,
                          count: selectedCase.compliance?.filter((c: any) => c.type === "hearing").length || 0,
                        },
                        {
                          id: "notes",
                          label: "Chambers Notes",
                          icon: StickyNote,
                          count: selectedCase.notes?.length || 0,
                        },
                      ].map((tab) => {
                        const Icon = tab.icon;
                        const isActive = caseActiveTab === tab.id;

                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setCaseActiveTab(tab.id as any)}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl whitespace-nowrap transition-all text-xs",
                              isActive
                                ? "bg-[#105B38] text-white font-bold shadow-xs"
                                : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E]"
                            )}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{tab.label}</span>
                            {"badge" in tab && tab.badge && (
                              <span
                                className={cn(
                                  "text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold",
                                  isActive ? "bg-white dark:bg-[#131E2E]/20 text-white" : "bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38]"
                                )}
                              >
                                {tab.badge}
                              </span>
                            )}
                            {"count" in tab && (
                              <span
                                className={cn(
                                  "text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold",
                                  isActive ? "bg-white dark:bg-[#131E2E]/20 text-white" : "bg-[#F8FAFC] dark:bg-[#0B131E] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] border border-[#E2E8F0] dark:border-[#1E2D44]"
                                )}
                              >
                                {tab.count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tab Views */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs min-h-[460px]">
                    {caseActiveTab === "compliance" && (
                      <SixPillarChecklist
                        caseId={selectedCase.id}
                        complianceList={selectedCase.compliance || []}
                      />
                    )}

                    {caseActiveTab === "documents" && (
                      <DocumentsVault
                        caseId={selectedCase.id}
                        documents={selectedCase.documents || []}
                      />
                    )}

                    {caseActiveTab === "parties" && (
                      <PartiesManager
                        caseId={selectedCase.id}
                        parties={selectedCase.clients || []}
                      />
                    )}

                    {caseActiveTab === "hearings" && (
                      <HearingsScheduler
                        caseId={selectedCase.id}
                        caseTitle={selectedCase.title}
                        caseNumber={selectedCase.caseNumber || undefined}
                        courtName={selectedCase.court || undefined}
                        hearings={selectedCase.compliance?.filter((c: any) => c.type === "hearing") || []}
                      />
                    )}

                    {caseActiveTab === "notes" && (
                      <CaseNotesManager
                        caseId={selectedCase.id}
                        notes={selectedCase.notes || []}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center bg-white dark:bg-[#131E2E] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] space-y-3">
                  <Briefcase className="w-10 h-10 text-[#94A3B8] dark:text-[#475569] mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">No Case Selected</p>
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                      Select a case dossier from the list or open a new litigation matter.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#105B38] text-white font-bold text-xs shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Open New Case File</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── View 2: All Case Documents & Annexures Vault ─────────── */}
        {workstationMode === "all_documents" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#131E2E] p-5 rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">Chambers Central Documents & Annexures Vault</h2>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-0.5">
                  Browse all pleadings, impugned orders, Vakalatnamas, and exhibits across active case files.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  toast({
                    title: "Attach Document to Matter",
                    description: "Select pleading, annexure, or impugned order to link.",
                  });
                }}
                className="px-4 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-2 shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload & Link Document</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allVaultDocuments.length === 0 ? (
                <div className="col-span-full p-12 text-center bg-white dark:bg-[#131E2E] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] space-y-2">
                  <FileText className="w-10 h-10 text-[#94A3B8] dark:text-[#475569] mx-auto" />
                  <p className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">No Documents in Vault</p>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                    Upload pleadings, orders, or annexures to your case files to view them here.
                  </p>
                </div>
              ) : (
                allVaultDocuments.map((doc, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] hover:border-[#105B38]/40 hover:shadow-xs transition-all space-y-2.5 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20">
                          {doc.label || "Court Document"}
                        </span>
                        <span className="font-mono text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] bg-[#F8FAFC] dark:bg-[#0B131E] px-2 py-0.5 rounded-md border border-[#E2E8F0] dark:border-[#1E2D44]">
                          {doc.caseNumber}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC] leading-snug">{doc.docTitle}</h3>
                      <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Matter: <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{doc.caseTitle}</strong></p>
                    </div>

                    <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#1E2D44] flex items-center justify-between text-xs">
                      <span className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Added: {doc.addedAt}</span>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`${doc.docTitle} (Attached in ${doc.caseNumber})`);
                          toast({
                            title: "Citation Copied",
                            description: "Document reference copied to clipboard.",
                          });
                        }}
                        className="px-3 py-1 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-bold text-[#105B38] transition-colors flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Citation</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── View 3: 6-Pillar Procedural Compliance Overview ─────────── */}
        {workstationMode === "all_compliance" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#131E2E] p-5 rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs">
              <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">Chambers 6-Pillar Procedural Compliance Audit</h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-0.5">
                Multi-matter procedural health check: Order VII Rule 11 CPC, Limitation Act 1908, Court Fees Act 1870, Specific Relief Act readiness, and solemn affidavits.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cases.length === 0 ? (
                <div className="col-span-full p-12 text-center bg-white dark:bg-[#131E2E] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] space-y-2">
                  <ShieldCheck className="w-10 h-10 text-[#94A3B8] dark:text-[#475569] mx-auto" />
                  <p className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">No Compliance Records</p>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                    Open a new case file to track 6-pillar procedural compliance.
                  </p>
                </div>
              ) : (
                cases.map((c) => (
                  <div
                    key={c.id}
                    className="p-5 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs space-y-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-[#105B38]">
                          {c.caseNumber || `Ref: ${c.referenceNo}`}
                        </span>
                        <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">{c.title}</h3>
                      </div>
                      <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20">
                        {c.compliance?.filter((item: any) => item.status === "done" || item.status === "verified").length || 0}/6 Passed
                      </span>
                    </div>

                    <div className="space-y-2">
                      {c.compliance && c.compliance.length > 0 ? (
                        c.compliance.map((item: any) => (
                          <div
                            key={item.id}
                            className="p-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#105B38] shrink-0" />
                              <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{item.pillar || item.type}:</span>
                              <span className="text-[#334155] dark:text-[#CBD5E1]">{item.title}</span>
                            </div>
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Verified</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] italic">No compliance checkpoints recorded.</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Case Modal */}
      {showCreateModal && (
        <CreateCaseModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(newCaseId) => {
            setSelectedCaseId(newCaseId);
            setWorkstationMode("dossiers");
          }}
        />
      )}
    </PreviewShell>
  );
};

export default PreviewCaseFiles;
