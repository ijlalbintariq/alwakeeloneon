import { useState, useRef, useEffect } from "react";
import { useChatSession } from "@/hooks/use-chat-session";
import { Scale, Send, MessageSquare } from "lucide-react";
import { LegalMarkdown } from "@/components/legal-markdown";

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
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-2xl bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:bg-primary/90 transition-colors"
        data-testid="button-chat-dock-toggle"
      >
        <MessageSquare size={18} />
      </button>

      {open && (
        <div className="fixed bottom-20 right-3 sm:right-6 z-40 w-[calc(100vw-1.5rem)] sm:w-[380px] max-w-[calc(100vw-1.5rem)] sm:max-w-[calc(100vw-2rem)] bg-card border border-border rounded-[1.2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden">
          <div className="p-3 bg-background/80 border-b border-border flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Scale size={16} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Al Wakeelo</p>
          </div>
          <div ref={scrollRef} className="max-h-[48vh] overflow-y-auto p-3 space-y-3 scrollbar-hide">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-[10px]">
                Start a conversation with Al Wakeelo.
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-background border border-border text-foreground"}`}>
                  {m.role === "assistant" && (m.modeName || m.modelName) && (
                    <div className="mb-1.5 pb-1 border-b border-border/40">
                      {m.modeName && (
                        <div className={`text-[9px] font-black uppercase tracking-widest ${
                          m.modeName === "Turbo" ? "text-primary" : "text-muted-foreground"
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
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {m.modelDescription}
                        </div>
                      )}
                    </div>
                  )}
                  {m.role === "assistant" ? (
                    <div className="text-xs"><LegalMarkdown content={m.content} /></div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-background px-3 py-2 rounded-xl border border-border flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "75ms" }} />
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                </div>
              </div>
            )}
          </div>
          <div className="p-2 border-t border-border bg-background/50">
            <div className="flex gap-2 bg-card border border-border p-1 rounded-2xl">
              <input
                className="flex-1 bg-transparent border-none px-3 py-2 text-[13px] text-foreground focus:ring-0 focus:outline-none placeholder:text-muted-foreground"
                placeholder="Consult Al Wakeelo..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                data-testid="input-chat-dock"
              />
              <button
                onClick={() => send()}
                disabled={isLoading}
                className="px-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 shadow-xl transition-all active:scale-95 disabled:opacity-50"
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
