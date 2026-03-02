import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Scale, Loader2, ArrowLeft, Calendar } from "lucide-react";
import { LegalMarkdown } from "@/components/legal-markdown";
import { parseReferences, ReferenceCards } from "@/components/reference-cards";

interface SharedMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface SharedConversation {
  title: string;
  createdAt: string;
  messages: SharedMessage[];
  sharedBy: string;
}

export default function SharedConversationPage() {
  const [, params] = useRoute("/share/:token");
  const [conversation, setConversation] = useState<SharedConversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.token) return;
    async function fetchShared() {
      try {
        const res = await fetch(`/api/shared/${params!.token}`);
        if (!res.ok) {
          setError("This shared conversation could not be found or has been removed.");
          return;
        }
        const data = await res.json();
        setConversation(data);
      } catch {
        setError("Failed to load shared conversation.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchShared();
  }, [params?.token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="animate-spin" size={24} />
          <span className="text-sm font-medium">Loading shared conversation...</span>
        </div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto p-8">
          <Scale size={48} className="text-slate-700 mx-auto" />
          <h1 className="text-xl font-bold text-white">Conversation Not Found</h1>
          <p className="text-slate-400 text-sm">{error || "This shared link is no longer valid."}</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors"
            data-testid="link-back-home"
          >
            <ArrowLeft size={16} /> Go to Al Wakeelo
          </a>
        </div>
      </div>
    );
  }

  const formattedDate = new Date(conversation.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <div className="max-w-4xl mx-auto">
        <div className="sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-800 px-3 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Scale size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-white truncate" data-testid="text-shared-title">
                {conversation.title}
              </h1>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
                  Shared Conversation
                </span>
                <span className="text-[9px] text-slate-600">|</span>
                <span className="flex items-center gap-1 text-[9px] text-slate-500">
                  <Calendar size={9} />
                  {formattedDate}
                </span>
                <span className="text-[9px] text-slate-600">|</span>
                <span className="text-[9px] text-slate-500" data-testid="text-shared-by">
                  by {conversation.sharedBy}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-6 md:p-10 space-y-4 sm:space-y-6" data-testid="shared-messages-container">
          {conversation.messages.map((m, i) => {
            const parsed = m.role === "assistant" ? parseReferences(m.content) : null;
            const displayContent = parsed ? parsed.cleanContent : m.content;
            return (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[92%] sm:max-w-[85%] p-3 sm:p-6 md:p-8 rounded-[1.2rem] sm:rounded-[2rem] shadow-xl ${
                    m.role === "user"
                      ? "bg-amber-500 text-slate-950 font-bold rounded-tr-lg"
                      : "bg-[#1e293b] border border-slate-700 text-slate-200 rounded-tl-lg"
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
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-800 p-4 sm:p-6 text-center space-y-4">
          <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">
            Want to consult Al Wakeelo yourself?
          </p>
          <a
            href="/auth"
            className="inline-block px-8 py-3 bg-amber-500 text-slate-950 font-bold rounded-xl hover:bg-amber-400 transition-colors shadow-xl shadow-amber-500/20"
            data-testid="link-try-al-wakeelo"
          >
            Start Chatting with Al Wakeelo
          </a>
        </div>
      </div>
    </div>
  );
}
