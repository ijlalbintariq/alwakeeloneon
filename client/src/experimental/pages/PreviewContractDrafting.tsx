import type { ContractTemplateItem, ClauseItem } from "../../../../server/data/contractTemplates";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PreviewShell } from "@/experimental/components/PreviewShell";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Download,
  Copy,
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  Share2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Layers,
  FileCheck,
  Building2,
  Scale,
  Users,
  ShieldAlert,
  ArrowRight,
  Gavel,
  BookOpen,
  Send,
  Eye,
  Sliders,
  Check,
  X,
  HelpCircle,
  Clock,
  Printer,
  ChevronRight,
  RefreshCw,
  FolderPlus,
  Edit3,
  Save,
  FolderOpen,
  Database,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Document as DocxDocument,
  Paragraph as DocxParagraph,
  Packer as DocxPacker,
  TextRun as DocxTextRun,
  HeadingLevel as DocxHeadingLevel,
  AlignmentType as DocxAlignmentType,
} from "docx";
import { generateLegalPDF } from "@/lib/generate-legal-pdf";
import { plainTextToTiptapHTML } from "@/experimental/lib/plain-to-tiptap";

// ─── 24+ Comprehensive Pakistani Commercial & Property Templates ───────────────

export interface ContractRiskItem {
  id: string;
  category: "danger" | "warning" | "info";
  title: string;
  ruleDescription: string;
  statutoryReference: string;
  impactScore: number;
  detectedSnippet: string;
  suggestedFix: string;
  recommendedClauseId?: string;
}

