import { useState, useRef, useEffect, useCallback, useMemo, type CSSProperties } from "react";
import { Scale, Send, Trash2, Bookmark, BookmarkCheck, Loader2, AlertCircle, Share2, Check, Copy, Zap, Lock, Crown, ArrowUpRight, X, Paperclip, Mic, FileText, File, Sparkles, ChevronDown, ChevronLeft, ChevronRight, FolderOpen, Folder, PlusCircle, User as UserIcon, Globe, Search, BookOpen, Brain, ExternalLink, Gavel, BarChart3, Link2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getUpgradeCheckoutPath } from "@/lib/upgrade-path";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LegalMarkdown } from "@/components/legal-markdown";
import { parseReferences, ReferenceCards } from "@/components/reference-cards";

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

interface AgentStep {
  type: "thinking" | "searching" | "reading" | "synthesizing";
  content: string;
  searchQuery?: string;
  results?: Array<{ title: string; url: string; snippet: string }>;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: string[];
  modeName?: string;
  modelName?: string;
  modelId?: string;
  modelDescription?: string;
  moduleProfile?: string;
  routingPath?: string[];
  ragCitations?: RAGCitation[];
  ragConfidence?: "high" | "medium" | "low";
  // Agent-specific fields
  agentSteps?: AgentStep[];
  agentSearchQueries?: string[];
  agentSourcesUsed?: Array<{ title: string; url: string; snippet: string }>;
  isAgentMode?: boolean;
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

export default function ChatPage() {
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
}

export function ChatModule({ type, title, initialMessage }: { type: string; title?: string; initialMessage?: string }) {
  const isAlWakeelo = type === "al-wakeelo";
  const activeThreadStorageKey = useMemo(() => `${ACTIVE_THREAD_KEY_PREFIX}${type}`, [type]);
  const stored = chatStateStore[type];
  const [messages, setMessages] = useState<ChatMessage[]>(stored?.messages || []);
  const [input, setInput] = useState(initialMessage || "");
  const [isLoading, setIsLoading] = useState(false);
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
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
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
  const [leftRailOpen, setLeftRailOpen] = useState(true);
  // Map<citation_text, judgment_id> — only citations verified to exist in DB
  const [verifiedJudgmentIds, setVerifiedJudgmentIds] = useState<Map<string, string>>(new Map());
  const [rightRailOpen, setRightRailOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  const { data: usage } = useQuery<UsageData>({ queryKey: ["/api/usage"] });
  const { data: threads = [] } = useQuery<ThreadSummary[]>({ queryKey: ["/api/threads"] });
  const { data: userDocuments = [] } = useQuery<UserDocument[]>({
    queryKey: ["/api/documents"],
    enabled: isAlWakeelo,
  });
  const upgradeCheckoutHref = getUpgradeCheckoutPath(usage?.tier);
  const canUseTurbo = usage?.tier === "pro" || usage?.tier === "chamber" || usage?.tier === "enterprise";
  const canUseApex = usage?.tier === "chamber" || usage?.tier === "enterprise";
  const isApexAgentWebMode = aiMode === "apex-agent-web";
  const isApexModelMode = aiMode === "apex-pro" || aiMode === "apex-agent";
  const isApexMode = isApexModelMode || isApexAgentWebMode;
  const selectedApexModel = isApexModelMode
    ? aiMode
    : isApexAgentWebMode
      ? "apex-agent"
      : null;
  const turboMode = aiMode === "turbo";

  const { data: apexData } = useQuery<ApexModelsData>({
    queryKey: ["/api/apex/models"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/apex/models");
      return res.json();
    },
  });

  const getModelDisplayName = useCallback((modelId: string): string => {
    const modelKey = String(modelId || "").toLowerCase();
    const modelNames: Record<string, string> = {
      "standard": "Standard",
      "turbo": "Turbo",
      "deepseek-chat": "Turbo",
      "deepseek-reasoner": "DeepSeek Pro",
      "apex-pro": "Apex",
      "apex-agent": "Apex Pro",
      "apex-agent-web": "Apex Agent Web",
    };
    if (modelNames[modelKey]) return modelNames[modelKey];
    if (modelKey.includes("deepseek")) return "DeepSeek";
    const apexModel = apexData?.models.find(m => m.id.toLowerCase() === modelKey);
    if (apexModel) return apexModel.name;
    if (modelKey.includes("apex-agent-web") || modelKey.includes("apex agent web")) return "Apex Agent Web";
    if (modelKey.includes("apex-agent") || modelKey.includes("apex agent")) return "Apex Pro";
    if (modelKey.includes("apex-pro") || modelKey.includes("apex pro")) return "Apex";
    return "Standard";
  }, [apexData]);

  const getModelFunctionDescription = useCallback((modelIdOrName: string): string => {
    const id = modelIdOrName.toLowerCase();
    if (id.includes("openai/gpt-oss-120b")) {
      return "Highest quality legal reasoning and detailed drafting.";
    }
    if (id.includes("openai/gpt-oss-20b")) {
      return "Balanced legal analysis with faster response time.";
    }
    if (id.includes("llama-3.1-8b-instant")) {
      return "Low-latency responses for quick legal guidance.";
    }
    if (id.includes("deepseek-reasoner") || id.includes("deepseek pro")) {
      return "Advanced multi-step reasoning for complex legal problems.";
    }
    if (id.includes("deepseek")) {
      return "Turbo legal analysis optimized for speed and quality.";
    }
    if (id.includes("apex-pro")) {
      return "Kimi-K2.5 mode for fast, high-quality legal drafting and analysis.";
    }
    if (id === "apex-agent-web") {
      return "Kimi AI agent with live web research across Pakistani legal databases.";
    }
    if (id === "apex-agent") {
      return "Kimi-K2-Thinking mode for deeper legal reasoning in non-web internal context.";
    }
    if (id.includes("groq") || id.includes("standard")) {
      return "Default legal chat mode with reliable fast responses.";
    }
    const apexModel = apexData?.models.find((m) => m.id === modelIdOrName);
    if (apexModel?.description) return apexModel.description;
    return "AI legal assistant response.";
  }, [apexData]);

  const currentModeName = useCallback((): { name: string; color: string; icon: "zap" | "sparkles" | "standard" | "globe" } => {
    if (aiMode === "standard") return { name: "Standard", color: "text-slate-400", icon: "standard" };
    if (aiMode === "turbo") return { name: "Turbo", color: "text-amber-400", icon: "zap" };
    if (aiMode === "apex-agent-web") return { name: "Apex Agent Web", color: "text-cyan-400", icon: "globe" };
    const apexModel = apexData?.models.find(m => m.id === aiMode);
    return { name: apexModel?.name || "Apex", color: "text-emerald-400", icon: "sparkles" };
  }, [aiMode, apexData]);

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
      await apiRequest("POST", "/api/bookmarks", {
        title: msg.content.substring(0, 50),
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
    const allowed = [".txt", ".pdf", ".docx"];
    const allowedMimes = ["text/plain", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
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

    setIsTranscribing(true);
    setApiError(null);
    try {
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("mode", aiMode);
      const response = await fetch("/api/ai/transcribe", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: "Transcription failed" }));
        throw new Error(err.message || "Transcription failed");
      }
      const data = await response.json();
      if (data.transcription) {
        setInput(prev => prev ? `${prev}\n\n[Transcribed Audio]: ${data.transcription}` : data.transcription);
      }
    } catch (err: any) {
      setApiError(err.message || "Failed to transcribe audio");
    } finally {
      setIsTranscribing(false);
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

  const persistConsultationTurn = useCallback(async (userMessage: ChatMessage, assistantMessage: ChatMessage) => {
    try {
      const titleSource = String(userMessage.content || "")
        .replace(/\s*\[Attached:[^\]]+\]\s*/gi, " ")
        .trim();
      const title = (titleSource || "Al Wakeelo Consultation").slice(0, 80);
      const res = await apiRequest("POST", "/api/threads/upsert-turn", {
        threadId: sharedThreadId || undefined,
        title,
        userMessage: userMessage.content,
        assistantMessage: assistantMessage.content,
      });
      const data = await res.json().catch(() => null);
      const nextThreadId = Number(data?.thread?.id || data?.threadId || 0);
      if (nextThreadId > 0 && nextThreadId !== sharedThreadId) {
        setSharedThreadId(nextThreadId);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/threads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity/summary"] });
    } catch (err) {
      console.warn("Failed to persist consultation turn:", err);
    }
  }, [sharedThreadId]);

  const formatRagAnswer = (answer: string, citations: RAGCitation[]): string => {
    if (!citations || citations.length === 0) return answer;
    const sourceLines = citations.slice(0, 5).map((c, idx) => {
      return `${idx + 1}. ${c.title} (Doc ${c.sourceDocumentId}, Chunk ${c.chunkIndex}, Score ${Math.round(c.score * 100)}%)`;
    });
    return `${answer}\n\n**Retrieved Sources**\n${sourceLines.join("\n")}`;
  };

  const handleSend = async (overrideInput?: string) => {
    const text = overrideInput || input;
    if ((!text.trim() && attachedFiles.length === 0) || isLoading) return;
    setApiError(null);
    setAgentStatus(null);

    const fileNames = attachedFiles.map(f => f.name);
    const displayText = fileNames.length > 0
      ? `${text}${text ? "\n" : ""}[Attached: ${fileNames.join(", ")}]`
      : text;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: displayText, attachments: fileNames.length > 0 ? fileNames : undefined };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setIsLoading(true);
    setToolSearchStatus({ active: false, queries: [], totalFound: 0, totalMs: 0 });

    const currentFiles = [...attachedFiles];
    setAttachedFiles([]);

    const assistantId = (Date.now() + 1).toString();

    try {
      let response: Response;

      // ── Apex Agent Web Mode (Kimi Web Research) ──────────────────────────
      if (isApexAgentWebMode && isAlWakeelo && text.trim().length > 0 && currentFiles.length === 0) {
        setAgentStatus("🔍 Initializing web research agent...");
        try {
          const agentRes = await apiRequest("POST", "/api/apex/agent", {
            message: text,
            maxIterations: 6,
          });
          const agentData = await agentRes.json();

          if (!agentRes.ok) {
            throw { message: agentData.message || "Agent research failed", isLimit: agentRes.status === 429 };
          }

          const agentSteps: AgentStep[] = Array.isArray(agentData.steps) ? agentData.steps : [];
          const agentSearchQueries: string[] = Array.isArray(agentData.searchQueries) ? agentData.searchQueries : [];
          const agentSourcesUsed = Array.isArray(agentData.sourcesUsed) ? agentData.sourcesUsed : [];
          const assistantMessage: ChatMessage = {
            id: assistantId,
            role: "assistant",
            content: agentData.content || "Research complete.",
            modeName: "Apex Agent Web",
            modelName: agentData.model || "Apex Agent Web",
            modelId: "apex-agent-web",
            modelDescription: "Kimi AI with live web research across legal databases",
            isAgentMode: true,
            agentSteps,
            agentSearchQueries,
            agentSourcesUsed,
          };
          setMessages([...updated, assistantMessage]);
          await persistConsultationTurn(userMsg, assistantMessage);

          setAgentStatus(null);
          await apiRequest("POST", "/api/search-history", { type: "chat", query: text.substring(0, 80) }).catch(() => {});
          queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
          return;
        } catch (agentErr: any) {
          setAgentStatus(null);
          throw agentErr;
        }
      }

      if (ragEnabled && isAlWakeelo && text.trim().length > 0 && currentFiles.length === 0) {
        const ragRes = await apiRequest("POST", "/api/rag/ask", {
          query: text,
          documentIds: userDocuments.map((d) => d.id),
        });
        const ragData = await ragRes.json();
        const ragCitations: RAGCitation[] = Array.isArray(ragData?.citations) ? ragData.citations : [];
        const formatted = formatRagAnswer(String(ragData?.answer || ""), ragCitations);
        const modelName = ragData?.model?.name ? String(ragData.model.name) : "RAG";
        const modeName = "RAG";
        const assistantMessage: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: formatted,
          modeName,
          modelName,
          modelId: modelName,
          modelDescription: "Retrieval-grounded response from indexed vault documents.",
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
        const modelId = data.model || (isApexMode ? aiMode : aiMode);
        const modelLabel = modelId ? getModelDisplayName(modelId) : undefined;
        const modelDescription = modelId ? getModelFunctionDescription(modelId) : undefined;
        const modeLabel = isApexAgentWebMode
          ? "Apex Agent Web"
          : isApexModelMode
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
                    const modelId = parsed.model || aiMode;
                    const modelLabel = getModelDisplayName(modelId);
                    const modelDescription = getModelFunctionDescription(modelId);
                    const modeLabel = isApexAgentWebMode
                      ? "Apex Agent Web"
                      : isApexModelMode
                        ? getModelDisplayName(selectedApexModel || modelId)
                        : (turboMode && canUseTurbo ? "Turbo" : "Standard");
                    setMessages(prev => {
                      const last = prev[prev.length - 1];
                      if (last && last.id === assistantId) {
                        return [...prev.slice(0, -1), {
                          ...last,
                          modeName: canUseTurbo ? modeLabel : undefined,
                          modelName: modelLabel,
                          modelId,
                          modelDescription,
                          moduleProfile: typeof parsed.moduleProfile === "string" ? parsed.moduleProfile : undefined,
                          routingPath: Array.isArray(parsed.routingPath) ? parsed.routingPath.map(String) : undefined,
                        }];
                      }
                      return prev;
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
      setAgentStatus(null);
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
        return {
          ...(attachments.length > 0 ? { attachments } : {}),
          id: String(m.id ?? `${threadId}-${idx}`),
          role: m.role === "assistant" ? "assistant" : "user",
          content,
        };
      });
      setMessages(restored);
      setSharedThreadId(threadId);
      setShareUrl(null);
      setShareError(null);
    } catch (err) {
      console.error("Failed to load thread:", err);
      setApiError("Failed to load consultation");
    }
  }, [parseAttachmentNames]);

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
          title: firstUserMsg.content.substring(0, 80) || "Al Wakeelo Conversation",
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

  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return <FileText size={12} className="text-red-400" />;
    if (ext === "txt") return <FileText size={12} className="text-blue-400" />;
    return <File size={12} className="text-slate-400" />;
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
        // Open statute directly
        window.open(`/statute-view/${data.id}`, '_blank');
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
  const openJudgment = async (citation: string) => {
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
        <h3 className="flex items-center gap-2 text-[11px] font-bold text-amber-400 uppercase tracking-widest mb-4">
          <FileText size={13} /> Legal Citations
        </h3>
        <div className="space-y-3">
          {(latestRagCitations?.length || 0) > 0 && latestRagCitations.slice(0, compact ? 3 : 4).map((c, idx) => (
            <div key={`rag-${c.sourceDocumentId}-${c.chunkIndex}-${idx}`} className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 transition-all">
              <div className="flex justify-between items-start mb-2 gap-2">
                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded truncate">
                  Doc {c.sourceDocumentId} · Chunk {c.chunkIndex}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-200 mb-1">{c.title}</p>
              <p className="text-[10px] text-slate-500 leading-relaxed italic line-clamp-3">{c.quote}</p>
            </div>
          ))}
          {(latestRefs?.judgments?.length || 0) > 0 && latestRefs?.judgments
            .filter(j => verifiedJudgmentIds.has(j.citation))
            .slice(0, compact ? 3 : 4).map((j, idx) => {
              const jid = verifiedJudgmentIds.get(j.citation)!;
              return (
                <button key={`${j.citation}-${idx}`} className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-amber-500/30 transition-all cursor-pointer text-left w-full" onClick={() => window.open(`/judgment/${jid}`, '_blank')} onKeyDown={(e) => e.key === 'Enter' && window.open(`/judgment/${jid}`, '_blank')}>
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded truncate">{j.citation}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-200 mb-1">{j.court || "Pakistani Courts"}</p>
                  {j.description && <p className="text-[10px] text-slate-500 leading-relaxed italic line-clamp-3">{j.description}</p>}
                </button>
              );
            })}
          {(latestInlineReferences?.citations?.length || 0) > 0 && latestInlineReferences?.citations
            .filter(c => verifiedJudgmentIds.has(c.citation))
            .slice(0, compact ? 2 : 3).map((c, idx) => {
              const jid = verifiedJudgmentIds.get(c.citation)!;
              return (
                <button key={`inline-citation-${idx}`} className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/50 transition-all cursor-pointer text-left w-full" onClick={() => window.open(`/judgment/${jid}`, '_blank')} onKeyDown={(e) => e.key === 'Enter' && window.open(`/judgment/${jid}`, '_blank')}>
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded truncate">{c.citation}</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Click to view judgment</p>
                </button>
              );
            })}
          {(latestRefs?.laws?.length || 0) > 0 && latestRefs?.laws.slice(0, compact ? 3 : 4).map((l, idx) => (
            <button key={`${l.name}-${idx}`} className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-amber-500/30 hover:bg-white/10 transition-all cursor-pointer text-left w-full" onClick={() => openStatute(l.name)} onKeyDown={(e) => e.key === 'Enter' && openStatute(l.name)}>
              <p className="text-xs font-bold text-amber-300 hover:underline mb-1">{l.name || "Pakistani Statute"}</p>
              {l.section && <span className="text-[10px] text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded">{l.section}</span>}
              {l.description && <p className="text-[10px] text-slate-500 leading-relaxed italic line-clamp-2 mt-1">{l.description}</p>}
            </button>
          ))}
          {!latestRefs && (latestRagCitations?.length || 0) === 0 && (
            <p className="text-xs text-slate-500">Citations from Al Wakeelo responses will appear here.</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="flex items-center gap-2 text-[11px] font-bold text-amber-400 uppercase tracking-widest mb-4">
          <Scale size={13} /> Relevant Statutes
        </h3>
        <div className="space-y-2">
          {latestStatutes.length > 0 || (latestInlineReferences?.statutes?.length || 0) > 0 ? (
            <>
              {latestStatutes.slice(0, compact ? 5 : 8).map((law, idx) => (
                <button key={`${law.name}-${idx}`} className="flex items-start gap-3 p-2 group cursor-pointer hover:bg-amber-500/5 rounded transition-colors w-full text-left" onClick={() => openStatute(law.name)} onKeyDown={(e) => e.key === 'Enter' && openStatute(law.name)}>
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-500/60" />
                  <div>
                    <p className="text-xs font-medium text-slate-300 group-hover:text-amber-300 transition-colors">
                      {law.name || "Pakistani Statute"}
                    </p>
                    <p className="text-[10px] text-slate-500">{law.section || "Section reference"}</p>
                    {law.description && (
                      <p className="text-[10px] text-slate-600 mt-0.5 line-clamp-2">{law.description}</p>
                    )}
                  </div>
                </button>
              ))}
              {(latestInlineReferences?.statutes?.length || 0) > 0 && latestInlineReferences?.statutes.slice(0, compact ? 3 : 5).map((statute, idx) => (
                <button key={`inline-statute-${idx}`} className="flex items-start gap-3 p-2 group cursor-pointer hover:bg-amber-500/5 rounded transition-colors w-full text-left" onClick={() => openStatute(statute.name)} onKeyDown={(e) => e.key === 'Enter' && openStatute(statute.name)}>
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-500/60" />
                  <div>
                    <p className="text-xs font-medium text-slate-300 group-hover:text-amber-300 transition-colors">
                      {statute.name}
                    </p>
                    <p className="text-[10px] text-slate-500">Click to view statute</p>
                  </div>
                </button>
              ))}
            </>
          ) : (
            <p className="text-xs text-slate-500">Relevant statutes will appear here when Al Wakeelo cites them in responses.</p>
          )}
        </div>
      </div>

      <div className="mt-auto p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <p className="text-[10px] font-bold text-amber-400 uppercase mb-2">AI Confidence</p>
        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
          <div className="bg-amber-400 h-full transition-all duration-300" style={{ width: `${aiConfidence.pct}%` }} />
        </div>
        <p className="text-[10px] text-slate-500 mt-2">{aiConfidence.level} ({aiConfidence.pct}%) · {aiConfidence.basis}</p>
      </div>
    </div>
  );

  if (!isAlWakeelo) {
    return (
      <div className="flex flex-col h-[calc(100vh-120px)] bg-white border border-[#CBD5E1] rounded-2xl overflow-hidden shadow-lg relative fade-in">
        <div className="p-4 md:p-6 bg-white border-b border-[#CBD5E1] flex items-center justify-between z-20">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#1E3A8A]/10 flex items-center justify-center text-[#1E3A8A]">
              <Scale size={20} />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-semibold text-[#0F172A] capitalize">{title || type.replace("-", " ")}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${apiError ? "bg-[#DC2626]" : "bg-emerald-500"}`} />
                <p className="text-[8px] md:text-[9px] text-[#64748B] font-semibold uppercase tracking-widest">
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
                    : "hover:bg-[#B45309]/10 text-[#64748B] hover:text-[#B45309]"
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
              className="px-3 py-2 hover:bg-[#DC2626]/10 rounded-lg text-[#64748B] hover:text-[#DC2626] text-[9px] md:text-[10px] font-semibold uppercase tracking-wide flex items-center gap-2 transition-all duration-150"
            >
              <Trash2 size={14} /> Reset
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 sm:space-y-3 scrollbar-hide bg-[#F8FAFC] px-3 sm:px-4 md:px-8 py-3 sm:py-4 md:py-6 flex flex-col">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <Scale size={48} className="text-[#94A3B8]" />
              <p className="text-[#475569] italic text-sm md:text-base" style={{ fontFamily: "'EB Garamond', serif" }}>
                "Main hoon Al Wakeelo -- not just your lawyer, your strategy partner in justice."
              </p>
              <p className="text-[9px] text-[#64748B] uppercase tracking-widest font-semibold">Ask about your contract or legal matter</p>
            </div>
          )}

          <div className="max-w-2xl mx-auto w-full">
          {messages.map((m) => {
            const parsed = m.role === "assistant" ? parsedAssistantMessages.get(m.id) ?? null : null;
            const displayContent = parsed ? parsed.cleanContent : m.content;
            return (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} slide-in-from-bottom-2 gap-2 mb-3`}
                style={OFFSCREEN_MESSAGE_STYLE}
              >
                {m.role === "assistant" && (
                  <div className="w-8 h-8 rounded-md bg-[#1E3A8A] flex items-center justify-center flex-shrink-0 mt-1">
                    <Scale size={16} className="text-white" />
                  </div>
                )}
                <div
                  className={`flex-1 p-3 sm:p-4 md:p-5 rounded-2xl relative group ${
                    m.role === "user"
                      ? "bg-gradient-to-br from-[#1E3A8A] to-[#1e40af] text-white rounded-br-none max-w-2xl shadow-md hover:shadow-lg transition-shadow"
                      : "bg-white border border-[#E2E8F0] text-[#0F172A] rounded-bl-none shadow-sm hover:shadow-md transition-shadow"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <>
                      {(m.modeName || m.modelName) && (
                        <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-[#CBD5E1]">
                          <div className="flex flex-col gap-0.5">
                            {m.modeName && (
                              <span className={`text-[7px] font-semibold uppercase tracking-wider ${
                                m.modeName === "Turbo" ? "text-[#B45309]" :
                                m.modeName === "Standard" ? "text-[#64748B]" :
                                m.isAgentMode ? "text-cyan-600" :
                                "text-emerald-600"
                              }`}>
                                {m.modeName === "Turbo" && <Zap size={8} className="inline mr-0.5" />}
                                {m.isAgentMode && <Globe size={8} className="inline mr-0.5" />}
                                {!m.isAgentMode && m.modeName !== "Turbo" && m.modeName !== "Standard" && <Sparkles size={8} className="inline mr-0.5" />}
                                {m.modeName}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {/* Agent Research Steps (compact, integrated) */}
                      {m.isAgentMode && (m.agentSteps?.length || 0) > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#E9EEF5]">
                          <p className="text-[9px] font-semibold uppercase tracking-widest text-cyan-600 mb-2 flex items-center gap-1.5">
                            <Brain size={12} /> Research Steps
                          </p>
                          <div className="space-y-1.5 text-[10px]">
                            {m.agentSteps!.slice(0, 3).map((step, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <span className="shrink-0 mt-0.5">
                                  {step.type === "thinking" && <Brain size={12} className="text-purple-500" />}
                                  {step.type === "searching" && <Search size={12} className="text-cyan-500" />}
                                  {step.type === "reading" && <BookOpen size={12} className="text-blue-500" />}
                                  {step.type === "synthesizing" && <Sparkles size={12} className="text-emerald-500" />}
                                </span>
                                <span className="text-[#475569]">{step.content}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <LegalMarkdown content={displayContent} />

                      {/* Integrated Legal Context Strip */}
                      {((m.ragCitations?.length || 0) > 0 || (parsed?.references?.length || 0) > 0) && (
                        <div className="mt-4 pt-4 border-t border-[#E9EEF5] space-y-2">
                          {/* Case Law Citations */}
                          {(m.ragCitations?.length || 0) > 0 && (
                            <div className="space-y-2">
                              {m.ragCitations!.slice(0, 2).map((c, idx) => (
                                <div key={`${c.sourceDocumentId}-${c.chunkIndex}-${idx}`} className="flex gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] hover:border-[#B45309]/30 transition-colors duration-150">
                                  <Gavel size={16} className="text-[#B45309] flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold text-[#0F172A] truncate">{c.title}</p>
                                    <p className="text-[9px] text-[#64748B] mt-1">Relevance: {Math.round(c.score * 100)}%</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* References/Definitions */}
                          {parsed?.references && parsed.references.length > 0 && (
                            <div className="space-y-2">
                              {parsed.references.slice(0, 2).map((ref, idx) => (
                                <div key={idx} className="flex gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] hover:border-[#1E3A8A]/30 transition-colors duration-150">
                                  <Link2 size={16} className="text-[#1E3A8A] flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold text-[#0F172A] truncate">{ref.title || ref.name}</p>
                                    {ref.description && (
                                      <p className="text-[9px] text-[#64748B] mt-1 line-clamp-1">{ref.description}</p>
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
                      <p className="text-sm whitespace-pre-wrap leading-normal">{m.content.replace(/\[Attached:.*?\]/, "").trim()}</p>
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-slate-950/20">
                          {m.attachments.map((name, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-950/20 rounded-lg text-[10px] font-bold">
                              {getFileIcon(name)} {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {m.role === "assistant" && (
                    <div className={`absolute top-3 right-3 transition-opacity ${bookmarkedIds.has(m.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                      <button
                        onClick={() => !bookmarkedIds.has(m.id) && !bookmarkMutation.isPending && bookmarkMutation.mutate(m)}
                        disabled={bookmarkMutation.isPending}
                        className={`p-2 rounded-xl border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          bookmarkedIds.has(m.id)
                            ? "border-amber-500/50 text-amber-500 bg-amber-500/10"
                            : "border-slate-700 text-slate-400 hover:text-amber-500"
                        }`}
                        data-testid="button-bookmark"
                        title={bookmarkedIds.has(m.id) ? "Bookmarked" : "Save to Bookmarks"}
                      >
                        {bookmarkedIds.has(m.id) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>

          {isLoading && (
            <div className="flex items-start gap-3">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${isApexAgentWebMode ? "bg-cyan-600 text-white" : "bg-white text-[#0F172A]"}`}>
                {isApexAgentWebMode ? <Globe size={16} /> : <Scale size={16} />}
              </div>
              <div className="flex-1">
                <div className={`p-4 rounded-2xl border ${isApexAgentWebMode ? "border-cyan-700/30 bg-cyan-900/20" : "border-slate-700/30 bg-slate-800/20"}`}>
                  {/* Phase indicator + elapsed timer */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Loader2 size={11} className="animate-spin text-amber-400" />
                      <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">
                        {toolSearchStatus.queries.length > 0
                          ? toolSearchStatus.active
                            ? "Searching case law"
                            : "Writing response"
                          : elapsedMs < 2000
                            ? "Preparing"
                            : "Retrieving context"}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-amber-400/80 tabular-nums">
                      {(elapsedMs / 1000).toFixed(1)}s
                    </span>
                  </div>

                  {/* Tool search queries — shown once events arrive */}
                  {toolSearchStatus.queries.length > 0 && (
                    <div className="mb-3 space-y-1">
                      {toolSearchStatus.queries.map((q, i) => (
                        <div key={i} className="flex items-center gap-2 text-[9px]">
                          <Search size={8} className="text-cyan-600 flex-shrink-0" />
                          <span className="text-slate-400 font-mono truncate">{q.query}</span>
                          <span className="ml-auto text-slate-600 flex-shrink-0">
                            {q.found > 0 ? (
                              <span className="text-cyan-600">{q.found} found</span>
                            ) : (
                              <span>0 found</span>
                            )}
                          </span>
                        </div>
                      ))}
                      {!toolSearchStatus.active && toolSearchStatus.totalFound > 0 && (
                        <div className="flex items-center gap-1.5 pt-0.5 text-[9px] text-cyan-500/80">
                          <Gavel size={8} />
                          <span>{toolSearchStatus.totalFound} judgment{toolSearchStatus.totalFound !== 1 ? "s" : ""} retrieved</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Shimmer bars */}
                  <style>{`
                    @keyframes shimmer {
                      0% { background-position: -1000px 0; }
                      100% { background-position: 1000px 0; }
                    }
                    .animate-shimmer {
                      background: linear-gradient(90deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.10) 50%,rgba(255,255,255,0.04) 100%);
                      background-size: 1000px 100%;
                      animation: shimmer 2s infinite;
                    }
                  `}</style>
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-700/50 rounded animate-shimmer"></div>
                    <div className="h-3 bg-slate-700/50 rounded animate-shimmer" style={{ animationDelay: "0.3s", width: "90%" }}></div>
                    <div className="h-3 bg-slate-700/50 rounded animate-shimmer" style={{ animationDelay: "0.6s", width: "75%" }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {apiError && (
          <div className="px-6 py-2 bg-red-500/10 border-t border-red-500/20 flex items-center gap-3">
            <AlertCircle size={14} className="text-red-500" />
            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">{apiError}</span>
          </div>
        )}

        {usage && usage.percentage >= 80 && usage.percentage < 100 && (
          <div className="px-6 py-2.5 bg-amber-500/10 border-t border-amber-500/20 flex items-center justify-between gap-3" data-testid="banner-usage-warning">
            <div className="flex items-center gap-2">
              <Crown size={14} className="text-amber-500" />
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                {usage.remaining} actions remaining this month
              </span>
            </div>
            <a href={upgradeCheckoutHref} className="flex items-center gap-1 text-[10px] font-black text-amber-500 uppercase tracking-widest hover:text-amber-400 transition-colors" data-testid="link-upgrade-warning">
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
            <a href={upgradeCheckoutHref} className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-slate-950 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-colors" data-testid="link-upgrade-limit">
              Upgrade Now <ArrowUpRight size={10} />
            </a>
          </div>
        )}

        <div className="p-4 md:p-6 bg-white border-t border-[#CBD5E1]">
          <div className="flex items-center gap-2 mb-3 px-2 flex-wrap">
            <div className="relative">
              <button
                onClick={() => setShowModelMenu(!showModelMenu)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-semibold uppercase tracking-wide transition-all border duration-150 ${
                  aiMode === "turbo"
                    ? "bg-[#B45309]/10 text-[#B45309] border-[#B45309]/30"
                    : isApexAgentWebMode
                      ? "bg-cyan-500/10 text-cyan-600 border-cyan-500/30"
                      : isApexMode
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                        : "text-[#64748B] border-[#CBD5E1] hover:border-[#B45309] hover:text-[#B45309]"
                }`}
                data-testid="button-model-selector"
              >
                {aiMode === "turbo" ? (
                  <Zap size={12} className="text-amber-400" />
                ) : isApexAgentWebMode ? (
                  <Globe size={12} className="text-cyan-400" />
                ) : isApexMode ? (
                  <Sparkles size={12} className="text-emerald-400" />
                ) : (
                  <Scale size={12} />
                )}
                {currentModeName().name}
                <ChevronDown size={10} />
              </button>
              {showModelMenu && (
                <div className="model-menu-dropdown absolute bottom-full left-0 mb-2 bg-[#1e293b] border border-slate-700 rounded-xl shadow-2xl overflow-hidden min-w-[260px] z-50">
                  <div className="px-4 py-2 text-[9px] text-slate-500 uppercase tracking-widest font-bold border-b border-slate-700/50 bg-slate-800/50">
                    Select AI Model
                  </div>
                  <button
                    onClick={() => { setAiMode("standard"); setShowModelMenu(false); }}
                    className={`w-full text-left px-4 py-3 text-xs hover:bg-slate-800 transition-colors border-b border-slate-700/50 ${aiMode === "standard" ? "bg-slate-800 text-white" : "text-slate-400"}`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <Scale size={11} className="text-slate-400" />
                      Standard
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Fast, reliable responses</div>
                  </button>
                  {canUseTurbo && (
                    <button
                      onClick={() => { setAiMode("turbo"); setShowModelMenu(false); }}
                      className={`w-full text-left px-4 py-3 text-xs hover:bg-slate-800 transition-colors border-b border-slate-700/50 ${aiMode === "turbo" ? "bg-amber-500/10 text-amber-400" : "text-slate-400"}`}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        <Zap size={11} className="text-amber-500" />
                        Turbo
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Deep reasoning & analysis</div>
                    </button>
                  )}
                  {!canUseTurbo && (
                    <div className="w-full text-left px-4 py-3 text-xs text-slate-600 border-b border-slate-700/50">
                      <div className="font-bold flex items-center gap-1.5">
                        <Lock size={10} className="text-slate-600" />
                        Turbo
                        <span className="text-[8px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-full font-black">PRO</span>
                      </div>
                      <div className="text-[10px] text-slate-600 mt-0.5">Upgrade to Pro to unlock</div>
                    </div>
                  )}
                  {canUseTurbo && apexData?.available && apexData.models.length > 0 && (
                    <>
                      <div className="px-4 py-1.5 text-[9px] text-emerald-500/70 uppercase tracking-widest font-bold border-b border-slate-700/50 bg-emerald-500/5">
                        Apex Models
                      </div>
                      {apexData.models.map(model => (
                        <button
                          key={model.id}
                          onClick={() => { setAiMode(model.id); setShowModelMenu(false); }}
                          className={`w-full text-left px-4 py-3 text-xs hover:bg-slate-800 transition-colors border-b border-slate-700/50 last:border-0 ${aiMode === model.id ? "bg-emerald-500/10 text-emerald-400" : "text-slate-400"}`}
                        >
                          <div className="font-bold flex items-center gap-1.5">
                            <Sparkles size={11} className="text-emerald-500" />
                            {model.name}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{model.description}</div>
                        </button>
                      ))}
                    </>
                  )}
                  {canUseApex && (
                    <>
                      <div className="px-4 py-1.5 text-[9px] text-cyan-400/70 uppercase tracking-widest font-bold border-b border-slate-700/50 bg-cyan-500/5">
                        Agent Mode
                      </div>
                      <button
                        onClick={() => { setAiMode("apex-agent-web"); setShowModelMenu(false); }}
                        className={`w-full text-left px-4 py-3 text-xs hover:bg-slate-800 transition-colors border-b border-slate-700/50 last:border-0 ${aiMode === "apex-agent-web" ? "bg-cyan-500/10 text-cyan-400" : "text-slate-400"}`}
                      >
                        <div className="font-bold flex items-center gap-1.5">
                          <Globe size={11} className="text-cyan-400" />
                          Apex Agent Web
                          <span className="text-[8px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full font-black">WEB</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Live web research across Pakistani legal databases</div>
                      </button>
                    </>
                  )}
                  {(!apexData?.available || !apexData.models.length) && !canUseTurbo && (
                    <div className="px-4 py-2 text-[9px] text-slate-600 border-t border-slate-700/30">
                      Upgrade to Pro for more models
                    </div>
                  )}
                </div>
              )}
            </div>

            <span className={`text-[9px] tracking-wide ${currentModeName().color}`}>
              {aiMode === "standard" ? "" :
                aiMode === "turbo" ? "Deep reasoning mode" :
                `Using ${currentModeName().name}`}
            </span>
          </div>

          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 px-3">
              {attachedFiles.map((file, i) => (
                <div key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-[11px] text-slate-300 font-medium">
                  {getFileIcon(file.name)}
                  <span className="max-w-[120px] truncate">{file.name}</span>
                  <span className="text-[9px] text-slate-500">({(file.size / 1024).toFixed(0)}KB)</span>
                  <button onClick={() => removeFile(i)} className="ml-1 text-slate-500 hover:text-red-400 transition-colors">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {isTranscribing && (
            <div className="flex items-center gap-2 mb-2 px-3">
              <Loader2 size={14} className="animate-spin text-amber-500" />
              <span className="text-[10px] text-amber-400 font-black uppercase tracking-widest">Transcribing audio...</span>
            </div>
          )}


          <div className="flex gap-1.5 sm:gap-2 bg-white border border-[#CBD5E1] p-2.5 sm:p-3 rounded-xl shadow-sm items-end">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
              className="min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center p-1.5 sm:p-2 text-[#64748B] hover:text-[#B45309] hover:bg-[#B45309]/10 rounded-lg transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Attach document (TXT, PDF, DOCX)"
            >
              <Paperclip size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>

            <button
              onClick={() => audioInputRef.current?.click()}
              disabled={isLoading || isTranscribing}
              className={`min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center p-1.5 sm:p-2 rounded-lg transition-all duration-150 ${
                isTranscribing
                  ? "text-[#B45309] bg-[#B45309]/10"
                  : "text-[#64748B] hover:text-[#B45309] hover:bg-[#B45309]/10"
              } disabled:opacity-30 disabled:cursor-not-allowed`}
              title="Transcribe audio file (MP3, WAV, M4A)"
            >
              <Mic size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>

            <textarea
              ref={promptInputRef}
              rows={1}
              spellCheck="true"
              autoCorrect="on"
              className="flex-1 min-h-[40px] sm:min-h-[44px] max-h-40 sm:max-h-44 resize-none overflow-y-auto bg-transparent border-none px-2.5 sm:px-3 py-1.5 sm:py-2 text-sm text-[#0F172A] leading-6 focus:ring-0 focus:outline-none placeholder:text-[#94A3B8]"
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
              disabled={isLoading || isTranscribing}
              data-testid="button-send"
              className="min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center p-1.5 sm:p-2.5 bg-[#B45309] text-white rounded-lg hover:bg-[#A23E0A] shadow-sm transition-all duration-150 active:scale-95 disabled:opacity-50 font-semibold flex-shrink-0"
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
    <div className="h-full w-full min-h-0 rounded-2xl overflow-hidden border border-slate-700/70 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.14),transparent_36%),linear-gradient(180deg,#070d1b_0%,#0a1426_45%,#0b1629_100%)] shadow-[0_20px_80px_rgba(2,6,23,0.55)] fade-in">
      <div className="relative h-full w-full">
        <aside
          className={`hidden lg:flex absolute left-3 top-28 xl:top-20 bottom-24 z-30 transition-[width,opacity,transform] duration-300 ease-out overflow-hidden ${
            leftRailVisible
              ? "w-64 opacity-100 translate-x-0"
              : "w-0 opacity-0 -translate-x-3 pointer-events-none"
          }`}
        >
          <div className="p-5 flex flex-col h-full w-64 rounded-2xl border border-amber-400/20 bg-[#081328]/85 backdrop-blur-xl shadow-[0_20px_45px_rgba(120,53,15,0.28)]">
            <button
              onClick={handleClear}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 text-slate-950 w-full py-3 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/25 mb-6"
              data-testid="button-new-consultation"
            >
              <PlusCircle size={18} />
              <span>New Consultation</span>
            </button>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-hide">
              <h3 className="text-[11px] font-bold text-amber-300/70 uppercase tracking-widest mb-3 px-2">Recent Consultations</h3>
              {threads.slice(0, 12).map((thread) => {
                const isActive = sharedThreadId === thread.id;
                return (
                  <button
                    key={thread.id}
                    onClick={() => handleLoadThread(thread.id)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 ${
                      isActive
                        ? "bg-amber-500/10 border-amber-500/25"
                        : "hover:bg-white/5 border-transparent"
                    }`}
                    data-testid={`thread-item-${thread.id}`}
                  >
                    {isActive ? <FolderOpen size={16} className="text-amber-400 shrink-0" /> : <Folder size={16} className="text-slate-500 shrink-0" />}
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${isActive ? "text-amber-300" : "text-slate-300"}`}>
                        {thread.title || "Untitled Consultation"}
                      </p>
                      <p className="text-[10px] text-slate-500">{thread.createdAt ? new Date(thread.createdAt).toLocaleString() : "Recent"}</p>
                    </div>
                  </button>
                );
              })}
              {threads.length === 0 && (
                <p className="text-xs text-slate-500 px-2">No consultations yet.</p>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-amber-500/10" />
          </div>
        </aside>

        <div className="hidden lg:flex absolute left-3 top-1/2 -translate-y-1/2 z-40">
          <button
            onClick={() => setLeftRailOpen((prev) => !prev)}
            className="h-16 w-6 border border-amber-400/35 rounded-r-lg bg-gradient-to-b from-amber-500/25 via-[#15233b] to-[#0c1525] text-amber-100 hover:from-amber-400/40 hover:via-[#1b2e4d] hover:to-[#0c1525] flex items-center justify-center transition-all shadow-[0_0_20px_rgba(251,191,36,0.24)]"
            data-testid="divider-toggle-left-chat-rail"
            title={leftRailVisible ? "Collapse workspace panel" : "Expand workspace panel"}
            aria-label={leftRailVisible ? "Collapse workspace panel" : "Expand workspace panel"}
          >
            {leftRailVisible ? <ChevronLeft size={15} className="drop-shadow" /> : <ChevronRight size={15} className="drop-shadow" />}
          </button>
        </div>

        <main className="h-full flex flex-col bg-[#0a0e27]">

          <section className="xl:hidden border-b border-amber-500/10 bg-[#0f172a]/55 px-3 sm:px-6 py-2">
            <details className="group">
              <summary className="list-none cursor-pointer flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-amber-300">
                <span className="inline-flex items-center gap-2">
                  <FileText size={13} />
                  Live Legal Insights
                </span>
                <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
              </summary>
              <div className="pt-3 max-h-[42vh] overflow-y-auto pr-1 scrollbar-hide">
                {renderInsightsCards(true)}
              </div>
            </details>
          </section>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 sm:space-y-7 scrollbar-hide bg-[linear-gradient(180deg,rgba(10,14,39,0.5),rgba(15,23,50,0.8))] flex flex-col items-center">
            <div className="w-full max-w-2xl">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                <Scale size={44} className="text-amber-400/60" />
                <p className="text-slate-300 italic text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>
                  "Main hoon Al Wakeelo -- not just your lawyer, your strategy partner in justice."
                </p>
                <p className="text-[10px] text-amber-200/70 uppercase tracking-widest font-black">Ask anything about Pakistan law</p>
              </div>
            )}

            {messages.map((m) => {
              const parsed = m.role === "assistant" ? parsedAssistantMessages.get(m.id) ?? null : null;
              const displayContent = parsed ? parsed.cleanContent : m.content;
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-2 sm:gap-3 w-full ${m.role === "user" ? "ml-auto flex-row-reverse" : ""}`}
                  style={OFFSCREEN_MESSAGE_STYLE}
                >
                  <div className={`h-8 w-8 sm:h-10 sm:w-10 shrink-0 rounded-full flex items-center justify-center ${m.role === "assistant" ? "bg-amber-300 text-slate-950" : "bg-[#14233d] border border-amber-300/30 text-amber-200"}`}>
                    {m.role === "assistant" ? <Scale size={18} /> : <UserIcon size={16} />}
                  </div>
                  <div className={`min-w-0 flex-1 flex flex-col gap-2 ${m.role === "user" ? "items-end" : ""}`}>
                    <p className={`text-[11px] font-bold uppercase tracking-widest ${m.role === "assistant" ? "text-amber-200" : "text-white"}`}>
                      {m.role === "assistant" ? "Al Wakeelo Assistant" : "You"}
                    </p>
                    <div
                      className={`relative group p-3 sm:p-5 rounded-2xl backdrop-blur-md ${
                        m.role === "assistant"
                          ? "w-full min-w-0 bg-[#0f1c33]/90 border border-amber-300/20 shadow-lg rounded-tl-md"
                          : "w-auto max-w-[85%] bg-transparent text-white border-2 border-amber-400/50 shadow-lg rounded-tr-md"
                      }`}
                    >
                      {m.role === "assistant" ? (
                        <>
                          {(m.modeName || m.modelName) && (
                            <div className="mb-3 pb-2 border-b border-amber-500/15">
                              <div className="text-[10px] text-white">
                                {m.modeName && (
                                  <span className={`mr-2 uppercase tracking-wider ${m.isAgentMode ? "text-cyan-400" : "text-amber-400"}`}>
                                    {m.isAgentMode && <Globe size={9} className="inline mr-1" />}
                                    {m.modeName}
                                  </span>
                                )}
                                {m.modelName && <span className="uppercase tracking-wider text-emerald-300">{m.modelName}</span>}
                                {m.moduleProfile && <span className="uppercase tracking-wider text-cyan-300 ml-2">{m.moduleProfile}</span>}
                                {m.modelDescription && <span className="block mt-1 text-slate-500">{m.modelDescription}</span>}
                              </div>
                            </div>
                          )}
                          {/* Agent Research Steps */}
                          {m.isAgentMode && (m.agentSteps?.length || 0) > 0 && (
                            <div className="mb-4 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400 mb-2 flex items-center gap-1.5">
                                <Brain size={11} /> Research Process
                              </p>
                              <div className="space-y-1.5">
                                {m.agentSteps!.map((step, idx) => (
                                  <div key={idx} className="flex items-start gap-2 text-[11px]">
                                    <span className="shrink-0 mt-0.5">
                                      {step.type === "thinking" && <Brain size={11} className="text-purple-400" />}
                                      {step.type === "searching" && <Search size={11} className="text-cyan-400" />}
                                      {step.type === "reading" && <BookOpen size={11} className="text-blue-400" />}
                                      {step.type === "synthesizing" && <Sparkles size={11} className="text-emerald-400" />}
                                    </span>
                                    <span className={`${
                                      step.type === "thinking" ? "text-purple-300" :
                                      step.type === "searching" ? "text-cyan-300" :
                                      step.type === "reading" ? "text-blue-300" :
                                      "text-emerald-300"
                                    }`}>{step.content}</span>
                                  </div>
                                ))}
                              </div>
                              {(m.agentSearchQueries?.length || 0) > 0 && (
                                <div className="mt-2 pt-2 border-t border-cyan-500/15">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-cyan-500 mb-1">Search Queries</p>
                                  <div className="flex flex-wrap gap-1">
                                    {m.agentSearchQueries!.map((q, idx) => (
                                      <span key={idx} className="text-[10px] bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/20">
                                        {q}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          <LegalMarkdown content={displayContent} />
                          {parsed?.references && <ReferenceCards references={parsed.references} />}
                          {(m.ragCitations?.length || 0) > 0 && (
                            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                                RAG Citations ({m.ragConfidence || "low"})
                              </p>
                              <div className="mt-2 space-y-1.5">
                                {m.ragCitations!.slice(0, 5).map((c, idx) => (
                                  <div key={`${c.sourceDocumentId}-${c.chunkIndex}-${idx}`} className="text-[11px] text-emerald-100">
                                    <span className="font-bold">{idx + 1}.</span> {c.title} · chunk {c.chunkIndex} · {Math.round(c.score * 100)}%
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-slate-100 leading-relaxed whitespace-pre-wrap">{m.content.replace(/\[Attached:.*?\]/, "").trim()}</p>
                          {m.attachments && m.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {m.attachments.map((name, i) => (
                                <span key={i} className="text-[10px] bg-black/20 border border-white/10 px-2 py-1 rounded text-slate-300 inline-flex items-center gap-1">
                                  {getFileIcon(name)} {name}
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                      {m.role === "assistant" && (
                        <button
                          onClick={() => !bookmarkedIds.has(m.id) && !bookmarkMutation.isPending && bookmarkMutation.mutate(m)}
                          disabled={bookmarkMutation.isPending}
                          className={`absolute top-3 right-3 p-1.5 rounded-lg border transition-opacity disabled:opacity-50 disabled:cursor-not-allowed ${bookmarkedIds.has(m.id) ? "opacity-100 border-amber-500/50 text-amber-400 bg-amber-500/10" : "opacity-0 group-hover:opacity-100 border-amber-500/20 text-slate-400 hover:text-amber-400"}`}
                          data-testid="button-bookmark"
                          title={bookmarkedIds.has(m.id) ? "Bookmarked" : "Save to bookmarks"}
                        >
                          {bookmarkedIds.has(m.id) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start gap-3 w-full">
                <div className={`h-8 w-8 sm:h-10 sm:w-10 shrink-0 rounded-full text-slate-950 flex items-center justify-center ${isApexAgentWebMode ? "bg-cyan-400" : "bg-amber-300"}`}>
                  {isApexAgentWebMode ? <Globe size={18} /> : <Scale size={18} />}
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-amber-200">
                    Al Wakeelo Assistant
                  </p>
                  <div className="p-3 sm:p-5 rounded-2xl bg-[#0f1c33]/90 border border-amber-300/20 shadow-lg rounded-tl-md">
                    <style>{`
                      @keyframes shimmer {
                        0% { background-position: -1000px 0; }
                        100% { background-position: 1000px 0; }
                      }
                      .animate-shimmer {
                        background: linear-gradient(
                          90deg,
                          rgba(255, 255, 255, 0.05) 0%,
                          rgba(255, 255, 255, 0.15) 50%,
                          rgba(255, 255, 255, 0.05) 100%
                        );
                        background-size: 1000px 100%;
                        animation: shimmer 2s infinite;
                      }
                      @keyframes pulse-text {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.6; }
                      }
                      .animate-pulse-text {
                        animation: pulse-text 1.5s ease-in-out infinite;
                      }
                    `}</style>
                    <div className="space-y-2.5">
                      <p className="text-sm text-amber-200 font-semibold animate-pulse-text flex items-center gap-2">
                        <span className="inline-flex gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce"></span>
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "0.4s" }}></span>
                        </span>
                        Generating response...
                      </p>
                      <div className="h-4 bg-slate-700/40 rounded animate-shimmer"></div>
                      <div className="h-4 bg-slate-700/40 rounded animate-shimmer" style={{ animationDelay: "0.2s", width: "95%" }}></div>
                      <div className="h-4 bg-slate-700/40 rounded animate-shimmer" style={{ animationDelay: "0.4s", width: "90%" }}></div>
                      <div className="mt-4 pt-3 border-t border-amber-500/15 space-y-2.5">
                        <div className="h-3 bg-slate-700/40 rounded animate-shimmer" style={{ animationDelay: "0.6s", width: "80%" }}></div>
                        <div className="h-3 bg-slate-700/40 rounded animate-shimmer" style={{ animationDelay: "0.8s", width: "85%" }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>

          <div className="p-2 sm:p-6 pt-2 border-t border-amber-400/15 bg-[#071327]/75">
            {apiError && (
              <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                <AlertCircle size={14} className="text-red-400" />
                <span className="text-[10px] text-red-300 font-bold uppercase tracking-widest">{apiError}</span>
              </div>
            )}

            <div className="w-full bg-[#081428]/92 border border-amber-300/20 rounded-2xl shadow-[0_14px_38px_rgba(120,53,15,0.34)] relative">
              {/* Status Bar */}
              <div className="flex justify-between items-center px-4 py-3 border-b border-amber-400/15 bg-[#081428]/50">
                <div className="flex items-center gap-3">
                  {isAlWakeelo && (
                    <button
                      onClick={() => setRagEnabled((prev) => !prev)}
                      className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 cursor-pointer ${
                        ragEnabled ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" : "text-slate-400 border-amber-500/20"
                      }`}
                      title="Toggle Retrieval-Augmented Generation"
                    >
                      <span className={`w-2 h-2 rounded-full ${ragEnabled ? "bg-emerald-400" : "bg-slate-500"}`}></span>
                      {ragEnabled ? "RAG ACTIVE" : "RAG OFF"}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider relative">
                  <button
                    onClick={() => setShowModelMenu(!showModelMenu)}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 border text-[10px] font-black uppercase tracking-wider ${
                      isApexAgentWebMode
                        ? "text-cyan-300 border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 focus-visible:ring-cyan-300/60"
                        : isApexMode
                          ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 focus-visible:ring-emerald-300/60"
                          : aiMode === "turbo"
                            ? "text-amber-300 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 focus-visible:ring-amber-300/60"
                            : "text-slate-300 border-slate-600/60 bg-slate-700/30 hover:bg-slate-700/60 focus-visible:ring-slate-300/60"
                    }`}
                    data-testid="button-model-selector"
                  >
                    {isApexAgentWebMode ? <Globe size={10} /> : isApexMode ? <Sparkles size={10} /> : aiMode === "turbo" ? <Zap size={10} /> : <Scale size={10} />}
                    {currentModeName().name}
                    <ChevronDown size={9} />
                  </button>
                  {showModelMenu && (
                    <div className="absolute bottom-full right-0 mb-2 bg-[#1e293b] border border-amber-500/20 rounded-xl shadow-2xl overflow-hidden min-w-[280px] z-50">
                      <div className="px-4 py-2 text-[9px] text-slate-400 uppercase tracking-widest font-black border-b border-amber-500/15">Select AI Model</div>
                      <button onClick={() => { setAiMode("standard"); setShowModelMenu(false); }} className={`w-full text-left px-4 py-3 text-xs hover:bg-white/5 border-b border-amber-500/10 ${aiMode === "standard" ? "bg-amber-500/10 text-amber-300" : "text-slate-300"}`}>
                        <div className="font-bold">Standard</div><div className="text-[10px] text-slate-500 mt-0.5">Fast, reliable responses</div>
                      </button>
                      {canUseTurbo && (
                        <button onClick={() => { setAiMode("turbo"); setShowModelMenu(false); }} className={`w-full text-left px-4 py-3 text-xs hover:bg-white/5 border-b border-amber-500/10 ${aiMode === "turbo" ? "bg-amber-500/10 text-amber-300" : "text-slate-300"}`}>
                          <div className="font-bold">Turbo</div><div className="text-[10px] text-slate-500 mt-0.5">Deep reasoning & analysis</div>
                        </button>
                      )}
                      {canUseTurbo && apexData?.available && apexData.models.length > 0 && (
                        <>
                          <div className="px-4 py-1.5 text-[9px] text-emerald-300 uppercase tracking-widest font-black border-b border-amber-500/10 bg-emerald-500/10">Apex Models</div>
                          {apexData.models.map(model => (
                            <button
                              key={model.id}
                              onClick={() => { setAiMode(`apex-${model.id}`); setShowModelMenu(false); }}
                              className={`w-full text-left px-4 py-3 text-xs hover:bg-white/5 border-b border-amber-500/10 last:border-0 ${aiMode === `apex-${model.id}` ? "bg-emerald-500/10 text-emerald-300" : "text-slate-300"}`}
                            >
                              <div className="font-bold">{model.name}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{model.description}</div>
                            </button>
                          ))}
                        </>
                      )}
                      {canUseApex && (
                        <>
                          <div className="px-4 py-1.5 text-[9px] text-cyan-300 uppercase tracking-widest font-black border-b border-amber-500/10 bg-cyan-500/10">Agent Mode</div>
                          <button
                            onClick={() => { setAiMode("apex-agent-web"); setShowModelMenu(false); }}
                            className={`w-full text-left px-4 py-3 text-xs hover:bg-white/5 border-b border-amber-500/10 last:border-0 ${aiMode === "apex-agent-web" ? "bg-cyan-500/12 text-cyan-300" : "text-slate-300"}`}
                          >
                            <div className="font-bold flex items-center gap-1.5">
                              <Globe size={11} className="text-cyan-400" />
                              Apex Agent Web
                              <span className="text-[8px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full font-black">WEB</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">Live web research across Pakistani legal databases</div>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Input Row */}
              <div className="flex items-end gap-3 p-3 sm:p-4">
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple className="hidden" />
                <input type="file" ref={audioInputRef} onChange={handleAudioSelect} accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg" className="hidden" />

                <button onClick={() => fileInputRef.current?.click()} disabled={isLoading || attachedFiles.length >= 5} className="p-2 text-slate-500 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 rounded-lg">
                  <Paperclip size={18} />
                </button>
                <button onClick={() => audioInputRef.current?.click()} disabled={isLoading || isTranscribing} className="p-2.5 text-slate-400 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 rounded-lg transition-colors">
                  {isTranscribing ? <Loader2 size={18} className="animate-spin text-amber-400" /> : <Mic size={18} />}
                </button>

                <textarea
                  ref={promptInputRef}
                  rows={1}
                  className="flex-1 min-w-[200px] min-h-[50px] max-h-40 resize-none overflow-y-auto bg-transparent border-none focus:ring-0 text-base text-slate-100 placeholder:text-slate-500 px-3 py-3 leading-6 focus:outline-none"
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


                <button onClick={() => handleSend()} disabled={isLoading || isTranscribing} data-testid="button-send" className="bg-gradient-to-br from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 disabled:from-amber-400/50 disabled:to-amber-600/50 text-slate-950 h-12 w-12 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 flex-shrink-0">
                  <Send size={20} />
                </button>
              </div>

              {attachedFiles.length > 0 && (
                <div className="px-2 pb-2 flex flex-wrap gap-2">
                  {attachedFiles.map((file, i) => (
                    <div key={i} className="inline-flex items-center gap-1.5 px-2 py-1 bg-black/25 border border-white/10 rounded text-[10px] text-slate-300">
                      {getFileIcon(file.name)}
                      <span className="max-w-[120px] truncate">{file.name}</span>
                      <button onClick={() => removeFile(i)} className="text-slate-500 hover:text-red-400"><X size={11} /></button>
                    </div>
                  ))}
                </div>
              )}
              {attachedFiles.length >= 5 && (
                <div className="px-2 pb-2 text-[10px] text-amber-400">
                  Maximum 5 files reached. Remove a file to add more.
                </div>
              )}
            </div>

            {usage && usage.percentage >= 80 && (
              <div className={`w-full mt-3 px-3 py-2 rounded-lg border flex items-center justify-between gap-3 ${usage.percentage >= 100 ? "bg-red-500/10 border-red-500/20" : "bg-amber-500/10 border-amber-500/20"}`}>
                <div className="flex items-center gap-2">
                  {usage.percentage >= 100 ? <Lock size={13} className="text-red-400" /> : <Crown size={13} className="text-amber-400" />}
                  <span className={`text-[10px] font-black uppercase tracking-wider ${usage.percentage >= 100 ? "text-red-300" : "text-amber-300"}`}>
                    {usage.percentage >= 100 ? `Limit reached (${usage.used}/${usage.monthlyLimit} actions)` : `${usage.remaining} actions remaining`}
                  </span>
                </div>
                <a href={upgradeCheckoutHref} className="text-[10px] font-black uppercase tracking-wider text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 rounded-md" data-testid="link-upgrade-warning">
                  Upgrade <ArrowUpRight size={10} />
                </a>
              </div>
            )}
          </div>
        </main>

        <div className="hidden xl:flex absolute right-3 top-1/2 -translate-y-1/2 z-40">
          <button
            onClick={() => setRightRailOpen((prev) => !prev)}
            className="h-16 w-6 border border-amber-400/35 rounded-l-lg bg-gradient-to-b from-amber-500/25 via-[#15233b] to-[#0c1525] text-amber-100 hover:from-amber-400/40 hover:via-[#1b2e4d] hover:to-[#0c1525] flex items-center justify-center transition-all shadow-[0_0_20px_rgba(251,191,36,0.24)]"
            data-testid="divider-toggle-right-chat-rail"
            title={rightRailVisible ? "Collapse insights panel" : "Expand insights panel"}
            aria-label={rightRailVisible ? "Collapse insights panel" : "Expand insights panel"}
          >
            {rightRailVisible ? <ChevronRight size={15} className="drop-shadow" /> : <ChevronLeft size={15} className="drop-shadow" />}
          </button>
        </div>

        <aside
          className={`hidden xl:flex absolute right-3 top-20 bottom-24 z-30 transition-[width,opacity,transform] duration-300 ease-out overflow-hidden ${
            rightRailVisible
              ? "w-64 opacity-100 translate-x-0"
              : "w-0 opacity-0 translate-x-3 pointer-events-none"
          }`}
        >
          <div className="p-5 overflow-y-auto h-full space-y-8 scrollbar-hide w-64 rounded-2xl border border-amber-400/20 bg-[#081328]/85 backdrop-blur-xl shadow-[0_20px_45px_rgba(120,53,15,0.28)]">
            {renderInsightsCards(false)}
          </div>
        </aside>
      </div>
    </div>
  );
}
