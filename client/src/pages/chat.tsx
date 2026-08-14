import { useState, useRef, useEffect, useCallback, useMemo, type CSSProperties } from "react";
import { Scale, Send, Square, Trash2, Bookmark, BookmarkCheck, Loader2, AlertCircle, Share2, Check, Copy, Zap, Lock, Crown, ArrowUpRight, X, Paperclip, Mic, FileText, File, Sparkles, ChevronDown, ChevronLeft, ChevronRight, FolderOpen, Folder, PlusCircle, User as UserIcon, Search, BookOpen, Brain, ExternalLink, Gavel, BarChart3, Link2, History, ShieldCheck, AlertTriangle, CircleDot, Database, Lightbulb } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getUpgradeCheckoutPath } from "@/lib/upgrade-path";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LegalMarkdown } from "@/components/legal-markdown";
import { parseReferences, ReferenceCards } from "@/components/reference-cards";
import { CaseLawCard, type CaseLawCardData } from "@/components/case-law-card";
import { useDocumentHead } from "@/hooks/use-document-head";
import { formatDuration, useVoiceRecorder } from "@/hooks/use-voice-recorder";

interface ApexModelInfo {
  id: string;
  name: string;
  description: string;
}

interface ApexModelsData {
  available: boolean;
  models: ApexModelInfo[];
  tier: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Clean user-facing text when content has embedded attachment data */
  displayContent?: string;
  attachments?: string[];
  modeName?: string;
  modelName?: string;
  modelId?: string;
  modelDescription?: string;
  moduleProfile?: string;
  routingPath?: string[];
  ragCitations?: RAGCitation[];
  ragConfidence?: "high" | "medium" | "low";
  /** Raw DB case-law results (no AI processing) — rendered above AI prose. */
  caseLawCard?: CaseLawCardData;

}

type AiMode = "standard" | "turbo" | string;

interface ThreadSummary {
  id: number;
  title: string;
  createdAt?: string;
}

const chatStateStore: Record<string, { messages: ChatMessage[]; shareUrl: string | null; sharedThreadId: number | null }> = {};
const ACTIVE_THREAD_KEY_PREFIX = "alwakeelo-active-thread-v1:";
// Let the browser skip painting off-screen message blocks to keep scroll smooth on long threads.
const OFFSCREEN_MESSAGE_STYLE: CSSProperties = {
  contentVisibility: "auto",
  containIntrinsicSize: "260px",
};

function CaseFileSelector({ value, onChange }: { value: number | null; onChange: (id: number | null) => void }) {
  const { data: cases = [] } = useQuery<Array<{ id: number; title: string; status: string }>>({ queryKey: ["/api/case-files"] });
  const activeCases = cases.filter((c: any) => c.status === "active" || c.status === "pending");
  if (activeCases.length === 0) return null;
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-300 outline-none cursor-pointer max-w-[180px]"
      title="Scope RAG to a specific case file"
    >
      <option value="">All Documents</option>
      {activeCases.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
    </select>
  );
}

export default function ChatPage() {
  useDocumentHead({
    title: "Al Wakeelo Engine — Pakistani Legal AI Chat",
    description: "Chat with Al Wakeelo, Pakistan's AI legal assistant. Ask questions about Pakistani statutes, judgments, and procedure. Verified citations from 600,000+ cases.",
    path: "/al-wakeelo",
  });
  const initialMessage = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    return q && q.trim().length > 0 ? q : undefined;
  }, []);

  return <ChatModule type="al-wakeelo" title="Al Wakeelo Engine" initialMessage={initialMessage} />;
}

interface UsageData {
  tier: string;
  used: number;
  remaining: number;
  percentage: number;
  monthlyLimit: number;
}

interface UserDocument {
  id: number;
  title: string;
}

interface RAGCitation {
  documentId: number;
  sourceDocumentId: number;
  title: string;
  chunkIndex: number;
  score: number;
  quote: string;
  sourceScope?: string;
}

/** Clean up raw RAG document titles for display */
function cleanRagTitle(title: string): string {
  let cleaned = title.replace(/^_+|_+$/g, "").replace(/_/g, " ").trim();
  if (cleaned.length > 60) cleaned = cleaned.slice(0, 57) + "…";
  return cleaned || "Untitled Document";
}

/** Determine if a RAG citation should be shown (filter out internal docs) */
function isVisibleCitation(c: RAGCitation): boolean {
  const t = (c.title || "").trim();
  if (t.startsWith("__")) return false;
  if (t.toUpperCase().includes("WORKSPACE_STATE")) return false;
  return true;
}

/** Normalize API sourceScope to a canonical key */
function normalizeScope(c: RAGCitation): string {
  const s = (c.sourceScope || "").toLowerCase();
  if (s.includes("case") || s.includes("judgment")) return "case_law";
  if (s.includes("statute")) return "statute";
  if (s.includes("knowledge")) return "knowledge_base";
  if (s.includes("user") || s.includes("document")) return "user_document";
  // Fallback: infer from title
  const t = (c.title || "").toLowerCase();
  if (t.includes("judgment") || t.includes("case") || t.includes("plj") || t.includes("pld") || t.includes("scmr") || t.includes("pcrlj") || t.includes("ylr")) return "case_law";
  if (t.includes("ppc") || t.includes("act") || t.includes("ordinance") || t.includes("section") || t.includes("code") || t.includes("constitution") || t.includes("penal")) return "statute";
  return "user_document";
}

/** Get scope icon for a RAG citation */
function ragScopeIcon(c: RAGCitation): string {
  const scope = normalizeScope(c);
  if (scope === "case_law") return "⚖️";
  if (scope === "statute") return "📜";
  if (scope === "knowledge_base") return "📚";
  return "📁";
}

/** Get scope label for a RAG citation */
function ragScopeLabel(c: RAGCitation): string {
  const scope = normalizeScope(c);
  if (scope === "case_law") return "Case Law";
  if (scope === "statute") return "Statute";
  if (scope === "knowledge_base") return "Knowledge Base";
  if (scope === "user_document") return "User Document";
  return "Document";
}

/** Get scope badge color for a RAG citation */
function ragScopeColor(c: RAGCitation): string {
  const label = ragScopeLabel(c);
  if (label === "Case Law") return "text-amber-300 bg-amber-500/15 border-amber-500/30";
  if (label === "Statute") return "text-blue-300 bg-blue-500/15 border-blue-500/30";
  if (label === "Knowledge Base") return "text-purple-300 bg-purple-500/15 border-purple-500/30";
  return "text-emerald-300 bg-emerald-500/15 border-emerald-500/30";
}

/** Get score bar color */
function ragScoreColor(score: number): string {
  const pct = Math.round(score * 100);
  if (pct >= 70) return "bg-emerald-400";
  if (pct >= 45) return "bg-amber-400";
  return "bg-red-400";
}

