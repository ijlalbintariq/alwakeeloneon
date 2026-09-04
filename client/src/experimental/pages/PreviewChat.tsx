import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Bot,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Gavel,
  Scale,
  Clock,
  Zap,
  Crown,
  Copy,
  Check,
  Bookmark,
  BookmarkCheck,
  Share2,
  RotateCcw,
  PanelLeft,
  PanelRight,
  AlertCircle,
  Loader2,
  Brain,
  ExternalLink,
  MessageSquare,
  Search,
  BookOpen,
  FolderOpen,
  Radio,
  FileText,
  HelpCircle,
  FileSignature,
} from "lucide-react";
import { PreviewShell } from "@/experimental/components/PreviewShell";
import { ChatHistoryDrawer, ThreadItem } from "@/experimental/components/chat/ChatHistoryDrawer";
import { ChatModelSelector, ModelTier } from "@/experimental/components/chat/ChatModelSelector";
import { ChatComposer } from "@/experimental/components/chat/ChatComposer";
import { ChatInspectorDrawer, CitationItem, StatuteItem, BookmarkItem } from "@/experimental/components/chat/ChatInspectorDrawer";
import { CaseLawCard, CaseLawCardData } from "@/experimental/components/chat/CaseLawCard";
import { ChatCitationChip } from "@/experimental/components/chat/ChatCitationChip";
import { LegalMarkdown } from "@/components/legal-markdown";
import { parseReferences } from "@/components/reference-cards";
import { cleanLegalChatResponse } from "@/experimental/lib/cleanChatResponse";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  displayContent?: string;
  attachments?: string[];
  modeName?: string;
  modelName?: string;
  modelId?: string;
  modelDescription?: string;
  moduleProfile?: string;
  routingPath?: string[];
  caseLawCard?: CaseLawCardData;
  ragCitations?: Array<{
    documentId: number;
    sourceDocumentId: number;
    title: string;
    chunkIndex: number;
    score: number;
    quote: string;
    sourceScope?: string;
  }>;
}

const PREVIEW_ACTIVE_THREAD_KEY = "alwakeelo-preview-active-thread-id";

