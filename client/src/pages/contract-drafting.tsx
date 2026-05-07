import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Download,
  FileText,
  Focus,
  Gavel,
  GitCompareArrows,
  Library,
  Loader2,
  ListChecks,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Printer,
  ScanText,
  Search,
  ShieldCheck,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { api } from "@shared/routes";
import type { Document as StoredDocument } from "@shared/schema";
import { StyleMemoryPanel } from "@/components/style-memory-panel";

type ComplianceRisk = {
  id: string;
  title: string;
  detail: string;
  severity: "warning" | "danger";
  prompt: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";
type RedlineStatus = "pending" | "accepted" | "rejected";
type RiskSeverityFilter = "all" | "danger" | "warning";

type ContractFormState = {
  title: string;
  contractType: string;
  firstParty: string;
  secondParty: string;
  effectiveDate: string;
  terminationNotice: string;
  jurisdiction: string;
  obligations: string;
};

type ClauseLibraryItem = {
  id: string;
  title: string;
  category: string;
  subtitle: string;
  prompt: string;
};

type ClauseSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
};

type RedlineItem = {
  id: string;
  title: string;
  rationale: string;
  originalSnippet: string;
  suggestedText: string;
  status: RedlineStatus;
};

type StyleMemoryMeta = {
  applied: boolean;
  module: "legal-drafting" | "contract-drafting" | null;
  scopeUsed: "user" | "org" | "user-org";
  chunksUsed: number;
  confidence: number;
};

const CONTRACT_AUTOSAVE_KEY = "contract-drafting-workspace-v1";
const CONTRACT_DOC_PREFIX = "Contract Draft:";

const CONTRACT_TYPES = [
  "Service Agreement",
  "Employment Agreement",
  "NDA (Non-Disclosure)",
  "Partnership Deed",
  "Sale & Purchase Agreement",
  "Rental / Lease Deed",
  "Power of Attorney",
  "Consultancy Agreement",
  "Distribution Agreement",
  "Franchise Agreement",
  "Loan Agreement",
  "Mortgage Deed",
];

const JURISDICTIONS = ["Lahore", "Karachi", "Islamabad", "Rawalpindi"];
const NOTICE_PERIODS = ["30 Days", "60 Days", "90 Days"];

