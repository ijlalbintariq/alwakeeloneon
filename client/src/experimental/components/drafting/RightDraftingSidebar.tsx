import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Sparkles,
  Bot,
  BookOpen,
  Scale,
  ShieldCheck,
  Calculator,
  FileDown,
  ChevronRight,
  ChevronLeft,
  X,
  Send,
  PlusCircle,
  Copy,
  Check,
  Mic,
  Square,
  Loader2,
  RefreshCw,
  Sliders,
  Sun,
  Moon,
  AlertTriangle,
  CheckCircle2,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
} from "lucide-react";
import { useVoiceRecorder, formatDuration } from "@/hooks/use-voice-recorder";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  COURT_PETITIONS,
  COMMERCIAL_CONTRACTS,
  ALL_DRAFTING_TEMPLATES,
  type DraftingTemplate,
} from "@/experimental/components/drafting/drafting-data";
import { StatutoryClauseLibrary } from "@/experimental/components/drafting/StatutoryClauseLibrary";
import { DraftingTemplateLibrary } from "@/experimental/components/drafting/DraftingTemplateLibrary";
import { StyleMemoryDraftingPanel } from "@/experimental/components/drafting/StyleMemoryDraftingPanel";
import { type LegalPageProfileId } from "@/lib/legal-page-layout";

export type RightSidebarTab = "ai_chat" | "templates" | "clauses" | "compliance" | "tools";

interface RightDraftingSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentDocumentText: string;
  onInsertClause: (clauseText: string, title?: string) => void;
  onReplaceDocument: (content: string) => void;
  onLoadTemplate: (template: DraftingTemplate) => void;
  onInsertTemplateAtCursor: (template: DraftingTemplate) => void;
  onOpenFeeModal: () => void;
  onOpenExportModal: () => void;
  activeProfileId: LegalPageProfileId;
  onChangeProfileId: (id: LegalPageProfileId) => void;
  editorWidthMode: "wide" | "full" | "court";
  onChangeWidthMode: (mode: "wide" | "full" | "court") => void;
  isLightPaperMode: boolean;
  onToggleLightPaperMode: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  insertableClause?: string;
  clauseTitle?: string;
  timestamp: string;
}

