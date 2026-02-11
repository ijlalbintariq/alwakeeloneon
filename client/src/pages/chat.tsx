import { useState, useRef, useEffect } from "react";
import { Scale, Send, Trash2, Bookmark, Loader2, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  return <ChatModule type="al-wakeelo" title="Al Wakeelo Engine" />;
}

export function ChatModule({ type, title, initialMessage }: { type: string; title?: string; initialMessage?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(initialMessage || "");
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (initialMessage) {
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
    },
  });

  const handleSend = async (overrideInput?: string) => {
    const text = overrideInput || input;
    if (!text.trim() || isLoading) return;
    setApiError(null);
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setIsLoading(true);

    try {
      const res = await apiRequest("POST", "/api/ai/chat", {
        messages: updated.map((m) => ({ role: m.role, content: m.content })),
        type,
      });
      const data = await res.json();
      setMessages([
        ...updated,
        { id: (Date.now() + 1).toString(), role: "assistant", content: data.content },
      ]);

      await apiRequest("POST", "/api/search-history", { type: "chat", query: text.substring(0, 80) }).catch(() => {});
    } catch (err: any) {
      const isLimitError = err?.message?.includes("429");
      const limitMsg = isLimitError
        ? "Monthly query limit reached. Upgrade your plan to continue using Al Wakeelo."
        : "Communication with chambers disrupted. Please try again.";
      setMessages([
        ...updated,
        { id: (Date.now() + 1).toString(), role: "assistant", content: limitMsg },
      ]);
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
        <button
          onClick={handleClear}
          data-testid="button-clear-chat"
          className="px-4 py-2 hover:bg-red-500/10 rounded-xl text-slate-500 hover:text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all"
        >
          <Trash2 size={14} /> Reset
        </button>
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

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} slide-in-from-bottom-4`}>
            <div
              className={`max-w-[85%] p-6 md:p-8 rounded-[2rem] shadow-xl relative group ${
                m.role === "user"
                  ? "bg-amber-500 text-slate-950 font-bold rounded-tr-lg"
                  : "bg-[#0f172a] border border-slate-700 text-slate-200 rounded-tl-lg"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
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
        ))}

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

      <div className="p-4 md:p-6 bg-[#0f172a]/50 border-t border-slate-800">
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
