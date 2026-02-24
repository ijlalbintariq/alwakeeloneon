import { useRef, useEffect, useState } from "react";
import { Scale, Send, Trash2, Bookmark, Loader2, AlertCircle, Share2, Check, Copy, Zap, Lock, Crown, ArrowUpRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LegalMarkdown } from "@/components/legal-markdown";
import { parseReferences, ReferenceCards } from "@/components/reference-cards";
import { useChatSession } from "@/hooks/use-chat-session";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

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
  const { messages, input, setInput, isLoading, apiError, turboMode, setTurboMode, send, clear, canUseTurbo } = useChatSession();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: usage } = useQuery<UsageData>({ queryKey: ["/api/usage"] });
  // canUseTurbo provided by global session; usage is used for banners

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (initialMessage) {
      send(initialMessage, { type });
    }
  }, [initialMessage, send, type]);

  const bookmarkMutation = useMutation({
    mutationFn: async (msg: ChatMessage) => {
      await apiRequest("POST", "/api/bookmarks", {
        title: msg.content.substring(0, 50),
        content: msg.content,
        type: type === "al-wakeelo" ? "al-wakeelo" : type === "contract-drafting" ? "contract" : "draft",
        category: title || type,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
    },
  });

  const handleSend = async (overrideInput?: string) => {
    const text = overrideInput || input;
    if (!text.trim() || isLoading) return;
    await apiRequest("POST", "/api/search-history", { type: "chat", query: text.substring(0, 80) }).catch(() => {});
    await send(text, { type });
    queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
  };

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharedThreadId, setSharedThreadId] = useState<number | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const handleClear = () => {
    clear();
    setShareUrl(null);
    setSharedThreadId(null);
    setShareError(null);
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
        const threadRes = await apiRequest("POST", "/api/threads", {
          title: firstUserMsg.content.substring(0, 80) || "Al Wakeelo Conversation",
          firstMessage: firstUserMsg.content,
        });
        const thread = await threadRes.json();
        threadId = thread.id;
        setSharedThreadId(threadId);

        for (let i = 0; i < messages.length; i++) {
          const m = messages[i];
          if (i === 0 && m.role === "user") continue;
          if (i === 1 && m.role === "assistant") continue;
          try {
            await apiRequest("POST", `/api/threads/${threadId}/messages`, { message: m.content });
          } catch {
            // continue best-effort
          }
        }
      }

      const shareRes = await apiRequest("POST", `/api/threads/${threadId}/share`);
      const shareData = await shareRes.json();
      const fullUrl = `${window.location.origin}${shareData.shareUrl}`;
      setShareUrl(fullUrl);
      try {
        await navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch {
        // clipboard may fail in some contexts
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
    } catch {
      // fallback - select text
    }
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
            <p className="text-[9px] text-slate-700 uppercase tracking-widest font-black">Type your query below to begin</p>
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
                    <LegalMarkdown content={displayContent} />
                    {parsed?.references && <ReferenceCards references={parsed.references} />}
                  </>
                ) : (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                )}
                {m.role === "assistant" && (
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => bookmarkMutation.mutate(m)}
                      className="p-2 rounded-xl border border-slate-700 text-slate-400 hover:text-amber-500 transition-colors"
                      data-testid="button-bookmark"
                      title="Save to Bookmarks"
                    >
                      <Bookmark size={14} />
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
        <div className="flex items-center gap-2 mb-2 px-2">
          <button
            onClick={() => canUseTurbo && setTurboMode(!turboMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              turboMode && canUseTurbo
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                : canUseTurbo
                  ? "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                  : "text-slate-600 cursor-not-allowed"
            }`}
            data-testid="button-turbo-toggle"
            title={canUseTurbo ? (turboMode ? "Turbo Mode: ON (Pro Model)" : "Turbo Mode: OFF (Standard Model)") : "Upgrade to Pro to unlock Turbo"}
          >
            {canUseTurbo ? (
              <Zap size={12} className={turboMode ? "text-purple-400" : ""} />
            ) : (
              <Lock size={10} />
            )}
            {turboMode && canUseTurbo ? "Turbo" : "Standard"}
          </button>
          {!canUseTurbo && (
            <span className="text-[9px] text-slate-600 tracking-wide" data-testid="text-turbo-locked">
              Upgrade to Pro for Turbo mode
            </span>
          )}
          {turboMode && canUseTurbo && (
            <span className="text-[9px] text-purple-400/70 tracking-wide" data-testid="text-turbo-active">
              Using advanced AI model for deeper analysis
            </span>
          )}
        </div>
        <div className="flex gap-3 bg-[#1e293b] border border-slate-700 p-2 rounded-[2rem] shadow-2xl">
          <input
            className="flex-1 bg-transparent border-none px-4 py-3 text-sm text-white focus:ring-0 focus:outline-none placeholder:text-slate-600"
            placeholder="Consult Al Wakeelo..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            data-testid="input-chat"
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading}
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
