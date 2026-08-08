import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowRight,
  Loader2,
  Brain,
  Bold,
  BookOpen,
  Bot,
  Download,
  FileText,
  Gavel,
  Italic,
  List,
  ListOrdered,
  Search,
  Share2,
  Sparkles,
  Type,
  Underline,
  Users,
  Plus,
  Trash2,
  Save,
  FolderOpen,
  Paperclip,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Focus,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calculator,
  Clock,
  Mic,
  MicOff,
  Square,
  Maximize2,
  CircleHelp,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { CourtFeeCalculator } from "@/components/court-fee-calculator";
import { CaseFileImportModal } from "@/components/case-file-import-modal";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { api } from "@shared/routes";
import type { Document as DraftDocument } from "@shared/schema";
import { StyleMemoryPanel } from "@/components/style-memory-panel";
import { DocumentViewer } from "@/components/document-viewer";
import { LegalEditor, type LegalEditorHandle } from "@/components/legal-editor";
import { plainTextToTiptapHTML, isHTMLContent } from "@/lib/plain-to-tiptap";
import { generateLegalPDF } from "@/lib/generate-legal-pdf";
import { generateLegalDocx } from "@/lib/generate-legal-docx";
import {
  DEFAULT_LEGAL_PAGE_PROFILE_ID,
  resolveLegalPageProfile,
  type LegalPageProfileId,
} from "@/lib/legal-page-layout";
import { useVoiceRecorder, formatDuration } from "@/hooks/use-voice-recorder";
import { useDraftHistory } from "@/hooks/use-draft-history";
import { DraftHistoryPanel } from "@/components/draft-history-panel";
import { DraftTabsProvider, useDraftTabs, type DraftTab } from "@/contexts/draft-tabs-context";
import { useDocumentHead } from "@/hooks/use-document-head";
import { TutorialCards } from "@/components/tutorial-cards";
import {
  LEGAL_DRAFTING_WORKSPACE_VERSION,
  type LegalDraftWorkspaceState,
} from "@shared/legal-drafting";

type DraftRecommendation = {
  id: string;
  title: string;
  reason: string;
  originalSnippet: string;
  suggestedText: string;
  impact: "high" | "medium" | "low";
};

type Org = {
  id: number;
  name: string;
};

type OrgMember = {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

type DraftTemplateCategory =
  | "Court Filings"
  | "Sessions Court"
  | "High Court"
  | "Supreme Court"
  | "Family"
  | "Notices"
  | "Affidavits & Powers"
  | "Contracts";

type DraftTemplate = {
  id: string;
  title: string;
  body: string;
  category: DraftTemplateCategory;
  description?: string;
};

type LegalDraftCaseReference = {
  id: number;
  citation: string;
  court: string;
  title: string;
  summary: string;
  hasSource: boolean;
  sourceType: string | null;
  sourceFilename: string | null;
};

type LegalDraftStatuteReference = {
  statuteName: string;
  section: string;
  sectionLabel: string;
  statuteId: number | null;
  description: string | null;
  punishment: string | null;
  statuteDocId: number | null;
  statuteDocTitle: string | null;
  statuteDocFilename: string | null;
  statuteDocCategory: string | null;
  viewUrl: string | null;
};

type LegalDraftUnresolvedStatute = {
  statuteName: string;
  section: string;
  sectionLabel: string;
};

type LegalDraftReferencesPayload = {
  caseLaw: LegalDraftCaseReference[];
  statutes: LegalDraftStatuteReference[];
  removedCaseCitations: string[];
  unresolvedStatutes: LegalDraftUnresolvedStatute[];
};

type CaseLawSourceDocument = {
  found: boolean;
  title?: string;
  content?: string;
  filename?: string;
  sourceType?: string;
  citation?: string;
  mimeType?: string | null;
  originalFileAvailable?: boolean;
  viewUrl?: string | null;
  message?: string;
};

type MemoryItem = {
  id: string;
  kind: "instruction" | "clause" | "risk";
  text: string;
  ts: number;
};

type DraftChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: string[];
  kind?: "guidance" | "typing" | "error" | "clarification";
  createdAt: number;
  /** R2: Clarification suggested document types */
  suggestedTypes?: Array<{ key: string; label: string }>;
  /** R2: Original prompt that triggered clarification */
  originalPrompt?: string;
};

type ChatSnippetPopover = {
  text: string;
  x: number;
  y: number;
};

type StyleMemoryMeta = {
  applied: boolean;
  module: "legal-drafting" | "contract-drafting" | null;
  scopeUsed: "user" | "org" | "user-org";
  chunksUsed: number;
  confidence: number;
};

const AUTOSAVE_KEY = "legal-drafting-workspace-v3";
const CONTEXT_MEMORY_KEY = "legal-drafting-context-memory-v1";
const STYLE_MEMORY_BACKFILL_KEY = "legal-drafting-style-backfill-v1";
const PAGE_PROFILE_KEY = "legal-drafting-page-profile-v1";
const DRAFT_TITLE_PREFIX = "Legal Draft:";
const WORKSPACE_STATE_SYNC_DEBOUNCE_MS = 1200;

const DEFAULT_DOC = "";
const LEGACY_DEFAULT_DOC_PREFIX = "IN THE COURT OF THE CIVIL JUDGE";

const DRAFT_ACTION_VERBS_REGEX =
  /\b(redraft|rewrite|revise|amend|edit|improve|finalize|make|update|format|polish|convert|add|insert|include|incorporate|apply|use|put|delete|remove|omit|replace|change|shorten|condense|expand|elaborate|strengthen|enhance|correct|reword|rephrase|restructure|move|undo|revert)\b/i;
const EXPLICIT_DRAFT_ACTION_REGEX =
  /^(?:please\s+)?(?:draft|prepare|write|generate|create)\b|\b(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:draft|prepare|write|generate|create)\b/i;
const DRAFTING_DOCUMENT_HINTS_REGEX =
  /\b(application|petition|plaint|suit|appeal|writ|bail|revision|cpla|affidavit|reply|written statement)\b/i;
const LEGAL_REFERENCE_HINTS_REGEX =
  /\b(section|u\/s|under section|article|fir|cr\.?p\.?c|ppc|pld|scmr|mld|clc|cld|ylr|p\s*cr\.?\s*l\.?\s*j)\b/i;
const LEGAL_ANALYSIS_HINTS_REGEX =
  /\b(explain|clarify|opinion|advice|review|analyze|analysis|maintainable|valid|correct|wrong|risk|issue|problem|jurisdiction|limitation|conviction|valuation|court fee|which court|forum|law|legal)\b/i;
const GREETING_ONLY_REGEX = /^\s*(hi|hello|hey|salam|assalamualaikum|aoa|ok|okay|thanks|thank you)\s*[.!?]*\s*$/i;
const UNDO_LAST_EDIT_REGEX = /^\s*(?:undo|revert)(?:\s+(?:that|the\s+last\s+(?:change|edit)))?\s*[.!?]*\s*$/i;

function classifyLegalDraftPrompt(prompt: string, hasDraft: boolean): "guidance" | "draft" | "analysis" {
  const normalized = String(prompt || "").trim();
  if (!normalized) return "guidance";
  if (GREETING_ONLY_REGEX.test(normalized)) return "guidance";

  const hasDraftAction = DRAFT_ACTION_VERBS_REGEX.test(normalized) || EXPLICIT_DRAFT_ACTION_REGEX.test(normalized);
  const isPoliteDraftCommand = /\b(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:redraft|rewrite|revise|amend|edit|improve|make|update|add|insert|include|incorporate|apply|use|put|delete|remove|replace|change|shorten|expand|strengthen|correct|reword|move|draft|prepare|write|generate|create)\b/i.test(normalized);
  const isDirectQuestion = /^(?:is|are|was|were|do|does|did|can|could|would|should|will|what|why|which|whether|how)\b/i.test(normalized);
  if (isDirectQuestion && !isPoliteDraftCommand) return "analysis";
  if (hasDraftAction) return "draft";

  const hasLegalAnalysisIntent =
    LEGAL_REFERENCE_HINTS_REGEX.test(normalized) ||
    LEGAL_ANALYSIS_HINTS_REGEX.test(normalized) ||
    /\?$/.test(normalized) ||
    normalized.length >= 60;
  if (hasLegalAnalysisIntent) return "analysis";
  if (!hasDraft && DRAFTING_DOCUMENT_HINTS_REGEX.test(normalized)) return "draft";

  return hasDraft ? "analysis" : "guidance";
}

function buildLegalDraftConversationHistory(messages: DraftChatMessage[]): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((message) => !message.id.startsWith("assistant-intro-") && message.kind !== "typing" && message.kind !== "error" && message.kind !== "guidance")
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: message.role === "assistant" && message.content.length > 2000
        ? "[The assistant updated the active draft during this turn.]"
        : message.content.slice(0, 2000),
    }))
    .filter((message) => message.content.trim().length > 0);
}

function buildDraftingGuidanceMessage(): string {
  return [
    "I am ready as your Pakistani legal AI assistant.",
    "You can ask me to draft or amend, for example:",
    "\"Draft a Sessions Court bail application under section 497 Cr.P.C.\"",
    "\"Revise the grounds and prayer using the attached case history.\"",
    "\"Prepare a High Court writ petition in Pakistani court format.\"",
    "You can also ask legal questions or ask me to review the current draft.",
  ].join("\n");
}

function createEmptyLegalDraftReferences(): LegalDraftReferencesPayload {
  return {
    caseLaw: [],
    statutes: [],
    removedCaseCitations: [],
    unresolvedStatutes: [],
  };
}

function createDraftingIntroMessage(): DraftChatMessage {
  return {
    id: `assistant-intro-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: "assistant",
    content:
      "Share your facts and attachments. I will draft in Pakistani court format after a clear drafting instruction.",
    kind: "guidance",
    createdAt: Date.now(),
  };
}

function normalizeDraftChatMessage(input: unknown): DraftChatMessage | null {
  if (!input || typeof input !== "object") return null;
  const role = (input as any)?.role === "assistant" ? "assistant" : (input as any)?.role === "user" ? "user" : null;
  if (!role) return null;
  const content = String((input as any)?.content || "").trim();
  if (!content) return null;
  const idRaw = String((input as any)?.id || "").trim();
  const createdAtRaw = Number((input as any)?.createdAt);
  const kindRaw = String((input as any)?.kind || "").trim();
  const attachmentsRaw = Array.isArray((input as any)?.attachments) ? (input as any).attachments : [];
  const attachments = attachmentsRaw
    .map((entry: unknown) => String(entry || "").trim())
    .filter((entry: string) => entry.length > 0)
    .slice(0, 8);
  const kind: DraftChatMessage["kind"] | undefined =
    kindRaw === "guidance" || kindRaw === "typing" || kindRaw === "error" || kindRaw === "clarification" ? kindRaw : undefined;
  const suggestedTypesRaw = Array.isArray((input as any)?.suggestedTypes) ? (input as any).suggestedTypes : undefined;
  const suggestedTypes = suggestedTypesRaw
    ? suggestedTypesRaw
        .filter((t: any) => t && typeof t === "object" && t.key && t.label)
        .map((t: any) => ({ key: String(t.key), label: String(t.label) }))
        .slice(0, 5)
    : undefined;
  const originalPrompt = (input as any)?.originalPrompt ? String((input as any).originalPrompt).slice(0, 2000) : undefined;
  return {
    id: idRaw || `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    content: content.slice(0, 80000),
    attachments: attachments.length > 0 ? attachments : undefined,
    kind,
    createdAt: Number.isFinite(createdAtRaw) && createdAtRaw > 0 ? createdAtRaw : Date.now(),
    suggestedTypes: suggestedTypes && suggestedTypes.length > 0 ? suggestedTypes : undefined,
    originalPrompt,
  };
}

function normalizeLegalDraftReferences(input: unknown): LegalDraftReferencesPayload {
  const empty = createEmptyLegalDraftReferences();
  if (!input || typeof input !== "object") return empty;
  const value = input as Partial<LegalDraftReferencesPayload>;
  const caseLaw = Array.isArray(value.caseLaw)
    ? value.caseLaw
        .map((item) => ({
          id: Number((item as any)?.id),
          citation: String((item as any)?.citation || "").trim(),
          court: String((item as any)?.court || "").trim(),
          title: String((item as any)?.title || "").trim(),
          summary: String((item as any)?.summary || "").trim(),
          hasSource: Boolean((item as any)?.hasSource),
          sourceType: (item as any)?.sourceType ? String((item as any).sourceType) : null,
          sourceFilename: (item as any)?.sourceFilename ? String((item as any).sourceFilename) : null,
        }))
        .filter((item) => Number.isFinite(item.id) && item.id > 0 && item.citation.length > 0)
    : [];

  const statutes = Array.isArray(value.statutes)
    ? value.statutes
        .map((item) => ({
          statuteName: String((item as any)?.statuteName || "").trim(),
          section: String((item as any)?.section || "").trim(),
          sectionLabel: String((item as any)?.sectionLabel || "").trim(),
          statuteId: Number.isFinite(Number((item as any)?.statuteId)) ? Number((item as any).statuteId) : null,
          description: (item as any)?.description ? String((item as any).description) : null,
          punishment: (item as any)?.punishment ? String((item as any).punishment) : null,
          statuteDocId: Number.isFinite(Number((item as any)?.statuteDocId)) ? Number((item as any).statuteDocId) : null,
          statuteDocTitle: (item as any)?.statuteDocTitle ? String((item as any).statuteDocTitle) : null,
          statuteDocFilename: (item as any)?.statuteDocFilename ? String((item as any).statuteDocFilename) : null,
          statuteDocCategory: (item as any)?.statuteDocCategory ? String((item as any).statuteDocCategory) : null,
          viewUrl: (item as any)?.viewUrl ? String((item as any).viewUrl) : null,
        }))
        .filter((item) => item.statuteName.length > 0 && item.sectionLabel.length > 0)
    : [];

  const removedCaseCitations = Array.isArray(value.removedCaseCitations)
    ? value.removedCaseCitations.map((item) => String(item || "").trim()).filter((item) => item.length > 0)
    : [];
  const unresolvedStatutes = Array.isArray(value.unresolvedStatutes)
    ? value.unresolvedStatutes
        .map((item) => ({
          statuteName: String((item as any)?.statuteName || "").trim(),
          section: String((item as any)?.section || "").trim(),
          sectionLabel: String((item as any)?.sectionLabel || "").trim(),
        }))
        .filter((item) => item.statuteName.length > 0 && item.sectionLabel.length > 0)
    : [];

  return {
    caseLaw,
    statutes,
    removedCaseCitations,
    unresolvedStatutes,
  };
}
const CIVIL_SUIT_TEMPLATE = `IN THE COURT OF THE CIVIL JUDGE
[District], Pakistan

Civil Suit No. ______ of 20__

IN THE MATTER OF:
Plaintiff: ____________________
VERSUS
Defendant: ____________________

SUIT FOR DECLARATION, PERMANENT INJUNCTION, AND CONSEQUENTIAL RELIEF

Respectfully submitted:
1. That the Plaintiff is lawfully entitled to the relief claimed.
2. That the Defendant has acted in violation of the Plaintiff's legal rights.
3. That cause of action accrued on ____________.
4. That this Hon'ble Court has territorial and pecuniary jurisdiction.

PRAYER:
It is respectfully prayed that this Hon'ble Court may kindly:
a) declare ____________________;
b) permanently restrain the Defendant from ____________________;
c) grant any other relief deemed just and proper.
`;

const CIVIL_MISC_APPLICATION_TEMPLATE = `IN THE COURT OF THE CIVIL JUDGE
[District], Pakistan

Civil Misc. Application No. ______ of 20__
in
Civil Suit No. ______ of 20__

Applicant: ____________________
VERSUS
Respondent: ____________________

APPLICATION UNDER SECTION 151 CPC FOR INTERIM RELIEF

Most respectfully submitted:
1. That the accompanying suit is pending before this Hon'ble Court.
2. That immediate interim protection is required because ____________________.
3. That balance of convenience lies in favour of the Applicant and irreparable loss will be caused otherwise.

PRAYER:
It is prayed that interim relief may kindly be granted till final decision of the suit.
`;

const CRIMINAL_MISC_APPLICATION_TEMPLATE = `IN THE COURT OF THE JUSTICE OF PEACE / EX-OFFICIO JUSTICE OF PEACE
AT [District], Pakistan

CRIMINAL MISCELLANEOUS APPLICATION NO. ______ OF 20__

IN RE:
[Applicant/Complainant Name], [Parentage], resident of [Address]
... APPLICANT/COMPLAINANT

VERSUS

1. THE STATE THROUGH SHO, POLICE STATION [______]
2. [Proposed Accused Name], [Parentage], resident of [Address]
... RESPONDENTS

APPLICATION UNDER SECTIONS 22-A & 22-B Cr.P.C. READ WITH SECTION 154 Cr.P.C. FOR REGISTRATION OF FIR

RESPECTFULLY SHEWETH:

BRIEF FACTS
1. That ____________________________________________.
2. That ____________________________________________.
3. That ____________________________________________.

GROUNDS
A. That ____________________________________________.
B. That ____________________________________________.
C. That ____________________________________________.

PRAYER
In view of the above, it is respectfully prayed that this Honourable Court may kindly:
a. direct registration of FIR in accordance with law;
b. direct fair and lawful investigation by the police;
c. grant any other relief deemed just and proper.

VERIFICATION
Verified on oath at [City] on this ___ day of ______, 20__ that contents of this application are true and correct to the best of my knowledge and belief.

APPLICANT/COMPLAINANT
THROUGH COUNSEL

PLACE: [City]
DATE: [______]
`;

const TEMPORARY_INJUNCTION_TEMPLATE = `IN THE COURT OF THE CIVIL JUDGE
[District], Pakistan

Civil Misc. Application No. ______ of 20__
in
Civil Suit No. ______ of 20__

Applicant/Plaintiff: ____________________
VERSUS
Respondent/Defendant: ____________________

APPLICATION UNDER ORDER XXXIX RULES 1 & 2 CPC FOR TEMPORARY INJUNCTION

Respectfully submitted:
1. That the Plaintiff has a prima facie case on merits.
2. That balance of convenience lies in favour of the Plaintiff.
3. That irreparable loss will be caused if interim restraint is not granted.

PRAYER:
It is prayed that Defendant may be restrained from ____________________ till decision of the suit.
`;