const CLAUSE_LIBRARY: ClauseLibraryItem[] = [
  {
    id: "contractual-governing-law",
    title: "Governing Law Clause",
    category: "Contractual Clauses",
    subtitle: "Specify governing law and legal interpretation basis.",
    prompt: "Draft a governing law clause for a Pakistani commercial contract with clear interpretation language.",
  },
  {
    id: "contractual-dispute-resolution",
    title: "Dispute Resolution / Arbitration Clause",
    category: "Contractual Clauses",
    subtitle: "Arbitration seat, rules, language, and enforceability.",
    prompt: "Draft a dispute resolution and arbitration clause including seat, governing law, tribunal formation, and enforcement language.",
  },
  {
    id: "contractual-force-majeure",
    title: "Force Majeure Clause",
    category: "Contractual Clauses",
    subtitle: "Unforeseeable events and suspension rights.",
    prompt: "Draft a force majeure clause for Pakistani contracts covering notice, mitigation, suspension, and termination rights.",
  },
  {
    id: "contractual-termination",
    title: "Termination Clause",
    category: "Contractual Clauses",
    subtitle: "Termination triggers, cure period, and effects.",
    prompt: "Draft a termination clause with cause, convenience, cure period, and post-termination obligations.",
  },
  {
    id: "contractual-confidentiality",
    title: "Confidentiality Clause",
    category: "Contractual Clauses",
    subtitle: "Protection of sensitive and proprietary information.",
    prompt: "Draft a confidentiality clause with definition, permitted disclosures, duration, and remedies.",
  },
  {
    id: "contractual-non-compete",
    title: "Non-Compete Clause",
    category: "Contractual Clauses",
    subtitle: "Narrow restrictions for enforceability.",
    prompt: "Draft a narrowly tailored non-compete clause likely to be enforceable in a Pakistani commercial context.",
  },
  {
    id: "contractual-indemnity",
    title: "Indemnity Clause",
    category: "Contractual Clauses",
    subtitle: "Claim handling and indemnification scope.",
    prompt: "Draft an indemnity clause including defense control, notice, exclusions, and survival.",
  },
  {
    id: "contractual-payment-terms",
    title: "Payment Terms Clause",
    category: "Contractual Clauses",
    subtitle: "Invoicing cycles, timelines, and late payment terms.",
    prompt: "Draft a payment terms clause with invoicing, due dates, tax treatment, and delayed payment consequences.",
  },
  {
    id: "contractual-notice",
    title: "Notice Clause",
    category: "Contractual Clauses",
    subtitle: "Service method and deemed delivery rules.",
    prompt: "Draft a formal notices clause with courier/email modes and deemed receipt timing.",
  },
  {
    id: "contractual-entire-agreement",
    title: "Entire Agreement Clause",
    category: "Contractual Clauses",
    subtitle: "Supersedes prior discussions and understandings.",
    prompt: "Draft an entire agreement clause stating the contract supersedes prior oral and written communications.",
  },
  {
    id: "contractual-assignment",
    title: "Assignment Clause",
    category: "Contractual Clauses",
    subtitle: "Transfer restrictions and consent requirements.",
    prompt: "Draft an assignment clause with consent limitations and exceptions for affiliates/restructuring.",
  },
  {
    id: "contractual-severability",
    title: "Severability Clause",
    category: "Contractual Clauses",
    subtitle: "Invalid terms do not void whole agreement.",
    prompt: "Draft a severability clause preserving enforceability of remaining provisions if one clause is invalid.",
  },
  {
    id: "contractual-amendment",
    title: "Amendment Clause",
    category: "Contractual Clauses",
    subtitle: "Written modification requirements.",
    prompt: "Draft an amendment clause requiring signed written agreement for any modification or waiver.",
  },
  {
    id: "hr-probation",
    title: "Probation Period Clause",
    category: "Employment & HR Clauses",
    subtitle: "Initial evaluation term and confirmation terms.",
    prompt: "Draft a probation period clause with duration, assessment criteria, extension, and confirmation terms.",
  },
  {
    id: "hr-leave-entitlement",
    title: "Leave Entitlement Clause",
    category: "Employment & HR Clauses",
    subtitle: "Annual, sick, and casual leave framework.",
    prompt: "Draft a leave entitlement clause covering annual leave, sick leave, accrual, and approval process.",
  },
  {
    id: "hr-termination-severance",
    title: "Termination and Severance Clause",
    category: "Employment & HR Clauses",
    subtitle: "Notice, grounds, and end-of-service settlement.",
    prompt: "Draft an employment termination and severance clause with notice periods, misconduct grounds, and settlement mechanics.",
  },
  {
    id: "hr-grievance-handling",
    title: "Grievance Handling Clause",
    category: "Employment & HR Clauses",
    subtitle: "Internal complaint and escalation procedure.",
    prompt: "Draft a grievance handling clause with reporting channels, timelines, confidentiality, and escalation stages.",
  },
  {
    id: "hr-code-conduct",
    title: "Code of Conduct Clause",
    category: "Employment & HR Clauses",
    subtitle: "Professional behavior and compliance expectations.",
    prompt: "Draft a code of conduct clause covering ethics, anti-harassment, conflicts of interest, and disciplinary action.",
  },
  {
    id: "hr-confidentiality-ip",
    title: "Confidentiality & IP Clause",
    category: "Employment & HR Clauses",
    subtitle: "Employee confidentiality and work-product ownership.",
    prompt: "Draft a confidentiality and intellectual property clause for employment agreements including work product ownership.",
  },
  {
    id: "hr-non-solicitation",
    title: "Non-Solicitation Clause",
    category: "Employment & HR Clauses",
    subtitle: "Restrict client and employee poaching.",
    prompt: "Draft a non-solicitation clause restricting solicitation of employees, customers, and vendors for a limited period.",
  },
  {
    id: "hr-working-hours",
    title: "Working Hours & Overtime Clause",
    category: "Employment & HR Clauses",
    subtitle: "Normal schedule and overtime compensation rules.",
    prompt: "Draft a working hours and overtime clause with attendance expectations, overtime approval, and compensation method.",
  },
  {
    id: "corp-shareholder-rights",
    title: "Shareholder Rights Clause",
    category: "Corporate & Commercial Clauses",
    subtitle: "Voting, information, and minority protections.",
    prompt: "Draft a shareholder rights clause covering voting, inspection rights, and minority protection provisions.",
  },
  {
    id: "corp-board-directors",
    title: "Board of Directors Clause",
    category: "Corporate & Commercial Clauses",
    subtitle: "Board composition and decision governance.",
    prompt: "Draft a board of directors clause defining composition, quorum, voting thresholds, and meeting process.",
  },
  {
    id: "corp-buy-sell-option",
    title: "Buy/Sell Option Clause",
    category: "Corporate & Commercial Clauses",
    subtitle: "Trigger events and valuation mechanics.",
    prompt: "Draft a buy/sell option clause with trigger events, valuation methodology, and completion timelines.",
  },
  {
    id: "corp-dividend",
    title: "Dividend Clause",
    category: "Corporate & Commercial Clauses",
    subtitle: "Profit distribution policy and constraints.",
    prompt: "Draft a dividend clause covering declaration conditions, frequency, and pro-rata distribution rules.",
  },
  {
    id: "corp-liquidation",
    title: "Liquidation Clause",
    category: "Corporate & Commercial Clauses",
    subtitle: "Winding-up priorities and distribution waterfall.",
    prompt: "Draft a liquidation clause with priorities, creditor treatment, and shareholder distribution waterfall.",
  },
  {
    id: "corp-confidentiality-ip-assignment",
    title: "Confidentiality & IP Assignment Clause",
    category: "Corporate & Commercial Clauses",
    subtitle: "IP assignment and confidentiality obligations.",
    prompt: "Draft a confidentiality and IP assignment clause for founders/shareholders including moral rights waiver language where applicable.",
  },
  {
    id: "corp-capital-contribution",
    title: "Capital Contribution Clause",
    category: "Corporate & Commercial Clauses",
    subtitle: "Capital call terms and default consequences.",
    prompt: "Draft a capital contribution clause defining committed capital, call process, and default remedies.",
  },
  {
    id: "real-estate-sale-deed",
    title: "Sale Deed Clause",
    category: "Real Estate / Property Clauses",
    subtitle: "Transfer title, representations, and encumbrances.",
    prompt: "Draft a sale deed clause covering title transfer, seller warranties, and encumbrance-free delivery.",
  },
  {
    id: "real-estate-lease-rent",
    title: "Lease / Rent Clause",
    category: "Real Estate / Property Clauses",
    subtitle: "Rent amount, due date, and escalation terms.",
    prompt: "Draft a lease/rent clause with rent schedule, escalation, and default consequences.",
  },
  {
    id: "real-estate-maintenance",
    title: "Maintenance Clause",
    category: "Real Estate / Property Clauses",
    subtitle: "Repair obligations between landlord and tenant.",
    prompt: "Draft a property maintenance clause allocating routine and structural repair responsibilities.",
  },
  {
    id: "real-estate-termination",
    title: "Termination Clause",
    category: "Real Estate / Property Clauses",
    subtitle: "End-of-lease events and cure rights.",
    prompt: "Draft a lease termination clause with breach triggers, cure periods, and vacation obligations.",
  },
  {
    id: "real-estate-security-deposit",
    title: "Security Deposit Clause",
    category: "Real Estate / Property Clauses",
    subtitle: "Deposit use, deduction, and refund timeline.",
    prompt: "Draft a security deposit clause specifying amount, permitted deductions, and refund process.",
  },
  {
    id: "real-estate-subletting",
    title: "Subletting Clause",
    category: "Real Estate / Property Clauses",
    subtitle: "Sublease restrictions and consent process.",
    prompt: "Draft a subletting clause requiring landlord consent and liability retention by tenant.",
  },
  {
    id: "real-estate-possession-handover",
    title: "Possession & Handover Clause",
    category: "Real Estate / Property Clauses",
    subtitle: "Condition, inventory, and handover formalities.",
    prompt: "Draft a possession and handover clause with inspection protocol and condition acknowledgment.",
  },
  {
    id: "financial-interest-profit",
    title: "Interest / Profit Clause (KIBOR/Islamic finance)",
    category: "Financial / Banking Clauses",
    subtitle: "Rate benchmarks and Shariah-compliant alternatives.",
    prompt: "Draft an interest/profit clause with KIBOR-linked and Islamic finance compliant alternative language.",
  },
  {
    id: "financial-repayment-installment",
    title: "Repayment / Installment Clause",
    category: "Financial / Banking Clauses",
    subtitle: "Installment schedule and prepayment rights.",
    prompt: "Draft a repayment/installment clause with amortization schedule, due dates, and prepayment terms.",
  },
  {
    id: "financial-default-penalty",
    title: "Default / Penalty Clause",
    category: "Financial / Banking Clauses",
    subtitle: "Events of default and remedy framework.",
    prompt: "Draft a default and penalty clause with grace period, event triggers, acceleration rights, and penalties.",
  },
  {
    id: "financial-security-collateral",
    title: "Security / Collateral Clause",
    category: "Financial / Banking Clauses",
    subtitle: "Security package and enforcement rights.",
    prompt: "Draft a security/collateral clause defining charged assets, perfection obligations, and enforcement procedures.",
  },
  {
    id: "financial-assignment-receivables",
    title: "Assignment of Receivables Clause",
    category: "Financial / Banking Clauses",
    subtitle: "Transfer of receivable rights and notices.",
    prompt: "Draft an assignment of receivables clause with debtor notice, representations, and recourse terms.",
  },
];

