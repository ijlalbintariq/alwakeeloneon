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
  Palette,
  Send,
  Paperclip,
  Mic,
  Square,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { LegalEditor, type LegalEditorHandle } from "@/components/legal-editor";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { api } from "@shared/routes";
import {
  Document as DocxDocument,
  Paragraph as DocxParagraph,
  Packer as DocxPacker,
  TextRun as DocxTextRun,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  BorderStyle as DocxBorderStyle,
  WidthType as DocxWidthType,
  HeadingLevel as DocxHeadingLevel,
  AlignmentType as DocxAlignmentType,
  Footer as DocxFooter,
  PageNumber as DocxPageNumber,
  Header as DocxHeader,
} from "docx";
import type { Document as StoredDocument } from "@shared/schema";
import { plainTextToTiptapHTML, isHTMLContent } from "@/lib/plain-to-tiptap";
import { CONTRACT_TEMPLATES_MAP } from "@/lib/templates-data";
import { StyleMemoryPanel } from "@/components/style-memory-panel";
import { generateLegalPDF } from "@/lib/generate-legal-pdf";
import { useDocumentHead } from "@/hooks/use-document-head";
import { TutorialCards } from "@/components/tutorial-cards";
import { formatDuration, useVoiceRecorder } from "@/hooks/use-voice-recorder";

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
  "SaaS Agreement",
  "Shareholders Agreement",
  "Construction Agreement",
  "Founders Agreement",
  "Memorandum of Understanding",
  "Software License Agreement",
  "Copyright Assignment Deed",
  "IP Assignment Agreement",
  "Trademark License Agreement",
  "Settlement Deed",
  "Will (Last Will & Testament)",
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
  {
    id: "pakistan-tax-withholding",
    title: "Tax Withholding & Sales Tax Compliance",
    category: "Corporate & Commercial Clauses",
    subtitle: "Section 153 ITO 2001 and provincial sales tax (PRA/SRB).",
    prompt: "Draft a tax withholding and sales tax compliance clause specifying deduction of income tax at source under Section 153 of the Income Tax Ordinance, 2001 and invoicing with provincial sales tax on services (PRA, SRB, KPRA, or BRA) at standard rates, including exchange of active tax filer status certifications.",
  },
  {
    id: "pakistan-specific-relief-injunction",
    title: "Specific Injunctions (Specific Relief Act 1877)",
    category: "Contractual Clauses",
    subtitle: "Equitable relief under Sections 54 and 55.",
    prompt: "Draft an equitable and injunctive relief clause stating that monetary damages would be inadequate in the event of a breach, and that the disclosing party shall be entitled to seek temporary and permanent injunctions and specific performance under Sections 54 and 55 of the Specific Relief Act, 1877 from a court of competent jurisdiction.",
  },
  {
    id: "pakistan-witnesses-execution",
    title: "Execution Witness Block (Qanun-e-Shahadat 1984)",
    category: "Contractual Clauses",
    subtitle: "Section 17 QSO witness block with CNICs.",
    prompt: "Draft a standard Pakistani execution witness block requiring the signature, name, address, and CNIC number of two (2) male witnesses (or one male and two female witnesses) in accordance with Section 17 of the Qanun-e-Shahadat Order, 1984.",
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

  // Get master template from mapping if it exists
  const masterTemplate = form.contractType !== "Other" ? CONTRACT_TEMPLATES_MAP[form.contractType] : "";
  const templateReferenceInstruction = masterTemplate 
    ? `\n\nUSE THIS MASTER TEMPLATE AS YOUR FOUNDATION AND STRUCTURAL GUIDELINE (Preserve its formatting, headings, statutory citations of Pakistan, and witnesses execution structure):\n${masterTemplate}`
    : "";

  return `You are drafting a formal Pakistani legal contract.

Contract Type: ${actualType}
Document Title: ${form.title}
First Party: ${form.firstParty || "[Not provided]"}
Second Party: ${form.secondParty || "[Not provided]"}
Effective Date: ${form.effectiveDate || "[Not provided]"}
Termination Notice: ${form.terminationNotice || "[Not provided]"}
Jurisdiction: ${form.jurisdiction || "[Not provided]"}
Specific Obligations: ${form.obligations || "[Not provided]"}${clauseInstruction}${templateReferenceInstruction}

Instructions:
1. Draft a complete, professional contract for Pakistani legal practice.
2. Structure the document clearly:
   - Use bold, uppercase heading lines for major sections (e.g., "1. SCOPE OF SERVICES", "2. PAYMENT AND CONSIDERATION").
   - Put the document title in ALL CAPS at the very top.
   - For any payment schedules, key milestones, or structured data lists, output them as a Markdown table (e.g. | Milestone | Details | Due Date |) for clean grid formatting.
   - Place a line with the text "RESPECTFULLY SHEWETH" or "AFFIDAVIT" before signature blocks or affidavits to trigger physical page breaks.
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
  const appendVoiceTranscription = useCallback((text: string) => {
    setForm((previous) => ({
      ...previous,
      obligations: previous.obligations ? `${previous.obligations}\n${text}` : text,
    }));
    toast({ title: "Voice transcribed successfully" });
  }, [toast]);
  const voice = useVoiceRecorder({ onAutoTranscription: appendVoiceTranscription });

  useEffect(() => {
    if (!localStorage.getItem("hasSeenDraftingTutorial")) {
      setShowTutorial(true);
      localStorage.setItem("hasSeenDraftingTutorial", "true");
    }
  }, []);
  const editorRef = useRef<LegalEditorHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const setEditorContent = useCallback((content: string) => {
    const html = isHTMLContent(content) ? content : plainTextToTiptapHTML(content);
    setEditorHtml(html);
    editorRef.current?.setContent(html);
    setTimeout(() => {
      const text = editorRef.current?.getText() || "";
      setContractText(text);
    }, 0);
  }, []);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isRunningCompliance, setIsRunningCompliance] = useState(false);
  const [complianceRisks, setComplianceRisks] = useState<ComplianceRisk[]>([]);
  const [lastRiskScanAt, setLastRiskScanAt] = useState<Date | null>(null);
  const [riskFromCache, setRiskFromCache] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [clauseSearch, setClauseSearch] = useState("");
  const [selectedClauses, setSelectedClauses] = useState<Array<{ id: string; title: string; prompt: string; custom?: boolean }>>([]);
  const [sidebarTab, setSidebarTab] = useState<"setup" | "clauses" | "audit">("setup");
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [customClausePrompt, setCustomClausePrompt] = useState("");
  const [clauseCategory, setClauseCategory] = useState("All");
  const [redlineItems, setRedlineItems] = useState<RedlineItem[]>([]);
  const [isRunningRedline, setIsRunningRedline] = useState(false);
  const [riskSeverityFilter, setRiskSeverityFilter] = useState<RiskSeverityFilter>("all");
  const [isLoadingClauseSuggestions, setIsLoadingClauseSuggestions] = useState(false);
  const [liveClauseSuggestions, setLiveClauseSuggestions] = useState<ClauseSuggestion[]>([]);
  const [clauseSuggestionError, setClauseSuggestionError] = useState<string | null>(null);
  const [leftRailOpen, setLeftRailOpen] = useState(true);
  const [focusWritingMode, setFocusWritingMode] = useState(false);
  const [styleMemoryMeta, setStyleMemoryMeta] = useState<StyleMemoryMeta | null>(null);
  const [generatingClauseId, setGeneratingClauseId] = useState<string | null>(null);
  const autoRiskScanSignatureRef = useRef<string>("");
  const leftRailVisible = leftRailOpen && !focusWritingMode;

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

  const startNewContract = useCallback(() => {
    if (window.confirm("Are you sure you want to start a new contract? Unsaved changes to the current contract will be lost.")) {
      setForm(makeDefaultState());
      setContractText("");
      setEditorHtml("");
      setSelectedDocId(null);
      setSaveStatus("idle");
      editorRef.current?.setContent("");
      toast({ title: "New contract started", description: "All fields have been reset." });
    }
  }, [toast]);

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
      const prompt = buildGenerationPrompt(form, selectedClauses);

      if (attachments.length > 0) {
        // ── With attachments: FormData, no streaming (server can't stream multipart) ──
        const formData = new FormData();
        formData.append("messages", JSON.stringify([{ role: "user", content: prompt }]));
        formData.append("type", "contract-drafting");
        formData.append("moduleIntent", "contract.generateDraft");
        formData.append("turbo", "false");
        formData.append("stream", "false");
        
        attachments.forEach((file) => {
          formData.append("attachments", file);
        });

        const response = await fetch("/api/ai/chat", {
          method: "POST",
          credentials: "include",
          body: formData,
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
        setAttachments([]);
      } else {
        // ── Without attachments: SSE streaming for live text ──
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }],
            type: "contract-drafting",
            moduleIntent: "contract.generateDraft",
            turbo: false,
            stream: true,
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Failed to generate contract draft");
        }

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("text/event-stream") && response.body) {
          // SSE streaming: read chunks and update editor live
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = "";
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.text) {
                  accumulated += parsed.text;
                  setEditorContent(accumulated);
                }
                if (parsed.styleMemory) {
                  setStyleMemoryMeta(parsed.styleMemory as StyleMemoryMeta | null);
                }
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch (parseErr: any) {
                if (parseErr?.message && !parseErr.message.includes("JSON")) throw parseErr;
              }
            }
          }
          if (!accumulated.trim()) throw new Error("AI returned empty draft.");
        } else {
          // Fallback: JSON response (server didn't stream)
          const data = await response.json();
          const generated = (data?.content || "").trim();
          if (!generated) throw new Error("AI returned empty draft.");
          setStyleMemoryMeta((data?.styleMemory || null) as StyleMemoryMeta | null);
          setEditorContent(generated);
        }
      }

      setAttachments([]);
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

    const title = form.title || "Contract Draft";

    try {
      const parser = new DOMParser();
      const docHtml = parser.parseFromString(htmlContent, "text/html");
      const children: any[] = [];

      // Center, Bold, Uppercase Document Title
      children.push(
        new DocxParagraph({
          heading: DocxHeadingLevel.TITLE,
          spacing: { after: 200 },
          alignment: DocxAlignmentType.CENTER,
          children: [
            new DocxTextRun({
              text: title.toUpperCase(),
              color: "000000",
              font: "Times New Roman",
              size: 22,
              bold: true,
            }),
          ],
        }),
      );

      const cellBorder = {
        top: { style: DocxBorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        bottom: { style: DocxBorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        left: { style: DocxBorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        right: { style: DocxBorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      };

      const parseTextRuns = (element: Node): DocxTextRun[] => {
        const runs: DocxTextRun[] = [];
        
        const traverse = (node: Node, activeStyles: { bold?: boolean; italics?: boolean; underline?: boolean }) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || "";
            if (text) {
              runs.push(new DocxTextRun({
                text: text,
                font: "Times New Roman",
                size: 22, // 11pt
                bold: activeStyles.bold,
                italics: activeStyles.italics,
                underline: activeStyles.underline ? {} : undefined,
              }));
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const styles = { ...activeStyles };
            if (["STRONG", "B"].includes(el.tagName)) styles.bold = true;
            if (["EM", "I"].includes(el.tagName)) styles.italics = true;
            if (["U"].includes(el.tagName)) styles.underline = true;
            
            el.childNodes.forEach(child => traverse(child, styles));
          }
        };

        element.childNodes.forEach(child => traverse(child, {}));
        return runs;
      };

      const getAlignment = (el: HTMLElement) => {
        const textAlign = el.style.textAlign || el.getAttribute("align") || "";
        if (textAlign === "center") return DocxAlignmentType.CENTER;
        if (textAlign === "right") return DocxAlignmentType.RIGHT;
        if (textAlign === "justify") return DocxAlignmentType.JUSTIFIED;
        return DocxAlignmentType.LEFT;
      };

      // Process DOM Nodes
      docHtml.body.childNodes.forEach((node) => {
        if (node.nodeType !== 1) return; // literal 1 for element node
        const el = node as HTMLElement;

        if (["H1", "H2", "H3", "H4"].includes(el.tagName)) {
          const levelVal = parseInt(el.tagName.replace("H", ""), 10);
          const headingLevelsArr = [
            DocxHeadingLevel.HEADING_1,
            DocxHeadingLevel.HEADING_2,
            DocxHeadingLevel.HEADING_3,
            DocxHeadingLevel.HEADING_4,
          ];
          children.push(
            new DocxParagraph({
              heading: headingLevelsArr[Math.min(levelVal - 1, 3)],
              spacing: { before: 120, after: 120 },
              alignment: getAlignment(el),
              children: parseTextRuns(el),
            }),
          );
        } else if (el.tagName === "TABLE") {
          const tableRows: DocxTableRow[] = [];
          
          el.querySelectorAll("tr").forEach((tr) => {
            const cells: DocxTableCell[] = [];
            
            // Check headers
            tr.querySelectorAll("th").forEach((th) => {
              cells.push(
                new DocxTableCell({
                  borders: cellBorder,
                  shading: { fill: "F2F2F2" },
                  children: [
                    new DocxParagraph({
                      alignment: getAlignment(th),
                      children: parseTextRuns(th),
                    }),
                  ],
                }),
              );
            });

            // Check data cells
            tr.querySelectorAll("td").forEach((td) => {
              cells.push(
                new DocxTableCell({
                  borders: cellBorder,
                  children: [
                    new DocxParagraph({
                      alignment: getAlignment(td),
                      children: parseTextRuns(td),
                    }),
                  ],
                }),
              );
            });

            if (cells.length > 0) {
              tableRows.push(new DocxTableRow({ children: cells }));
            }
          });

          if (tableRows.length > 0) {
            children.push(
              new DocxTable({
                width: { size: 100, type: DocxWidthType.PERCENTAGE },
                rows: tableRows,
              }),
            );
            children.push(new DocxParagraph({ text: "" }));
          }
        } else if (["UL", "OL"].includes(el.tagName)) {
          el.querySelectorAll("li").forEach((li) => {
            children.push(
              new DocxParagraph({
                bullet: el.tagName === "UL" ? { level: 0 } : undefined,
                spacing: { after: 120 },
                alignment: getAlignment(li),
                children: parseTextRuns(li),
              }),
            );
          });
        } else {
          // Standard Paragraph, Div, etc.
          const textRuns = parseTextRuns(el);
          if (textRuns.length === 0) return;

          // Default body text alignment to JUSTIFIED if not center/right
          const alignVal = getAlignment(el);
          const finalAlign = alignVal === DocxAlignmentType.LEFT ? DocxAlignmentType.JUSTIFIED : alignVal;

          children.push(
            new DocxParagraph({
              spacing: { line: 276, lineRule: "auto", after: 160 },
              alignment: finalAlign,
              children: textRuns,
            }),
          );
        }
      });

      const doc = new DocxDocument({
        sections: [{
          properties: {
            page: {
              size: {
                width: 12240, // 8.5 inches in twips (1 inch = 1440 twips)
                height: 20160, // 14 inches in twips
              },
              margin: {
                top: 1440,
                bottom: 1440,
                left: 1800, // 1.25 inches binding margin
                right: 1440,
              },
            },
          },
          headers: {
            default: new DocxHeader({
              children: [
                new DocxParagraph({
                  alignment: DocxAlignmentType.RIGHT,
                  children: [
                    new DocxTextRun({
                      text: title.toUpperCase(),
                      font: "Times New Roman",
                      size: 16, // 8pt
                      color: "888888",
                    }),
                  ],
                }),
              ],
            }),
          },
          footers: {
            default: new DocxFooter({
              children: [
                new DocxParagraph({
                  alignment: DocxAlignmentType.CENTER,
                  children: [
                    new DocxTextRun({
                      text: "Page ",
                      font: "Times New Roman",
                      size: 20, // 10pt
                    }),
                    new DocxTextRun({
                      children: [DocxPageNumber.CURRENT],
                      font: "Times New Roman",
                      size: 20,
                    }),
                  ],
                }),
              ],
            }),
          },
          children,
        }],
      });

      const blob = await DocxPacker.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/\s+/g, "-").toLowerCase()}.docx`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "Success", description: "Word document exported successfully!" });
    } catch (err: any) {
      console.error("Client DOCX generation error:", err);
      toast({ title: "Export failed", description: err.message || "Could not create Word document.", variant: "destructive" });
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
    const htmlContent = editorRef.current?.getHTML() || contractText;

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
          <div className="hidden md:block h-8 w-px bg-white dark:bg-[#131E2E]/10" />
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
                <div className="w-24 h-1.5 bg-white dark:bg-[#131E2E]/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${healthScore >= 75 ? "bg-emerald-400" : healthScore >= 45 ? "bg-primary" : "bg-red-400"}`}
                    style={{ width: `${healthScore}%` }}
                  />
                </div>
                <span className="text-primary font-bold text-sm">{healthScore}%</span>
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-1.5 bg-white dark:bg-[#131E2E]/5 px-3 py-2 rounded-xl border border-primary/10">
            <button
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white dark:bg-[#131E2E]/5 px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-primary/10"
              onClick={downloadContract}
              data-testid="button-header-export-txt"
            >
              <Download size={11} className="shrink-0" />
              TXT
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white dark:bg-[#131E2E]/5 px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-primary/10"
              onClick={downloadContractAsDocx}
              data-testid="button-header-export-docx"
            >
              <FileText size={11} className="shrink-0" />
              DOCX
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white dark:bg-[#131E2E]/5 px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-primary/10"
              onClick={printContract}
              data-testid="button-header-export-print"
            >
              <Download size={11} className="shrink-0" />
              PDF
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white dark:bg-[#131E2E]/5 px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-primary/10"
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
          <div className="w-full lg:w-[300px] h-full flex flex-col bg-background/55">
            {/* Tab navigation */}
            <div className="flex border-b border-border bg-card/40">
              <button
                onClick={() => setSidebarTab("setup")}
                className={`flex-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center justify-center gap-1 ${
                  sidebarTab === "setup"
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText size={12} />
                Setup
              </button>
              <button
                onClick={() => setSidebarTab("clauses")}
                className={`flex-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center justify-center gap-1 ${
                  sidebarTab === "clauses"
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Library size={12} />
                Clauses
              </button>
              <button
                onClick={() => setSidebarTab("audit")}
                className={`flex-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center justify-center gap-1 ${
                  sidebarTab === "audit"
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <ShieldCheck size={12} />
                Review
              </button>
            </div>

            {/* Tab Body */}
            <div className="p-2.5 overflow-y-auto scrollbar-hide flex-1 space-y-2.5">
              {sidebarTab === "setup" && (
                <>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <FileText size={14} className="text-primary" />
                        Contract Details
                      </h2>
                      <button
                        onClick={startNewContract}
                        className="text-[9px] px-2 py-0.5 rounded border border-primary/45 text-primary hover:bg-primary/10 font-bold uppercase tracking-wider flex items-center gap-0.5 transition-colors cursor-pointer"
                        title="Start a new contract"
                        type="button"
                      >
                        <Plus size={10} />
                        New
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Define basic details of your contract</p>
                  </div>

                  <div className="space-y-2" data-tutorial="setup">
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Contract Title</label>
                      <div className="flex gap-1.5">
                        <Input
                          value={form.title}
                          onChange={(e) => onFieldChange("title", e.target.value)}
                          className="flex-1 h-8 bg-card/50 border border-border rounded-md px-2.5 text-xs text-foreground focus:border-primary focus-visible:ring-primary/30 placeholder:text-muted-foreground"
                          placeholder="e.g. Service Agreement 2026"
                        />
                        <Dialog>
                          <DialogTrigger asChild>
                            <button
                              className="h-8 px-2 bg-card border border-border rounded-md text-[10px] font-bold text-foreground hover:bg-accent flex items-center gap-1 transition-colors shrink-0 cursor-pointer select-none"
                              title="Select Style Memory / Tone Presets"
                              type="button"
                            >
                              <Palette size={12} className="text-primary" />
                              Style
                            </button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[450px] !p-0 !bg-white dark:bg-[#131E2E] border border-zinc-200 dark:border-zinc-500/20 shadow-2xl overflow-hidden rounded-2xl">
                            <div data-ui-preview="macos" data-theme="light" className="p-6 bg-white dark:bg-[#131E2E] text-zinc-950">
                              <DialogHeader>
                                <DialogTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 text-primary">
                                  <Palette size={16} />
                                  Style & Tone Memory
                                </DialogTitle>
                                <DialogDescription className="text-xs text-zinc-500">
                                  Upload sample contracts or paragraphs to train the AI to copy your personal writing style and vocabulary preferences.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="py-2">
                                <StyleMemoryPanel module="contract-drafting" />
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Contract Type</label>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex gap-2">
                          <select
                            value={form.contractType}
                            onChange={(e) => onFieldChange("contractType", e.target.value)}
                            className="w-full h-8 bg-card/50 border border-border rounded-md px-2.5 text-xs text-foreground focus:border-primary outline-none animate-fade-in"
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
                        {form.contractType !== "Other" && CONTRACT_TEMPLATES_MAP[form.contractType] && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to load the standard template for ${form.contractType}? Unsaved changes in the editor will be overwritten.`)) {
                                setEditorContent(CONTRACT_TEMPLATES_MAP[form.contractType]);
                                toast({ title: "Template Loaded", description: `${form.contractType} standard template has been loaded.` });
                              }
                            }}
                            className="w-full h-7 border border-primary/45 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold rounded transition-colors flex items-center justify-center gap-1 cursor-pointer select-none"
                          >
                            <FileText size={11} />
                            Load Master Template
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-3.5 space-y-2">
                      <label className="block text-[10px] font-medium text-muted-foreground">Direct Drafting Instructions (write here to draft contract directly)</label>
                      <div className="relative bg-card/65 border border-border rounded-xl px-3 py-2.5 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-sm">
                        {attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2 pb-2 border-b border-border/40">
                            {attachments.map((file, idx) => (
                              <div key={idx} className="flex items-center gap-1 bg-primary/10 border border-primary/20 text-primary text-[10px] font-medium px-2 py-0.5 rounded-full">
                                <span className="truncate max-w-[120px]">{file.name}</span>
                                <button
                                  type="button"
                                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                                  className="text-primary/70 hover:text-primary hover:bg-primary/20 rounded p-0.5 cursor-pointer"
                                >
                                  <X size={8} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2 items-start">
                          <textarea
                            value={form.obligations}
                            onChange={(e) => {
                              onFieldChange("obligations", e.target.value);
                              e.target.style.height = "auto";
                              e.target.style.height = `${e.target.scrollHeight}px`;
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                if (!isGenerating && form.obligations.trim()) {
                                  generateDraft();
                                }
                              }
                            }}
                            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none resize-none min-h-[72px] max-h-[calc(100vh-510px)] overflow-y-auto leading-normal placeholder:text-[10px] pt-0.5"
                            placeholder="Describe key obligations, terms, payments, or guidelines here. The AI will draft the entire contract directly based on these instructions..."
                            disabled={isGenerating}
                            rows={3}
                          />
                          <div className="flex flex-col gap-1 shrink-0 pt-0.5" data-tutorial="attach-reference-files">
                            {voice.isRecording ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const text = await voice.stopAndTranscribe();
                                    if (text) appendVoiceTranscription(text);
                                  } catch (error) {
                                    toast({
                                      title: "Transcription failed",
                                      description: error instanceof Error ? error.message : undefined,
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                className="p-1.5 border border-red-500/50 bg-red-500/15 text-red-500 hover:bg-red-500/25 rounded-lg transition-all animate-pulse flex items-center justify-center"
                                title={`Stop recording · ${formatDuration(voice.duration)}`}
                              >
                                <Square size={13} fill="currentColor" />
                              </button>
                            ) : voice.isTranscribing ? (
                              <span className="p-1.5 border border-primary/35 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                                <Loader2 size={15} className="animate-spin" />
                              </span>
                            ) : voice.isSupported ? (
                              <button
                                type="button"
                                onClick={() => voice.startRecording()}
                                disabled={isGenerating}
                                className="p-1.5 border border-primary/35 bg-primary/10 text-primary hover:bg-primary/15 hover:border-primary/50 hover:scale-105 active:scale-95 rounded-lg transition-all duration-150 disabled:opacity-40 flex items-center justify-center"
                                title="Record contract drafting instructions"
                              >
                                <Mic size={15} className="stroke-[2.2]" />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="p-1.5 border border-primary/35 bg-primary/10 text-primary hover:bg-primary/15 hover:border-primary/50 hover:scale-105 active:scale-95 rounded-lg transition-all duration-150 cursor-pointer shadow-[0_1px_2px_rgba(var(--primary),0.05)] flex items-center justify-center"
                              title="Attach file (.pdf, .txt, .docx)"
                            >
                              <Paperclip size={15} className="stroke-[2.2]" />
                            </button>
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length > 0) {
                                  setAttachments((prev) => [...prev, ...files].slice(0, 5)); // Max 5 attachments
                                }
                                e.target.value = ""; // Clear file selector input
                              }}
                              accept=".pdf,.txt,.docx,.doc"
                              multiple
                              className="hidden"
                            />
                          </div>
                        </div>
                        {voice.error && (
                          <p className="mt-1 text-[10px] text-red-500">{voice.error}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (form.obligations.trim()) {
                            generateDraft();
                          }
                        }}
                        disabled={isGenerating || !form.obligations.trim()}
                        className="w-full py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md shadow-primary/10 active:scale-[0.99]"
                      >
                        {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        {isGenerating ? "Generating..." : "Generate the Contract"}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {sidebarTab === "clauses" && (
                <div className="space-y-2.5">
                  <div className="space-y-0.5" data-tutorial="clause-library">
                    <h2 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Library size={14} className="text-primary" />
                      Clause Builder Plan
                    </h2>
                    <p className="text-[10px] text-muted-foreground">Add specific clauses to compile into the draft</p>
                  </div>

                  {selectedClauses.length > 0 ? (
                    <div className="space-y-1.5 p-1.5 rounded bg-primary/5 border border-primary/20 max-h-36 overflow-y-auto">
                      <div className="flex items-center justify-between gap-2 mb-1 border-b border-primary/20 pb-0.5">
                        <span className="text-[8px] font-bold text-foreground uppercase tracking-wider">Plan details</span>
                        <button 
                          onClick={() => setSelectedClauses([])}
                          className="text-[8px] text-muted-foreground hover:text-red-300 transition-colors uppercase font-bold"
                        >
                          Clear ({selectedClauses.length})
                        </button>
                      </div>
                      {selectedClauses.map((c) => (
                        <div key={c.id} className="flex items-start justify-between gap-1.5 p-1 rounded bg-white dark:bg-[#131E2E]/5 border border-white/5">
                          <div className="min-w-0">
                            <p className="text-[9px] font-semibold text-foreground truncate">{c.title}</p>
                            <p className="text-[7px] text-muted-foreground truncate leading-none">{c.prompt}</p>
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
                    <p className="text-[9px] text-muted-foreground italic">No clauses selected yet. Choose from the library below or type custom ones.</p>
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

                    <div className="max-h-[220px] overflow-y-auto space-y-1 pr-1 border border-border/30 rounded p-1 bg-black/10">
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
              )}

              {sidebarTab === "audit" && (
                <div className="space-y-3">
                  {/* Mandatory Clauses Coverage */}
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
                    <div className="space-y-1.5 mt-2 max-h-[140px] overflow-y-auto pr-1">
                      {mandatoryChecks.map((check) => {
                        const isGeneratingThis = generatingClauseId === check.id;
                        const anyLoading = isGenerating || isRunningCompliance || isRunningRedline || !!generatingClauseId;
                        return (
                          <div
                            key={check.id}
                            className={`p-1 rounded border transition-all flex items-center justify-between gap-2 ${
                              check.present
                                ? "bg-emerald-500/5 border-emerald-500/10"
                                : "bg-amber-500/5 border-amber-500/10"
                            }`}
                          >
                            <span className="text-[9px] font-bold text-foreground truncate">{check.label}</span>
                            <div className="shrink-0">
                              {check.present ? (
                                <span className="inline-flex items-center gap-0.5 text-[8px] font-semibold text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20">
                                  Covered
                                </span>
                              ) : (
                                <button
                                  onClick={() => applySuggestedClause(check.prompt, check.id)}
                                  disabled={anyLoading}
                                  className="inline-flex items-center gap-0.5 text-[8px] font-semibold bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25 disabled:opacity-50 px-1 py-0.5 rounded transition-all cursor-pointer"
                                >
                                  {isGeneratingThis ? "Drafting..." : "Auto-Draft"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Compliance Findings Scanner Results */}
                  <div data-tutorial="compliance" className="space-y-1.5 rounded-lg border border-border p-2 bg-card/10">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck size={12} className="text-primary" />
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Compliance Findings</span>
                      </div>
                      <button
                        onClick={() => runComplianceCheck({ silent: false })}
                        className="text-[9px] px-1.5 py-0.5 rounded border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-50"
                        disabled={isRunningCompliance}
                      >
                        {isRunningCompliance ? "Scanning..." : "Scan"}
                      </button>
                    </div>
                    
                    {complianceRisks.length === 0 ? (
                      <p className="text-[9px] text-muted-foreground italic text-center py-2">Click Scan to run compliance analysis.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {filteredComplianceRisks.map((risk) => (
                          <button
                            key={risk.id}
                            onClick={() => applySuggestedClause(risk.prompt)}
                            className={`w-full text-left p-1.5 rounded border transition-all hover:bg-primary/5 ${
                              risk.severity === "danger"
                                ? "border-red-400/20 bg-red-500/5"
                                : "border-primary/20 bg-primary/5"
                            }`}
                          >
                            <div className="flex items-center gap-1">
                              {risk.severity === "danger" ? (
                                <AlertTriangle size={10} className="text-red-400" />
                              ) : (
                                <CheckCircle2 size={10} className="text-primary" />
                              )}
                              <span className="text-[9px] font-bold text-foreground">{risk.title}</span>
                            </div>
                            <p className="text-[8px] text-muted-foreground mt-0.5 leading-tight">{risk.detail}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Counterparty Redlines */}
                  <div data-tutorial="redlines" className="space-y-1.5 rounded-lg border border-border p-2 bg-card/10">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <GitCompareArrows size={12} className="text-primary" />
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Redline Review</span>
                      </div>
                      <button
                        onClick={runCounterpartyRedline}
                        className="text-[9px] px-1.5 py-0.5 rounded border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-50"
                        disabled={isRunningRedline}
                      >
                        {isRunningRedline ? "Reviewing..." : "Analyze"}
                      </button>
                    </div>

                    {!redlineItems.length ? (
                      <p className="text-[9px] text-muted-foreground italic text-center py-2">Analyze redlines to audit counterparty changes.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {redlineItems.map((item) => (
                          <div key={item.id} className="p-1.5 rounded border border-border/30 bg-card/45 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[9px] font-bold text-foreground truncate block">{item.title}</span>
                              <span className={`text-[8px] uppercase font-semibold ${item.status === "accepted" ? "text-emerald-400" : item.status === "rejected" ? "text-red-400" : "text-primary"}`}>
                                {item.status}
                              </span>
                            </div>
                            <p className="text-[8px] text-muted-foreground leading-tight">{item.rationale}</p>
                            {item.status === "pending" && (
                              <div className="flex gap-1.5 pt-0.5">
                                <button
                                  className="flex-1 rounded border border-emerald-500/20 bg-emerald-500/10 py-0.5 text-[8px] font-bold text-emerald-200"
                                  onClick={() => acceptRedline(item)}
                                >
                                  Accept
                                </button>
                                <button
                                  className="flex-1 rounded border border-red-500/20 bg-red-500/10 py-0.5 text-[8px] font-bold text-red-200"
                                  onClick={() => rejectRedline(item.id)}
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions footer */}
            {sidebarTab === "audit" && (
              <div className="p-2 border-t border-border space-y-1.5 bg-card/25 z-10">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => runComplianceCheck({ silent: false })}
                    className="py-1.5 bg-card border border-border rounded-md text-foreground font-semibold text-[10px] hover:bg-accent transition-colors flex items-center justify-center gap-1"
                    data-testid="button-run-contract-compliance"
                    disabled={isRunningCompliance}
                  >
                    {isRunningCompliance ? <Loader2 size={10} className="animate-spin" /> : <ScanText size={10} />}
                    Scan Risk
                  </button>
                  <button
                    onClick={runCounterpartyRedline}
                    className="py-1.5 bg-card border border-border rounded-md text-foreground font-semibold text-[10px] hover:bg-accent transition-colors flex items-center justify-center gap-1"
                    data-testid="button-run-counterparty-redline"
                    disabled={isRunningRedline}
                  >
                    {isRunningRedline ? <Loader2 size={10} className="animate-spin" /> : <GitCompareArrows size={10} />}
                    Redline
                  </button>
                </div>
              </div>
            )}
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
                className="rounded-2xl border border-[hsl(var(--preview-border))] bg-background/72 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08)] backdrop-blur-xl p-0 overflow-hidden min-h-[560px] md:min-h-[760px] print:bg-white dark:bg-[#131E2E] print:text-black"
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
                  className="w-full min-h-[520px] md:min-h-[700px] border-0 p-0 text-foreground print:text-black"
                  placeholder="Your generated contract draft will appear here..."
                />
              </div>
              <div className="mt-6 text-center text-muted-foreground text-xs">Contract Workspace</div>
            </div>
          </div>
        </section>
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
        </div>
      </footer>
      <TutorialCards
        open={showTutorial}
        onOpenChange={setShowTutorial}
        moduleName="Contract Drafting"
        onStepChange={(stepId) => {
          if (stepId === "ai-engine" || stepId === "setup") {
            setSidebarTab("setup");
          } else if (stepId === "clause-library") {
            setSidebarTab("clauses");
          } else if (stepId === "compliance" || stepId === "redlines") {
            setSidebarTab("audit");
          }
        }}
      />
    </div>
  );
}
