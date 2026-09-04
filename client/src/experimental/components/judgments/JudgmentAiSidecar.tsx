import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  Send,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Trash2,
  Zap,
  Scale,
  BookOpen,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface JudgmentAiSidecarProps {
  judgmentTitle: string;
  citation: string;
  fullText: string;
  headnotes?: string | null;
  className?: string;
}

const QUICK_PROMPTS = [
  {
    label: "Core Ratio Decidendi",
    prompt: "Extract the core Ratio Decidendi, legal propositions, and binding rule established in this judgment.",
  },
  {
    label: "Bail / Criminal Analysis",
    prompt: "Analyze the applicability of this precedent to bail under Section 497 CrPC, further inquiry, and tentative assessment of evidence.",
  },
  {
    label: "Distinguishing Grounds",
    prompt: "What are the key distinguishing factors or factual nuances if opposing counsel cites this authority against my client in court?",
  },
  {
    label: "Statutes & Articles Cited",
    prompt: "List all Pakistani statutes, sections, and constitutional articles interpreted and cited in this judgment with brief context.",
  },
  {
    label: "Chambers Case Brief Memo",
    prompt: "Draft a formal 1-page Chambers Case Brief memo summarizing: Bench, Facts, Question of Law, Ratio Decidendi, and Operative Order.",
  },
];
export function generateLocalLegalResponse(
  prompt: string,
  citation?: string,
  title?: string,
  headnotes?: string | null,
  fullText?: string
): string {
  const p = prompt.toLowerCase();
  const ref = citation || title || "Selected Precedent";

  if (p.includes("case brief") || p.includes("memo summarizing") || p.includes("chambers case brief")) {
    return `### **Chambers Legal Case Brief**\n\n**Precedent:** ${ref}\n**Bench / Court:** Supreme Court / High Court of Pakistan\n**Facts:** The matter pertains to statutory interpretation and judicial remedies.\n**Question of Law:** Whether the impugned action conforms to constitutional and statutory standards.\n**Ratio Decidendi:** The authoritative rule of law established in this precedent.\n**Operative Order:** The petition/appeal is decided in accordance with established jurisprudence.`;
  }

  if (p.includes("ratio decidendi") || p.includes("ratio")) {
    return `### **Ratio Decidendi Analysis**\n\n**Precedent:** ${ref}\n**Binding Rule:** The core legal proposition established in this precedent: ${
      headnotes ? headnotes.slice(0, 300) : "Authoritative statutory and constitutional interpretation."
    }`;
  }

  if (p.includes("bail") || p.includes("497") || p.includes("criminal")) {
    return `### **Criminal & Bail Jurisprudence**\n\n**Precedent:** ${ref}\n**Applicability:** Analysis of Section 497 CrPC, tentative assessment of evidence, and grounds for further inquiry.`;
  }

  if (p.includes("distinguish") || p.includes("opposing")) {
    return `### **Distinguishing Grounds Analysis**\n\n**Precedent:** ${ref}\n**Key Factors:** Factual divergence, jurisdictional bounds, and distinguishing legal grounds.`;
  }

  if (p.includes("statute") || p.includes("article")) {
    return `### **Statutes & Provisions Cited**\n\n**Precedent:** ${ref}\n**Provisions:** Constitution of Pakistan, Code of Civil Procedure, Code of Criminal Procedure, and relevant statutory provisions.`;
  }

  return `### **Chambers Legal Analysis**\n\n**Precedent:** ${ref}\n${
    headnotes || (fullText ? fullText.slice(0, 300) : "Legal research synthesis complete.")
  }`;
}

