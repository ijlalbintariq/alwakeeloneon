import React from "react";
import { Link } from "wouter";
import {
  MessageSquare,
  FileSignature,
  Search,
  ArrowRight,
  Clock,
  Sparkles,
  ChevronRight,
  Bot,
  FileText,
  Lightbulb,
} from "lucide-react";

interface ResumptionStreamProps {
  threads?: any[];
  documents?: any[];
  searchHistory?: any[];
  activitySummary?: {
    lastActivity?: {
      threadId?: number;
      threadTitle?: string;
      updatedAt?: string;
      displayDate?: string;
      displayTime?: string;
    };
    recentDocuments?: Array<{ id: number; title: string; createdAt?: string }>;
    documentCount?: number;
    workspaceFocus?: string[];
  };
}

export const ResumptionStream: React.FC<ResumptionStreamProps> = ({
  threads = [],
  documents = [],
  searchHistory = [],
  activitySummary,
}) => {
  const recentThreads = threads.slice(0, 3);
  const recentDocs = (
    documents.length > 0 ? documents : activitySummary?.recentDocuments || []
  ).slice(0, 3);
  const recentSearches = searchHistory.slice(0, 4);
  const workspaceFocus = activitySummary?.workspaceFocus || [
    "Run precedent research on PLD/SCMR before final drafting",
    "Attach certified trial court orders for accurate RAG analysis",
    "Verify power of attorney and court fee stamps prior to cause list call",
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#1A1A1A]" />
          <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-[#4A4A4A]">
            Chambers Stream & Quick Resumption
          </h2>
        </div>
        <span className="text-xs text-[#666666] font-mono">1-Click Jump</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Recent AI Consultations */}
        <div className="p-4 rounded-xl bg-[#F5F4F2] border border-[#E5E4E2] backdrop-blur-sm shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#E5E4E2]">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#2D2D2D]">
                <Bot className="w-3.5 h-3.5 text-[#1A1A1A]" />
                <span>AI Consultations</span>
              </div>
              <Link
                href="/preview/chat"
                className="text-[11px] text-[#1A1A1A] hover:text-[#1A1A1A] font-mono"
              >
                All Threads →
              </Link>
            </div>

            {recentThreads.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#666666] space-y-2">
                <p>No prior AI consultations found.</p>
                <Link
                  href="/preview/chat"
                  className="inline-flex items-center gap-1 text-[#1A1A1A] hover:text-[#1A1A1A] font-semibold"
                >
                  Start New Session →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentThreads.map((thread) => (
                  <Link
                    key={thread.id}
                    href={`/preview/chat?threadId=${thread.id}`}
                    className="block p-2.5 rounded-lg bg-white/70 border border-[#E5E4E2] hover:border-[#D9D8D6] transition-all group"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-medium text-[#2D2D2D] group-hover:text-[#1A1A1A] transition-colors line-clamp-1">
                        {thread.title || `Consultation #${thread.id}`}
                      </p>
                      <ArrowRight className="w-3 h-3 text-[#4A4A4A] group-hover:text-[#1A1A1A] group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#666666] mt-1 font-mono">
                      <span>
                        {thread.updatedAt
                          ? new Date(thread.updatedAt).toLocaleDateString("en-PK", {
                              day: "2-digit",
                              month: "short",
                            })
                          : "Recent"}
                      </span>
                      <span>Resume Context</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 mt-3 border-t border-[#E5E4E2]/70">
            <Link
              href="/preview/chat"
              className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#F5F4F2] hover:bg-[#F5F4F2] text-[#4A4A4A] text-xs font-medium transition-colors"
            >
              <span>Launch New AI Session</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* 2. Recent Legal & Contract Drafts */}
        <div className="p-4 rounded-xl bg-[#F5F4F2] border border-[#E5E4E2] backdrop-blur-sm shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#E5E4E2]">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#2D2D2D]">
                <FileSignature className="w-3.5 h-3.5 text-[#666666]" />
                <span>Court & Contract Drafts</span>
              </div>
              <Link
                href="/preview/drafting"
                className="text-[11px] text-[#666666] hover:text-[#666666] font-mono"
              >
                All Documents →
              </Link>
            </div>

            {recentDocs.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#666666] space-y-2">
                <p>No legal drafts in active workspace.</p>
                <Link
                  href="/preview/drafting"
                  className="inline-flex items-center gap-1 text-[#666666] hover:text-[#666666] font-semibold"
                >
                  Create First Draft →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentDocs.map((doc: any) => (
                  <Link
                    key={doc.id}
                    href={`/preview/drafting?docId=${doc.id}`}
                    className="block p-2.5 rounded-lg bg-white/70 border border-[#E5E4E2] hover:border-[#D9D8D6] transition-all group"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-medium text-[#2D2D2D] group-hover:text-[#666666] transition-colors line-clamp-1">
                        {doc.title || `Document #${doc.id}`}
                      </p>
                      <ArrowRight className="w-3 h-3 text-[#4A4A4A] group-hover:text-[#666666] group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#666666] mt-1 font-mono">
                      <span>{doc.docType || "Court Petition"}</span>
                      <span>
                        {doc.updatedAt || doc.createdAt
                          ? new Date(
                              doc.updatedAt || doc.createdAt
                            ).toLocaleDateString("en-PK", {
                              day: "2-digit",
                              month: "short",
                            })
                          : "Drafting"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 mt-3 border-t border-[#E5E4E2]/70">
            <Link
              href="/preview/drafting"
              className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#F5F4F2] hover:bg-[#F5F4F2] text-[#4A4A4A] text-xs font-medium transition-colors"
            >
              <span>Open Tiptap Court Editor</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* 3. Precedent Research History & Chambers Focus */}
        <div className="p-4 rounded-xl bg-[#F5F4F2] border border-[#E5E4E2] backdrop-blur-sm shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#E5E4E2]">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#2D2D2D]">
                <Search className="w-3.5 h-3.5 text-[#1A1A1A]" />
                <span>Precedent Lookups</span>
              </div>
              <Link
                href="/preview/judgments"
                className="text-[11px] text-[#1A1A1A] hover:text-[#1A1A1A] font-mono"
              >
                Search Law →
              </Link>
            </div>

            {recentSearches.length === 0 ? (
              <div className="py-4 space-y-2">
                <div className="p-2.5 rounded-lg bg-white/70 border border-[#E5E4E2]">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1A1A1A] mb-1">
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>Chambers Strategic Focus</span>
                  </div>
                  <ul className="space-y-1 text-[11px] text-[#666666]">
                    {workspaceFocus.slice(0, 2).map((focus, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-[#1A1A1A] mt-0.5">•</span>
                        <span>{focus}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {recentSearches.map((s: any) => (
                  <Link
                    key={s.id}
                    href={`/preview/judgments?q=${encodeURIComponent(s.query)}`}
                    className="block p-2.5 rounded-lg bg-white/70 border border-[#E5E4E2] hover:border-emerald-500/40 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-medium text-[#2D2D2D] group-hover:text-[#1A1A1A] transition-colors line-clamp-1 font-mono">
                        "{s.query}"
                      </p>
                      <ArrowRight className="w-3 h-3 text-[#4A4A4A] group-hover:text-[#1A1A1A] group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#666666] mt-1 font-mono">
                      <span>{s.resultCount ? `${s.resultCount} citations` : "Query"}</span>
                      <span>Run Search</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 mt-3 border-t border-[#E5E4E2]/70">
            <Link
              href="/preview/judgments"
              className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#F5F4F2] hover:bg-[#F5F4F2] text-[#4A4A4A] text-xs font-medium transition-colors"
            >
              <span>Explore 600,000+ Judgments</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