const EXECUTION_APPLICATION_TEMPLATE = `IN THE COURT OF THE CIVIL JUDGE
[District], Pakistan

Execution Application No. ______ of 20__

Decree Holder: ____________________
VERSUS
Judgment Debtor: ____________________

APPLICATION FOR EXECUTION OF DECREE UNDER ORDER XXI CPC

Respectfully submitted:
1. That decree dated ______ was passed in Civil Suit No. ______.
2. That the Judgment Debtor has failed to satisfy the decree.
3. That execution is sought through ____________________.

PRAYER:
It is prayed that decree may kindly be executed in accordance with law.
`;

const SESSIONS_BAIL_TEMPLATE = `IN THE COURT OF THE SESSIONS JUDGE
[District], Pakistan

Criminal Bail Application No. ______ of 20__

Applicant/Accused: ____________________
VERSUS
The State

APPLICATION FOR POST-ARREST BAIL UNDER SECTION 497 Cr.P.C.

Respectfully submitted:
1. FIR No. ______ dated ______ under sections ______ P.P.C. was registered at P.S. ______.
2. That the Applicant is innocent and has been falsely implicated.
3. That further inquiry is made out and no useful purpose will be served by continued detention.
4. That the Applicant undertakes to join trial and comply with all directions.

PRAYER:
It is prayed that post-arrest bail may kindly be granted in the interest of justice.
`;

const SESSIONS_PRE_ARREST_BAIL_TEMPLATE = `IN THE COURT OF THE SESSIONS JUDGE
[District], Pakistan

Pre-Arrest Bail Application No. ______ of 20__

Applicant/Accused: ____________________
VERSUS
The State

APPLICATION FOR PRE-ARREST BAIL UNDER SECTION 498 Cr.P.C.

Respectfully submitted:
1. FIR No. ______ dated ______ under sections ______ P.P.C. at P.S. ______.
2. Applicant apprehends arrest due to mala fide and false implication.
3. Applicant undertakes full cooperation in investigation/trial.

PRAYER:
It is prayed that pre-arrest bail may kindly be confirmed till final decision of the case.
`;

const SESSIONS_CRIMINAL_APPEAL_TEMPLATE = `IN THE COURT OF THE SESSIONS JUDGE
[District], Pakistan

Criminal Appeal No. ______ of 20__

Appellant: ____________________
VERSUS
The State / Respondent: ____________________

MEMORANDUM OF CRIMINAL APPEAL

Respectfully submitted:
1. That judgment dated ______ passed by learned ______ is contrary to law and facts.
2. That material evidence has been misread/non-read.
3. That findings are unsustainable.

PRAYER:
It is prayed that conviction/order may kindly be set aside and appeal be accepted.
`;

const SESSIONS_CRIMINAL_REVISION_TEMPLATE = `IN THE COURT OF THE SESSIONS JUDGE
[District], Pakistan

Criminal Revision No. ______ of 20__

Petitioner: ____________________
VERSUS
Respondent: ____________________

CRIMINAL REVISION PETITION

Respectfully submitted:
1. That impugned order dated ______ suffers from jurisdictional and legal defects.
2. That grave miscarriage of justice has occurred.
3. That revisional interference is warranted.

PRAYER:
It is prayed that impugned order may kindly be set aside/modified in the interest of justice.
`;

const FAMILY_SUIT_TEMPLATE = `IN THE FAMILY COURT AT [District], Pakistan

Family Suit/Petition No. ______ of 20__

Plaintiff/Petitioner: ____________________
VERSUS
Defendant/Respondent: ____________________

SUIT/PETITION FOR ____________________

Respectfully submitted:
1. That parties are related as ____________________.
2. That cause of action accrued on ______.
3. That this Hon'ble Family Court has jurisdiction.

PRAYER:
It is prayed that relief of ____________________ may kindly be granted.
`;

const HIGH_COURT_WRIT_TEMPLATE = `IN THE HIGH COURT OF [Province], [Bench]

Writ Petition No. ______ of 20__

Petitioner: ____________________
VERSUS
Respondents: ____________________

CONSTITUTIONAL PETITION UNDER ARTICLE 199 OF THE CONSTITUTION OF ISLAMIC REPUBLIC OF PAKISTAN, 1973

Respectfully submitted:
1. That the Petitioner is aggrieved by order/action dated ______ passed by Respondent No. ___.
2. That the impugned action is without lawful authority and of no legal effect.
3. That no efficacious alternate remedy is available.
4. That this Hon'ble Court has constitutional jurisdiction.

PRAYER:
It is prayed that this Hon'ble Court may kindly set aside the impugned order and grant consequential relief.
`;

const HIGH_COURT_APPEAL_TEMPLATE = `IN THE HIGH COURT OF [Province], [Bench]

Civil Appeal No. ______ of 20__

Appellant: ____________________
VERSUS
Respondent: ____________________

MEMORANDUM OF CIVIL APPEAL

The Appellant respectfully submits:
1. That the judgment and decree dated ______ passed by learned ______ is against law and facts.
2. That material evidence was misread/non-read.
3. That findings are perverse and liable to be set aside.

GROUNDS OF APPEAL:
a) ____________________
b) ____________________
c) ____________________

PRAYER:
It is prayed that the impugned judgment/decree may kindly be set aside and appeal be accepted.
`;

const HIGH_COURT_CRIMINAL_APPEAL_TEMPLATE = `IN THE HIGH COURT OF [Province], [Bench]

Criminal Appeal No. ______ of 20__

Appellant: ____________________
VERSUS
The State / Respondent: ____________________

MEMORANDUM OF CRIMINAL APPEAL

Respectfully submitted:
1. That conviction/order dated ______ is illegal and unsustainable.
2. That evidence has been misappreciated by learned trial court.
3. That Appellant is entitled to acquittal/benefit under law.

PRAYER:
It is prayed that appeal may kindly be accepted and impugned judgment/order set aside.
`;

const HIGH_COURT_CRIMINAL_REVISION_TEMPLATE = `IN THE HIGH COURT OF [Province], [Bench]

Criminal Revision No. ______ of 20__

Petitioner: ____________________
VERSUS
Respondent: ____________________

CRIMINAL REVISION PETITION

Respectfully submitted:
1. That impugned order dated ______ suffers from patent illegality.
2. That findings are arbitrary and without lawful justification.
3. That revisional jurisdiction may kindly be exercised.

PRAYER:
It is prayed that impugned order may kindly be set aside/modified.
`;

const HIGH_COURT_BBA_TEMPLATE = `IN THE HIGH COURT OF [Province], [Bench]

Criminal Bail Before Arrest No. ______ of 20__

Petitioner/Accused: ____________________
VERSUS
The State

PETITION FOR BAIL BEFORE ARREST UNDER SECTION 498 Cr.P.C.

Respectfully submitted:
1. FIR No. ______ dated ______ at P.S. ______ under sections ______.
2. Petitioner is innocent and implicated with mala fide intent.
3. Petitioner undertakes to join investigation/trial.

PRAYER:
It is prayed that bail before arrest may kindly be granted/confirmed in the interest of justice.
`;

const SUPREME_CPLA_TEMPLATE = `IN THE SUPREME COURT OF PAKISTAN
[Appellate Jurisdiction]

Civil Petition for Leave to Appeal No. ______ of 20__

Petitioner: ____________________
VERSUS
Respondent: ____________________

PETITION FOR LEAVE TO APPEAL

The Petitioner respectfully submits:
1. That the impugned judgment dated ______ passed by the High Court suffers from legal infirmities.
2. That questions of public importance and legal significance arise for determination.
3. That substantial miscarriage of justice has occurred.

GROUNDS:
a) ____________________
b) ____________________
c) ____________________

PRAYER:
Leave to appeal may kindly be granted and the impugned judgment be set aside in the interest of justice.
`;

const SUPREME_CRIMINAL_PETITION_TEMPLATE = `IN THE SUPREME COURT OF PAKISTAN
[Appellate Jurisdiction]

Criminal Petition for Leave to Appeal No. ______ of 20__

Petitioner: ____________________
VERSUS
Respondent: ____________________

CRIMINAL PETITION FOR LEAVE TO APPEAL

Respectfully submitted:
1. That impugned High Court judgment/order dated ______ suffers from legal infirmities.
2. That important questions of law arise for determination.
3. That grave miscarriage of justice has occurred.

PRAYER:
Leave to appeal may kindly be granted and impugned judgment/order be set aside.
`;

// ─── New transactional / notice / affidavit templates ──────────────────────
const VAKALATNAMA_TEMPLATE = `IN THE COURT OF [Court Name], [City]

[Cause Title — e.g. Civil Suit No. _____ / 20__]

[Plaintiff/Petitioner Name]                              ... PLAINTIFF / PETITIONER

VERSUS

[Defendant/Respondent Name]                              ... DEFENDANT / RESPONDENT

VAKALATNAMA

I/We, the above-named [Plaintiff/Petitioner/Defendant/Respondent], do hereby
appoint and authorise [Advocate Name], Advocate of the [Court of Enrollment],
holding Bar Council Enrollment No. _______, to appear, plead, act, sign,
verify, file, and conduct the above proceedings on my/our behalf, and to do
all acts and things necessary or incidental thereto including filing of
affidavits, applications, replies, withdrawal, compromise, and engaging
junior counsel if required.

I/We further authorise the said Advocate to receive on my/our behalf any
amount decreed, ordered, or awarded by the Court.

Dated this ____ day of _________, 20__ at [City].

___________________________
Signature of Client / Thumb Impression
Name: ___________________________
CNIC: ___________________________

ACCEPTED:
___________________________
[Advocate Name]
Bar Council Enrollment No. _______
Office: ___________________________
`;

const AFFIDAVIT_TEMPLATE = `IN THE COURT OF [Court Name], [City]

[Cause Title]

AFFIDAVIT OF [Deponent Name]

I, [Deponent Full Name] S/o (or D/o or W/o) ____________, aged about ____
years, R/o ____________, holding CNIC No. _____________, Pakistani national,
do hereby solemnly affirm and state on oath as under:

1. That I am the [role — e.g. Plaintiff / Petitioner / Defendant / Witness]
   in the captioned matter and am fully conversant with the facts deposed
   herein from my own knowledge.

2. That [State the fact(s) being attested. Use one numbered paragraph per
   fact. Do not include argumentative or conclusory statements].

3. That [Continue with additional factual paragraphs as required].

4. That the contents of this affidavit are true and correct to the best of
   my knowledge and belief, and nothing material has been concealed or
   misstated.

DEPONENT
___________________________
[Deponent Name]
CNIC: _____________

VERIFICATION

Verified on oath at [City] on this ____ day of _________, 20__ that the
contents of paragraphs 1 to ____ above are true and correct to the best of
my knowledge and belief.

DEPONENT
___________________________

Solemnly affirmed before me by the Deponent who is identified to me by
[Identifier Name, CNIC No.] who is personally known to me.

___________________________
Oath Commissioner / Notary Public
Seal & Stamp
`;

const LEGAL_NOTICE_GENERIC_TEMPLATE = `LEGAL NOTICE

Without Prejudice

To,
[Recipient Name]
[Recipient Address]
[CNIC if individual / Registration No. if company]

Through: [Counsel Name], Advocate
Office: ____________________________
Bar Council Enrollment No. _______

Date: ____ ____________, 20__

SUBJECT: LEGAL NOTICE FOR [State subject — e.g. Recovery of Outstanding
Amount / Breach of Contract / Defamation / Cease and Desist]

Sir/Madam,

Under instructions from and on behalf of my client, [Client Full Name],
S/o ____________, R/o ____________, holding CNIC No. _____________
(hereinafter referred to as "my Client"), I do hereby serve upon you the
following notice:

1. That my Client and you entered into [describe relationship/transaction
   — e.g. agreement dated ____, business dealing, employment, etc.].

2. That [state the wrongful act/breach/grievance with specific dates,
   amounts, and supporting facts].

3. That despite repeated requests/demands, you have failed and neglected to
   [comply / pay / perform / desist]. Your conduct constitutes a clear
   breach of [statute / agreement / common law obligation].

4. That my Client has suffered loss/injury amounting to Rs. _____________
   (Rupees ____________ Only) on account of your acts/omissions.

DEMAND:

You are hereby called upon, within FIFTEEN (15) DAYS of receipt of this
notice (or sixty (60) days where Section 80 CPC applies for suits against
Government), to:

(a) [Specific demand — e.g. Pay Rs. _______ to my Client];
(b) [Cease and desist from further breach];
(c) Render written apology / formal undertaking;

failing which my Client shall be constrained to initiate appropriate civil
and/or criminal proceedings against you, including but not limited to:
[list of remedies — e.g. recovery suit, contempt, FIR under Section 489-F
PPC, defamation suit under Defamation Ordinance 2002], at your sole risk
and cost, of which kindly take notice.

A copy of this notice has been retained in my office for record and future
reference.

Yours truly,

___________________________
[Counsel Name]
Advocate
Bar Council Enrollment No. _______
[Office Address]
[Contact]

CC: My Client.
`;

const NOTICE_489F_PPC_TEMPLATE = `LEGAL NOTICE REGARDING DISHONOURED CHEQUE
AND DISHONEST ISSUANCE UNDER SECTION 489-F OF THE PAKISTAN PENAL CODE, 1860

Without Prejudice

To,
[Drawer Name]
[Address]
CNIC: _____________

Through: [Counsel Name], Advocate
Bar Council Enrollment No. _______

Date: ____ ____________, 20__

Sir,

Under instructions from my client, [Payee Name], R/o ____________, CNIC
_____________, I serve upon you the following notice:

1. That you, in discharge of [state liability/transaction], issued cheque
   No. _________ dated ____ ____________, drawn on [Bank & Branch],
   for Rs. ____________ (Rupees ____________ Only) in favour of my client.

2. That my client presented the said cheque for encashment on ____
   ____________ at [Bank & Branch], whereupon the cheque was DISHONOURED
   and returned with the bank memo bearing the remarks
   "[Insufficient Funds / Account Closed / Stop Payment / Signature
   Mismatch]" dated ____ ____________.

3. That the cheque was issued toward repayment of the above loan or
   fulfilment of the above obligation, and its dishonour, read with the
   surrounding facts, gives rise to civil remedies and may attract
   Section 489-F of the Pakistan Penal Code, 1860 where dishonest intent
   and the other statutory ingredients are established.

DEMAND:

You are hereby called upon, within [SEVEN (7) / FIFTEEN (15)] DAYS of receipt of this
notice, to:

(a) Pay the cheque amount of Rs. ____________ in full by demand draft or
    pay order in favour of my client; and
(b) Reimburse Rs. ________ as costs of this notice and bank charges.

Failing the above within the stated period, my client shall be at liberty,
without further notice, to initiate such proceedings as are available in
law, including:

(i) Appropriate criminal proceedings under Section 489-F PPC in
    accordance with law, subject to proof of its ingredients;
(ii) A civil suit for recovery, including proceedings under Order XXXVII
     of the Code of Civil Procedure, 1908 where maintainable; and
(iii) Any other remedy available in law,

at your sole risk, cost, and consequence.

This notice provides a final opportunity to resolve the matter before
proceedings are initiated. It is not represented as a statutory
prerequisite to proceedings under Pakistani law.

Yours truly,

___________________________
[Counsel Name]
Advocate
Bar Council Enrollment No. _______
[Office Address]

Encl: Photocopy of cheque, bank memo, and proof of presentation.
`;

const POWER_OF_ATTORNEY_GENERAL_TEMPLATE = `GENERAL POWER OF ATTORNEY

KNOW ALL MEN BY THESE PRESENTS:

THIS GENERAL POWER OF ATTORNEY is made and executed on this ____ day of
____________, 20__ at [City], Pakistan,

BY:

[Principal Full Name], S/o ____________, aged ____ years, R/o
____________, holding CNIC No. _____________, Pakistani national,
hereinafter called the "PRINCIPAL"

IN FAVOUR OF:

[Attorney Full Name], S/o ____________, aged ____ years, R/o
____________, holding CNIC No. _____________, Pakistani national,
hereinafter called the "ATTORNEY"

WHEREAS the Principal is desirous of authorising the Attorney to act on
the Principal's behalf in respect of the following matters:

NOW THIS DEED WITNESSES that the Principal does hereby nominate, constitute,
and appoint the Attorney as his/her true and lawful Attorney to do, execute,
and perform all or any of the following acts, deeds, and things:

1. To manage, supervise, and operate all immovable properties of the
   Principal, including but not limited to [describe properties or
   "all properties owned by the Principal"].

2. To collect, receive, and grant valid receipts for all rents, profits,
   compensation, sale proceeds, and other moneys due or accruing to the
   Principal.

3. To file, defend, compromise, withdraw, and conduct any suits, appeals,
   revisions, applications, references, complaints, or other proceedings
   of any kind in any court, tribunal, or authority within Pakistan, and
   to engage advocates and execute Vakalatnamas on the Principal's behalf.

4. To operate the Principal's bank accounts, sign cheques, deposit and
   withdraw funds, and execute any banking instruments.

5. To execute, sign, verify, present for registration, and admit
   execution of agreements, sale deeds, gift deeds, mortgage deeds, lease
   deeds, partition deeds, and any other deeds or documents.

6. To represent the Principal before any government department, revenue
   authority, registration office, NADRA, FBR, customs, or any other
   public office.

7. Generally, to do all such acts as may be necessary or incidental to
   the management of the Principal's affairs.

The Principal hereby ratifies and confirms whatever the Attorney shall
lawfully do or cause to be done by virtue of this Power of Attorney.

This Power of Attorney shall remain in force until expressly revoked in
writing by the Principal and shall be irrevocable for [period] from the
date hereof.

IN WITNESS WHEREOF, the Principal has signed this General Power of
Attorney on the date and at the place first above written.

___________________________
SIGNATURE OF PRINCIPAL
[Name], CNIC: _____________

WITNESSES:

1. ___________________________
   Name: ____________________
   CNIC: ____________________
   Address: _________________

2. ___________________________
   Name: ____________________
   CNIC: ____________________
   Address: _________________

[To be attested by Sub-Registrar / Notary Public / Pakistani Consular
Officer (if executed abroad) under the Powers of Attorney Act 1882 and
the Registration Act 1908]
`;