const MANDATORY_CLAUSES_BY_TYPE: Record<string, Array<{ id: string; label: string; keywords: string[] }>> = {
  "Service Agreement": [
    { id: "scope", label: "Scope of Services", keywords: ["scope of services", "services"] },
    { id: "payment", label: "Payment / Consideration", keywords: ["payment", "consideration", "fees"] },
    { id: "term", label: "Term", keywords: ["term", "duration"] },
    { id: "termination", label: "Termination", keywords: ["termination", "terminate"] },
    { id: "confidentiality", label: "Confidentiality", keywords: ["confidentiality", "confidential information"] },
    { id: "disputes", label: "Dispute Resolution", keywords: ["arbitration", "dispute resolution"] },
    { id: "law", label: "Governing Law", keywords: ["governing law", "jurisdiction"] },
  ],
  "Employment Agreement": [
    { id: "role", label: "Role and Duties", keywords: ["duties", "position", "job title"] },
    { id: "compensation", label: "Compensation", keywords: ["salary", "compensation", "wages"] },
    { id: "term", label: "Term and Probation", keywords: ["probation", "term"] },
    { id: "leave", label: "Leave and Benefits", keywords: ["leave", "benefits"] },
    { id: "termination", label: "Termination", keywords: ["termination", "dismissal"] },
    { id: "confidentiality", label: "Confidentiality", keywords: ["confidential"] },
    { id: "law", label: "Governing Law", keywords: ["governing law", "jurisdiction"] },
  ],
  "NDA (Non-Disclosure)": [
    { id: "definition", label: "Confidential Information Definition", keywords: ["confidential information"] },
    { id: "obligation", label: "Use and Non-Disclosure Obligations", keywords: ["non-disclosure", "use of confidential"] },
    { id: "exceptions", label: "Exclusions", keywords: ["exclusions", "public domain"] },
    { id: "term", label: "Term and Survival", keywords: ["term", "survive", "survival"] },
    { id: "remedies", label: "Remedies", keywords: ["injunctive relief", "remedies"] },
    { id: "law", label: "Governing Law", keywords: ["governing law", "jurisdiction"] },
  ],
};

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function makeDefaultState(): ContractFormState {
  return {
    title: "Untitled Contract",
    contractType: "Service Agreement",
    firstParty: "",
    secondParty: "",
    effectiveDate: getTodayIsoDate(),
    terminationNotice: NOTICE_PERIODS[0],
    jurisdiction: JURISDICTIONS[0],
    obligations: "",
  };
}

function buildGenerationPrompt(form: ContractFormState): string {
  return `You are drafting a formal Pakistani legal contract.

Contract Type: ${form.contractType}
Document Title: ${form.title}
First Party: ${form.firstParty || "[Not provided]"}
Second Party: ${form.secondParty || "[Not provided]"}
Effective Date: ${form.effectiveDate || "[Not provided]"}
Termination Notice: ${form.terminationNotice || "[Not provided]"}
Jurisdiction: ${form.jurisdiction || "[Not provided]"}
Specific Obligations: ${form.obligations || "[Not provided]"}

Instructions:
1. Draft a complete, professional contract for Pakistani legal practice.
2. Use clear heading structure and clause numbering.
3. Include mandatory clauses: scope, consideration/payment, term, termination, confidentiality, indemnity, dispute resolution, governing law/jurisdiction, notices, and signatures.
4. Keep unknown details as placeholders in square brackets.
5. Return only contract text, no markdown fences, no extra commentary.`;
}

function extractJsonObject(raw: string): string | null {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return cleaned.slice(start, end + 1);
  return null;
}

function buildRedlinePrompt(currentDraft: string): string {
  return `You are acting as counterparty counsel reviewing this contract.

Contract text:
${currentDraft}

Return STRICT JSON only with this shape:
{
  "edits": [
    {
      "title": "Short label",
      "rationale": "Why counterparty asks for this change",
      "originalSnippet": "Exact short snippet from the draft to replace",
      "suggestedText": "Replacement text"
    }
  ]
}

Rules:
1. Suggest up to 6 edits.
2. Each originalSnippet must be from the draft text verbatim.
3. Keep suggestions commercially realistic.
4. No markdown, no prose outside JSON.`;
}

function parseRedlineResponse(raw: string): RedlineItem[] {
  try {
    const parsed = JSON.parse(raw) as { edits?: Array<Omit<RedlineItem, "id" | "status">> };
    const edits = Array.isArray(parsed?.edits) ? parsed.edits : [];
    return edits
      .filter((e) => e?.title && e?.suggestedText)
      .slice(0, 6)
      .map((e, idx) => ({
        id: `redline-${Date.now()}-${idx}`,
        title: String(e.title),
        rationale: String(e.rationale || "Counterparty requested this adjustment."),
        originalSnippet: String(e.originalSnippet || ""),
        suggestedText: String(e.suggestedText),
        status: "pending" as const,
      }));
  } catch {
    const fallback = raw.trim();
    if (!fallback) return [];
    return [
      {
        id: `redline-${Date.now()}-0`,
        title: "Counterparty revision",
        rationale: "Parsed as plain text because structured response was unavailable.",
        originalSnippet: "",
        suggestedText: fallback,
        status: "pending",
      },
    ];
  }
}