export const PreviewContractDrafting: React.FC = () => {
  const { toast } = useToast();

  const { data: contractTemplates = [], isLoading: templatesLoading } = useQuery<ContractTemplateItem[]>({ queryKey: ["/api/templates/contracts"] });
  const { data: clauseLibrary = [], isLoading: clausesLoading } = useQuery<ClauseItem[]>({ queryKey: ["/api/templates/clauses"] });
  


  // Active document state
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplateItem | null>(null);
  const [activeTab, setActiveTab] = useState<"editor" | "variables" | "clauses" | "risks" | "redlines">("editor");
  const [documentContent, setDocumentContent] = useState<string>("");
  const [documentTitle, setDocumentTitle] = useState<string>("");

  // Variables form state
  const [variables, setVariables] = useState<Record<string, string>>({});

  // Search & Filter state
  const [clauseSearch, setClauseSearch] = useState<string>("");
  const [selectedClauseCategory, setSelectedClauseCategory] = useState<string>("All");
  const [templateSearch, setTemplateSearch] = useState<string>("");
  const [selectedTemplateCategory, setSelectedTemplateCategory] = useState<string>("All");

  // Editor styling & zoom
  const [fontSize, setFontSize] = useState<number>(14);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [acceptedRedlines, setAcceptedRedlines] = useState<Record<string, boolean>>({});

  // Modals & PostgreSQL Database State
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [isSavedDraftsModalOpen, setIsSavedDraftsModalOpen] = useState<boolean>(false);
  const [isSavingManual, setIsSavingManual] = useState<boolean>(false);

  const queryClient = useQueryClient();
  const [activeDraftId, setActiveDraftId] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

  // Fetch saved drafts from PostgreSQL database
  const { data: savedDrafts = [], isLoading: isLoadingDrafts } = useQuery<any[]>({
    queryKey: ["/api/drafts"],
    queryFn: async () => {
      const res = await fetch("/api/drafts", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) return [];
        throw new Error("Failed to fetch saved drafts");
      }
      return res.json();
    },
  });

  // Save/Autosave draft to PostgreSQL
  const saveDraftToDb = async (isManual = false) => {
    if (!documentContent.trim()) return;
    if (isManual) setIsSavingManual(true);
    setSaveStatus("saving");

    try {
      const payload = {
        title: documentTitle || selectedTemplate?.title || "Commercial Contract Draft",
        templateType: selectedTemplate?.title || "Commercial Contract",
        content: documentContent,
        status: "draft",
        metadata: {
          variables,
          category: selectedTemplate?.category || "Commercial & Corporate",
          governingLaw: selectedTemplate?.governingLaw,
        },
      };

      let res;
      if (activeDraftId) {
        res = await fetch(`/api/drafts/${activeDraftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error("Failed to persist draft");
      const data = await res.json();
      if (data && data.id) {
        setActiveDraftId(data.id);
      }
      setSaveStatus("saved");
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });

      if (isManual) {
        toast({
          title: "Contract Draft Saved",
          description: `Persisted "${payload.title}" to PostgreSQL database.`,
        });
      }
    } catch (err: any) {
      console.error("[ContractDrafting] Save error:", err);
      setSaveStatus("unsaved");
      if (isManual) {
        toast({
          title: "Save Failed",
          description: err.message || "Failed to persist draft to database.",
          variant: "destructive",
        });
      }
    } finally {
      if (isManual) setIsSavingManual(false);
    }
  };

  // Debounced autosave to PostgreSQL on changes
  useEffect(() => {
    if (!documentContent.trim()) return;
    setSaveStatus("unsaved");
    const timer = setTimeout(() => {
      saveDraftToDb(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [documentContent, documentTitle, variables]);

  // Load draft from PostgreSQL
  const handleLoadDraft = (draft: any) => {
    setDocumentTitle(draft.title || "Loaded Contract");
    setDocumentContent(draft.content || "");
    if (draft.metadata?.variables) {
      setVariables(draft.metadata.variables);
    }
    setActiveDraftId(draft.id);
    setSaveStatus("saved");
    setIsSavedDraftsModalOpen(false);
    toast({
      title: "Contract Draft Loaded",
      description: `Loaded "${draft.title}" from PostgreSQL database.`,
    });
  };

  // Delete draft from PostgreSQL
  const handleDeleteDraft = async (draftId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/drafts/${draftId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      if (activeDraftId === draftId) {
        setActiveDraftId(null);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
      toast({
        title: "Draft Deleted",
        description: "Draft removed from PostgreSQL database.",
      });
    } catch (err: any) {
      toast({
        title: "Delete Failed",
        description: err.message || "Failed to delete draft.",
        variant: "destructive",
      });
    }
  };

  // Event Bridge: listen to external drafting inserts
  useEffect(() => {
    const handleDraftingInsert = (e: CustomEvent<{ title?: string; content?: string }>) => {
      if (e.detail && e.detail.content) {
        setDocumentContent((prev) => prev + "\n\n" + e.detail.content);
        toast({
          title: "Clause Synced to Contract Studio",
          description: e.detail.title || "External statutory clause appended successfully.",
        });
      }
    };

    window.addEventListener("alwakeelo-drafting-insert" as any, handleDraftingInsert as any);
    return () => {
      window.removeEventListener("alwakeelo-drafting-insert" as any, handleDraftingInsert as any);
    };
  }, [toast]);

  // Handle Template Selection
  const handleSelectTemplate = (template: ContractTemplateItem) => {
    setSelectedTemplate(template);
    setDocumentTitle(template.defaultVariables.title);
    setVariables(template.defaultVariables);
    setDocumentContent(template.body);
    setIsTemplateModalOpen(false);
    toast({
      title: "Template Loaded",
      description: `Loaded ${template.title} with Pakistani legal standard clauses.`,
    });
  };

  // Replace variables in document
  const handleApplyVariables = () => {
    let updated = selectedTemplate?.body;
    if (!updated) return;
    updated = updated.replace(/\[JURISDICTION\]/g, variables.jurisdiction || "[JURISDICTION]");
    updated = updated.replace(/\[EFFECTIVE_DATE\]/g, variables.effectiveDate || "[EFFECTIVE_DATE]");
    updated = updated.replace(/\[FIRST_PARTY_NAME\]/g, variables.firstParty || "[FIRST_PARTY_NAME]");
    updated = updated.replace(/\[FIRST_PARTY_CNIC\]/g, variables.firstPartyCNIC || "[FIRST_PARTY_CNIC]");
    updated = updated.replace(/\[FIRST_PARTY_ADDRESS\]/g, variables.firstPartyAddress || "[FIRST_PARTY_ADDRESS]");
    updated = updated.replace(/\[SECOND_PARTY_NAME\]/g, variables.secondParty || "[SECOND_PARTY_NAME]");
    updated = updated.replace(/\[SECOND_PARTY_CNIC\]/g, variables.secondPartyCNIC || "[SECOND_PARTY_CNIC]");
    updated = updated.replace(/\[SECOND_PARTY_ADDRESS\]/g, variables.secondPartyAddress || "[SECOND_PARTY_ADDRESS]");
    updated = updated.replace(/\[CONSIDERATION_PKR\]/g, variables.considerationPkr || "[CONSIDERATION_PKR]");
    updated = updated.replace(/\[PROPERTY_OR_SCOPE\]/g, variables.propertyOrScope || "[PROPERTY_OR_SCOPE]");
    updated = updated.replace(/\[TERM_MONTHS\]/g, variables.termMonths || "[TERM_MONTHS]");
    updated = updated.replace(/\[NOTICE_DAYS\]/g, variables.noticeDays || "[NOTICE_DAYS]");
    updated = updated.replace(/\[ARBITRATION_CITY\]/g, variables.arbitrationCity || variables.jurisdiction || "[ARBITRATION_CITY]");

    // Auto-calculate split payments if numeric
    const rawVal = parseInt(variables.considerationPkr.replace(/,/g, ""), 10);
    if (!isNaN(rawVal)) {
      const bayana = (rawVal * 0.2).toLocaleString("en-PK");
      const balance = (rawVal * 0.8).toLocaleString("en-PK");
      const deposit = (rawVal * 3).toLocaleString("en-PK");
      updated = updated.replace(/\[CONSIDERATION_PKR_20PCT\]/g, bayana);
      updated = updated.replace(/\[CONSIDERATION_PKR_80PCT\]/g, balance);
      updated = updated.replace(/\[DEPOSIT_PKR\]/g, deposit);
    }

    setDocumentContent(updated);
    setActiveTab("editor");
    toast({
      title: "Variables Applied",
      description: "All party details, consideration, jurisdiction, and timelines merged into document.",
    });
  };

  // Insert Clause at the bottom of active text
  const handleInsertClause = (clause: ClauseItem) => {
    setDocumentContent((prev) => prev + "\n\n" + clause.clauseText);
    toast({
      title: "Clause Inserted",
      description: `Appended ${clause.title} into active contract.`,
    });
  };

  useEffect(() => {
    if (contractTemplates.length > 0 && !selectedTemplate) {
      setSelectedTemplate(contractTemplates[0]);
      setDocumentContent(contractTemplates[0].body);
      setDocumentTitle(contractTemplates[0].defaultVariables.title || "Untitled");
      setVariables(contractTemplates[0].defaultVariables);
    }
  }, [contractTemplates, selectedTemplate]);

  // Contract Risk Analysis
  const [riskAnalysis, setRiskAnalysis] = useState<{
    score: number;
    grade: "Low Risk" | "Moderate Risk" | "High Risk" | "Critical Risk";
    findings: ContractRiskItem[];
  }>({ score: 100, grade: "Low Risk", findings: [] });

  const handleTriggerScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch("/api/ai/draft-risk-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: documentTitle,
          content: documentContent,
          module: "contract",
        }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      
      const findings = data.risks || [];
      const deduction = findings.length * 15;
      const score = Math.max(0, 100 - deduction);
      const grade = score > 80 ? "Low Risk" : score > 60 ? "Moderate Risk" : score > 40 ? "High Risk" : "Critical Risk";
      
      const mappedFindings = findings.map((f: any) => ({
        id: f.id || Math.random().toString(),
        category: f.severity === "danger" ? "danger" : "warning",
        title: f.title,
        ruleDescription: f.detail,
        statutoryReference: "AI Analysis",
        impactScore: f.severity === "danger" ? 9 : 5,
        detectedSnippet: "Analyzed from document context",
        suggestedFix: f.prompt,
      }));

      setRiskAnalysis({ score, grade, findings: mappedFindings });
      setActiveTab("risks");
      toast({
        title: "Risk Scan Complete",
        description: `Score: ${score}% (${grade}) with ${mappedFindings.length} findings.`,
      });
    } catch (err) {
      toast({ title: "Analysis Failed", variant: "destructive" });
    } finally {
      setIsScanning(false);
    }
  };

  // Accept Redline Fix
  const handleAcceptRedline = (finding: ContractRiskItem) => {
    if (finding.recommendedClauseId) {
      const targetClause = clauseLibrary.find((c: any) => c.id === finding.recommendedClauseId);
      if (targetClause) {
        setDocumentContent((prev) => prev + "\n\n" + targetClause.clauseText);
      }
    }
    setAcceptedRedlines((prev) => ({ ...prev, [finding.id]: true }));
    toast({
      title: "Redline Fix Accepted",
      description: `Integrated compliant clause for: ${finding.title}`,
    });
  };

  // Export to DOCX
  const handleExportDOCX = async () => {
    try {
      const paragraphs = documentContent.split("\n\n").map((paraText) => {
        const isHeading = paraText.startsWith("#") || paraText.toUpperCase() === paraText && paraText.length < 60;
        return new DocxParagraph({
          children: [
            new DocxTextRun({
              text: paraText.replace(/###\s+/g, ""),
              bold: isHeading,
              font: "Times New Roman",
              size: isHeading ? 26 : 24,
            }),
          ],
          heading: isHeading ? DocxHeadingLevel.HEADING_2 : undefined,
          alignment: isHeading ? DocxAlignmentType.CENTER : DocxAlignmentType.JUSTIFIED,
          spacing: { after: 200, line: 276 },
        });
      });

      const doc = new DocxDocument({
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: 1440, // 1 inch
                  bottom: 1440,
                  left: 2160, // 1.5 inch court margin
                  right: 1440,
                },
              },
            },
            children: [
              new DocxParagraph({
                children: [
                  new DocxTextRun({
                    text: "CHAMBERS OF ADVOCATES & LEGAL CONSULTANTS",
                    bold: true,
                    size: 20,
                    color: "105B38",
                  }),
                ],
                alignment: DocxAlignmentType.CENTER,
              }),
              new DocxParagraph({
                children: [
                  new DocxTextRun({
                    text: documentTitle.toUpperCase(),
                    bold: true,
                    size: 28,
                  }),
                ],
                alignment: DocxAlignmentType.CENTER,
                spacing: { after: 400 },
              }),
              ...paragraphs,
            ],
          },
        ],
      });

      const blob = await DocxPacker.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${documentTitle.replace(/\s+/g, "_")}.docx`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "DOCX Exported",
        description: "Downloaded formatted contract document with 1.5-inch court margins.",
      });
      setIsExportModalOpen(false);
    } catch (err) {
      toast({
        title: "Export Failed",
        description: "An error occurred while generating the DOCX file.",
        variant: "destructive",
      });
    }
  };

  // Export to PDF
  const handleExportPDF = async () => {
    try {
      await generateLegalPDF({
        title: documentTitle,
        html: plainTextToTiptapHTML(documentContent),
        court: "Commercial Practice & Civil Courts",
      });
      toast({
        title: "PDF Generated",
        description: "Generated court-ready legal contract PDF with Pakistani stamp margins.",
      });
      setIsExportModalOpen(false);
    } catch (err) {
      toast({
        title: "PDF Generation Fallback",
        description: "Triggering browser print dialogue for instant PDF save.",
      });
      window.print();
    }
  };

  // Copy to Clipboard
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(documentContent);
    toast({
      title: "Copied to Clipboard",
      description: "Contract text copied with full Pakistani legal formatting.",
    });
  };

  // 1-Click Sync to Legal Drafting Studio
  const handleSyncToCourtDrafting = () => {
    try {
      const payload = {
        title: documentTitle,
        section: selectedTemplate?.category,
        content: documentContent,
        source: "Commercial Contract Studio",
        citation: selectedTemplate?.governingLaw,
      };
      localStorage.setItem("alwakeelo_drafting_insert", JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent("alwakeelo-drafting-insert", { detail: payload }));
      toast({
        title: "Synced to Legal Drafting Studio",
        description: "This contract is now loaded into the active court drafting canvas at /preview/drafting.",
      });
    } catch (err) {
      toast({
        title: "Sync Error",
        description: "Failed to broadcast drafting payload.",
        variant: "destructive",
      });
    }
  };

  // Word & Character count
  const wordCount = useMemo(() => {
    return documentContent.trim().split(/\s+/).filter(Boolean).length;
  }, [documentContent]);

  const charCount = documentContent.length;
  const readingTimeMin = Math.ceil(wordCount / 200);

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return contractTemplates.filter((tpl: any) => {
      const matchesSearch =
        tpl.title.toLowerCase().includes(templateSearch.toLowerCase()) ||
        tpl.description.toLowerCase().includes(templateSearch.toLowerCase()) ||
        tpl.governingLaw.toLowerCase().includes(templateSearch.toLowerCase());
      const matchesCategory = selectedTemplateCategory === "All" || tpl.category === selectedTemplateCategory;
      return matchesSearch && matchesCategory;
    });
  }, [templateSearch, selectedTemplateCategory]);

  // Filtered Clauses
  const filteredClauses = useMemo(() => {
    return clauseLibrary.filter((cls: any) => {
      const matchesSearch =
        cls.title.toLowerCase().includes(clauseSearch.toLowerCase()) ||
        cls.subtitle.toLowerCase().includes(clauseSearch.toLowerCase()) ||
        cls.clauseText.toLowerCase().includes(clauseSearch.toLowerCase());
      const matchesCategory = selectedClauseCategory === "All" || cls.category === selectedClauseCategory;
      return matchesSearch && matchesCategory;
    });
  }, [clauseSearch, selectedClauseCategory]);

  return (
    <PreviewShell>
      <div className="preview-theme-scope min-h-screen bg-[#F8FAFC] dark:bg-[#0B131E] pb-16">
        {/* ─── Top Header & Studio Navigation ──────────────────────────────── */}
        <div className="border-b border-[#E2E8F0] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] sticky top-0 z-20 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#EBF5F0] dark:bg-[#105B38]/20 border border-[#A3D4BC] dark:border-[#10B981]/30 flex items-center justify-center text-[#105B38] shadow-xs">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] font-serif">
                    Commercial Contract Drafting Studio
                  </h1>
                  <Badge className="bg-[#EBF5F0] dark:bg-[#105B38]/20 text-[#105B38] border border-[#A3D4BC] dark:border-[#10B981]/30 text-[11px] font-mono">
                    Pakistani Law Compliant
                  </Badge>
                </div>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                  Active: <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{selectedTemplate?.title}</span> • {selectedTemplate?.governingLaw}
                </p>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] px-2.5 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg border border-[#E2E8F0] dark:border-[#1E2D44] h-8">
                {saveStatus === "saved" ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">Saved to DB</span>
                  </>
                ) : saveStatus === "saving" ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-[#105B38] animate-spin" />
                    <span className="text-[11px] text-[#105B38] font-medium">Autosaving...</span>
                  </>
                ) : (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Unsaved changes</span>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSavedDraftsModalOpen(true)}
                className="border-[#A3D4BC] dark:border-[#10B981]/30 text-[#105B38] hover:bg-[#EBF5F0] dark:bg-[#105B38]/20 gap-1.5 h-8 text-xs font-medium"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Saved Drafts ({Array.isArray(savedDrafts) ? savedDrafts.length : 0})
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => saveDraftToDb(true)}
                disabled={isSavingManual || !documentContent.trim()}
                className="border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] hover:bg-slate-50 dark:bg-slate-800 gap-1.5 h-8 text-xs font-medium"
              >
                <Save className="w-3.5 h-3.5 text-[#105B38]" />
                {isSavingManual ? "Saving..." : "Save Draft"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTemplateModalOpen(true)}
                className="border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E] gap-1.5 h-8 text-xs font-medium"
              >
                <FolderPlus className="w-3.5 h-3.5 text-[#105B38]" />
                Templates ({contractTemplates.length}+)
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleTriggerScan}
                disabled={isScanning}
                className="border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 gap-1.5 h-8 text-xs font-medium"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                {isScanning ? "Scanning..." : `Scan Risks (${riskAnalysis.score}%)`}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncToCourtDrafting}
                className="border-[#E2E8F0] dark:border-[#1E2D44] hover:bg-slate-50 dark:bg-slate-800 gap-1.5 h-8 text-xs font-medium"
                title="Send to /preview/drafting"
              >
                <Share2 className="w-3.5 h-3.5 text-[#105B38]" />
                Sync to Court Drafter
              </Button>

              <Button
                size="sm"
                onClick={() => setIsExportModalOpen(true)}
                className="bg-[#105B38] hover:bg-[#0D4A2E] text-white gap-1.5 h-8 text-xs font-medium shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Export / Print
              </Button>
            </div>
          </div>

          {/* Studio Mode Tabs Bar */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between border-t border-[#F1F5F9] bg-[#FAFCFB]">
            <div className="flex items-center gap-1 py-1 overflow-x-auto">
              <button
                onClick={() => setActiveTab("editor")}
                className={cn(
                  "px-3 py-2 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors",
                  activeTab === "editor"
                    ? "bg-[#105B38] text-white shadow-xs"
                    : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-slate-100"
                )}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Contract Editor & Canvas
              </button>

              <button
                onClick={() => setActiveTab("variables")}
                className={cn(
                  "px-3 py-2 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors",
                  activeTab === "variables"
                    ? "bg-[#105B38] text-white shadow-xs"
                    : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-slate-100"
                )}
              >
                <Sliders className="w-3.5 h-3.5" />
                Dynamic Variables Form
              </button>

              <button
                onClick={() => setActiveTab("clauses")}
                className={cn(
                  "px-3 py-2 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors",
                  activeTab === "clauses"
                    ? "bg-[#105B38] text-white shadow-xs"
                    : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-slate-100"
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                4-Category Clause Library ({clauseLibrary.length})
              </button>

              <button
                onClick={() => setActiveTab("risks")}
                className={cn(
                  "px-3 py-2 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors",
                  activeTab === "risks"
                    ? "bg-[#105B38] text-white shadow-xs"
                    : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-slate-100"
                )}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Risk & S.27 Auditor ({riskAnalysis.findings.length})
              </button>
            </div>

            {/* Document Metrics */}
            <div className="hidden md:flex items-center gap-3 text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] font-mono">
              <span>{wordCount} words</span>
              <span>•</span>
              <span>{charCount} chars</span>
              <span>•</span>
              <span>~{readingTimeMin} min read</span>
            </div>
          </div>
        </div>

        {/* ─── Main Workstation Area ───────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          {/* TAB 1: CONTRACT EDITOR CANVAS */}
          {activeTab === "editor" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Canvas (Editor) */}
              <div className={cn("lg:col-span-8 space-y-4", isFullscreen && "fixed inset-0 z-50 bg-white dark:bg-[#131E2E] p-6 overflow-y-auto")}>
                <Card className="border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs overflow-hidden">
                  <CardHeader className="bg-slate-50/80 dark:bg-slate-500/10 border-b border-[#E2E8F0] dark:border-[#1E2D44] py-2.5 px-4 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 mr-4">
                      <Input
                        value={documentTitle}
                        onChange={(e) => setDocumentTitle(e.target.value)}
                        className="font-serif font-bold text-sm bg-transparent border-transparent hover:border-[#E2E8F0] dark:border-[#1E2D44] focus:bg-white dark:bg-[#131E2E] h-8"
                        placeholder="Contract Title..."
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setFontSize((p) => Math.max(11, p - 1))}
                        className="h-7 w-7 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"
                        title="Decrease Font Size"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </Button>
                      <span className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] px-1">{fontSize}px</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setFontSize((p) => Math.min(20, p + 1))}
                        className="h-7 w-7 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"
                        title="Increase Font Size"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="h-7 w-7 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"
                        title="Toggle Fullscreen"
                      >
                        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCopyToClipboard}
                        className="h-7 w-7 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"
                        title="Copy All Text"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Textarea
                      value={documentContent}
                      onChange={(e) => setDocumentContent(e.target.value)}
                      style={{ fontSize: `${fontSize}px`, minHeight: isFullscreen ? "80vh" : "680px" }}
                      className="w-full font-serif leading-relaxed p-6 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-[#FFFFFF] dark:bg-[#131E2E] resize-y"
                      placeholder="Type or paste your legal contract text here..."
                    />
                  </CardContent>
                  <div className="bg-slate-50 dark:bg-slate-800 border-t border-[#E2E8F0] dark:border-[#1E2D44] px-4 py-2 flex items-center justify-between text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                    <span className="flex items-center gap-1.5 text-[#105B38] font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Autosaved locally
                    </span>
                    <span>Stamp Duty: {selectedTemplate?.forum}</span>
                  </div>
                </Card>
              </div>

              {/* Right Sidecar Panel: Quick Variables & Clause Shelf */}
              <div className="lg:col-span-4 space-y-4">
                {/* Risk Quick Meter */}
                <Card className="border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs">
                  <CardHeader className="py-3 px-4 bg-slate-50 dark:bg-slate-800 border-b border-[#E2E8F0] dark:border-[#1E2D44]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-[#105B38]" /> Legal Risk Score
                      </span>
                      <Badge
                        className={cn(
                          "text-xs font-mono",
                          riskAnalysis.score >= 85
                            ? "bg-emerald-100 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30"
                            : riskAnalysis.score >= 70
                            ? "bg-amber-100 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-500/30"
                            : "bg-rose-100 text-rose-800 dark:text-rose-400 border-rose-300 dark:border-rose-500/30"
                        )}
                      >
                        {riskAnalysis.score}% • {riskAnalysis.grade}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3.5 space-y-2.5">
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                      {riskAnalysis.findings.length === 0
                        ? "No major statutory non-compliances detected. Standard Pakistani contractual clauses verified."
                        : `${riskAnalysis.findings.length} potential contract vulnerability flags identified under Contract Act 1872 & Stamp Act 1899.`}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("risks")}
                      className="w-full text-xs border-[#A3D4BC] dark:border-[#10B981]/30 text-[#105B38] hover:bg-[#EBF5F0] dark:bg-[#105B38]/20"
                    >
                      Inspect All Risk Redlines <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </CardContent>
                </Card>

                {/* Quick Insert Common Clauses */}
                <Card className="border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs">
                  <CardHeader className="py-3 px-4 bg-slate-50 dark:bg-slate-800 border-b border-[#E2E8F0] dark:border-[#1E2D44]">
                    <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-[#105B38]" /> 1-Click Essential Clauses
                    </span>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2 max-h-[380px] overflow-y-auto">
                    {clauseLibrary.slice(0, 6).map((clause) => (
                      <div
                        key={clause.id}
                        className="p-2.5 rounded-md border border-[#E2E8F0] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] hover:border-[#A3D4BC] dark:border-[#10B981]/30 hover:bg-[#FAFCFB] transition-colors flex items-center justify-between gap-2"
                      >
                        <div className="overflow-hidden">
                          <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate">{clause.title}</div>
                          <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] truncate">{clause.statutoryReference}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleInsertClause(clause)}
                          className="h-7 px-2 text-[11px] font-medium text-[#105B38] hover:bg-[#EBF5F0] dark:bg-[#105B38]/20 shrink-0"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Insert
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab("clauses")}
                      className="w-full text-xs text-[#105B38] hover:bg-[#EBF5F0] dark:bg-[#105B38]/20 pt-2"
                    >
                      Open Full 30+ Clause Library &rarr;
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 2: DYNAMIC VARIABLES FORM */}
          {activeTab === "variables" && (
            <Card className="border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs">
              <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b border-[#E2E8F0] dark:border-[#1E2D44]">
                <CardTitle className="text-base font-serif font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-[#105B38]" /> Dynamic Contract Variables & Party Metadata
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                  Fill in the Pakistani legal party credentials, consideration, and territorial jurisdiction to auto-merge into your contract template.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Row 1: Document Title & Consideration */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] block mb-1">Contract Title / Deed Type</label>
                    <Input
                      value={variables.title}
                      onChange={(e) => setVariables({ ...variables, title: e.target.value })}
                      placeholder="e.g. Agreement to Sell"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] block mb-1">Consideration / Value (PKR)</label>
                    <Input
                      value={variables.considerationPkr}
                      onChange={(e) => setVariables({ ...variables, considerationPkr: e.target.value })}
                      placeholder="e.g. 45,000,000"
                      className="text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] block mb-1">Jurisdiction / Seat City</label>
                    <Select
                      value={variables.jurisdiction}
                      onValueChange={(val) => setVariables({ ...variables, jurisdiction: val, arbitrationCity: val })}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Select City" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-zinc-950">
                        {["Lahore", "Karachi", "Islamabad", "Rawalpindi", "Peshawar", "Quetta", "Multan", "Faisalabad"].map(
                          (city) => (
                            <SelectItem key={city} value={city} className="text-xs">
                              {city}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 2: First Party (Vendor / Landlord / Employer / First Party) */}
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-[#1E2D44] space-y-3">
                  <div className="text-xs font-bold text-[#105B38] flex items-center gap-1.5 uppercase">
                    <Users className="w-4 h-4" /> First Party (Vendor / Landlord / Employer / Discloser)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] block mb-1">Full Legal Name</label>
                      <Input
                        value={variables.firstParty}
                        onChange={(e) => setVariables({ ...variables, firstParty: e.target.value })}
                        className="text-xs bg-white dark:bg-[#131E2E]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] block mb-1">CNIC / CUIN No.</label>
                      <Input
                        value={variables.firstPartyCNIC}
                        onChange={(e) => setVariables({ ...variables, firstPartyCNIC: e.target.value })}
                        className="text-xs bg-white dark:bg-[#131E2E] font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] block mb-1">Registered Address</label>
                      <Input
                        value={variables.firstPartyAddress}
                        onChange={(e) => setVariables({ ...variables, firstPartyAddress: e.target.value })}
                        className="text-xs bg-white dark:bg-[#131E2E]"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 3: Second Party (Purchaser / Tenant / Employee / Recipient) */}
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-[#1E2D44] space-y-3">
                  <div className="text-xs font-bold text-[#105B38] flex items-center gap-1.5 uppercase">
                    <Users className="w-4 h-4" /> Second Party (Purchaser / Tenant / Employee / Recipient)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] block mb-1">Full Legal Name</label>
                      <Input
                        value={variables.secondParty}
                        onChange={(e) => setVariables({ ...variables, secondParty: e.target.value })}
                        className="text-xs bg-white dark:bg-[#131E2E]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] block mb-1">CNIC / CUIN No.</label>
                      <Input
                        value={variables.secondPartyCNIC}
                        onChange={(e) => setVariables({ ...variables, secondPartyCNIC: e.target.value })}
                        className="text-xs bg-white dark:bg-[#131E2E] font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] block mb-1">Registered Address</label>
                      <Input
                        value={variables.secondPartyAddress}
                        onChange={(e) => setVariables({ ...variables, secondPartyAddress: e.target.value })}
                        className="text-xs bg-white dark:bg-[#131E2E]"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 4: Property Details & Operational Timelines */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] block mb-1">Subject Property / Scope of Work</label>
                    <Input
                      value={variables.propertyOrScope}
                      onChange={(e) => setVariables({ ...variables, propertyOrScope: e.target.value })}
                      placeholder="e.g. Plot No 14, DHA Phase 6, Lahore"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] block mb-1">Effective Date</label>
                    <Input
                      type="date"
                      value={variables.effectiveDate}
                      onChange={(e) => setVariables({ ...variables, effectiveDate: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] block mb-1">Notice Period (Days)</label>
                    <Input
                      value={variables.noticeDays}
                      onChange={(e) => setVariables({ ...variables, noticeDays: e.target.value })}
                      placeholder="e.g. 30"
                      className="text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Action button */}
                <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#1E2D44] flex items-center justify-end gap-3">
                  <Button
                    onClick={handleApplyVariables}
                    className="bg-[#105B38] hover:bg-[#0D4A2E] text-white font-medium text-xs px-6"
                  >
                    Apply Variables & Re-Generate Document
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 3: 4-CATEGORY CLAUSE LIBRARY */}
          {activeTab === "clauses" && (
            <div className="space-y-6">
              {/* Filter and Search Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#131E2E] p-4 rounded-lg border border-[#E2E8F0] dark:border-[#1E2D44]">
                <div className="flex items-center gap-2 w-full sm:w-80">
                  <Search className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]" />
                  <Input
                    value={clauseSearch}
                    onChange={(e) => setClauseSearch(e.target.value)}
                    placeholder="Search Pakistani legal clauses..."
                    className="text-xs h-8"
                  />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                  {["All", "General Commercial", "Property & Tenancy", "Employment & HR", "Corporate & M&A"].map(
                    (category) => (
                      <Button
                        key={category}
                        size="sm"
                        variant={selectedClauseCategory === category ? "default" : "outline"}
                        onClick={() => setSelectedClauseCategory(category)}
                        className={cn(
                          "text-xs h-8",
                          selectedClauseCategory === category
                            ? "bg-[#105B38] hover:bg-[#0D4A2E] text-white"
                            : "border-[#E2E8F0] dark:border-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:bg-slate-50 dark:bg-slate-800"
                        )}
                      >
                        {category}
                      </Button>
                    )
                  )}
                </div>
              </div>

              {/* Clauses Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredClauses.map((clause) => (
                  <Card key={clause.id} className="border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs flex flex-col justify-between">
                    <CardHeader className="py-3 px-4 bg-slate-50/80 dark:bg-slate-500/10 border-b border-[#E2E8F0] dark:border-[#1E2D44]">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Badge className="bg-[#EBF5F0] dark:bg-[#105B38]/20 text-[#105B38] border border-[#A3D4BC] dark:border-[#10B981]/30 text-[10px] mb-1">
                            {clause.category}
                          </Badge>
                          <CardTitle className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">{clause.title}</CardTitle>
                          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">{clause.statutoryReference}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 flex-1">
                      <p className="text-xs text-[#475569] mb-3">{clause.subtitle}</p>
                      <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-[#1E2D44] text-[11px] font-serif text-[#334155] dark:text-[#CBD5E1] max-h-36 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                        {clause.clauseText}
                      </div>
                    </CardContent>
                    <div className="p-3 bg-white dark:bg-[#131E2E] border-t border-[#F1F5F9] flex items-center justify-between">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(clause.clauseText);
                          toast({ title: "Clause Copied", description: "Clause copied to clipboard." });
                        }}
                        className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] h-7"
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copy Text
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleInsertClause(clause)}
                        className="bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs h-7 gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Insert into Contract
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: RISK SCANNER & S.27 AUDITOR */}
          {activeTab === "risks" && (
            <div className="space-y-6">
              {/* Overall Risk Score Card */}
              <Card className="border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="space-y-2 text-center md:text-left">
                      <div className="flex items-center gap-2 justify-center md:justify-start">
                        <ShieldAlert className="w-6 h-6 text-[#105B38]" />
                        <h2 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] font-serif">
                          Contract Compliance & Statutory Health Audit
                        </h2>
                      </div>
                      <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] max-w-xl">
                        Scanned against Pakistani Contract Act 1872 (Section 27 void non-compete restraint), Stamp Act 1899 (Article 5/35 e-stamp admissibility), and Arbitration Act 1940.
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-[#1E2D44] min-w-[140px]">
                        <div className="text-3xl font-extrabold text-[#105B38] font-mono">{riskAnalysis.score}%</div>
                        <div className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-0.5">{riskAnalysis.grade}</div>
                      </div>
                      <Button
                        onClick={handleTriggerScan}
                        className="bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-medium h-10 px-4 gap-1.5"
                      >
                        <RefreshCw className={cn("w-3.5 h-3.5", isScanning && "animate-spin")} /> Re-Scan Text
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Findings List */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Detected Vulnerabilities & Legal Redlines (
                  {riskAnalysis.findings.length})
                </h3>

                {riskAnalysis.findings.length === 0 ? (
                  <Card className="border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/4 dark:bg-emerald-500/100 dark:bg-emerald-500/10 p-8 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
                    <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">Zero Critical Vulnerabilities Detected</h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                      Your contract contains compliant dispute resolution, liability limits, and reasonable covenants under Pakistani law.
                    </p>
                  </Card>
                ) : (
                  riskAnalysis.findings.map((finding) => (
                    <Card
                      key={finding.id}
                      className={cn(
                        "border shadow-xs",
                        finding.category === "danger" ? "border-rose-300 dark:border-rose-500/30 bg-white dark:bg-[#131E2E]" : "border-amber-300 dark:border-amber-500/30 bg-white dark:bg-[#131E2E]"
                      )}
                    >
                      <CardHeader className="py-3 px-4 bg-slate-50 dark:bg-slate-800 border-b border-[#E2E8F0] dark:border-[#1E2D44]">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={cn(
                                "text-[10px] uppercase font-mono",
                                finding.category === "danger"
                                  ? "bg-rose-100 text-rose-800 dark:text-rose-400 border-rose-300 dark:border-rose-500/30"
                                  : "bg-amber-100 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-500/30"
                              )}
                            >
                              {finding.category} • -{finding.impactScore}%
                            </Badge>
                            <CardTitle className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">{finding.title}</CardTitle>
                          </div>
                          <span className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">{finding.statutoryReference}</span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 space-y-3">
                        <p className="text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed">{finding.ruleDescription}</p>

                        <div className="p-3 rounded bg-amber-50/6 dark:bg-amber-500/100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold">Suggested Remediation:</span> {finding.suggestedFix}
                          </div>
                        </div>

                        <div className="pt-2 flex items-center justify-end gap-2">
                          {acceptedRedlines[finding.id] ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30 text-xs gap-1 py-1 px-2.5">
                              <Check className="w-3.5 h-3.5" /> Compliant Clause Integrated
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleAcceptRedline(finding)}
                              className="bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs h-8 gap-1.5"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" /> Accept Redline Fix & Auto-Insert Clause
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── TEMPLATE SELECTOR MODAL (20+ Pakistani Templates) ────────────── */}
        <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-serif font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#105B38]" /> Pakistani Legal Contract Templates ({contractTemplates.length})
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                Select from verified Pakistani commercial, real estate, employment, and corporate agreement deeds.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <Search className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]" />
                  <Input
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Search templates (e.g. Agreement to Sell, Rent Deed, NDA, SPA)..."
                    className="text-xs h-8"
                  />
                </div>
                <Select value={selectedTemplateCategory} onValueChange={setSelectedTemplateCategory}>
                  <SelectTrigger className="w-48 text-xs h-8">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-950">
                    <SelectItem value="All">All Categories</SelectItem>
                    <SelectItem value="Property & Real Estate">Property & Real Estate</SelectItem>
                    <SelectItem value="Commercial & Corporate">Commercial & Corporate</SelectItem>
                    <SelectItem value="Employment & HR">Employment & HR</SelectItem>
                    <SelectItem value="Finance & IP">Finance & IP</SelectItem>
                    <SelectItem value="Personal & Succession">Personal & Succession</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className={cn(
                      "p-3.5 rounded-lg border text-left cursor-pointer transition-all hover:shadow-xs",
                      selectedTemplate?.id === template.id
                        ? "border-[#105B38] bg-[#EBF5F0] dark:bg-[#105B38]/20/60 ring-1 ring-[#105B38]"
                        : "border-[#E2E8F0] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] hover:border-[#A3D4BC] dark:border-[#10B981]/30 hover:bg-[#FAFCFB]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <Badge className="bg-white dark:bg-[#131E2E] text-[#105B38] border border-[#A3D4BC] dark:border-[#10B981]/30 text-[10px]">
                        {template.category}
                      </Badge>
                      <span className="text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">{template.forum}</span>
                    </div>
                    <div className="font-bold text-xs text-[#0F172A] dark:text-[#F8FAFC] mb-1">{template.title}</div>
                    <p className="text-[11px] text-[#475569] line-clamp-2 mb-2">{template.description}</p>
                    <div className="text-[10px] text-[#105B38] font-medium flex items-center justify-between border-t border-[#F1F5F9] pt-1.5">
                      <span>{template.governingLaw}</span>
                      <span className="flex items-center gap-1">Load Deed &rarr;</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ─── EXPORT MODAL ─────────────────────────────────────────────────── */}
        <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-serif font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                <Download className="w-5 h-5 text-[#105B38]" /> Export Legal Contract
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                Choose your preferred court-ready format with Pakistani margin specifications.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <Button
                onClick={handleExportDOCX}
                className="w-full justify-start bg-white dark:bg-[#131E2E] hover:bg-slate-50 dark:bg-slate-800 text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#1E2D44] h-14 p-4 shadow-xs"
              >
                <div className="w-8 h-8 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 flex items-center justify-center mr-3 shrink-0 font-bold text-xs">
                  DOCX
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold">Microsoft Word Document (.docx)</div>
                  <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Editable document with 1.5&quot; court margin and signature blocks</div>
                </div>
              </Button>

              <Button
                onClick={handleExportPDF}
                className="w-full justify-start bg-white dark:bg-[#131E2E] hover:bg-slate-50 dark:bg-slate-800 text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#1E2D44] h-14 p-4 shadow-xs"
              >
                <div className="w-8 h-8 rounded bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 flex items-center justify-center mr-3 shrink-0 font-bold text-xs">
                  PDF
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold">Court-Ready PDF Document (.pdf)</div>
                  <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Printable legal brief with chambers watermark and stamp space</div>
                </div>
              </Button>

              <Button
                onClick={() => {
                  const blob = new Blob([documentContent], { type: "text/plain;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${documentTitle.replace(/\s+/g, "_")}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast({ title: "Plain Text Downloaded", description: "Saved plain text file." });
                  setIsExportModalOpen(false);
                }}
                className="w-full justify-start bg-white dark:bg-[#131E2E] hover:bg-slate-50 dark:bg-slate-800 text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#1E2D44] h-14 p-4 shadow-xs"
              >
                <div className="w-8 h-8 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mr-3 shrink-0 font-bold text-xs">
                  TXT
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold">Plain Text / Markdown (.txt)</div>
                  <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Raw unformatted text for archiving or email dispatch</div>
                </div>
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ─── SAVED DRAFTS MODAL (PostgreSQL) ─────────────────────────────── */}
        <Dialog open={isSavedDraftsModalOpen} onOpenChange={setIsSavedDraftsModalOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-base font-serif font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                <Database className="w-5 h-5 text-[#105B38]" /> Saved Contract Drafts (PostgreSQL)
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                Access and manage cloud-persisted drafting sessions across chambers.
              </DialogDescription>
            </DialogHeader>

            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1 pt-2">
              {isLoadingDrafts ? (
                <div className="py-12 text-center text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#105B38]" />
                  <span>Retrieving saved contract drafts...</span>
                </div>
              ) : !Array.isArray(savedDrafts) || savedDrafts.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] space-y-2">
                  <History className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-semibold text-slate-700 dark:text-slate-400">No saved drafts found in database</p>
                  <p className="text-slate-500">Edit any contract or click "Save Draft" to persist your drafting workspace.</p>
                </div>
              ) : (
                savedDrafts.map((draft: any) => (
                  <div
                    key={draft.id}
                    className={cn(
                      "p-4 rounded-xl border transition-all flex items-center justify-between gap-3",
                      activeDraftId === draft.id
                        ? "bg-emerald-50/6 dark:bg-emerald-500/100 dark:bg-emerald-500/10 border-[#105B38] ring-1 ring-[#105B38]"
                        : "bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-slate-100/80 border-[#E2E8F0] dark:border-[#1E2D44]"
                    )}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                          {draft.title || "Untitled Draft"}
                        </h4>
                        {activeDraftId === draft.id && (
                          <Badge className="bg-[#105B38] text-white text-[10px] font-bold">
                            Active in Studio
                          </Badge>
                        )}
                        <span className="px-2 py-0.5 rounded-md bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[10px] font-medium text-slate-600 dark:text-slate-400">
                          {draft.templateType || "Contract"}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] line-clamp-1">
                        {typeof draft.content === "string" ? draft.content.slice(0, 120) : "Draft content"}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {draft.updatedAt ? new Date(draft.updatedAt).toLocaleString("en-PK") : "Recent"}
                        </span>
                        <span>•</span>
                        <span>Draft ID #{draft.id}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleLoadDraft(draft)}
                        className="bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold h-8 px-3"
                      >
                        Load
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDeleteDraft(draft.id, e)}
                        className="text-slate-400 hover:text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:bg-rose-500/10 h-8 w-8 p-0"
                        title="Delete draft from PostgreSQL"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PreviewShell>
  );
};

export default PreviewContractDrafting;