const NDA_TEMPLATE = `NON-DISCLOSURE AGREEMENT

THIS NON-DISCLOSURE AGREEMENT (the "Agreement") is entered into on this
____ day of ____________, 20__ at [City], Pakistan,

BETWEEN:

[Disclosing Party Name], a [individual / company incorporated under the
Companies Act 2017] having CNIC/Registration No. _____________ and
registered office at ____________ ("Disclosing Party"),

AND:

[Receiving Party Name], a [individual / company] having CNIC/Registration
No. _____________ and address at ____________ ("Receiving Party"),

(each a "Party" and collectively the "Parties").

RECITALS:

A. The Disclosing Party possesses certain confidential and proprietary
   information in connection with [describe purpose, e.g. employment,
   business negotiation, joint venture].
B. The Parties wish to enter into discussions/transactions which may
   involve disclosure of such confidential information by the Disclosing
   Party to the Receiving Party.

NOW IT IS HEREBY AGREED AS FOLLOWS:

1. CONFIDENTIAL INFORMATION
   "Confidential Information" means any non-public information disclosed
   by the Disclosing Party to the Receiving Party, whether orally, in
   writing, or by any other means, including but not limited to: business
   plans, financial data, customer lists, trade secrets, technical
   specifications, source code, intellectual property, marketing
   strategies, and any information marked or identified as confidential.

2. OBLIGATIONS OF THE RECEIVING PARTY
   The Receiving Party shall:
   (a) Hold all Confidential Information in strict confidence;
   (b) Not disclose Confidential Information to any third party without
       the Disclosing Party's prior written consent;
   (c) Use Confidential Information solely for the agreed Purpose;
   (d) Take reasonable measures to protect the Confidential Information
       at the same standard of care it applies to its own confidential
       information, but in no event less than reasonable care.

3. EXCLUSIONS
   This Agreement shall not apply to information that:
   (a) Was already in the public domain at the time of disclosure;
   (b) Is independently developed by the Receiving Party without use of
       Confidential Information;
   (c) Is rightfully received from a third party without breach of
       confidentiality; or
   (d) Is required to be disclosed by law, court order, or government
       authority, provided the Receiving Party gives prior notice to the
       Disclosing Party.

4. TERM
   This Agreement shall remain in force for a period of [number] years
   from the date of execution, except that obligations relating to trade
   secrets shall continue until such information is no longer a trade
   secret.

5. RETURN OF MATERIALS
   Upon termination or upon request, the Receiving Party shall return or
   destroy all Confidential Information and certify in writing that it
   has done so.

6. REMEDIES
   The Parties acknowledge that breach of this Agreement may cause
   irreparable injury for which monetary damages would be inadequate. The
   Disclosing Party shall be entitled to seek injunctive relief in
   addition to any other remedies available in law and equity.

7. GOVERNING LAW & JURISDICTION
   This Agreement shall be governed by and construed in accordance with
   the laws of the Islamic Republic of Pakistan. Any dispute shall be
   subject to the exclusive jurisdiction of the courts at [City].

8. ARBITRATION (Optional)
   Any dispute arising out of or in connection with this Agreement shall
   first be referred to arbitration under the Arbitration Act, 1940. The
   seat of arbitration shall be [City], the language English, and the
   number of arbitrators shall be [one/three].

9. ENTIRE AGREEMENT
   This Agreement constitutes the entire agreement between the Parties
   regarding its subject matter and supersedes all prior agreements,
   negotiations, and understandings.

IN WITNESS WHEREOF, the Parties have executed this Agreement on the date
and at the place first above written.

DISCLOSING PARTY                          RECEIVING PARTY

___________________________               ___________________________
[Name]                                    [Name]
[Designation]                             [Designation]
CNIC: _____________                       CNIC: _____________

WITNESSES:

1. ___________________________            2. ___________________________
   Name: ____________________               Name: ____________________
   CNIC: ____________________               CNIC: ____________________
`;

const SALE_DEED_TEMPLATE = `SALE DEED

(Under the Transfer of Property Act, 1882 and the Registration Act, 1908)

THIS SALE DEED is executed on this ____ day of ____________, 20__ at
[City], Pakistan,

BY:

[Vendor Name], S/o ____________, aged ____ years, R/o ____________, CNIC
_____________, Pakistani national,
hereinafter called the "VENDOR"

IN FAVOUR OF:

[Vendee Name], S/o ____________, aged ____ years, R/o ____________, CNIC
_____________, Pakistani national,
hereinafter called the "VENDEE"

WHEREAS the Vendor is the absolute and exclusive owner in possession of
the property fully described in Schedule-A hereto (the "Property"), having
acquired the same vide [previous title document, registration no., date]
free from all encumbrances, charges, and liens.

AND WHEREAS the Vendor has agreed to sell the Property to the Vendee for
a total sale consideration of Rs. ____________ (Rupees ____________
Only), and the Vendee has agreed to purchase the same on the terms and
conditions herein contained.

NOW THIS DEED WITNESSES AS FOLLOWS:

1. SALE AND TRANSFER
   In consideration of Rs. ____________ (the "Sale Consideration"),
   receipt whereof is hereby acknowledged by the Vendor (a separate
   receipt being executed even date herewith), the Vendor hereby grants,
   transfers, conveys, and assures unto the Vendee the entire right,
   title, and interest in the Property described in Schedule-A, together
   with all easements, appurtenances, and benefits attached thereto.

2. POSSESSION
   The Vendor has this day delivered actual physical and vacant possession
   of the Property to the Vendee.

3. INDEMNITY AND COVENANT FOR TITLE
   The Vendor warrants that:
   (a) The Property is the absolute property of the Vendor;
   (b) The Property is free from all encumbrances, mortgages, charges,
       attachments, claims, demands, and adverse interests;
   (c) The Vendor has full right and authority to sell the Property;
   (d) The Vendor shall indemnify the Vendee against any loss, damage,
       claim, or expense arising from any defect in title or breach of
       above warranties.

4. STAMP DUTY AND REGISTRATION
   The stamp duty, registration fee, and other incidental expenses shall
   be borne by the Vendee. The parties shall present this Deed for
   registration before the Sub-Registrar at [City] within the period
   prescribed under the Registration Act, 1908.

5. MUTATION
   The Vendor undertakes to assist the Vendee in obtaining mutation of
   the Property in the relevant revenue records.

6. LAW APPLICABLE
   This Deed shall be governed by the laws of the Islamic Republic of
   Pakistan, including the Transfer of Property Act 1882, Registration
   Act 1908, and applicable provincial revenue laws.

SCHEDULE-A
(Description of Property)

[Provide complete description: full address, plot/khasra/khatuni numbers,
boundaries, total area, type — residential/commercial/agricultural,
constructed area if any, registration details of source title document]

IN WITNESS WHEREOF, the Vendor and Vendee have executed this Sale Deed on
the date and at the place first above written.

VENDOR                                    VENDEE

___________________________               ___________________________
[Vendor Name]                             [Vendee Name]
CNIC: _____________                       CNIC: _____________

WITNESSES:

1. ___________________________            2. ___________________________
   Name: ____________________               Name: ____________________
   CNIC: ____________________               CNIC: ____________________
   Father's Name: ___________               Father's Name: ___________
   Address: _________________               Address: _________________

[FOR REGISTRATION USE ONLY]
Stamp Paper Value: Rs. ____________
Registration Fee: Rs. ____________
Sub-Registrar Office: ____________
Book No., Volume No., Page Nos.: ____________
`;

const TEMPLATES: DraftTemplate[] = [
  // ─── Court Filings ───
  {
    id: "civil-suit",
    title: "Civil Suit (Plaint)",
    body: CIVIL_SUIT_TEMPLATE,
    category: "Court Filings",
    description: "Standard plaint format under Order VII Rule 1 CPC.",
  },
  {
    id: "civil-misc-application",
    title: "Civil Misc. Application",
    body: CIVIL_MISC_APPLICATION_TEMPLATE,
    category: "Court Filings",
    description: "Generic miscellaneous application before Civil Judge.",
  },
  {
    id: "criminal-misc-application",
    title: "Criminal Misc. Application",
    body: CRIMINAL_MISC_APPLICATION_TEMPLATE,
    category: "Court Filings",
    description: "Application before Justice of Peace / Ex-Officio JoP.",
  },
  {
    id: "temporary-injunction-application",
    title: "Temporary Injunction Application",
    body: TEMPORARY_INJUNCTION_TEMPLATE,
    category: "Court Filings",
    description: "Application under Order XXXIX Rules 1 & 2 CPC.",
  },
  {
    id: "execution-application",
    title: "Execution Application",
    body: EXECUTION_APPLICATION_TEMPLATE,
    category: "Court Filings",
    description: "Application under Order XXI CPC for execution of decree.",
  },
  // ─── Sessions Court ───
  {
    id: "sessions-bail",
    title: "Sessions Court Bail Application",
    body: SESSIONS_BAIL_TEMPLATE,
    category: "Sessions Court",
    description: "Post-arrest bail application under Section 497 CrPC.",
  },
  {
    id: "sessions-pre-arrest-bail",
    title: "Sessions Pre-Arrest Bail",
    body: SESSIONS_PRE_ARREST_BAIL_TEMPLATE,
    category: "Sessions Court",
    description: "Pre-arrest bail under Section 498 CrPC.",
  },
  {
    id: "sessions-criminal-appeal",
    title: "Sessions Criminal Appeal",
    body: SESSIONS_CRIMINAL_APPEAL_TEMPLATE,
    category: "Sessions Court",
    description: "Criminal appeal before Sessions Judge.",
  },
  {
    id: "sessions-criminal-revision",
    title: "Sessions Criminal Revision",
    body: SESSIONS_CRIMINAL_REVISION_TEMPLATE,
    category: "Sessions Court",
    description: "Revision under Section 435/439 CrPC.",
  },
  // ─── Family ───
  {
    id: "family-suit-petition",
    title: "Family Suit / Petition",
    body: FAMILY_SUIT_TEMPLATE,
    category: "Family",
    description: "Suit under Family Courts Act 1964 — khula, maintenance, custody.",
  },
  // ─── High Court ───
  {
    id: "high-court-writ",
    title: "High Court Writ Petition",
    body: HIGH_COURT_WRIT_TEMPLATE,
    category: "High Court",
    description: "Constitutional petition under Article 199 of the Constitution.",
  },
  {
    id: "high-court-appeal",
    title: "High Court Civil Appeal",
    body: HIGH_COURT_APPEAL_TEMPLATE,
    category: "High Court",
    description: "Civil first/second appeal before the High Court.",
  },
  {
    id: "high-court-criminal-appeal",
    title: "High Court Criminal Appeal",
    body: HIGH_COURT_CRIMINAL_APPEAL_TEMPLATE,
    category: "High Court",
    description: "Criminal appeal before the High Court.",
  },
  {
    id: "high-court-criminal-revision",
    title: "High Court Criminal Revision",
    body: HIGH_COURT_CRIMINAL_REVISION_TEMPLATE,
    category: "High Court",
    description: "Criminal revision before the High Court.",
  },
  {
    id: "high-court-bba",
    title: "High Court Bail Before Arrest",
    body: HIGH_COURT_BBA_TEMPLATE,
    category: "High Court",
    description: "Bail-before-arrest before the High Court (Section 498 CrPC).",
  },
  // ─── Supreme Court ───
  {
    id: "supreme-cpla",
    title: "Supreme Court CPLA",
    body: SUPREME_CPLA_TEMPLATE,
    category: "Supreme Court",
    description: "Civil Petition for Leave to Appeal before the Supreme Court.",
  },
  {
    id: "supreme-criminal-petition",
    title: "Supreme Court Criminal Petition for Leave to Appeal",
    body: SUPREME_CRIMINAL_PETITION_TEMPLATE,
    category: "Supreme Court",
    description: "Cr.P.L.A. before the Supreme Court of Pakistan.",
  },
  // ─── Affidavits & Powers ───
  {
    id: "vakalatnama",
    title: "Vakalatnama",
    body: VAKALATNAMA_TEMPLATE,
    category: "Affidavits & Powers",
    description: "Standard advocate authorisation form filed in every case.",
  },
  {
    id: "affidavit",
    title: "Affidavit",
    body: AFFIDAVIT_TEMPLATE,
    category: "Affidavits & Powers",
    description: "Sworn affidavit attested by Oath Commissioner / Notary.",
  },
  {
    id: "power-of-attorney-general",
    title: "General Power of Attorney",
    body: POWER_OF_ATTORNEY_GENERAL_TEMPLATE,
    category: "Affidavits & Powers",
    description: "Comprehensive power of attorney covering property + legal acts.",
  },
  // ─── Notices ───
  {
    id: "legal-notice-generic",
    title: "Legal Notice (Generic)",
    body: LEGAL_NOTICE_GENERIC_TEMPLATE,
    category: "Notices",
    description: "Pre-litigation legal notice — recovery / breach / cease & desist.",
  },
  {
    id: "notice-489f-ppc",
    title: "Cheque Dishonour Notice (Section 489-F PPC)",
    body: NOTICE_489F_PPC_TEMPLATE,
    category: "Notices",
    description: "Pre-action payment demand preserving civil and Section 489-F PPC remedies.",
  },
  // ─── Contracts ───
  {
    id: "nda",
    title: "Non-Disclosure Agreement (NDA)",
    body: NDA_TEMPLATE,
    category: "Contracts",
    description: "Bilateral NDA with Pakistani jurisdiction + arbitration clauses.",
  },
  {
    id: "sale-deed",
    title: "Sale Deed (Property)",
    body: SALE_DEED_TEMPLATE,
    category: "Contracts",
    description: "Property sale deed under Transfer of Property Act 1882.",
  },
];

/**
 * TemplatesPanel — categorised + searchable list of drafting templates.
 * Replaces the prior flat list. Templates are grouped by their `category`
 * field; expanding a category reveals its templates with description.
 */