export const RightDraftingSidebar: React.FC<RightDraftingSidebarProps> = ({
  isOpen,
  onToggle,
  currentDocumentText,
  onInsertClause,
  onReplaceDocument,
  onLoadTemplate,
  onInsertTemplateAtCursor,
  onOpenFeeModal,
  onOpenExportModal,
  activeProfileId,
  onChangeProfileId,
  editorWidthMode,
  onChangeWidthMode,
  isLightPaperMode,
  onToggleLightPaperMode,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<RightSidebarTab>("ai_chat");
  const [inputPrompt, setInputPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const voice = useVoiceRecorder();

  // Chat message history
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-init",
      role: "assistant",
      text: "Assalam-o-Alaikum Advocate. I am your AI Drafting Assistant. Give me any command to formulate grounds, draft prayers, or insert statutory clauses in court format.",
      clauseTitle: "AI Drafter Ready",
      timestamp: "Just now",
    },
  ]);

  const quickActionChips = [
    {
      label: "AI Review & Suggestions",
      prompt: "Review this draft and suggest improvements for procedural compliance, legal strength, and clarity.",
    },
    {
      label: "Injunction Triple Test",
      prompt: "Draft grounds for temporary injunction under Order 39 Rules 1 & 2 CPC satisfying the mandatory triple test.",
    },
    {
      label: "CrPC 497(2) Bail Grounds",
      prompt: "Draft post-arrest bail grounds under Section 497(2) CrPC based on further inquiry and lack of overt role.",
    },
    {
      label: "Art. 199 Writ Grounds",
      prompt: "Draft High Court writ petition grounds under Article 199 against an arbitrary executive order lacking lawful authority.",
    },
    {
      label: "QSO Art. 17 Execution",
      prompt: "Generate an Article 17 Qanun-e-Shahadat Order attestation block with marginal witnesses.",
    },
    {
      label: "Affidavit Verification",
      prompt: "Generate standard verification on solemn affirmation under Order XIX CPC for this petition.",
    },
  ];

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current && activeTab === "ai_chat") {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating, activeTab]);

  const handleSend = async (textOverride?: string) => {
    const query = (textOverride || inputPrompt).trim();
    if (!query || isGenerating) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textOverride) setInputPrompt("");
    setIsGenerating(true);

    try {
      const payload = {
        prompt: query,
        draftText: currentDocumentText,
        jurisdiction: "Pakistan",
        module: "legal-drafting",
        stream: false,
      };

      const res = await fetch("/api/retrieval/clauses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Chamber session unauthenticated. Please sign in via the Sign In tab (/preview/auth) to enable live AI drafting.");
        }
        const errText = await res.text();
        throw new Error(`${res.status}: ${errText}`);
      }

      const data = await res.json();
      const generatedClause = data.clause || data.text || data.content || "";
      const explanation = data.explanation || data.summary || "Here is the court-ready legal draft generated by the AI legal model:";

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        text: explanation,
        insertableClause: generatedClause || undefined,
        clauseTitle: data.title || "Court-Ready Clause",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error("AI Drafting error:", err);
      const errorMsg = err?.message || "Communication disrupted. Please try again.";
      const aiMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        role: "assistant",
        text: `⚠️ ${errorMsg}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({
        title: "Clause Copied",
        description: "Draft text copied to clipboard.",
      });
    });
  };

  const handleVoiceTranscription = async () => {
    if (voice.isRecording) {
      try {
        const text = await voice.stopAndTranscribe();
        if (text) {
          setInputPrompt((prev) => (prev ? `${prev} ${text}` : text));
        }
      } catch (err) {
        toast({
          title: "Voice transcription error",
          description: err instanceof Error ? err.message : "Microphone error",
          variant: "destructive",
        });
      }
    } else {
      await voice.startRecording();
    }
  };

  // ─── 6-Pillar Compliance Computation ──────────────────────────────────────
  const compliancePillars = useMemo(() => {
    const text = currentDocumentText.toLowerCase();

    return [
      {
        id: "p1",
        title: "Court Forum & Header",
        passed:
          text.includes("in the high court") ||
          text.includes("in the court of") ||
          text.includes("in the supreme court") ||
          text.includes("judicial department"),
        fixClause: "IN THE HIGH COURT OF JUDICATURE AT LAHORE\n(JUDICIAL DEPARTMENT)\n\nWrit Petition No. _________ / 2026\n",
      },
      {
        id: "p2",
        title: "Parties & CNIC Block",
        passed: text.includes("cnic") || text.includes("resident of") || text.includes("petitioner"),
        fixClause: "1. Tariq Mahmood s/o Muhammad Bashir,\n   CNIC: 35201-1234567-1,\n   R/o House 12, Gulberg III, Lahore. ... PETITIONER\n\nVERSUS\n\n1. Province of Punjab...\n",
      },
      {
        id: "p3",
        title: "Statutory Law & Provision",
        passed:
          text.includes("article 199") ||
          text.includes("section 497") ||
          text.includes("section 498") ||
          text.includes("order xxxix") ||
          text.includes("order vii") ||
          text.includes("act") ||
          text.includes("ordinance"),
        fixClause: "WRIT PETITION UNDER ARTICLE 199 OF THE CONSTITUTION OF PAKISTAN, 1973\n",
      },
      {
        id: "p4",
        title: "Judicial Recital Formula",
        passed: text.includes("respectfully sheweth") || text.includes("sheweth"),
        fixClause: "Respectfully Sheweth:\n\n1. That the Petitioner is a citizen of Pakistan...\n",
      },
      {
        id: "p5",
        title: "Solemn Affirmation Verification",
        passed: text.includes("verification") || text.includes("solemn affirmation") || text.includes("deponent"),
        fixClause: "VERIFICATION:\nVerified on solemn affirmation at Lahore on this 22nd August 2026 that contents of paras 1-5 are true to my personal knowledge.\n\nDEPONENT\n",
      },
      {
        id: "p6",
        title: "Marginal Witnesses (Art. 17 QSO)",
        passed: text.includes("witness") || text.includes("advocate high court"),
        fixClause: "WITNESS 1: __________________ CNIC: __________________\nWITNESS 2: __________________ CNIC: __________________\n",
      },
    ];
  }, [currentDocumentText]);

  const passedCount = compliancePillars.filter((p) => p.passed).length;
  const complianceScore = Math.round((passedCount / compliancePillars.length) * 100);

  if (!isOpen) return null;

  return (
    <aside className="w-80 sm:w-96 md:w-[400px] h-full flex flex-col bg-white dark:bg-[#131E2E] border-l border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs z-30 shrink-0 select-none animate-in slide-in-from-right duration-200">
      {/* ── Right Rail Top Navigation Bar ──────────────────────────────────── */}
      <div className="p-3 border-b border-[#E2E8F0] dark:border-[#1E2D44] bg-[#F8FAFC] dark:bg-[#0B131E] flex items-center justify-between gap-2 shrink-0">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar flex-1">
          <button
            type="button"
            onClick={() => setActiveTab("ai_chat")}
            className={cn(
              "px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0",
              activeTab === "ai_chat"
                ? "bg-[#105B38] text-white shadow-xs"
                : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:bg-[#1E2D44]"
            )}
            title="AI Drafting Co-Pilot"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Drafter</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("templates")}
            className={cn(
              "px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0",
              activeTab === "templates"
                ? "bg-[#105B38] text-white shadow-xs"
                : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:bg-[#1E2D44]"
            )}
            title="Pleading Templates"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Templates</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("clauses")}
            className={cn(
              "px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0",
              activeTab === "clauses"
                ? "bg-[#105B38] text-white shadow-xs"
                : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:bg-[#1E2D44]"
            )}
            title="Statutory Clauses"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Clauses</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tools")}
            className={cn(
              "px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0",
              activeTab === "tools"
                ? "bg-[#105B38] text-white shadow-xs"
                : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:bg-[#1E2D44]"
            )}
            title="Paper & Export Tools"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Tools</span>
          </button>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onToggle}
          className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] transition-colors shrink-0"
          title="Close Sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── TAB 1: AI Drafting Co-Pilot & Chat ──────────────────────────────── */}
      {activeTab === "ai_chat" && (
        <div className="flex-1 flex flex-col min-h-0 bg-[#F8FAFC] dark:bg-[#0B131E]">
          {/* Quick Prompts Bar */}
          <div className="px-3 py-2 bg-white dark:bg-[#131E2E] border-b border-[#E2E8F0] dark:border-[#1E2D44] flex items-center gap-1.5 overflow-x-auto custom-scrollbar shrink-0">
            {quickActionChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(chip.prompt)}
                className="px-2 py-1 rounded-md text-[10px] font-semibold bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-emerald-50 dark:bg-emerald-500/10 hover:text-[#105B38] border border-[#E2E8F0] dark:border-[#1E2D44] hover:border-emerald-200 dark:border-emerald-500/20 text-[#334155] dark:text-[#CBD5E1] transition-colors whitespace-nowrap shrink-0"
              >
                + {chip.label}
              </button>
            ))}
          </div>

          {/* Messages Scroll Area */}
          <div
            ref={chatScrollRef}
            className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-3"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-full",
                  msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                  {msg.role === "assistant" ? (
                    <>
                      <Bot className="w-3 h-3 text-[#105B38]" />
                      <span className="font-bold text-[#105B38]">Alwakeelo Drafter</span>
                    </>
                  ) : (
                    <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">Counsel</span>
                  )}
                  <span>·</span>
                  <span>{msg.timestamp}</span>
                </div>

                <div
                  className={cn(
                    "p-3 rounded-xl text-xs leading-relaxed border shadow-xs w-full",
                    msg.role === "user"
                      ? "bg-[#105B38] text-white border-[#105B38] rounded-tr-xs"
                      : "bg-white dark:bg-[#131E2E] text-[#0F172A] dark:text-[#F8FAFC] border-[#E2E8F0] dark:border-[#1E2D44] rounded-tl-xs"
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Render Insertable Clause Card */}
                  {msg.insertableClause && (
                    <div className="mt-2.5 pt-2.5 border-t border-[#E2E8F0] dark:border-[#1E2D44] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#105B38] flex items-center gap-1">
                          <Scale className="w-3 h-3" />
                          {msg.clauseTitle || "Clause Preview"}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.id, msg.insertableClause!)}
                            className="p-1 rounded bg-[#F1F5F9] dark:bg-[#1E2D44] hover:bg-[#E2E8F0] text-[#334155] dark:text-[#CBD5E1] text-[10px] font-semibold transition-colors"
                            title="Copy Clause"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onInsertClause(msg.insertableClause!, msg.clauseTitle)
                            }
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#105B38] hover:bg-[#0D4A2E] text-white text-[10px] font-bold shadow-xs transition-all"
                            title="Insert at cursor position in editor"
                          >
                            <PlusCircle className="w-3 h-3" />
                            <span>Insert</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onReplaceDocument(msg.insertableClause!)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20 text-[10px] font-bold transition-colors"
                            title="Replace full document"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Replace</span>
                          </button>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] font-serif text-[11px] text-[#1E293B] leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar">
                        {msg.insertableClause}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isGenerating && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs text-[#105B38] w-fit shadow-xs animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#105B38]" />
                <span className="font-semibold text-[11px]">Formulating legal grounds...</span>
              </div>
            )}
          </div>

          {/* Bottom Chat Input */}
          <div className="p-3 bg-white dark:bg-[#131E2E] border-t border-[#E2E8F0] dark:border-[#1E2D44] shrink-0">
            <div className="relative flex flex-col gap-1.5">
              <textarea
                ref={inputRef}
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={2}
                placeholder="Command AI to draft or amend (e.g. 'Draft stay grounds under Order 39')..."
                className="w-full p-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:text-[#475569] focus:outline-none focus:border-[#105B38] focus:bg-white dark:bg-[#131E2E] resize-none transition-colors"
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {voice.isSupported && (
                    <button
                      type="button"
                      onClick={handleVoiceTranscription}
                      className={cn(
                        "p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors",
                        voice.isRecording
                          ? "bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 animate-pulse"
                          : "bg-[#F8FAFC] dark:bg-[#0B131E] border-[#E2E8F0] dark:border-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
                      )}
                      title="Voice Note Dictation"
                    >
                      {voice.isRecording ? (
                        <>
                          <Square className="w-3 h-3 text-rose-600 dark:text-rose-400 fill-rose-600" />
                          <span className="text-[10px] font-mono font-bold">
                            {formatDuration(voice.duration)}
                          </span>
                        </>
                      ) : (
                        <Mic className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                  <span className="text-[10px] text-[#94A3B8] dark:text-[#475569]">Press Enter to send</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!inputPrompt.trim() || isGenerating}
                  className="px-3 py-1.5 rounded-lg bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold flex items-center gap-1 shadow-xs disabled:opacity-40 transition-all active:scale-95"
                >
                  <Send className="w-3 h-3" />
                  <span>Draft</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Templates Library ────────────────────────────────────────── */}
      {activeTab === "templates" && (
        <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
          <DraftingTemplateLibrary
            onLoadTemplate={onLoadTemplate}
            onInsertTemplateAtCursor={onInsertTemplateAtCursor}
          />
        </div>
      )}

      {/* ── TAB 3: Statutory Clauses Library ────────────────────────────────── */}
      {activeTab === "clauses" && (
        <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
          <StatutoryClauseLibrary onInsertClause={onInsertClause} />
        </div>
      )}

      {/* ── TAB 4: Paper Layout, Compliance & Export Tools ─────────────────── */}
      {activeTab === "tools" && (
        <div className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-4">
          {/* 6-Pillar Compliance Summary */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Procedural Compliance (Order VII R11)
              </span>
              <span className="text-xs font-bold font-mono text-[#105B38]">
                {complianceScore}% ({passedCount}/6)
              </span>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-[#E2E8F0] dark:border-[#1E2D44]">
              {compliancePillars.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {p.passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                    <span className="text-[11px] text-[#334155] dark:text-[#CBD5E1]">{p.title}</span>
                  </div>

                  {!p.passed && (
                    <button
                      type="button"
                      onClick={() => onInsertClause(p.fixClause, `Fixed ${p.title}`)}
                      className="text-[10px] font-bold text-[#105B38] hover:underline"
                    >
                      Fix & Insert
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* AI Draft Risk Analysis (Production RAG Connected) */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              AI Draft Risk & Loophole Scanner
            </h4>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
              Run full document through production RAG safety filters, testing against Pakistani case law for ambiguities, missing liabilities, and procedural flaws.
            </p>
            <button
              type="button"
              onClick={async () => {
                if (!currentDocumentText.trim()) return;
                const btn = document.getElementById("ai-risk-scan-btn");
                if (btn) btn.innerHTML = '<span class="flex items-center gap-1.5"><span class="animate-spin text-sm">⟳</span> Scanning...</span>';
                
                try {
                  const res = await fetch("/api/ai/draft-risk-analysis", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: "Draft", content: currentDocumentText })
                  });
                  const data = await res.json();
                  const risks = Array.isArray(data.risks) ? data.risks : [];
                  
                  const container = document.getElementById("ai-risk-results");
                  if (container) {
                    if (risks.length === 0) {
                      container.innerHTML = '<div class="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded">No major risks detected!</div>';
                    } else {
                      container.innerHTML = risks.map((r: any) => `
                        <div class="text-left p-2 rounded border mb-2 transition-all border-${r.severity === 'danger' ? 'red' : 'amber'}-200 bg-${r.severity === 'danger' ? 'red' : 'amber'}-50 text-${r.severity === 'danger' ? 'red' : 'amber'}-800 text-[11px]">
                          <strong>${r.title}</strong><br/>
                          ${r.detail}
                          <button class="mt-1 font-bold underline" onclick="window.insertClauseFromRisk('${r.prompt.replace(/'/g, "\\'")}')">Apply Fix</button>
                        </div>
                      `).join("");
                      // Expose the inserter
                      (window as any).insertClauseFromRisk = (clause: string) => onInsertClause(clause, "Fixed Risk");
                    }
                  }
                } catch (e) {
                  const container = document.getElementById("ai-risk-results");
                  if (container) container.innerHTML = '<div class="text-[11px] text-red-600 dark:text-red-400">Scan failed.</div>';
                } finally {
                  if (btn) btn.innerHTML = '<span class="flex items-center gap-1.5">Run Deep Scan</span>';
                }
              }}
              id="ai-risk-scan-btn"
              className="w-full py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              Run Deep Scan
            </button>
            <div id="ai-risk-results" className="pt-2"></div>
          </div>

          {/* Quick Statutory Tools */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">Court Fee & Statutory Valuation</h4>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
              Compute ad valorem / fixed court fees under Court Fees Act 1870 & Suits Valuation Act 1887.
            </p>
            <button
              type="button"
              onClick={onOpenFeeModal}
              className="w-full py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-emerald-50 dark:bg-emerald-500/10 hover:text-[#105B38] border border-[#E2E8F0] dark:border-[#1E2D44] hover:border-emerald-200 dark:border-emerald-500/20 text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center justify-center gap-1.5 transition-colors"
            >
              <Calculator className="w-4 h-4 text-[#105B38]" />
              <span>Launch Court Fee Calculator</span>
            </button>
          </div>

          {/* Paper Profile & Width Controls */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">Canvas Dimensions & Layout</h4>

            {/* Paper Size */}
            <div>
              <label className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] block mb-1">
                Court Paper Format
              </label>
              <select
                value={activeProfileId}
                onChange={(e) => onChangeProfileId(e.target.value as LegalPageProfileId)}
                className="w-full h-9 px-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#105B38]"
              >
                <option value="court-legal">Court Legal (8.5 × 14 in)</option>
                <option value="a4">A4 Court (210 × 297 mm)</option>
              </select>
            </div>

            {/* Editor Canvas Width */}
            <div>
              <label className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] block mb-1">
                Editor Sheet Width
              </label>
              <div className="grid grid-cols-3 gap-1 bg-[#F8FAFC] dark:bg-[#0B131E] p-1 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44]">
                <button
                  type="button"
                  onClick={() => onChangeWidthMode("wide")}
                  className={cn(
                    "py-1 rounded-lg text-xs font-bold transition-colors",
                    editorWidthMode === "wide"
                      ? "bg-white dark:bg-[#131E2E] text-[#105B38] shadow-xs"
                      : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
                  )}
                >
                  Wide
                </button>
                <button
                  type="button"
                  onClick={() => onChangeWidthMode("full")}
                  className={cn(
                    "py-1 rounded-lg text-xs font-bold transition-colors",
                    editorWidthMode === "full"
                      ? "bg-white dark:bg-[#131E2E] text-[#105B38] shadow-xs"
                      : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
                  )}
                >
                  Full (100%)
                </button>
                <button
                  type="button"
                  onClick={() => onChangeWidthMode("court")}
                  className={cn(
                    "py-1 rounded-lg text-xs font-bold transition-colors",
                    editorWidthMode === "court"
                      ? "bg-white dark:bg-[#131E2E] text-[#105B38] shadow-xs"
                      : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
                  )}
                >
                  Court 8.5&quot;
                </button>
              </div>
            </div>

            {/* Paper Sheet Theme */}
            <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F0] dark:border-[#1E2D44]">
              <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Virtual Sheet Theme:</span>
              <button
                type="button"
                onClick={onToggleLightPaperMode}
                className="px-3 py-1 rounded-lg bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5"
              >
                {isLightPaperMode ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>White Paper</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Dark Paper</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Export Pleading Document */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs space-y-2.5">
            <h4 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">Export Legal Pleading</h4>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
              Court-ready formatted PDF with Times New Roman 13pt, Word (.docx), or plain text.
            </p>
            <button
              type="button"
              onClick={onOpenExportModal}
              className="w-full py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
            >
              <FileDown className="w-4 h-4" />
              <span>Export Pleading (PDF / DOCX)</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
