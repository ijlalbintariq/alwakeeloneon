import { useState, useRef, useEffect, useCallback } from "react";
import { Scale, Send, Trash2, Bookmark, BookmarkCheck, Loader2, AlertCircle, Share2, Check, Copy, Zap, Lock, Crown, ArrowUpRight, X, Paperclip, Mic, FileText, File, Sparkles, ChevronDown, FolderOpen, Folder, PlusCircle, MoreVertical, Settings, User as UserIcon } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LegalMarkdown } from "@/components/legal-markdown";
import { parseReferences, ReferenceCards } from "@/components/reference-cards";
import { useAuth } from "@/hooks/use-auth";

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
  attachments?: string[];
  modeName?: string;
  modelName?: string;
  modelId?: string;
  modelDescription?: string;
}

type AiMode = "standard" | "turbo" | string;

interface ThreadSummary {
  id: number;
  title: string;
  createdAt?: string;
}

const chatStateStore: Record<string, { messages: ChatMessage[]; shareUrl: string | null; sharedThreadId: number | null }> = {};

export default function ChatPage() {
  return <ChatModule type="al-wakeelo" title="Al Wakeelo Engine" />;
}

interface UsageData {
  tier: string;
  used: number;
  remaining: number;
  percentage: number;
  monthlyLimit: number;
}