export const PreviewChat: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [_, setLocation] = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [modelTier, setModelTier] = useState<ModelTier>("standard");

  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [selectedCaseFileId, setSelectedCaseFileId] = useState<number | null>(null);

  // Drawers: Default FALSE so the chat canvas is 100% full width and spacious
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);

  // Latency and tool search indicator state
  const [toolSearchStatus, setToolSearchStatus] = useState<{
    active: boolean;
    queries: Array<{ query: string; found: number; elapsedMs: number }>;
    totalFound: number;
    totalMs: number;
  }>({ active: false, queries: [], totalFound: 0, totalMs: 0 });

  const [elapsedMs, setElapsedMs] = useState(0);
  const loadStartRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeThreadIdRef = useRef<number | null>(activeThreadId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  // Elapsed query latency timer
  useEffect(() => {
    if (isLoading) {
      loadStartRef.current = Date.now();
      setElapsedMs(0);
      const timer = setInterval(() => {
        if (loadStartRef.current !== null) {
          setElapsedMs(Date.now() - loadStartRef.current);
        }
      }, 100);
      return () => clearInterval(timer);
    } else {
      loadStartRef.current = null;
    }
  }, [isLoading]);

  // Auto-scroll on message updates (only when messages exist or actively streaming)
  useEffect(() => {
    if (messages.length > 0 || isLoading || isThinking) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isThinking]);

  // Voice recording with Whisper
  const handleVoiceTranscription = useCallback((text: string) => {
    setInputPrompt((prev) => (prev ? `${prev}\n\n[Voice Note]: ${text}` : text));
    setApiError(null);
  }, []);

  const voice = useVoiceRecorder({ onAutoTranscription: handleVoiceTranscription });

  // Data fetching: threads, case files, user docs, bookmarks, usage
  const { data: threads = [], isLoading: threadsLoading } = useQuery<ThreadItem[]>({
    queryKey: ["/api/threads"],
    staleTime: 20_000,
  });

  const { data: caseFiles = [] } = useQuery<Array<{ id: number; title: string; status: string }>>({
    queryKey: ["/api/case-files"],
  });

  const { data: bookmarks = [] } = useQuery<BookmarkItem[]>({
    queryKey: ["/api/bookmarks"],
  });

  const { data: usage } = useQuery<{ tier: string }>({
    queryKey: ["/api/usage"],
  });

  const canUseTurbo = usage?.tier === "pro" || usage?.tier === "chamber" || usage?.tier === "enterprise" || user?.isAdmin;
  const canUseApex = usage?.tier === "chamber" || usage?.tier === "enterprise" || user?.isAdmin;

  // Restore persisted active thread
  useEffect(() => {
    if (activeThreadId !== null) return;
    const saved = localStorage.getItem(PREVIEW_ACTIVE_THREAD_KEY);
    const savedId = Number(saved);
    if (savedId > 0 && threads.some((t) => t.id === savedId)) {
      handleLoadThread(savedId);
    }
  }, [threads]);

  // Persist consultation turn
  const persistTurn = useCallback(async (userMsg: ChatMessage, assistantMsg: ChatMessage) => {
    try {
      const currentThreadId = activeThreadIdRef.current;
      const titleClean = String(userMsg.content || "")
        .replace(/\s*\[Attached:[^\]]+\]\s*/gi, " ")
        .trim();
      const title = (titleClean || "Al Wakeelo Consultation").slice(0, 240);

      const res = await apiRequest("POST", "/api/threads/upsert-turn", {
        threadId: currentThreadId || undefined,
        title,
        userMessage: userMsg.content,
        assistantMessage: assistantMsg.content,
      });

      const data = await res.json().catch(() => null);
      const nextThreadId = Number(data?.thread?.id || data?.threadId || 0);
      if (nextThreadId > 0 && nextThreadId !== currentThreadId) {
        setActiveThreadId(nextThreadId);
        activeThreadIdRef.current = nextThreadId;
        localStorage.setItem(PREVIEW_ACTIVE_THREAD_KEY, String(nextThreadId));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/threads"] });
    } catch (err) {
      console.warn("Failed to auto-persist turn:", err);
    }
  }, []);

  // Load thread from backend
  const handleLoadThread = useCallback(async (threadId: number) => {
    try {
      setIsLoading(true);
      const res = await apiRequest("GET", `/api/threads/${threadId}`);
      const data = await res.json();
      if (!data?.messages) return;

      const restored: ChatMessage[] = data.messages.map((m: any, idx: number) => {
        const rawContent = String(m.content || "");
        const isAssistant = m.role === "assistant";
        const cleaned = isAssistant ? cleanLegalChatResponse(rawContent) : null;
        const content = cleaned ? cleaned.cleanContent : rawContent;
        const base: ChatMessage = {
          id: String(m.id ?? `${threadId}-${idx}`),
          role: isAssistant ? "assistant" : "user",
          content,
        };

        if (isAssistant && cleaned?.references?.judgments && cleaned.references.judgments.length > 0) {
          base.caseLawCard = {
            hits: cleaned.references.judgments.map((j) => ({
              citation: j.citation,
              title: j.title || "",
              court: j.court || "Supreme Court of Pakistan",
              snippet: j.description || "",
            })),
            totalFound: cleaned.references.judgments.length,
            queriesUsed: [],
          };
        }
        return base;
      });

      setMessages(restored);
      setActiveThreadId(threadId);
      activeThreadIdRef.current = threadId;
      localStorage.setItem(PREVIEW_ACTIVE_THREAD_KEY, String(threadId));
      setApiError(null);
    } catch (err) {
      console.error("Failed to load thread:", err);
      setApiError("Unable to load consultation history.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Start new consultation
  const handleNewConsultation = () => {
    setMessages([]);
    setActiveThreadId(null);
    activeThreadIdRef.current = null;
    localStorage.removeItem(PREVIEW_ACTIVE_THREAD_KEY);
    setApiError(null);
    setAttachedFiles([]);
    setInputPrompt("");
    setToolSearchStatus({ active: false, queries: [], totalFound: 0, totalMs: 0 });
  };


  // Parse threadId from URL if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlThreadId = params.get('threadId');
    if (urlThreadId && Number(urlThreadId) > 0) {
      handleLoadThread(Number(urlThreadId));
      // Optionally clean the URL so it doesn't get stuck
      window.history.replaceState({}, '', '/preview/chat');
    }
  }, [handleLoadThread]);

  // Delete thread
  const handleDeleteThread = async (threadId: number) => {
    try {
      await apiRequest("DELETE", `/api/threads/${threadId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/threads"] });
      if (activeThreadId === threadId) {
        handleNewConsultation();
      }
    } catch (err) {
      console.error("Failed to delete thread:", err);
    }
  };

  // Stop current streaming generation
  const handleStop = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
    setIsThinking(false);
    setToolSearchStatus({ active: false, queries: [], totalFound: 0, totalMs: 0 });
  };

  // Bookmark an assistant message
  const bookmarkMutation = useMutation({
    mutationFn: async (msg: ChatMessage) => {
      const idx = messages.findIndex((m) => m.id === msg.id);
      const userMsg = idx > 0 ? messages.slice(0, idx).reverse().find((m) => m.role === "user") : null;
      const rawTitle = userMsg ? userMsg.content.slice(0, 80) : "Al Wakeelo Legal Research";

      await apiRequest("POST", "/api/bookmarks", {
        title: rawTitle.trim(),
        content: msg.content,
        type: "al-wakeelo",
        category: "Preview Intelligence",
      });
      return msg.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      toast({ title: "Saved to Bookmarks", description: "You can view this in your Knowledge Vault bookmarks." });
    },
  });

  // Share conversation turn
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const handleShare = async () => {
    if (messages.length < 2) return;
    try {
      let tId = activeThreadId;
      if (!tId) {
        const firstUser = messages.find((m) => m.role === "user");
        const threadRes = await apiRequest("POST", "/api/threads/save-for-share", {
          title: firstUser?.content.slice(0, 100) || "Al Wakeelo Legal Research",
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });
        const threadData = await threadRes.json();
        tId = threadData.id;
        setActiveThreadId(tId);
      }
      const shareRes = await apiRequest("POST", `/api/threads/${tId}/share`);
      const shareData = await shareRes.json();
      const fullUrl = `${window.location.origin}${shareData.shareUrl}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedShareUrl(true);
      setTimeout(() => setCopiedShareUrl(false), 3000);
    } catch (err) {
      console.error("Failed to share consultation:", err);
    }
  };

  // Main Send handler for SSE Streaming
  const handleSend = async (overridePrompt?: string) => {
    const text = overridePrompt || inputPrompt;
    if ((!text.trim() && attachedFiles.length === 0) || isLoading) return;

    setApiError(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const fileNames = attachedFiles.map((f) => f.name);
    const displayText = fileNames.length > 0
      ? `${text}${text ? "\n" : ""}[Attached: ${fileNames.join(", ")}]`
      : text;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: displayText,
      attachments: fileNames.length > 0 ? fileNames : undefined,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputPrompt("");
    setIsLoading(true);
    setIsThinking(false);
    setToolSearchStatus({ active: false, queries: [], totalFound: 0, totalMs: 0 });

    const currentFiles = [...attachedFiles];
    setAttachedFiles([]);

    const assistantId = (Date.now() + 1).toString();

    try {
      // RAG Vault mode branch
      if (ragEnabled && text.trim().length > 0 && currentFiles.length === 0) {
        const recentHistory = updatedMessages
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content.substring(0, 500) }));

        const ragBody: any = {
          query: text,
          documentIds: [],
          conversationHistory: recentHistory.length > 1 ? recentHistory : undefined,
        };
        if (selectedCaseFileId) ragBody.caseFileId = selectedCaseFileId;

        const ragRes = await apiRequest("POST", "/api/rag/ask", ragBody);
        const ragData = await ragRes.json();

        const assistantMsg: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: ragData?.answer || "No response generated from vault.",
          modeName: "Vault Grounded",
          modelName: "Knowledge Vault RAG",
          modelId: "rag-engine",
          modelDescription: "Grounded with Pakistani statutes and chamber documents.",
          ragCitations: Array.isArray(ragData?.citations) ? ragData.citations : [],
        };

        setMessages([...updatedMessages, assistantMsg]);
        await persistTurn(userMsg, assistantMsg);
        queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
        return;
      }

      // Real Production /api/ai/chat SSE streaming pipeline
      let response: Response;
      const requestedMode = modelTier;

      if (currentFiles.length > 0) {
        const formData = new FormData();
        formData.append("messages", JSON.stringify(updatedMessages.map((m) => ({ role: m.role, content: m.content }))));
        formData.append("type", "al-wakeelo");
        formData.append("moduleIntent", "chat.general");
        formData.append("turbo", String(modelTier === "turbo"));
        formData.append("aiMode", requestedMode);
        formData.append("stream", "true");
        currentFiles.forEach((file) => formData.append("attachments", file));

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
            messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
            type: "al-wakeelo",
            moduleIntent: "chat.general",
            turbo: modelTier === "turbo",
            aiMode: requestedMode,
            stream: true,
          }),
          signal: controller.signal,
        });
      }

      if (!response.ok) {
        const errText = await response.text();
        const isLimitError = response.status === 429;
        if (response.status === 401) {
          throw { message: "Chamber session unauthenticated. Please sign in via the Sign In tab (/preview/auth) to enable live LLM intelligence." };
        }
        throw { message: `${response.status}: ${errText}`, isLimit: isLimitError };
      }

      const contentType = response.headers.get("content-type") || "";
      let persistedAssistantContent = "";

      if (contentType.includes("application/json")) {
        const data = await response.json();
        const modelId = data.model || modelTier;
        const modelLabel =
          modelTier === "apex" ? "Apex Tier" : modelTier === "turbo" ? "Turbo Intelligence" : "Standard Intelligence";
        const cleaned = cleanLegalChatResponse(data.content || "");
        const assistantMessage: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: cleaned.cleanContent,
          modeName: modelTier.toUpperCase(),
          modelName: modelLabel,
          modelId,
          moduleProfile: typeof data.moduleProfile === "string" ? data.moduleProfile : undefined,
          routingPath: Array.isArray(data.routingPath) ? data.routingPath.map(String) : undefined,
          caseLawCard: cleaned.references?.judgments && cleaned.references.judgments.length > 0 ? {
            hits: cleaned.references.judgments.map((j) => ({
              citation: j.citation,
              title: j.title || "",
              court: j.court || "Supreme Court of Pakistan",
              snippet: j.description || "",
            })),
            totalFound: cleaned.references.judgments.length,
            queriesUsed: [],
          } : undefined,
        };
        persistedAssistantContent = assistantMessage.content;
        setMessages([...updatedMessages, assistantMessage]);
      } else {
        setMessages([...updatedMessages, { id: assistantId, role: "assistant", content: "" }]);
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
                    if (parsed.searching === true) {
                      setToolSearchStatus((prev) => ({
                        ...prev,
                        active: true,
                        queries: [...prev.queries, { query: parsed.query, found: parsed.found ?? 0, elapsedMs: parsed.elapsedMs ?? 0 }],
                      }));
                      continue;
                    }
                    if (parsed.searching === false) {
                      setToolSearchStatus((prev) => ({
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
                    if (parsed.caseLawCard && Array.isArray(parsed.caseLawCard.hits)) {
                      const cardData: CaseLawCardData = {
                        hits: parsed.caseLawCard.hits,
                        totalFound: parsed.caseLawCard.totalFound ?? parsed.caseLawCard.hits.length,
                        queriesUsed: Array.isArray(parsed.caseLawCard.queriesUsed) ? parsed.caseLawCard.queriesUsed : [],
                      };
                      setMessages((prev) => {
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
                      setMessages((prev) => {
                        const last = prev[prev.length - 1];
                        if (last && last.id === assistantId) {
                          return [...prev.slice(0, -1), { ...last, content: "" }];
                        }
                        return prev;
                      });
                      continue;
                    }
                    if (parsed.done) {
                      const modelId = parsed.model || modelTier;
                      const modelLabel =
                        modelTier === "apex" ? "Apex Tier" : modelTier === "turbo" ? "Turbo Intelligence" : "Standard Intelligence";
                      const cleaned = cleanLegalChatResponse(accumulated);
                      setMessages((prev) => {
                        const last = prev[prev.length - 1];
                        if (last && last.id === assistantId) {
                          const cardData = last.caseLawCard || (cleaned.references?.judgments && cleaned.references.judgments.length > 0 ? {
                            hits: cleaned.references.judgments.map((j) => ({
                              citation: j.citation,
                              title: j.title || "",
                              court: j.court || "Supreme Court of Pakistan",
                              snippet: j.description || "",
                            })),
                            totalFound: cleaned.references.judgments.length,
                            queriesUsed: [],
                          } : undefined);
                          return [
                            ...prev.slice(0, -1),
                            {
                              ...last,
                              content: cleaned.cleanContent,
                              caseLawCard: cardData,
                              modeName: modelTier.toUpperCase(),
                              modelName: modelLabel,
                              modelId,
                            },
                          ];
                        }
                        return prev;
                      });
                      persistedAssistantContent = cleaned.cleanContent;
                      break;
                    }
                    if (parsed.text) {
                      accumulated += parsed.text;
                      const cleaned = cleanLegalChatResponse(accumulated);
                      const current = cleaned.cleanContent || accumulated;
                      setMessages((prev) => {
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
        await persistTurn(userMsg, {
          id: assistantId,
          role: "assistant",
          content: persistedAssistantContent,
        });
      }

      await apiRequest("POST", "/api/search-history", { type: "chat", query: text.substring(0, 80) }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
    } catch (err: any) {
      console.error("Chat error:", err);
      const errMsg = err?.message || "Communication disrupted. Please try again.";
      setApiError(errMsg);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.id === assistantId && !last.content) {
          return [...prev.slice(0, -1), { id: assistantId, role: "assistant", content: `⚠️ ${errMsg}` }];
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
      setIsThinking(false);
    }
  };

  // Extract legal intelligence items from the latest assistant message for the Inspector
  const latestAssistantMessage = useMemo(() => {
    return [...messages].reverse().find((m) => m.role === "assistant");
  }, [messages]);

  const inspectorData = useMemo(() => {
    if (!latestAssistantMessage) {
      return { citations: [], statutes: [] };
    }

    const text = latestAssistantMessage.content || "";
    const citations: CitationItem[] = [];
    const statutes: StatuteItem[] = [];

    // Precedent regex
    const citeRegex = /\b(\d{4}\s+(?:P\.?\s*L\.?\s*D|S\.?\s*C\.?\s*M\.?\s*R|Y\.?\s*L\.?\s*R|M\.?\s*L\.?\s*D|C\.?\s*L\.?\s*C|P\.?\s*C\.?\s*R\.?\s*L\.?\s*J|P\.?\s*L\.?\s*J|N\.?\s*L\.?\s*R|C\.?\s*L\.?\s*D|P\.?\s*T\.?\s*D|P\.?\s*L\.?\s*C|SCMR|PLJ|CLD|LHC|IHC|SHC)\s+\d+)\b/gi;
    let match;
    const seenCites = new Set<string>();
    while ((match = citeRegex.exec(text)) !== null) {
      const citeStr = match[0].trim();
      if (!seenCites.has(citeStr)) {
        seenCites.add(citeStr);
        citations.push({ citation: citeStr });
      }
    }

    // Also include hits from caseLawCard
    if (latestAssistantMessage.caseLawCard?.hits) {
      latestAssistantMessage.caseLawCard.hits.forEach((h) => {
        if (!seenCites.has(h.citation)) {
          seenCites.add(h.citation);
          citations.push({
            citation: h.citation,
            court: h.court,
            title: h.title,
            snippet: h.snippet,
          });
        }
      });
    }

    // Statute regex
    const statRegex = /\b(?:(?:Section|Sec\.?|Article|Art\.?)\s+\d+[A-Za-z]?(?:\s+(?:PPC|CPC|CrPC|IPC|QSO))?|(?:PPC|CPC|CrPC|Qanun-e-Shahadat|Constitution|Criminal Procedure Code|Civil Procedure Code|Pakistan Penal Code|Family Courts Act|Specific Relief Act|Companies Act))\b/gi;
    const seenStats = new Set<string>();
    while ((match = statRegex.exec(text)) !== null) {
      const statStr = match[0].trim();
      if (!seenStats.has(statStr)) {
        seenStats.add(statStr);
        statutes.push({ name: statStr });
      }
    }

    return { citations, statutes };
  }, [latestAssistantMessage]);

  return (
    <PreviewShell noPadding>
      <div className="flex-1 w-full flex flex-col overflow-hidden bg-white dark:bg-[#131E2E] relative">
        {/* ── Slide-Over Overlay: Consultations History Drawer ── */}
        {leftDrawerOpen && (
          <div className="absolute inset-0 z-40 flex">
            <div
              className="absolute inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
              onClick={() => setLeftDrawerOpen(false)}
            />
            <div className="relative z-50 h-full">
              <ChatHistoryDrawer
                threads={threads}
                activeThreadId={activeThreadId}
                isOpen={leftDrawerOpen}
                onToggleOpen={() => setLeftDrawerOpen(false)}
                onSelectThread={(id) => {
                  handleLoadThread(id);
                  setLeftDrawerOpen(false);
                }}
                onNewConsultation={() => {
                  handleNewConsultation();
                  setLeftDrawerOpen(false);
                }}
                onDeleteThread={handleDeleteThread}
                isLoading={threadsLoading}
              />
            </div>
          </div>
        )}

        {/* ── CENTER PANE: Full-Width Conversation Canvas & Composer ── */}
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#131E2E] relative overflow-hidden">
          {/* Header Bar */}
          <div className="px-4 py-3 border-b border-[#E5E4E2] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* Left Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLeftDrawerOpen((prev) => !prev)}
                className={cn(
                  "p-2 rounded-lg text-xs transition-colors border",
                  leftDrawerOpen
                    ? "bg-[#F5F4F2] dark:bg-[#0B131E] border-[#E5E4E2] dark:border-[#1E2D44] text-[#1A1A1A] dark:text-[#F8FAFC]"
                    : "bg-white dark:bg-[#131E2E] border-[#E5E4E2] dark:border-[#1E2D44] text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#1A1A1A] dark:text-[#F8FAFC]"
                )}
                title="Consultation History"
              >
                <PanelLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-blue-600/20 text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] flex items-center justify-center font-bold">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-semibold text-[#1A1A1A] dark:text-[#F8FAFC] truncate">
                    AI Legal Assistant
                  </h1>
                </div>
              </div>
            </div>

            {/* Right Controls: Model Selector, Share, New, Toggle Inspector */}
            <div className="flex items-center gap-2">
              <ChatModelSelector
                selectedTier={modelTier}
                onSelectTier={setModelTier}
                canUseTurbo={canUseTurbo}
                canUseApex={canUseApex}
                onUpgradeClick={(tier) => {
                  toast({
                    title: "Upgrade Required",
                    description: `The ${tier.toUpperCase()} intelligence tier is restricted. Please upgrade your subscription to access this model.`,
                    action: (
                      <button
                        onClick={() => setLocation("/preview/checkout?plan=pro&cycle=monthly")}
                        className="bg-[#105B38] text-white px-3 py-1 rounded text-xs"
                      >
                        Upgrade Now
                      </button>
                    ),
                  });
                }}
              />

              {messages.length > 1 && (
                <button
                  onClick={handleShare}
                  className="p-2 rounded-lg bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#1A1A1A] dark:text-[#F8FAFC] text-xs transition-colors"
                  title="Share Consultation URL"
                >
                  {copiedShareUrl ? (
                    <Check className="w-4 h-4 text-[#1A1A1A] dark:text-[#F8FAFC]" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                </button>
              )}

              <button
                onClick={handleNewConsultation}
                className="p-2 rounded-lg bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#1A1A1A] dark:text-[#F8FAFC] text-xs transition-colors"
                title="New Chat"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => setRightDrawerOpen((prev) => !prev)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border flex items-center gap-2",
                  rightDrawerOpen
                    ? "bg-[#105B38] border-[#105B38] text-white shadow-sm"
                    : (inspectorData.citations.length > 0 || inspectorData.statutes.length > 0)
                      ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-400 hover:bg-emerald-100 shadow-sm"
                      : "bg-white dark:bg-[#131E2E] border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E]"
                )}
                title="Legal Intelligence Inspector & Saved References"
              >
                <div className="relative">
                  <PanelRight className="w-4 h-4" />
                  {!rightDrawerOpen && (inspectorData.citations.length > 0 || inspectorData.statutes.length > 0) && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  )}
                </div>
                <span className="hidden sm:inline">Inspector & Saved</span>
                {bookmarks.length > 0 && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none",
                    rightDrawerOpen ? "bg-white dark:bg-[#131E2E]/20 text-white" : "bg-[#105B38]/10 text-[#105B38]"
                  )}>
                    {bookmarks.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Conversation Feed Canvas */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin scrollbar-thumb-[#E2E8F0]">
            {/* Empty Welcome Screen */}
            {messages.length === 0 && (
              <div className="max-w-2xl mx-auto py-4 sm:py-6 space-y-5 animate-in fade-in duration-200">
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-2 text-amber-500 text-xl">
                    <span>⛅</span>
                    <span className="text-sm sm:text-base font-bold text-[#105B38]">Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"}, Counsel!</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
                    Let&apos;s find the winning precedent.
                  </h2>
                  <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] max-w-md mx-auto leading-relaxed">
                    Ask any legal question, cross-examine statutory provisions, or search 600,000+ reported Pakistani rulings.
                  </p>
                </div>

                {/* Prompt Starter Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      title: "Bail under Section 497(2) CrPC",
                      desc: "Statutory grounds and latest Supreme Court precedents for further inquiry.",
                      query: "What are the essential ingredients and latest Supreme Court precedents for grant of post-arrest bail under Section 497(2) CrPC (further inquiry)?",
                    },
                    {
                      title: "Article 199 Writ Maintainability",
                      desc: "High Court constitutional jurisdiction when alternate remedy exists.",
                      query: "When is a Constitutional Writ Petition under Article 199 maintainable notwithstanding the availability of an alternate statutory remedy? Cite landmark judgments.",
                    },
                    {
                      title: "Electronic Evidence Admissibility",
                      desc: "Article 164 Qanun-e-Shahadat Order 1984 forensic standards.",
                      query: "Explain the evidentiary requirements and forensic chain of custody for electronic and digital evidence under Article 164 of the Qanun-e-Shahadat Order, 1984.",
                    },
                    {
                      title: "Commercial Lease Eviction",
                      desc: "Bona fide personal need and default in rent under tenancy statutes.",
                      query: "Outline the statutory grounds for eviction of commercial tenants on the basis of bona fide personal need and default in rent payment with relevant case law.",
                    },
                  ].map((card, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSend(card.query)}
                      className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] hover:border-[#105B38]/40 hover:shadow-xs transition-all text-left space-y-1 group"
                    >
                      <div className="font-bold text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#105B38] transition-colors">
                        {card.title}
                      </div>
                      <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] leading-relaxed">
                        {card.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Render Conversation Messages */}
            {messages.map((msg, index) => {
              const isUser = msg.role === "user";
              const isBookmarked = bookmarks.some((b) => b.content === msg.content);
              const cleaned = !isUser ? cleanLegalChatResponse(msg.content) : null;
              const displayContent = cleaned ? cleaned.cleanContent : msg.content;
              const effectiveCaseLawCard = msg.caseLawCard || (cleaned?.references?.judgments && cleaned.references.judgments.length > 0 ? {
                hits: cleaned.references.judgments.map((j) => ({
                  citation: j.citation,
                  title: j.title || "",
                  court: j.court || "Supreme Court of Pakistan",
                  snippet: j.description || "",
                })),
                totalFound: cleaned.references.judgments.length,
                queriesUsed: [],
              } : undefined);
              const statutoryLaws = cleaned?.references?.laws || [];

              return (
                <div
                  key={msg.id || index}
                  className={cn(
                    "flex flex-col space-y-2 max-w-4xl mx-auto animate-in fade-in duration-200",
                    isUser ? "items-end" : "items-start"
                  )}
                >
                  {/* User Message */}
                  {isUser ? (
                    <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-xs bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] p-4 sm:p-5 shadow-xs space-y-2">
                      <div className="text-xs sm:text-sm font-normal leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>

                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {msg.attachments.map((att, attIdx) => (
                            <span
                              key={attIdx}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-mono bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] font-semibold"
                            >
                              <FileText className="w-3.5 h-3.5 text-[#105B38]" />
                              {att}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Assistant Message */
                    <div className="w-full space-y-3">
                      {/* Author Header */}
                      <div className="flex items-center justify-between gap-2 px-1">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-[#105B38]">
                            <Bot className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs sm:text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                            {msg.modelName || "Al Wakeelo"}
                          </span>
                          {msg.modeName && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20 uppercase">
                              {msg.modeName}
                            </span>
                          )}
                        </div>

                        {/* Message Actions */}
                        <div className="flex items-center gap-1 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(displayContent);
                              setCopiedMessageId(msg.id);
                              setTimeout(() => setCopiedMessageId(null), 2000);
                            }}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors",
                              copiedMessageId === msg.id ? "text-[#105B38] bg-emerald-50 dark:bg-emerald-500/10" : "hover:bg-[#F8FAFC] dark:bg-[#0B131E] hover:text-[#0F172A] dark:text-[#F8FAFC]"
                            )}
                            title="Copy Markdown Text"
                          >
                            {copiedMessageId === msg.id ? <Check className="w-4 h-4 text-[#105B38]" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => bookmarkMutation.mutate({ ...msg, content: displayContent })}
                            disabled={bookmarkMutation.isPending}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors",
                              isBookmarked
                                ? "text-[#105B38] hover:bg-[#F8FAFC] dark:bg-[#0B131E]"
                                : "hover:bg-[#F8FAFC] dark:bg-[#0B131E] hover:text-[#0F172A] dark:text-[#F8FAFC]"
                            )}
                            title="Bookmark Turn"
                          >
                            {isBookmarked ? (
                              <BookmarkCheck className="w-4 h-4 text-[#105B38]" />
                            ) : (
                              <Bookmark className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Authoritative Case Law Card */}
                      {effectiveCaseLawCard && (
                        <CaseLawCard
                          data={effectiveCaseLawCard}
                          onCitationClick={(cite) => {
                            setRightDrawerOpen(true);
                          }}
                        />
                      )}

                      {/* Statutory References Pill Strip */}
                      {statutoryLaws.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap px-1">
                          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] flex items-center gap-1 mr-1">
                            <Scale className="w-3 h-3 text-[#105B38]" />
                            Statutes Cited:
                          </span>
                          {statutoryLaws.map((law, lIdx) => (
                            <span
                              key={lIdx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20 font-medium"
                              title={law.description}
                            >
                              <BookOpen className="w-3 h-3" />
                              {law.name} {law.section ? `§ ${law.section}` : ""}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* AI Markdown Prose Body */}
                      <div className="p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] text-sm sm:text-base text-[#1A1A1A] dark:text-[#F8FAFC] leading-relaxed shadow-sm">
                        <LegalMarkdown content={displayContent} />

                        {/* RAG Knowledge Vault Citations strip */}
                        {msg.ragCitations && msg.ragCitations.length > 0 && (
                          <div className="mt-5 pt-3 border-t border-[#E5E4E2] dark:border-[#1E2D44] space-y-2">
                            <div className="text-xs font-mono font-semibold uppercase tracking-wider text-[#1A1A1A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5" />
                              Knowledge Vault Grounding Sources ({msg.ragCitations.length})
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {msg.ragCitations.map((c, cIdx) => (
                                <div
                                  key={cIdx}
                                  className="p-3 rounded-lg bg-[#FFFFFF] dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] text-xs space-y-1"
                                >
                                  <div className="font-semibold text-[#1A1A1A] dark:text-[#F8FAFC] truncate">
                                    {c.title}
                                  </div>
                                  <p className="text-xs text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] line-clamp-2 italic">
                                    &ldquo;{c.quote}&rdquo;
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Active Tool Latency & Searching Status Bar */}
            {toolSearchStatus.active && (
              <div className="max-w-4xl mx-auto p-3 rounded-xl bg-[#1A1A1A]/5 dark:bg-[#1A1A1A]/50 border border-[#1A1A1A]/20 dark:border-[#1E2D44] text-[#1A1A1A] dark:text-[#F8FAFC] flex items-center justify-between text-xs animate-pulse">
                <div className="flex items-center gap-2 font-mono">
                  <Loader2 className="w-4 h-4 animate-spin text-[#1A1A1A] dark:text-[#F8FAFC]" />
                  <span>Searching Pakistani Judicial Precedents Database...</span>
                </div>
                <span className="font-mono text-[11px] text-[#1A1A1A] dark:text-[#F8FAFC] font-bold">
                  {elapsedMs}ms elapsed
                </span>
              </div>
            )}

            {/* Deep Reasoning / Thinking Indicator */}
            {isThinking && (
              <div className="max-w-4xl mx-auto p-3.5 rounded-xl bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] text-[#1A1A1A] dark:text-[#F8FAFC] flex items-center justify-between text-xs animate-pulse">
                <div className="flex items-center gap-2.5">
                  <Brain className="w-4 h-4 text-[#1A1A1A] dark:text-[#F8FAFC] animate-spin" />
                  <div>
                    <span className="font-semibold text-[#1A1A1A] dark:text-[#F8FAFC]">
                      Formulating Legal Reasoning & Statutory Cross-References...
                    </span>
                    <p className="text-[10px] text-[#999999] dark:text-[#475569] font-mono">
                      Chambers High-Dimensional Procedural Engine
                    </p>
                  </div>
                </div>
                <span className="font-mono text-xs text-[#1A1A1A] dark:text-[#F8FAFC]">{elapsedMs}ms</span>
              </div>
            )}

            {/* API Error Box */}
            {apiError && (
              <div className="max-w-4xl mx-auto p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-2.5 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">Query Interrupted</div>
                  <div className="text-[11px] text-rose-400/90 mt-0.5">{apiError}</div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Multi-Modal Composer ── */}
          <ChatComposer
            input={inputPrompt}
            onInputChange={setInputPrompt}
            onSend={() => handleSend()}
            onStop={handleStop}
            isLoading={isLoading}
            attachedFiles={attachedFiles}
            onAddFiles={(newFiles) => setAttachedFiles((prev) => [...prev, ...newFiles].slice(0, 5))}
            onRemoveFile={(idx) => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
            ragEnabled={ragEnabled}
            onToggleRag={() => setRagEnabled((prev) => !prev)}
            selectedCaseFileId={selectedCaseFileId}
            onSelectCaseFile={setSelectedCaseFileId}
            caseFiles={caseFiles}
            isVoiceRecording={voice.isRecording}
            isVoiceTranscribing={voice.isTranscribing}
            voiceDuration={voice.duration}
            onStartVoiceRecording={voice.startRecording}
            onStopVoiceRecording={voice.stopAndTranscribe}
            onCancelVoiceRecording={voice.cancelRecording}
          />
        </div>

        {/* ── Slide-Over Overlay: Legal Intelligence & Citation Inspector ── */}
        {rightDrawerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
              onClick={() => setRightDrawerOpen(false)}
            />
            <div className="relative z-50 h-full max-h-screen max-w-full flex">
              <ChatInspectorDrawer
                isOpen={rightDrawerOpen}
                onToggleOpen={() => setRightDrawerOpen(false)}
                citations={inspectorData.citations}
                statutes={inspectorData.statutes}
                bookmarks={bookmarks}
                activeModelName={modelTier === "apex" ? "Apex Tier" : modelTier === "turbo" ? "Turbo Intelligence" : "Standard Intelligence"}
                activeQueryLatencyMs={elapsedMs}
              />
            </div>
          </div>
        )}
      </div>
    </PreviewShell>
  );
};

export default PreviewChat;