export default function ContractDraftingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement | null>(null);

  const [form, setForm] = useState<ContractFormState>(makeDefaultState);
  const [contractText, setContractText] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunningCompliance, setIsRunningCompliance] = useState(false);
  const [complianceRisks, setComplianceRisks] = useState<ComplianceRisk[]>([]);
  const [lastRiskScanAt, setLastRiskScanAt] = useState<Date | null>(null);
  const [riskFromCache, setRiskFromCache] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [clauseSearch, setClauseSearch] = useState("");
  const [clauseCategory, setClauseCategory] = useState("All");
  const [redlineItems, setRedlineItems] = useState<RedlineItem[]>([]);
  const [isRunningRedline, setIsRunningRedline] = useState(false);
  const [riskSeverityFilter, setRiskSeverityFilter] = useState<RiskSeverityFilter>("all");
  const [isLoadingClauseSuggestions, setIsLoadingClauseSuggestions] = useState(false);
  const [liveClauseSuggestions, setLiveClauseSuggestions] = useState<ClauseSuggestion[]>([]);
  const [clauseSuggestionError, setClauseSuggestionError] = useState<string | null>(null);
  const [leftRailOpen, setLeftRailOpen] = useState(true);
  const [rightRailOpen, setRightRailOpen] = useState(true);
  const [focusWritingMode, setFocusWritingMode] = useState(false);
  const [styleMemoryMeta, setStyleMemoryMeta] = useState<StyleMemoryMeta | null>(null);
  const autoRiskScanSignatureRef = useRef<string>("");
  const leftRailVisible = leftRailOpen && !focusWritingMode;
  const rightRailVisible = rightRailOpen && !focusWritingMode;

  useEffect(() => {
    const raw = localStorage.getItem(CONTRACT_AUTOSAVE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        form?: ContractFormState;
        contractText?: string;
        selectedDocId?: number | null;
        lastSavedAt?: string;
      };
      if (parsed.form) setForm({ ...makeDefaultState(), ...parsed.form });
      if (typeof parsed.contractText === "string") setContractText(parsed.contractText);
      if (typeof parsed.selectedDocId === "number") setSelectedDocId(parsed.selectedDocId);
      if (parsed.lastSavedAt) setLastSavedAt(new Date(parsed.lastSavedAt));
      setSaveStatus("saved");
    } catch {
      localStorage.removeItem(CONTRACT_AUTOSAVE_KEY);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem(
        CONTRACT_AUTOSAVE_KEY,
        JSON.stringify({
          form,
          contractText,
          selectedDocId,
          lastSavedAt: lastSavedAt?.toISOString() || null,
        }),
      );
      if (saveStatus !== "saving") {
        setSaveStatus("saved");
      }
    }, 600);
    return () => clearTimeout(timeout);
  }, [form, contractText, selectedDocId, lastSavedAt, saveStatus]);

  const saveDocMutation = useMutation({
    mutationFn: async ({ silent }: { silent?: boolean } = {}) => {
      const payload = {
        title: `${CONTRACT_DOC_PREFIX} ${form.title.trim() || "Untitled Contract"}`,
        content: contractText,
      };
      if (!payload.content.trim()) {
        throw new Error("Contract body is empty.");
      }
      if (selectedDocId) {
        const res = await apiRequest("PUT", `/api/documents/${selectedDocId}`, payload);
        return (await res.json()) as StoredDocument;
      }
      const res = await apiRequest("POST", "/api/documents", payload);
      return (await res.json()) as StoredDocument;
    },
    onMutate: () => setSaveStatus("saving"),
    onSuccess: (doc) => {
      setSelectedDocId(doc.id);
      setSaveStatus("saved");
      setLastSavedAt(new Date());
      queryClient.invalidateQueries({ queryKey: [api.documents.list.path] });
    },
    onError: (err: any) => {
      setSaveStatus("error");
      toast({
        title: "Cloud sync failed",
        description: err?.message || "Could not sync contract to cloud.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!contractText.trim()) return;
    const timeout = setTimeout(() => {
      if (!saveDocMutation.isPending) {
        saveDocMutation.mutate({ silent: true });
      }
    }, 4000);
    return () => clearTimeout(timeout);
  }, [contractText, form.title]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      refreshClauseSuggestions({ silent: true }).catch(() => {});
    }, 900);
    return () => clearTimeout(timeout);
  }, [form.contractType, form.jurisdiction, contractText]);

  const mandatoryChecks = useMemo(() => {
    const checks = MANDATORY_CLAUSES_BY_TYPE[form.contractType] || MANDATORY_CLAUSES_BY_TYPE["Service Agreement"];
    const text = contractText.toLowerCase();
    return checks.map((item) => ({
      ...item,
      present: item.keywords.some((k) => text.includes(k.toLowerCase())),
    }));
  }, [form.contractType, contractText]);

  const mandatoryCoverage = useMemo(() => {
    if (!mandatoryChecks.length) return 0;
    const present = mandatoryChecks.filter((m) => m.present).length;
    return Math.round((present / mandatoryChecks.length) * 100);
  }, [mandatoryChecks]);

  const riskBreakdown = useMemo(() => {
    const critical = complianceRisks.filter((r) => r.severity === "danger").length;
    const warning = complianceRisks.filter((r) => r.severity === "warning").length;
    const coveredMandatory = mandatoryChecks.filter((m) => m.present).length;
    const missingMandatory = Math.max(0, mandatoryChecks.length - coveredMandatory);
    return { critical, warning, coveredMandatory, missingMandatory };
  }, [complianceRisks, mandatoryChecks]);

  const healthScore = useMemo(() => {
    if (!contractText.trim()) return 0;
    const penalty =
      riskBreakdown.critical * 24 +
      riskBreakdown.warning * 11 +
      riskBreakdown.missingMandatory * 6;
    return clamp(100 - penalty, 0, 100);
  }, [contractText, riskBreakdown]);

  const filteredComplianceRisks = useMemo(() => {
    if (riskSeverityFilter === "all") return complianceRisks;
    return complianceRisks.filter((risk) => risk.severity === riskSeverityFilter);
  }, [complianceRisks, riskSeverityFilter]);

  const clauseCategories = useMemo(() => {
    const unique = Array.from(new Set(CLAUSE_LIBRARY.map((item) => item.category)));
    return ["All", ...unique];
  }, []);

  const filteredClauseLibrary = useMemo(() => {
    const q = clauseSearch.trim().toLowerCase();
    return CLAUSE_LIBRARY.filter(
      (item) =>
        (clauseCategory === "All" || item.category === clauseCategory) &&
        (!q ||
          item.title.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q)),
    );
  }, [clauseCategory, clauseSearch]);

  const onFieldChange = <K extends keyof ContractFormState>(key: K, value: ContractFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const generateDraft = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: [{ role: "user", content: buildGenerationPrompt(form) }],
          type: "contract-drafting",
          moduleIntent: "contract.generateDraft",
          turbo: false,
          stream: false,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to generate contract draft");
      }

      const data = await response.json();
      const generated = (data?.content || "").trim();
      if (!generated) throw new Error("AI returned empty draft.");
      setStyleMemoryMeta((data?.styleMemory || null) as StyleMemoryMeta | null);

      setContractText(generated);
      await apiRequest("POST", "/api/search-history", {
        type: "contract",
        query: `${form.contractType} ${form.title}`.slice(0, 120),
      }).catch(() => {});
      toast({ title: "Contract draft generated" });
    } catch (err: any) {
      toast({
        title: "Draft generation failed",
        description: err?.message || "Could not generate draft.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const runComplianceCheck = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!contractText.trim()) {
      if (!silent) {
        toast({ title: "No contract text", description: "Generate or write a contract first.", variant: "destructive" });
      }
      return;
    }
    setIsRunningCompliance(true);
    try {
      const response = await fetch("/api/ai/draft-risk-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: form.title,
          content: contractText,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Compliance check failed");
      }
      const data = await response.json();
      const risks = Array.isArray(data?.risks) ? (data.risks as ComplianceRisk[]) : [];
      setComplianceRisks(risks.slice(0, 8));
      setRiskFromCache(Boolean(data?.fromCache));
      setLastRiskScanAt(new Date());
      if (!silent) {
        toast({ title: "Compliance check complete" });
      }
    } catch (err: any) {
      if (!silent) {
        toast({
          title: "Compliance check failed",
          description: err?.message || "Could not run compliance check.",
          variant: "destructive",
        });
      }
    } finally {
      setIsRunningCompliance(false);
    }
  };

  useEffect(() => {
    const text = contractText.trim();
    if (text.length < 120) {
      setComplianceRisks([]);
      setLastRiskScanAt(null);
      setRiskFromCache(false);
      setRiskSeverityFilter("all");
      autoRiskScanSignatureRef.current = "";
      return;
    }
    const signature = `${form.title}|${form.contractType}|${text.slice(0, 1400)}`;
    if (autoRiskScanSignatureRef.current === signature) return;

    const timeout = setTimeout(() => {
      autoRiskScanSignatureRef.current = signature;
      runComplianceCheck({ silent: true }).catch(() => {
        autoRiskScanSignatureRef.current = "";
      });
    }, 2800);

    return () => clearTimeout(timeout);
  }, [contractText, form.title, form.contractType]);

  const applySuggestedClause = async (prompt: string) => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/retrieval/clauses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt,
          draftText: contractText.slice(0, 12000),
          jurisdiction: form.jurisdiction,
          module: "contract-drafting",
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to generate clause");
      }
      const data = await response.json();
      const clause = (data?.clause || "").trim();
      if (!clause) throw new Error("Clause retrieval returned empty result");
      setStyleMemoryMeta((data?.styleMemory || null) as StyleMemoryMeta | null);
      setContractText((prev) => `${prev.trim()}\n\n${clause}\n`);
      toast({ title: "Clause inserted" });
    } catch (err: any) {
      toast({
        title: "Clause generation failed",
        description: err?.message || "Could not add clause.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const refreshClauseSuggestions = async ({ silent = false }: { silent?: boolean } = {}) => {
    setIsLoadingClauseSuggestions(true);
    setClauseSuggestionError(null);
    try {
      const response = await fetch("/api/retrieval/clauses/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          query: `${form.contractType} ${form.title || ""} ${form.obligations || ""}`.trim(),
          draftText: contractText.slice(0, 12000),
          contractType: form.contractType,
          limit: 4,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to load clause suggestions");
      }
      const data = await response.json();
      const parsed = Array.isArray(data?.suggestions) ? (data.suggestions as ClauseSuggestion[]) : [];
      if (parsed.length === 0) {
        throw new Error("No retrieval suggestions available for this draft.");
      }
      setLiveClauseSuggestions(parsed);
      if (!silent) {
        toast({ title: "Clause suggestions refreshed", description: "Retrieval suggestions are tailored to this draft." });
      }
    } catch (err: any) {
      setLiveClauseSuggestions([]);
      setClauseSuggestionError(err?.message || "Could not load live suggestions.");
      if (!silent) {
        toast({
          title: "Could not refresh clause suggestions",
          description: err?.message || "No live suggestions available right now.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoadingClauseSuggestions(false);
    }
  };

  const runCounterpartyRedline = async () => {
    if (!contractText.trim()) {
      toast({ title: "No contract text", description: "Generate or write a contract first.", variant: "destructive" });
      return;
    }
    setIsRunningRedline(true);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: [{ role: "user", content: buildRedlinePrompt(contractText) }],
          type: "contract-drafting",
          moduleIntent: "contract.redline",
          turbo: false,
          stream: false,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Redline generation failed");
      }
      const data = await response.json();
      setStyleMemoryMeta((data?.styleMemory || null) as StyleMemoryMeta | null);
      const parsed = parseRedlineResponse(String(data?.content || ""));
      setRedlineItems(parsed);
      toast({ title: "Counterparty redline generated", description: `${parsed.length} proposed edits ready.` });
    } catch (err: any) {
      toast({
        title: "Redline mode failed",
        description: err?.message || "Could not generate redline suggestions.",
        variant: "destructive",
      });
    } finally {
      setIsRunningRedline(false);
    }
  };

  const acceptRedline = (item: RedlineItem) => {
    setContractText((prev) => {
      if (item.originalSnippet && prev.includes(item.originalSnippet)) {
        return prev.replace(item.originalSnippet, item.suggestedText);
      }
      return `${prev.trim()}\n\n${item.suggestedText}\n`;
    });
    setRedlineItems((prev) => prev.map((r) => (r.id === item.id ? { ...r, status: "accepted" } : r)));
    void fetch("/api/style-memory/events/accepted-redline", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module: "contract-drafting",
        draftId: selectedDocId || form.title || item.id,
        acceptedText: item.suggestedText,
        beforeText: item.originalSnippet || "",
      }),
    }).catch(() => {});
  };

  const rejectRedline = (itemId: string) => {
    setRedlineItems((prev) => prev.map((r) => (r.id === itemId ? { ...r, status: "rejected" } : r)));
  };

  const downloadContract = () => {
    const content = contractText || "";
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(form.title || "contract-draft").replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    if (!contractText.trim()) {
      toast({ title: "Nothing to copy", description: "Contract draft is empty.", variant: "destructive" });
      return;
    }
    try {
      await navigator.clipboard.writeText(contractText);
      toast({ title: "Copied", description: "Contract text copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard access failed.", variant: "destructive" });
    }
  };

  const printContract = () => {
    window.print();
  };

  const saveStatusLabel =
    saveStatus === "saving"
      ? "Syncing..."
      : saveStatus === "saved"
        ? `Autosaved${lastSavedAt ? ` ${lastSavedAt.toLocaleTimeString()}` : ""}`
        : saveStatus === "error"
          ? "Sync error"
          : "Idle";

  const renderRightRailContent = () => (
    <>
      <div className="glass-surface backdrop-blur-lg p-3 rounded-xl shadow-2xl border border-primary/20">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground tracking-tight">AI Clause Suggester</h3>
          </div>
          <button
            className="text-[10px] px-2 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-50"
            onClick={() => refreshClauseSuggestions({ silent: false })}
            disabled={isLoadingClauseSuggestions}
            data-testid="button-refresh-ai-clause-suggestions"
          >
            {isLoadingClauseSuggestions ? "Loading..." : "Refresh"}
          </button>
        </div>
        {styleMemoryMeta && (
          <div className="mb-2 rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] text-foreground">
            Style memory: {styleMemoryMeta.applied ? "applied" : "not applied"} · confidence {Math.round((styleMemoryMeta.confidence || 0) * 100)}%
          </div>
        )}
        <div className="space-y-2">
          {liveClauseSuggestions.map((item) => (
            <button
              key={item.id}
              onClick={() => applySuggestedClause(item.prompt)}
              className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-primary/10 border border-white/10 transition-all"
              data-testid={`button-suggest-${item.id.replace(/[^a-zA-Z0-9-_]/g, "")}`}
              disabled={isGenerating || isLoadingClauseSuggestions}
            >
              <div className="text-[11px] font-bold text-primary mb-0.5">{item.title}</div>
              <div className="text-[9px] text-muted-foreground leading-tight">{item.subtitle}</div>
            </button>
          ))}
          {!isLoadingClauseSuggestions && liveClauseSuggestions.length === 0 && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
              <p className="text-[10px] text-foreground">No live suggestions available.</p>
              {clauseSuggestionError && <p className="mt-1 text-[9px] text-red-300">{clauseSuggestionError}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="glass-surface backdrop-blur-lg p-3 rounded-xl shadow-2xl border border-primary/20">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <GitCompareArrows size={16} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground tracking-tight">Counterparty Redline Mode</h3>
          </div>
          <button
            className="text-[10px] px-2 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10"
            onClick={runCounterpartyRedline}
            disabled={isRunningRedline}
          >
            Refresh
          </button>
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {!redlineItems.length && (
            <p className="text-[11px] text-muted-foreground">
              Run redline mode to generate counterparty edits, then accept or reject each one.
            </p>
          )}
          {redlineItems.map((item) => (
            <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">{item.title}</p>
                <span
                  className={`text-[9px] uppercase ${
                    item.status === "accepted"
                      ? "text-emerald-300"
                      : item.status === "rejected"
                        ? "text-red-300"
                        : "text-primary"
                  }`}
                >
                  {item.status}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{item.rationale}</p>
              <div className="mt-2 flex gap-2">
                <button
                  className="flex-1 rounded border border-emerald-400/30 bg-emerald-500/10 py-1 text-[10px] font-semibold text-emerald-200 disabled:opacity-40"
                  onClick={() => acceptRedline(item)}
                  disabled={item.status !== "pending"}
                >
                  Accept
                </button>
                <button
                  className="flex-1 rounded border border-red-400/30 bg-red-500/10 py-1 text-[10px] font-semibold text-red-200 disabled:opacity-40"
                  onClick={() => rejectRedline(item.id)}
                  disabled={item.status !== "pending"}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <StyleMemoryPanel module="contract-drafting" />
    </>
  );

  return (
    <div className="h-full min-h-[500px] md:min-h-[620px] rounded-xl md:rounded-2xl border border-[hsl(var(--preview-border))] overflow-hidden preview-bg text-foreground flex flex-col fade-in">
      <header className="flex items-center justify-between border-b border-[hsl(var(--preview-border))] glass-shell backdrop-blur-xl px-3 md:px-5 py-2 z-20">
        <div className="flex items-center gap-3 md:gap-6 min-w-0">
          <div className="flex items-center gap-3">
            <div className="size-7 bg-primary rounded-md flex items-center justify-center">
              <Gavel size={14} className="text-primary-foreground" />
            </div>
            <h1 className="text-base font-bold tracking-tight text-foreground uppercase italic">Al Wakeelo</h1>
          </div>
          <div className="hidden md:block h-8 w-px bg-white/10" />
          <div className="min-w-0 hidden md:block">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground truncate">{form.title || "Untitled Contract"}</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className={`size-1.5 rounded-full ${saveStatus === "error" ? "bg-red-500" : "bg-green-500"} ${saveStatus === "saving" ? "animate-pulse" : ""}`} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">{saveStatusLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          <div className="hidden md:flex items-center gap-3 bg-card/50 px-3 py-1.5 rounded-lg border border-[hsl(var(--preview-border))]">
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Contract Health</span>
              <div className="flex items-center gap-3">
                <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${healthScore >= 75 ? "bg-emerald-400" : healthScore >= 45 ? "bg-primary" : "bg-red-400"}`}
                    style={{ width: `${healthScore}%` }}
                  />
                </div>
                <span className="text-primary font-bold text-sm">{healthScore}%</span>
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-1.5 bg-white/5 px-3 py-2 rounded-xl border border-primary/10">
            <button
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-primary/10"
              onClick={downloadContract}
              data-testid="button-header-export-txt"
            >
              <Download size={11} className="shrink-0" />
              TXT
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-primary/10"
              onClick={printContract}
              data-testid="button-header-export-print"
            >
              <Download size={11} className="shrink-0" />
              PDF
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-primary/10"
              onClick={copyToClipboard}
              data-testid="button-header-export-copy"
            >
              <Download size={11} className="shrink-0" />
              Copy
            </button>
          </div>
          <div className="hidden md:flex items-center gap-1">
            <button
              className="inline-flex items-center justify-center h-9 px-2 rounded-md border border-border text-foreground hover:bg-card"
              onClick={() => {
                setFocusWritingMode(false);
                setLeftRailOpen((v) => !v);
              }}
              data-testid="button-toggle-left-contract-rail"
              title={leftRailVisible ? "Hide contract inputs" : "Show contract inputs"}
            >
              {leftRailVisible ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
            </button>
            <button
              className="inline-flex items-center justify-center h-9 px-2 rounded-md border border-border text-foreground hover:bg-card"
              onClick={() => setFocusWritingMode((v) => !v)}
              data-testid="button-toggle-contract-focus-writing"
              title={focusWritingMode ? "Exit focus writing mode" : "Focus writing mode"}
            >
              {focusWritingMode ? <Minimize2 size={14} /> : <Focus size={14} />}
            </button>
            <button
              className="hidden lg:inline-flex items-center justify-center h-9 px-2 rounded-md border border-border text-foreground hover:bg-card"
              onClick={() => {
                setFocusWritingMode(false);
                setRightRailOpen((v) => !v);
              }}
              data-testid="button-toggle-right-contract-rail"
              title={rightRailVisible ? "Hide AI panel" : "Show AI panel"}
            >
              {rightRailVisible ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        <section
          className={`w-full lg:shrink-0 glass-surface border-b lg:border-b-0 border-[hsl(var(--preview-border))] transition-[width] duration-300 ease-out overflow-hidden ${
            leftRailVisible ? "lg:w-[360px] lg:border-r" : "lg:w-0 lg:border-r-0"
          } ${focusWritingMode ? "hidden" : ""}`}
        >
          <div className="w-full lg:w-[360px] h-full flex flex-col">
            <div className="p-3 md:p-4 overflow-y-auto scrollbar-hide flex-1 space-y-4 md:space-y-5">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileText size={18} className="text-primary" />
                Input Parameters
              </h2>
              <p className="text-xs text-muted-foreground">Provide details to generate the legal draft</p>
            </div>

            <div className="space-y-4">
              <div className="group">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Contract Title</label>
                <Input
                  value={form.title}
                  onChange={(e) => onFieldChange("title", e.target.value)}
                  className="w-full bg-white/5 border border-primary/20 rounded-lg px-4 py-3 text-sm text-foreground focus:border-primary focus-visible:ring-primary/30 placeholder:text-muted-foreground"
                  placeholder="e.g. Service Agreement 2026"
                />
              </div>
              <div className="group">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Contract Type</label>
                <select
                  value={form.contractType}
                  onChange={(e) => onFieldChange("contractType", e.target.value)}
                  className="w-full bg-white/5 border border-primary/20 rounded-lg px-4 py-3 text-sm text-foreground focus:border-primary outline-none"
                >
                  {CONTRACT_TYPES.map((type) => (
                    <option key={type} value={type} className="preview-bg">
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary/90 uppercase text-[10px] font-bold tracking-widest">
                <span>Parties Information</span>
              </div>
              <div className="space-y-4">
                <div className="group">
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">First Party (Employer)</label>
                  <Input
                    value={form.firstParty}
                    onChange={(e) => onFieldChange("firstParty", e.target.value)}
                    className="w-full bg-white/5 border border-primary/20 rounded-lg px-4 py-3 text-sm text-foreground focus:border-primary focus-visible:ring-primary/30 placeholder:text-muted-foreground"
                    placeholder="e.g. Malik & Sons Enterprises"
                  />
                </div>
                <div className="group">
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Second Party (Contractor)</label>
                  <Input
                    value={form.secondParty}
                    onChange={(e) => onFieldChange("secondParty", e.target.value)}
                    className="w-full bg-white/5 border border-primary/20 rounded-lg px-4 py-3 text-sm text-foreground focus:border-primary focus-visible:ring-primary/30 placeholder:text-muted-foreground"
                    placeholder="Full Legal Name"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary/90 uppercase text-[10px] font-bold tracking-widest">
                <span>Contract Duration</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="group">
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Effective Date</label>
                  <Input
                    type="date"
                    value={form.effectiveDate}
                    onChange={(e) => onFieldChange("effectiveDate", e.target.value)}
                    className="w-full bg-white/5 border border-primary/20 rounded-lg px-4 py-3 text-sm text-foreground focus:border-primary outline-none"
                  />
                </div>
                <div className="group">
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Termination Notice</label>
                  <select
                    value={form.terminationNotice}
                    onChange={(e) => onFieldChange("terminationNotice", e.target.value)}
                    className="w-full bg-white/5 border border-primary/20 rounded-lg px-4 py-3 text-sm text-foreground focus:border-primary outline-none"
                  >
                    {NOTICE_PERIODS.map((p) => (
                      <option key={p} value={p} className="preview-bg">
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary/90 uppercase text-[10px] font-bold tracking-widest">
                <span>Jurisdiction & Governing Law</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {JURISDICTIONS.map((city) => (
                  <button
                    key={city}
                    onClick={() => onFieldChange("jurisdiction", city)}
                    className={`px-4 py-2 rounded-full border text-xs font-bold transition-all ${
                      form.jurisdiction === city
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-primary/20 bg-white/5 text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground italic">Governed by the Contract Act, 1872 (IX of 1872)</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary/90 uppercase text-[10px] font-bold tracking-widest">
                <span>Specific Obligations</span>
              </div>
              <Textarea
                value={form.obligations}
                onChange={(e) => onFieldChange("obligations", e.target.value)}
                className="w-full bg-white/5 border border-primary/20 rounded-lg px-4 py-3 text-sm text-foreground focus:border-primary focus-visible:ring-primary/30 placeholder:text-muted-foreground resize-none"
                placeholder="Describe the service scope or payment terms..."
                rows={4}
              />
            </div>

            <div className="space-y-3 rounded-xl border border-primary/20 glass-soft p-3">
              <div className="flex items-center gap-2">
                <Library size={14} className="text-primary" />
                <p className="text-[11px] font-semibold text-primary uppercase tracking-widest">Clause Library Panel</p>
              </div>
              <Input
                value={clauseSearch}
                onChange={(e) => setClauseSearch(e.target.value)}
                className="h-8 bg-white/5 border border-primary/20 text-xs text-foreground placeholder:text-muted-foreground"
                placeholder="Search clause library..."
              />
              <select
                value={clauseCategory}
                onChange={(e) => setClauseCategory(e.target.value)}
                className="h-8 w-full bg-white/5 border border-primary/20 rounded-md px-2 text-xs text-foreground outline-none focus:border-primary"
              >
                {clauseCategories.map((category) => (
                  <option key={category} value={category} className="preview-bg">
                    {category}
                  </option>
                ))}
              </select>
              <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                {filteredClauseLibrary.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => applySuggestedClause(item.prompt)}
                    className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-primary/10 border border-white/10"
                    disabled={isGenerating}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">{item.title}</span>
                      <span className="text-[9px] uppercase text-primary">{item.category}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{item.subtitle}</p>
                  </button>
                ))}
                {!filteredClauseLibrary.length && (
                  <p className="text-[11px] text-muted-foreground text-center py-3">No clauses match this search.</p>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-primary/20 glass-soft p-3">
              <div className="flex items-center gap-2">
                <ListChecks size={14} className="text-primary" />
                <p className="text-[11px] font-semibold text-primary uppercase tracking-widest">
                  Mandatory Clause Checker
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-emerald-400" style={{ width: `${mandatoryCoverage}%` }} />
                </div>
                <span className="text-[10px] text-emerald-300 font-semibold">{mandatoryCoverage}%</span>
              </div>
              <div className="space-y-1.5">
                {mandatoryChecks.map((check) => (
                  <div key={check.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-foreground">{check.label}</span>
                    <span className={check.present ? "text-emerald-300" : "text-red-300"}>
                      {check.present ? "Present" : "Missing"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            </div>

            <div className="p-3 md:p-4 glass-surface border-t border-[hsl(var(--preview-border))] space-y-2">
              <button
                onClick={generateDraft}
                className="w-full py-3 bg-primary hover:bg-primary rounded-lg text-primary-foreground font-bold text-sm transition-colors flex items-center justify-center gap-2"
                data-testid="button-generate-contract-draft"
                disabled={isGenerating}
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {isGenerating ? "Generating..." : "Generate Contract Draft"}
              </button>
              <button
                onClick={() => runComplianceCheck({ silent: false })}
                className="w-full py-3 bg-white/5 border border-primary/30 rounded-lg text-primary font-bold text-sm hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
                data-testid="button-run-contract-compliance"
                disabled={isRunningCompliance}
              >
                {isRunningCompliance ? <Loader2 size={16} className="animate-spin" /> : <ScanText size={16} />}
                {isRunningCompliance ? "Scanning..." : "Run Live AI Risk Scan"}
              </button>
              <button
                onClick={runCounterpartyRedline}
                className="w-full py-3 bg-white/5 border border-primary/30 rounded-lg text-primary font-bold text-sm hover:bg-primary/10 transition-colors flex items-center justify-center gap-2"
                data-testid="button-run-counterparty-redline"
                disabled={isRunningRedline}
              >
                {isRunningRedline ? <Loader2 size={16} className="animate-spin" /> : <GitCompareArrows size={16} />}
                {isRunningRedline ? "Reviewing..." : "Counterparty Redline Mode"}
              </button>
            </div>
          </div>
        </section>

        <div className={`${focusWritingMode ? "hidden" : "hidden lg:flex"} items-stretch`}>
          <button
            onClick={() => setLeftRailOpen((v) => !v)}
            className="h-full w-6 border-r border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center transition-all"
            data-testid="divider-toggle-left-contract-rail"
            title={leftRailVisible ? "Collapse contract inputs" : "Expand contract inputs"}
            aria-label={leftRailVisible ? "Collapse contract inputs" : "Expand contract inputs"}
          >
            {leftRailVisible ? <ChevronLeft size={15} className="drop-shadow" /> : <ChevronRight size={15} className="drop-shadow" />}
          </button>
        </div>

        <section className="flex-1 bg-[hsl(var(--preview-bg)/0.45)] p-3 md:p-6 overflow-y-auto scrollbar-hide">
          <div className="mx-auto w-full max-w-none">
            <div>
              <div className="mb-5">
                <div className="p-4 rounded-xl border border-primary/25 glass-surface backdrop-blur-md">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck size={14} className="text-primary" />
                    <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Risk Score Breakdown</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    {lastRiskScanAt
                      ? `Live scan ${lastRiskScanAt.toLocaleTimeString()}${riskFromCache ? " (cached)" : ""}`
                      : "Live scan pending..."}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setRiskSeverityFilter("danger");
                        if (!lastRiskScanAt) {
                          void runComplianceCheck({ silent: false });
                        }
                      }}
                      className={`min-w-0 h-8 rounded-lg border px-2 py-1 transition-colors ${
                        riskSeverityFilter === "danger"
                          ? "border-red-300/60 bg-red-500/20"
                          : "border-red-400/25 bg-red-500/10 hover:bg-red-500/15"
                      }`}
                      data-testid="button-risk-filter-critical"
                      title="Show critical findings"
                    >
                      <div className="flex h-full items-center justify-between gap-1 whitespace-nowrap">
                        <p className="min-w-0 truncate text-[9px] font-semibold leading-none text-foreground uppercase tracking-[0.08em]">
                          Critical
                        </p>
                        <p className="shrink-0 text-xs font-bold leading-none tabular-nums text-red-300">{riskBreakdown.critical}</p>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setRiskSeverityFilter("warning");
                        if (!lastRiskScanAt) {
                          void runComplianceCheck({ silent: false });
                        }
                      }}
                      className={`min-w-0 h-8 rounded-lg border px-2 py-1 transition-colors ${
                        riskSeverityFilter === "warning"
                          ? "border-primary/60 bg-primary/20"
                          : "border-primary/25 bg-primary/10 hover:bg-primary/15"
                      }`}
                      data-testid="button-risk-filter-warning"
                      title="Show warning findings"
                    >
                      <div className="flex h-full items-center justify-between gap-1 whitespace-nowrap">
                        <p className="min-w-0 truncate text-[9px] font-semibold leading-none text-foreground uppercase tracking-[0.08em]">
                          Warnings
                        </p>
                        <p className="shrink-0 text-xs font-bold leading-none tabular-nums text-primary">{riskBreakdown.warning}</p>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setRiskSeverityFilter("all");
                        if (!lastRiskScanAt) {
                          void runComplianceCheck({ silent: false });
                        }
                      }}
                      className={`min-w-0 h-8 rounded-lg border px-2 py-1 transition-colors ${
                        riskSeverityFilter === "all"
                          ? "border-emerald-300/60 bg-emerald-500/20"
                          : "border-emerald-400/25 bg-emerald-500/10 hover:bg-emerald-500/15"
                      }`}
                      data-testid="button-risk-filter-coverage"
                      title="Show all findings"
                    >
                      <div className="flex h-full items-center justify-between gap-1 whitespace-nowrap">
                        <p className="min-w-0 truncate text-[9px] font-semibold leading-none text-foreground uppercase tracking-[0.08em]">
                          Coverage
                        </p>
                        <p className="shrink-0 text-xs font-bold leading-none tabular-nums text-emerald-300">{mandatoryCoverage}%</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {complianceRisks.length > 0 && (
                <div className="mb-5 p-4 rounded-xl border border-primary/25 glass-surface backdrop-blur-md">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-primary" />
                      <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
                        Compliance Findings
                      </p>
                    </div>
                    {riskSeverityFilter !== "all" && (
                      <button
                        onClick={() => setRiskSeverityFilter("all")}
                        className="text-[10px] px-2 py-0.5 rounded border border-primary/30 text-primary hover:bg-primary/10"
                        data-testid="button-risk-filter-clear"
                      >
                        Show All
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {filteredComplianceRisks.length === 0 ? (
                      <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                        <p className="text-[11px] text-foreground">
                          {riskSeverityFilter === "danger"
                            ? "No critical findings in the latest scan."
                            : "No warning findings in the latest scan."}
                        </p>
                      </div>
                    ) : (
                      filteredComplianceRisks.slice(0, 4).map((risk) => (
                        <button
                          key={risk.id}
                          onClick={() => applySuggestedClause(risk.prompt)}
                          className={`w-full text-left p-2 rounded-lg border ${
                            risk.severity === "danger"
                              ? "border-red-400/30 bg-red-500/10"
                              : "border-primary/25 bg-primary/10"
                          }`}
                          data-testid={`compliance-risk-${risk.id}`}
                        >
                          <div className="flex items-center gap-1.5">
                            {risk.severity === "danger" ? (
                              <AlertTriangle size={12} className="text-red-300" />
                            ) : (
                              <CheckCircle2 size={12} className="text-primary" />
                            )}
                            <span className="text-xs font-semibold text-foreground">{risk.title}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">{risk.detail}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div
                className="rounded-2xl border border-[hsl(var(--preview-border))] bg-background/72 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08)] backdrop-blur-xl p-3 md:p-5 lg:p-7 min-h-[560px] md:min-h-[760px] print:bg-white print:text-black"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
                ref={printRef}
              >
                <Textarea
                  value={contractText}
                  onChange={(e) => setContractText(e.target.value)}
                  className="w-full min-h-[520px] md:min-h-[700px] resize-none border-0 p-0 focus-visible:ring-0 bg-transparent text-[15px] leading-relaxed text-foreground print:text-black"
                  placeholder="Your generated contract draft will appear here..."
                  data-testid="textarea-contract-draft"
                />
              </div>
              <div className="mt-6 text-center text-muted-foreground text-xs">Contract Workspace</div>
              <div className="mt-4 space-y-4 lg:hidden">{renderRightRailContent()}</div>
            </div>
          </div>
        </section>

        <div className={`${focusWritingMode ? "hidden" : "hidden lg:flex"} items-stretch`}>
          <button
            onClick={() => setRightRailOpen((v) => !v)}
            className="h-full w-6 border-l border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center transition-all"
            data-testid="divider-toggle-right-contract-rail"
            title={rightRailVisible ? "Collapse AI panel" : "Expand AI panel"}
            aria-label={rightRailVisible ? "Collapse AI panel" : "Expand AI panel"}
          >
            {rightRailVisible ? <ChevronRight size={15} className="drop-shadow" /> : <ChevronLeft size={15} className="drop-shadow" />}
          </button>
        </div>

        <aside
          className={`hidden lg:flex transition-[width] duration-300 ease-out overflow-hidden ${
            rightRailVisible
              ? "w-[300px] xl:w-[320px] border-l border-[hsl(var(--preview-border))] bg-background/45 backdrop-blur-xl"
              : "w-0 border-l-0"
          }`}
        >
          <div className="w-[300px] xl:w-[320px] p-3 md:p-4 space-y-4 overflow-y-auto scrollbar-hide">
            {renderRightRailContent()}
          </div>
        </aside>
      </main>

      <footer className="glass-shell border-t border-[hsl(var(--preview-border))] px-3 md:px-8 py-2 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 md:gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-primary" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-tight">SSL Encrypted Session</span>
          </div>
          <div className="flex items-center gap-2">
            <Cloud size={14} className="text-primary" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-tight">
              {saveStatus === "error" ? "Cloud Sync Error" : "Cloud Sync Active"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3 ml-auto">
          <button
            className="p-1 hover:text-primary transition-colors text-muted-foreground"
            onClick={() => setZoom((z) => clamp(z - 10, 70, 150))}
            data-testid="button-zoom-out"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-[10px] font-bold text-foreground">{zoom}%</span>
          <button
            className="p-1 hover:text-primary transition-colors text-muted-foreground"
            onClick={() => setZoom((z) => clamp(z + 10, 70, 150))}
            data-testid="button-zoom-in"
          >
            <ZoomIn size={18} />
          </button>
          <div className="h-4 w-px bg-primary/20 mx-2" />
          <button
            className="p-1 hover:text-primary transition-colors text-muted-foreground"
            onClick={printContract}
            data-testid="button-print-contract"
          >
            <Printer size={18} />
          </button>
          <button
            className="p-1 hover:text-primary transition-colors text-muted-foreground"
            onClick={downloadContract}
            data-testid="button-download-contract"
          >
            <Download size={18} />
          </button>
          <button
            className="p-1 hover:text-primary transition-colors text-muted-foreground"
            onClick={() =>
              apiRequest("POST", "/api/search-history", {
                type: "contract",
                query: (form.title || "Contract Draft").slice(0, 120),
              }).catch(() => {})
            }
            data-testid="button-log-contract-session"
            title="Log session activity"
          >
            <Search size={18} />
          </button>
        </div>
      </footer>
    </div>
  );
}