export function ChatModule({ type, title, initialMessage }: { type: string; title?: string; initialMessage?: string }) {
  const { user } = useAuth();
  const stored = chatStateStore[type];
  const [messages, setMessages] = useState<ChatMessage[]>(stored?.messages || []);
  const [input, setInput] = useState(initialMessage || "");
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<AiMode>("standard");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(stored?.shareUrl || null);
  const [sharedThreadId, setSharedThreadId] = useState<number | null>(stored?.sharedThreadId || null);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const { data: usage } = useQuery<UsageData>({ queryKey: ["/api/usage"] });
  const { data: threads = [] } = useQuery<ThreadSummary[]>({ queryKey: ["/api/threads"] });
  const canUseTurbo = usage?.tier === "pro" || usage?.tier === "enterprise";
  const isApexMode = aiMode !== "standard" && aiMode !== "turbo";
  const selectedApexModel = isApexMode ? aiMode : null;
  const turboMode = aiMode === "turbo";

  const { data: apexData } = useQuery<ApexModelsData>({
    queryKey: ["/api/apex/models"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/apex/models");
      return res.json();
    },
  });

  const getModelDisplayName = useCallback((modelId: string): string => {
    const modelNames: Record<string, string> = {
      "standard": "Standard",
      "turbo": "Turbo",
      "deepseek-chat": "Turbo",
      "deepseek-reasoner": "DeepSeek Pro",
    };
    if (modelNames[modelId]) return modelNames[modelId];
    if (modelId.includes("deepseek")) return "DeepSeek";
    const apexModel = apexData?.models.find(m => m.id === modelId);
    if (apexModel) return apexModel.name;
    if (modelId.includes("apex")) return "Apex";
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
      return "Premium Kimi reasoning for highly complex legal strategy.";
    }
    if (id.includes("apex-agent")) {
      return "Agentic Kimi workflow for multi-step legal tasks.";
    }
    if (id.includes("apex")) {
      return "Kimi-based legal assistant focused on high-quality responses.";
    }
    if (id.includes("groq") || id.includes("standard")) {
      return "Default legal chat mode with reliable fast responses.";
    }
    const apexModel = apexData?.models.find((m) => m.id === modelIdOrName);
    if (apexModel?.description) return apexModel.description;
    return "AI legal assistant response.";
  }, [apexData]);

  const currentModeName = useCallback((): { name: string; color: string; icon: "zap" | "sparkles" | "standard" } => {
    if (aiMode === "standard") return { name: "Standard", color: "text-slate-400", icon: "standard" };
    if (aiMode === "turbo") return { name: "Turbo", color: "text-purple-400", icon: "zap" };
    const apexModel = apexData?.models.find(m => m.id === aiMode);
    return { name: apexModel?.name || "Apex", color: "text-emerald-400", icon: "sparkles" };
  }, [aiMode, apexData]);

  useEffect(() => {
    chatStateStore[type] = { messages, shareUrl, sharedThreadId };
  }, [messages, shareUrl, sharedThreadId, type]);

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

  const handleSend = async (overrideInput?: string) => {
    const text = overrideInput || input;
    if ((!text.trim() && attachedFiles.length === 0) || isLoading) return;
    setApiError(null);

    const fileNames = attachedFiles.map(f => f.name);
    const displayText = fileNames.length > 0
      ? `${text}${text ? "\n" : ""}[Attached: ${fileNames.join(", ")}]`
      : text;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: displayText, attachments: fileNames.length > 0 ? fileNames : undefined };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setIsLoading(true);

    const currentFiles = [...attachedFiles];
    setAttachedFiles([]);

    const assistantId = (Date.now() + 1).toString();

    try {
      let response: Response;

      if (selectedApexModel && apexData?.available) {
        response = await fetch("/api/apex/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            model: selectedApexModel,
            message: text,
          }),
        });
      } else if (currentFiles.length > 0) {
        const formData = new FormData();
        formData.append("messages", JSON.stringify(updated.map((m) => ({ role: m.role, content: m.content }))));
        formData.append("type", type);
        formData.append("turbo", String(turboMode && canUseTurbo));
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
            turbo: turboMode && canUseTurbo,
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
      if (contentType.includes("application/json")) {
        const data = await response.json();
        const modelId = data.model || (isApexMode ? aiMode : aiMode);
        const modelLabel = modelId ? getModelDisplayName(modelId) : undefined;
        const modelDescription = modelId ? getModelFunctionDescription(modelId) : undefined;
        const modeLabel = isApexMode ? "Apex" : (turboMode && canUseTurbo ? "Turbo" : "Standard");
        setMessages([...updated, {
          id: assistantId,
          role: "assistant",
          content: data.content,
          modeName: canUseTurbo ? modeLabel : undefined,
          modelName: modelLabel,
          modelId,
          modelDescription,
        }]);
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
                    const modeLabel = isApexMode ? "Apex" : (turboMode && canUseTurbo ? "Turbo" : "Standard");
                    setMessages(prev => {
                      const last = prev[prev.length - 1];
                      if (last && last.id === assistantId) {
                        return [...prev.slice(0, -1), {
                          ...last,
                          modeName: canUseTurbo ? modeLabel : undefined,
                          modelName: modelLabel,
                          modelId,
                          modelDescription,
                        }];
                      }
                      return prev;
                    });
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
      }

      await apiRequest("POST", "/api/search-history", { type: "chat", query: text.substring(0, 80) }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
    } catch (err: any) {
      const isLimitError = err?.isLimit || err?.message?.includes("429");
      const limitMsg = isLimitError
        ? "Monthly query limit reached. Upgrade your plan to continue using Al Wakeelo."
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
      setApiError(isLimitError ? "Query limit reached" : (err?.message || "Communication disruption."));
      if (isLimitError) {
        queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setApiError(null);
    setShareUrl(null);
    setSharedThreadId(null);
    setShareError(null);
    setAttachedFiles([]);
    delete chatStateStore[type];
  };

  const handleLoadThread = async (threadId: number) => {
    try {
      const res = await apiRequest("GET", `/api/threads/${threadId}`);
      const data = await res.json();
      if (!data?.messages) return;
      const restored: ChatMessage[] = data.messages.map((m: any, idx: number) => ({
        id: String(m.id ?? `${threadId}-${idx}`),
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content || "",
      }));
      setMessages(restored);
      setSharedThreadId(threadId);
      setShareUrl(null);
      setShareError(null);
    } catch (err) {
      console.error("Failed to load thread:", err);
      setApiError("Failed to load consultation");
    }
  };

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
      } catch {}
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
    } catch {}
  };

  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return <FileText size={12} className="text-red-400" />;
    if (ext === "txt") return <FileText size={12} className="text-blue-400" />;
    return <File size={12} className="text-slate-400" />;
  };

  const latestAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const latestParsed = latestAssistantMessage ? parseReferences(latestAssistantMessage.content) : null;
  const latestRefs = latestParsed?.references ?? null;

  return (
    <div className="h-[calc(100vh-120px)] rounded-[1.8rem] overflow-hidden border border-[hsl(var(--preview-border))] bg-[#0a0907] fade-in">
      <div className="flex h-full w-full">
        <aside className="w-72 shrink-0 border-r border-amber-500/15 bg-[#1a1610]/70 backdrop-blur-md flex flex-col">
          <div className="p-5 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-amber-500/20 p-2 rounded-lg">
                <Scale size={26} className="text-amber-400" />
              </div>
              <div>
                <h1 className="font-serif text-xl font-bold text-amber-400 leading-none">Al Wakeelo</h1>
                <p className="text-[10px] uppercase tracking-widest text-amber-500/60 font-semibold mt-1">Premium Legal AI</p>
              </div>
            </div>

            <button
              onClick={handleClear}
              className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-[#120e09] w-full py-3 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/15 mb-6"
              data-testid="button-new-consultation"
            >
              <PlusCircle size={18} />
              <span>New Consultation</span>
            </button>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-hide">
              <h3 className="text-[11px] font-bold text-amber-500/40 uppercase tracking-widest mb-3 px-2">Recent Consultations</h3>
              {threads.slice(0, 12).map((thread, idx) => {
                const isActive = sharedThreadId === thread.id || (idx === 0 && !sharedThreadId);
                return (
                  <button
                    key={thread.id}
                    onClick={() => handleLoadThread(thread.id)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg border transition-colors ${
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

            <div className="mt-4 pt-4 border-t border-amber-500/10">
              <div className="flex items-center gap-3 px-2">
                <div className="h-10 w-10 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center overflow-hidden">
                  {user?.profileImageUrl ? (
                    <img src={user.profileImageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon size={16} className="text-amber-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-200 truncate">{user?.firstName || user?.email || "Advocate"}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.isAdmin ? "Admin Counsel" : "Legal Member"}</p>
                </div>
                <a href="/settings" className="text-slate-500 hover:text-white" data-testid="button-open-settings">
                  <Settings size={16} />
                </a>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col bg-[#0f0c08]/65">
          <header className="h-16 px-6 border-b border-amber-500/10 flex items-center justify-between bg-[#16120d]/75 backdrop-blur-md">
            <div className="flex items-center gap-4 min-w-0">
              <h2 className="font-serif text-lg text-slate-100 truncate">{title || "Al Wakeelo Engine"}</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">ACTIVE</span>
            </div>
            <div className="flex items-center gap-2">
              {messages.length >= 2 && (
                <button
                  onClick={shareUrl ? handleCopyShareUrl : handleShare}
                  disabled={isSharing}
                  data-testid="button-share-chat"
                  className="p-2 text-slate-400 hover:text-amber-400 transition-colors"
                  title={shareUrl ? "Copy Share Link" : "Share Consultation"}
                >
                  {isSharing ? <Loader2 size={16} className="animate-spin" /> : copied ? <Check size={16} /> : <Share2 size={16} />}
                </button>
              )}
              <button className="p-2 text-slate-400 hover:text-amber-400 transition-colors" onClick={handleClear} data-testid="button-reset-chat">
                <MoreVertical size={16} />
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 scrollbar-hide">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                <Scale size={44} className="text-amber-500/50" />
                <p className="text-slate-400 italic text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>
                  "Main hoon Al Wakeelo -- not just your lawyer, your strategy partner in justice."
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Ask anything about Pakistan law</p>
              </div>
            )}

            {messages.map((m) => {
              const parsed = m.role === "assistant" ? parseReferences(m.content) : null;
              const displayContent = parsed ? parsed.cleanContent : m.content;
              return (
                <div key={m.id} className={`flex items-start gap-4 w-full max-w-[min(100%,72rem)] ${m.role === "user" ? "ml-auto flex-row-reverse" : ""}`}>
                  <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${m.role === "assistant" ? "bg-amber-500 text-[#120e09]" : "bg-[#1a1610] border border-amber-500/30 text-amber-400"}`}>
                    {m.role === "assistant" ? <Scale size={18} /> : <UserIcon size={16} />}
                  </div>
                  <div className={`flex flex-col gap-2 ${m.role === "user" ? "items-end" : ""}`}>
                    <p className={`text-[11px] font-bold uppercase tracking-widest ${m.role === "assistant" ? "text-amber-400" : "text-slate-500"}`}>
                      {m.role === "assistant" ? "Al Wakeelo Assistant" : "You"}
                    </p>
                    <div className={`p-5 rounded-2xl relative group ${m.role === "assistant" ? "bg-amber-500/5 backdrop-blur border border-amber-500/20 rounded-tl-none" : "bg-[#1a1610]/90 border border-amber-500 rounded-tr-none"}`}>
                      {m.role === "assistant" ? (
                        <>
                          {(m.modeName || m.modelName) && (
                            <div className="mb-3 pb-2 border-b border-amber-500/15">
                              <div className="text-[10px] text-slate-400">
                                {m.modeName && <span className="mr-2 uppercase tracking-wider text-amber-400">{m.modeName}</span>}
                                {m.modelName && <span className="uppercase tracking-wider text-emerald-300">{m.modelName}</span>}
                                {m.modelDescription && <span className="block mt-1 text-slate-500">{m.modelDescription}</span>}
                              </div>
                            </div>
                          )}
                          <LegalMarkdown content={displayContent} />
                          {parsed?.references && <ReferenceCards references={parsed.references} />}
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
                          onClick={() => !bookmarkedIds.has(m.id) && bookmarkMutation.mutate(m)}
                          className={`absolute top-3 right-3 p-1.5 rounded-lg border transition-opacity ${bookmarkedIds.has(m.id) ? "opacity-100 border-amber-500/50 text-amber-400 bg-amber-500/10" : "opacity-0 group-hover:opacity-100 border-amber-500/20 text-slate-400 hover:text-amber-400"}`}
                          data-testid="button-bookmark"
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
              <div className="flex items-center gap-3 w-full max-w-[min(100%,72rem)]">
                <div className="h-10 w-10 rounded-full bg-amber-500 text-[#120e09] flex items-center justify-center"><Scale size={18} /></div>
                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "75ms" }} />
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-2">Reasoning...</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 pt-2 border-t border-amber-500/10">
            {apiError && (
              <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                <AlertCircle size={14} className="text-red-400" />
                <span className="text-[10px] text-red-300 font-bold uppercase tracking-widest">{apiError}</span>
              </div>
            )}

            <div className="w-full max-w-[min(100%,72rem)] mx-auto bg-[#1a1610]/80 border border-amber-500/20 rounded-2xl shadow-2xl p-2">
              <div className="flex items-center gap-2 p-2">
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple className="hidden" />
                <input type="file" ref={audioInputRef} onChange={handleAudioSelect} accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg" className="hidden" />

                <button onClick={() => fileInputRef.current?.click()} disabled={isLoading || attachedFiles.length >= 5} className="p-2 text-slate-500 hover:text-amber-400">
                  <Paperclip size={18} />
                </button>
                <button onClick={() => audioInputRef.current?.click()} disabled={isLoading || isTranscribing} className="p-2 text-slate-500 hover:text-amber-400">
                  {isTranscribing ? <Loader2 size={18} className="animate-spin text-amber-400" /> : <Mic size={18} />}
                </button>

                <input
                  className="flex-1 bg-transparent border-none focus:ring-0 text-slate-100 placeholder:text-slate-500 px-2"
                  placeholder="Ask Al Wakeelo about Pakistan Law..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  data-testid="input-chat"
                />

                <div className="relative border-l border-amber-500/10 pl-3 ml-1">
                  <button
                    onClick={() => setShowModelMenu(!showModelMenu)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                      aiMode === "turbo" ? "text-purple-300 border-purple-500/40 bg-purple-500/10" :
                      isApexMode ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" :
                      "text-slate-300 border-amber-500/20"
                    }`}
                    data-testid="button-model-selector"
                  >
                    {isApexMode ? <Sparkles size={11} /> : aiMode === "turbo" ? <Zap size={11} /> : <Scale size={11} />}
                    {currentModeName().name}
                    <ChevronDown size={10} />
                  </button>
                  {showModelMenu && (
                    <div className="model-menu-dropdown absolute bottom-full right-0 mb-2 bg-[#1a1610] border border-amber-500/20 rounded-xl shadow-2xl overflow-hidden min-w-[280px] z-50">
                      <div className="px-4 py-2 text-[9px] text-slate-400 uppercase tracking-widest font-black border-b border-amber-500/15">Select AI Model</div>
                      <button onClick={() => { setAiMode("standard"); setShowModelMenu(false); }} className={`w-full text-left px-4 py-3 text-xs hover:bg-white/5 border-b border-amber-500/10 ${aiMode === "standard" ? "bg-amber-500/10 text-amber-300" : "text-slate-300"}`}>
                        <div className="font-bold">Standard</div><div className="text-[10px] text-slate-500 mt-0.5">Fast, reliable responses</div>
                      </button>
                      {canUseTurbo && (
                        <button onClick={() => { setAiMode("turbo"); setShowModelMenu(false); }} className={`w-full text-left px-4 py-3 text-xs hover:bg-white/5 border-b border-amber-500/10 ${aiMode === "turbo" ? "bg-purple-500/10 text-purple-300" : "text-slate-300"}`}>
                          <div className="font-bold">Turbo</div><div className="text-[10px] text-slate-500 mt-0.5">Deep reasoning & analysis</div>
                        </button>
                      )}
                      {canUseTurbo && apexData?.available && apexData.models.length > 0 && (
                        <>
                          <div className="px-4 py-1.5 text-[9px] text-emerald-300 uppercase tracking-widest font-black border-b border-amber-500/10 bg-emerald-500/10">Apex Models</div>
                          {apexData.models.map(model => (
                            <button key={model.id} onClick={() => { setAiMode(model.id); setShowModelMenu(false); }} className={`w-full text-left px-4 py-3 text-xs hover:bg-white/5 border-b border-amber-500/10 last:border-0 ${aiMode === model.id ? "bg-emerald-500/12 text-emerald-300" : "text-slate-300"}`}>
                              <div className="font-bold">{model.name}</div><div className="text-[10px] text-slate-500 mt-0.5">{model.description}</div>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <button onClick={() => handleSend()} disabled={isLoading || isTranscribing} data-testid="button-send" className="bg-amber-500 hover:bg-amber-400 text-[#120e09] h-10 w-10 rounded-xl flex items-center justify-center transition-all">
                  <Send size={16} />
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
            </div>

            {usage && usage.percentage >= 80 && (
              <div className={`w-full max-w-[min(100%,72rem)] mx-auto mt-3 px-3 py-2 rounded-lg border flex items-center justify-between gap-3 ${usage.percentage >= 100 ? "bg-red-500/10 border-red-500/20" : "bg-amber-500/10 border-amber-500/20"}`}>
                <div className="flex items-center gap-2">
                  {usage.percentage >= 100 ? <Lock size={13} className="text-red-400" /> : <Crown size={13} className="text-amber-400" />}
                  <span className={`text-[10px] font-black uppercase tracking-wider ${usage.percentage >= 100 ? "text-red-300" : "text-amber-300"}`}>
                    {usage.percentage >= 100 ? `Limit reached (${usage.used}/${usage.monthlyLimit})` : `${usage.remaining} queries remaining`}
                  </span>
                </div>
                <a href="/settings" className="text-[10px] font-black uppercase tracking-wider text-amber-400 hover:text-amber-300 inline-flex items-center gap-1" data-testid="link-upgrade-warning">
                  Upgrade <ArrowUpRight size={10} />
                </a>
              </div>
            )}
          </div>
        </main>

        <aside className="w-80 shrink-0 border-l border-amber-500/15 bg-[#16120d]/70 backdrop-blur-md hidden xl:flex flex-col">
          <div className="p-5 overflow-y-auto h-full space-y-8 scrollbar-hide">
            <div>
              <h3 className="flex items-center gap-2 text-[11px] font-bold text-amber-400 uppercase tracking-widest mb-4">
                <FileText size={13} /> Legal Citations
              </h3>
              <div className="space-y-3">
                {(latestRefs?.judgments?.length || 0) > 0 && latestRefs?.judgments.slice(0, 4).map((j, idx) => (
                  <div key={`${j.citation}-${idx}`} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-amber-500/30 transition-all">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded truncate">{j.citation}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-200 mb-1">{j.court || "Pakistani Courts"}</p>
                    {j.description && <p className="text-[10px] text-slate-500 leading-relaxed italic line-clamp-3">{j.description}</p>}
                  </div>
                ))}
                {(latestRefs?.laws?.length || 0) > 0 && latestRefs?.laws.slice(0, 4).map((l, idx) => (
                  <div key={`${l.name}-${idx}`} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-amber-500/30 transition-all">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded truncate">{l.section || "Section"}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-200 mb-1">{l.name || "Pakistani Statute"}</p>
                    {l.description && <p className="text-[10px] text-slate-500 leading-relaxed italic line-clamp-3">{l.description}</p>}
                  </div>
                ))}
                {!latestRefs && (
                  <p className="text-xs text-slate-500">Citations from Al Wakeelo responses will appear here.</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="flex items-center gap-2 text-[11px] font-bold text-amber-400 uppercase tracking-widest mb-4">
                <Scale size={13} /> Relevant Statutes
              </h3>
              <div className="space-y-2">
                {(latestRefs?.laws?.length || 0) > 0 ? (
                  latestRefs!.laws.slice(0, 8).map((law, idx) => (
                    <div key={`${law.name}-${idx}`} className="flex items-start gap-3 p-2 group cursor-default">
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
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">Relevant statutes will appear here when Al Wakeelo cites them in responses.</p>
                )}
              </div>
            </div>

            <div className="mt-auto p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <p className="text-[10px] font-bold text-amber-400 uppercase mb-2">AI Confidence</p>
              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                <div className="bg-amber-400 h-full w-[94%]" />
              </div>
              <p className="text-[10px] text-slate-500 mt-2">Based on Pakistan Statutes & Case Law knowledge base.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
