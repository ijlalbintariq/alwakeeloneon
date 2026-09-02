import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PreviewShell } from "@/experimental/components/PreviewShell";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  FileSearch,
  Upload,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Scale,
  Copy,
  ChevronRight,
  ArrowRight,
  BookOpen,
  Download,
  Share2,
  Check,
  RefreshCw,
  Sliders,
  FileDown,
  Layers,
  FileCode,
  ShieldAlert,
  HelpCircle,
  Clock,
  Send,
  Eye,
  FileSpreadsheet,
  X,
  Columns,
  Maximize2,
  FileUp,
  RotateCcw,
  CheckSquare,
  AlertOctagon,
  Undo2,
  Edit3,
  Trash2,
  FolderOpen,
  Save,
  History,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PleadingFinding {
  id: string;
  category: string;
  status: "risk" | "warning" | "advisory" | "pass";
  title: string;
  statutoryBasis: string;
  description: string;
  originalSnippet: string;
  recommendedRedline: string;
  rationale: string;
  accepted?: boolean;
  dismissed?: boolean;
  insertedText?: string;
  replacedText?: string;
}

interface PresetDoc {
  id: string;
  name: string;
  type: string;
  content: string;
  findings: PleadingFinding[];
}

interface StatutoryCheckItem {
  id: string;
  statute: string;
  section: string;
  requirement: string;
  status: "compliant" | "warning" | "fatal_risk";
  detail: string;
}

function parseAiFindings(aiContent: string): { success: boolean; data: PleadingFinding[] } {
  if (!aiContent || typeof aiContent !== "string") return { success: false, data: [] };

  let jsonString = "";
  // 1. Try matching markdown code block ```json ... ```
  const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (jsonMatch) {
    jsonString = jsonMatch[1].trim();
  } else {
    // 2. Try finding array or object bounds
    const startBracket = aiContent.indexOf("[");
    const endBracket = aiContent.lastIndexOf("]");
    if (startBracket !== -1 && endBracket > startBracket) {
      jsonString = aiContent.slice(startBracket, endBracket + 1).trim();
    } else {
      const startBrace = aiContent.indexOf("{");
      const endBrace = aiContent.lastIndexOf("}");
      if (startBrace !== -1 && endBrace > startBrace) {
        jsonString = aiContent.slice(startBrace, endBrace + 1).trim();
      }
    }
  }

  if (jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      const items = Array.isArray(parsed)
        ? parsed
        : (parsed.findings || parsed.items || parsed.defects || parsed.analysis || []);

      if (Array.isArray(items)) {
        const data = items
          .filter((item: any) => item && typeof item === "object")
          .map((item: any, idx: number) => {
            const rawStatus = String(item.status || "warning").toLowerCase();
            const status: "risk" | "warning" | "advisory" | "pass" =
              rawStatus.includes("risk") || rawStatus.includes("fatal") || rawStatus.includes("defect") || rawStatus.includes("danger")
                ? "risk"
                : rawStatus.includes("warn") || rawStatus.includes("medium")
                ? "warning"
                : rawStatus.includes("pass") || rawStatus.includes("compliant") || rawStatus.includes("good")
                ? "pass"
                : "advisory";

            return {
              id: `ai-find-${idx + 1}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
              category: String(item.category || "Pakistani Procedural Law"),
              status,
              title: String(item.title || `Procedural Finding #${idx + 1}`),
              statutoryBasis: String(item.statutoryBasis || item.statute || "Pakistani Statutory Law"),
              description: String(item.description || item.detail || item.issue || ""),
              originalSnippet: String(item.originalSnippet || item.snippet || item.clause || ""),
              recommendedRedline: String(item.recommendedRedline || item.redline || item.suggestion || item.replacement || ""),
              rationale: String(item.rationale || item.reason || item.precedent || "Statutory compliance under Pakistani law."),
              accepted: status === "pass",
              dismissed: false,
            };
          });
        return { success: true, data };
      }
    } catch (e) {
      console.warn("[DocumentAnalyzer] JSON parsing error:", e);
    }
  }

  return { success: false, data: [] };
}



function autoDetectDocumentType(text: string): "pleading" | "contract" | "fir" | "application" | "legal_notice" {
  const t = text.toLowerCase();
  const pleadingScore = ["plaint", "petition", "appeal", "suit", "versus", "vs.", "v.", "respondent", "appellant", "defendant", "plaintiff", "in the court of", "civil judge", "high court", "supreme court", "writ", "jurisdiction", "prayer", "prays that"].filter(k => t.includes(k)).length;
  const contractScore = ["agreement", "deed", "memorandum", "mou", "contract", "between", "party of the first part", "hereinafter referred to as", "whereby", "witnesseth", "agreed terms", "lease", "partnership", "indemnity", "terms and conditions", "now this deed", "this agreement"].filter(k => t.includes(k)).length;
  const firScore = ["fir", "first information report", "police station", "ps", "offence", "accused", "complainant", "crpc", "ppc", "f.i.r"].filter(k => t.includes(k)).length;
  const appScore = ["application for", "stay application", "bail", "under section", "read with section 151", "applicant", "affidavit", "respectfully sheweth", "humbly submitted"].filter(k => t.includes(k)).length;
  const noticeScore = ["legal notice", "under instructions from my client", "defamation", "demand", "damages", "hereby give you notice", "advocate high court", "serve you with this legal notice"].filter(k => t.includes(k)).length;
  
  const scores = [
    { type: "pleading", score: pleadingScore },
    { type: "contract", score: contractScore },
    { type: "fir", score: firScore },
    { type: "application", score: appScore },
    { type: "legal_notice", score: noticeScore }
  ];
  
  scores.sort((a, b) => b.score - a.score);
  return (scores[0].score > 0 ? scores[0].type : "pleading") as any;
}

