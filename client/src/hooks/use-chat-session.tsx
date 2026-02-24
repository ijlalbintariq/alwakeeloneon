import { createContext, useContext, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

type Role = "user" | "assistant";
type ChatMessage = { id: string; role: Role; content: string };

type UsageData = {
  tier: string;
  used: number;
  remaining: number;
  percentage: number;
  monthlyLimit: number;
};

type ChatSession = {
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  apiError: string | null;
  turboMode: boolean;
  canUseTurbo: boolean;
  setInput: (v: string) => void;
  setTurboMode: (v: boolean) => void;
  clear: () => void;
  send: (text?: string, opts?: { type?: string }) => Promise<void>;
};

const ChatSessionContext = createContext<ChatSession | null>(null);

export function ChatSessionProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [turboMode, setTurboMode] = useState(false);
  const assistantIdRef = useRef<string | null>(null);

  const { data: usage } = useQuery<UsageData>({ queryKey: ["/api/usage"] });
  const canUseTurbo = !!usage && (usage.tier === "pro" || usage.tier === "enterprise");

  async function send(override?: string, opts?: { type?: string }) {
    const type = opts?.type || "al-wakeelo";
    const text = override ?? input;
    if (!text.trim() || isLoading) return;
    setApiError(null);
    const userMsg: ChatMessage = { id: String(Date.now()), role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setIsLoading(true);

    const assistantId = String(Date.now() + 1);
    assistantIdRef.current = assistantId;

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: updated.map(m => ({ role: m.role, content: m.content })),
          type,
          turbo: turboMode && canUseTurbo,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        const isLimitError = response.status === 429;
        throw { message: `${response.status}: ${errText}`, isLimit: isLimitError };
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: data.content }]);
      } else {
        setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "" }]);
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
                  if (parsed.done) {
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

      queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
    } catch (err: any) {
      const isLimitError = err?.isLimit || err?.message?.includes("429");
      const limitMsg = isLimitError
        ? "Monthly query limit reached. Upgrade your plan to continue using Al Wakeelo."
        : "Communication disrupted. Please try again.";
      setMessages(prev => {
        const aId = assistantIdRef.current;
        const last = prev[prev.length - 1];
        if (aId && last && last.id === aId && !last.content) {
          return [...prev.slice(0, -1), { id: aId, role: "assistant", content: limitMsg }];
        }
        if (aId && !prev.find(m => m.id === aId)) {
          return [...prev, { id: aId, role: "assistant", content: limitMsg }];
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
  }

  function clear() {
    setMessages([]);
    setApiError(null);
  }

  const value = useMemo<ChatSession>(() => ({
    messages,
    input,
    isLoading,
    apiError,
    turboMode,
    canUseTurbo,
    setInput,
    setTurboMode,
    clear,
    send,
  }), [messages, input, isLoading, apiError, turboMode, canUseTurbo]);

  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}

export function useChatSession() {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) throw new Error("useChatSession must be used within ChatSessionProvider");
  return ctx;
}