export function ChatModule({ type, title, initialMessage }: { type: string; title?: string; initialMessage?: string }) {
  const isAlWakeelo = type === "al-wakeelo";
  const activeThreadStorageKey = useMemo(() => `${ACTIVE_THREAD_KEY_PREFIX}${type}`, [type]);
  const stored = chatStateStore[type];
  const [messages, setMessages] = useState<ChatMessage[]>(stored?.messages || []);
  const [input, setInput] = useState(initialMessage || "");
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<AiMode>("standard");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(stored?.shareUrl || null);
  const [sharedThreadId, setSharedThreadId] = useState<number | null>(stored?.sharedThreadId || null);
  const [restoredThreadOnce, setRestoredThreadOnce] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const appendVoiceTranscription = useCallback((text: string) => {
    setInput((previous) => previous ? `${previous}\n\n[Transcribed Audio]: ${text}` : text);
    setApiError(null);
  }, []);
  const voice = useVoiceRecorder({ onAutoTranscription: appendVoiceTranscription });
  const isTranscribing = voice.isTranscribing;
  const [ragEnabled, setRagEnabled] = useState(false);
  const [ragCaseFileId, setRagCaseFileId] = useState<number | null>(null);
  // Tool-search status: shown as a timer while AI searches case law DB
  const [toolSearchStatus, setToolSearchStatus] = useState<{
    active: boolean;
    queries: Array<{ query: string; found: number; elapsedMs: number }>;
    totalFound: number;
    totalMs: number;
  }>({ active: false, queries: [], totalFound: 0, totalMs: 0 });
  // Elapsed time counter — starts when user sends, ticks every 100ms while waiting
  const [elapsedMs, setElapsedMs] = useState(0);
  const loadStartRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [leftRailOpen, setLeftRailOpen] = useState(true);
  // Map<citation_text, judgment_id> — only citations verified to exist in DB
  const [verifiedJudgmentIds, setVerifiedJudgmentIds] = useState<Map<string, string>>(new Map());
  const [rightRailOpen, setRightRailOpen] = useState(true);
  const [tipDismissed, setTipDismissed] = useState(() => localStorage.getItem("alwakeelo-tip-dismissed") === "1");
  const dismissTip = useCallback(() => { setTipDismissed(true); localStorage.setItem("alwakeelo-tip-dismissed", "1"); }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (voice.error) setApiError(voice.error);
  }, [voice.error]);

  const { data: usage } = useQuery<UsageData>({ queryKey: ["/api/usage"] });
  const { data: threads = [] } = useQuery<ThreadSummary[]>({
    queryKey: ["/api/threads"],
    staleTime: 30_000, // 30s — allow refresh when returning from background
    refetchOnWindowFocus: true, // Mobile: refresh when user returns to app
  });
  const { data: userDocuments = [] } = useQuery<UserDocument[]>({
    queryKey: ["/api/documents"],
    enabled: isAlWakeelo,
  });
  const upgradeCheckoutHref = getUpgradeCheckoutPath(usage?.tier);
  const canUseTurbo = usage?.tier === "pro" || usage?.tier === "chamber" || usage?.tier === "enterprise";
  const normalizedAiMode = String(aiMode || "").trim().toLowerCase();
  const isApexMode =
    normalizedAiMode === "apex-pro" || normalizedAiMode === "apex-apex-pro" || normalizedAiMode === "apex";
  const selectedApexModel = isApexMode ? "apex-pro" : null;
  const turboMode = normalizedAiMode === "turbo";

  const { data: apexData } = useQuery<ApexModelsData>({
    queryKey: ["/api/apex/models"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/apex/models");
      return res.json();
    },
  });
  // Filter out removed models (Apex Pro / Apex Agent) — keep only base Apex
  const filteredApexModels = useMemo(() => {
    if (!apexData?.models) return [];
    return apexData.models.filter(m => {
      const id = m.id.toLowerCase();
      return !id.includes("apex-agent");
    });
  }, [apexData]);


  const getModelDisplayName = useCallback((modelId: string): string => {
    const modelKey = String(modelId || "").toLowerCase();
    const modelNames: Record<string, string> = {
      "standard": "Standard",
      "turbo": "Turbo",
      "deepseek-chat": "Turbo",
      "deepseek-v4-flash": "Turbo",
      "deepseek-reasoner": "DeepSeek Pro",
      "deepseek-v4-pro": "DeepSeek Pro",
      "apex-pro": "Apex",
      "apex-apex-pro": "Apex",
      "apex-agent": "Apex Pro",
      "claude sonnet 5": "Apex",
      "kimi-k2.6": "Turbo",
      "kimi-k2.5": "Turbo",
      "moonshot-v1-128k": "Turbo",
      "google/gemini-3-flash-preview": "Standard",
      "gemini-3-flash-preview": "Standard",
      "google/gemini-3-pro-preview": "Standard",
      "gemini-3-flash": "Standard",
    };
    if (modelNames[modelKey]) return modelNames[modelKey];
    if (modelKey.includes("claude")) return "Apex";
    if (modelKey.includes("deepseek")) return "DeepSeek";
    if (modelKey.includes("kimi") || modelKey.includes("moonshot")) return "Turbo";
    if (modelKey.includes("gemini")) return "Standard";
    const apexModel = apexData?.models.find(m => m.id.toLowerCase() === modelKey);
    if (apexModel) return apexModel.name;
    if (modelKey.includes("apex-pro") || modelKey.includes("apex pro")) return "Apex";
    if (modelKey.includes("apex-agent") || modelKey.includes("apex agent")) return "Apex Pro";
    return "Standard";
  }, [apexData]);

  const getModelFunctionDescription = useCallback((modelIdOrName: string): string => {
    const id = modelIdOrName.toLowerCase();
    if (id.includes("deepseek-reasoner") || id.includes("deepseek-v4-pro") || id.includes("deepseek pro")) {
      return "Advanced multi-step reasoning for complex legal problems.";
    }
    if (id.includes("deepseek")) {
      return "Turbo legal analysis optimized for speed and quality.";
    }
    if (id.includes("claude") || id.includes("apex-pro") || id.includes("apex pro")) {
      return "Claude Sonnet 5 mode for advanced legal research & analysis.";
    }
    if (id.includes("apex-agent") || id.includes("apex agent")) {
      return "Claude Sonnet 5 mode with deep reasoning.";
    }
    if (id.includes("kimi") || id.includes("moonshot")) {
      return "Turbo legal analysis optimized for speed and quality.";
    }
    if (id.includes("gemini")) {
      return "Default legal chat mode with reliable fast responses.";
    }
    if (id.includes("groq") || id.includes("standard")) {
      return "Default legal chat mode with reliable fast responses.";
    }
    const apexModel = apexData?.models.find((m) => m.id === modelIdOrName);
    if (apexModel?.description) return apexModel.description;
    return "AI legal assistant response.";
  }, [apexData]);

  const currentModeName = useCallback((): { name: string; color: string; icon: "zap" | "sparkles" | "standard" } => {
    if (normalizedAiMode === "turbo") return { name: "Turbo", color: "text-primary", icon: "zap" };
    if (isApexMode) {
      const apexModel = apexData?.models.find((m) => m.id.toLowerCase() === (selectedApexModel || normalizedAiMode));
      return { name: apexModel?.name || getModelDisplayName(selectedApexModel || normalizedAiMode), color: "text-emerald-400", icon: "sparkles" };
    }
    return { name: "Standard", color: "text-muted-foreground", icon: "standard" };
  }, [normalizedAiMode, isApexMode, selectedApexModel, apexData, getModelDisplayName]);

  useEffect(() => {
    chatStateStore[type] = { messages, shareUrl, sharedThreadId };
  }, [messages, shareUrl, sharedThreadId, type]);

  useEffect(() => {
    if (sharedThreadId && sharedThreadId > 0) {
      localStorage.setItem(activeThreadStorageKey, String(sharedThreadId));
    } else {
      localStorage.removeItem(activeThreadStorageKey);
    }
  }, [activeThreadStorageKey, sharedThreadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!showModelMenu) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-testid='button-model-selector']") && !target.closest(".model-menu-dropdown")) {
        setShowModelMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showModelMenu]);

  useEffect(() => {
    if (initialMessage && messages.length === 0) {
      handleSend(initialMessage);
    }
  }, []);

  const resizePromptInput = useCallback(() => {
    const inputEl = promptInputRef.current;
    if (!inputEl) return;
    const maxHeightPx = 176;
    inputEl.style.height = "auto";
    const nextHeight = Math.min(inputEl.scrollHeight, maxHeightPx);
    inputEl.style.height = `${Math.max(nextHeight, 44)}px`;
    inputEl.style.overflowY = inputEl.scrollHeight > maxHeightPx ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    resizePromptInput();
  }, [input, resizePromptInput]);

  // Elapsed timer — ticks every 100ms while waiting for a response
  useEffect(() => {
    if (isLoading) {
      loadStartRef.current = Date.now();
      setElapsedMs(0);
      const id = setInterval(() => {
        if (loadStartRef.current !== null) {
          setElapsedMs(Date.now() - loadStartRef.current);
        }
      }, 100);
      return () => clearInterval(id);
    } else {
      loadStartRef.current = null;
    }
  }, [isLoading]);

  const bookmarkMutation = useMutation({
    mutationFn: async (msg: ChatMessage) => {
      const idx = messages.findIndex(m => m.id === msg.id);
      const userMsg = idx > 0 ? messages.slice(0, idx).reverse().find(m => m.role === "user") : null;
      const rawTitle = userMsg 
        ? userMsg.content.replace(/\[Attached:.*?\]/g, "").trim()
        : msg.content;

      await apiRequest("POST", "/api/bookmarks", {
        title: rawTitle.trim() || "Untitled Response",
        content: msg.content,
        type: type === "al-wakeelo" ? "al-wakeelo" : type === "contract-drafting" ? "contract" : "draft",
        category: title || type,
      });
      return msg.id;
    },
    onSuccess: (msgId: string) => {
      setBookmarkedIds(prev => new Set(prev).add(msgId));
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const allowed = [".txt", ".pdf", ".docx", ".jpg", ".jpeg", ".png"];
    const allowedMimes = ["text/plain", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png"];
    const newFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (allowed.includes(ext) || allowedMimes.includes(file.type)) {
        newFiles.push(file);
      }
    }
    setAttachedFiles(prev => [...prev, ...newFiles].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (audioInputRef.current) audioInputRef.current.value = "";

    setApiError(null);
    try {
      const text = await voice.transcribe(file);
      appendVoiceTranscription(text);
    } catch (err: any) {
      setApiError(err.message || "Failed to transcribe audio");
    }
  };

  const handleVoiceRecording = async () => {
    setApiError(null);
    if (!voice.isSupported) {
      audioInputRef.current?.click();
      return;
    }

    try {
      if (!voice.isRecording) {
        await voice.startRecording();
        return;
      }
      const text = await voice.stopAndTranscribe();
      if (text) appendVoiceTranscription(text);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to transcribe audio");
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const parseAttachmentNames = useCallback((content: string): string[] => {
    const match = String(content || "").match(/\[Attached:\s*([^\]]+)\]/i);
    if (!match || !match[1]) return [];
    return match[1]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }, []);

  /** Strip embedded document text from user-facing display */
  const sanitizeUserDisplay = useCallback((content: string): string => {
    return String(content || "")
      .replace(/\[ATTACHED DOCUMENTS\][\s\S]*?\[END ATTACHED DOCUMENTS\]/g, "")
      .replace(/---\s*Attached\s+(?:DOC\/DOCX|PDF|TXT|FILE):[\s\S]*?---\s*End\s*---/gi, "")
      .replace(/\[Attached:[^\]]*\]/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }, []);

  // Use a ref to always have the latest sharedThreadId inside async callbacks,
  // avoiding stale closures that cause duplicate thread creation on mobile.
  const sharedThreadIdRef = useRef(sharedThreadId);
  useEffect(() => { sharedThreadIdRef.current = sharedThreadId; }, [sharedThreadId]);

  const persistConsultationTurn = useCallback(async (userMessage: ChatMessage, assistantMessage: ChatMessage) => {
    try {
      const currentThreadId = sharedThreadIdRef.current;
      const titleSource = String(userMessage.content || "")
        .replace(/\s*\[Attached:[^\]]+\]\s*/gi, " ")
        .trim();
      const title = (titleSource || "Al Wakeelo Consultation").slice(0, 240);
      const res = await apiRequest("POST", "/api/threads/upsert-turn", {
        threadId: currentThreadId || undefined,
        title,
        userMessage: userMessage.content,
        assistantMessage: assistantMessage.content,
      });
      const data = await res.json().catch(() => null);
      const nextThreadId = Number(data?.thread?.id || data?.threadId || 0);
      if (nextThreadId > 0 && nextThreadId !== currentThreadId) {
        setSharedThreadId(nextThreadId);
        sharedThreadIdRef.current = nextThreadId;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/threads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity/summary"] });
    } catch (err) {
      console.warn("Failed to persist consultation turn:", err);
    }
  }, []); // No deps — uses ref for sharedThreadId

  const formatRagAnswer = (answer: string, _citations: RAGCitation[]): string => {
    // Sources are rendered as rich citation cards below the message — no raw text appending.
    return answer;
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setToolSearchStatus({ active: false, queries: [], totalFound: 0, totalMs: 0 });
  };

  const handleSend = async (overrideInput?: string) => {
    const text = overrideInput || input;
    if ((!text.trim() && attachedFiles.length === 0) || isLoading) return;
    setApiError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    const fileNames = attachedFiles.map(f => f.name);
    const displayText = fileNames.length > 0
      ? `${text}${text ? "\n" : ""}[Attached: ${fileNames.join(", ")}]`
      : text;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: displayText, attachments: fileNames.length > 0 ? fileNames : undefined };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setIsLoading(true);
    setIsThinking(false);
    setToolSearchStatus({ active: false, queries: [], totalFound: 0, totalMs: 0 });

    const currentFiles = [...attachedFiles];
    setAttachedFiles([]);

    const assistantId = (Date.now() + 1).toString();

    try {
      let response: Response;



      if (ragEnabled && isAlWakeelo && text.trim().length > 0 && currentFiles.length === 0) {
        // Include recent conversation history so RAG can understand follow-up questions
        const recentHistory = updated
          .slice(-10)
          .filter((m) => m.content.trim().length > 0)
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.substring(0, 500) }));
        const ragBody: any = {
          query: text,
          documentIds: userDocuments.map((d) => d.id),
          conversationHistory: recentHistory.length > 1 ? recentHistory : undefined,
        };
        if (ragCaseFileId) ragBody.caseFileId = ragCaseFileId;
        const ragRes = await apiRequest("POST", "/api/rag/ask", ragBody);
        const ragData = await ragRes.json();
        const ragCitations: RAGCitation[] = Array.isArray(ragData?.citations) ? ragData.citations : [];
        const formatted = formatRagAnswer(String(ragData?.answer || ""), ragCitations);
        const modelName = ragData?.model?.name ? String(ragData.model.name) : "RAG";
        const modeName = "Vault Search";
        const assistantMessage: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: formatted,
          modeName,
          modelName,
          modelId: modelName,
          modelDescription: "Powered by document intelligence",
          ragCitations,
          ragConfidence: ragData?.confidence || "low",
        };
        setMessages([...updated, assistantMessage]);
        await persistConsultationTurn(userMsg, assistantMessage);
        await apiRequest("POST", "/api/search-history", { type: "chat", query: text.substring(0, 80) }).catch(() => {});
        queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
        return;
      }

      const requestedMode = isApexMode
        ? "apex"
        : (turboMode && canUseTurbo ? "turbo" : "standard");

      if (currentFiles.length > 0) {
        const formData = new FormData();
        formData.append("messages", JSON.stringify(updated.map((m) => ({ role: m.role, content: m.content }))));
        formData.append("type", type);
        formData.append("moduleIntent", "chat.general");
        formData.append("turbo", String(turboMode && canUseTurbo));
        formData.append("aiMode", requestedMode);
        if (selectedApexModel) {
          formData.append("apexModel", selectedApexModel);
        }
        formData.append("stream", "true");
        currentFiles.forEach(file => formData.append("attachments", file));
        response = await fetch("/api/ai/chat", {
          method: "POST",
          credentials: "include",
          body: formData,
          signal: controller.signal,
        });
      } else {
        response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            messages: updated.map((m) => ({ role: m.role, content: m.content })),
            type,
            moduleIntent: "chat.general",
            turbo: turboMode && canUseTurbo,
            aiMode: requestedMode,
            apexModel: selectedApexModel || undefined,
            stream: true,
          }),
          signal: controller.signal,
        });
      }

      if (!response.ok) {
        const errText = await response.text();
        const isLimitError = response.status === 429;
        throw { message: `${response.status}: ${errText}`, isLimit: isLimitError };
      }

      const contentType = response.headers.get("content-type") || "";
      let persistedAssistantContent = "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        const modelId = data.model || selectedApexModel || normalizedAiMode || "standard";
        const modelLabel = modelId ? getModelDisplayName(modelId) : undefined;
        const modelDescription = modelId ? getModelFunctionDescription(modelId) : undefined;
        const modeLabel = isApexMode
          ? getModelDisplayName(selectedApexModel || modelId)
          : (turboMode && canUseTurbo ? "Turbo" : "Standard");
        const assistantMessage: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: data.content,
          modeName: canUseTurbo ? modeLabel : undefined,
          modelName: modelLabel,
          modelId,
          modelDescription,
          moduleProfile: typeof data.moduleProfile === "string" ? data.moduleProfile : undefined,
          routingPath: Array.isArray(data.routingPath) ? data.routingPath.map(String) : undefined,
        };
        persistedAssistantContent = assistantMessage.content;
        setMessages([...updated, assistantMessage]);
      } else {
        setMessages([...updated, { id: assistantId, role: "assistant", content: "" }]);
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        if (reader) {
          let buffer = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";
              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const jsonStr = line.slice(6).trim();
                  if (!jsonStr) continue;
                  try {
                    const parsed = JSON.parse(jsonStr);
                    if (parsed.error) {
                      throw { message: parsed.error, isLimit: false };
                    }
                    // Tool-search status events — show searching indicator with timer
                    if (parsed.searching === true) {
                      setToolSearchStatus(prev => ({
                        ...prev,
                        active: true,
                        queries: [...prev.queries, { query: parsed.query, found: parsed.found ?? 0, elapsedMs: parsed.elapsedMs ?? 0 }],
                      }));
                      continue;
                    }
                    if (parsed.searching === false) {
                      setToolSearchStatus(prev => ({
                        ...prev,
                        active: false,
                        totalFound: parsed.found ?? prev.totalFound,
                        totalMs: parsed.totalMs ?? prev.totalMs,
                      }));
                      continue;
                    }
                    if (parsed.thinking === true) {
                      setIsThinking(true);
                      continue;
                    }
                    if (parsed.thinking === false) {
                      setIsThinking(false);
                      continue;
                    }
                    // Case Law Card payload — raw DB judgment hits, no AI processing.
                    // Arrives right after tool-search completes, before AI streaming.
                    if (parsed.caseLawCard && Array.isArray(parsed.caseLawCard.hits)) {
                      const cardData: CaseLawCardData = {
                        hits: parsed.caseLawCard.hits,
                        totalFound: parsed.caseLawCard.totalFound ?? parsed.caseLawCard.hits.length,
                        queriesUsed: Array.isArray(parsed.caseLawCard.queriesUsed) ? parsed.caseLawCard.queriesUsed : [],
                      };
                      setMessages(prev => {
                        const last = prev[prev.length - 1];
                        if (last && last.id === assistantId) {
                          return [...prev.slice(0, -1), { ...last, caseLawCard: cardData }];
                        }
                        return prev;
                      });
                      continue;
                    }
                    if (parsed.reset) {
                      accumulated = "";
                      setMessages(prev => {
                        const last = prev[prev.length - 1];
                        if (last && last.id === assistantId) {
                          return [...prev.slice(0, -1), { ...last, content: "" }];
                        }
                        return prev;
                      });
                      continue;
                    }
                    if (parsed.done) {
                      const modelId = parsed.model || selectedApexModel || normalizedAiMode || "standard";
                      const modelLabel = getModelDisplayName(modelId);
                      const modelDescription = getModelFunctionDescription(modelId);
                      const modeLabel = isApexMode
                        ? getModelDisplayName(selectedApexModel || modelId)
                        : (turboMode && canUseTurbo ? "Turbo" : "Standard");
                      setMessages(prev => {
                        let updated = [...prev];
                        // If the server embedded attachment text into the user message,
                        // update the stored message so follow-up requests carry the document content.
                        if (typeof parsed.embeddedAttachmentContent === "string" && parsed.embeddedAttachmentContent) {
                          const userMsgIdx = updated.findIndex(m => m.id === userMsg.id);
                          if (userMsgIdx >= 0) {
                            updated[userMsgIdx] = {
                              ...updated[userMsgIdx],
                              content: parsed.embeddedAttachmentContent,
                              displayContent: updated[userMsgIdx].content,
                            };
                          }
                        }
                        const last = updated[updated.length - 1];
                        if (last && last.id === assistantId) {
                          return [...updated.slice(0, -1), {
                            ...last,
                            modeName: canUseTurbo ? modeLabel : undefined,
                            modelName: modelLabel,
                            modelId,
                            modelDescription,
                            moduleProfile: typeof parsed.moduleProfile === "string" ? parsed.moduleProfile : undefined,
                            routingPath: Array.isArray(parsed.routingPath) ? parsed.routingPath.map(String) : undefined,
                          }];
                        }
                        return updated;
                      });
                      persistedAssistantContent = accumulated;
                      break;
                    }
                    if (parsed.text) {
                      accumulated += parsed.text;
                      const current = accumulated;
                      setMessages(prev => {
                        const last = prev[prev.length - 1];
                        if (last && last.id === assistantId) {
                          return [...prev.slice(0, -1), { ...last, content: current }];
                        }
                        return prev;
                      });
                    }
                  } catch (e: any) {
                    if (e?.isLimit !== undefined) throw e;
                  }
                }
              }
            }
          } catch (streamErr: any) {
            console.warn("Stream interrupted:", streamErr);
            if (accumulated.trim()) {
              persistedAssistantContent = accumulated;
            } else {
              throw streamErr;
            }
          }
        }
        if (!persistedAssistantContent && accumulated) {
          persistedAssistantContent = accumulated;
        }
      }

      if (persistedAssistantContent.trim()) {
        await persistConsultationTurn(userMsg, {
          id: assistantId,
          role: "assistant",
          content: persistedAssistantContent,
        });
      }

      await apiRequest("POST", "/api/search-history", { type: "chat", query: text.substring(0, 80) }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
    } catch (err: any) {
      const isLimitError = err?.isLimit || err?.status === 429 || err?.message?.includes("429");
      const serverLimitMessage = typeof err?.message === "string" && err.message.trim()
        ? err.message.trim()
        : "Your monthly usage limit has ended. Please renew your package to continue.";
      const limitMsg = isLimitError
        ? serverLimitMessage
        : "Communication with chambers disrupted. Please try again.";
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.id === assistantId && !last.content) {
          return [...prev.slice(0, -1), { id: assistantId, role: "assistant", content: limitMsg }];
        }
        if (!prev.find(m => m.id === assistantId)) {
          return [...prev, { id: assistantId, role: "assistant", content: limitMsg }];
        }
        return prev;
      });
      setApiError(isLimitError ? serverLimitMessage : (err?.message || "Communication disruption."));
      if (isLimitError) {
        queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
      }
    } finally {
      setIsLoading(false);
      setIsThinking(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setApiError(null);
    setShareUrl(null);
    setSharedThreadId(null);
    setRestoredThreadOnce(true);
    setShareError(null);
    setAttachedFiles([]);
    localStorage.removeItem(activeThreadStorageKey);
    delete chatStateStore[type];
  };

  const handleLoadThread = useCallback(async (threadId: number) => {
    try {
      const res = await apiRequest("GET", `/api/threads/${threadId}`);
      const data = await res.json();
      if (!data?.messages) return;
      const restored: ChatMessage[] = data.messages.map((m: any, idx: number) => {
        const content = String(m.content || "");
        const attachments = parseAttachmentNames(content);
        const hasEmbeddedDocs = /\[ATTACHED DOCUMENTS\]/.test(content) || /---\s*Attached\s+(?:DOC\/DOCX|PDF|TXT|FILE):/i.test(content);
        const base: ChatMessage = {
          ...(attachments.length > 0 ? { attachments } : {}),
          id: String(m.id ?? `${threadId}-${idx}`),
          role: m.role === "assistant" ? "assistant" : "user",
          content,
          ...(hasEmbeddedDocs ? { displayContent: sanitizeUserDisplay(content) } : {}),
        };
        // Reconstruct caseLawCard from the saved references block so the
        // "Case Law from Database" card re-appears when loading history.
        if (base.role === "assistant") {
          const parsed = parseReferences(content);
          if (parsed?.references?.judgments && parsed.references.judgments.length > 0) {
            base.caseLawCard = {
              hits: parsed.references.judgments.map((j) => ({
                citation: j.citation,
                title: j.title || "",
                court: j.court || "",
                snippet: j.description || "",
              })),
              totalFound: parsed.references.judgments.length,
              queriesUsed: [],
            };
          }
        }
        return base;
      });
      setMessages(restored);
      setSharedThreadId(threadId);
      setShareUrl(null);
      setShareError(null);
    } catch (err) {
      console.error("Failed to load thread:", err);
      setApiError("Failed to load consultation");
    }
  }, [parseAttachmentNames, sanitizeUserDisplay]);

  useEffect(() => {
    if (restoredThreadOnce) return;
    if (!isAlWakeelo) {
      setRestoredThreadOnce(true);
      return;
    }
    if (!threads || threads.length === 0) return;

    const raw = localStorage.getItem(activeThreadStorageKey);
    const persistedThreadId = Number(raw);
    if (!Number.isFinite(persistedThreadId) || persistedThreadId <= 0) {
      setRestoredThreadOnce(true);
      return;
    }
    const exists = threads.some((thread) => thread.id === persistedThreadId);
    if (!exists) {
      setRestoredThreadOnce(true);
      return;
    }

    setRestoredThreadOnce(true);
    void handleLoadThread(persistedThreadId);
  }, [activeThreadStorageKey, handleLoadThread, isAlWakeelo, restoredThreadOnce, threads]);

  const handleShare = async () => {
    if (messages.length < 2) return;
    setIsSharing(true);
    setShareError(null);
    try {
      let threadId = sharedThreadId;

      if (!threadId) {
        const firstUserMsg = messages.find(m => m.role === "user");
        if (!firstUserMsg) throw new Error("No user message found");
        const threadRes = await apiRequest("POST", "/api/threads/save-for-share", {
          title: firstUserMsg.content || "Al Wakeelo Conversation",
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        });
        const thread = await threadRes.json();
        threadId = thread.id;
        setSharedThreadId(threadId);
      }

      const shareRes = await apiRequest("POST", `/api/threads/${threadId}/share`);
      const shareData = await shareRes.json();
      const fullUrl = `${window.location.origin}${shareData.shareUrl}`;
      setShareUrl(fullUrl);
      try {
        await navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch (err) {
        console.error("Failed to copy share URL:", err);
      }
    } catch (err) {
      console.error("Share error:", err);
      setShareError("Failed to create share link. Please try again.");
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("Failed to copy share URL:", err);
      setShareError("Failed to copy link. Please try again.");
    }
  };

  const getFileIcon = (name: string, size = 16) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return <FileText size={size} className="text-red-400" />;
    if (ext === "doc" || ext === "docx") return <FileText size={size} className="text-blue-500" />;
    if (ext === "txt") return <FileText size={size} className="text-slate-400" />;
    if (ext === "jpg" || ext === "jpeg" || ext === "png") return <File size={size} className="text-emerald-400" />;
    return <File size={size} className="text-muted-foreground" />;
  };

  const getFileExtBadge = (name: string) => {
    const ext = name.split(".").pop()?.toUpperCase() || "FILE";
    const colors: Record<string, string> = {
      PDF: "bg-red-500/20 text-red-300",
      DOC: "bg-blue-500/20 text-blue-300",
      DOCX: "bg-blue-500/20 text-blue-300",
      TXT: "bg-slate-500/20 text-slate-300",
      JPG: "bg-emerald-500/20 text-emerald-300",
      JPEG: "bg-emerald-500/20 text-emerald-300",
      PNG: "bg-emerald-500/20 text-emerald-300",
    };
    return <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${colors[ext] || "bg-muted text-muted-foreground"}`}>{ext}</span>;
  };

  const parsedAssistantMessages = useMemo(() => {
    const parsedById = new Map<string, ReturnType<typeof parseReferences>>();
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      parsedById.set(message.id, parseReferences(message.content));
    }
    return parsedById;
  }, [messages]);

  const extractInlineReferences = (text: string) => {
    const citations: Array<{ citation: string; court?: string }> = [];
    const statutes: Array<{ name: string; section?: string }> = [];

    // Enhanced citation pattern to catch more Pakistani legal citation formats
    const citationPattern = /\b(\d{4}\s+(?:P\.?\s*L\.?\s*D|S\.?\s*C\.?\s*M\.?\s*R|Y\.?\s*L\.?\s*R|M\.?\s*L\.?\s*D|C\.?\s*L\.?\s*C|P\.?\s*C\.?\s*R\.?\s*L\.?\s*J|P\.?\s*L\.?\s*J|N\.?\s*L\.?\s*R|C\.?\s*L\.?\s*D|P\.?\s*T\.?\s*D|P\.?\s*L\.?\s*C|SCMR|PLJ|CLD|LHC|IHC|SHC)\s+\d+)\b/gi;

    // Enhanced statute pattern to catch Section X PPC/CPC/IPC and other references
    const statutePattern = /\b(?:Section\s+\d+(?:\s+(?:PPC|CPC|IPC|PCA|PMLA|BNPL|SECP))?|(?:PPC|CPC|IPC|PMLA|BNPL|SECP|Income Tax Ordinance|Constitution|Qanun-e-Shahadat|Criminal Procedure Code|Civil Procedure Code)\s+(?:\d{4}|Section|Ordinance|Act|Code)?\s*\d*)\b/gi;

    let match;
    const seenCitations = new Set<string>();
    while ((match = citationPattern.exec(text)) !== null) {
      const citation = match[0];
      if (!seenCitations.has(citation)) {
        seenCitations.add(citation);
        citations.push({ citation });
      }
    }

    const seenStatutes = new Set<string>();
    while ((match = statutePattern.exec(text)) !== null) {
      const statute = match[0];
      if (!seenStatutes.has(statute)) {
        seenStatutes.add(statute);
        statutes.push({ name: statute });
      }
    }

    return { citations, statutes };
  };

  const latestAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const latestParsed = latestAssistantMessage ? parsedAssistantMessages.get(latestAssistantMessage.id) ?? null : null;
  const latestRefs = latestParsed?.references ?? null;
  const latestRagCitations = latestAssistantMessage?.ragCitations || [];
  const latestInlineReferences = latestAssistantMessage ? extractInlineReferences(latestAssistantMessage.content) : { citations: [], statutes: [] };
  const latestStatuteFallback = useMemo(() => {
    const statuteLike = /(?:\bact\b|\bord(?:inance)?\b|\bcode\b|\brules?\b|\bconstitution\b|\bsection\b)/i;
    return latestRagCitations
      .filter((c) => statuteLike.test(c.title || c.quote || ""))
      .slice(0, 8)
      .map((c) => ({
        name: c.title || "Pakistani Statute",
        section: `Chunk ${c.chunkIndex}`,
        description: c.quote || "",
      }));
  }, [latestRagCitations]);
  const latestStatutes = (latestRefs?.laws?.length || 0) > 0 ? latestRefs!.laws.slice(0, 8) : latestStatuteFallback;

  const deduplicatedStatutes = useMemo(() => {
    interface InternalItem {
      key: string;
      alias: string;
      sectionNum: string;
      name: string;
      section: string;
      description?: string;
      query: string;
      source: 'structured' | 'inline' | 'fallback';
    }

    const items: InternalItem[] = [];

    const detectLaw = (str: string) => {
      const s = str.toLowerCase();
      if (s.includes("pakistan penal code") || s.includes("ppc") || s.includes("penal code")) {
        return { alias: "ppc", canonical: "Pakistan Penal Code, 1860" };
      }
      if (s.includes("criminal procedure") || s.includes("crpc") || s.includes("code of criminal")) {
        return { alias: "crpc", canonical: "Code of Criminal Procedure, 1898" };
      }
      if (s.includes("civil procedure") || s.includes("cpc") || s.includes("code of civil")) {
        return { alias: "cpc", canonical: "Code of Civil Procedure, 1908" };
      }
      if (s.includes("qanun-e-shahadat") || s.includes("qso") || s.includes("qanun e shahadat")) {
        return { alias: "qso", canonical: "Qanun-e-Shahadat Order, 1984" };
      }
      if (s.includes("constitution")) {
        return { alias: "constitution", canonical: "Constitution of Pakistan" };
      }
      return null;
    };

    const extractSectionNum = (str: string) => {
      const yearPattern = /\b(1860|1898|1908|1973|1984)\b/g;
      const cleanStr = str.replace(yearPattern, "");

      const secMatch = cleanStr.match(/(?:section|sec\.?|article|art\.?)\s*([a-z\d\-\(\)]+)/i);
      if (secMatch) return secMatch[1].trim();

      const fallbackMatch = cleanStr.match(/\b(\d+(?:-[a-z\d]+)?)\b/i);
      if (fallbackMatch) return fallbackMatch[1].trim();

      return null;
    };

    latestStatutes.forEach((law) => {
      const isFallback = law.section?.startsWith("Chunk");
      const lawDetect = detectLaw(law.name);
      
      let sectionNum = "";
      if (!isFallback && law.section) {
        sectionNum = extractSectionNum(law.section) || "";
      }
      
      const alias = lawDetect ? lawDetect.alias : law.name.toLowerCase().trim();
      const canonicalName = lawDetect ? lawDetect.canonical : law.name;
      const key = sectionNum ? `${alias}-${sectionNum.toLowerCase()}` : `${alias}-${law.section || ""}`;
      const query = law.section && !isFallback ? `${canonicalName} ${law.section}` : canonicalName;

      items.push({
        key,
        alias,
        sectionNum,
        name: canonicalName,
        section: law.section || "Section reference",
        description: law.description,
        query,
        source: isFallback ? 'fallback' : 'structured'
      });
    });

    if (latestInlineReferences?.statutes) {
      latestInlineReferences.statutes.forEach((statute) => {
        const lawDetect = detectLaw(statute.name);
        const sectionNum = extractSectionNum(statute.name) || "";
        
        const alias = lawDetect ? lawDetect.alias : "unknown";
        const canonicalName = lawDetect ? lawDetect.canonical : "Pakistani Statute";
        
        const key = sectionNum ? `${alias}-${sectionNum.toLowerCase()}` : `inline-${statute.name.toLowerCase()}`;
        const query = statute.name;

        items.push({
          key,
          alias,
          sectionNum,
          name: alias !== "unknown" ? canonicalName : statute.name,
          section: alias !== "unknown" ? `Section ${sectionNum}` : "Click to view statute",
          query,
          source: 'inline'
        });
      });
    }

    const uniqueMap = new Map<string, InternalItem>();
    items.forEach((item) => {
      const existing = uniqueMap.get(item.key);
      if (!existing) {
        uniqueMap.set(item.key, item);
      } else {
        const existingPriority = existing.source === 'structured' ? 3 : existing.source === 'inline' ? 2 : 1;
        const currentPriority = item.source === 'structured' ? 3 : item.source === 'inline' ? 2 : 1;

        if (currentPriority > existingPriority) {
          uniqueMap.set(item.key, item);
        } else if (currentPriority === existingPriority) {
          if (!existing.description && item.description) {
            uniqueMap.set(item.key, item);
          }
        }
      }
    });

    const finalItems: InternalItem[] = [];
    const allSpecificKeys = Array.from(uniqueMap.keys()).filter(k => !k.startsWith("unknown-"));

    uniqueMap.forEach((item) => {
      if (item.alias === "unknown" && item.sectionNum) {
        const targetSuffix = `-${item.sectionNum.toLowerCase()}`;
        const hasSpecificMatch = allSpecificKeys.some(k => k.endsWith(targetSuffix));
        if (hasSpecificMatch) {
          return;
        }
      }
      finalItems.push(item);
    });

    return finalItems;
  }, [latestStatutes, latestInlineReferences?.statutes]);

  const aiConfidence = useMemo(() => {
    if (latestRagCitations.length > 0) {
      const scores = latestRagCitations.map((c) => Number(c.score) || 0).filter((n) => n > 0);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.45;
      const pct = Math.max(35, Math.min(98, Math.round(avg * 100)));
      const level = pct >= 80 ? "High" : pct >= 60 ? "Medium" : "Low";
      return { pct, level, basis: "RAG retrieval score from indexed documents." };
    }

    const lawCount = latestRefs?.laws?.length || 0;
    const judgmentCount = latestRefs?.judgments?.length || 0;
    const total = lawCount + judgmentCount;
    const pct = total === 0 ? 28 : Math.max(45, Math.min(90, 50 + total * 8));
    const level = pct >= 80 ? "High" : pct >= 60 ? "Medium" : "Low";
    return { pct, level, basis: "Current response references (laws + judgments)." };
  }, [latestRagCitations, latestRefs]);

  // Verify all citations against DB after each AI response — only show ones that actually exist
  useEffect(() => {
    if (isLoading || !latestAssistantMessage) {
      setVerifiedJudgmentIds(new Map());
      return;
    }

    const allCitations = new Set<string>();
    latestRefs?.judgments?.forEach(j => j.citation && allCitations.add(j.citation));
    latestInlineReferences?.citations?.forEach(c => c.citation && allCitations.add(c.citation));

    if (allCitations.size === 0) {
      setVerifiedJudgmentIds(new Map());
      return;
    }

    Promise.all(
      [...allCitations].map(async (citation) => {
        try {
          const res = await fetch(`/api/caseLaw/lookup?q=${encodeURIComponent(citation)}`);
          const data = await res.json();
          return data.found && data.id ? ([citation, String(data.id)] as [string, string]) : null;
        } catch {
          return null;
        }
      })
    ).then(results => {
      const verified = new Map<string, string>();
      results.forEach(r => r && verified.set(r[0], r[1]));
      setVerifiedJudgmentIds(verified);
    });
  }, [latestAssistantMessage?.id, isLoading]);

  // Helper function to open statute directly if found, else fallback to search
  const openStatute = async (statuteName: string) => {
    try {
      const res = await apiRequest("GET", `/api/statute/lookup?q=${encodeURIComponent(statuteName)}`);
      const data = await res.json();
      if (data.found && data.id) {
        // Open statute directly, with deep link to section if available
        const url = data.section 
          ? `/statute-view/${data.id}?section=${encodeURIComponent(data.section)}`
          : `/statute-view/${data.id}`;
        window.open(url, '_blank');
      } else {
        // Fallback to search if not found
        window.open(`/statute-search?q=${encodeURIComponent(statuteName)}`, '_blank');
      }
    } catch (err) {
      console.error("Error looking up statute:", err);
      // Fallback to search on error
      window.open(`/statute-search?q=${encodeURIComponent(statuteName)}`, '_blank');
    }
  };

  // Helper function to open judgment directly if found, else fallback to search
  const openJudgment = async (citation: string, id?: string) => {
    if (id) {
      window.open(`/judgment/${id}`, '_blank');
      return;
    }
    try {
      const res = await apiRequest("GET", `/api/caseLaw/lookup?q=${encodeURIComponent(citation)}`);
      const data = await res.json();
      if (data.found && data.id) {
        // Open judgment directly
        window.open(`/judgment/${data.id}`, '_blank');
      } else {
        // Fallback to search if not found
        window.open(`/judgments?q=${encodeURIComponent(citation)}`, '_blank');
      }
    } catch (err) {
      console.error("Error looking up judgment:", err);
      // Fallback to search on error
      window.open(`/judgments?q=${encodeURIComponent(citation)}`, '_blank');
    }
  };

  const renderInsightsCards = (compact = false) => (
    <div className={compact ? "space-y-5" : "space-y-8 max-w-[15rem] mx-auto"}>
      <div>
        <h3 className="flex items-center gap-2 text-[11px] font-bold text-primary uppercase tracking-widest mb-4">
          <FileText size={13} /> Legal Citations
        </h3>
        <div className="space-y-3">
          {(latestRagCitations?.length || 0) > 0 && latestRagCitations.filter(isVisibleCitation).slice(0, compact ? 3 : 4).map((c, idx) => (
            <div key={`rag-${c.sourceDocumentId}-${c.chunkIndex}-${idx}`} className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10">
              <div className="flex justify-between items-start mb-2 gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${ragScopeColor(c)}`}>
                  {ragScopeIcon(c)} {ragScopeLabel(c)}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-12 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${ragScoreColor(c.score)}`} style={{ width: `${Math.round(c.score * 100)}%` }} />
                  </div>
                  <span className="text-[9px] text-muted-foreground tabular-nums">{Math.round(c.score * 100)}%</span>
                </div>
              </div>
              <p className="text-xs font-bold text-foreground mb-1">{cleanRagTitle(c.title)}</p>
              {c.quote && <p className="text-[10px] text-muted-foreground leading-relaxed italic line-clamp-3">{c.quote}</p>}
            </div>
          ))}
          {(latestRefs?.judgments?.length || 0) > 0 && latestRefs?.judgments
            .filter(j => verifiedJudgmentIds.has(j.citation))
            .slice(0, compact ? 3 : 4).map((j, idx) => {
              const jid = verifiedJudgmentIds.get(j.citation)!;
              return (
                <button key={`${j.citation}-${idx}`} className="p-3 rounded-xl bg-card/50 border border-border hover:border-primary/30 transition-all cursor-pointer text-left w-full" onClick={() => window.open(`/judgment/${jid}`, '_blank')} onKeyDown={(e) => e.key === 'Enter' && window.open(`/judgment/${jid}`, '_blank')}>
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded truncate">{j.citation}</span>
                  </div>
                  <p className="text-xs font-bold text-foreground mb-1">{j.court || "Pakistani Courts"}</p>
                  {j.description && <p className="text-[10px] text-muted-foreground leading-relaxed italic line-clamp-3">{j.description}</p>}
                </button>
              );
            })}
          {(latestInlineReferences?.citations?.length || 0) > 0 && latestInlineReferences?.citations
            .filter(c => verifiedJudgmentIds.has(c.citation))
            .slice(0, compact ? 2 : 3).map((c, idx) => {
              const jid = verifiedJudgmentIds.get(c.citation)!;
              return (
                <button key={`inline-citation-${idx}`} className="p-3 rounded-xl bg-primary/5 border border-primary/20 hover:border-primary/50 transition-all cursor-pointer text-left w-full" onClick={() => window.open(`/judgment/${jid}`, '_blank')} onKeyDown={(e) => e.key === 'Enter' && window.open(`/judgment/${jid}`, '_blank')}>
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded truncate">{c.citation}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Click to view judgment</p>
                </button>
              );
            })}
          {!latestRefs && (latestRagCitations?.length || 0) === 0 && (
            <p className="text-xs text-muted-foreground">Citations from Al Wakeelo responses will appear here.</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="flex items-center gap-2 text-[11px] font-bold text-primary uppercase tracking-widest mb-4">
          <Scale size={13} /> Relevant Statutes
        </h3>
        <div className="space-y-2">
          {deduplicatedStatutes.length > 0 ? (
            deduplicatedStatutes.slice(0, compact ? 6 : 10).map((law) => (
              <button key={law.key} className="flex items-start gap-3 p-2 group cursor-pointer hover:bg-primary/5 rounded transition-colors w-full text-left" onClick={() => openStatute(law.query)} onKeyDown={(e) => e.key === 'Enter' && openStatute(law.query)}>
                <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shadow-sm shadow-primary/60 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                    {law.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{law.section}</p>
                  {law.description && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{law.description}</p>
                  )}
                </div>
              </button>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">Relevant statutes will appear here when Al Wakeelo cites them in responses.</p>
          )}
        </div>
      </div>

      <div className="mt-auto p-4 rounded-xl bg-primary/5 border border-primary/20">
        <p className="text-[10px] font-bold text-primary uppercase mb-2">AI Confidence</p>
        <div className="w-full bg-card h-1 rounded-full overflow-hidden">
          <div className="bg-primary h-full transition-all duration-300" style={{ width: `${aiConfidence.pct}%` }} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">{aiConfidence.level} ({aiConfidence.pct}%) · {aiConfidence.basis}</p>
      </div>
    </div>
  );

  if (!isAlWakeelo) {
    return (
      <div className="flex flex-col h-[calc(100vh-120px)] bg-card border border-border rounded-2xl overflow-hidden shadow-lg relative fade-in">
        <div className="p-4 md:p-6 bg-card border-b border-border flex items-center justify-between z-20">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Scale size={20} />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-semibold text-foreground capitalize">{title || type.replace("-", " ")}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${apiError ? "bg-[#DC2626]" : "bg-emerald-500"}`} />
                <p className="text-[8px] md:text-[9px] text-muted-foreground font-semibold uppercase tracking-widest">
                  {apiError ? "Engine Throttled" : "Active"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {shareError && (
              <span className="text-[9px] text-[#DC2626] font-semibold">{shareError}</span>
            )}
            {messages.length >= 2 && (
              <button
                onClick={shareUrl ? handleCopyShareUrl : handleShare}
                disabled={isSharing}
                data-testid="button-share-chat"
                className={`px-3 py-2 rounded-lg text-[9px] md:text-[10px] font-semibold uppercase tracking-wide flex items-center gap-2 transition-all duration-150 ${
                  shareUrl
                    ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                    : "hover:bg-primary/10 text-muted-foreground hover:text-primary"
                }`}
              >
                {isSharing ? (
                  <><Loader2 size={12} className="animate-spin" /> Sharing...</>
                ) : copied ? (
                  <><Check size={12} /> Copied</>
                ) : shareUrl ? (
                  <><Copy size={12} /> Copy</>
                ) : (
                  <><Share2 size={12} /> Share</>
                )}
              </button>
            )}
            <button
              onClick={handleClear}
              data-testid="button-clear-chat"
              className="px-3 py-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive text-[9px] md:text-[10px] font-semibold uppercase tracking-wide flex items-center gap-2 transition-all duration-150"
            >
              <Trash2 size={14} /> Reset
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-5 sm:space-y-6 scrollbar-hide bg-muted px-3 sm:px-4 md:px-8 py-3 sm:py-4 md:py-6 flex flex-col">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <Scale size={48} className="text-muted-foreground" />
              <p className="text-muted-foreground italic text-sm md:text-base" style={{ fontFamily: "'EB Garamond', serif" }}>
                "Main hoon Al Wakeelo -- not just your lawyer, your strategy partner in justice."
              </p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">Ask about your contract or legal matter</p>
            </div>
          )}

          <div className="max-w-2xl mx-auto w-full">
          {messages.map((m) => {
            const parsed = m.role === "assistant" ? parsedAssistantMessages.get(m.id) ?? null : null;
            const displayContent = parsed ? parsed.cleanContent : (m.displayContent || m.content);
            return (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} slide-in-from-bottom-2 gap-2 mb-1`}
                style={OFFSCREEN_MESSAGE_STYLE}
              >
                {m.role === "assistant" && (
                  <div className="w-8 h-8 rounded-md bg-card flex items-center justify-center flex-shrink-0 mt-1">
                    <Scale size={16} className="text-foreground" />
                  </div>
                )}
                <div
                  className={`flex-1 p-3 sm:p-4 md:p-5 rounded-2xl relative group ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-none max-w-2xl shadow-md hover:shadow-lg transition-shadow"
                      : "bg-card border border-border text-foreground rounded-bl-none shadow-sm hover:shadow-md transition-shadow"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <>
                      {(m.modeName || m.modelName) && (
                        <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-border">
                          <div className="flex flex-col gap-0.5">
                            {m.modeName && (
                              <span className={`text-[7px] font-semibold uppercase tracking-wider ${
                                m.modeName === "Turbo" ? "text-amber-700 dark:text-amber-500" :
                                m.modeName === "Standard" ? "text-muted-foreground" :
                                "text-emerald-600"
                              }`}>
                                {m.modeName === "Turbo" && <Zap size={8} className="inline mr-0.5" />}
                                {m.modeName !== "Turbo" && m.modeName !== "Standard" && <Sparkles size={8} className="inline mr-0.5" />}
                                {m.modeName}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      <LegalMarkdown content={displayContent} />

                      {/* Integrated Legal Context Strip */}
                      {((m.ragCitations?.length || 0) > 0 || (parsed?.references && (parsed.references.judgments.length + parsed.references.laws.length) > 0)) && (
                        <div className="mt-4 pt-4 border-t border-[#E9EEF5] space-y-2">
                          {/* Case Law Citations */}
                          {(m.ragCitations?.length || 0) > 0 && (
                            <div className="space-y-2">
                              {m.ragCitations!.slice(0, 2).map((c, idx) => (
                                <div key={`${c.sourceDocumentId}-${c.chunkIndex}-${idx}`} className="flex gap-3 p-3 rounded-lg bg-muted border border-border hover:border-primary/30 transition-colors duration-150">
                                  <Gavel size={16} className="text-primary flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold text-foreground truncate">{c.title}</p>
                                    <p className="text-[9px] text-muted-foreground mt-1">Relevance: {Math.round(c.score * 100)}%</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* References/Definitions */}
                          {parsed?.references && parsed.references.judgments.length > 0 && (
                            <div className="space-y-2">
                              {parsed.references.judgments.slice(0, 2).map((ref) => ({ title: ref.citation, name: ref.citation, description: ref.description }))
                                .slice(0, 2).map((ref, idx) => (
                                  <div key={idx} className="flex gap-3 p-3 rounded-lg bg-muted border border-border hover:border-primary/30 transition-colors duration-150">
                                    <Link2 size={16} className="text-primary flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[10px] font-semibold text-foreground truncate">{ref.title || ref.name}</p>
                                      {ref.description && (
                                        <p className="text-[9px] text-muted-foreground mt-1 line-clamp-1">{ref.description}</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-sm whitespace-pre-wrap leading-normal">{sanitizeUserDisplay(m.displayContent || displayContent || m.content)}</p>
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="flex flex-col gap-2 mt-3 pt-2.5 border-t border-white/10">
                          {m.attachments.map((name, i) => (
                            <div key={i} className="flex items-center gap-2.5 px-3 py-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/15 transition-colors">
                              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                                {getFileIcon(name, 16)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold truncate">{name}</p>
                                <p className="text-[9px] text-white/50">Attached document</p>
                              </div>
                              {getFileExtBadge(name)}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {m.role === "assistant" && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
                      <button
                        onClick={() => !bookmarkedIds.has(m.id) && !bookmarkMutation.isPending && bookmarkMutation.mutate(m)}
                        disabled={bookmarkMutation.isPending}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-all duration-150 border disabled:opacity-50 disabled:cursor-not-allowed ${
                          bookmarkedIds.has(m.id)
                            ? "border-primary/50 text-primary bg-primary/10"
                            : "border-border text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5"
                        }`}
                        data-testid="button-bookmark"
                        title={bookmarkedIds.has(m.id) ? "Bookmarked" : "Save to Bookmarks"}
                      >
                        {bookmarkedIds.has(m.id) ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                        {bookmarkedIds.has(m.id) ? "Saved" : "Save"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>

        </div>

        {apiError && (
          <div className="px-6 py-2 bg-red-500/10 border-t border-red-500/20 flex items-center gap-3">
            <AlertCircle size={14} className="text-red-500" />
            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">{apiError}</span>
          </div>
        )}

        {usage && usage.percentage >= 80 && usage.percentage < 100 && (
          <div className="px-6 py-2.5 bg-primary/10 border-t border-primary/20 flex items-center justify-between gap-3" data-testid="banner-usage-warning">
            <div className="flex items-center gap-2">
              <Crown size={14} className="text-primary" />
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                {usage.remaining} actions remaining this month
              </span>
            </div>
            <a href={upgradeCheckoutHref} className="flex items-center gap-1 text-[10px] font-black text-primary uppercase tracking-widest hover:text-primary transition-colors" data-testid="link-upgrade-warning">
              Upgrade <ArrowUpRight size={10} />
            </a>
          </div>
        )}

        {usage && usage.percentage >= 100 && (
          <div className="px-6 py-3 bg-red-500/10 border-t border-red-500/20 flex items-center justify-between gap-3" data-testid="banner-usage-limit">
            <div className="flex items-center gap-2">
              <Lock size={14} className="text-red-500" />
              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">
                Monthly limit reached ({usage.used}/{usage.monthlyLimit} actions)
              </span>
            </div>
            <a href={upgradeCheckoutHref} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-colors" data-testid="link-upgrade-limit">
              Upgrade Now <ArrowUpRight size={10} />
            </a>
          </div>
        )}

        <div className="p-4 md:p-6 bg-card border-t border-border">
          <div className="flex items-center gap-2 mb-3 px-2 flex-wrap">
            <div className="relative">
              <button
                onClick={() => setShowModelMenu(!showModelMenu)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-semibold uppercase tracking-wide transition-all border duration-150 ${
                  normalizedAiMode === "turbo"
                    ? "bg-amber-600/10 text-amber-700 dark:text-amber-500 border-amber-600/30"
                    : isApexMode
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      : "text-muted-foreground border-border hover:border-primary hover:text-primary"
                }`}
                data-testid="button-model-selector"
              >
                {normalizedAiMode === "turbo" ? (
                  <Zap size={12} className="text-primary" />
                ) : isApexMode ? (
                  <Sparkles size={12} className="text-emerald-400" />
                ) : (
                  <Scale size={12} />
                )}
                {currentModeName().name}
                <ChevronDown size={10} />
              </button>
              {showModelMenu && (
                <div className="model-menu-dropdown absolute bottom-full left-0 mb-2 bg-card border border-border rounded-xl shadow-2xl overflow-hidden min-w-[260px] z-50">
                  <div className="px-4 py-2 text-[9px] text-muted-foreground uppercase tracking-widest font-bold border-b border-border/50 bg-card/50">
                    Select AI Model
                  </div>
                  <button
                    onClick={() => { setAiMode("standard"); setShowModelMenu(false); }}
                    className={`w-full text-left px-4 py-3 text-xs hover:bg-card transition-colors border-b border-border/50 ${normalizedAiMode === "standard" ? "bg-card text-foreground" : "text-muted-foreground"}`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <Scale size={11} className="text-muted-foreground" />
                      Standard
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Fast, reliable responses</div>
                  </button>
                  {canUseTurbo && (
                    <button
                      onClick={() => { setAiMode("turbo"); setShowModelMenu(false); }}
                      className={`w-full text-left px-4 py-3 text-xs hover:bg-card transition-colors border-b border-border/50 ${normalizedAiMode === "turbo" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        <Zap size={11} className="text-primary" />
                        Turbo
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Deep reasoning & analysis (avg. response 3-5 mins)</div>
                    </button>
                  )}
                  {!canUseTurbo && (
                    <div className="w-full text-left px-4 py-3 text-xs text-muted-foreground border-b border-border/50">
                      <div className="font-bold flex items-center gap-1.5">
                        <Lock size={10} className="text-muted-foreground" />
                        Turbo
                        <span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-black">PRO</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Upgrade to Pro to unlock</div>
                    </div>
                  )}
                  {canUseTurbo && filteredApexModels.length > 0 && (
                    <>
                      {filteredApexModels.map(model => (
                        <button
                          key={model.id}
                          onClick={() => { setAiMode(model.id); setShowModelMenu(false); }}
                          className={`w-full text-left px-4 py-3 text-xs hover:bg-card transition-colors border-b border-border/50 last:border-0 ${normalizedAiMode === model.id.toLowerCase() ? "bg-emerald-500/10 text-emerald-400" : "text-muted-foreground"}`}
                        >
                          <div className="font-bold flex items-center gap-1.5">
                            <Sparkles size={11} className="text-emerald-500" />
                            {model.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">Advanced legal research & analysis</div>
                        </button>
                      ))}
                    </>
                  )}
                  {!canUseTurbo && (
                    <div className="px-4 py-2 text-[9px] text-muted-foreground border-t border-border/30">
                      Upgrade to Pro for more models
                    </div>
                  )}
                </div>
              )}
            </div>

            <span className={`text-[9px] tracking-wide ${currentModeName().color}`}>
              {normalizedAiMode === "standard" ? "" :
                normalizedAiMode === "turbo" ? "Deep reasoning mode (avg. response 3-5 mins)" :
                `Using ${currentModeName().name}`}
            </span>
          </div>

          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 px-3">
              {attachedFiles.map((file, i) => (
                <div key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-xl text-[11px] text-foreground font-medium">
                  {getFileIcon(file.name)}
                  <span className="max-w-[120px] truncate">{file.name}</span>
                  <span className="text-[9px] text-muted-foreground">({(file.size / 1024).toFixed(0)}KB)</span>
                  <button onClick={() => removeFile(i)} className="ml-1 text-muted-foreground hover:text-red-400 transition-colors">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {isTranscribing && (
            <div className="flex items-center gap-2 mb-2 px-3">
              <Loader2 size={14} className="animate-spin text-primary" />
              <span className="text-[10px] text-primary font-black uppercase tracking-widest">Transcribing audio...</span>
            </div>
          )}


          <div className="flex gap-1.5 sm:gap-2 bg-card border border-border p-2.5 sm:p-3 rounded-xl shadow-sm items-end">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".txt,.pdf,.docx,.jpg,.jpeg,.png,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
              multiple
              className="hidden"
            />
            <input
              type="file"
              ref={audioInputRef}
              onChange={handleAudioSelect}
              accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || attachedFiles.length >= 5}
              className="min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center p-1.5 sm:p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Attach document (TXT, PDF, DOCX)"
            >
              <Paperclip size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>

            <button
              onClick={handleVoiceRecording}
              disabled={isLoading || isTranscribing}
              className={`min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center p-1.5 sm:p-2 rounded-lg transition-all duration-150 ${
                voice.isRecording
                  ? "text-red-500 bg-red-500/10 animate-pulse"
                  : isTranscribing
                    ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/10"
              } disabled:opacity-30 disabled:cursor-not-allowed`}
              title={voice.isRecording ? `Stop recording · ${formatDuration(voice.duration)}` : "Record voice message"}
            >
              {voice.isRecording
                ? <Square size={15} fill="currentColor" />
                : <Mic size={16} className="sm:w-[18px] sm:h-[18px]" />}
            </button>

            <button
              onClick={() => audioInputRef.current?.click()}
              disabled={isLoading || isTranscribing || voice.isRecording}
              className="min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center p-1.5 sm:p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Upload audio file (MP3, WAV, M4A, WebM)"
            >
              <File size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>

            <textarea
              ref={promptInputRef}
              rows={1}
              spellCheck="true"
              autoCorrect="on"
              className="flex-1 min-h-[40px] sm:min-h-[44px] max-h-40 sm:max-h-44 resize-none overflow-y-auto bg-transparent border-none px-2.5 sm:px-3 py-1.5 sm:py-2 text-sm text-foreground leading-6 focus:ring-0 focus:outline-none placeholder:text-muted-foreground"
              placeholder="Ask about your contract..."
              value={input}
              onInput={resizePromptInput}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              data-testid="input-chat"
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || isTranscribing || voice.isRecording}
              data-testid="button-send"
              className="min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center p-1.5 sm:p-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 shadow-sm transition-all duration-150 active:scale-95 disabled:opacity-50 font-semibold flex-shrink-0"
            >
              <Send size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const leftRailVisible = leftRailOpen;
  const rightRailVisible = rightRailOpen;

  return (
    <div className="h-full w-full min-h-0 rounded-2xl overflow-hidden border border-border/70 bg-background shadow-xl fade-in">
      <div className="relative h-full w-full">
        <aside
          className={`hidden lg:flex absolute left-3 top-28 xl:top-20 bottom-44 z-30 transition-[width,opacity,transform] duration-300 ease-out overflow-hidden ${
            leftRailVisible
              ? "w-64 opacity-100 translate-x-0"
              : "w-0 opacity-0 -translate-x-3 pointer-events-none"
          }`}
        >
          <div className="p-5 flex flex-col h-full w-64 rounded-2xl border border-primary/20 bg-background/85 backdrop-blur-xl shadow-[0_20px_45px_rgba(120,53,15,0.28)]">
            <button
              onClick={handleClear}
              className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 text-primary-foreground w-full py-3 rounded-xl font-bold transition-all shadow-lg shadow-primary/25 mb-6"
              data-testid="button-new-consultation"
            >
              <PlusCircle size={18} />
              <span>New Consultation</span>
            </button>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-hide">
              <h3 className="text-[11px] font-bold text-primary/70 uppercase tracking-widest mb-3 px-2">Recent Consultations</h3>
              {threads.slice(0, 12).map((thread) => {
                const isActive = sharedThreadId === thread.id;
                return (
                  <button
                    key={thread.id}
                    onClick={() => handleLoadThread(thread.id)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                      isActive
                        ? "bg-primary/10 border-primary/25"
                        : "hover:bg-muted border-transparent"
                    }`}
                    data-testid={`thread-item-${thread.id}`}
                  >
                    {isActive ? <FolderOpen size={16} className="text-primary shrink-0" /> : <Folder size={16} className="text-muted-foreground shrink-0" />}
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${isActive ? "text-primary" : "text-foreground"}`}>
                        {thread.title || "Untitled Consultation"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{thread.createdAt ? new Date(thread.createdAt).toLocaleString() : "Recent"}</p>
                    </div>
                  </button>
                );
              })}
              {threads.length === 0 && (
                <p className="text-xs text-muted-foreground px-2">No consultations yet.</p>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-primary/10" />
          </div>
        </aside>

        <div className="hidden lg:flex absolute left-3 top-1/2 -translate-y-1/2 z-40">
          <button
            onClick={() => setLeftRailOpen((prev) => !prev)}
            className="h-16 w-6 border border-border rounded-r-lg bg-card hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center transition-all"
            data-testid="divider-toggle-left-chat-rail"
            title={leftRailVisible ? "Collapse workspace panel" : "Expand workspace panel"}
            aria-label={leftRailVisible ? "Collapse workspace panel" : "Expand workspace panel"}
          >
            {leftRailVisible ? <ChevronLeft size={15} className="drop-shadow" /> : <ChevronRight size={15} className="drop-shadow" />}
          </button>
        </div>

        <main className="h-full flex flex-col bg-background">

          {/* Mobile thread drawer — visible only on screens < lg */}
          <section className="lg:hidden border-b border-primary/10 bg-background/55 px-3 sm:px-6 py-2">
            <details className="group">
              <summary className="list-none cursor-pointer flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-primary">
                <span className="inline-flex items-center gap-2">
                  <History size={13} />
                  Recent Consultations
                  {threads.length > 0 && (
                    <span className="text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">{threads.length}</span>
                  )}
                </span>
                <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
              </summary>
              <div className="pt-3 max-h-[40vh] overflow-y-auto pr-1 scrollbar-hide space-y-1">
                <button
                  onClick={handleClear}
                  className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground w-full py-2.5 rounded-xl font-bold transition-all shadow-md shadow-primary/20 mb-3 text-xs"
                >
                  <PlusCircle size={14} />
                  <span>New Consultation</span>
                </button>
                {threads.slice(0, 15).map((thread) => {
                  const isActive = sharedThreadId === thread.id;
                  return (
                    <button
                      key={thread.id}
                      onClick={() => handleLoadThread(thread.id)}
                      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                        isActive
                          ? "bg-primary/10 border-primary/25"
                          : "hover:bg-muted border-transparent"
                      }`}
                    >
                      {isActive ? <FolderOpen size={14} className="text-primary shrink-0" /> : <Folder size={14} className="text-muted-foreground shrink-0" />}
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold truncate ${isActive ? "text-primary" : "text-foreground"}`}>
                          {thread.title || "Untitled Consultation"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{thread.createdAt ? new Date(thread.createdAt).toLocaleDateString() : "Recent"}</p>
                      </div>
                    </button>
                  );
                })}
                {threads.length === 0 && (
                  <p className="text-xs text-muted-foreground px-2 py-3 text-center">No consultations yet. Start your first one above.</p>
                )}
              </div>
            </details>
          </section>



          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 sm:space-y-7 scrollbar-hide bg-background flex flex-col items-center">
            <div className="w-full max-w-2xl">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                <Scale size={44} className="text-primary/60" />
                <p className="text-foreground italic text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>
                  "Main hoon Al Wakeelo -- not just your lawyer, your strategy partner in justice."
                </p>
                <p className="text-[10px] text-foreground/70 uppercase tracking-widest font-black">Ask anything about Pakistan law</p>

                {/* First-time user tip */}
                {!tipDismissed && (
                  <div className="relative max-w-lg w-full mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/5 backdrop-blur-sm px-5 py-4 text-left animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <button
                      onClick={dismissTip}
                      className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-card/50"
                      aria-label="Dismiss tip"
                    >
                      <X size={14} />
                    </button>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                        <Lightbulb size={16} className="text-amber-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground mb-1.5">Get Better Answers with Detailed Questions</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          AlWakeelo works best when you clearly explain your legal issue. Instead of asking a short question like <span className="italic text-foreground/70">"Can I file a case?"</span>, try describing the situation in detail, including relevant facts, dates, documents, and legal concerns.
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mt-2">
                          The more information you provide, the more accurate and helpful the analysis, case law, and legal guidance will be.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {messages.map((m) => {
              const parsed = m.role === "assistant" ? parsedAssistantMessages.get(m.id) ?? null : null;
              const displayContent = parsed ? parsed.cleanContent : (m.displayContent || m.content);

              // Skip rendering empty assistant messages to avoid showing blank bubbles
              // during initial state loading/preparing.
              if (
                m.role === "assistant" &&
                !displayContent.trim() &&
                !m.caseLawCard &&
                (!m.ragCitations || m.ragCitations.length === 0)
              ) {
                return null;
              }

              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-2 sm:gap-3 w-full ${m.role === "user" ? "ml-auto flex-row-reverse" : ""}`}
                  style={OFFSCREEN_MESSAGE_STYLE}
                >
                  <div className={`h-8 w-8 sm:h-10 sm:w-10 shrink-0 rounded-full flex items-center justify-center ${m.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-card border border-primary/30 text-foreground"}`}>
                    {m.role === "assistant" ? <Scale size={18} /> : <UserIcon size={16} />}
                  </div>
                  <div className={`min-w-0 flex-1 flex flex-col gap-2 ${m.role === "user" ? "items-end" : ""}`}>
                    <p className={`text-[11px] font-bold uppercase tracking-widest ${m.role === "assistant" ? "text-foreground" : "text-foreground"}`}>
                      {m.role === "assistant" ? "Al Wakeelo Assistant" : "You"}
                    </p>
                    <div
                      className={`relative group p-3 sm:p-5 rounded-2xl backdrop-blur-md ${
                        m.role === "assistant"
                          ? "w-full min-w-0 bg-background/90 border border-primary/20 shadow-lg rounded-tl-md"
                          : "w-auto max-w-[85%] bg-transparent text-foreground border-2 border-primary/50 shadow-lg rounded-tr-md"
                      }`}
                    >
                      {m.role === "assistant" ? (
                        <>
                          {(m.modeName || m.modelName) && (
                            <div className="mb-3 pb-2 border-b border-primary/15">
                              <div className="text-[10px] text-foreground">
                                {m.modeName && (
                                  <span className={`mr-2 uppercase tracking-wider text-primary`}>
                                    {m.modeName}
                                  </span>
                                )}
                                {m.modelName && <span className="uppercase tracking-wider text-emerald-700 dark:text-emerald-300">{m.modelName}</span>}
                                {m.moduleProfile && <span className="uppercase tracking-wider text-cyan-700 dark:text-cyan-300 ml-2">{m.moduleProfile}</span>}
                                {m.modelDescription && <span className="block mt-1 text-muted-foreground">{m.modelDescription}</span>}
                              </div>
                            </div>
                          )}
                          {(() => {
                            let cardData = m.caseLawCard;
                            if (!cardData && parsed?.references?.judgments && parsed.references.judgments.length > 0) {
                              cardData = {
                                hits: parsed.references.judgments.map((j) => ({
                                  citation: j.citation,
                                  title: j.title || "",
                                  court: j.court || "",
                                  snippet: j.description || "",
                                })),
                                totalFound: parsed.references.judgments.length,
                                queriesUsed: [],
                              };
                            }
                            if (!cardData || cardData.hits.length === 0) return null;
                            return (
                              <CaseLawCard
                                data={cardData}
                                aiCitedCitations={
                                  parsed?.references
                                    ? new Set(parsed.references.judgments.map((j) => j.citation))
                                    : undefined
                                }
                                onCitationClick={openJudgment}
                              />
                            );
                          })()}
                          {!displayContent.trim() && isThinking ? (
                            <div className="flex flex-col gap-3 py-1">
                              <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg">
                                <Loader2 size={14} className="animate-spin text-primary flex-shrink-0" />
                                <span className="text-xs font-bold uppercase tracking-wider text-primary animate-pulse">
                                  🧠 Deep Legal Reasoning in Progress... (Analyzing statutes & precedents)
                                </span>
                              </div>
                              <style>{`
                                @keyframes shimmer-aw {
                                  0% { background-position: -1000px 0; }
                                  100% { background-position: 1000px 0; }
                                }
                                .animate-shimmer-aw {
                                  background: linear-gradient(90deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.12) 50%,rgba(255,255,255,0.04) 100%);
                                  background-size: 1000px 100%;
                                  animation: shimmer-aw 2s infinite;
                                }
                              `}</style>
                              <div className="space-y-2">
                                <div className="h-3 bg-muted/50 rounded animate-shimmer-aw"></div>
                                <div className="h-3 bg-muted/50 rounded animate-shimmer-aw" style={{ animationDelay: "0.25s", width: "92%" }}></div>
                                <div className="h-3 bg-muted/50 rounded animate-shimmer-aw" style={{ animationDelay: "0.5s", width: "78%" }}></div>
                              </div>
                            </div>
                          ) : (
                            <LegalMarkdown content={displayContent} />
                          )}
                          {parsed?.references && <ReferenceCards references={parsed.references} />}
                          {(m.ragCitations?.length || 0) > 0 && (() => {
                            const visibleCitations = m.ragCitations!.filter(isVisibleCitation);
                            if (visibleCitations.length === 0) return null;
                            const conf = m.ragConfidence || "low";
                            const confColor = conf === "high" ? "text-emerald-400" : conf === "medium" ? "text-amber-400" : "text-red-400";
                            const confBg = conf === "high" ? "bg-emerald-500/10 border-emerald-500/25" : conf === "medium" ? "bg-amber-500/10 border-amber-500/25" : "bg-red-500/10 border-red-500/25";
                            const ConfIcon = conf === "high" ? ShieldCheck : conf === "medium" ? CircleDot : AlertTriangle;
                            return (
                              <div className="mt-4 rounded-xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/5 to-transparent p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300 flex items-center gap-1.5">
                                    <Database size={11} /> Document Sources
                                  </p>
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${confBg} ${confColor}`}>
                                    <ConfIcon size={10} />
                                    {conf} confidence
                                  </span>
                                </div>
                                <div className="space-y-2.5">
                                  {visibleCitations.slice(0, 5).map((c, idx) => {
                                    const scorePct = Math.round(c.score * 100);
                                    return (
                                      <div key={`${c.sourceDocumentId}-${c.chunkIndex}-${idx}`} className="p-3 rounded-lg bg-background/60 border border-emerald-500/10 hover:border-emerald-500/25 transition-colors">
                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-sm shrink-0">{ragScopeIcon(c)}</span>
                                            <span className="text-xs font-bold text-foreground truncate">{cleanRagTitle(c.title)}</span>
                                          </div>
                                          <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${ragScopeColor(c)}`}>
                                            {ragScopeLabel(c)}
                                          </span>
                                        </div>
                                        {c.quote && <p className="text-[10px] text-muted-foreground leading-relaxed italic line-clamp-2 mb-2">{c.quote}</p>}
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 h-1.5 bg-slate-700/40 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all ${ragScoreColor(c.score)}`} style={{ width: `${scorePct}%` }} />
                                          </div>
                                          <span className="text-[9px] font-mono text-muted-foreground tabular-nums w-8 text-right">{scorePct}%</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      ) : (
                        <>
                          <p className="text-foreground leading-relaxed whitespace-pre-wrap">{sanitizeUserDisplay(m.displayContent || displayContent || m.content)}</p>
                          {m.attachments && m.attachments.length > 0 && (
                            <div className="flex flex-col gap-2 mt-3 pt-2.5 border-t border-border/30">
                              {m.attachments.map((name, i) => (
                                <div key={i} className="flex items-center gap-2.5 px-3 py-2 bg-muted/60 backdrop-blur-sm rounded-xl border border-border hover:border-primary/30 transition-colors">
                                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    {getFileIcon(name, 16)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-semibold text-foreground truncate">{name}</p>
                                    <p className="text-[9px] text-muted-foreground">Attached document</p>
                                  </div>
                                  {getFileExtBadge(name)}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                      {m.role === "assistant" && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
                          <button
                            onClick={() => !bookmarkedIds.has(m.id) && !bookmarkMutation.isPending && bookmarkMutation.mutate(m)}
                            disabled={bookmarkMutation.isPending}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-all duration-150 border disabled:opacity-50 disabled:cursor-not-allowed ${
                              bookmarkedIds.has(m.id)
                                ? "border-primary/50 text-primary bg-primary/10"
                                : "border-border text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5"
                            }`}
                            data-testid="button-bookmark"
                            title={bookmarkedIds.has(m.id) ? "Bookmarked" : "Save to bookmarks"}
                          >
                            {bookmarkedIds.has(m.id) ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                            {bookmarkedIds.has(m.id) ? "Saved" : "Save"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && !(messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && ((messages[messages.length - 1]?.content?.length ?? 0) > 0 || messages[messages.length - 1]?.caseLawCard)) && (
              <div className="flex items-start gap-3 w-full">
                <div className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 rounded-full text-foreground flex items-center justify-center bg-primary">
                  <Scale size={18} />
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-foreground">
                    Al Wakeelo Assistant
                  </p>
                  <div className="p-3 sm:p-4 rounded-2xl bg-background/90 border border-primary/20 shadow-lg rounded-tl-md">
                    {/* Phase + timer row */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Loader2 size={12} className="animate-spin text-primary flex-shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/80">
                          {isThinking
                            ? "Analyzing & reasoning"
                            : toolSearchStatus.queries.length > 0
                              ? toolSearchStatus.active
                                ? "Searching case law"
                                : "Writing response"
                              : elapsedMs < 2000
                                ? "Preparing"
                                : "Retrieving context"}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-primary tabular-nums">
                        {(elapsedMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                    {/* Tool search queries */}
                    {toolSearchStatus.queries.length > 0 && (
                      <div className="mb-3 space-y-1.5">
                        {toolSearchStatus.queries.map((q, i) => (
                          <div key={i} className="flex items-center gap-2 text-[10px]">
                            <Search size={9} className="text-cyan-400 flex-shrink-0" />
                            <span className="text-foreground font-mono truncate">{q.query}</span>
                            <span className="ml-auto flex-shrink-0">
                              {q.found > 0 ? (
                                <span className="text-cyan-400 font-bold">{q.found} found</span>
                              ) : (
                                <span className="text-muted-foreground">0 found</span>
                              )}
                            </span>
                          </div>
                        ))}
                        {!toolSearchStatus.active && toolSearchStatus.totalFound > 0 && (
                          <div className="flex items-center gap-1.5 pt-1 text-[10px] text-primary/80">
                            <Gavel size={9} />
                            <span>{toolSearchStatus.totalFound} judgment{toolSearchStatus.totalFound !== 1 ? "s" : ""} retrieved</span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Shimmer skeleton */}
                    <style>{`
                      @keyframes shimmer-aw {
                        0% { background-position: -1000px 0; }
                        100% { background-position: 1000px 0; }
                      }
                      .animate-shimmer-aw {
                        background: linear-gradient(90deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.12) 50%,rgba(255,255,255,0.04) 100%);
                        background-size: 1000px 100%;
                        animation: shimmer-aw 2s infinite;
                      }
                    `}</style>
                    <div className="space-y-2">
                      <div className="h-3 bg-muted/50 rounded animate-shimmer-aw"></div>
                      <div className="h-3 bg-muted/50 rounded animate-shimmer-aw" style={{ animationDelay: "0.25s", width: "92%" }}></div>
                      <div className="h-3 bg-muted/50 rounded animate-shimmer-aw" style={{ animationDelay: "0.5s", width: "78%" }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>

          <div className="p-2 sm:p-6 pt-2 border-t border-primary/15 bg-background/75" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
            {apiError && (
              <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                <AlertCircle size={14} className="text-red-400" />
                <span className="text-[10px] text-red-300 font-bold uppercase tracking-widest">{apiError}</span>
              </div>
            )}

            <div className="w-full bg-background/92 border border-primary/20 rounded-2xl shadow-[0_14px_38px_rgba(120,53,15,0.34)] relative">
              {/* Status Bar */}
              <div className="flex justify-between items-center px-4 py-3 border-b border-primary/15 bg-background/50">
                <div className="flex items-center gap-3">
                  {isAlWakeelo && (
                    <>
                    <button
                      onClick={() => setRagEnabled((prev) => !prev)}
                      className={`group/rag relative flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 cursor-pointer ${
                        ragEnabled
                          ? "text-emerald-200 border-emerald-400/50 bg-emerald-500/15 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                          : "text-muted-foreground border-border/40 bg-muted/20 hover:border-emerald-500/30 hover:text-emerald-300"
                      }`}
                      title={ragEnabled ? "Document AI active — searching your indexed vault" : "Enable Document AI to search your uploaded documents"}
                    >
                      <Brain size={14} className={`transition-colors ${ragEnabled ? "text-emerald-400" : "text-muted-foreground group-hover/rag:text-emerald-400"}`} />
                      <span className="tracking-wide">{ragEnabled ? "Vault Search" : "Vault Search"}</span>
                      <span className={`relative flex h-2.5 w-2.5 ${ ragEnabled ? "" : "opacity-0"}`}>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                      </span>
                      {!ragEnabled && <span className="relative flex h-2.5 w-2.5"><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-500"></span></span>}
                    </button>
                    {ragEnabled && (
                      <>
                        <span className="text-[9px] text-emerald-400/70 font-medium tracking-wide hidden sm:inline">Searching indexed vault</span>
                        <CaseFileSelector value={ragCaseFileId} onChange={setRagCaseFileId} />
                      </>
                    )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider relative">
                  <button
                    onClick={() => setShowModelMenu(!showModelMenu)}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 border text-[10px] font-black uppercase tracking-wider ${
                      isApexMode
                        ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 focus-visible:ring-emerald-300/60"
                        : normalizedAiMode === "turbo"
                            ? "text-primary border-primary/40 bg-primary/10 hover:bg-primary/20 focus-visible:ring-primary/60"
                            : "text-foreground border-border/60 bg-muted/30 hover:bg-muted/60 focus-visible:ring-slate-300/60"
                    }`}
                    data-testid="button-model-selector"
                  >
                    {isApexMode ? <Sparkles size={10} /> : normalizedAiMode === "turbo" ? <Zap size={10} /> : <Scale size={10} />}
                    {currentModeName().name}
                    <ChevronDown size={9} />
                  </button>
                  {showModelMenu && (
                    <div className="model-menu-dropdown absolute bottom-full right-0 mb-2 bg-card border border-primary/20 rounded-xl shadow-2xl overflow-hidden min-w-[280px] z-50">
                      <div className="px-4 py-2 text-[9px] text-muted-foreground uppercase tracking-widest font-black border-b border-primary/15">Select AI Model</div>
                      <button onClick={() => { setAiMode("standard"); setShowModelMenu(false); }} className={`w-full text-left px-4 py-3 text-xs hover:bg-muted border-b border-primary/10 ${normalizedAiMode === "standard" ? "bg-primary/10 text-primary" : "text-foreground"}`}>
                        <div className="font-bold">Standard</div><div className="text-[10px] text-muted-foreground mt-0.5">Fast, reliable responses</div>
                      </button>
                      {canUseTurbo ? (
                        <button onClick={() => { setAiMode("turbo"); setShowModelMenu(false); }} className={`w-full text-left px-4 py-3 text-xs hover:bg-muted border-b border-primary/10 ${normalizedAiMode === "turbo" ? "bg-primary/10 text-primary" : "text-foreground"}`}>
                          <div className="font-bold flex items-center gap-1.5"><Zap size={11} className="text-primary" />Turbo</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">Deep reasoning & analysis (avg. response 3-5 mins)</div>
                        </button>
                      ) : (
                        <div className="w-full text-left px-4 py-3 text-xs text-muted-foreground border-b border-primary/10">
                          <div className="font-bold flex items-center gap-1.5"><Lock size={10} className="text-muted-foreground" />Turbo<span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-black">PRO</span></div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">Upgrade to Pro to unlock</div>
                        </div>
                      )}
                      {canUseTurbo && filteredApexModels.length > 0 && (
                        <>
                          {filteredApexModels.map(model => (
                            <button
                              key={model.id}
                              onClick={() => { setAiMode(model.id); setShowModelMenu(false); }}
                              className={`w-full text-left px-4 py-3 text-xs hover:bg-muted border-b border-primary/10 last:border-0 ${normalizedAiMode === model.id.toLowerCase() ? "bg-emerald-500/10 text-emerald-300" : "text-foreground"}`}
                            >
                              <div className="font-bold flex items-center gap-1.5"><Sparkles size={11} className="text-emerald-400" />{model.name}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">Advanced legal research & analysis</div>
                            </button>
                          ))}
                        </>
                      )}
                      {!canUseTurbo && (
                        <div className="w-full text-left px-4 py-3 text-xs text-muted-foreground border-b border-primary/10">
                          <div className="font-bold flex items-center gap-1.5"><Lock size={10} className="text-muted-foreground" />Turbo<span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-black">PRO</span></div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">Upgrade to Pro to unlock</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Input Row */}
              <div className="flex items-end gap-3 p-3 sm:p-4">
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".txt,.pdf,.docx,.jpg,.jpeg,.png,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png" multiple className="hidden" />
                <input type="file" ref={audioInputRef} onChange={handleAudioSelect} accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg" className="hidden" />

                <button onClick={() => fileInputRef.current?.click()} disabled={isLoading || attachedFiles.length >= 5} className="p-2 text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-lg">
                  <Paperclip size={18} />
                </button>
                <button
                  onClick={handleVoiceRecording}
                  disabled={isLoading || isTranscribing}
                  className={`p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-lg transition-colors ${voice.isRecording ? "text-red-500 bg-red-500/10 animate-pulse" : "text-muted-foreground hover:text-primary"}`}
                  title={voice.isRecording ? `Stop recording · ${formatDuration(voice.duration)}` : "Record voice message"}
                >
                  {isTranscribing
                    ? <Loader2 size={18} className="animate-spin text-primary" />
                    : voice.isRecording
                      ? <Square size={17} fill="currentColor" />
                      : <Mic size={18} />}
                </button>
                <button
                  onClick={() => audioInputRef.current?.click()}
                  disabled={isLoading || isTranscribing || voice.isRecording}
                  className="p-2.5 text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-lg transition-colors disabled:opacity-40"
                  title="Upload audio file (MP3, WAV, M4A, WebM)"
                >
                  <File size={18} />
                </button>

                <textarea
                  ref={promptInputRef}
                  rows={1}
                  className="flex-1 min-w-[200px] min-h-[50px] max-h-40 resize-none overflow-y-auto bg-transparent border-none focus:ring-0 text-base text-foreground placeholder:text-muted-foreground px-3 py-3 leading-6 focus:outline-none"
                  placeholder="Type your legal inquiry or command here..."
                  value={input}
                  onInput={resizePromptInput}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  data-testid="input-chat"
                />


                {isLoading ? (
                  <button onClick={handleStop} data-testid="button-stop" className="bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white h-12 w-12 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60 flex-shrink-0">
                    <Square size={18} fill="currentColor" />
                  </button>
                ) : (
                  <button onClick={() => handleSend()} disabled={isTranscribing || voice.isRecording} data-testid="button-send" className="bg-gradient-to-br from-primary to-primary hover:from-primary hover:to-primary disabled:from-primary/50 disabled:to-primary/50 text-primary-foreground h-12 w-12 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 flex-shrink-0">
                    <Send size={20} />
                  </button>
                )}
              </div>

              {attachedFiles.length > 0 && (
                <div className="px-2 pb-2 flex flex-wrap gap-2">
                  {attachedFiles.map((file, i) => (
                    <div key={i} className="inline-flex items-center gap-1.5 px-2 py-1 bg-accent border border-border rounded text-[10px] text-foreground">
                      {getFileIcon(file.name)}
                      <span className="max-w-[120px] truncate">{file.name}</span>
                      <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-red-400"><X size={11} /></button>
                    </div>
                  ))}
                </div>
              )}
              {attachedFiles.length >= 5 && (
                <div className="px-2 pb-2 text-[10px] text-primary">
                  Maximum 5 files reached. Remove a file to add more.
                </div>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground/60 text-center mt-2 px-4 leading-relaxed">
              Disclaimer: Al Wakeelo generates AI-derived legal information and draft suggestions based on available Pakistani laws. AI answers are not binding legal advice; please consult a licensed attorney for official legal representation.
            </p>

            {usage && usage.percentage >= 80 && (
              <div className={`w-full mt-3 px-3 py-2 rounded-lg border flex items-center justify-between gap-3 ${usage.percentage >= 100 ? "bg-red-500/10 border-red-500/20" : "bg-primary/10 border-primary/20"}`}>
                <div className="flex items-center gap-2">
                  {usage.percentage >= 100 ? <Lock size={13} className="text-red-400" /> : <Crown size={13} className="text-primary" />}
                  <span className={`text-[10px] font-black uppercase tracking-wider ${usage.percentage >= 100 ? "text-red-300" : "text-primary"}`}>
                    {usage.percentage >= 100 ? `Limit reached (${usage.used}/${usage.monthlyLimit} actions)` : `${usage.remaining} actions remaining`}
                  </span>
                </div>
                <a href={upgradeCheckoutHref} className="text-[10px] font-black uppercase tracking-wider text-primary hover:text-primary inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-md" data-testid="link-upgrade-warning">
                  Upgrade <ArrowUpRight size={10} />
                </a>
              </div>
            )}
          </div>
        </main>


      </div>
    </div>
  );
}
