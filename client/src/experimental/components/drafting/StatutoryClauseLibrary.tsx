import React, { useState, useMemo } from "react";
import {
  STATUTORY_CLAUSES,
  type StatutoryClause,
} from "./drafting-data";
import {
  Search,
  BookOpen,
  Copy,
  Check,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  Scale,
  Sparkles,
  ShieldCheck,
  Building2,
  FileText,
  FileCheck,
} from "lucide-react";

interface StatutoryClauseLibraryProps {
  onInsertClause: (clauseText: string, title?: string) => void;
  className?: string;
}

type ClauseCategory =
  | "All"
  | "Corporate & Tax"
  | "Civil & Property"
  | "Criminal & Bail"
  | "Evidence & Execution"
  | "Dispute Resolution";

export const StatutoryClauseLibrary: React.FC<StatutoryClauseLibraryProps> = ({
  onInsertClause,
  className = "",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ClauseCategory>("All");
  const [expandedClauseId, setExpandedClauseId] = useState<string | null>("stat_partnership_s48");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories: ClauseCategory[] = [
    "All",
    "Corporate & Tax",
    "Civil & Property",
    "Criminal & Bail",
    "Evidence & Execution",
    "Dispute Resolution",
  ];

  const filteredClauses = useMemo(() => {
    return STATUTORY_CLAUSES.filter((clause) => {
      const matchesCategory =
        selectedCategory === "All" || clause.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        clause.title.toLowerCase().includes(q) ||
        clause.statute.toLowerCase().includes(q) ||
        clause.section.toLowerCase().includes(q) ||
        clause.summary.toLowerCase().includes(q) ||
        clause.clauseText.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const handleCopy = (clause: StatutoryClause) => {
    navigator.clipboard.writeText(clause.clauseText).then(() => {
      setCopiedId(clause.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Corporate & Tax":
        return <Building2 className="w-3.5 h-3.5 text-[#1A1A1A]" />;
      case "Civil & Property":
        return <FileText className="w-3.5 h-3.5 text-[#666666]" />;
      case "Criminal & Bail":
        return <Scale className="w-3.5 h-3.5 text-[#1A1A1A]" />;
      case "Evidence & Execution":
        return <FileCheck className="w-3.5 h-3.5 text-[#666666]" />;
      case "Dispute Resolution":
        return <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <BookOpen className="w-3.5 h-3.5 text-[#1A1A1A]" />;
    }
  };

  return (
    <div className={`flex flex-col h-full space-y-3 ${className}`}>
      {/* Search Header */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#666666]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search statutory clauses (e.g. s.153, s.48, QSO, PECA)..."
          className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[#F5F4F2] border border-[#E5E4E2] text-[#2D2D2D] placeholder:text-[#666666] focus:outline-none focus:border-[#1A1A1A]/50 focus:ring-1 focus:ring-[#1A1A1A]/30 transition-all font-sans"
        />
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-1.5 pb-2 border-b border-[#E5E4E2]">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedCategory === cat
                ? "bg-blue-600 text-white border border-blue-500 shadow-sm"
                : "text-[#4A4A4A] hover:text-[#1A1A1A] bg-white border border-[#E5E4E2] hover:bg-[#F5F4F2]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Clause List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
        {filteredClauses.length === 0 ? (
          <div className="text-center py-8 text-[#666666] text-xs">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30 text-[#666666]" />
            No statutory clauses matched your search.
          </div>
        ) : (
          filteredClauses.map((clause) => {
            const isExpanded = expandedClauseId === clause.id;
            const isCopied = copiedId === clause.id;

            return (
              <div
                key={clause.id}
                className="rounded-xl bg-[#F5F4F2] border border-[#E5E4E2]/90 hover:border-[#E5E4E2] transition-all overflow-hidden"
              >
                {/* Clause Header Bar */}
                <div
                  onClick={() =>
                    setExpandedClauseId(isExpanded ? null : clause.id)
                  }
                  className="p-3 cursor-pointer flex items-start justify-between gap-2 select-none hover:bg-[#F5F4F2]/30 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#F5F4F2] border border-[#E5E4E2] text-[10px] font-mono text-[#1A1A1A] font-semibold">
                        {getCategoryIcon(clause.category)}
                        {clause.section}
                      </span>
                      <span className="text-[10px] text-[#666666] font-serif truncate">
                        {clause.statute}
                      </span>
                    </div>
                    <h3 className="text-xs font-semibold text-[#2D2D2D] leading-snug">
                      {clause.title}
                    </h3>
                    <p className="text-[11px] text-[#666666] line-clamp-2">
                      {clause.summary}
                    </p>
                  </div>
                  <div className="text-[#666666] hover:text-[#2D2D2D] shrink-0 mt-1">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>

                {/* Expanded Clause Body */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-[#E5E4E2]/60 bg-white/50 space-y-2.5">
                    {/* Practice Note */}
                    <div className="p-2 rounded bg-[#1A1A1A]/5 border border-[#1A1A1A]/15 text-[11px] text-[#666666] flex items-start gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#1A1A1A] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-[#1A1A1A]">Chamber Practice Note: </span>
                        {clause.practiceNote}
                      </div>
                    </div>

                    {/* Pre-formatted Clause Prose */}
                    <div className="p-2.5 rounded-lg bg-white border border-[#E5E4E2] text-[11px] text-[#4A4A4A] font-serif leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto select-text">
                      {clause.clauseText}
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(clause)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#F5F4F2] hover:bg-[#EBEBEB] text-[#2D2D2D] text-xs font-medium border border-[#E5E4E2] transition-colors"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3 text-[#1A1A1A]" />
                            <span className="text-[#1A1A1A]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-[#666666]" />
                            <span>Copy Clause</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onInsertClause(clause.clauseText, clause.title)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#1A1A1A] hover:bg-[#2D2D2D] text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Insert at Cursor</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

