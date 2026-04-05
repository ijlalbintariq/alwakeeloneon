import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
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
  AlertTriangle,
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
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { api } from "@shared/routes";
import type { Document as DraftDocument } from "@shared/schema";
import { StyleMemoryPanel } from "@/components/style-memory-panel";
import { DocumentViewer } from "@/components/document-viewer";

type DraftRecommendation = {
  id: string;
  title: string;
  reason: string;
  originalSnippet: string;
  suggestedText: string;
  impact: "high" | "medium" | "low";
};

type DraftSuggestion = {
  id: string;
  title: string;
  detail: string;
  severity: "warning" | "danger";
  prompt: string;
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

type DraftTemplate = {
  id: string;
  title: string;
  body: string;
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
  createdAt: number;
};

type StyleMemoryMeta = {
  applied: boolean;
  module: "legal-drafting" | "contract-drafting" | null;
  scopeUsed: "user" | "org" | "user-org";
  chunksUsed: number;
  confidence: number;
};

const AUTOSAVE_KEY = "legal-drafting-workspace-v2";
const CONTEXT_MEMORY_KEY = "legal-drafting-context-memory-v1";
const STYLE_MEMORY_BACKFILL_KEY = "legal-drafting-style-backfill-v1";
const DRAFT_TITLE_PREFIX = "Legal Draft:";

const DEFAULT_DOC = "";
const LEGACY_DEFAULT_DOC_PREFIX = "IN THE COURT OF THE CIVIL JUDGE";

function createEmptyLegalDraftReferences(): LegalDraftReferencesPayload {
  return {
    caseLaw: [],
    statutes: [],
    removedCaseCitations: [],
    unresolvedStatutes: [],
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

const TEMPLATES: DraftTemplate[] = [
  {
    id: "civil-suit",
    title: "Civil Suit (Plaint)",
    body: CIVIL_SUIT_TEMPLATE,
  },
  {
    id: "civil-misc-application",
    title: "Civil Misc. Application",
    body: CIVIL_MISC_APPLICATION_TEMPLATE,
  },
  {
    id: "criminal-misc-application",
    title: "Criminal Misc. Application",
    body: CRIMINAL_MISC_APPLICATION_TEMPLATE,
  },
  {
    id: "temporary-injunction-application",
    title: "Temporary Injunction Application",
    body: TEMPORARY_INJUNCTION_TEMPLATE,
  },
  {
    id: "execution-application",
    title: "Execution Application",
    body: EXECUTION_APPLICATION_TEMPLATE,
  },
  {
    id: "sessions-bail",
    title: "Sessions Court Bail Application",
    body: SESSIONS_BAIL_TEMPLATE,
  },
  {
    id: "sessions-pre-arrest-bail",
    title: "Sessions Pre-Arrest Bail",
    body: SESSIONS_PRE_ARREST_BAIL_TEMPLATE,
  },
  {
    id: "sessions-criminal-appeal",
    title: "Sessions Criminal Appeal",
    body: SESSIONS_CRIMINAL_APPEAL_TEMPLATE,
  },
  {
    id: "sessions-criminal-revision",
    title: "Sessions Criminal Revision",
    body: SESSIONS_CRIMINAL_REVISION_TEMPLATE,
  },
  {
    id: "family-suit-petition",
    title: "Family Suit / Petition",
    body: FAMILY_SUIT_TEMPLATE,
  },
  {
    id: "high-court-writ",
    title: "High Court Writ Petition",
    body: HIGH_COURT_WRIT_TEMPLATE,
  },
  {
    id: "high-court-appeal",
    title: "High Court Civil Appeal",
    body: HIGH_COURT_APPEAL_TEMPLATE,
  },
  {
    id: "high-court-criminal-appeal",
    title: "High Court Criminal Appeal",
    body: HIGH_COURT_CRIMINAL_APPEAL_TEMPLATE,
  },
  {
    id: "high-court-criminal-revision",
    title: "High Court Criminal Revision",
    body: HIGH_COURT_CRIMINAL_REVISION_TEMPLATE,
  },
  {
    id: "high-court-bba",
    title: "High Court Bail Before Arrest",
    body: HIGH_COURT_BBA_TEMPLATE,
  },
  {
    id: "supreme-cpla",
    title: "Supreme Court CPLA",
    body: SUPREME_CPLA_TEMPLATE,
  },
  {
    id: "supreme-criminal-petition",
    title: "Supreme Court Criminal Petition for Leave to Appeal",
    body: SUPREME_CRIMINAL_PETITION_TEMPLATE,
  },
];

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

export default function LegalDraftingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const aiContextInputRef = useRef<HTMLInputElement | null>(null);

  const [docText, setDocText] = useState(DEFAULT_DOC);
  const [draftTitle, setDraftTitle] = useState("Untitled Draft");
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavedLocal, setIsSavedLocal] = useState(true);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskResults, setRiskResults] = useState<DraftSuggestion[]>([]);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<DraftRecommendation[]>([]);
  const [aiContextFiles, setAiContextFiles] = useState<File[]>([]);
  const [activeLeftTool, setActiveLeftTool] = useState<"drafts" | "templates" | "collab" | "archive">("drafts");
  const [leftRailOpen, setLeftRailOpen] = useState(true);
  const [rightRailOpen, setRightRailOpen] = useState(true);
  const [focusWritingMode, setFocusWritingMode] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([]);
  const [styleMemoryMeta, setStyleMemoryMeta] = useState<StyleMemoryMeta | null>(null);
  const [expandedRecommendationId, setExpandedRecommendationId] = useState<string | null>(null);
  const [selectedDraftRange, setSelectedDraftRange] = useState<{ start: number; end: number } | null>(null);
  const [selectedDraftSnippet, setSelectedDraftSnippet] = useState("");
  const [draftChatMessages, setDraftChatMessages] = useState<DraftChatMessage[]>([
    {
      id: "assistant-intro",
      role: "assistant",
      content:
        "Share your facts and attach supporting documents. I will draft in Pakistani court format and update your workspace draft.",
      createdAt: Date.now(),
    },
  ]);
  const [draftReferences, setDraftReferences] = useState<LegalDraftReferencesPayload>(() => createEmptyLegalDraftReferences());
  const [isResolvingReferences, setIsResolvingReferences] = useState(false);
  const [activeCaseSourceId, setActiveCaseSourceId] = useState<number | null>(null);
  const [caseSourceDoc, setCaseSourceDoc] = useState<CaseLawSourceDocument | null>(null);
  const showDraftReviewPanel = riskLoading || recommendLoading || riskResults.length > 0 || recommendations.length > 0;

  const leftRailVisible = leftRailOpen && !focusWritingMode;
  const rightRailVisible = rightRailOpen && !focusWritingMode;

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

  useEffect(() => {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (!saved) return;
    // Migration: drop previously prefilled template content from autosave.
    if (saved.trim().startsWith(LEGACY_DEFAULT_DOC_PREFIX)) {
      localStorage.removeItem(AUTOSAVE_KEY);
      setDocText("");
      return;
    }
    setDocText(saved);
  }, []);

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
    setIsSavedLocal(false);
    const timeout = setTimeout(() => {
      localStorage.setItem(AUTOSAVE_KEY, docText);
      setIsSavedLocal(true);
    }, 800);
    return () => clearTimeout(timeout);
  }, [docText]);

  useEffect(() => {
    localStorage.setItem(CONTEXT_MEMORY_KEY, JSON.stringify(memoryItems.slice(0, 30)));
  }, [memoryItems]);

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

  const syncSelectedDraftText = () => {
    const el = editorRef.current;
    if (!el) return;
    const start = Math.max(0, Math.min(el.selectionStart ?? 0, docText.length));
    const end = Math.max(start, Math.min(el.selectionEnd ?? start, docText.length));
    if (end <= start) return;
    const snippet = docText.slice(start, end);
    if (!snippet.trim()) return;
    setSelectedDraftRange({ start, end });
    setSelectedDraftSnippet(snippet);
  };

  const clearSelectedDraftText = () => {
    setSelectedDraftRange(null);
    setSelectedDraftSnippet("");
  };

  const reselectDraftText = () => {
    if (!selectedDraftRange) return;
    const el = editorRef.current;
    if (!el) return;
    const start = Math.max(0, Math.min(selectedDraftRange.start, docText.length));
    const end = Math.max(start, Math.min(selectedDraftRange.end, docText.length));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, end);
    });
  };

  const memoryContextText = useMemo(() => {
    if (!memoryEnabled || memoryItems.length === 0) return "";
    const entries = memoryItems.slice(0, 8).map((m) => {
      const label = m.kind === "instruction" ? "Instruction" : m.kind === "clause" ? "Clause" : "Risk";
      return `- ${label}: ${m.text}`;
    });
    return entries.join("\n");
  }, [memoryEnabled, memoryItems]);

  const applyWrap = (prefix: string, suffix = prefix) => {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = docText.slice(start, end) || "text";
    const next = `${docText.slice(0, start)}${prefix}${selected}${suffix}${docText.slice(end)}`;
    setDocText(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursorStart = start + prefix.length;
      const cursorEnd = cursorStart + selected.length;
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const applyLinePrefix = (prefix: string, ordered = false) => {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const textBefore = docText.slice(0, start);
    const lineStart = textBefore.lastIndexOf("\n") + 1;
    const selectedBlock = docText.slice(lineStart, end);
    const lines = selectedBlock.split("\n");
    const transformed = lines
      .map((line, idx) => {
        if (line.trim().length === 0) return line;
        return ordered ? `${idx + 1}. ${line}` : `${prefix}${line}`;
      })
      .join("\n");
    const next = `${docText.slice(0, lineStart)}${transformed}${docText.slice(end)}`;
    setDocText(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = lineStart + transformed.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const handleDraftTextChange = (value: string) => {
    setDocText(value);
  };

  useEffect(() => {
    if (expandedRecommendationId && !recommendations.some((item) => item.id === expandedRecommendationId)) {
      setExpandedRecommendationId(null);
    }
  }, [recommendations, expandedRecommendationId]);

  useEffect(() => {
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
  }, [docText]);

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

  const runRiskAnalysis = async () => {
    if (!docText.trim()) {
      setRiskResults([]);
      setRiskLoading(false);
      return;
    }

    setRiskLoading(true);
    try {
      const response = await fetch("/api/ai/draft-risk-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: draftTitle,
          content: docText,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Risk analysis failed");
      }

      const data = await response.json();
      const risksRaw = Array.isArray(data?.risks) ? data.risks : [];
      const normalized: DraftSuggestion[] = risksRaw.slice(0, 8).map((risk: any, idx: number) => ({
        id: typeof risk?.id === "string" && risk.id.trim() ? risk.id : `risk-${idx + 1}`,
        title: typeof risk?.title === "string" && risk.title.trim() ? risk.title : `Risk ${idx + 1}`,
        detail: typeof risk?.detail === "string" && risk.detail.trim() ? risk.detail : "Potential drafting issue detected.",
        severity: risk?.severity === "danger" ? "danger" : "warning",
        prompt: typeof risk?.prompt === "string" && risk.prompt.trim()
          ? risk.prompt.trim()
          : "Draft a corrective clause to fix this risk under Pakistani law.",
      }));

      setRiskResults(normalized);
      if (normalized.length > 0) {
        addMemoryItem(
          "risk",
          `Risk scan found ${normalized.length} item(s): ${normalized.slice(0, 3).map((r) => r.title).join("; ")}`
        );
      }
    } catch (err: any) {
      toast({
        title: "Risk analysis failed",
        description: err?.message || "Could not analyze this draft.",
        variant: "destructive",
      });
    } finally {
      setRiskLoading(false);
    }
  };

  const applyRecommendedChange = (edit: DraftRecommendation) => {
    const replacement = edit.suggestedText.trim();
    if (!replacement) return;
    const source = docText || "";
    if (!edit.originalSnippet.trim()) {
      toast({
        title: "Could not auto-apply",
        description: "AI did not provide an exact snippet to replace. No new text was added.",
        variant: "destructive",
      });
      return;
    }
    const range = findSnippetRange(source, edit.originalSnippet);
    if (!range) {
      toast({
        title: "Snippet not found",
        description: "No matching text found in current draft. No new text was added.",
        variant: "destructive",
      });
      return;
    }

    const nextText = source.slice(0, range.start) + replacement + source.slice(range.end);

    setDocText(nextText);

    addMemoryItem("risk", `Applied AI recommendation: ${edit.title}`);
    let remaining = 0;
    setRecommendations((prev) => {
      const next = prev.filter((item) => item.id !== edit.id);
      remaining = next.length;
      return next;
    });
    setExpandedRecommendationId((prev) => (prev === edit.id ? null : prev));
    if (remaining === 0) {
      setRiskResults([]);
    }
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
    if (remaining === 0) {
      setRiskResults([]);
    }
  };

  const dismissRisk = (id: string) => {
    setRiskResults((prev) => prev.filter((item) => item.id !== id));
  };

  const runDraftRecommendations = async () => {
    if (!docText.trim()) {
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
          content: docText,
          maxEdits: 6,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Recommendation review failed");
      }

      const data = await response.json();
      const editsRaw = Array.isArray(data?.edits) ? data.edits : [];
      const normalized: DraftRecommendation[] = editsRaw.slice(0, 10).map((edit: any, idx: number) => ({
        id: typeof edit?.id === "string" && edit.id.trim() ? edit.id : `edit-${idx + 1}`,
        title: typeof edit?.title === "string" && edit.title.trim() ? edit.title : `Recommended change ${idx + 1}`,
        reason: typeof edit?.reason === "string" && edit.reason.trim() ? edit.reason : "Improves pleading quality and legal clarity.",
        originalSnippet: typeof edit?.originalSnippet === "string" ? edit.originalSnippet.trim() : "",
        suggestedText: typeof edit?.suggestedText === "string" ? edit.suggestedText.trim() : "",
        impact: edit?.impact === "high" || edit?.impact === "low" ? edit.impact : "medium",
      })).filter((edit: DraftRecommendation) => edit.suggestedText.length > 0);

      setRecommendations(normalized);
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

  const runDraftReview = async () => {
    await Promise.all([runRiskAnalysis(), runDraftRecommendations()]);
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
    onSuccess: (doc) => {
      setSelectedDraftId(doc.id);
      queryClient.invalidateQueries({ queryKey: [api.documents.list.path] });
      toast({ title: "Draft saved" });
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
    saveDraftMutation.mutate({ id: selectedDraftId, title: cleanTitle, content: docText });
  };

  const loadDraft = (doc: DraftDocument) => {
    setSelectedDraftId(doc.id);
    setDraftTitle(doc.title.replace(`${DRAFT_TITLE_PREFIX} `, "") || "Draft");
    setDocText(doc.content || "");
    clearSelectedDraftText();
    setRecommendations([]);
    setRiskResults([]);
    setDraftReferences(createEmptyLegalDraftReferences());
    toast({ title: "Draft loaded" });
  };

  const applyTemplate = (template: DraftTemplate) => {
    setDraftTitle(template.title);
    setDocText(template.body);
    clearSelectedDraftText();
    setRecommendations([]);
    setRiskResults([]);
    setDraftReferences(createEmptyLegalDraftReferences());
    setSelectedDraftId(null);
    setActiveLeftTool("drafts");
    toast({ title: `Template applied: ${template.title}` });
    runDraftReview();
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

  const generateClause = async (promptOverride?: string) => {
    const prompt = (promptOverride ?? aiPrompt).trim();
    if (!prompt) return;

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

    setIsGenerating(true);
    try {
      const draftTextForAi = docText.slice(0, 12000);
      const selectedSnippet = selectedDraftSnippet.trim() ? selectedDraftSnippet.slice(0, 8000) : "";
      let response: Response;
      if (aiContextFiles.length > 0) {
        const form = new FormData();
        form.append("prompt", prompt);
        form.append("draftText", draftTextForAi);
        form.append("jurisdiction", "Lahore");
        form.append("module", "legal-drafting");
        if (selectedSnippet) {
          form.append("selectedSnippet", selectedSnippet);
        }
        aiContextFiles.forEach((file) => form.append("attachments", file));
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
          jurisdiction: "Lahore",
          module: "legal-drafting",
        };
        response = await fetch("/api/retrieval/clauses/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const t = await response.text();
        throw new Error(t || "AI generation failed");
      }

      const data = await response.json();
      const clause = (data?.clause || "").trim();
      if (!clause) throw new Error("No clause generated");
      setStyleMemoryMeta((data?.styleMemory || null) as StyleMemoryMeta | null);
      setDraftReferences(normalizeLegalDraftReferences(data?.references));

      setDocText(clause);
      addMemoryItem("instruction", prompt);
      addMemoryItem("clause", clause);
      setDraftChatMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: "assistant",
          content: clause,
          createdAt: Date.now(),
        },
      ]);
      setAiPrompt("");
      setAiContextFiles([]);
      if (aiContextInputRef.current) aiContextInputRef.current.value = "";
      toast({ title: "Legal draft updated" });

      await apiRequest("POST", "/api/search-history", {
        type: "draft",
        query: prompt.slice(0, 120),
      }).catch(() => {});

      runDraftReview();
    } catch (err: any) {
      setDraftChatMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: "assistant",
          content: `I could not generate the draft update right now. ${err?.message || "Please try again."}`,
          createdAt: Date.now(),
        },
      ]);
      toast({
        title: "Failed to generate clause",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const exportAsTxt = () => {
    const blob = new Blob([docText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draftTitle || "legal-draft"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported as TXT" });
  };

  const exportAsDoc = () => {
    const html = `<!doctype html><html><head><meta charset=\"utf-8\" /></head><body><pre style=\"white-space:pre-wrap;font-family:'Times New Roman',serif;font-size:13pt;line-height:1.6;\">${docText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</pre></body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draftTitle || "legal-draft"}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported as Word (.doc)" });
  };

  const shareDraft = async () => {
    const shareText = `${draftTitle}\n\n${docText}`;
    try {
      await navigator.clipboard.writeText(shareText);
      toast({ title: "Draft copied to clipboard" });
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
    runDraftReview();
  }, []);

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

  return (
    <div className="relative isolate h-full min-h-[620px] md:min-h-[820px] rounded-xl border border-[hsl(var(--preview-border))] overflow-hidden bg-[#0f172a]/70 backdrop-blur-xl text-slate-100 fade-in flex flex-col shadow-2xl">
      <div className="pointer-events-none absolute -top-24 right-10 h-56 w-56 rounded-full bg-amber-500/12 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-8 h-60 w-60 rounded-full bg-amber-400/10 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.2) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <header className="h-16 border-b border-[hsl(var(--preview-border))] flex items-center justify-between px-3 md:px-6 bg-[#0f172a]/55 backdrop-blur-xl z-20">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-3">
            <div className="size-9 shrink-0 rounded-lg bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/25 ring-1 ring-amber-100/30">
              <Gavel size={18} className="translate-y-[0.5px]" />
            </div>
            <div className="leading-tight">
              <h2 className="text-lg md:text-xl font-bold tracking-tight">Legal Drafting Studio</h2>
              <p className="text-[9px] uppercase tracking-[0.24em] text-amber-300/90 font-black">AL WAKEELO / DRAFT OPS</p>
            </div>
          </div>
          <div className="hidden md:block h-6 w-px bg-amber-500/20" />
          <div className="hidden md:flex items-center gap-3 min-w-0">
            <span className="text-sm text-slate-400 truncate">{draftTitle || "Untitled Draft"}</span>
            <span className="text-slate-500">/</span>
            <span className="text-sm font-semibold truncate">
              {selectedDraftId ? `ID ${selectedDraftId}` : "Unsaved"}
            </span>
            <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px] uppercase font-bold tracking-wider">
              <Sparkles size={11} />
              {isSavedLocal ? "Local Saved" : "Typing..."}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden md:flex items-center gap-1">
            <Button
              variant="outline"
              className="h-9 px-2 border-slate-700 text-slate-200 hover:bg-slate-800"
              onClick={() => {
                setFocusWritingMode(false);
                setLeftRailOpen((v) => !v);
              }}
              data-testid="button-toggle-left-rail"
              title={leftRailVisible ? "Hide workspace panel" : "Show workspace panel"}
            >
              {leftRailVisible ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
            </Button>
            <Button
              variant="outline"
              className="h-9 px-2 border-slate-700 text-slate-200 hover:bg-slate-800"
              onClick={() => setFocusWritingMode((v) => !v)}
              data-testid="button-toggle-focus-writing"
              title={focusWritingMode ? "Exit focus writing mode" : "Focus writing mode"}
            >
              {focusWritingMode ? <Minimize2 size={14} /> : <Focus size={14} />}
            </Button>
            <Button
              variant="outline"
              className="hidden lg:inline-flex h-9 px-2 border-slate-700 text-slate-200 hover:bg-slate-800"
              onClick={() => {
                setFocusWritingMode(false);
                setRightRailOpen((v) => !v);
              }}
              data-testid="button-toggle-right-rail"
              title={rightRailVisible ? "Hide AI assistant panel" : "Show AI assistant panel"}
            >
              {rightRailVisible ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            </Button>
          </div>
          <div className="hidden lg:flex items-center -space-x-2">
            {collaborators.map((c, idx) => (
              <div
                key={`${c}-${idx}`}
                className="size-8 rounded-md border border-amber-400/40 bg-amber-500/15 text-amber-100 flex items-center justify-center text-[10px] font-bold shadow"
              >
                {c}
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            className="h-9 md:h-10 px-2.5 md:px-3 border-slate-700 text-slate-200 hover:bg-slate-800"
            onClick={shareDraft}
            data-testid="button-share-draft"
          >
            <Share2 size={14} className="md:mr-1.5" />
            <span className="hidden md:inline">Share</span>
          </Button>
          <Button
            variant="outline"
            className="h-9 md:h-10 px-2.5 md:px-3 border-slate-700 text-slate-200 hover:bg-slate-800"
            onClick={exportAsTxt}
            data-testid="button-export-txt"
          >
            <Download size={14} className="md:mr-1.5" />
            <span className="hidden md:inline">TXT</span>
          </Button>
          <Button
            className="h-9 md:h-10 px-2.5 md:px-3 bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold shadow-lg shadow-amber-500/20"
            onClick={exportAsDoc}
            data-testid="button-export-doc"
          >
            <Download size={14} className="md:mr-1.5" />
            <span className="hidden md:inline">Word</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`hidden md:flex transition-[width] duration-300 ease-out overflow-hidden ${
            leftRailVisible
              ? "w-56 border-r border-[hsl(var(--preview-border))] bg-[#0f172a]/45 backdrop-blur-xl"
              : "w-0 border-r-0"
          }`}
        >
          <div className="w-56 flex flex-col py-4 md:py-5">
          <div className="hidden md:flex items-center justify-between px-4 pb-3 border-b border-[hsl(var(--preview-border))]">
            <p className="text-xs uppercase tracking-widest text-amber-300 font-bold">Workspace</p>
            <Button
              size="sm"
              className="inline-flex h-7 items-center justify-center gap-1 px-2 bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md shadow-amber-500/20"
              onClick={() => {
                setDocText(DEFAULT_DOC);
                setDraftTitle("Untitled Draft");
                setSelectedDraftId(null);
                clearSelectedDraftText();
              }}
            >
              <Plus size={12} className="shrink-0" />
              New
            </Button>
          </div>

          <div className="flex md:hidden flex-col items-center gap-3 pt-4">
            <button onClick={() => setActiveLeftTool("drafts")} className={`p-2.5 rounded-xl border ${activeLeftTool === "drafts" ? "text-amber-400 border-amber-500/40 bg-amber-500/10" : "text-slate-400 border-slate-700 bg-[#1e293b]/40"}`}><FolderOpen size={18} /></button>
            <button onClick={() => setActiveLeftTool("templates")} className={`p-2.5 rounded-xl border ${activeLeftTool === "templates" ? "text-amber-400 border-amber-500/40 bg-amber-500/10" : "text-slate-400 border-slate-700 bg-[#1e293b]/40"}`}><FileText size={18} /></button>
            <button onClick={() => { setActiveLeftTool("collab"); shareWorkspaceLink(); }} className={`p-2.5 rounded-xl border ${activeLeftTool === "collab" ? "text-amber-400 border-amber-500/40 bg-amber-500/10" : "text-slate-400 border-slate-700 bg-[#1e293b]/40"}`}><Users size={18} /></button>
            <button onClick={() => { setActiveLeftTool("archive"); window.location.href = "/case-documents"; }} className={`p-2.5 rounded-xl border ${activeLeftTool === "archive" ? "text-amber-400 border-amber-500/40 bg-amber-500/10" : "text-slate-400 border-slate-700 bg-[#1e293b]/40"}`}><Archive size={18} /></button>
          </div>

          <div className="hidden md:flex flex-col px-3 pt-3 gap-2">
            <button
              onClick={() => setActiveLeftTool("drafts")}
              className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-[12px] uppercase tracking-wide ${
                activeLeftTool === "drafts" ? "bg-amber-500/12 text-amber-200 border border-amber-500/35" : "text-slate-300 hover:bg-[#1e293b]/60 border border-transparent hover:border-slate-700"
              }`}
            >
              <FolderOpen size={16} /> My Drafts
            </button>
            <button
              onClick={() => setActiveLeftTool("templates")}
              className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-[12px] uppercase tracking-wide ${
                activeLeftTool === "templates" ? "bg-amber-500/12 text-amber-200 border border-amber-500/35" : "text-slate-300 hover:bg-[#1e293b]/60 border border-transparent hover:border-slate-700"
              }`}
            >
              <FileText size={16} /> Templates
            </button>
            <button
              onClick={() => {
                setActiveLeftTool("collab");
                shareWorkspaceLink();
              }}
              className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-[12px] uppercase tracking-wide ${
                activeLeftTool === "collab" ? "bg-amber-500/12 text-amber-200 border border-amber-500/35" : "text-slate-300 hover:bg-[#1e293b]/60 border border-transparent hover:border-slate-700"
              }`}
            >
              <Users size={16} /> Collaborate
            </button>
            <button
              onClick={() => {
                setActiveLeftTool("archive");
                window.location.href = "/case-documents";
              }}
              className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-[12px] uppercase tracking-wide ${
                activeLeftTool === "archive" ? "bg-amber-500/12 text-amber-200 border border-amber-500/35" : "text-slate-300 hover:bg-[#1e293b]/60 border border-transparent hover:border-slate-700"
              }`}
            >
              <Archive size={16} /> Archive
            </button>
          </div>

          <div className="hidden md:flex flex-1 min-h-0 px-3 pt-3">
            {activeLeftTool === "templates" ? (
              <div className="w-full overflow-auto space-y-2">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => applyTemplate(template)}
                    className="w-full text-left rounded-xl border border-slate-700/70 bg-[#1e293b]/45 backdrop-blur-md p-3 hover:border-amber-500/30 transition-all"
                  >
                    <p className="text-sm font-semibold text-slate-100">{template.title}</p>
                    <p className="text-xs text-slate-400 mt-1">Click to load this template.</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="w-full overflow-auto space-y-2">
                {loadingDocs ? (
                  <p className="text-xs text-slate-400">Loading drafts...</p>
                ) : draftDocuments.length === 0 ? (
                  <p className="text-xs text-slate-400">No saved legal drafts yet.</p>
                ) : (
                  draftDocuments.map((doc) => {
                    const active = selectedDraftId === doc.id;
                    return (
                      <div
                        key={doc.id}
                        className={`rounded-xl border p-2 backdrop-blur-md ${
                          active ? "border-amber-400/40 bg-amber-500/10" : "border-slate-700 bg-[#1e293b]/20"
                        }`}
                      >
                        <button className="w-full text-left" onClick={() => loadDraft(doc)}>
                          <p className="text-xs font-semibold text-slate-200 line-clamp-1">
                            {doc.title.replace(`${DRAFT_TITLE_PREFIX} `, "")}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-1">
                            {doc.createdAt ? new Date(doc.createdAt).toLocaleString() : "Unknown date"}
                          </p>
                        </button>
                        <div className="mt-2 flex justify-end">
                          <button
                            onClick={() => deleteDraftMutation.mutate(doc.id)}
                            className="text-slate-500 hover:text-red-400"
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

          <div className="hidden md:block mt-auto px-3 pt-3 border-t border-[hsl(var(--preview-border))]">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-black">Draft Interface v2.1</p>
          </div>
          </div>
        </aside>

        <div className={`${focusWritingMode ? "hidden" : "hidden md:flex"} items-stretch`}>
          <button
            onClick={() => setLeftRailOpen((v) => !v)}
            className="h-full w-6 border-r border-amber-400/35 bg-gradient-to-b from-amber-500/25 via-[#15233b] to-[#0c1525] text-amber-100 hover:from-amber-400/40 hover:via-[#1b2e4d] hover:to-[#0c1525] flex items-center justify-center transition-all shadow-[0_0_20px_rgba(251,191,36,0.22)]"
            data-testid="divider-toggle-left-rail"
            title={leftRailVisible ? "Collapse workspace panel" : "Expand workspace panel"}
            aria-label={leftRailVisible ? "Collapse workspace panel" : "Expand workspace panel"}
          >
            {leftRailVisible ? <ChevronLeft size={15} className="drop-shadow" /> : <ChevronRight size={15} className="drop-shadow" />}
          </button>
        </div>

        <main className="flex-1 flex flex-col bg-[#0f172a]/50 overflow-hidden">
          <div className="md:hidden border-b border-[hsl(var(--preview-border))] bg-[#0f172a]/45 px-3 py-2 flex items-center gap-2 overflow-x-auto">
            <button onClick={() => setActiveLeftTool("drafts")} className={`shrink-0 px-2.5 py-1.5 rounded-md text-[11px] border ${activeLeftTool === "drafts" ? "text-amber-300 border-amber-500/40 bg-amber-500/10" : "text-slate-300 border-slate-700 bg-[#1e293b]/40"}`}>Drafts</button>
            <button onClick={() => setActiveLeftTool("templates")} className={`shrink-0 px-2.5 py-1.5 rounded-md text-[11px] border ${activeLeftTool === "templates" ? "text-amber-300 border-amber-500/40 bg-amber-500/10" : "text-slate-300 border-slate-700 bg-[#1e293b]/40"}`}>Templates</button>
            <button onClick={() => shareWorkspaceLink()} className="shrink-0 px-2.5 py-1.5 rounded-md text-[11px] border text-slate-300 border-slate-700 bg-[#1e293b]/40">Share</button>
            <button onClick={() => (window.location.href = "/case-documents")} className="shrink-0 px-2.5 py-1.5 rounded-md text-[11px] border text-slate-300 border-slate-700 bg-[#1e293b]/40">Archive</button>
          </div>
          <div className="md:hidden px-3 py-2 border-b border-[hsl(var(--preview-border))] bg-[#0f172a]/30">
            {activeLeftTool === "templates" ? (
              <div className="max-h-28 overflow-auto space-y-1.5">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => applyTemplate(template)}
                    className="w-full text-left rounded-lg border border-slate-700/70 bg-[#1e293b]/45 p-2"
                  >
                    <p className="text-xs font-semibold text-slate-100">{template.title}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="max-h-28 overflow-auto space-y-1.5">
                {draftDocuments.slice(0, 6).map((doc) => (
                  <button
                    key={doc.id}
                    className="w-full text-left rounded-lg border border-slate-700/70 bg-[#1e293b]/45 p-2"
                    onClick={() => loadDraft(doc)}
                  >
                    <p className="text-xs font-semibold text-slate-100 line-clamp-1">
                      {doc.title.replace(`${DRAFT_TITLE_PREFIX} `, "")}
                    </p>
                  </button>
                ))}
                {!loadingDocs && draftDocuments.length === 0 && (
                  <p className="text-[11px] text-slate-400">No saved legal drafts yet.</p>
                )}
              </div>
            )}
          </div>

          <div className="h-auto border-b border-[hsl(var(--preview-border))] bg-[#0f172a]/45 backdrop-blur-xl flex items-center px-3 md:px-4 py-2 justify-between gap-2 flex-wrap">
            <div className="text-[11px] text-slate-300">
              Chat-first drafting mode is active. The workspace draft updates from AI responses.
            </div>
            <div className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">Editor Disabled</div>
          </div>

          <div className="px-3 md:px-8 pt-3 flex items-center gap-2 flex-wrap">
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="h-9 w-full sm:w-[240px] bg-[#1e293b]/45 border border-slate-700 rounded-lg px-3 text-sm text-slate-100 backdrop-blur-md"
              placeholder="Draft title"
            />
            <Button
              className="h-9 bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold"
              onClick={saveDraft}
              disabled={saveDraftMutation.isPending}
            >
              <Save size={14} className="mr-1.5" />
              {saveDraftMutation.isPending ? "Saving..." : "Save Draft"}
            </Button>
            <span className="text-xs text-slate-400 hidden md:inline">
              {selectedDraftId ? `Loaded draft #${selectedDraftId}` : "New unsaved draft"}
            </span>
          </div>

          <div className="flex-1 overflow-hidden p-2 md:p-4 lg:p-5">
            <div className="h-full w-full rounded-2xl border border-[hsl(var(--preview-border))] bg-[#0b1220]/72 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08)] backdrop-blur-xl flex flex-col overflow-hidden">
              <div className="border-b border-[hsl(var(--preview-border))] px-4 py-3 bg-[#0f172a]/40">
                <p className="text-[11px] uppercase tracking-widest text-amber-300 font-bold">Workspace Draft (Read-only)</p>
                <p className="text-[11px] text-slate-400 mt-1">AI responses update this draft automatically. Save/export actions remain available.</p>
              </div>

              <div className="max-h-[28%] min-h-[140px] overflow-y-auto border-b border-[hsl(var(--preview-border))] px-4 py-3">
                {docText.trim() ? (
                  <pre className="legal-draft-font whitespace-pre-wrap text-[13px] leading-7 text-slate-100">{docText}</pre>
                ) : (
                  <p className="text-sm text-slate-400">No draft generated yet. Send your first drafting prompt below.</p>
                )}
              </div>

              <div className="flex-1 min-h-0 flex flex-col">
                <div className="px-4 py-2 border-b border-[hsl(var(--preview-border))] bg-[#0f172a]/25 flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-widest text-amber-300 font-bold">Drafting Chat</p>
                  <span className="text-[10px] text-slate-500">{draftChatMessages.length} messages</span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
                  {draftChatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-xl border px-3 py-2 ${
                        message.role === "user"
                          ? "ml-8 border-amber-500/35 bg-amber-500/10"
                          : "mr-8 border-slate-700 bg-[#1e293b]/45"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${message.role === "user" ? "text-amber-200" : "text-slate-300"}`}>
                          {message.role === "user" ? "You" : "AI Drafting Assistant"}
                        </span>
                        <span className="text-[10px] text-slate-500">{new Date(message.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-[12px] whitespace-pre-wrap leading-relaxed text-slate-100">{message.content}</p>
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {message.attachments.map((name, idx) => (
                            <span key={`${message.id}-file-${idx}`} className="inline-flex items-center rounded-md border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-100">
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mx-3 mb-3 mt-2 rounded-xl border border-[hsl(var(--preview-border))] px-3 py-2 space-y-2 bg-[#0f172a]/75 backdrop-blur-xl pb-[max(env(safe-area-inset-bottom),0.6rem)]">
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
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-700 bg-[#1e293b]/40 text-[11px] text-slate-200 hover:border-amber-500/40 hover:text-amber-200"
                      >
                        <Paperclip size={12} />
                        Attach Context Files
                      </button>
                      <span className="text-[10px] text-slate-500">PDF, DOC/DOCX/DOCM/DOTX, TXT · up to 5 files</span>
                    </div>
                    {aiContextFiles.length > 0 && (
                      <div className="mt-2 space-y-1.5 max-h-24 overflow-y-auto pr-1">
                        {aiContextFiles.map((file, idx) => (
                          <div key={`${file.name}-${idx}`} className="flex items-center justify-between rounded-md border border-slate-700/70 bg-[#0f172a]/70 px-2 py-1">
                            <span className="text-[11px] text-slate-300 truncate pr-2">{file.name}</span>
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

                  <div className="relative">
                    <Textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="w-full bg-[#1e293b]/50 border border-slate-700 rounded-xl p-3 pr-12 text-sm focus-visible:ring-1 focus-visible:ring-amber-400 focus-visible:border-amber-400 outline-none resize-none placeholder:text-slate-600"
                      placeholder="Describe what to draft, amend, or improve in Pakistani court format..."
                      rows={2}
                      data-testid="textarea-ai-draft-prompt"
                    />
                    <button
                      className="absolute bottom-3 right-3 size-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg disabled:opacity-50"
                      onClick={() => generateClause()}
                      disabled={isGenerating || !aiPrompt.trim()}
                      data-testid="button-send-ai-draft-prompt"
                    >
                      {isGenerating ? <Search size={15} className="animate-spin" /> : <ArrowRight size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <div className={`${focusWritingMode ? "hidden" : "hidden lg:flex"} items-stretch`}>
          <button
            onClick={() => setRightRailOpen((v) => !v)}
            className="h-full w-6 border-l border-amber-400/35 bg-gradient-to-b from-amber-500/25 via-[#15233b] to-[#0c1525] text-amber-100 hover:from-amber-400/40 hover:via-[#1b2e4d] hover:to-[#0c1525] flex items-center justify-center transition-all shadow-[0_0_20px_rgba(251,191,36,0.22)]"
            data-testid="divider-toggle-right-rail"
            title={rightRailVisible ? "Collapse AI panel" : "Expand AI panel"}
            aria-label={rightRailVisible ? "Collapse AI panel" : "Expand AI panel"}
          >
            {rightRailVisible ? <ChevronRight size={15} className="drop-shadow" /> : <ChevronLeft size={15} className="drop-shadow" />}
          </button>
        </div>

        <aside
          className={`hidden lg:flex transition-[width] duration-300 ease-out overflow-hidden ${
            rightRailVisible
              ? "w-[300px] xl:w-[320px] border-l border-[hsl(var(--preview-border))] bg-[#0f172a]/45 backdrop-blur-xl"
              : "w-0 border-l-0"
          }`}
        >
          <div className="w-[300px] xl:w-[320px] flex flex-col">
          <div className="p-4 border-b border-[hsl(var(--preview-border))] bg-[#0f172a]/35 backdrop-blur-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <Bot size={14} className="text-amber-300" />
              </div>
              <h3 className="font-bold text-sm tracking-wide uppercase">AI Drafting Assistant</h3>
            </div>
            <div className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/30 to-amber-300/20 text-amber-200 text-[10px] font-bold border border-amber-400/30">PRO</div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <section>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Drafting Controls</label>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Use the chat composer in the main workspace to send instructions and attach context files. The AI response updates the workspace draft.
              </p>
              {styleMemoryMeta && (
                <div className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-100">
                  Style memory: {styleMemoryMeta.applied ? "applied" : "not applied"} · confidence {Math.round((styleMemoryMeta.confidence || 0) * 100)}%
                </div>
              )}
            </section>

            <StyleMemoryPanel module="legal-drafting" />

            {showDraftReviewPanel && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Draft Review</label>
                  <button
                    onClick={runDraftReview}
                    className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold"
                    data-testid="button-refresh-draft-review"
                  >
                    {riskLoading || recommendLoading ? "Reviewing..." : `${riskResults.length} Alerts · ${recommendations.length} Changes`}
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-orange-300">Risk Alerts</p>
                      <span className="text-[10px] font-bold text-orange-300">{riskResults.length}</span>
                    </div>
                    <div className="space-y-2">
                      {riskResults.length === 0 ? (
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                          <p className="text-[11px] text-emerald-300">No obvious drafting risks detected.</p>
                        </div>
                      ) : (
                        riskResults.map((risk) => (
                          <div
                            key={risk.id}
                            className={`w-full text-left p-3 rounded-lg border ${
                              risk.severity === "danger"
                                ? "bg-red-500/5 border-red-500/20"
                                : "bg-orange-500/5 border-orange-500/20"
                            }`}
                            data-testid={`risk-item-${risk.id}`}
                          >
                            <div className="flex items-start gap-2 mb-1">
                              <AlertTriangle
                                size={14}
                                className={risk.severity === "danger" ? "text-red-400 mt-0.5" : "text-orange-400 mt-0.5"}
                              />
                              <h4 className="text-xs font-bold text-slate-200">{risk.title}</h4>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-normal">{risk.detail}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  dismissRisk(risk.id);
                                  generateClause(risk.prompt);
                                }}
                                className="px-2 py-1 rounded bg-amber-500 text-slate-950 text-[10px] font-bold hover:bg-amber-400"
                              >
                                Fix with AI
                              </button>
                              <button
                                type="button"
                                onClick={() => dismissRisk(risk.id)}
                                className="px-2 py-1 rounded border border-slate-600 text-slate-300 text-[10px] font-bold hover:border-amber-500/35 hover:text-amber-200"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">AI Recommended Changes</p>
                      <span className="text-[10px] font-bold text-amber-300">{recommendations.length}</span>
                    </div>
                    <div className="space-y-2">
                      {recommendations.length === 0 ? (
                        <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                          <p className="text-[11px] text-amber-200">No AI text changes suggested yet.</p>
                        </div>
                      ) : (
                        recommendations.map((edit) => (
                          <div
                            key={edit.id}
                            className="w-full p-3 rounded-lg border border-amber-500/20 bg-amber-500/5"
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
                                <h4 className="text-xs font-bold text-slate-200">{edit.title}</h4>
                                <span
                                  className={`text-[10px] font-bold uppercase ${
                                    edit.impact === "high" ? "text-red-300" : edit.impact === "low" ? "text-emerald-300" : "text-amber-300"
                                  }`}
                                >
                                  {edit.impact} impact
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 leading-normal mt-1">{edit.reason}</p>
                            </button>
                            {expandedRecommendationId === edit.id && (
                              <>
                                {edit.originalSnippet ? (
                                  <div className="mt-2 rounded border border-rose-500/30 bg-rose-500/10 p-2">
                                    <p className="text-[10px] font-bold text-rose-200 uppercase tracking-wider mb-1">Before</p>
                                    <p className="text-[11px] text-slate-300 whitespace-pre-wrap">{edit.originalSnippet}</p>
                                  </div>
                                ) : null}
                                <div className="mt-2 rounded border border-emerald-500/30 bg-emerald-500/10 p-2">
                                  <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider mb-1">After</p>
                                  <p className="text-[11px] text-emerald-100 whitespace-pre-wrap">{edit.suggestedText}</p>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  <button
                                    onClick={() => applyRecommendedChange(edit)}
                                    className="px-2 py-1 rounded bg-amber-500 text-slate-950 text-[10px] font-bold hover:bg-amber-400"
                                    data-testid={`button-apply-recommendation-${edit.id}`}
                                  >
                                    OK, Apply Change
                                  </button>
                                  <button
                                    onClick={() => dismissRecommendation(edit.id)}
                                    className="px-2 py-1 rounded border border-slate-600 text-slate-300 text-[10px] font-bold hover:border-amber-500/35 hover:text-amber-200"
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

            <section>
              <div className="mb-3 flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Verified References</label>
                {isResolvingReferences && <Loader2 size={12} className="animate-spin text-amber-300" />}
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border border-slate-700/70 bg-[#1e293b]/20 p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300 mb-2">Statute References</p>
                  {draftReferences.statutes.length === 0 ? (
                    <p className="text-[11px] text-slate-400">No verified statute sections found in this draft yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {draftReferences.statutes.map((item, idx) => (
                        <button
                          key={`${item.statuteName}-${item.sectionLabel}-${idx}`}
                          type="button"
                          onClick={() => openStatuteReference(item)}
                          className="w-full flex items-center justify-between rounded-lg border border-slate-700 bg-[#0f172a]/70 px-2.5 py-2 text-left hover:border-amber-500/30 transition-colors disabled:opacity-60"
                          disabled={!item.viewUrl}
                          data-testid={`statute-ref-${item.statuteName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${idx}`}
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <BookOpen size={14} className="text-amber-200 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-slate-100 truncate">{item.statuteName}</p>
                              <p className="text-[10px] text-amber-300 truncate">{item.sectionLabel}</p>
                            </div>
                          </div>
                          <ArrowRight size={12} className="text-slate-500 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-slate-700/70 bg-[#1e293b]/20 p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300 mb-2">Case Law Citations</p>
                  {draftReferences.caseLaw.length === 0 ? (
                    <p className="text-[11px] text-slate-400">No verified case citations linked to internal judgments yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {draftReferences.caseLaw.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openCaseSourceDocument(item)}
                          disabled={!item.hasSource || activeCaseSourceId === item.id}
                          className="w-full flex items-center justify-between rounded-lg border border-slate-700 bg-[#0f172a]/70 px-2.5 py-2 text-left hover:border-amber-500/30 transition-colors disabled:opacity-60"
                          data-testid={`case-ref-${item.id}`}
                        >
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-slate-100 truncate">{item.citation}</p>
                            <p className="text-[10px] text-slate-400 truncate">{item.title}</p>
                          </div>
                          {activeCaseSourceId === item.id ? (
                            <Loader2 size={12} className="animate-spin text-amber-300 shrink-0" />
                          ) : (
                            <ArrowRight size={12} className="text-slate-500 shrink-0" />
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
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-200 mb-1">Unresolved Statutes</p>
                    <p className="text-[11px] text-amber-100">
                      Detected in text but not yet linked to a statute document:
                    </p>
                    <p className="text-[10px] text-amber-200 mt-1 break-words">
                      {draftReferences.unresolvedStatutes
                        .map((item) => `${item.sectionLabel} (${item.statuteName})`)
                        .join(" | ")}
                    </p>
                  </div>
                )}
              </div>
            </section>
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
    </div>
  );
}
