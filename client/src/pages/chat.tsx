import { useState, useRef, useEffect, useCallback } from "react";
import { Scale, Send, Trash2, Bookmark, BookmarkCheck, Loader2, AlertCircle, Share2, Check, Copy, Zap, Lock, Crown, ArrowUpRight, X, Paperclip, Mic, FileText, File, Sparkles, ChevronDown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: string[];
  modelName?: string;
  modelId?: string;
  modelDescription?: string;
}

type AiMode = "standard" | "turbo" | string;

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
        setMessages([...updated, { id: assistantId, role: "assistant", content: data.content, modelName: modelLabel, modelId, modelDescription }]);
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
                    setMessages(prev => {
                      const last = prev[prev.length - 1];
                      if (last && last.id === assistantId) {
                        return [...prev.slice(0, -1), { ...last, modelName: modelLabel, modelId, modelDescription }];
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

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-[#1e293b] border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl relative fade-in">
      <div className="p-5 bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
            <Scale size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white capitalize">{title || type.replace("-", " ")} Session</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${apiError ? "bg-red-500" : "bg-emerald-500"}`} />
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
                {apiError ? "Engine Throttled" : "Counsel Engine Active"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {shareError && (
            <span className="text-[9px] text-red-400 font-bold">{shareError}</span>
          )}
          {messages.length >= 2 && (
            <button
              onClick={shareUrl ? handleCopyShareUrl : handleShare}
              disabled={isSharing}
              data-testid="button-share-chat"
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                shareUrl
                  ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  : "hover:bg-amber-500/10 text-slate-500 hover:text-amber-400"
              }`}
            >
              {isSharing ? (
                <><Loader2 size={14} className="animate-spin" /> Sharing...</>
              ) : copied ? (
                <><Check size={14} /> Link Copied</>
              ) : shareUrl ? (
                <><Copy size={14} /> Copy Link</>
              ) : (
                <><Share2 size={14} /> Share</>
              )}
            </button>
          )}
          <button
            onClick={handleClear}
            data-testid="button-clear-chat"
            className="px-4 py-2 hover:bg-red-500/10 rounded-xl text-slate-500 hover:text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all"
          >
            <Trash2 size={14} /> Reset
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 p-6 md:p-10 overflow-y-auto space-y-6 scrollbar-hide">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <Scale size={48} className="text-slate-700" />
            <p className="text-slate-600 italic text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>
              "Main hoon Al Wakeelo -- not just your lawyer, your strategy partner in justice."
            </p>
            <p className="text-[9px] text-slate-700 uppercase tracking-widest font-black">Type your query or attach documents below</p>
          </div>
        )}

        {messages.map((m) => {
          const parsed = m.role === "assistant" ? parseReferences(m.content) : null;
          const displayContent = parsed ? parsed.cleanContent : m.content;
          return (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} slide-in-from-bottom-4`}>
              <div
                className={`max-w-[85%] p-6 md:p-8 rounded-[2rem] shadow-xl relative group ${
                  m.role === "user"
                    ? "bg-amber-500 text-slate-950 font-bold rounded-tr-lg"
                    : "bg-[#0f172a] border border-slate-700 text-slate-200 rounded-tl-lg"
                }`}
              >
                {m.role === "assistant" ? (
                  <>
                    {m.modelName && (
                      <div className="flex items-center gap-1.5 mb-3 pb-2 border-b border-slate-700/30">
                        <div className="flex flex-col">
                          <span className={`text-[9px] font-black uppercase tracking-widest ${
                            m.modelName === "Turbo" ? "text-purple-400" :
                            m.modelName === "Standard" ? "text-slate-500" :
                            "text-emerald-400"
                          }`}>
                            {m.modelName === "Turbo" && <Zap size={9} className="inline mr-1" />}
                            {m.modelName !== "Turbo" && m.modelName !== "Standard" && <Sparkles size={9} className="inline mr-1" />}
                            {m.modelName}
                          </span>
                          {m.modelDescription && (
                            <span className="text-[10px] text-slate-500 mt-0.5">
                              {m.modelDescription}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    <LegalMarkdown content={displayContent} />
                    {parsed?.references && <ReferenceCards references={parsed.references} />}
                  </>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content.replace(/\[Attached:.*?\]/, "").trim()}</p>
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
                      onClick={() => !bookmarkedIds.has(m.id) && bookmarkMutation.mutate(m)}
                      className={`p-2 rounded-xl border transition-colors ${
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

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800 flex items-center gap-3">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "75ms" }} />
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-2">Reasoning Protocol...</span>
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
              {usage.remaining} queries remaining this month
            </span>
          </div>
          <a href="/settings" className="flex items-center gap-1 text-[10px] font-black text-amber-500 uppercase tracking-widest hover:text-amber-400 transition-colors" data-testid="link-upgrade-warning">
            Upgrade <ArrowUpRight size={10} />
          </a>
        </div>
      )}

      {usage && usage.percentage >= 100 && (
        <div className="px-6 py-3 bg-red-500/10 border-t border-red-500/20 flex items-center justify-between gap-3" data-testid="banner-usage-limit">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-red-500" />
            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">
              Monthly limit reached ({usage.used}/{usage.monthlyLimit} queries)
            </span>
          </div>
          <a href="/settings" className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-slate-950 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-colors" data-testid="link-upgrade-limit">
            Upgrade Now <ArrowUpRight size={10} />
          </a>
        </div>
      )}

      <div className="p-4 md:p-6 bg-[#0f172a]/50 border-t border-slate-800">
        <div className="flex items-center gap-2 mb-2 px-2 flex-wrap">
          <div className="relative">
            <button
              onClick={() => setShowModelMenu(!showModelMenu)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                aiMode === "turbo"
                  ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                  : isApexMode
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "text-slate-400 border-slate-700 hover:border-slate-600 hover:text-slate-300"
              }`}
              data-testid="button-model-selector"
            >
              {aiMode === "turbo" ? (
                <Zap size={12} className="text-purple-400" />
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
                    className={`w-full text-left px-4 py-3 text-xs hover:bg-slate-800 transition-colors border-b border-slate-700/50 ${aiMode === "turbo" ? "bg-purple-500/10 text-purple-400" : "text-slate-400"}`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <Zap size={11} className="text-purple-500" />
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

        <div className="flex gap-2 bg-[#1e293b] border border-slate-700 p-2 rounded-[2rem] shadow-2xl items-center">
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
            className="p-3 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title="Attach document (TXT, PDF, DOCX)"
          >
            <Paperclip size={18} />
          </button>

          <button
            onClick={() => audioInputRef.current?.click()}
            disabled={isLoading || isTranscribing}
            className={`p-3 rounded-xl transition-all ${
              isTranscribing
                ? "text-amber-500 bg-amber-500/10"
                : "text-slate-500 hover:text-amber-400 hover:bg-amber-500/10"
            } disabled:opacity-30 disabled:cursor-not-allowed`}
            title="Transcribe audio file (MP3, WAV, M4A)"
          >
            <Mic size={18} />
          </button>

          <input
            className="flex-1 bg-transparent border-none px-3 py-3 text-sm text-white focus:ring-0 focus:outline-none placeholder:text-slate-600"
            placeholder="Consult Al Wakeelo..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            data-testid="input-chat"
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || isTranscribing}
            data-testid="button-send"
            className="p-4 bg-amber-500 text-slate-950 rounded-xl hover:bg-amber-400 shadow-xl shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
