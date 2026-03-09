import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowRight,
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

type StatuteReference = {
  label: string;
  href: string;
};

type MemoryItem = {
  id: string;
  kind: "instruction" | "clause" | "risk";
  text: string;
  ts: number;
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
const DRAFT_TITLE_PREFIX = "Legal Draft:";

const DEFAULT_DOC = "";
const LEGACY_DEFAULT_DOC_PREFIX = "IN THE COURT OF THE CIVIL JUDGE";
const PROPERTY_SALE_TEMPLATE = `IN THE COURT OF THE CIVIL JUDGE
Civil District, Islamabad, Pakistan

Suit No. ______ of 2024

IN THE MATTER OF:
Plaintiff: ____________________
VERSUS
Defendant: ____________________

AGREEMENT FOR SALE OF IMMOVABLE PROPERTY

This AGREEMENT FOR SALE is made and executed at Islamabad on this ____ day of ________, 2024, by and between the parties mentioned above.

1. CONSIDERATION:
The total sale price of the said property is fixed at PKR ____________/- of which a sum of PKR ____________ has been paid as earnest money.

2. TRANSFER OF TITLE:
The Vendor covenants with the Vendee that the property is free from encumbrances, liens, charges, and legal disputes.
`;

const TEMPLATES: DraftTemplate[] = [
  {
    id: "property-sale",
    title: "Property Sale Agreement",
    body: PROPERTY_SALE_TEMPLATE,
  },
  {
    id: "rental",
    title: "Rental Agreement",
    body: `RENTAL AGREEMENT\n\nThis Rental Agreement is made on ____ day of ________, 2024 between:\nLandlord: ____________________\nTenant: ______________________\n\n1. Premises\nThe Landlord rents to the Tenant the property located at ____________________.\n\n2. Rent\nMonthly rent shall be PKR ____________, payable on or before the 5th day of each month.\n\n3. Term\nThe term of this Agreement shall be ____ months commencing from ____________.\n\n4. Governing Law\nThis Agreement shall be governed by the laws of Pakistan.\n`,
  },
  {
    id: "nda",
    title: "Non-Disclosure Agreement",
    body: `NON-DISCLOSURE AGREEMENT\n\nThis Non-Disclosure Agreement ("Agreement") is made on ____________ between:\nDisclosing Party: ____________________\nReceiving Party: ____________________\n\n1. Confidential Information\nConfidential Information includes non-public business, legal, and technical information disclosed in oral or written form.\n\n2. Obligations\nThe Receiving Party shall keep the Confidential Information confidential and shall not disclose it without prior written consent.\n\n3. Term\nThis Agreement remains effective for ____ years from the Effective Date.\n\n4. Governing Law and Jurisdiction\nThis Agreement is governed by the laws of Pakistan and subject to courts of Islamabad.\n`,
  },
];

function inferStatuteReferences(draft: string): StatuteReference[] {
  const text = draft.toLowerCase();
  if (!text.trim()) return [];

  const patterns: Array<{ key: string; name: string; regex: RegExp }> = [
    { key: "constitution", name: "Constitution of Pakistan, 1973", regex: /\bconstitution\b/i },
    { key: "ppc", name: "Pakistan Penal Code, 1860", regex: /\b(pakistan penal code|ppc)\b/i },
    { key: "crpc", name: "Code of Criminal Procedure, 1898", regex: /\b(code of criminal procedure|crpc)\b/i },
    { key: "cpc", name: "Code of Civil Procedure, 1908", regex: /\b(code of civil procedure|cpc)\b/i },
    { key: "contract", name: "Contract Act, 1872", regex: /\b(contract act|contracts? act)\b/i },
    { key: "property", name: "Transfer of Property Act, 1882", regex: /\b(transfer of property act|property transfer)\b/i },
    { key: "registration", name: "Registration Act, 1908", regex: /\bregistration act\b/i },
    { key: "evidence", name: "Qanun-e-Shahadat Order, 1984", regex: /\b(qanun[-\s]?e[-\s]?shahadat|evidence law)\b/i },
    { key: "family", name: "Family Courts Act, 1964", regex: /\b(family courts? act|family court)\b/i },
  ];

  const sectionMatches = Array.from(
    draft.matchAll(/\b(?:section|sec\.?|s\.)\s*(\d+[a-zA-Z-]*)\b/gi),
  ).map((m) => m[1]).slice(0, 6);

  const refs: StatuteReference[] = [];
  for (const item of patterns) {
    if (!item.regex.test(text)) continue;
    const sectionSuffix = sectionMatches.length > 0 ? ` — Section ${sectionMatches[0]}` : "";
    const q = encodeURIComponent(`${item.name} ${sectionMatches[0] || ""}`.trim());
    refs.push({
      label: `${item.name}${sectionSuffix}`,
      href: `/statute-search?q=${q}`,
    });
  }

  return refs.slice(0, 5);
}

export default function LegalDraftingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const [docText, setDocText] = useState(DEFAULT_DOC);
  const [draftTitle, setDraftTitle] = useState("Untitled Draft");
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavedLocal, setIsSavedLocal] = useState(true);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskResults, setRiskResults] = useState<DraftSuggestion[]>([]);
  const [activeLeftTool, setActiveLeftTool] = useState<"drafts" | "templates" | "collab" | "archive">("drafts");
  const [leftRailOpen, setLeftRailOpen] = useState(true);
  const [rightRailOpen, setRightRailOpen] = useState(true);
  const [focusWritingMode, setFocusWritingMode] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([]);
  const [styleMemoryMeta, setStyleMemoryMeta] = useState<StyleMemoryMeta | null>(null);
  const statuteReferences = useMemo(() => inferStatuteReferences(docText), [docText]);

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
          ? risk.prompt
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
    toast({ title: "Draft loaded" });
  };

  const applyTemplate = (template: DraftTemplate) => {
    setDraftTitle(template.title);
    setDocText(template.body);
    setSelectedDraftId(null);
    setActiveLeftTool("drafts");
    toast({ title: `Template applied: ${template.title}` });
    runRiskAnalysis();
  };

  const generateClause = async (promptOverride?: string) => {
    const prompt = (promptOverride ?? aiPrompt).trim();
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const payload = {
        prompt,
        draftText: docText.slice(0, 12000),
        jurisdiction: "Lahore",
        module: "legal-drafting",
      };
      const response = await fetch("/api/retrieval/clauses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const t = await response.text();
        throw new Error(t || "AI generation failed");
      }

      const data = await response.json();
      const clause = (data?.clause || "").trim();
      if (!clause) throw new Error("No clause generated");
      setStyleMemoryMeta((data?.styleMemory || null) as StyleMemoryMeta | null);

      setDocText((prev) => `${prev.trim()}\n\n${clause}\n`);
      addMemoryItem("instruction", prompt);
      addMemoryItem("clause", clause);
      setAiPrompt("");
      toast({ title: "Clause inserted" });

      await apiRequest("POST", "/api/search-history", {
        type: "draft",
        query: prompt.slice(0, 120),
      }).catch(() => {});

      runRiskAnalysis();
    } catch (err: any) {
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
    runRiskAnalysis();
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

          <div className="h-auto md:h-12 border-b border-[hsl(var(--preview-border))] bg-[#0f172a]/45 backdrop-blur-xl flex items-center px-2 md:px-4 py-2 md:py-0 justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <button onClick={() => applyWrap("**")} className="p-1.5 rounded hover:bg-amber-500/10 text-slate-400 hover:text-amber-400">
                <Bold size={16} />
              </button>
              <button onClick={() => applyWrap("_")} className="p-1.5 rounded hover:bg-amber-500/10 text-slate-400 hover:text-amber-400">
                <Italic size={16} />
              </button>
              <button onClick={() => applyWrap("<u>", "</u>")} className="p-1.5 rounded hover:bg-amber-500/10 text-slate-400 hover:text-amber-400">
                <Underline size={16} />
              </button>
              <div className="h-4 w-px bg-amber-500/20 mx-1" />
              <button onClick={() => applyLinePrefix("- ")} className="p-1.5 rounded hover:bg-amber-500/10 text-slate-400 hover:text-amber-400">
                <List size={16} />
              </button>
              <button onClick={() => applyLinePrefix("", true)} className="p-1.5 rounded hover:bg-amber-500/10 text-slate-400 hover:text-amber-400">
                <ListOrdered size={16} />
              </button>
              <div className="h-4 w-px bg-amber-500/20 mx-1" />
              <button onClick={() => applyWrap("\nSECTION: ", "\n")} className="p-1.5 rounded hover:bg-amber-500/10 text-slate-400 hover:text-amber-400">
                <Type size={16} />
              </button>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                className="h-8 px-2 md:px-3 border-amber-500/20 bg-amber-500/5 text-amber-300 text-[11px] md:text-xs font-bold"
                onClick={() =>
                  generateClause(
                    "Insert properly formatted Pakistani legal citations relevant to this current draft and include section references."
                  )
                }
                data-testid="button-insert-citation"
              >
                Insert Citation
              </Button>
              <Button
                className="h-8 px-2 md:px-3 bg-amber-500 text-slate-950 text-[11px] md:text-xs font-bold hover:bg-amber-400"
                onClick={() => generateClause()}
                disabled={isGenerating || !aiPrompt.trim()}
                data-testid="button-generate-clause"
              >
                Generate Clause
              </Button>
            </div>
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
            <div className="h-full w-full rounded-2xl border border-[hsl(var(--preview-border))] bg-[#0b1220]/72 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08)] backdrop-blur-xl">
              <div className="h-full overflow-y-auto p-3 md:p-5 lg:p-7">
                <Textarea
                  ref={editorRef}
                  value={docText}
                  onChange={(e) => setDocText(e.target.value)}
                  className="legal-draft-font w-full h-full min-h-[72vh] md:min-h-[76vh] resize-none border-0 focus-visible:ring-0 focus-visible:outline-none bg-transparent text-slate-100 leading-8 text-[16px]"
                  data-testid="textarea-legal-draft"
                />
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
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Draft with AI</label>
              {styleMemoryMeta && (
                <div className="mb-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-100">
                  Style memory: {styleMemoryMeta.applied ? "applied" : "not applied"} · confidence {Math.round((styleMemoryMeta.confidence || 0) * 100)}%
                </div>
              )}
              <div className="relative">
                <Textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="w-full bg-[#1e293b]/50 border border-slate-700 rounded-xl p-3 text-sm focus-visible:ring-1 focus-visible:ring-amber-400 focus-visible:border-amber-400 outline-none resize-none placeholder:text-slate-600"
                  placeholder="e.g., Write a force majeure clause for Pakistan"
                  rows={4}
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
            </section>

            <StyleMemoryPanel module="legal-drafting" />

            <section>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Risk Analysis</label>
                <button
                  onClick={runRiskAnalysis}
                  className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[10px] font-bold"
                  data-testid="button-refresh-risk-analysis"
                >
                  {riskLoading ? "Scanning..." : `${riskResults.length} Alerts`}
                </button>
              </div>
              <div className="space-y-3">
                {riskResults.length === 0 ? (
                  <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <p className="text-[11px] text-emerald-300">No obvious drafting risks detected.</p>
                  </div>
                ) : (
                  riskResults.map((risk) => (
                    <button
                      key={risk.id}
                      onClick={() => generateClause(risk.prompt)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        risk.severity === "danger"
                          ? "bg-red-500/5 border-red-500/20 hover:bg-red-500/10"
                          : "bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10"
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
                      <div className="mt-2 text-amber-400 text-[10px] font-bold">Fix with AI</div>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Statute Reference</label>
              <div className="space-y-2">
                {statuteReferences.length === 0 ? (
                  <div className="p-3 rounded-lg bg-[#1e293b]/20 border border-slate-700">
                    <p className="text-[11px] text-slate-400">
                      No statute references detected in this draft yet.
                    </p>
                  </div>
                ) : (
                  statuteReferences.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      className="flex items-center justify-between p-3 rounded-lg bg-[#1e293b]/30 border border-slate-700 hover:border-amber-500/20 transition-all"
                      data-testid={`statute-ref-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen size={16} className="text-slate-400" />
                        <span className="text-xs font-medium">{item.label}</span>
                      </div>
                      <ArrowRight size={13} className="text-slate-500" />
                    </a>
                  ))
                )}
              </div>
            </section>
          </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
