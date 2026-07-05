import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  CircleHelp,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LegalEditor, type LegalEditorHandle } from "@/components/legal-editor";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { api } from "@shared/routes";
import type { Document as StoredDocument } from "@shared/schema";
import { StyleMemoryPanel } from "@/components/style-memory-panel";
import { generateLegalPDF } from "@/lib/generate-legal-pdf";
import { useDocumentHead } from "@/hooks/use-document-head";
import { TutorialCards } from "@/components/tutorial-cards";

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
  customContractType?: string;
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
  "Other",
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
    id: "contractual-limitation-liability",
    title: "Limitation of Liability",
    category: "Contractual Clauses",
    subtitle: "Cap damages and exclude indirect losses.",
    prompt: "Draft a limitation of liability clause capping direct damages and expressly excluding indirect, consequential, and punitive damages.",
  },
  {
    id: "contractual-warranties-reps",
    title: "Warranties and Representations",
    category: "Contractual Clauses",
    subtitle: "Assurances of authority and compliance.",
    prompt: "Draft mutual representations and warranties regarding corporate authority, non-infringement, and compliance with laws.",
  },
  {
    id: "contractual-intellectual-property",
    title: "Intellectual Property Rights",
    category: "Contractual Clauses",
    subtitle: "Ownership, licensing, and work product.",
    prompt: "Draft an intellectual property rights clause defining ownership of pre-existing IP and assigning rights to newly developed work product.",
  },
  {
    id: "contractual-non-solicitation",
    title: "Non-Solicitation Clause",
    category: "Contractual Clauses",
    subtitle: "Prohibit poaching employees or clients.",
    prompt: "Draft a non-solicitation clause preventing the poaching of employees, contractors, and existing clients for a defined period.",
  },
  {
    id: "contractual-liquidated-damages",
    title: "Liquidated Damages",
    category: "Contractual Clauses",
    subtitle: "Pre-agreed compensation for specific breaches.",
    prompt: "Draft a liquidated damages clause specifying a genuine pre-estimate of loss for specific delays or breaches, explicitly stating it is not a penalty.",
  },
  {
    id: "contractual-subcontracting",
    title: "Subcontracting Clause",
    category: "Contractual Clauses",
    subtitle: "Rules for delegating obligations.",
    prompt: "Draft a subcontracting clause requiring prior written consent before delegating duties and holding the main contractor liable for subcontractor acts.",
  },
  {
    id: "contractual-data-privacy",
    title: "Data Privacy & Protection",
    category: "Contractual Clauses",
    subtitle: "Compliance with data protection laws.",
    prompt: "Draft a data privacy clause requiring compliance with applicable data protection regulations, ensuring secure processing and breach notification.",
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

const MANDATORY_CLAUSES_BY_TYPE: Record<string, Array<{ id: string; label: string; keywords: string[]; prompt: string }>> = {
  "Service Agreement": [
    { id: "scope", label: "Scope of Services", keywords: ["scope of services", "services"], prompt: "Draft a comprehensive Scope of Services clause detailing service deliverables, timelines, and milestones." },
    { id: "payment", label: "Payment / Consideration", keywords: ["payment", "consideration", "fees"], prompt: "Draft a detailed Payment Terms clause specifying fee structure, invoicing schedule, late payment interest, and applicable taxes." },
    { id: "term", label: "Term", keywords: ["term", "duration"], prompt: "Draft a Term and Duration clause defining the start date and renewal options." },
    { id: "termination", label: "Termination", keywords: ["termination", "terminate"], prompt: "Draft a Termination clause outlining termination for cause, notice periods for convenience, and post-termination obligations." },
    { id: "confidentiality", label: "Confidentiality", keywords: ["confidentiality", "confidential information"], prompt: "Draft a strict Mutual Confidentiality clause defining confidential information, non-disclosure obligations, and exclusions." },
    { id: "disputes", label: "Dispute Resolution", keywords: ["arbitration", "dispute resolution"], prompt: "Draft a Dispute Resolution clause providing for mediation followed by binding arbitration seated in Pakistan under the Arbitration Act, 1940." },
    { id: "law", label: "Governing Law", keywords: ["governing law", "jurisdiction"], prompt: "Draft a Governing Law and Jurisdiction clause locking the agreement to the laws of Pakistan and exclusive jurisdiction of Pakistani courts." },
  ],
  "Employment Agreement": [
    { id: "role", label: "Role and Duties", keywords: ["duties", "position", "job title"], prompt: "Draft a Job Description, Duties and Reporting Structure clause outlining employee responsibilities." },
    { id: "compensation", label: "Compensation", keywords: ["salary", "compensation", "wages"], prompt: "Draft a Compensation and Benefits clause defining salary, payroll schedule, and mandatory tax withholdings." },
    { id: "term", label: "Term and Probation", keywords: ["probation", "term"], prompt: "Draft a Term and Probationary Period clause specifying probation duration and evaluation criteria." },
    { id: "leave", label: "Leave and Benefits", keywords: ["leave", "benefits"], prompt: "Draft a Leave Entitlement clause covering annual, sick, and maternity leaves in compliance with Pakistani labor laws." },
    { id: "termination", label: "Termination", keywords: ["termination", "dismissal"], prompt: "Draft an Employment Termination clause detailing notice periods, severance pay, and grounds for dismissal." },
    { id: "confidentiality", label: "Confidentiality", keywords: ["confidential"], prompt: "Draft an Employee Non-Disclosure and Confidentiality clause protecting proprietary corporate assets." },
    { id: "law", label: "Governing Law", keywords: ["governing law", "jurisdiction"], prompt: "Draft a Governing Law and Jurisdiction clause locking the employment agreement to the provincial labor laws of Pakistan." },
  ],
  "NDA (Non-Disclosure)": [
    { id: "definition", label: "Confidential Information Definition", keywords: ["confidential information"], prompt: "Draft a broad Definition of Confidential Information including technical, commercial, and financial data." },
    { id: "obligation", label: "Use and Non-Disclosure Obligations", keywords: ["non-disclosure", "use of confidential"], prompt: "Draft strict Non-Disclosure and Non-Use Obligations for the receiving party." },
    { id: "exceptions", label: "Exclusions", keywords: ["exclusions", "public domain"], prompt: "Draft standard Exclusions from Confidentiality (e.g., public domain, prior knowledge, independent development)." },
    { id: "term", label: "Term and Survival", keywords: ["term", "survive", "survival"], prompt: "Draft a Term of Agreement and Survival of Confidentiality Obligations clause (e.g., surviving for 3 years post-termination)." },
    { id: "remedies", label: "Remedies", keywords: ["injunctive relief", "remedies"], prompt: "Draft a Remedies clause specifying entitlement to injunctive relief and specific performance in case of breach." },
    { id: "law", label: "Governing Law", keywords: ["governing law", "jurisdiction"], prompt: "Draft a Governing Law and Dispute Resolution clause providing for arbitration under the laws of Pakistan." },
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
    customContractType: "",
  };
}

function buildGenerationPrompt(form: ContractFormState, selectedClauses?: Array<{ title: string; prompt: string }>): string {
  const actualType = form.contractType === "Other" && form.customContractType ? form.customContractType : form.contractType;
  
  let clauseInstruction = "";
  if (selectedClauses && selectedClauses.length > 0) {
    clauseInstruction = `\n\nINCORPORATE THESE SPECIFIC CLAUSES (Draft them in detail):\n${selectedClauses.map((c, i) => `${i + 1}. [${c.title}]: ${c.prompt}`).join("\n")}`;
  }

  return `You are drafting a formal Pakistani legal contract.

Contract Type: ${actualType}
Document Title: ${form.title}
First Party: ${form.firstParty || "[Not provided]"}
Second Party: ${form.secondParty || "[Not provided]"}
Effective Date: ${form.effectiveDate || "[Not provided]"}
Termination Notice: ${form.terminationNotice || "[Not provided]"}
Jurisdiction: ${form.jurisdiction || "[Not provided]"}
Specific Obligations: ${form.obligations || "[Not provided]"}${clauseInstruction}

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
  useDocumentHead({
    title: "Contract Drafting — Pakistani Contract Act 1872",
    description: "Draft contracts under Pakistani law. AI-assisted clause generation with Contract Act 1872 and Arbitration Act 1940 compliance.",
    path: "/contract-drafting",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement | null>(null);

  const [form, setForm] = useState<ContractFormState>(makeDefaultState());
  const [contractText, setContractText] = useState("");
  const [editorHtml, setEditorHtml] = useState("");
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("hasSeenDraftingTutorial")) {
      setShowTutorial(true);
      localStorage.setItem("hasSeenDraftingTutorial", "true");
    }
  }, []);
  const editorRef = useRef<LegalEditorHandle | null>(null);

  const setEditorContent = useCallback((content: string) => {
    setEditorHtml(content);
    editorRef.current?.setContent(content);
    setTimeout(() => {
      const text = editorRef.current?.getText() || "";
      setContractText(text);
    }, 0);
  }, []);
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
  const [selectedClauses, setSelectedClauses] = useState<Array<{ id: string; title: string; prompt: string; custom?: boolean }>>([]);
  const [customClausePrompt, setCustomClausePrompt] = useState("");
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
  const [generatingClauseId, setGeneratingClauseId] = useState<string | null>(null);
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
      if (typeof parsed.contractText === "string") {
        setContractText(parsed.contractText);
        setEditorContent(parsed.contractText);
      }
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
          messages: [{ role: "user", content: buildGenerationPrompt(form, selectedClauses) }],
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

      setEditorContent(generated);
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

  const applySuggestedClause = async (prompt: string, clauseId?: string) => {
    if (clauseId) {
      setGeneratingClauseId(clauseId);
    } else {
      setIsGenerating(true);
    }
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
      const current = editorRef.current?.getHTML() || contractText;
      const trimmed = current.trim();
      const nextContent = trimmed ? `${trimmed}<br/><br/>${clause}` : clause;
      setEditorContent(nextContent);
      toast({ title: "Clause inserted" });
    } catch (err: any) {
      toast({
        title: "Clause generation failed",
        description: err?.message || "Could not add clause.",
        variant: "destructive",
      });
    } finally {
      if (clauseId) {
        setGeneratingClauseId(null);
      } else {
        setIsGenerating(false);
      }
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
    const currentHtml = editorRef.current?.getHTML() || contractText;
    let newHtml = currentHtml;
    if (item.originalSnippet && currentHtml.includes(item.originalSnippet)) {
      newHtml = currentHtml.replace(item.originalSnippet, item.suggestedText);
    } else {
      newHtml = `${currentHtml.trim()}<br/><br/>${item.suggestedText}`;
    }
    setEditorContent(newHtml);
    
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

  const parseHtmlToDocxSections = (htmlContent: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    const sections: any[] = [];

    doc.body.childNodes.forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;

      if (["H1", "H2", "H3", "H4"].includes(el.tagName)) {
        const level = parseInt(el.tagName.replace("H", ""), 10);
        sections.push({
          heading: el.textContent?.trim() || "",
          level: level,
          content: "",
        });
      } else if (el.tagName === "TABLE") {
        const headers: string[] = [];
        const rows: string[][] = [];
        
        el.querySelectorAll("th").forEach((th) => headers.push(th.textContent?.trim() || ""));
        
        el.querySelectorAll("tr").forEach((tr) => {
          const rowCells: string[] = [];
          tr.querySelectorAll("td").forEach((td) => rowCells.push(td.textContent?.trim() || ""));
          if (rowCells.length > 0) rows.push(rowCells);
        });

        sections.push({
          table: { headers, rows }
        });
      } else {
        const text = el.textContent?.trim() || "";
        if (!text) return;

        // If we have an existing section, append this line to its content
        if (sections.length > 0 && !sections[sections.length - 1].table) {
          const lastSec = sections[sections.length - 1];
          lastSec.content = lastSec.content ? lastSec.content + "\n" + text : text;
        } else {
          sections.push({
            content: text,
          });
        }
      }
    });

    return sections;
  };

  const downloadContractAsDocx = async () => {
    const htmlContent = editorRef.current?.getHTML() || contractText;
    if (!htmlContent.trim()) {
      toast({ title: "Nothing to download", description: "Contract draft is empty.", variant: "destructive" });
      return;
    }

    const sections = parseHtmlToDocxSections(htmlContent);
    const title = form.title || "Contract Draft";

    try {
      const response = await fetch("/api/documents/generate-docx", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, sections }),
      });

      if (!response.ok) {
        throw new Error("Failed to export Word document");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(form.title || "contract-draft").replace(/\s+/g, "-").toLowerCase()}.docx`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "Success", description: "Word document exported successfully!" });
    } catch (err: any) {
      console.error("DOCX download error:", err);
      toast({ title: "Export failed", description: "Could not create Word document.", variant: "destructive" });
    }
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
    // Wrap plain text in basic HTML structure for the PDF generator
    const htmlContent = contractText
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return "";
        // Detect headings (all-caps lines or short bold lines)
        if (trimmed === trimmed.toUpperCase() && trimmed.length < 80 && trimmed.length > 2) {
          return `<h2>${trimmed}</h2>`;
        }
        return `<p>${trimmed}</p>`;
      })
      .join("");

    generateLegalPDF({
      html: htmlContent,
      title: form.title || "Untitled Contract",
      draftType: form.contractType || "Contract",
      court: form.jurisdiction || undefined,
      parties: [form.firstParty, form.secondParty].filter(Boolean).join(" and "),
      isDraft: !selectedDocId,
    });
    toast({ title: "Exported as PDF" });
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
            <ShieldCheck size={16} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground tracking-tight">Compliance Findings</h3>
          </div>
          <button
            className="text-[10px] px-2 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-50"
            onClick={() => runComplianceCheck({ silent: false })}
            disabled={isRunningCompliance}
            data-testid="button-run-contract-compliance-rail"
          >
            {isRunningCompliance ? "Scanning..." : "Scan"}
          </button>
        </div>
        <div className="space-y-2">
          {complianceRisks.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Run compliance check to scan the contract for risks and missing clauses.
            </p>
          ) : (
            <>
              {riskSeverityFilter !== "all" && (
                <div className="flex justify-end mb-1">
                  <button
                    onClick={() => setRiskSeverityFilter("all")}
                    className="text-[9px] text-primary hover:underline"
                  >
                    Show All ({complianceRisks.length})
                  </button>
                </div>
              )}
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {filteredComplianceRisks.length === 0 ? (
                  <p className="text-[10px] text-foreground">
                    {riskSeverityFilter === "danger"
                      ? "No critical findings in the latest scan."
                      : "No warning findings in the latest scan."}
                  </p>
                ) : (
                  filteredComplianceRisks.map((risk) => (
                    <button
                      key={risk.id}
                      onClick={() => applySuggestedClause(risk.prompt)}
                      className={`w-full text-left p-2 rounded-lg border transition-all hover:bg-primary/5 ${
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
                        <span className="text-[11px] font-semibold text-foreground">{risk.title}</span>
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-1 leading-tight">{risk.detail}</p>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div data-tutorial="redlines" className="glass-surface backdrop-blur-lg p-3 rounded-xl shadow-2xl border border-primary/20">
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

      <div data-tutorial="style-memory"><StyleMemoryPanel module="contract-drafting" /></div>
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
          <button 
            onClick={() => setShowTutorial(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-card/50 hover:bg-card px-2.5 py-1.5 rounded-lg border border-[hsl(var(--preview-border))] transition-colors"
          >
            <CircleHelp size={14} />
            <span className="hidden md:inline">Tutorial</span>
          </button>
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
              onClick={downloadContractAsDocx}
              data-testid="button-header-export-docx"
            >
              <FileText size={11} className="shrink-0" />
              DOCX
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
          data-tutorial="ai-engine"
          className={`w-full lg:shrink-0 glass-surface border-b lg:border-b-0 border-[hsl(var(--preview-border))] transition-[width] duration-300 ease-out overflow-hidden ${
            leftRailVisible ? "lg:w-[300px] lg:border-r" : "lg:w-0 lg:border-r-0"
          } ${focusWritingMode ? "hidden" : ""}`}
        >
          <div className="w-full lg:w-[300px] h-full flex flex-col">
            <div className="p-2.5 overflow-y-auto scrollbar-hide flex-1 space-y-2.5">
            <div className="space-y-0.5">
              <h2 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <FileText size={14} className="text-primary" />
                Input Parameters
              </h2>
              <p className="text-[10px] text-muted-foreground">Provide details to generate the legal draft</p>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Contract Title</label>
                <Input
                  value={form.title}
                  onChange={(e) => onFieldChange("title", e.target.value)}
                  className="w-full h-8 bg-card/50 border border-border rounded-md px-2.5 text-xs text-foreground focus:border-primary focus-visible:ring-primary/30 placeholder:text-muted-foreground"
                  placeholder="e.g. Service Agreement 2026"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Contract Type</label>
                <div className="flex gap-2">
                  <select
                    value={form.contractType}
                    onChange={(e) => onFieldChange("contractType", e.target.value)}
                    className="w-full h-8 bg-card/50 border border-border rounded-md px-2.5 text-xs text-foreground focus:border-primary outline-none"
                  >
                    {CONTRACT_TYPES.map((type) => (
                      <option key={type} value={type} className="bg-background">
                        {type}
                      </option>
                    ))}
                  </select>
                  {form.contractType === "Other" && (
                    <Input
                      value={form.customContractType || ""}
                      onChange={(e) => onFieldChange("customContractType", e.target.value)}
                      className="w-full h-8 bg-card/50 border border-border rounded-md px-2.5 text-xs text-foreground focus:border-primary focus-visible:ring-primary/30 placeholder:text-muted-foreground"
                      placeholder="e.g. Licensing Agreement"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-primary/90 uppercase text-[9px] font-bold tracking-widest">Parties</div>
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">First Party (Employer)</label>
                  <Input
                    value={form.firstParty}
                    onChange={(e) => onFieldChange("firstParty", e.target.value)}
                    className="w-full h-8 bg-card/50 border border-border rounded-md px-2.5 text-xs text-foreground focus:border-primary focus-visible:ring-primary/30 placeholder:text-muted-foreground"
                    placeholder="e.g. Malik & Sons Enterprises"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Second Party (Contractor)</label>
                  <Input
                    value={form.secondParty}
                    onChange={(e) => onFieldChange("secondParty", e.target.value)}
                    className="w-full h-8 bg-card/50 border border-border rounded-md px-2.5 text-xs text-foreground focus:border-primary focus-visible:ring-primary/30 placeholder:text-muted-foreground"
                    placeholder="Full Legal Name"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-primary/90 uppercase text-[9px] font-bold tracking-widest">Duration</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Effective Date</label>
                  <Input
                    type="date"
                    value={form.effectiveDate}
                    onChange={(e) => onFieldChange("effectiveDate", e.target.value)}
                    className="w-full h-8 bg-card/50 border border-border rounded-md px-2.5 text-xs text-foreground focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Notice Period</label>
                  <select
                    value={form.terminationNotice}
                    onChange={(e) => onFieldChange("terminationNotice", e.target.value)}
                    className="w-full h-8 bg-card/50 border border-border rounded-md px-2.5 text-xs text-foreground focus:border-primary outline-none"
                  >
                    {NOTICE_PERIODS.map((p) => (
                      <option key={p} value={p} className="bg-background">
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-primary/90 uppercase text-[9px] font-bold tracking-widest">Jurisdiction</div>
              <div className="flex flex-wrap gap-1.5">
                {JURISDICTIONS.map((city) => (
                  <button
                    key={city}
                    onClick={() => onFieldChange("jurisdiction", city)}
                    className={`px-2.5 py-1 rounded-full border text-[10px] font-bold transition-all ${
                      form.jurisdiction === city
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card/50 text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground italic">Contract Act, 1872 (IX of 1872)</p>
            </div>

            <div className="space-y-1.5">
              <div className="text-primary/90 uppercase text-[9px] font-bold tracking-widest">Obligations</div>
              <Textarea
                value={form.obligations}
                onChange={(e) => onFieldChange("obligations", e.target.value)}
                className="w-full bg-card/50 border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus-visible:ring-primary/30 placeholder:text-muted-foreground resize-none"
                placeholder="Describe the service scope or payment terms..."
                rows={2}
              />
            </div>

            <div data-tutorial="clause-library" className="space-y-2 rounded-lg border border-border p-2 bg-card/20">
              <div className="flex items-center gap-1.5 justify-between">
                <div className="flex items-center gap-1.5">
                  <Library size={14} className="text-primary" />
                  <p className="text-[12px] font-bold text-primary uppercase tracking-wider">Clause Builder Plan</p>
                </div>
                {selectedClauses.length > 0 && (
                  <button 
                    onClick={() => setSelectedClauses([])}
                    className="text-[9px] text-muted-foreground hover:text-red-300 transition-colors"
                  >
                    Clear Plan ({selectedClauses.length})
                  </button>
                )}
              </div>

              {/* Selected Clauses Plan list */}
              {selectedClauses.length > 0 ? (
                <div className="space-y-1.5 p-1.5 rounded bg-primary/5 border border-primary/20 max-h-40 overflow-y-auto">
                  <p className="text-[9px] font-bold text-foreground mb-1 uppercase tracking-wider">Plan Details:</p>
                  {selectedClauses.map((c) => (
                    <div key={c.id} className="flex items-start justify-between gap-1.5 p-1 rounded bg-white/5 border border-white/5">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-foreground truncate">{c.title}</p>
                        <p className="text-[8px] text-muted-foreground truncate leading-none">{c.prompt}</p>
                      </div>
                      <button 
                        onClick={() => setSelectedClauses((prev) => prev.filter((item) => item.id !== c.id))}
                        className="shrink-0 text-muted-foreground hover:text-red-300 p-0.5"
                        title="Remove clause"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[9px] text-muted-foreground italic">No clauses selected yet. Choose from the library below or add custom ones to build your contract plan.</p>
              )}

              {/* Clause search & library */}
              <div className="pt-2 border-t border-border/40 mt-1 space-y-1.5">
                <div className="text-[9px] font-semibold text-muted-foreground uppercase">Add from Library:</div>
                <div className="flex gap-1">
                  <Input
                    value={clauseSearch}
                    onChange={(e) => setClauseSearch(e.target.value)}
                    className="h-7 bg-card/50 border border-border text-[10px] text-foreground placeholder:text-muted-foreground flex-1"
                    placeholder="Search clause..."
                  />
                  <select
                    value={clauseCategory}
                    onChange={(e) => setClauseCategory(e.target.value)}
                    className="h-7 bg-card/50 border border-border rounded-md px-1 text-[10px] text-foreground outline-none focus:border-primary shrink-0 max-w-[80px]"
                  >
                    {clauseCategories.map((category) => (
                      <option key={category} value={category} className="bg-background">
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1 border border-border/30 rounded p-1 bg-black/10">
                  {filteredClauseLibrary.map((item) => {
                    const isAdded = selectedClauses.some((c) => c.id === item.id);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-1.5 px-1.5 py-1 rounded bg-card/30 border border-border/30 text-[10px]"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-foreground truncate block">{item.title}</span>
                          <span className="text-muted-foreground text-[8px] truncate block leading-none">{item.subtitle}</span>
                        </div>
                        <button
                          onClick={() => {
                            if (isAdded) {
                              setSelectedClauses((prev) => prev.filter((c) => c.id !== item.id));
                            } else {
                              setSelectedClauses((prev) => [...prev, { id: item.id, title: item.title, prompt: item.prompt }]);
                            }
                          }}
                          className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold ${
                            isAdded
                              ? "bg-red-500/20 text-red-300 border border-red-400/30 hover:bg-red-500/30"
                              : "bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30"
                          }`}
                        >
                          {isAdded ? "Remove" : "Add"}
                        </button>
                      </div>
                    );
                  })}
                  {!filteredClauseLibrary.length && (
                    <p className="text-[10px] text-muted-foreground text-center py-2">No matching clauses.</p>
                  )}
                </div>
              </div>

              {/* Add Custom Clause Section */}
              <div className="pt-2 border-t border-border/40 mt-1 space-y-1.5">
                <div className="text-[9px] font-semibold text-muted-foreground uppercase">Add Custom Clause:</div>
                <div className="flex gap-1 items-start">
                  <Textarea
                    value={customClausePrompt}
                    onChange={(e) => setCustomClausePrompt(e.target.value)}
                    placeholder="e.g. 5% late penalty"
                    className="text-[10px] min-h-[36px] h-9 resize-none px-2 py-1 bg-card/30 border border-border focus:border-primary focus-visible:ring-primary/30 flex-1 leading-tight"
                  />
                  <button
                    onClick={() => {
                      if (!customClausePrompt.trim()) return;
                      const customId = `custom-${Date.now()}`;
                      setSelectedClauses((prev) => [
                        ...prev,
                        {
                          id: customId,
                          title: `Custom (${customClausePrompt.trim().slice(0, 18)}...)`,
                          prompt: customClausePrompt.trim(),
                          custom: true,
                        },
                      ]);
                      setCustomClausePrompt("");
                      toast({ title: "Custom clause added to plan" });
                    }}
                    className="shrink-0 h-9 px-2 bg-primary/20 border border-primary/30 hover:bg-primary/30 text-primary rounded text-xs font-semibold flex items-center justify-center"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 rounded-lg border border-border p-2">
              <div className="flex items-center gap-1.5">
                <ListChecks size={12} className="text-primary" />
                <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">
                  Mandatory Clauses
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1 flex-1 rounded-full bg-accent overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${mandatoryCoverage}%` }} />
                </div>
                <span className="text-[9px] text-emerald-600 dark:text-emerald-300 font-semibold">{mandatoryCoverage}%</span>
              </div>
              <div className="space-y-1.5 mt-2">
                {mandatoryChecks.map((check) => {
                  const isGeneratingThis = generatingClauseId === check.id;
                  const anyLoading = isGenerating || isRunningCompliance || isRunningRedline || !!generatingClauseId;
                  return (
                    <div
                      key={check.id}
                      className={`p-1.5 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                        check.present
                          ? "bg-emerald-500/5 border-emerald-500/20"
                          : "bg-amber-500/5 border-amber-500/20"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-foreground truncate">{check.label}</p>
                        <p className="text-[8px] text-muted-foreground truncate">
                          {check.present ? "Clause detected" : "Missing clause"}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {check.present ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/25">
                            <CheckCircle2 size={10} />
                            Covered
                          </span>
                        ) : (
                          <button
                            onClick={() => applySuggestedClause(check.prompt, check.id)}
                            disabled={anyLoading}
                            className="inline-flex items-center gap-0.5 text-[9px] font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 disabled:opacity-50 px-1.5 py-0.5 rounded transition-all cursor-pointer"
                            title="Draft this clause"
                          >
                            {isGeneratingThis ? (
                              <Loader2 size={10} className="animate-spin text-primary" />
                            ) : (
                              <Sparkles size={10} className="text-primary" />
                            )}
                            Auto-Draft
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </div>

            <div className="p-2.5 border-t border-border space-y-1.5">
              <button
                onClick={generateDraft}
                className="w-full py-2 bg-primary hover:bg-primary rounded-md text-primary-foreground font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                data-testid="button-generate-contract-draft"
                disabled={isGenerating}
              >
                {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {isGenerating ? "Generating..." : "Generate Contract Draft"}
              </button>
              <button
                onClick={() => runComplianceCheck({ silent: false })}
                className="w-full py-2 bg-card/50 border border-border rounded-md text-foreground font-semibold text-xs hover:bg-accent transition-colors flex items-center justify-center gap-1.5"
                data-testid="button-run-contract-compliance"
                disabled={isRunningCompliance}
              >
                {isRunningCompliance ? <Loader2 size={14} className="animate-spin" /> : <ScanText size={14} />}
                {isRunningCompliance ? "Scanning..." : "AI Risk Scan"}
              </button>
              <button
                onClick={runCounterpartyRedline}
                className="w-full py-2 bg-card/50 border border-border rounded-md text-foreground font-semibold text-xs hover:bg-accent transition-colors flex items-center justify-center gap-1.5"
                data-testid="button-run-counterparty-redline"
                disabled={isRunningRedline}
              >
                {isRunningRedline ? <Loader2 size={14} className="animate-spin" /> : <GitCompareArrows size={14} />}
                {isRunningRedline ? "Reviewing..." : "Redline Mode"}
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


              <div
                data-tutorial="editor"
                className="rounded-2xl border border-[hsl(var(--preview-border))] bg-background/72 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08)] backdrop-blur-xl p-3 md:p-5 lg:p-7 min-h-[560px] md:min-h-[760px] print:bg-white print:text-black"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
                ref={printRef}
              >
                <LegalEditor
                  ref={editorRef}
                  initialContent={editorHtml || contractText}
                  onUpdate={(html, text) => {
                    setEditorHtml(html);
                    setContractText(text);
                  }}
                  className="w-full min-h-[520px] md:min-h-[700px] border-0 p-0 text-[15px] leading-relaxed text-foreground print:text-black"
                  placeholder="Your generated contract draft will appear here..."
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
            title="Download TXT Document"
          >
            <Download size={18} />
          </button>
          <button
            className="p-1 hover:text-primary transition-colors text-muted-foreground"
            onClick={downloadContractAsDocx}
            data-testid="button-download-contract-docx"
            title="Download Word (DOCX) Document"
          >
            <FileText size={18} />
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
      <TutorialCards open={showTutorial} onOpenChange={setShowTutorial} moduleName="Contract Drafting" />
    </div>
  );
}
