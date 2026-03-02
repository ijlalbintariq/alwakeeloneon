import { useState, useRef, useEffect } from "react";
import { useChatSession } from "@/hooks/use-chat-session";
import { Scale, Send, MessageSquare } from "lucide-react";

export function ChatDock() {
  const [open, setOpen] = useState(false);
  const { messages, input, setInput, send, isLoading } = useChatSession();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isLoading, open]);

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Toggle Chat"
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 shadow-xl flex items-center justify-center hover:bg-amber-400 transition-colors"
        data-testid="button-chat-dock-toggle"
      >
        <MessageSquare size={18} />
      </button>

      {open && (
        <div className="fixed bottom-20 right-3 sm:right-6 z-40 w-[calc(100vw-1.5rem)] sm:w-[380px] max-w-[calc(100vw-1.5rem)] sm:max-w-[calc(100vw-2rem)] bg-[#1e293b] border border-slate-800 rounded-[1.2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden">
          <div className="p-3 bg-[#0f172a]/80 border-b border-slate-800 flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Scale size={16} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Al Wakeelo</p>
          </div>
          <div ref={scrollRef} className="max-h-[48vh] overflow-y-auto p-3 space-y-3 scrollbar-hide">
            {messages.length === 0 && (
              <div className="text-center text-slate-600 text-[10px]">
                Start a conversation with Al Wakeelo.
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs ${m.role === "user" ? "bg-amber-500 text-slate-950" : "bg-[#0f172a] border border-slate-700 text-slate-200"}`}>
                  {m.role === "assistant" && (m.modeName || m.modelName) && (
                    <div className="mb-1.5 pb-1 border-b border-slate-700/40">
                      {m.modeName && (
                        <div className={`text-[9px] font-black uppercase tracking-widest ${
                          m.modeName === "Turbo" ? "text-purple-400" : "text-slate-400"
                        }`}>
                          Mode: {m.modeName}
                        </div>
                      )}
                      {m.modelName && (
                        <div className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mt-0.5">
                          Model: {m.modelName}
                        </div>
                      )}
                      {m.modelDescription && (
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {m.modelDescription}
                        </div>
                      )}
                    </div>
                  )}
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#0f172a] px-3 py-2 rounded-xl border border-slate-800 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "75ms" }} />
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                </div>
              </div>
            )}
          </div>
          <div className="p-2 border-t border-slate-800 bg-[#0f172a]/50">
            <div className="flex gap-2 bg-[#1e293b] border border-slate-700 p-1 rounded-2xl">
              <input
                className="flex-1 bg-transparent border-none px-3 py-2 text-[13px] text-white focus:ring-0 focus:outline-none placeholder:text-slate-600"
                placeholder="Consult Al Wakeelo..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                data-testid="input-chat-dock"
              />
              <button
                onClick={() => send()}
                disabled={isLoading}
                className="px-3 bg-amber-500 text-slate-950 rounded-xl hover:bg-amber-400 shadow-xl transition-all active:scale-95 disabled:opacity-50"
                data-testid="button-chat-dock-send"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