export const PreviewDocumentAnalyzer: React.FC = () => {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // State initialization with empty state (templates available on user click)
  const [documentText, setDocumentText] = useState<string>("");
  const [documentType, setDocumentType] = useState<"pleading" | "contract" | "fir" | "application" | "legal_notice">("pleading");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("blank");
  const [canvasMode, setCanvasMode] = useState<"annotated" | "raw">("raw");
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanPhaseText, setScanPhaseText] = useState<string>("");

  const activeChecklist = useMemo<StatutoryCheckItem[]>(() => {
    if (!serverChecklists) return [];
    switch (documentType) {
      case "contract": return serverChecklists.contract || [];
      case "fir": return serverChecklists.fir || [];
      case "application": return serverChecklists.app || [];
      case "legal_notice": return serverChecklists.notice || [];
      case "pleading":
      default:
        return serverChecklists.statutory || [];
    }
  }, [documentType, serverChecklists]);
  const [findings, setFindings] = useState<PleadingFinding[]>([]);

  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"standard" | "side_by_side">("standard");

  // Simulated upload states
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadStageText, setUploadStageText] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  // PostgreSQL Database Scans State
  const queryClient = useQueryClient();
  const [showSavedScansModal, setShowSavedScansModal] = useState<boolean>(false);
  const [currentScanId, setCurrentScanId] = useState<number | null>(null);
  const [isSavingScan, setIsSavingScan] = useState<boolean>(false);

  // Fetch previous scans from live PostgreSQL database
  const { data: savedScans = [], isLoading: isLoadingScans } = useQuery<any[]>({
    queryKey: ["/api/document-analyzer/scans"],
    queryFn: async () => {
      const res = await fetch("/api/document-analyzer/scans", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) return [];
        throw new Error("Failed to fetch saved scans");
      }
      return res.json();
    },
  });

  const { data: serverChecklists } = useQuery<any>({
    queryKey: ["/api/document-analyzer/checklists"],
    queryFn: async () => {
      const res = await fetch("/api/document-analyzer/checklists", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load statutory checklists");
      return res.json();
    },
    staleTime: Infinity,
  });

  // Database-backed state updater
  const persistState = useCallback((newText: string, newFindings: PleadingFinding[]) => {
    setDocumentText(newText);
    setFindings(newFindings);
  }, []);

  // Save current scan session and findings to PostgreSQL
  const saveScanToDb = async (customTitle?: string, textToSave?: string, findingsToSave?: PleadingFinding[]) => {
    const txt = textToSave ?? documentText;
    const fnds = findingsToSave ?? findings;
    if (!txt.trim()) {
      toast({
        title: "Canvas is Empty",
        description: "Cannot save an empty document scan session.",
        variant: "destructive",
      });
      return null;
    }

    setIsSavingScan(true);
    try {
      const autoTitle =
        customTitle ||
        txt.split("\n").find((l) => l.trim().length > 0)?.trim().slice(0, 60) ||
        "Legal Document Scan";

      const payload = {
        title: autoTitle,
        documentType,
        text: txt,
        summary: `${proceduralHealth} procedural health. ${fnds.length} statutory findings identified.`,
        overallRisk: proceduralHealth,
        findings: fnds.map((f) => ({
          pillar: f.category || "Procedural Defect",
          category: f.category || "General",
          severity: f.status || "warning",
          issue: f.title || f.description || "",
          statuteRef: f.statutoryBasis || null,
          recommendation: f.recommendedRedline || f.rationale || "",
          rawSnippet: f.originalSnippet || null,
          isResolved: Boolean(f.accepted),
        })),
      };

      const res = await fetch("/api/document-analyzer/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Save failed" }));
        throw new Error(err.message || `Save failed (${res.status})`);
      }

      const data = await res.json();
      if (data.scan?.id) {
        setCurrentScanId(data.scan.id);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/document-analyzer/scans"] });
      toast({
        title: "Scan Session Saved",
        description: `Persisted "${autoTitle}" to PostgreSQL database with ${fnds.length} findings.`,
      });
      return data;
    } catch (err: any) {
      console.error("[DocumentAnalyzer] Failed to save scan:", err);
      toast({
        title: "Failed to Save Scan",
        description: err.message || "Network error while saving scan to database.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsSavingScan(false);
    }
  };

  // Load previous scan session from PostgreSQL
  const handleLoadScan = async (scanId: number) => {
    try {
      const res = await fetch(`/api/document-analyzer/scans/${scanId}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load scan (${res.status})`);
      const data = await res.json();
      if (data.scan) {
        setDocumentText(data.scan.text || "");
        if (
          data.scan.documentType &&
          ["pleading", "contract", "fir", "application", "legal_notice"].includes(data.scan.documentType)
        ) {
          setDocumentType(data.scan.documentType as any);
        }
        setCurrentScanId(data.scan.id);
        setSelectedPresetId("blank");

        const mappedFindings: PleadingFinding[] = (data.findings || []).map((f: any, idx: number) => ({
          id: `fnd-db-${f.id || idx}`,
          category: f.category || f.pillar || "General",
          status: (["risk", "warning", "advisory", "pass"].includes(f.severity)
            ? f.severity
            : "warning") as PleadingFinding["status"],
          title: f.issue || `Finding ${idx + 1}`,
          statutoryBasis: f.statuteRef || "",
          description: f.issue || "",
          originalSnippet: f.rawSnippet || "",
          recommendedRedline: f.recommendation || "",
          rationale: f.recommendation || "",
          accepted: Boolean(f.isResolved),
          dismissed: false,
        }));

        setFindings(mappedFindings);
        setCanvasMode("annotated");
        setShowSavedScansModal(false);
        toast({
          title: "Scan Session Loaded",
          description: `Loaded "${data.scan.title}" with ${mappedFindings.length} findings from PostgreSQL.`,
        });
      }
    } catch (err: any) {
      console.error("[DocumentAnalyzer] Load scan error:", err);
      toast({
        title: "Failed to Load Scan",
        description: err.message || "Error retrieving scan record.",
        variant: "destructive",
      });
    }
  };

  // Delete scan session from PostgreSQL
  const handleDeleteScan = async (scanId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/document-analyzer/scans/${scanId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      if (currentScanId === scanId) setCurrentScanId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/document-analyzer/scans"] });
      toast({
        title: "Scan Deleted",
        description: "Document scan and associated findings deleted from PostgreSQL.",
      });
    } catch (err: any) {
      console.error("[DocumentAnalyzer] Delete scan error:", err);
      toast({
        title: "Delete Failed",
        description: err.message || "Failed to delete scan record.",
        variant: "destructive",
      });
    }
  };

  const activeFindings = useMemo(() => findings.filter((f) => !f.dismissed), [findings]);
  const riskFindings = useMemo(() => activeFindings.filter((f) => f.status === "risk" && !f.accepted), [activeFindings]);
  const warningFindings = useMemo(() => activeFindings.filter((f) => f.status === "warning" && !f.accepted), [activeFindings]);
  const advisoryFindings = useMemo(() => activeFindings.filter((f) => f.status === "advisory" && !f.accepted), [activeFindings]);
  const passedFindings = useMemo(() => activeFindings.filter((f) => f.status === "pass" || f.accepted), [activeFindings]);

  const calculatedScore = useMemo(() => {
    if (!documentText.trim() || findings.length === 0) return 0;
    return Math.max(
      0,
      Math.min(100, Math.round(riskFindings.length * 35 + warningFindings.length * 15 + advisoryFindings.length * 5))
    );
  }, [documentText, findings.length, riskFindings.length, warningFindings.length, advisoryFindings.length]);

  const proceduralHealth: "Compliant" | "Action Required" | "Vulnerable" = useMemo(() => {
    if (!documentText.trim() || findings.length === 0) return "Compliant";
    if (riskFindings.length > 0) return "Vulnerable";
    if (warningFindings.length > 0) return "Action Required";
    return "Compliant";
  }, [documentText, findings.length, riskFindings.length, warningFindings.length]);

  // Complete Reset & Clear All
  const handleClearAll = () => {
    persistState("", []);
    setSelectedPresetId("blank");
    setSelectedFindingId(null);
    setCurrentScanId(null);
    setCanvasMode("raw");
    toast({
      title: "Document & Canvas Cleared",
      description: "Ready for fresh pleading text, upload, or new template.",
    });
  };

  // Handle preset selection

  // Live Deep Legal Scanner with Backend AI & Offline Fallback
  const handleRunScan = async () => {
    if (!documentText.trim()) {
      toast({
        title: "Canvas is Empty",
        description: "Please enter or upload a legal pleading to scan.",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    setScanProgress(15);
    setScanPhaseText("Connecting to Pakistani Legal AI Analyzer Engine...");

    const progressTimer1 = setTimeout(() => {
      setScanProgress(45);
      setScanPhaseText("Auditing Order VII Rule 11 CPC & Section 24 SRA Averments...");
    }, 400);

    const progressTimer2 = setTimeout(() => {
      setScanProgress(75);
      setScanPhaseText("Auditing Article 113 Limitation Act 1908 & Court Fees Schedule...");
    }, 800);

    try {
      // Real AI Endpoint call with session credentials
      const pleadingPrompt = `You are the Al Wakeelo AI Procedural Compliance and Pleading Analyzer for Pakistani law.
Analyze the following Pakistani legal document / pleading for procedural defects, mandatory statutory averments, limitation issues, court fees valuation, and Order VII Rule 11 CPC vulnerabilities:

"""
${documentText}
"""

Return your findings ONLY as a JSON array inside a \`\`\`json block with objects matching this exact schema:
[
  {
    "category": "Statute name (e.g. Specific Relief Act 1877, Code of Civil Procedure 1908, Limitation Act 1908, Registration Act 1908, Court Fees Act 1870, General Clauses Act 1897)",`;

      const contractPrompt = `You are the Al Wakeelo AI Commercial Contract & Deed Analyzer for Pakistani law.
Analyze the following Pakistani legal contract / deed for statutory risks under the Contract Act 1872, Registration Act 1908 (e.g. Section 17 mandatory registration), Stamp Act 1899, Transfer of Property Act 1882, and missing standard clauses (e.g. Dispute Resolution, Arbitration, Force Majeure, Indemnity):

"""
${documentText}
"""

Return your findings ONLY as a JSON array inside a \`\`\`json block with objects matching this exact schema:
[
  {
    "category": "Statute name (e.g. Contract Act 1872, Registration Act 1908, Stamp Act 1899, Arbitration Act 1940, Transfer of Property Act 1882)",`;

            const firPrompt = `You are the Al Wakeelo AI Criminal Law Analyzer for Pakistani law.
Analyze the following Pakistani FIR or criminal complaint for CrPC procedural defects, evidentiary gaps, Section 154 CrPC compliance, delay in registration issues, and missing elements for establishing cognizable offenses under PPC:

"""
${documentText}
"""

Return your findings ONLY as a JSON array inside a \`\`\`json block with objects matching this exact schema:
[
  {
    "category": "Statute name (e.g. Criminal Procedure Code 1898, Pakistan Penal Code 1860)",`;

      const appPrompt = `You are the Al Wakeelo AI Court Application Analyzer for Pakistani law.
Analyze the following Pakistani court application for statutory backing, affidavit requirements, and procedural maintainability under the Code of Civil Procedure 1908 or CrPC 1898:

"""
${documentText}
"""

Return your findings ONLY as a JSON array inside a \`\`\`json block with objects matching this exact schema:
[
  {
    "category": "Statute name (e.g. Code of Civil Procedure 1908, Criminal Procedure Code 1898)",`;

      const noticePrompt = `You are the Al Wakeelo AI Legal Notice Analyzer for Pakistani law.
Analyze the following Pakistani Legal Notice for compliance with statutory notice periods (e.g., Section 80 CPC, Defamation Ordinance), cause of action clarity, and litigation threat enforceability:

"""
${documentText}
"""

Return your findings ONLY as a JSON array inside a \`\`\`json block with objects matching this exact schema:
[
  {
    "category": "Statute name (e.g. Code of Civil Procedure 1908, Defamation Ordinance 2002)",`;

      const activePrompt = documentType === "pleading" ? pleadingPrompt :
                           documentType === "contract" ? contractPrompt :
                           documentType === "fir" ? firPrompt :
                           documentType === "application" ? appPrompt :
                           noticePrompt;

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `${activePrompt}
    "status": "risk" | "warning" | "advisory" | "pass",
    "title": "Short descriptive title of the defect or compliance",
    "statutoryBasis": "Specific section and statute with citation (e.g. Section 24(c) Specific Relief Act 1877 & PLD 2021 SC 429)",
    "description": "Detailed explanation of the procedural defect or requirement",
    "originalSnippet": "Exact phrase from the document that needs redline (or leave blank if general)",
    "recommendedRedline": "Proposed statutory compliant replacement clause or averment",
    "rationale": "Legal reasoning and relevant Pakistani Supreme Court / High Court precedent"
  }
]`,
            },
          ],
          type: "al-wakeelo",
          moduleIntent: "document-analysis",
        }),
      });

      clearTimeout(progressTimer1);
      clearTimeout(progressTimer2);
      setScanProgress(90);

      if (!response.ok) {
        throw new Error(`AI analysis endpoint returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const aiContent = data.content || data.text || "";
      const parseResult = parseAiFindings(aiContent);

      if (parseResult.success) {
        setScanProgress(100);
        persistState(documentText, parseResult.data);
        const firstLine = documentText.split("\n").find((l) => l.trim().length > 0)?.trim() || "Legal Document";
        await saveScanToDb(
          `AI Scan: ${firstLine.slice(0, 50)}`,
          documentText,
          parseResult.data
        );
        toast({
          title: "AI Scan Completed & Persisted",
          description: parseResult.data.length === 0 
            ? "No active vulnerabilities found. Scan record saved to database." 
            : `Identified ${parseResult.data.length} statutory findings and saved to PostgreSQL.`,
        });
        return;
      }

      setScanProgress(100);
      toast({
        title: "AI Scan Failed",
        description: `AI returned an unrecognized format. Please try again.`,
        variant: "destructive",
      });
    } catch (err: any) {
      clearTimeout(progressTimer1);
      clearTimeout(progressTimer2);
      console.error("[DocumentAnalyzer] Live AI scan failed:", err?.message || err);

      setScanProgress(100);
      toast({
        title: "AI Analysis Failed",
        description: err.message || `Failed to scan document via AI engine.`,
        variant: "destructive"
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Accept & Apply Redline
  const handleAcceptFinding = (findingId: string) => {
    const target = findings.find((f) => f.id === findingId);
    if (!target) return;

    let updatedText = documentText;
    let replacedText = "";
    let insertedText = target.recommendedRedline;

    if (target.originalSnippet && updatedText.includes(target.originalSnippet)) {
      replacedText = target.originalSnippet;
      updatedText = updatedText.replace(target.originalSnippet, target.recommendedRedline);
    } else {
      if (updatedText.includes("PRAYER:")) {
        updatedText = updatedText.replace("PRAYER:", `${target.recommendedRedline}\n\nPRAYER:`);
      } else {
        updatedText = `${updatedText}\n\n${target.recommendedRedline}`;
      }
    }

    const updatedFindings = findings.map((f) =>
      f.id === findingId ? { ...f, accepted: true, replacedText, insertedText } : f
    );

    persistState(updatedText, updatedFindings);
    setSelectedFindingId(findingId);
    toast({
      title: "Redline Inserted",
      description: "Pleading updated with statutory compliant averment.",
    });
  };

  // Revert / Undo Redline
  const handleRevertFinding = (findingId: string) => {
    const target = findings.find((f) => f.id === findingId);
    if (!target) return;

    let updatedText = documentText;
    if (target.insertedText && target.replacedText && updatedText.includes(target.insertedText)) {
      updatedText = updatedText.replace(target.insertedText, target.replacedText);
    } else if (target.insertedText && updatedText.includes(target.insertedText)) {
      updatedText = updatedText.replace(target.insertedText, "");
    }

    const updatedFindings = findings.map((f) =>
      f.id === findingId ? { ...f, accepted: false, replacedText: undefined, insertedText: undefined } : f
    );

    persistState(updatedText, updatedFindings);
    toast({
      title: "Redline Reverted",
      description: "Restored original clause text in the canvas.",
    });
  };

  // Dismiss Finding
  const handleDismissFinding = (findingId: string) => {
    const updatedFindings = findings.map((f) => (f.id === findingId ? { ...f, dismissed: true } : f));
    persistState(documentText, updatedFindings);
    toast({
      title: "Finding Dismissed",
      description: "Removed from active audit findings.",
    });
  };

  // Real File Upload Handler
  const handleRealFileUpload = async () => {
    if (!uploadFile) return;

    setIsUploadingFile(true);
    setUploadProgress(15);
    setUploadStageText("Uploading document and initiating OCR text extraction...");

    try {
      const formData = new FormData();
      formData.append("files", uploadFile);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      setUploadProgress(70);
      setUploadStageText("Parsing content and finalizing extraction...");

      const data = await res.json();
      if (!data.documents || data.documents.length === 0) {
        throw new Error("No document text could be extracted.");
      }

      const extractedText = data.documents[0].content || "";

      setUploadProgress(100);
      setIsUploadingFile(false);
      setShowUploadModal(false);

      // Clean the canvas and push the extracted text
      const detected = autoDetectDocumentType(extractedText);
      setDocumentType(detected);
      persistState(extractedText, []);
      setSelectedPresetId("blank");
      setCanvasMode("raw");
      setUploadFile(null);
      
      toast({
        title: "Document Extracted",
        description: `Successfully extracted text from ${uploadFile.name}. Ready for AI analysis.`,
      });
      
    } catch (err: any) {
      console.error("[DocumentAnalyzer] Upload failed:", err);
      setIsUploadingFile(false);
      toast({
        title: "Upload Failed",
        description: err.message || "Failed to extract text from document.",
        variant: "destructive",
      });
    }
  };

  // Copy Markdown Report
  const handleCopyMarkdownReport = () => {
    const reportMd =
      `# Al Wakeelo Legal Document Risk Audit Report\n` +
      `Date: ${new Date().toISOString().substring(0, 10)} PKT\n` +
      `Procedural Health Status: ${proceduralHealth}\n` +
      `Overall Risk Score: ${calculatedScore}%\n\n` +
      `## Statutory Checklist Status\n` +
      activeChecklist.map((r) => `- [${r.status.toUpperCase()}] ${r.statute} (${r.section}): ${r.requirement}`).join("\n") +
      `\n\n## Risk Breakdown\n` +
      `- High Risk / Fatal Deficiencies: ${riskFindings.length}\n` +
      `- Medium Risk / Procedural Warnings: ${warningFindings.length}\n` +
      `- Low Risk / Advisory Notes: ${advisoryFindings.length}\n` +
      `- Compliant Clauses: ${passedFindings.length}\n\n` +
      `## Detailed Findings & Statutory Basis:\n` +
      findings
        .map(
          (f, idx) =>
            `${idx + 1}. [${f.status.toUpperCase()}] ${f.title}\n` +
            `Statutory Basis: ${f.statutoryBasis}\n` +
            `Description: ${f.description}\n` +
            `Recommended Redline: ${f.recommendedRedline}\n` +
            `Rationale: ${f.rationale}\n`
        )
        .join("\n");

    navigator.clipboard.writeText(reportMd).then(() => {
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2000);
      toast({
        title: "Audit Report Copied (Markdown)",
        description: "Full risk audit copied to clipboard for chamber circulation.",
      });
    });
  };

  // Open in Drafting Studio
  const handleOpenInDrafting = () => {
    try {
      localStorage.setItem("alwakeelo_drafting_insert", JSON.stringify({ clause: documentText }));
    } catch (e) {
      console.warn(e);
    }
    toast({
      title: "Exported to Drafting Studio",
      description: "Navigating to Legal Drafting Editor with updated clauses.",
    });
    setLocation("/preview/drafting");
  };

  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (f.dismissed) return false;
      if (filterSeverity === "all") return true;
      if (filterSeverity === "risk") return f.status === "risk" && !f.accepted;
      if (filterSeverity === "warning") return f.status === "warning" && !f.accepted;
      if (filterSeverity === "pass") return f.status === "pass" || f.accepted;
      return true;
    });
  }, [findings, filterSeverity]);

  const wordCount = useMemo(() => (documentText.trim() ? documentText.trim().split(/\s+/).length : 0), [documentText]);
  const lineCount = useMemo(() => (documentText.trim() ? documentText.split("\n").length : 0), [documentText]);

  // Clean document text rendering with numbered pointer chips [1], [2], [3]
  const renderCleanAnnotatedDocument = () => {
    const paragraphs = documentText.split("\n\n");

    return (
      <div className="space-y-4 text-xs font-mono text-[#0F172A] leading-relaxed select-text">
        {paragraphs.map((para, pIdx) => {
          let paraContent: React.ReactNode = para;

          // Check if any finding matches this paragraph
          const matchedFindingWithIndex = findings
            .map((f, idx) => ({ finding: f, pointerNumber: idx + 1 }))
            .find(({ finding }) => {
              if (finding.dismissed) return false;
              if (finding.accepted) {
                const checkText = (finding.insertedText || finding.recommendedRedline || "").trim();
                return checkText.length > 0 && para.includes(checkText);
              } else {
                const checkText = (finding.originalSnippet || "").trim();
                return checkText.length > 0 && para.includes(checkText);
              }
            });

          if (matchedFindingWithIndex) {
            const { finding, pointerNumber } = matchedFindingWithIndex;

            if (finding.accepted) {
              const targetSnippet = (finding.insertedText || finding.recommendedRedline || "").trim();
              const splitIdx = para.indexOf(targetSnippet);

              if (splitIdx !== -1) {
                const before = para.substring(0, splitIdx);
                const match = targetSnippet;
                const after = para.substring(splitIdx + targetSnippet.length);

                paraContent = (
                  <span>
                    {before}
                    <span
                      onClick={() => {
                        setSelectedFindingId(finding.id);
                        document.getElementById(`finding-card-${finding.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      }}
                      className={cn(
                        "bg-emerald-50 text-[#0D4A2E] border-b-2 border-emerald-600 px-1 py-0.5 rounded cursor-pointer transition-all inline",
                        selectedFindingId === finding.id && "ring-2 ring-[#105B38] font-bold"
                      )}
                      title={`Statutory Redline Applied for Suggestion [${pointerNumber}] - Click to view`}
                    >
                      {match}
                      <span className="inline-flex items-center gap-0.5 ml-1.5 px-1.5 py-0.5 rounded bg-[#105B38] text-white text-[10px] font-bold align-baseline shadow-2xs">
                        [{pointerNumber} ✓]
                      </span>
                    </span>
                    {after}
                  </span>
                );
              }
            } else {
              const targetSnippet = (finding.originalSnippet || "").trim();
              const splitIdx = para.indexOf(targetSnippet);

              if (splitIdx !== -1) {
                const before = para.substring(0, splitIdx);
                const match = targetSnippet;
                const after = para.substring(splitIdx + targetSnippet.length);

                paraContent = (
                  <span>
                    {before}
                    <span
                      onClick={() => {
                        setSelectedFindingId(finding.id);
                        document.getElementById(`finding-card-${finding.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      }}
                      className={cn(
                        "bg-rose-50 text-rose-900 border-b-2 border-rose-500 px-1 py-0.5 rounded cursor-pointer transition-all inline",
                        selectedFindingId === finding.id && "ring-2 ring-rose-500 font-bold"
                      )}
                      title={`Deficiency [${pointerNumber}]: ${finding.title} - Click to view`}
                    >
                      {match}
                      <span className="inline-flex items-center gap-0.5 ml-1.5 px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold align-baseline shadow-2xs animate-pulse">
                        [{pointerNumber}]
                      </span>
                    </span>
                    {after}
                  </span>
                );
              }
            }
          }

          return (
            <p key={pIdx} className="whitespace-pre-wrap leading-relaxed">
              {paraContent}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <PreviewShell>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Header with Clean Horizontal Button Grid & Dynamic Health Indicator */}
        <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#105B38] text-white shadow-xs">
              <FileSearch className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A]">
                  AI Procedural Compliance & Document Analyzer
                </h1>
                <span
                  className={cn(
                    "text-xs font-bold px-3 py-1 rounded-full border shadow-xs flex items-center gap-1.5",
                    proceduralHealth === "Vulnerable"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : proceduralHealth === "Action Required"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-emerald-50 text-[#105B38] border-emerald-200"
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  {proceduralHealth === "Vulnerable"
                    ? `${riskFindings.length} Critical Risks`
                    : proceduralHealth === "Action Required"
                    ? `${warningFindings.length} Warnings`
                    : "Fully Compliant"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#64748B] mt-1">
                Audit plaints, writ petitions, leases, and contracts for Order VII R.11 CPC vulnerabilities, SRA Section 24 omissions & limitation risks.
              </p>
            </div>
          </div>

          {/* Balanced Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSavedScansModal(true)}
              className="px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#0F172A] transition-colors flex items-center gap-1.5 shadow-xs"
              title="View and load previous scans saved in PostgreSQL"
            >
              <History className="w-4 h-4 text-[#105B38]" />
              <span>Saved Scans ({Array.isArray(savedScans) ? savedScans.length : 0})</span>
            </button>

            <button
              type="button"
              onClick={() => saveScanToDb()}
              disabled={isSavingScan || !documentText.trim()}
              className="px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#0F172A] transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              title="Save current scan and findings to PostgreSQL database"
            >
              <Save className="w-4 h-4 text-[#105B38]" />
              <span>{isSavingScan ? "Saving..." : "Save Scan"}</span>
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              className="px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-rose-50 border border-[#E2E8F0] hover:border-rose-200 text-xs font-bold text-[#64748B] hover:text-rose-700 transition-colors flex items-center gap-1.5 shadow-xs"
              title="Clear entire document canvas and reset findings"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Clear Document</span>
            </button>

            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#0F172A] transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Upload className="w-4 h-4 text-[#105B38]" />
              <span>Upload Document</span>
            </button>

            <button
              type="button"
              onClick={handleCopyMarkdownReport}
              className="px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#0F172A] transition-colors flex items-center gap-1.5 shadow-xs"
            >
              {copiedReport ? <Check className="w-4 h-4 text-[#105B38]" /> : <Copy className="w-4 h-4" />}
              <span>{copiedReport ? "Copied" : "Copy Report"}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenInDrafting}
              className="px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#0F172A] transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <FileCode className="w-4 h-4 text-[#105B38]" />
              <span>Open in Drafting</span>
            </button>

            <button
              type="button"
              onClick={handleRunScan}
              disabled={isScanning}
              className="px-5 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isScanning ? "Scanning..." : "Deep Legal Scan"}</span>
            </button>
          </div>
        </div>

        {/* Scan Progress Bar */}
        {isScanning && (
          <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-[#0F172A]">
              <span className="flex items-center gap-2 text-[#105B38]">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{scanPhaseText}</span>
              </span>
              <span className="font-mono">{scanProgress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
              <div
                className="h-full bg-[#105B38] rounded-full transition-all duration-300"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Top Summary Metrics Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B]">
                Procedural Health
              </span>
              <ShieldAlert
                className={cn(
                  "w-4 h-4",
                  proceduralHealth === "Vulnerable"
                    ? "text-rose-600"
                    : proceduralHealth === "Action Required"
                    ? "text-amber-600"
                    : "text-[#105B38]"
                )}
              />
            </div>
            <div>
              <div
                className={cn(
                  "text-lg sm:text-xl font-bold",
                  proceduralHealth === "Vulnerable"
                    ? "text-rose-600"
                    : proceduralHealth === "Action Required"
                    ? "text-amber-600"
                    : "text-[#105B38]"
                )}
              >
                {proceduralHealth}
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">5 Statutory audits</p>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B]">
                Overall Risk Score
              </span>
              <span
                className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded-full",
                  calculatedScore > 50
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : calculatedScore > 20
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-emerald-50 text-[#105B38] border border-emerald-200"
                )}
              >
                {calculatedScore > 50 ? "High Risk" : calculatedScore > 20 ? "Moderate" : "Low Risk"}
              </span>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-mono font-bold text-[#0F172A]">
                {calculatedScore} / 100
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">Weighted defect index</p>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B]">
                Fatal Risk Clauses
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <div className="text-lg sm:text-xl font-mono font-bold text-rose-600">
                {riskFindings.length}
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                {riskFindings.length === 0 ? "0 Defects remaining" : `${riskFindings.length} Critical defects`}
              </p>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B]">
                Verified Compliant
              </span>
              <CheckCircle2 className="w-4 h-4 text-[#105B38]" />
            </div>
            <div>
              <div className="text-lg sm:text-xl font-mono font-bold text-[#105B38]">
                {passedFindings.length}
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                {passedFindings.length} Clauses conforming
              </p>
            </div>
          </div>
        </div>

        {/* Statutory Compliance Checklist Panel with Full Multi-line Readability */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-[#105B38]" />
              <span>
                {documentType === "contract" ? "Commercial Contract Compliance Checklist" :
                 documentType === "fir" ? "Criminal FIR Statutory Checklist" :
                 documentType === "application" ? "Court Application Maintainability Checklist" :
                 documentType === "legal_notice" ? "Legal Notice Statutory Checklist" :
                 "Civil Pleading Procedural Checklist"}
              </span>
            </h2>
            <span className="text-xs font-semibold text-[#64748B]">
              {activeChecklist.length} Core Statutory Audits
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {activeChecklist.map((rule) => {
              const hasRisk = findings.some(
                (f) =>
                  !f.dismissed &&
                  !f.accepted &&
                  f.status === "risk" &&
                  (f.category.toLowerCase().includes(rule.statute.toLowerCase().slice(0, 5)) ||
                    f.statutoryBasis.toLowerCase().includes(rule.section.toLowerCase().slice(0, 5)))
              );

              return (
                <div
                  key={rule.id}
                  className={cn(
                    "p-3.5 rounded-2xl border text-xs space-y-1.5 transition-all",
                    hasRisk
                      ? "bg-rose-50/50 border-rose-200"
                      : "bg-white border-[#E2E8F0] hover:border-emerald-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-bold text-[#0F172A] leading-tight">
                      {rule.section}
                    </span>
                    {hasRisk ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                        Deficiency
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#105B38] border border-emerald-200 shrink-0">
                        Checked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    {rule.requirement}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* View Control Bar */}
        <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-2 shrink-0">
              <FileText className="w-4 h-4 text-[#105B38]" />
              <span className="text-xs font-bold text-[#0F172A]">Document Type:</span>
            </div>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as any)}
              className="w-full max-w-xs h-9 px-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#105B38]"
            >
              <option value="pleading">Court Pleading (Plaint/Petition/Appeal)</option>
              <option value="contract">Commercial Contract (Agreement/Deed)</option>
              <option value="fir">First Information Report (FIR)</option>
              <option value="application">Misc. Court Application (Bail/Stay)</option>
              <option value="legal_notice">Legal Notice / Statutory Notice</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === "standard" ? "side_by_side" : "standard")}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all shadow-xs",
                viewMode === "side_by_side"
                  ? "bg-[#105B38] text-white border-[#105B38]"
                  : "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:bg-[#F1F5F9]"
              )}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>{viewMode === "side_by_side" ? "Side-by-Side View" : "Standard View"}</span>
            </button>
          </div>
        </div>

        {/* Workspace: Switches dynamically between Standard View and Side-by-Side View */}
        {viewMode === "standard" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Clean Pleading Canvas with Numbered Pointer Chips [1], [2], [3] (5 cols) */}
            <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col space-y-3">
              {/* Canvas Header & Mode Switcher */}
              <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0] gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A] flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#105B38]" />
                    <span>Pleading Canvas</span>
                  </span>
                  {riskFindings.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      {riskFindings.length} Pointers Active
                    </span>
                  )}
                </div>

                {/* Canvas Mode Switcher: Annotated Redlines vs Raw Text Edit */}
                <div className="flex items-center gap-1 bg-[#F8FAFC] p-0.5 rounded-xl border border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={() => setCanvasMode("annotated")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                      canvasMode === "annotated"
                        ? "bg-white text-[#105B38] shadow-xs border border-[#E2E8F0]"
                        : "text-[#64748B] hover:text-[#0F172A]"
                    )}
                    title="View live redlines and numbered pointer chips [1], [2]..."
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#105B38]" />
                    <span>Redlines & Pointers</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanvasMode("raw")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                      canvasMode === "raw"
                        ? "bg-white text-[#0F172A] shadow-xs border border-[#E2E8F0]"
                        : "text-[#64748B] hover:text-[#0F172A]"
                    )}
                    title="Edit raw document text directly"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Raw Edit</span>
                  </button>
                </div>
              </div>

              {/* Canvas Body: Clean Document vs Raw Textarea vs Empty State */}
              {!documentText.trim() && canvasMode === "annotated" ? (
                <div className="w-full flex-1 min-h-[520px] max-h-[620px] p-8 rounded-xl bg-[#F8FAFC] border border-dashed border-[#CBD5E1] flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs flex items-center justify-center text-[#105B38]">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="max-w-md space-y-1">
                    <h3 className="text-sm font-bold text-[#0F172A]">Document Canvas is Empty</h3>
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      Paste your plaint, contract, or petition text directly, upload a document, or load a sample template to start procedural scanning.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setCanvasMode("raw")}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#0F172A] shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Edit3 className="w-4 h-4 text-[#105B38]" />
                      <span>Paste / Type Text</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(true)}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#0F172A] shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Upload className="w-4 h-4 text-[#105B38]" />
                      <span>Upload File</span>
                    </button>
                  </div>
                </div>
              ) : canvasMode === "annotated" ? (
                <div className="w-full flex-1 min-h-[520px] max-h-[620px] overflow-y-auto p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] custom-scrollbar">
                  {renderCleanAnnotatedDocument()}
                </div>
              ) : (
                <textarea
                  value={documentText}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (documentText.trim().length === 0 && val.trim().length > 100) {
                      setDocumentType(autoDetectDocumentType(val));
                    }
                    persistState(val, findings);
                  }}
                  placeholder="Paste pleading text, plaint, contract, or legal notice to analyze..."
                  className="w-full flex-1 min-h-[520px] p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-mono text-[#0F172A] leading-relaxed resize-none focus:outline-none focus:border-[#105B38] focus:bg-white custom-scrollbar"
                />
              )}

              {/* Canvas Footer */}
              <div className="pt-2 flex items-center justify-between border-t border-[#E2E8F0]">
                <div className="text-xs font-mono text-[#64748B] flex items-center gap-3">
                  <span>{wordCount} Words</span>
                  <span>·</span>
                  <span>{lineCount} Lines</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs text-[#64748B] hover:text-rose-600 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Reset & Clear All</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenInDrafting}
                    disabled={!documentText.trim()}
                    className="px-4 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>Open in Drafting</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Clause-by-Clause Findings & Redlines with Dedicated Scroll Container (7 cols) */}
            <div className="lg:col-span-7 flex flex-col space-y-3">
              {/* Findings Filter Chips */}
              <div className="bg-white p-3 rounded-2xl border border-[#E2E8F0] shadow-xs flex items-center justify-between gap-2 flex-wrap shrink-0">
                <span className="text-xs font-bold text-[#0F172A] ml-2">
                  Procedural Findings ({filteredFindings.length})
                </span>

                <div className="flex items-center gap-1.5">
                  {[
                    { id: "all", label: "All Items" },
                    { id: "risk", label: `Fatal Risks (${riskFindings.length})` },
                    { id: "warning", label: `Warnings (${warningFindings.length})` },
                    { id: "pass", label: `Compliant (${passedFindings.length})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilterSeverity(tab.id)}
                      className={cn(
                        "px-3 py-1 rounded-xl text-xs font-semibold transition-all shadow-xs",
                        filterSeverity === tab.id
                          ? "bg-[#105B38] text-white border border-[#105B38]"
                          : "bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9] border border-[#E2E8F0]"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Findings Cards Container */}
              <div className="flex-1 min-h-[520px] max-h-[620px] overflow-y-auto space-y-3.5 pr-1.5 custom-scrollbar">
                {filteredFindings.map((finding) => {
                  const pointerNumber = findings.findIndex((f) => f.id === finding.id) + 1;
                  const isPass = finding.status === "pass" || finding.accepted;
                  const isRisk = finding.status === "risk" && !finding.accepted;
                  const isWarning = finding.status === "warning" && !finding.accepted;

                  return (
                    <div
                      key={finding.id}
                      id={`finding-card-${finding.id}`}
                      onClick={() => setSelectedFindingId(finding.id)}
                      className={cn(
                        "bg-white p-5 rounded-2xl border shadow-xs space-y-3.5 transition-all cursor-pointer",
                        isRisk
                          ? "border-rose-200 hover:border-rose-400"
                          : isWarning
                          ? "border-amber-200 hover:border-amber-400"
                          : "border-emerald-200 hover:border-emerald-400",
                        selectedFindingId === finding.id && "ring-2 ring-[#105B38]"
                      )}
                    >
                      {/* Header with Numbered Pointer Badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-lg bg-[#0F172A] text-white text-xs font-bold font-mono">
                              Pointer [{pointerNumber}]
                            </span>

                            <span
                              className={cn(
                                "text-xs font-bold px-2.5 py-0.5 rounded-full uppercase",
                                isRisk
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : isWarning
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-emerald-50 text-[#105B38] border border-emerald-200"
                              )}
                            >
                              {finding.category}
                            </span>

                            <span className="text-xs font-mono font-bold text-[#64748B]">
                              {finding.statutoryBasis}
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-[#0F172A]">{finding.title}</h3>
                        </div>

                        {finding.accepted ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-[#105B38] border border-emerald-200 flex items-center gap-1 shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Redline Applied
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRevertFinding(finding.id);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="Undo this redline"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                              <span>Undo</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDismissFinding(finding.id);
                            }}
                            className="p-1 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
                            title="Dismiss finding"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-[#64748B] leading-relaxed">{finding.description}</p>

                      {/* Original vs Redline Comparison Box */}
                      <div className="space-y-2 pt-1">
                        {finding.originalSnippet && (
                          <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-100 space-y-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-rose-700 block">
                              Current Pleading Clause (Vulnerable)
                            </span>
                            <p className="text-xs font-mono text-[#0F172A] leading-relaxed">
                              {finding.originalSnippet}
                            </p>
                          </div>
                        )}

                        <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-[#105B38] block">
                            Recommended Statutory Redline
                          </span>
                          <p className="text-xs font-mono text-[#0F172A] leading-relaxed">
                            {finding.recommendedRedline}
                          </p>
                        </div>
                      </div>

                      {/* Precedent Rationale */}
                      <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-2.5 text-xs text-[#334155]">
                        <Scale className="w-4 h-4 text-[#105B38] shrink-0 mt-0.5" />
                        <div>
                          <strong>Judicial Ratio & Precedent Authority:</strong> {finding.rationale}
                        </div>
                      </div>

                      {/* Action Bar */}
                      {!finding.accepted && (
                        <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#E2E8F0]">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDismissFinding(finding.id);
                            }}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
                          >
                            Reject / Dismiss
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcceptFinding(finding.id);
                            }}
                            className="px-4 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Accept & Insert Redline</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredFindings.length === 0 && (
                  <div className="bg-white p-12 rounded-2xl border border-[#E2E8F0] shadow-xs text-center space-y-2">
                    <ShieldCheck className="w-10 h-10 text-[#105B38] mx-auto" />
                    <h4 className="text-sm font-bold text-[#0F172A]">
                      {!documentText.trim() ? "No Document Loaded" : "No Active Vulnerabilities Found"}
                    </h4>
                    <p className="text-xs text-[#64748B]">
                      {!documentText.trim()
                        ? "Paste or upload a pleading draft to run a comprehensive procedural risk audit."
                        : "All scanned clauses conform with mandatory statutory averments and limitation timelines."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Side-by-Side Dual Comparison Workspace */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
            {/* Left: Original / Editable Canvas */}
            <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-3 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#105B38]" />
                  <span>Original Pleading Canvas</span>
                </span>
                <span className="text-xs font-mono text-[#64748B]">{wordCount} words</span>
              </div>
              <textarea
                value={documentText}
                onChange={(e) => {
                  const val = e.target.value;
                  if (documentText.trim().length === 0 && val.trim().length > 100) {
                    setDocumentType(autoDetectDocumentType(val));
                  }
                  persistState(val, findings);
                }}
                className="w-full flex-1 min-h-[540px] p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-mono text-[#0F172A] leading-relaxed resize-none focus:outline-none focus:border-[#105B38] focus:bg-white custom-scrollbar"
              />
            </div>

            {/* Right: Redline Applied Preview & Live Diff */}
            <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#105B38] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#105B38]" />
                  <span>Statutory Redlined Pleading (Live Diff)</span>
                </span>
                <span className="text-xs font-semibold text-[#105B38] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {passedFindings.length} Averments Active
                </span>
              </div>

              <div className="flex-1 min-h-[540px] p-4 rounded-xl bg-emerald-50/20 border border-emerald-200/60 overflow-y-auto text-xs font-mono text-[#0F172A] leading-relaxed whitespace-pre-wrap space-y-2 custom-scrollbar">
                {documentText ? renderCleanAnnotatedDocument() : "No pleading loaded. Paste or upload text on the left."}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={handleOpenInDrafting}
                  disabled={!documentText.trim()}
                  className="px-4 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Load Into Drafting Studio</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Simulation Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <div className="flex items-center gap-2">
                  <FileUp className="w-5 h-5 text-[#105B38]" />
                  <h3 className="text-sm font-bold text-[#0F172A]">Upload & Ingest Legal Document</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="p-1 rounded-lg text-[#64748B] hover:text-[#0F172A]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-[#64748B]">
                  Simulate direct ingestion of Pakistani court pleadings, registered deeds, or commercial agreements.
                </p>

                <div className="border-2 border-dashed border-[#E2E8F0] hover:border-[#105B38] rounded-2xl p-6 text-center space-y-2 transition-colors relative">
                  <Upload className="w-8 h-8 text-[#105B38] mx-auto" />
                  <div className="text-xs font-bold text-[#0F172A]">{uploadFile ? uploadFile.name : "Select PDF or DOCX file"}</div>
                  <p className="text-[11px] text-slate-500">Maximum size 50MB</p>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>

                {isUploadingFile && (
                  <div className="space-y-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="flex items-center justify-between text-xs font-bold text-[#105B38]">
                      <span>{uploadStageText}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-emerald-200 overflow-hidden">
                      <div
                        className="h-full bg-[#105B38] rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRealFileUpload}
                  disabled={!uploadFile || isUploadingFile}
                  className="px-4 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-colors"
                >
                  {isUploadingFile ? "Extracting..." : "Upload & Extract"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Saved Scans History Modal (PostgreSQL Database) */}
        {showSavedScansModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#EBF5F0] border border-[#A3D4BC] flex items-center justify-center text-[#105B38]">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">Saved Scans & Findings Database</h3>
                    <p className="text-xs text-[#64748B]">PostgreSQL live persistence across sessions</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSavedScansModal(false)}
                  className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
                {isLoadingScans ? (
                  <div className="py-12 text-center text-xs text-[#64748B] flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-[#105B38]" />
                    <span>Loading saved scan sessions...</span>
                  </div>
                ) : !Array.isArray(savedScans) || savedScans.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#64748B] space-y-2">
                    <History className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-700">No saved scans found in database</p>
                    <p className="text-slate-500">Run a Deep Legal Scan or click "Save Scan" to persist analysis sessions.</p>
                  </div>
                ) : (
                  savedScans.map((scan: any) => (
                    <div
                      key={scan.id}
                      className={cn(
                        "p-4 rounded-xl border transition-all flex items-center justify-between gap-3",
                        currentScanId === scan.id
                          ? "bg-emerald-50/60 border-[#105B38] ring-1 ring-[#105B38]"
                          : "bg-[#F8FAFC] hover:bg-slate-100/80 border-[#E2E8F0]"
                      )}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-[#0F172A] truncate">
                            {scan.title || "Untitled Scan"}
                          </h4>
                          {currentScanId === scan.id && (
                            <span className="px-2 py-0.5 rounded-md bg-[#105B38] text-white text-[10px] font-bold">
                              Active
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-md bg-white border border-[#E2E8F0] text-[10px] font-medium text-slate-600 uppercase">
                            {scan.documentType || "Pleading"}
                          </span>
                          {scan.overallRisk && (
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-md text-[10px] font-bold border",
                                scan.overallRisk === "Vulnerable"
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : scan.overallRisk === "Action Required"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              )}
                            >
                              {scan.overallRisk}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#64748B] line-clamp-1">
                          {scan.summary || scan.text?.slice(0, 100) || "No summary provided"}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {scan.createdAt ? new Date(scan.createdAt).toLocaleString("en-PK") : "Recent"}
                          </span>
                          <span>•</span>
                          <span>ID #{scan.id}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleLoadScan(scan.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs transition-colors"
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteScan(scan.id, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete from database"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0] shrink-0 text-xs text-[#64748B]">
                <span>Total Saved: {Array.isArray(savedScans) ? savedScans.length : 0}</span>
                <button
                  type="button"
                  onClick={() => setShowSavedScansModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PreviewShell>
  );
};

export default PreviewDocumentAnalyzer;