function TemplatesPanel({ onApply }: { onApply: (template: DraftTemplate) => void }) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? TEMPLATES.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            (t.description ?? "").toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q),
        )
      : TEMPLATES;
    const map = new Map<DraftTemplateCategory, DraftTemplate[]>();
    for (const t of filtered) {
      const arr = map.get(t.category) || [];
      arr.push(t);
      map.set(t.category, arr);
    }
    // preserve a stable category ordering
    const ORDER: DraftTemplateCategory[] = [
      "Court Filings",
      "Sessions Court",
      "High Court",
      "Supreme Court",
      "Family",
      "Notices",
      "Affidavits & Powers",
      "Contracts",
    ];
    return ORDER.filter((c) => map.has(c)).map((c) => ({ category: c, items: map.get(c)! }));
  }, [search]);

  return (
    <div className="w-full overflow-auto flex flex-col gap-2 pb-3">
      <div className="relative">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          className="w-full text-xs rounded-lg border border-border bg-card/40 px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          data-testid="input-template-search"
        />
      </div>

      {grouped.length === 0 ? (
        <p className="text-xs text-muted-foreground p-3">No templates match your search.</p>
      ) : (
        grouped.map(({ category, items }) => {
          const isCollapsed = collapsed[category];
          return (
            <div key={category} className="rounded-lg border border-border/60 bg-card/30">
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [category]: !c[category] }))}
                className="w-full flex items-center justify-between px-3 py-2 text-left"
                data-testid={`button-template-cat-${category}`}
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                  {category}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {items.length} {isCollapsed ? "▸" : "▾"}
                </span>
              </button>
              {!isCollapsed && (
                <div className="px-2 pb-2 space-y-1.5">
                  {items.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onApply(t)}
                      className="w-full text-left rounded-lg border border-border/70 bg-card/40 backdrop-blur-md p-2.5 hover:border-primary/40 hover:bg-card/70 transition-all"
                      data-testid={`button-template-${t.id}`}
                    >
                      <p className="text-[12px] font-semibold text-foreground">{t.title}</p>
                      {t.description && (
                        <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">
                          {t.description}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function findSnippetRange(source: string, targetSnippet: string): { start: number; end: number } | null {
  const target = targetSnippet.trim();
  if (!source || !target) return null;
  if (source.includes(target)) {
    const start = source.indexOf(target);
    return { start, end: start + target.length };
  }

  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const softMatch = source.match(new RegExp(escaped, "m"));
  if (softMatch && typeof softMatch.index === "number") {
    const found = softMatch[0];
    return { start: softMatch.index, end: softMatch.index + found.length };
  }

  return null;
}

function LegalDraftingPageInner() {
  const { user } = useAuth();
  const draftTabs = useDraftTabs();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const aiContextInputRef = useRef<HTMLInputElement | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);

  const editorRef = useRef<LegalEditorHandle | null>(null);
  const isRestoringTabRef = useRef(false);
  const stateOwnerTabIdRef = useRef(draftTabs.activeTabId);
  const activeTabIdRef = useRef(draftTabs.activeTabId);
  activeTabIdRef.current = draftTabs.activeTabId;

  const [showTutorial, setShowTutorial] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem("hasSeenDraftingTutorial")) {
      setShowTutorial(true);
      localStorage.setItem("hasSeenDraftingTutorial", "true");
    }
  }, []);

  const [docText, setDocText] = useState(DEFAULT_DOC);
  const [editorHtml, setEditorHtml] = useState("");
  const [draftTitle, setDraftTitle] = useState("Untitled Draft");
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);
  const [pageProfileId, setPageProfileId] = useState<LegalPageProfileId>(() => {
    const stored = localStorage.getItem(PAGE_PROFILE_KEY);
    return resolveLegalPageProfile(stored).id;
  });
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
  const [generationElapsed, setGenerationElapsed] = useState(0);
  const generationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isSavedLocal, setIsSavedLocal] = useState(true);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<DraftRecommendation[]>([]);
  const [aiContextFiles, setAiContextFiles] = useState<File[]>([]);
  const [activeLeftTool, setActiveLeftTool] = useState<"drafts" | "templates" | "collab" | "archive">("drafts");
  const [leftRailOpen, setLeftRailOpen] = useState(true);
  const [rightRailOpen, setRightRailOpen] = useState(true);
  const [focusWritingMode, setFocusWritingMode] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([]);
  const [styleMemoryMeta, setStyleMemoryMeta] = useState<StyleMemoryMeta | null>(null);
  const [expandedRecommendationId, setExpandedRecommendationId] = useState<string | null>(null);
  const [selectedDraftRange, setSelectedDraftRange] = useState<{ start: number; end: number } | null>(null);
  const [selectedDraftSnippet, setSelectedDraftSnippet] = useState("");
  const [draftChatMessages, setDraftChatMessages] = useState<DraftChatMessage[]>(() => [createDraftingIntroMessage()]);
  const [draftReferences, setDraftReferences] = useState<LegalDraftReferencesPayload>(() => createEmptyLegalDraftReferences());
  const [isResolvingReferences, setIsResolvingReferences] = useState(false);
  const [activeCaseSourceId, setActiveCaseSourceId] = useState<number | null>(null);
  const [caseSourceDoc, setCaseSourceDoc] = useState<CaseLawSourceDocument | null>(null);
  const [chatSnippetPopover, setChatSnippetPopover] = useState<ChatSnippetPopover | null>(null);
  const [hasDraftInSession, setHasDraftInSession] = useState(false);
  const [workspaceStateHydrated, setWorkspaceStateHydrated] = useState(false);
  const [workspaceSyncStatus, setWorkspaceSyncStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [feeCalcOpen, setFeeCalcOpen] = useState(false);
  const [caseFileImportOpen, setCaseFileImportOpen] = useState(false);
  const [chatState, setChatState] = useState<"default" | "minimized" | "expanded">("default");
  const appendVoiceTranscription = useCallback((text: string) => {
    setAiPrompt((previous) => previous ? `${previous}\n${text}` : text);
    toast({ title: "Voice transcribed successfully" });
  }, [toast]);
  const voice = useVoiceRecorder({ onAutoTranscription: appendVoiceTranscription });
  const draftHistory = useDraftHistory(selectedDraftId ? `draft-${selectedDraftId}` : `tab-${draftTabs.activeTabId}`);
  const [rightRailTab, setRightRailTab] = useState<"ai" | "history">("ai");
  const showDraftReviewPanel = hasDraftInSession || recommendLoading || recommendations.length > 0;

  useEffect(() => {
    localStorage.setItem(PAGE_PROFILE_KEY, pageProfileId);
  }, [pageProfileId]);

  const leftRailVisible = leftRailOpen && !focusWritingMode;
  const rightRailVisible = rightRailOpen && !focusWritingMode;
  const hasSelectedSnippet = selectedDraftSnippet.trim().length > 0;

  const { data: allDocuments = [], isLoading: loadingDocs } = useQuery<DraftDocument[]>({
    queryKey: [api.documents.list.path],
    queryFn: async () => {
      const res = await fetch(api.documents.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch drafts");
      return (await res.json()) as DraftDocument[];
    },
  });

  const { data: organization } = useQuery<Org | null>({
    queryKey: ["/api/org"],
    queryFn: async () => {
      const res = await fetch("/api/org", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch organization");
      return (await res.json()) as Org | null;
    },
  });

  const { data: orgMembers = [] } = useQuery<OrgMember[]>({
    queryKey: ["/api/org", organization?.id, "members"],
    enabled: !!organization?.id,
    queryFn: async () => {
      const res = await fetch(`/api/org/${organization!.id}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch organization members");
      return (await res.json()) as OrgMember[];
    },
  });

  const draftDocuments = useMemo(
    () =>
      allDocuments
        .filter((doc) => doc.title.startsWith(DRAFT_TITLE_PREFIX))
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        }),
    [allDocuments]
  );

  /** Called by LegalEditor on every content change — keeps docText in sync */
  const onEditorUpdate = useCallback((html: string, text: string) => {
    setEditorHtml(html);
    setDocText(text);
    draftTabs.updateTab(draftTabs.activeTabId, {
      editorHtml: html,
      docText: text,
      isDirty: !isRestoringTabRef.current,
      hasDraftInSession: Boolean(text.trim()),
    });
  }, [draftTabs.activeTabId, draftTabs.updateTab]);

  /** Helper: set content in both the editor (HTML) and keep docText synced */
  const setEditorContent = useCallback((content: string) => {
    const html = isHTMLContent(content) ? content : plainTextToTiptapHTML(content);
    setEditorHtml(html);
    // Update the Tiptap editor directly
    editorRef.current?.setContent(html);
    // Sync docText: if the content is plain text, use it directly.
    // If it's HTML, read the plain text from the editor after it renders.
    if (!isHTMLContent(content)) {
      setDocText(content);
    } else {
      // Defer to next microtask so Tiptap has processed the HTML
      queueMicrotask(() => {
        const text = editorRef.current?.getText() || "";
        setDocText(text);
      });
    }
  }, []);

  const snapshotActiveTab = useCallback(() => {
    draftTabs.updateTab(draftTabs.activeTabId, {
      draftId: selectedDraftId,
      title: draftTitle,
      editorHtml: editorRef.current?.getHTML() || editorHtml || docText,
      docText: editorRef.current?.getText() || docText,
      chatMessages: draftChatMessages,
      memoryItems,
      draftReferences,
      recommendations,
      hasDraftInSession,
    });
  }, [
    draftTabs.activeTabId,
    draftTabs.updateTab,
    selectedDraftId,
    draftTitle,
    editorHtml,
    docText,
    draftChatMessages,
    memoryItems,
    draftReferences,
    recommendations,
    hasDraftInSession,
  ]);

  const restoreDraftTab = useCallback((tab: DraftTab | undefined) => {
    if (!tab) return;
    stateOwnerTabIdRef.current = tab.id;
    isRestoringTabRef.current = true;
    setDraftTitle(tab.title || "Untitled Draft");
    setSelectedDraftId(tab.draftId);
    setEditorContent(tab.editorHtml || tab.docText || "");
    setDraftChatMessages(
      tab.chatMessages.length > 0
        ? tab.chatMessages.map((message) => normalizeDraftChatMessage(message)).filter((message): message is DraftChatMessage => !!message)
        : [createDraftingIntroMessage()],
    );
    setMemoryItems(tab.memoryItems);
    setDraftReferences(normalizeLegalDraftReferences(tab.draftReferences));
    setRecommendations(tab.recommendations);
    setHasDraftInSession(tab.hasDraftInSession);
    setExpandedRecommendationId(null);
    setStyleMemoryMeta(null);
    setAiPrompt("");
    setAiContextFiles([]);
    if (aiContextInputRef.current) aiContextInputRef.current.value = "";
    setCaseSourceDoc(null);
    setActiveCaseSourceId(null);
    setChatSnippetPopover(null);
    clearSelectedDraftText();
    queueMicrotask(() => {
      isRestoringTabRef.current = false;
    });
  }, [setEditorContent]);

  const initialActiveTabRef = useRef(draftTabs.activeTab);
  const previousActiveTabIdRef = useRef(draftTabs.activeTabId);

  useEffect(() => {
    if (previousActiveTabIdRef.current === draftTabs.activeTabId) return;
    previousActiveTabIdRef.current = draftTabs.activeTabId;
    restoreDraftTab(draftTabs.tabs.find((tab) => tab.id === draftTabs.activeTabId));
  }, [draftTabs.activeTabId, draftTabs.tabs, restoreDraftTab]);

  useEffect(() => {
    const storedTab = initialActiveTabRef.current;
    if (storedTab && (storedTab.editorHtml || storedTab.docText || storedTab.chatMessages.length > 0)) {
      restoreDraftTab(storedTab);
      return;
    }
    // Migrate the legacy single-workspace autosave into the active tab.
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) {
      setEditorContent(saved);
      return;
    }
    // Migrate from v2 (plain text) if it exists
    const v2 = localStorage.getItem("legal-drafting-workspace-v2");
    if (v2) {
      // Migration: drop legacy template-prefilled content
      if (v2.trim().startsWith(LEGACY_DEFAULT_DOC_PREFIX)) {
        localStorage.removeItem("legal-drafting-workspace-v2");
        return;
      }
      setEditorContent(v2);
      localStorage.removeItem("legal-drafting-workspace-v2");
      return;
    }
  }, [restoreDraftTab, setEditorContent]);

  useEffect(() => {
    const raw = localStorage.getItem(CONTEXT_MEMORY_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as MemoryItem[];
      if (Array.isArray(parsed)) {
        setMemoryItems(
          parsed
            .filter((m) => m && typeof m.text === "string" && typeof m.ts === "number")
            .slice(0, 30)
        );
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setWorkspaceStateHydrated(true);
      return;
    }
    let cancelled = false;
    const hydrationTabId = draftTabs.activeTabId;
    const loadWorkspaceState = async () => {
      try {
        const res = await fetch("/api/legal-drafting/workspace-state", {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        const state = data?.state as Partial<LegalDraftWorkspaceState> | null;
        if (!state || cancelled || activeTabIdRef.current !== hydrationTabId) return;

        const nextDocText = typeof state.docText === "string" ? state.docText : "";
        const nextTitle = typeof state.draftTitle === "string" && state.draftTitle.trim()
          ? state.draftTitle.trim()
          : "Untitled Draft";
        const nextSelectedDraftId = Number.isFinite(Number(state.selectedDraftId))
          ? Number(state.selectedDraftId)
          : null;
        const nextHasDraft = Boolean(
          typeof state.hasDraftInSession === "boolean"
            ? state.hasDraftInSession
            : nextDocText.trim().length > 0,
        );
        const nextMessages = Array.isArray(state.draftChatMessages)
          ? state.draftChatMessages
              .map((message) => normalizeDraftChatMessage(message))
              .filter((message): message is DraftChatMessage => !!message)
              .slice(-150)
          : [];
        const nextMemoryItems = Array.isArray(state.memoryItems)
          ? state.memoryItems
              .filter((m) => m && typeof m.text === "string" && typeof m.ts === "number")
              .slice(0, 60)
          : [];

        setEditorContent(nextDocText);
        setDraftTitle(nextTitle);
        setSelectedDraftId(nextSelectedDraftId);
        setHasDraftInSession(nextHasDraft);
        setMemoryItems(nextMemoryItems);
        if (nextMessages.length > 0) {
          setDraftChatMessages(nextMessages);
        }
        // Restore AI references (case law, statutes) from saved state
        if (state.draftReferences) {
          setDraftReferences(normalizeLegalDraftReferences(state.draftReferences));
        }
        // Restore AI recommendations from saved state
        if (Array.isArray(state.recommendations) && state.recommendations.length > 0) {
          const restoredRecs = state.recommendations
            .filter((r: any) => r && typeof r.id === "string" && typeof r.suggestedText === "string")
            .slice(0, 10)
            .map((r: any) => ({
              id: String(r.id),
              title: String(r.title || "Recommendation"),
              reason: String(r.reason || ""),
              originalSnippet: String(r.originalSnippet || ""),
              suggestedText: String(r.suggestedText || ""),
              impact: (["high", "medium", "low"].includes(r.impact) ? r.impact : "medium") as "high" | "medium" | "low",
            }));
          if (restoredRecs.length > 0) {
            setRecommendations(restoredRecs);
          }
        }
      } catch {
        // Silent fallback to local autosave.
      } finally {
        if (!cancelled) setWorkspaceStateHydrated(true);
      }
    };

    loadWorkspaceState();
    return () => {
      cancelled = true;
    };
  }, [user?.id, setEditorContent]);

  useEffect(() => {
    setIsSavedLocal(false);
    const timeout = setTimeout(() => {
      localStorage.setItem(AUTOSAVE_KEY, editorHtml || docText);
      setIsSavedLocal(true);
    }, 800);
    return () => clearTimeout(timeout);
  }, [docText, editorHtml]);

  useEffect(() => {
    localStorage.setItem(CONTEXT_MEMORY_KEY, JSON.stringify(memoryItems.slice(0, 30)));
  }, [memoryItems]);

  useEffect(() => {
    if (stateOwnerTabIdRef.current !== draftTabs.activeTabId) return;
    draftTabs.updateTab(draftTabs.activeTabId, {
      draftId: selectedDraftId,
      title: draftTitle,
      chatMessages: draftChatMessages,
      memoryItems,
      draftReferences,
      recommendations,
      hasDraftInSession,
    });
  }, [
    draftTabs.activeTabId,
    draftTabs.updateTab,
    selectedDraftId,
    draftTitle,
    draftChatMessages,
    memoryItems,
    draftReferences,
    recommendations,
    hasDraftInSession,
  ]);

  useEffect(() => {
    if (!workspaceStateHydrated || !user?.id) return;
    const timeout = window.setTimeout(async () => {
      const payload: LegalDraftWorkspaceState = {
        version: LEGAL_DRAFTING_WORKSPACE_VERSION,
        draftTitle: (draftTitle || "Untitled Draft").slice(0, 240),
        docText: editorHtml || docText || "",
        selectedDraftId,
        hasDraftInSession,
        draftChatMessages: draftChatMessages.slice(-150).map((message) => ({
          ...message,
          content: String(message.content || "").slice(0, 80000),
          attachments: Array.isArray(message.attachments)
            ? message.attachments.slice(0, 8).map((item) => String(item || "").slice(0, 260))
            : undefined,
        })),
        memoryItems: memoryItems.slice(0, 60).map((item) => ({
          ...item,
          text: String(item.text || "").slice(0, 2000),
        })),
        draftReferences: {
          caseLaw: draftReferences.caseLaw.slice(0, 50),
          statutes: draftReferences.statutes.slice(0, 50),
          removedCaseCitations: draftReferences.removedCaseCitations.slice(0, 30),
          unresolvedStatutes: draftReferences.unresolvedStatutes.slice(0, 30),
        },
        recommendations: recommendations.slice(0, 10).map((r) => ({
          ...r,
          originalSnippet: String(r.originalSnippet || "").slice(0, 5000),
          suggestedText: String(r.suggestedText || "").slice(0, 5000),
          reason: String(r.reason || "").slice(0, 1000),
          title: String(r.title || "").slice(0, 200),
        })),
      };
      try {
        setWorkspaceSyncStatus("saving");
        const response = await fetch("/api/legal-drafting/workspace-state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(`Workspace autosave failed (${response.status})`);
        }
        setWorkspaceSyncStatus("saved");
      } catch {
        setWorkspaceSyncStatus("error");
      }
    }, WORKSPACE_STATE_SYNC_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [
    workspaceStateHydrated,
    user?.id,
    draftTitle,
    docText,
    selectedDraftId,
    hasDraftInSession,
    draftChatMessages,
    memoryItems,
    draftReferences,
    recommendations,
    editorHtml,
  ]);

  useEffect(() => {
    if (!selectedDraftSnippet.trim()) return;
    if (selectedDraftRange) {
      const current = docText.slice(selectedDraftRange.start, selectedDraftRange.end);
      if (current === selectedDraftSnippet) return;
    }
    const remapped = findSnippetRange(docText, selectedDraftSnippet);
    if (remapped) {
      setSelectedDraftRange(remapped);
      return;
    }
    clearSelectedDraftText();
  }, [docText, selectedDraftRange, selectedDraftSnippet]);

  const collaborators = useMemo(() => {
    if (orgMembers.length > 0) {
      return orgMembers
        .slice(0, 4)
        .map((m) => {
          const first = (m.firstName || "").trim();
          const last = (m.lastName || "").trim();
          const initials = `${first[0] || ""}${last[0] || ""}`.toUpperCase();
          if (initials) return initials;
          return (m.email || "U").slice(0, 2).toUpperCase();
        });
    }
    const self = `${(user?.firstName || "")[0] || ""}${(user?.lastName || "")[0] || ""}`.toUpperCase();
    return [self || "U"];
  }, [orgMembers, user?.firstName, user?.lastName]);

  const addMemoryItem = (kind: MemoryItem["kind"], text: string) => {
    const clean = text.trim().replace(/\s+/g, " ");
    if (!clean) return;
    setMemoryItems((prev) => {
      const recent = prev[0];
      if (recent && recent.text === clean && recent.kind === kind) {
        return prev;
      }
      return [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind,
          text: clean.slice(0, 500),
          ts: Date.now(),
        },
        ...prev,
      ].slice(0, 30);
    });
  };

  const clearSelectedDraftText = () => {
    setSelectedDraftRange(null);
    setSelectedDraftSnippet("");
  };

  const startNewDraftingChat = () => {
    if (isGenerating) {
      toast({ title: "Wait for drafting to finish before starting another draft." });
      return;
    }
    setEditorContent(DEFAULT_DOC);
    setDraftTitle("Untitled Draft");
    setSelectedDraftId(null);
    setHasDraftInSession(false);
    setDraftReferences(createEmptyLegalDraftReferences());
    setDraftChatMessages([createDraftingIntroMessage()]);
    setMemoryItems([]);
    setRecommendations([]);
    setExpandedRecommendationId(null);
    setStyleMemoryMeta(null);
    setAiPrompt("");
    setAiContextFiles([]);
    if (aiContextInputRef.current) aiContextInputRef.current.value = "";
    setCaseSourceDoc(null);
    setActiveCaseSourceId(null);
    setChatSnippetPopover(null);
    clearSelectedDraftText();
    clearBrowserSelection();
    toast({ title: "Started a new drafting chat" });
  };

  const clearBrowserSelection = () => {
    try {
      const selection = window.getSelection();
      if (selection) selection.removeAllRanges();
    } catch {
      // Ignore selection cleanup errors.
    }
  };

  const applyChatSnippetSelection = () => {
    if (!chatSnippetPopover?.text) return;
    const snippet = chatSnippetPopover.text.trim();
    if (!snippet) {
      setChatSnippetPopover(null);
      return;
    }

    setSelectedDraftSnippet(snippet);
    const remapped = findSnippetRange(docText, snippet);
    if (remapped) {
      setSelectedDraftRange(remapped);
      toast({ title: "Snippet selected from chat response" });
    } else {
      setSelectedDraftRange(null);
      toast({
        title: "Snippet selected",
        description: "This text is selected for targeted edit, but exact draft position was not auto-mapped yet.",
      });
    }

    setChatSnippetPopover(null);
    clearBrowserSelection();
  };

  const handleChatSelectionMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setChatSnippetPopover(null);
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      setChatSnippetPopover(null);
      return;
    }

    const listEl = chatListRef.current;
    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    if (!listEl || !anchorNode || !focusNode) {
      setChatSnippetPopover(null);
      return;
    }

    const anchorEl = anchorNode instanceof Element ? anchorNode : anchorNode.parentElement;
    const focusEl = focusNode instanceof Element ? focusNode : focusNode.parentElement;
    if (!anchorEl || !focusEl || !listEl.contains(anchorEl) || !listEl.contains(focusEl)) {
      setChatSnippetPopover(null);
      return;
    }

    const assistantMessage = anchorEl.closest("[data-chat-message-role='assistant']");
    const focusAssistantMessage = focusEl.closest("[data-chat-message-role='assistant']");
    if (
      !assistantMessage ||
      !focusAssistantMessage ||
      assistantMessage !== focusAssistantMessage ||
      !listEl.contains(assistantMessage)
    ) {
      setChatSnippetPopover(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) {
      setChatSnippetPopover(null);
      return;
    }

    setChatSnippetPopover({
      text: selectedText.slice(0, 8000),
      x: rect.left + rect.width / 2,
      y: Math.max(12, rect.top - 42),
    });
  };

  useEffect(() => {
    if (expandedRecommendationId && !recommendations.some((item) => item.id === expandedRecommendationId)) {
      setExpandedRecommendationId(null);
    }
  }, [recommendations, expandedRecommendationId]);

  useEffect(() => {
    if (!hasDraftInSession) {
      setDraftReferences(createEmptyLegalDraftReferences());
      setIsResolvingReferences(false);
      return;
    }
    const currentText = docText.trim();
    if (!currentText) {
      setDraftReferences(createEmptyLegalDraftReferences());
      setIsResolvingReferences(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsResolvingReferences(true);
      try {
        const response = await fetch("/api/legal-drafting/references", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({ draftText: currentText.slice(0, 80000) }),
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted) {
          setDraftReferences(normalizeLegalDraftReferences(data?.references));
        }
      } catch {
        // Silent background refresh failure.
      } finally {
        if (!controller.signal.aborted) {
          setIsResolvingReferences(false);
        }
      }
    }, 650);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [docText, hasDraftInSession]);

  const openCaseSourceDocument = async (reference: LegalDraftCaseReference) => {
    if (!reference.id || !reference.hasSource) {
      toast({
        title: "Source unavailable",
        description: "This citation is not linked to an internal source document yet.",
        variant: "destructive",
      });
      return;
    }

    setActiveCaseSourceId(reference.id);
    try {
      const response = await fetch(`/api/case-law/${reference.id}/source`, {
        credentials: "include",
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Could not open case source document.");
      }
      const data = (await response.json()) as CaseLawSourceDocument;
      if (!data?.found) {
        throw new Error(data?.message || "Source document not found for this citation.");
      }
      if (data.viewUrl) {
        window.open(data.viewUrl, "_blank", "noopener,noreferrer");
        return;
      }
      if (!data.content) {
        throw new Error("Source document is linked but no preview text is available.");
      }
      setCaseSourceDoc(data);
    } catch (err: any) {
      toast({
        title: "Failed to open source",
        description: err?.message || "Could not load the original judgment document.",
        variant: "destructive",
      });
    } finally {
      setActiveCaseSourceId(null);
    }
  };

  const openStatuteReference = (reference: LegalDraftStatuteReference) => {
    const viewUrl = reference.viewUrl;
    if (!viewUrl) {
      toast({
        title: "Statute source unavailable",
        description: "This section was detected but no matching statute document was found in the library.",
        variant: "destructive",
      });
      return;
    }
    window.location.assign(viewUrl);
  };

  const applyRecommendedChange = (edit: DraftRecommendation) => {
    const replacement = edit.suggestedText.trim();
    if (!replacement) return;
    if (!edit.originalSnippet.trim()) {
      toast({
        title: "Could not auto-apply",
        description: "AI did not provide an exact snippet to replace. No new text was added.",
        variant: "destructive",
      });
      return;
    }

    // Strategy: try to apply the change on the HTML source first.
    // This preserves tables (INDEX OF DOCUMENTS) and other rich formatting
    // that would be lost if we operated on plain text only.
    const currentHtml = editorRef.current?.getHTML() || editorHtml || "";
    const plainSource = docText || "";

    // Try finding the snippet in plain text first to get the replacement
    const plainRange = findSnippetRange(plainSource, edit.originalSnippet);
    if (!plainRange) {
      toast({
        title: "Snippet not found",
        description: "No matching text found in current draft. No new text was added.",
        variant: "destructive",
      });
      return;
    }

    // If the editor has HTML with tables/rich content, do an HTML-aware replacement.
    // We replace within plain text, then re-render through plainTextToTiptapHTML,
    // BUT we must first check if the HTML has a table — if so, preserve it.
    const hasTable = /<table[\s>]/i.test(currentHtml);

    if (hasTable && currentHtml) {
      // HTML-aware path: find the snippet in the HTML's text nodes and replace.
      // We need to match the original snippet text within HTML paragraph content.
      const snippetEscaped = edit.originalSnippet.trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\s+/g, "\\s*(?:<[^>]*>)*\\s*"); // Allow HTML tags between words
      const htmlRegex = new RegExp(snippetEscaped, "i");
      const htmlMatch = currentHtml.match(htmlRegex);

      if (htmlMatch && typeof htmlMatch.index === "number") {
        // Replace in HTML directly, wrapping the replacement in a <p> if it's plain text
        const replacementHtml = isHTMLContent(replacement)
          ? replacement
          : plainTextToTiptapHTML(replacement);
        const nextHtml =
          currentHtml.slice(0, htmlMatch.index) +
          replacementHtml +
          currentHtml.slice(htmlMatch.index + htmlMatch[0].length);
        setEditorContent(nextHtml);
        setHasDraftInSession(!!nextHtml.trim());
      } else {
        // HTML regex didn't match — fall back to plain text replacement
        // but reconstruct the full HTML including the table sections
        const nextText = plainSource.slice(0, plainRange.start) + replacement + plainSource.slice(plainRange.end);
        // Preserve table sections from the current HTML
        const tableMatch = currentHtml.match(/(<!--\s*INDEX_TABLE_START\s*-->[\s\S]*?<!--\s*INDEX_TABLE_END\s*-->|<table[\s\S]*?<\/table>)/i);
        if (tableMatch) {
          // Convert new text to HTML, then inject the preserved table at the right spot
          const newHtml = plainTextToTiptapHTML(nextText);
          // Find where INDEX OF DOCUMENTS heading is and insert table after it
          const indexHeadingRegex = /(<h[12][^>]*>.*?INDEX OF DOCUMENTS.*?<\/h[12]>)/i;
          const headingMatch = newHtml.match(indexHeadingRegex);
          if (headingMatch && typeof headingMatch.index === "number") {
            const insertPos = headingMatch.index + headingMatch[0].length;
            const finalHtml = newHtml.slice(0, insertPos) + tableMatch[0] + newHtml.slice(insertPos);
            setEditorContent(finalHtml);
          } else {
            // No INDEX heading found — just inject table before RESPECTFULLY SHEWETH
            const shewethRegex = /(<h[12][^>]*>.*?RESPECTFULLY SHEWETH.*?<\/h[12]>)/i;
            const shewethMatch = newHtml.match(shewethRegex);
            if (shewethMatch && typeof shewethMatch.index === "number") {
              const finalHtml = newHtml.slice(0, shewethMatch.index) + tableMatch[0] + newHtml.slice(shewethMatch.index);
              setEditorContent(finalHtml);
            } else {
              setEditorContent(newHtml);
            }
          }
        } else {
          setEditorContent(nextText);
        }
        setHasDraftInSession(true);
      }
    } else {
      // No table in HTML — simple plain text replacement (original behavior)
      const nextText = plainSource.slice(0, plainRange.start) + replacement + plainSource.slice(plainRange.end);
      setEditorContent(nextText);
      setHasDraftInSession(!!nextText.trim());
    }
    // Don't re-trigger recommendations after applying a change — let user decide

    addMemoryItem("risk", `Applied AI recommendation: ${edit.title}`);
    let remaining = 0;
    setRecommendations((prev) => {
      const next = prev.filter((item) => item.id !== edit.id);
      remaining = next.length;
      return next;
    });
    setExpandedRecommendationId((prev) => (prev === edit.id ? null : prev));
    fetch("/api/style-memory/events/accepted-redline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        module: "legal-drafting",
        draftId: selectedDraftId ?? "workspace",
        acceptedText: replacement.slice(0, 12000),
        beforeText: (edit.originalSnippet || "").slice(0, 12000),
      }),
    }).catch(() => {});
    toast({ title: "Recommended change applied" });
  };

  const dismissRecommendation = (id: string) => {
    let remaining = 0;
    setRecommendations((prev) => {
      const next = prev.filter((item) => item.id !== id);
      remaining = next.length;
      return next;
    });
    setExpandedRecommendationId((prev) => (prev === id ? null : prev));
  };

  const runDraftRecommendations = async (contentOverride?: string) => {
    const requestTabId = activeTabIdRef.current;
    const content = (contentOverride ?? docText).trim();
    if ((!hasDraftInSession && !contentOverride) || !content) {
      setRecommendations([]);
      setRecommendLoading(false);
      return;
    }

    setRecommendLoading(true);
    try {
      const response = await fetch("/api/ai/draft-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: draftTitle,
          content,
          maxEdits: 6,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Recommendation review failed");
      }

      const data = await response.json();
      if (activeTabIdRef.current !== requestTabId) return;
      const editsRaw = Array.isArray(data?.edits) ? data.edits : [];
      const normalized: DraftRecommendation[] = editsRaw.slice(0, 10).map((edit: any, idx: number) => ({
        id: typeof edit?.id === "string" && edit.id.trim() ? edit.id : `edit-${idx + 1}`,
        title: typeof edit?.title === "string" && edit.title.trim() ? edit.title : `Recommended change ${idx + 1}`,
        reason: typeof edit?.reason === "string" && edit.reason.trim() ? edit.reason : "Improves pleading quality and legal clarity.",
        originalSnippet: typeof edit?.originalSnippet === "string" ? edit.originalSnippet.trim() : "",
        suggestedText: typeof edit?.suggestedText === "string" ? edit.suggestedText.trim() : "",
        impact: edit?.impact === "high" || edit?.impact === "low" ? edit.impact : "medium",
      })).filter((edit: DraftRecommendation) => edit.suggestedText.length > 0);

      setRecommendations((prev) => {
        const existingCaseLaws = prev.filter(p => p.id && p.id.startsWith("rec-"));
        return [...existingCaseLaws, ...normalized];
      });
      setExpandedRecommendationId(normalized[0]?.id || null);
      if (normalized.length > 0) {
        addMemoryItem(
          "risk",
          `AI recommendations generated ${normalized.length} change(s): ${normalized.slice(0, 3).map((e) => e.title).join("; ")}`
        );
      }
    } catch (err: any) {
      toast({
        title: "Recommendation review failed",
        description: err?.message || "Could not generate draft recommendations.",
        variant: "destructive",
      });
    } finally {
      setRecommendLoading(false);
    }
  };

  const runDraftReview = async (contentOverride?: string) => {
    const content = (contentOverride ?? docText).trim();
    if ((!hasDraftInSession && !contentOverride) || !content) {
      setRecommendations([]);
      return;
    }
    await runDraftRecommendations(content);
  };

  const saveDraftMutation = useMutation({
    mutationFn: async ({
      id,
      title,
      content,
    }: {
      id: number | null;
      title: string;
      content: string;
      tabId: string;
    }) => {
      const payload = {
        title: `${DRAFT_TITLE_PREFIX} ${title}`,
        content,
      };
      if (id) {
        const res = await apiRequest("PUT", `/api/documents/${id}`, payload);
        return (await res.json()) as DraftDocument;
      }
      const res = await apiRequest("POST", "/api/documents", payload);
      return (await res.json()) as DraftDocument;
    },
    onSuccess: (doc, variables) => {
      if (activeTabIdRef.current === variables.tabId) {
        setSelectedDraftId(doc.id);
        toast({ title: "Draft saved" });
      }
      draftTabs.updateTab(variables.tabId, {
        draftId: doc.id,
        title: variables.title.trim() || "Untitled Draft",
        isDirty: false,
      });
      queryClient.invalidateQueries({ queryKey: [api.documents.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity/summary"] });
    },
    onError: (err: any) => {
      toast({
        title: "Save failed",
        description: err?.message || "Could not save draft.",
        variant: "destructive",
      });
    },
  });

  const deleteDraftMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: (_, id) => {
      if (selectedDraftId === id) {
        setSelectedDraftId(null);
      }
      queryClient.invalidateQueries({ queryKey: [api.documents.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity/summary"] });
      toast({ title: "Draft deleted" });
    },
    onError: (err: any) => {
      toast({
        title: "Delete failed",
        description: err?.message || "Could not delete draft.",
        variant: "destructive",
      });
    },
  });

  const saveDraft = () => {
    const cleanTitle = draftTitle.trim() || `Draft ${new Date().toLocaleString()}`;
    const currentHtml = editorRef.current?.getHTML() || editorHtml || docText;
    const currentText = editorRef.current?.getText() || docText;
    // Auto-snapshot before saving
    draftHistory.addSnapshot(cleanTitle, currentHtml, currentText);
    saveDraftMutation.mutate({
      id: selectedDraftId,
      title: cleanTitle,
      content: currentHtml,
      tabId: draftTabs.activeTabId,
    });
  };

  // ── Auto-save: debounced server save 5s after last edit ──
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoSavedContentRef = useRef<string>("");

  useEffect(() => {
    // Only auto-save if there's content in session
    if (!hasDraftInSession) return;
    const currentHtml = editorRef.current?.getHTML() || editorHtml || docText;
    // Skip if content hasn't changed since last auto-save
    if (currentHtml === lastAutoSavedContentRef.current) return;
    // Skip if AI is currently generating (wait until done)
    if (isGenerating) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const html = editorRef.current?.getHTML() || editorHtml || docText;
      if (!html.trim() || html === lastAutoSavedContentRef.current) return;
      const cleanTitle = draftTitle.trim() || `Draft ${new Date().toLocaleString()}`;
      lastAutoSavedContentRef.current = html;
      saveDraftMutation.mutate(
        { id: selectedDraftId, title: cleanTitle, content: html, tabId: draftTabs.activeTabId },
        {
          onSuccess: (_doc, variables) => {
            if (activeTabIdRef.current === variables.tabId) {
              setIsSavedLocal(true);
            }
          },
        }
      );
    }, 5000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [docText, editorHtml, hasDraftInSession, isGenerating, draftTitle, selectedDraftId, draftTabs.activeTabId]);

  const loadDraft = (doc: DraftDocument) => {
    if (isGenerating) {
      toast({ title: "Wait for drafting to finish before opening another draft." });
      return;
    }
    const title = doc.title.replace(`${DRAFT_TITLE_PREFIX} `, "") || "Draft";
    const content = doc.content || "";
    const existingTab = draftTabs.findTabByDraftId(doc.id);
    if (existingTab && existingTab.id !== draftTabs.activeTabId) {
      snapshotActiveTab();
      draftTabs.switchTab(existingTab.id);
      toast({ title: "Draft loaded" });
      return;
    } else if (!existingTab && hasDraftInSession) {
      snapshotActiveTab();
      draftTabs.addTab({
        draftId: doc.id,
        title,
        editorHtml: content,
        docText: content,
        chatMessages: [createDraftingIntroMessage()],
        memoryItems: [],
        recommendations: [],
        draftReferences: null,
        hasDraftInSession: Boolean(content.trim()),
        isDirty: false,
      });
      toast({ title: "Draft loaded" });
      if (content.trim()) {
        window.setTimeout(() => runDraftReview(content), 0);
      }
      return;
    } else {
      draftTabs.updateTab(draftTabs.activeTabId, {
        draftId: doc.id,
        title,
        editorHtml: content,
        docText: content,
        recommendations: [],
        draftReferences: null,
        hasDraftInSession: Boolean(content.trim()),
        isDirty: false,
      });
    }
    setSelectedDraftId(doc.id);
    setDraftTitle(title);
    setEditorContent(content);
    setHasDraftInSession(Boolean(content.trim()));
    clearSelectedDraftText();
    setRecommendations([]);
    setDraftReferences(createEmptyLegalDraftReferences());
    toast({ title: "Draft loaded" });
    if (content.trim()) {
      runDraftReview(content);
    }
  };

  const applyTemplate = (template: DraftTemplate) => {
    if (isGenerating) {
      toast({ title: "Wait for drafting to finish before applying a template." });
      return;
    }
    setDraftTitle(template.title);
    setEditorContent(template.body);
    setHasDraftInSession(!!template.body.trim());
    clearSelectedDraftText();
    setRecommendations([]);
    setDraftReferences(createEmptyLegalDraftReferences());
    setSelectedDraftId(null);
    setActiveLeftTool("drafts");
    toast({ title: `Template applied: ${template.title}` });
    runDraftReview(template.body);
  };

  const onAiContextFilesSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    const allowed = incoming.filter((file) => {
      const name = file.name.toLowerCase();
      return (
        name.endsWith(".pdf") ||
        name.endsWith(".doc") ||
        name.endsWith(".docx") ||
        name.endsWith(".docm") ||
        name.endsWith(".dotx") ||
        name.endsWith(".txt")
      );
    });
    const rejected = incoming.length - allowed.length;
    if (rejected > 0) {
      toast({
        title: "Some files were ignored",
        description: "Only PDF, DOC/DOCX/DOCM/DOTX, and TXT files are supported.",
        variant: "destructive",
      });
    }
    setAiContextFiles((prev) => {
      const combined = [...prev, ...allowed];
      const limited = combined.slice(0, 5);
      const dropped = combined.length - limited.length;
      if (dropped > 0) {
        toast({
          title: "Attachment limit reached",
          description: "You can attach up to 5 context files at a time.",
          variant: "destructive",
        });
      }
      return limited;
    });
    e.currentTarget.value = "";
  };

  const streamAssistantDraftMessage = async (messageId: string, text: string) => {
    const finalText = String(text || "");
    if (!finalText) return;
    const total = finalText.length;
    const chunkSize =
      total > 10000 ? 180 :
      total > 6000 ? 130 :
      total > 3000 ? 95 :
      total > 1200 ? 64 : 34;
    let cursor = 0;
    while (cursor < total) {
      cursor = Math.min(total, cursor + chunkSize);
      const partial = finalText.slice(0, cursor);
      setDraftChatMessages((prev) => {
        let found = false;
        const next = prev.map((item) => {
          if (item.id !== messageId) return item;
          found = true;
          return { ...item, content: partial, kind: (cursor < total ? "typing" : undefined) as "typing" | undefined };
        });
        if (found) return next;
        return [
          ...next,
          {
            id: messageId,
            role: "assistant",
            kind: cursor < total ? "typing" : undefined,
            content: partial,
            createdAt: Date.now(),
          },
        ];
      });
      await new Promise((resolve) => window.setTimeout(resolve, 20));
    }
  };

  const generateClause = async (promptOverride?: string, documentTypeOverride?: string) => {
    const prompt = (promptOverride ?? aiPrompt).trim();
    if (!prompt) return;
    setChatSnippetPopover(null);
    clearBrowserSelection();

    const liveDraftText = editorRef.current?.getText() || docText || "";
    const liveDraftHtml = editorRef.current?.getHTML() || editorHtml || liveDraftText;
    const selectedSnippet = selectedDraftSnippet.trim() ? selectedDraftSnippet : "";
    const selectedSnippetStart = selectedDraftRange?.start;
    const selectedSnippetEnd = selectedDraftRange?.end;
    if (selectedSnippet.length > 50_000) {
      toast({
        title: "Select a smaller passage",
        description: "Bounded AI edits support selections up to 50,000 characters. No draft changes were applied.",
        variant: "destructive",
      });
      return;
    }
    if (selectedSnippet) {
      // One-time selection: consume snippet for this single command only.
      clearSelectedDraftText();
    }

    const conversationHistory = buildLegalDraftConversationHistory(draftChatMessages);
    const queuedAttachments = aiContextFiles.map((file) => file.name);
    setDraftChatMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "user",
        content: prompt,
        attachments: queuedAttachments.length > 0 ? queuedAttachments : undefined,
        createdAt: Date.now(),
      },
    ]);
    setAiPrompt("");

    if (UNDO_LAST_EDIT_REGEX.test(prompt)) {
      const snapshot = draftHistory.snapshots.find((item) => item.title.startsWith("Before AI:"));
      const message = snapshot
        ? `Restored the draft to its state before the last AI edit (“${snapshot.title.replace(/^Before AI:\s*/, "") || "previous version"}”).`
        : "There is no earlier AI-edit snapshot to restore in this tab.";
      if (snapshot) {
        if (liveDraftText.trim()) {
          draftHistory.addSnapshot("Before undo", liveDraftHtml, liveDraftText);
        }
        setEditorContent(snapshot.html || snapshot.text);
        setHasDraftInSession(Boolean(snapshot.text.trim()));
        draftHistory.deleteSnapshot(snapshot.id);
      }
      setDraftChatMessages((prev) => [
        ...prev,
        {
          id: `assistant-undo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: "assistant",
          content: message,
          createdAt: Date.now(),
        },
      ]);
      return;
    }

    const promptMode = classifyLegalDraftPrompt(prompt, Boolean(liveDraftText.trim()));
    if (promptMode === "guidance") {
      setDraftChatMessages((prev) => [
        ...prev,
        {
          id: `assistant-guidance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: "assistant",
          kind: "guidance",
          content: buildDraftingGuidanceMessage(),
          createdAt: Date.now(),
        },
      ]);
      setRecommendations([]);
      setDraftReferences(createEmptyLegalDraftReferences());
      return;
    }
    const assistantMode: "draft" | "analysis" = promptMode === "analysis" ? "analysis" : "draft";

    const typingMessageId = `assistant-typing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setDraftChatMessages((prev) => [
      ...prev,
      {
        id: typingMessageId,
        role: "assistant",
        kind: "typing",
        content: assistantMode === "draft" ? "AI is preparing and validating the requested update..." : "AI is reviewing the active draft...",
        createdAt: Date.now(),
      },
    ]);

    setIsGenerating(true);
    setGenerationStartTime(Date.now());
    setGenerationElapsed(0);
    if (generationTimerRef.current) clearInterval(generationTimerRef.current);
    generationTimerRef.current = setInterval(() => {
      setGenerationElapsed((prev) => prev + 1);
    }, 1000);
    try {
      const draftTextForAi = liveDraftText;
      let didSnapshotBeforeApply = false;
      const applyValidatedDraft = (nextDraft: string) => {
        if (!didSnapshotBeforeApply && liveDraftText.trim() && nextDraft !== liveDraftText) {
          draftHistory.addSnapshot(`Before AI: ${prompt.slice(0, 80)}`, liveDraftHtml, liveDraftText);
          didSnapshotBeforeApply = true;
        }
        setEditorContent(nextDraft);
        setHasDraftInSession(Boolean(nextDraft.trim()));
      };
      let response: Response;
      const useStreaming = aiContextFiles.length === 0; // SSE streaming only for non-attachment requests
      if (aiContextFiles.length > 0) {
        const form = new FormData();
        form.append("prompt", prompt);
        form.append("draftText", draftTextForAi);
        form.append("jurisdiction", "Lahore");
        form.append("module", "legal-drafting");
        form.append("assistantMode", assistantMode);
        form.append("conversationHistory", JSON.stringify(conversationHistory));
        if (selectedSnippet) {
          form.append("selectedSnippet", selectedSnippet);
          if (typeof selectedSnippetStart === "number") form.append("selectedSnippetStart", String(selectedSnippetStart));
          if (typeof selectedSnippetEnd === "number") form.append("selectedSnippetEnd", String(selectedSnippetEnd));
          form.append("forceTargetedEdit", "true");
        }
        aiContextFiles.forEach((file) => form.append("attachments", file));
        if (documentTypeOverride) form.append("documentTypeOverride", documentTypeOverride);
        response = await fetch("/api/retrieval/clauses/generate", {
          method: "POST",
          credentials: "include",
          body: form,
        });
      } else {
        const payload = {
          prompt,
          draftText: draftTextForAi,
          selectedSnippet: selectedSnippet || undefined,
          selectedSnippetStart: typeof selectedSnippetStart === "number" ? selectedSnippetStart : undefined,
          selectedSnippetEnd: typeof selectedSnippetEnd === "number" ? selectedSnippetEnd : undefined,
          forceTargetedEdit: selectedSnippet ? true : undefined,
          jurisdiction: "Lahore",
          module: "legal-drafting",
          assistantMode,
          conversationHistory,
          stream: true, // Enable SSE streaming
          documentTypeOverride: documentTypeOverride || undefined,
        };
        response = await fetch("/api/retrieval/clauses/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const responseText = await response.text();
        let errorPayload: any = null;
        try {
          errorPayload = JSON.parse(responseText);
        } catch {}
        if (errorPayload?.clarification === true) {
          setDraftChatMessages((prev) => [
            ...prev.filter((message) => message.id !== typingMessageId && !(message.role === "assistant" && message.kind === "typing")),
            {
              id: `assistant-clarify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              role: "assistant",
              kind: "clarification",
              content: String(errorPayload.message || "Select the exact passage or name the section you want changed."),
              suggestedTypes: Array.isArray(errorPayload.suggestedTypes) ? errorPayload.suggestedTypes : [],
              originalPrompt: prompt,
              createdAt: Date.now(),
            },
          ]);
          return;
        }
        throw new Error(errorPayload?.message || responseText || "AI generation failed");
      }

      // Check response type
      let nonStreamJsonResponse: any = null;
      const contentType = response.headers.get("content-type") || "";
      const isEventStream = contentType.includes("text/event-stream");

      if (!isEventStream) {
        try {
          nonStreamJsonResponse = await response.json();
        } catch {
          nonStreamJsonResponse = null;
        }

        if (nonStreamJsonResponse?.clarification === true) {
          // Replace typing indicator with clarification message
          setDraftChatMessages((prev) => [
            ...prev.filter((msg) => msg.id !== typingMessageId && !(msg.role === "assistant" && msg.kind === "typing")),
            {
              id: `assistant-clarify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              role: "assistant",
              kind: "clarification",
              content: String(nonStreamJsonResponse.message || "Could you clarify which document type you'd like me to draft?"),
              suggestedTypes: Array.isArray(nonStreamJsonResponse.suggestedTypes) ? nonStreamJsonResponse.suggestedTypes : [],
              originalPrompt: prompt,
              createdAt: Date.now(),
            },
          ]);
          setIsGenerating(false);
          setGenerationStartTime(null);
          if (generationTimerRef.current) {
            clearInterval(generationTimerRef.current);
            generationTimerRef.current = null;
          }
          return;
        }
      }

      const assistantMessageId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let streamedClause = ""; // Track final clause text across both paths
      let completedAssistantMode: "draft" | "analysis" = assistantMode;

      if (useStreaming && isEventStream) {
        // ── SSE Streaming Path ──
        // Replace typing indicator with streaming message
        setDraftChatMessages((prev) => [
          ...prev.filter((message) => message.id !== typingMessageId),
          {
            id: assistantMessageId,
            role: "assistant",
            kind: "typing",
            content: "Preparing and validating the requested update...",
            createdAt: Date.now(),
          },
        ]);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        let buffer = "";
        let doneData: any = null;

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              try {
                const parsed = JSON.parse(jsonStr);

                if (parsed.error) {
                  throw new Error(parsed.error);
                }

                if (parsed.reset) {
                  // Post-processing changed the text — clear accumulated
                  accumulated = "";
                }

                if (parsed.text) {
                  accumulated += parsed.text;
                  // Keep the editor unchanged until the server validates the complete result.
                  setDraftChatMessages((prev) =>
                    prev.map((message) =>
                      message.id === assistantMessageId
                        ? { ...message, content: `Preparing and validating the requested update... (${accumulated.length.toLocaleString()} characters)`, kind: "typing" as const }
                        : message,
                    ),
                  );
                }

                if (parsed.done) {
                  doneData = parsed;
                }
              } catch (parseErr: any) {
                if (parseErr.message && !parseErr.message.includes("JSON")) {
                  throw parseErr; // Re-throw non-parse errors (like error events)
                }
                // Skip malformed JSON lines
              }
            }
          }
        }

        // Use final data from done event
        const clause = doneData?.clause || accumulated;
        if (!clause.trim()) throw new Error("No draft generated");
        streamedClause = clause;
        completedAssistantMode = doneData?.assistantMode === "analysis" ? "analysis" : "draft";
        const assistantSummary = completedAssistantMode === "draft"
          ? String(doneData?.assistantMessage || "Updated the legal draft after validation.")
          : clause;

        // Apply metadata from done event
        if (doneData) {
          setStyleMemoryMeta((doneData.styleMemory || null) as StyleMemoryMeta | null);
          setDraftReferences(normalizeLegalDraftReferences(doneData.references));
          if (Array.isArray(doneData.recommendations) && doneData.recommendations.length > 0) {
            setRecommendations((prev) => {
              const next = [...prev];
              doneData.recommendations.forEach((rec: any) => {
                if (!next.some((r) => r.id === rec.id)) {
                  next.push({
                    id: rec.id || `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    title: rec.title || "Alternative Case Law",
                    reason: rec.reason || "Case law suggestion",
                    originalSnippet: rec.originalSnippet || "",
                    suggestedText: rec.suggestedText || "",
                    impact: rec.impact || "medium",
                  });
                }
              });
              return next;
            });
          }
        }

        // Finalize chat message
        setDraftChatMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? { ...message, content: assistantSummary, kind: undefined }
              : message,
          ),
        );
        addMemoryItem("instruction", prompt);
        if (completedAssistantMode === "draft") {
          applyValidatedDraft(clause);
          addMemoryItem("clause", clause);
        }
      } else {
        // ── Original JSON Path (file attachments or server doesn't support streaming) ──
        const data = nonStreamJsonResponse;
        if (!data) throw new Error("AI generation failed to return a valid response");
        const clause = String(data?.clause || "");
        if (!clause.trim()) throw new Error("No clause generated");
        streamedClause = clause;
        completedAssistantMode = data?.assistantMode === "analysis" ? "analysis" : "draft";
        const assistantSummary = completedAssistantMode === "draft"
          ? String(data?.assistantMessage || "Updated the requested portion of the legal draft.")
          : clause;
        setStyleMemoryMeta((data?.styleMemory || null) as StyleMemoryMeta | null);
        setDraftReferences(normalizeLegalDraftReferences(data?.references));
        if (Array.isArray(data?.recommendations) && data.recommendations.length > 0) {
          setRecommendations((prev) => {
            const next = [...prev];
            data.recommendations.forEach((rec: any) => {
              if (!next.some((r) => r.id === rec.id)) {
                next.push({
                  id: rec.id || `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  title: rec.title || "Alternative Case Law",
                  reason: rec.reason || "Case law suggestion",
                  originalSnippet: rec.originalSnippet || "",
                  suggestedText: rec.suggestedText || "",
                  impact: rec.impact || "medium",
                });
              }
            });
            return next;
          });
        }

        setDraftChatMessages((prev) => [
          ...prev.filter((message) => message.id !== typingMessageId),
          {
            id: assistantMessageId,
            role: "assistant",
            kind: "typing" as const,
            content: "Drafting...",
            createdAt: Date.now(),
          },
        ]);
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
        await streamAssistantDraftMessage(assistantMessageId, assistantSummary);
        addMemoryItem("instruction", prompt);
        if (completedAssistantMode === "draft") {
          applyValidatedDraft(clause);
          addMemoryItem("clause", clause);
        }
        setDraftChatMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? { ...message, content: assistantSummary, kind: undefined }
              : message,
          ),
        );
      }

      setAiContextFiles([]);
      if (aiContextInputRef.current) aiContextInputRef.current.value = "";
      toast({ title: completedAssistantMode === "draft" ? "Legal draft updated" : "Legal analysis ready" });

      await apiRequest("POST", "/api/search-history", {
        type: "draft",
        query: prompt.slice(0, 120),
      }).catch(() => {});

      if (completedAssistantMode === "draft") {
        runDraftReview(streamedClause);
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Please try again.";
      fetch("/api/admin/output-quality/log-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          feature: "draft",
          model: "google/gemini-3-flash-preview",
          inputSnippet: prompt,
          errorMessage: errorMsg,
        }),
      }).catch(() => {});

      setDraftChatMessages((prev) => [
        ...prev.filter((message) => message.id !== typingMessageId && !(message.role === "assistant" && message.kind === "typing")),
        {
          id: `assistant-error-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: "assistant",
          kind: "error",
          content: `I could not complete the legal ${assistantMode === "draft" ? "draft update" : "analysis"} right now. ${errorMsg}`,
          createdAt: Date.now(),
        },
      ]);
      toast({
        title: "Failed to generate clause",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setGenerationStartTime(null);
      if (generationTimerRef.current) {
        clearInterval(generationTimerRef.current);
        generationTimerRef.current = null;
      }
    }
  };

  const exportAsTxt = () => {
    const text = editorRef.current?.getText() || docText;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draftTitle || "legal-draft"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported as TXT" });
  };

  const exportAsPdf = () => {
    const html = editorRef.current?.getPaginatedHTML() || editorHtml || docText;
    generateLegalPDF({
      html,
      title: draftTitle || "Untitled Draft",
      pageProfileId,
    });
    toast({ title: "Exported as PDF" });
  };

  const exportAsDoc = async () => {
    const content = editorRef.current?.getPaginatedHTML() || editorHtml || docText;
    try {
      await generateLegalDocx({
        html: content,
        title: draftTitle || "Untitled Draft",
        pageProfileId,
      });
      toast({ title: "Exported as Word (.docx)" });
    } catch (err: any) {
      console.error("DOCX export failed:", err);
      toast({
        title: "Export failed",
        description: err?.message || "Could not generate Word document.",
        variant: "destructive",
      });
    }
  };

  const shareDraft = async () => {
    // If draft is saved, create a shareable preview link
    if (selectedDraftId) {
      try {
        const response = await fetch("/api/legal-drafting/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            draftId: selectedDraftId,
            title: draftTitle,
            content: editorRef.current?.getHTML() || editorHtml || docText,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          const shareUrl = `${window.location.origin}/api/draft-preview/${data.shareToken}`;
          await navigator.clipboard.writeText(shareUrl);
          toast({ title: "Share link copied!", description: "Send this link to your client for draft approval." });
          return;
        }
      } catch {}
    }
    // Fallback: copy draft text
    const shareText = `${draftTitle}\n\n${docText}`;
    try {
      await navigator.clipboard.writeText(shareText);
      toast({ title: "Draft text copied to clipboard" });
    } catch {
      toast({ title: "Could not copy draft", variant: "destructive" });
    }
  };

  const shareWorkspaceLink = async () => {
    const link = `${window.location.origin}/legal-drafting`;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Workspace link copied" });
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" });
    }
  };

  useEffect(() => {
    const runBackfill = async () => {
      try {
        const lastRunRaw = localStorage.getItem(STYLE_MEMORY_BACKFILL_KEY);
        const lastRun = lastRunRaw ? Number(lastRunRaw) : 0;
        const now = Date.now();
        // Run at most once every 24h per browser profile.
        if (Number.isFinite(lastRun) && now - lastRun < 24 * 60 * 60 * 1000) return;
        const response = await fetch("/api/style-memory/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            module: "legal-drafting",
            scope: "user",
            limit: 50,
          }),
        });
        if (response.ok) {
          localStorage.setItem(STYLE_MEMORY_BACKFILL_KEY, String(now));
        }
      } catch {
        // Silent bootstrap path; user-facing drafting should not be interrupted.
      }
    };
    runBackfill();
  }, []);

  useEffect(() => {
    const el = chatListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [draftChatMessages[draftChatMessages.length - 1]?.content, isGenerating]);

  useEffect(() => {
    const dismissPopover = () => setChatSnippetPopover(null);
    window.addEventListener("scroll", dismissPopover, true);
    window.addEventListener("resize", dismissPopover);
    return () => {
      window.removeEventListener("scroll", dismissPopover, true);
      window.removeEventListener("resize", dismissPopover);
    };
  }, []);

  // Zen mode: hide AppShell sidebar/header for immersive drafting
  useEffect(() => {
    if (zenMode) {
      document.body.classList.add("legal-drafting-zen");
    } else {
      document.body.classList.remove("legal-drafting-zen");
    }
    return () => { document.body.classList.remove("legal-drafting-zen"); };
  }, [zenMode]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Escape exits zen mode
      if (e.key === "Escape" && zenMode) { setZenMode(false); e.preventDefault(); }
      // F11 or Ctrl/Cmd+Shift+F toggles zen mode
      if (e.key === "F11" || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f")) {
        e.preventDefault();
        setZenMode((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [zenMode]);

  return (
    <div className={`relative isolate overflow-hidden border bg-background text-foreground fade-in flex flex-col ${zenMode ? "fixed inset-0 z-[9999] rounded-none border-none" : "h-full min-h-[500px] md:min-h-[640px] rounded-xl border-border/70"}`}>
      <div className="pointer-events-none absolute -top-24 right-10 h-56 w-56 rounded-full bg-primary/8 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-8 h-60 w-60 rounded-full bg-primary/6 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.2) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <header className="h-9 border-b border-border/40 flex items-center justify-between px-2 md:px-3 bg-background/80 backdrop-blur-xl z-20 gap-1">
        {/* Left: branding + tabs inline */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="size-5 shrink-0 rounded bg-primary text-primary-foreground flex items-center justify-center">
              <Gavel size={10} />
            </div>
            <span className="text-[11px] font-bold tracking-tight hidden sm:inline">Legal Drafting</span>
          </div>
          <div className="hidden sm:block h-4 w-px bg-border/60 shrink-0" />
          {/* Inline tabs */}
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide min-w-0">
            {draftTabs.tabs.map((tab) => {
              const isActive = tab.id === draftTabs.activeTabId;
              return (
                <div
                  key={tab.id}
                  className={`group inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] cursor-pointer transition-all whitespace-nowrap max-w-[120px] ${
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/30 font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/50 border border-transparent"
                  }`}
                  onClick={() => {
                    if (!isActive) {
                      if (isGenerating) {
                        toast({ title: "Wait for drafting to finish before switching tabs." });
                        return;
                      }
                      snapshotActiveTab();
                      draftTabs.switchTab(tab.id);
                    }
                  }}
                >
                  {tab.isDirty && <span className="size-1 rounded-full bg-primary shrink-0" />}
                  <span className="truncate">{tab.title || "Untitled"}</span>
                  {draftTabs.tabs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isGenerating) {
                          toast({ title: "Wait for drafting to finish before closing tabs." });
                          return;
                        }
                        draftTabs.closeTab(tab.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 shrink-0 transition-opacity"
                    >
                      <Trash2 size={8} />
                    </button>
                  )}
                </div>
              );
            })}
            {draftTabs.tabs.length < 5 && (
              <button
                onClick={() => {
                  if (isGenerating) {
                    toast({ title: "Wait for drafting to finish before opening another tab." });
                    return;
                  }
                  snapshotActiveTab();
                  draftTabs.addTab({ title: "Untitled Draft" });
                }}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all shrink-0"
                title="New draft tab (max 5)"
              >
                <Plus size={9} />
              </button>
            )}
          </div>
          {/* Save status badge */}
          <div className={`hidden md:flex items-center gap-1 px-1 py-0.5 rounded text-[7px] uppercase font-bold tracking-wider shrink-0 ${workspaceSyncStatus === "error" ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"}`}>
            <Sparkles size={7} />
            {workspaceSyncStatus === "error"
              ? "Cloud sync failed"
              : workspaceSyncStatus === "saving" || !isSavedLocal
                ? "Saving..."
                : "✓ Auto-saved"}
          </div>
        </div>

        {/* Right: panel toggles + export buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/40 text-amber-400 hover:from-amber-500/30 hover:to-amber-600/20 hover:border-amber-400/60 hover:text-amber-300 text-xs font-semibold transition-all duration-200 shadow-[0_0_8px_rgba(245,158,11,0.15)] hover:shadow-[0_0_14px_rgba(245,158,11,0.25)]"
            onClick={() => setShowTutorial(true)}
            title="How to use Legal Drafting"
          >
            <CircleHelp size={14} />
            <span>Tutorial</span>
          </button>
          <div className="hidden md:flex items-center gap-0.5">
            <button
              className="h-6 w-6 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center"
              onClick={() => { setFocusWritingMode(false); setLeftRailOpen((v) => !v); }}
              title={leftRailVisible ? "Hide workspace" : "Show workspace"}
            >
              {leftRailVisible ? <PanelLeftClose size={11} /> : <PanelLeftOpen size={11} />}
            </button>
            <button
              className="h-6 w-6 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center"
              onClick={() => setFocusWritingMode((v) => !v)}
              title={focusWritingMode ? "Exit focus mode" : "Focus mode"}
            >
              {focusWritingMode ? <Minimize2 size={11} /> : <Focus size={11} />}
            </button>
            <button
              className="hidden lg:flex h-6 w-6 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent items-center justify-center"
              onClick={() => { setFocusWritingMode(false); setRightRailOpen((v) => !v); }}
              title={rightRailVisible ? "Hide AI panel" : "Show AI panel"}
            >
              {rightRailVisible ? <PanelRightClose size={11} /> : <PanelRightOpen size={11} />}
            </button>
            {/* Zen / fullscreen mode */}
            <button
              className={`h-6 w-6 rounded border flex items-center justify-center transition-all ${zenMode ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"}`}
              onClick={() => setZenMode((v) => !v)}
              title={zenMode ? "Exit fullscreen (Esc)" : "Fullscreen mode (F11)"}
            >
              <Maximize2 size={11} />
            </button>
          </div>
          <div className="hidden md:block h-4 w-px bg-border" />
          <div className="hidden lg:flex items-center -space-x-1.5">
            {collaborators.map((c, idx) => (
              <div key={`${c}-${idx}`} className="size-5 rounded border border-primary/30 bg-primary/10 text-foreground flex items-center justify-center text-[8px] font-bold">{c}</div>
            ))}
          </div>
          <Button variant="outline" className="h-6 px-1.5 text-[10px] border-border text-muted-foreground hover:text-foreground" onClick={shareDraft}>
            <Share2 size={10} className="mr-0.5" />Share
          </Button>
          <Button variant="outline" className="h-6 px-1.5 text-[10px] border-border text-muted-foreground hover:text-foreground" onClick={exportAsTxt}>
            TXT
          </Button>
          <Button className="h-6 px-1.5 text-[10px] bg-red-700/90 text-white hover:bg-red-700 font-bold" onClick={exportAsPdf}>
            PDF
          </Button>
          <Button className="h-6 px-1.5 text-[10px] bg-primary text-primary-foreground hover:bg-primary font-bold" onClick={exportAsDoc}>
            Word
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside data-tutorial="workspace"
          className={`hidden md:flex transition-[width] duration-300 ease-out overflow-hidden ${
            leftRailVisible
              ? "w-48 border-r border-[hsl(var(--preview-border))] bg-background/45 backdrop-blur-xl"
              : "w-0 border-r-0"
          }`}
        >
          <div className="w-48 flex flex-col py-2">
          <div className="hidden md:flex items-center justify-between px-2.5 pb-2 border-b border-[hsl(var(--preview-border))]">
            <p className="text-[10px] uppercase tracking-widest text-primary font-bold">Workspace</p>
            <Button
              size="sm"
              className="inline-flex h-6 items-center justify-center gap-1 px-2 text-[10px] bg-primary text-primary-foreground hover:bg-primary shadow-sm"
              onClick={startNewDraftingChat}
            >
              <Plus size={10} className="shrink-0" />
              New
            </Button>
          </div>

          <div className="flex md:hidden flex-col items-center gap-3 pt-4">
            <button onClick={() => setActiveLeftTool("drafts")} className={`p-2.5 rounded-xl border ${activeLeftTool === "drafts" ? "text-primary border-primary/40 bg-primary/10" : "text-muted-foreground border-border bg-card/40"}`}><FolderOpen size={18} /></button>
            <button onClick={() => setActiveLeftTool("templates")} className={`p-2.5 rounded-xl border ${activeLeftTool === "templates" ? "text-primary border-primary/40 bg-primary/10" : "text-muted-foreground border-border bg-card/40"}`}><FileText size={18} /></button>
            <button onClick={() => { setActiveLeftTool("collab"); shareWorkspaceLink(); }} className={`p-2.5 rounded-xl border ${activeLeftTool === "collab" ? "text-primary border-primary/40 bg-primary/10" : "text-muted-foreground border-border bg-card/40"}`}><Users size={18} /></button>
            <button onClick={() => { setActiveLeftTool("archive"); window.location.href = "/case-documents"; }} className={`p-2.5 rounded-xl border ${activeLeftTool === "archive" ? "text-primary border-primary/40 bg-primary/10" : "text-muted-foreground border-border bg-card/40"}`}><Archive size={18} /></button>
          </div>

          <div className="hidden md:flex flex-col px-2 pt-2 gap-1">
            <button
              onClick={() => setActiveLeftTool("drafts")}
              className={`w-full flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] uppercase tracking-wide ${
                activeLeftTool === "drafts" ? "bg-primary/12 text-foreground border border-primary/35" : "text-foreground hover:bg-card/60 border border-transparent hover:border-border"
              }`}
            >
              <FolderOpen size={13} /> Drafts
            </button>
            <button
              onClick={() => setActiveLeftTool("templates")}
              className={`w-full flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] uppercase tracking-wide ${
                activeLeftTool === "templates" ? "bg-primary/12 text-foreground border border-primary/35" : "text-foreground hover:bg-card/60 border border-transparent hover:border-border"
              }`}
            >
              <FileText size={13} /> Templates
            </button>
            <button
              onClick={() => {
                setActiveLeftTool("collab");
                shareWorkspaceLink();
              }}
              className={`w-full flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] uppercase tracking-wide ${
                activeLeftTool === "collab" ? "bg-primary/12 text-foreground border border-primary/35" : "text-foreground hover:bg-card/60 border border-transparent hover:border-border"
              }`}
            >
              <Users size={13} /> Collab
            </button>
            <button
              onClick={() => {
                setActiveLeftTool("archive");
                window.location.href = "/case-documents";
              }}
              className={`w-full flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] uppercase tracking-wide ${
                activeLeftTool === "archive" ? "bg-primary/12 text-foreground border border-primary/35" : "text-foreground hover:bg-card/60 border border-transparent hover:border-border"
              }`}
            >
              <Archive size={13} /> Archive
            </button>
          </div>

          <div className="hidden md:flex flex-1 min-h-0 px-2 pt-2">
            {activeLeftTool === "templates" ? (
              <TemplatesPanel onApply={applyTemplate} />
            ) : (
              <div className="w-full overflow-auto space-y-2">
                {loadingDocs ? (
                  <p className="text-xs text-muted-foreground">Loading drafts...</p>
                ) : draftDocuments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No saved legal drafts yet.</p>
                ) : (
                  draftDocuments.map((doc) => {
                    const active = selectedDraftId === doc.id;
                    return (
                      <div
                        key={doc.id}
                        className={`rounded-lg border p-1.5 ${
                          active ? "border-primary/40 bg-primary/10" : "border-border bg-card/20"
                        }`}
                      >
                        <button className="w-full text-left" onClick={() => loadDraft(doc)}>
                          <p className="text-[11px] font-semibold text-foreground line-clamp-1">
                            {doc.title.replace(`${DRAFT_TITLE_PREFIX} `, "")}
                          </p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">
                            {doc.createdAt ? new Date(doc.createdAt).toLocaleString() : "Unknown date"}
                          </p>
                        </button>
                        <div className="mt-1 flex justify-end">
                          <button
                            onClick={() => deleteDraftMutation.mutate(doc.id)}
                            className="text-muted-foreground hover:text-red-400"
                            title="Delete draft"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="hidden md:block mt-auto px-2 pt-2 pb-1 border-t border-[hsl(var(--preview-border))]">
            <p className="text-[8px] uppercase tracking-[0.18em] text-muted-foreground font-black">v2.1</p>
          </div>
          </div>
        </aside>

        <div className={`${focusWritingMode ? "hidden" : "hidden md:flex"} items-stretch`}>
          <button
            onClick={() => setLeftRailOpen((v) => !v)}
            className="h-full w-6 border-r border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center transition-all"
            data-testid="divider-toggle-left-rail"
            title={leftRailVisible ? "Collapse workspace panel" : "Expand workspace panel"}
            aria-label={leftRailVisible ? "Collapse workspace panel" : "Expand workspace panel"}
          >
            {leftRailVisible ? <ChevronLeft size={15} className="drop-shadow" /> : <ChevronRight size={15} className="drop-shadow" />}
          </button>
        </div>

        <main className="flex-1 flex flex-col bg-background/50 overflow-hidden">
          <div className="md:hidden border-b border-[hsl(var(--preview-border))] bg-background/45 px-3 py-2 flex items-center gap-2 overflow-x-auto">
            <button onClick={() => setActiveLeftTool("drafts")} className={`shrink-0 px-2.5 py-1.5 rounded-md text-[11px] border ${activeLeftTool === "drafts" ? "text-primary border-primary/40 bg-primary/10" : "text-foreground border-border bg-card/40"}`}>Drafts</button>
            <button onClick={() => setActiveLeftTool("templates")} className={`shrink-0 px-2.5 py-1.5 rounded-md text-[11px] border ${activeLeftTool === "templates" ? "text-primary border-primary/40 bg-primary/10" : "text-foreground border-border bg-card/40"}`}>Templates</button>
            <button onClick={() => shareWorkspaceLink()} className="shrink-0 px-2.5 py-1.5 rounded-md text-[11px] border text-foreground border-border bg-card/40">Share</button>
            <button onClick={() => (window.location.href = "/case-documents")} className="shrink-0 px-2.5 py-1.5 rounded-md text-[11px] border text-foreground border-border bg-card/40">Archive</button>
          </div>
          <div className="md:hidden px-3 py-2 border-b border-[hsl(var(--preview-border))] bg-background/30">
            {activeLeftTool === "templates" ? (
              <div className="max-h-28 overflow-auto space-y-1.5">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => applyTemplate(template)}
                    className="w-full text-left rounded-lg border border-border/70 bg-card/45 p-2"
                  >
                    <p className="text-xs font-semibold text-foreground">{template.title}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="max-h-28 overflow-auto space-y-1.5">
                {draftDocuments.slice(0, 6).map((doc) => (
                  <button
                    key={doc.id}
                    className="w-full text-left rounded-lg border border-border/70 bg-card/45 p-2"
                    onClick={() => loadDraft(doc)}
                  >
                    <p className="text-xs font-semibold text-foreground line-clamp-1">
                      {doc.title.replace(`${DRAFT_TITLE_PREFIX} `, "")}
                    </p>
                  </button>
                ))}
                {!loadingDocs && draftDocuments.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">No saved legal drafts yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Compact title + save + fee calc row */}
          <div className="flex items-center gap-1.5 px-2 md:px-3 py-1 border-b border-border/30 bg-background/30">
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="h-6 w-full sm:w-[160px] bg-card/45 border border-border rounded px-2 text-[11px] text-foreground"
              placeholder="Draft title"
            />
            <Button
              className="h-6 px-2 text-[10px] bg-primary text-primary-foreground hover:bg-primary font-semibold"
              onClick={saveDraft}
              disabled={saveDraftMutation.isPending}
            >
              <Save size={10} className="mr-0.5" />
              {saveDraftMutation.isPending ? "..." : "Save"}
            </Button>
            <button
              type="button"
              onClick={() => setFeeCalcOpen(true)}
              className="h-6 px-1.5 rounded border border-border bg-card/40 text-foreground hover:border-primary/40 text-[9px] font-semibold flex items-center gap-0.5"
              title="Calculate court fee per Court Fees Act 1870"
            >
              <Calculator size={10} />
              Fee
            </button>
            <span className="text-[9px] text-muted-foreground hidden md:inline ml-auto">
              {selectedDraftId ? `#${selectedDraftId}` : ""}
            </span>
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            {/* ── Tiptap Legal Editor ── */}
            <div data-tutorial="editor" className={`${chatState === "expanded" ? "h-0 overflow-hidden" : "flex-1 min-h-0 overflow-hidden border-b border-[hsl(var(--preview-border))]"} flex flex-col transition-all duration-300`}>
              <LegalEditor
                ref={editorRef}
                initialContent={editorHtml}
                onUpdate={onEditorUpdate}
                placeholder="Begin drafting or load a template…"
                className="flex-1 min-h-0 flex flex-col"
                pageProfileId={pageProfileId || DEFAULT_LEGAL_PAGE_PROFILE_ID}
                onPageProfileChange={setPageProfileId}
              />
            </div>

            {/* ── Chat section (below editor) ── */}
            <div data-tutorial="ai-engine" className={`${chatState === "expanded" ? "flex-1 min-h-0" : chatState === "minimized" ? "h-[40px]" : "h-[260px] lg:h-[300px]"} shrink-0 flex flex-col overflow-hidden transition-all duration-300`}>
            <div className="h-full w-full rounded-xl border border-border bg-background/72 backdrop-blur-xl flex flex-col overflow-hidden">
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="px-3 py-1.5 border-b border-border bg-background/25 flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-primary font-bold">Drafting Chat</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-muted-foreground">{draftChatMessages.length} msgs</span>
                    {chatState !== "minimized" && (
                      <button
                        type="button"
                        onClick={() => setChatState("minimized")}
                        className="inline-flex items-center justify-center size-7 rounded-md border border-border bg-card/50 hover:bg-primary/15 hover:border-primary/40 text-muted-foreground hover:text-primary transition-all"
                        title="Minimize chat"
                      >
                        <ChevronDown size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setChatState(prev => prev === "expanded" ? "default" : prev === "minimized" ? "default" : "expanded")}
                      className="inline-flex items-center justify-center size-7 rounded-md border border-border bg-card/50 hover:bg-primary/15 hover:border-primary/40 text-muted-foreground hover:text-primary transition-all"
                      title={chatState === "expanded" ? "Restore chat" : chatState === "minimized" ? "Restore chat" : "Expand chat"}
                    >
                      {chatState === "expanded" ? <Minimize2 size={15} /> : chatState === "minimized" ? <ChevronUp size={16} /> : <Maximize2 size={15} />}
                    </button>
                  </div>
                </div>

                {chatState !== "minimized" && (<>
                <div
                  ref={chatListRef}
                  className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3"
                  onMouseUp={handleChatSelectionMouseUp}
                >
                  {draftChatMessages.map((message) => (
                    <div
                      key={message.id}
                      data-chat-message-role={message.role}
                      className={`rounded-xl border px-3 py-2 ${
                        message.role === "user"
                          ? "ml-8 border-primary/35 bg-primary/10"
                          : message.kind === "error"
                              ? "mr-8 border-rose-500/35 bg-rose-500/10"
                              : "mr-8 border-border bg-card/45"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${message.role === "user" ? "text-foreground" : "text-foreground"}`}>
                          {message.role === "user"
                            ? "You"
                            : message.kind === "typing"
                              ? `AI Drafting Assistant · Writing${isGenerating && generationElapsed > 0 ? ` ${Math.floor(generationElapsed / 60)}:${String(generationElapsed % 60).padStart(2, "0")}` : ""}`
                              : message.kind === "clarification"
                                ? "AI Drafting Assistant · Clarification"
                                : "AI Drafting Assistant"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{new Date(message.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p
                        data-chat-selectable={message.role === "assistant" ? "true" : "false"}
                        className={`text-[12px] whitespace-pre-wrap leading-relaxed ${message.kind === "typing" ? "text-foreground animate-pulse" : "text-foreground"}`}
                      >
                        {message.content}
                      </p>
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {message.attachments.map((name, idx) => (
                            <span key={`${message.id}-file-${idx}`} className="inline-flex items-center rounded-md border border-primary/35 bg-primary/10 px-1.5 py-0.5 text-[10px] text-foreground">
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* R2: Clarification buttons */}
                      {message.kind === "clarification" && message.suggestedTypes && message.suggestedTypes.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.suggestedTypes.map((st) => (
                            <button
                              key={`${message.id}-type-${st.key}`}
                              type="button"
                              disabled={isGenerating}
                              onClick={() => {
                                generateClause(message.originalPrompt || "", st.key);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-primary/20 hover:border-primary/60 transition-colors disabled:opacity-50"
                            >
                              <Gavel size={11} />
                              {st.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {chatSnippetPopover && (
                  <div
                    className="fixed z-[70] -translate-x-1/2 rounded-md border border-primary/45 bg-background/95 px-2 py-1 shadow-xl backdrop-blur"
                    style={{ left: chatSnippetPopover.x, top: chatSnippetPopover.y }}
                  >
                    <button
                      type="button"
                      onClick={applyChatSnippetSelection}
                      className="text-[10px] font-bold uppercase tracking-wide text-foreground hover:text-foreground"
                    >
                      Select Snippet
                    </button>
                  </div>
                )}

                <div className="mx-3 mb-3 mt-2 rounded-xl border border-[hsl(var(--preview-border))] px-3 py-2 space-y-2 bg-background/75 backdrop-blur-xl pb-[max(env(safe-area-inset-bottom),0.6rem)]">
                  <div>
                    <input
                      ref={aiContextInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.docm,.dotx,.txt"
                      multiple
                      className="hidden"
                      onChange={onAiContextFilesSelected}
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => aiContextInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-card/40 text-[11px] text-foreground hover:border-primary/40 hover:text-foreground"
                      >
                        <Paperclip size={12} />
                        Attach Context Files
                      </button>
                      <button
                        type="button"
                        onClick={() => setCaseFileImportOpen(true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-card/40 text-[11px] text-foreground hover:border-primary/40 hover:text-foreground"
                      >
                        <FolderOpen size={12} />
                        Import from Case
                      </button>
                      {voice.isSupported && (
                        voice.isRecording ? (
                          <div className="inline-flex items-center gap-2">
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
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-red-500/50 bg-red-500/15 text-[11px] text-red-400 hover:bg-red-500/25 animate-pulse"
                            >
                              <Square size={10} fill="currentColor" />
                              Stop · {formatDuration(voice.duration)}
                            </button>
                            <button
                              type="button"
                              onClick={() => voice.cancelRecording()}
                              className="text-[10px] text-muted-foreground hover:text-foreground"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : voice.isTranscribing ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-primary/30 bg-primary/10 text-[11px] text-primary">
                            <Loader2 size={12} className="animate-spin" />
                            Transcribing...
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => voice.startRecording()}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-card/40 text-[11px] text-foreground hover:border-primary/40 hover:text-primary"
                            title="Record voice note — dictate instructions"
                          >
                            <Mic size={12} />
                            Voice
                          </button>
                        )
                      )}
                      <span className="text-[10px] text-muted-foreground">PDF, DOC/DOCX/DOCM/DOTX, TXT · up to 5 files</span>
                    </div>
                    {voice.error && (
                      <p className="text-[10px] text-red-400 mt-1">{voice.error}</p>
                    )}
                    {aiContextFiles.length > 0 && (
                      <div className="mt-2 space-y-1.5 max-h-24 overflow-y-auto pr-1">
                        {aiContextFiles.map((file, idx) => (
                          <div key={`${file.name}-${idx}`} className="flex items-center justify-between rounded-md border border-border/70 bg-background/70 px-2 py-1">
                            <span className="text-[11px] text-foreground truncate pr-2">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => setAiContextFiles((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-[10px] text-rose-300 hover:text-rose-200"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {hasSelectedSnippet && (
                    <div className="rounded-md border border-primary/35 bg-primary/10 px-2 py-1.5 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-foreground">
                        Edit-only snippet selected ({selectedDraftSnippet.trim().length} chars)
                      </p>
                      <button
                        type="button"
                        onClick={clearSelectedDraftText}
                        className="text-[10px] font-bold text-foreground hover:text-foreground"
                      >
                        Clear
                      </button>
                    </div>
                  )}

                  <div className="relative">
                    <Textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        if (e.shiftKey || e.nativeEvent.isComposing) return;
                        e.preventDefault();
                        if (isGenerating || !aiPrompt.trim()) return;
                        void generateClause();
                      }}
                      className="w-full bg-card/50 border border-border rounded-xl p-3 pr-12 text-sm focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary outline-none resize-none placeholder:text-muted-foreground"
                      placeholder="Describe what to draft, amend, or improve in Pakistani court format..."
                      rows={2}
                      data-testid="textarea-ai-draft-prompt"
                    />
                    <button
                      className="absolute bottom-2.5 right-2.5 size-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm disabled:opacity-50"
                      onClick={() => generateClause()}
                      disabled={isGenerating || !aiPrompt.trim()}
                      data-testid="button-send-ai-draft-prompt"
                    >
                      {isGenerating ? <Search size={13} className="animate-spin" /> : <ArrowRight size={14} />}
                    </button>
                  </div>
                </div>
              </>)}
              </div>
            </div>
            </div>
          </div>
        </main>

        <div className={`${focusWritingMode ? "hidden" : "hidden lg:flex"} items-stretch`}>
          <button
            onClick={() => setRightRailOpen((v) => !v)}
            className="h-full w-6 border-l border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center transition-all"
            data-testid="divider-toggle-right-rail"
            title={rightRailVisible ? "Collapse AI panel" : "Expand AI panel"}
            aria-label={rightRailVisible ? "Collapse AI panel" : "Expand AI panel"}
          >
            {rightRailVisible ? <ChevronRight size={15} className="drop-shadow" /> : <ChevronLeft size={15} className="drop-shadow" />}
          </button>
        </div>

        <aside
          data-tutorial="ai-panel"
          className={`hidden lg:flex transition-[width] duration-300 ease-out overflow-hidden ${
            rightRailVisible
              ? "w-[260px] xl:w-[280px] border-l border-[hsl(var(--preview-border))] bg-background/45 backdrop-blur-xl"
              : "w-0 border-l-0"
          }`}
        >
          <div className="w-[260px] xl:w-[280px] flex flex-col">
          <div className="p-2.5 border-b border-[hsl(var(--preview-border))] bg-background/35 backdrop-blur-xl flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="size-6 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center">
                {rightRailTab === "history" ? <Clock size={12} className="text-primary" /> : <Bot size={12} className="text-primary" />}
              </div>
              <h3 className="font-bold text-xs tracking-wide uppercase">{rightRailTab === "history" ? "Version History" : "AI Assistant"}</h3>
            </div>
            <div className="flex items-center gap-1">
              {rightRailTab === "history" ? (
                <button
                  onClick={() => setRightRailTab("ai")}
                  className="px-1.5 py-0.5 rounded-full bg-card/50 text-foreground text-[8px] font-bold border border-border hover:border-primary/30"
                >
                  ← AI
                </button>
              ) : (
                <button
                  onClick={() => setRightRailTab("history")}
                  className="px-1.5 py-0.5 rounded-full bg-card/50 text-foreground text-[8px] font-bold border border-border hover:border-primary/30"
                >
                  History →
                </button>
              )}
              <div className="px-1.5 py-0.5 rounded-full bg-primary/20 text-foreground text-[8px] font-bold border border-primary/30">PRO</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
            {rightRailTab === "history" ? (
              <DraftHistoryPanel
                snapshots={draftHistory.snapshots}
                currentText={editorRef.current?.getText() || docText}
                onRestore={(snap) => {
                  setEditorContent(snap.html);
                  toast({ title: "Version restored", description: `Restored to "${snap.title}"` });
                }}
                onDelete={(id) => draftHistory.deleteSnapshot(id)}
                onClearAll={() => {
                  draftHistory.clearHistory();
                  toast({ title: "History cleared" });
                }}
              />
            ) : (
            <>
            <section>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Controls</label>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Ask questions without changing the draft, or name/select an exact part for a bounded edit. Full rewrites happen only when explicitly requested.
              </p>
              {styleMemoryMeta && (
                <div className="mt-2 rounded-lg border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] text-foreground">
                  Style memory: {styleMemoryMeta.applied ? "applied" : "not applied"} · confidence {Math.round((styleMemoryMeta.confidence || 0) * 100)}%
                </div>
              )}
            </section>

            <div data-tutorial="style-memory"><StyleMemoryPanel module="legal-drafting" /></div>

            {showDraftReviewPanel && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Draft Review</label>
                  <button
                    onClick={() => runDraftReview()}
                    className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-bold"
                    data-testid="button-refresh-draft-review"
                  >
                    {recommendLoading ? "Reviewing..." : `${recommendations.length} Changes`}
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-primary">AI Recommended Changes</p>
                      <span className="text-[10px] font-bold text-primary">{recommendations.length}</span>
                    </div>
                    <div className="space-y-2">
                      {recommendations.length === 0 ? (
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                          <p className="text-[11px] text-foreground">No AI text changes suggested yet.</p>
                        </div>
                      ) : (
                        recommendations.map((edit) => (
                          <div
                            key={edit.id}
                            className="w-full p-3 rounded-lg border border-primary/20 bg-primary/5"
                            data-testid={`recommendation-item-${edit.id}`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedRecommendationId((prev) => (prev === edit.id ? null : edit.id));
                              }}
                              className="w-full text-left"
                              data-testid={`button-toggle-recommendation-${edit.id}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="text-xs font-bold text-foreground">{edit.title}</h4>
                                <span
                                  className={`text-[10px] font-bold uppercase ${
                                    edit.impact === "high" ? "text-red-300" : edit.impact === "low" ? "text-emerald-300" : "text-primary"
                                  }`}
                                >
                                  {edit.impact} impact
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-normal mt-1">{edit.reason}</p>
                            </button>
                            {expandedRecommendationId === edit.id && (
                              <>
                                {edit.originalSnippet ? (
                                  <div className="mt-2 rounded border border-rose-500/30 bg-rose-500/10 p-2">
                                    <p className="text-[10px] font-bold text-rose-200 uppercase tracking-wider mb-1">Before</p>
                                    <p className="text-[11px] text-foreground whitespace-pre-wrap">{edit.originalSnippet}</p>
                                  </div>
                                ) : null}
                                <div className="mt-2 rounded border border-emerald-500/30 bg-emerald-500/10 p-2">
                                  <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider mb-1">After</p>
                                  <p className="text-[11px] text-emerald-100 whitespace-pre-wrap">{edit.suggestedText}</p>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  <button
                                    onClick={() => applyRecommendedChange(edit)}
                                    className="px-2 py-1 rounded bg-primary text-primary-foreground text-[10px] font-bold hover:bg-primary"
                                    data-testid={`button-apply-recommendation-${edit.id}`}
                                  >
                                    OK, Apply Change
                                  </button>
                                  <button
                                    onClick={() => dismissRecommendation(edit.id)}
                                    className="px-2 py-1 rounded border border-border text-foreground text-[10px] font-bold hover:border-primary/35 hover:text-foreground"
                                    data-testid={`button-dismiss-recommendation-${edit.id}`}
                                  >
                                    Not Okay
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section data-tutorial="references">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Verified References</label>
                {isResolvingReferences && <Loader2 size={12} className="animate-spin text-primary" />}
              </div>

              {!hasDraftInSession || !docText.trim() ? (
                <div className="rounded-lg border border-border/70 bg-card/20 p-2.5">
                  <p className="text-[11px] text-muted-foreground">
                    No draft generated in this chat yet. References will appear after AI drafts or you load a draft/template.
                  </p>
                </div>
              ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-border/70 bg-card/20 p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Statute References</p>
                  {draftReferences.statutes.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">No verified statute sections found in this draft yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {draftReferences.statutes.map((item, idx) => (
                        <button
                          key={`${item.statuteName}-${item.sectionLabel}-${idx}`}
                          type="button"
                          onClick={() => openStatuteReference(item)}
                          className="w-full flex items-center justify-between rounded-lg border border-border bg-background/70 px-2.5 py-2 text-left hover:border-primary/30 transition-colors disabled:opacity-60"
                          disabled={!item.viewUrl}
                          data-testid={`statute-ref-${item.statuteName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${idx}`}
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <BookOpen size={14} className="text-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-foreground truncate">{item.statuteName}</p>
                              <p className="text-[10px] text-primary truncate">{item.sectionLabel}</p>
                            </div>
                          </div>
                          <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border/70 bg-card/20 p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Case Law Citations</p>
                  {draftReferences.caseLaw.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">No verified case citations linked to internal judgments yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {draftReferences.caseLaw.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openCaseSourceDocument(item)}
                          disabled={!item.hasSource || activeCaseSourceId === item.id}
                          className="w-full flex items-center justify-between rounded-lg border border-border bg-background/70 px-2.5 py-2 text-left hover:border-primary/30 transition-colors disabled:opacity-60"
                          data-testid={`case-ref-${item.id}`}
                        >
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-foreground truncate">{item.citation}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{item.title}</p>
                          </div>
                          {activeCaseSourceId === item.id ? (
                            <Loader2 size={12} className="animate-spin text-primary shrink-0" />
                          ) : (
                            <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {draftReferences.removedCaseCitations.length > 0 && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-rose-200 mb-1">Blocked Citations</p>
                    <p className="text-[11px] text-rose-100">
                      Removed because they were not found in the internal Knowledge Base:
                    </p>
                    <p className="text-[10px] text-rose-200 mt-1 break-words">
                      {draftReferences.removedCaseCitations.join(" | ")}
                    </p>
                  </div>
                )}

                {draftReferences.unresolvedStatutes.length > 0 && (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-foreground mb-1">Unresolved Statutes</p>
                    <p className="text-[11px] text-foreground">
                      Detected in text but not yet linked to a statute document:
                    </p>
                    <p className="text-[10px] text-foreground mt-1 break-words">
                      {draftReferences.unresolvedStatutes
                        .map((item) => `${item.sectionLabel} (${item.statuteName})`)
                        .join(" | ")}
                    </p>
                  </div>
                )}
              </div>
              )}
            </section>
            </>
            )}
          </div>
          </div>
        </aside>
      </div>

      {caseSourceDoc?.found && caseSourceDoc.content && (
        <DocumentViewer
          title={caseSourceDoc.title || "Case Law Source"}
          filename={caseSourceDoc.filename}
          content={caseSourceDoc.content}
          sourceLabel="Knowledge Base Source"
          onClose={() => setCaseSourceDoc(null)}
        />
      )}

      <CourtFeeCalculator
        open={feeCalcOpen}
        onClose={() => setFeeCalcOpen(false)}
        onInsert={(text) => {
          // Append the fee paragraph to the end of the doc.
          const feeHtml = plainTextToTiptapHTML(text);
          editorRef.current?.insertContent(feeHtml);
          toast({ title: "Court fee inserted", description: "Paragraph appended to the draft." });
        }}
      />

      <CaseFileImportModal
        open={caseFileImportOpen}
        onClose={() => setCaseFileImportOpen(false)}
        onImport={(files) => {
          setAiContextFiles(prev => {
            const combined = [...prev, ...files];
            return combined.slice(0, 5);
          });
          setCaseFileImportOpen(false);
          toast({ title: `${files.length} case document${files.length > 1 ? 's' : ''} imported` });
        }}
      />
      <TutorialCards open={showTutorial} onOpenChange={setShowTutorial} moduleName="Legal Drafting" />
    </div>
  );
}

export default function LegalDraftingPage() {
  useDocumentHead({
    title: "Legal Drafting — Court-Ready Petitions & Applications",
    description: "Draft writ petitions, applications, and court documents under Pakistani law. AI-assisted drafting with verified case-law citations and multi-document tabs.",
    path: "/legal-drafting",
  });
  return (
    <DraftTabsProvider>
      <LegalDraftingPageInner />
    </DraftTabsProvider>
  );
}