export const JudgmentAiSidecar: React.FC<JudgmentAiSidecarProps> = ({
  judgmentTitle,
  citation,
  fullText,
  headnotes,
  className = "",
}) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: query }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const combinedContent = headnotes
        ? `Headnotes:\n${headnotes}\n\nJudgment Text:\n${fullText.slice(0, 80000)}`
        : fullText.slice(0, 80000);

      const res = await apiRequest("POST", "/api/ai/document-chat", {
        documentType: "judgment",
        documentTitle: `${judgmentTitle} (${citation})`,
        documentContent: combinedContent,
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Chamber session unauthenticated. Please sign in via the Sign In tab (/preview/auth) to enable live AI intelligence.");
        }
        const errText = await res.text();
        throw new Error(`${res.status}: ${errText}`);
      }

      const data = await res.json();
      const assistantText = data.content || data.message || "Analysis complete.";
      setMessages([...newMessages, { role: "assistant", content: assistantText }]);
    } catch (err: any) {
      console.error("AI Precedent Sidecar error:", err);
      const errMsg = err?.message || "Communication disrupted. Please try again.";
      setMessages([...newMessages, { role: "assistant", content: `⚠️ ${errMsg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
      toast({
        title: "Copied to Clipboard",
        description: "AI Legal synthesis copied successfully.",
      });
    });
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] flex flex-col overflow-hidden shadow-xs",
        className
      )}
    >
      {/* Sidecar Header */}
      <div className="p-3.5 border-b border-[#E2E8F0] dark:border-[#1E2D44] flex items-center justify-between bg-[#F8FAFC] dark:bg-[#0B131E]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-[#105B38] shadow-xs">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
              <span>Al Wakeelo Precedent Sidecar</span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20 rounded-md">
                Active
              </span>
            </h4>
            <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] truncate max-w-[210px] font-mono">
              {citation || "Judgment Intelligence"}
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="p-1.5 text-[#94A3B8] dark:text-[#475569] hover:text-rose-600 dark:text-rose-400 transition-colors rounded-lg hover:bg-rose-50 dark:bg-rose-500/10"
            title="Clear Chat History"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-[280px] max-h-[440px] text-xs">
        {messages.length === 0 ? (
          <div className="py-3 text-center space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-[#105B38] flex items-center justify-center mx-auto shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-[#0F172A] dark:text-[#F8FAFC] text-xs">Precedent Intelligence Assistant</p>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-0.5 max-w-[260px] mx-auto">
                Ask targeted legal questions regarding this judgment&apos;s holding, bench reasoning, or applicability.
              </p>
            </div>

            {/* Quick Prompt Pills */}
            <div className="space-y-1.5 pt-2 text-left">
              <span className="text-[10px] font-mono uppercase text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] font-bold block px-1">
                Suggested Pakistani Legal Inquiries:
              </span>
              <div className="flex flex-col gap-1.5">
                {QUICK_PROMPTS.map((qp, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => handleSendMessage(qp.prompt)}
                    className="p-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-emerald-50/6 dark:bg-emerald-500/100 dark:bg-emerald-500/10 border border-[#E2E8F0] dark:border-[#1E2D44] hover:border-emerald-200 dark:border-emerald-500/20 text-[#334155] dark:text-[#CBD5E1] hover:text-[#105B38] text-left text-[11px] font-medium transition-all flex items-center justify-between group shadow-xs"
                  >
                    <span>{qp.label}</span>
                    <Zap className="w-3.5 h-3.5 text-[#94A3B8] dark:text-[#475569] group-hover:text-[#105B38] shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((m, idx) => (
            <div
              key={idx}
              className={cn(
                "flex flex-col space-y-1",
                m.role === "user" ? "items-end" : "items-start"
              )}
            >
              <div className="flex items-center gap-1 text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] font-mono font-semibold">
                {m.role === "user" ? "Counsel" : "Al Wakeelo AI"}
              </div>

              <div
                className={cn(
                  "p-3.5 rounded-2xl max-w-[92%] leading-relaxed shadow-xs text-xs",
                  m.role === "user"
                    ? "bg-[#105B38] text-white rounded-tr-none font-sans font-medium"
                    : "bg-[#F8FAFC] dark:bg-[#0B131E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-tl-none font-sans"
                )}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>

                {m.role === "assistant" && (
                  <div className="mt-2.5 pt-2 border-t border-[#E2E8F0] dark:border-[#1E2D44] flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(m.content, idx)}
                      className="inline-flex items-center gap-1 text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#105B38] font-semibold transition-colors"
                      title="Copy response"
                    >
                      {copiedIdx === idx ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Answer</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] font-mono text-xs shadow-xs">
            <Loader2 className="w-4 h-4 animate-spin text-[#105B38]" />
            <span>Analyzing judgment jurisprudence & ratio...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input composer */}
      <div className="p-3 border-t border-[#E2E8F0] dark:border-[#1E2D44] bg-[#F8FAFC] dark:bg-[#0B131E]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this precedent..."
            disabled={loading}
            className="flex-1 bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-xl px-3.5 py-2 text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:text-[#475569] focus:outline-none focus:border-[#105B38] disabled:opacity-50 font-medium shadow-xs"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-2.5 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white font-bold transition-colors disabled:opacity-50 shrink-0 shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
