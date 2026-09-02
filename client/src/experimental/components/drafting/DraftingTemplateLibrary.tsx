import React, { useState, useMemo } from "react";
import {
  ALL_DRAFTING_TEMPLATES,
  type DraftingTemplate,
  type TemplateCategory,
} from "./drafting-data";
import {
  Search,
  FileText,
  Eye,
  PlusCircle,
  FolderOpen,
  Scale,
  Building2,
  BookOpen,
  X,
  Sparkles,
  Tag,
  CheckCircle2,
} from "lucide-react";

interface DraftingTemplateLibraryProps {
  onLoadTemplate: (template: DraftingTemplate) => void;
  onInsertTemplateAtCursor: (template: DraftingTemplate) => void;
  className?: string;
}

export const DraftingTemplateLibrary: React.FC<DraftingTemplateLibraryProps> = ({
  onLoadTemplate,
  onInsertTemplateAtCursor,
  className = "",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>("All");
  const [previewTemplate, setPreviewTemplate] = useState<DraftingTemplate | null>(null);

  const categories: { label: TemplateCategory; count: number }[] = useMemo(() => {
    const cats: TemplateCategory[] = [
      "All",
      "High Court",
      "Sessions & Criminal",
      "Civil Court",
      "Supreme Court",
      "Family & Personal",
      "Affidavits & Notices",
      "Commercial Contracts",
    ];

    return cats.map((cat) => {
      if (cat === "All") {
        return { label: cat, count: ALL_DRAFTING_TEMPLATES.length };
      }
      return {
        label: cat,
        count: ALL_DRAFTING_TEMPLATES.filter((t) => t.category === cat).length,
      };
    });
  }, []);

  const filteredTemplates = useMemo(() => {
    return ALL_DRAFTING_TEMPLATES.filter((t) => {
      const matchesCategory =
        selectedCategory === "All" || t.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.forum.toLowerCase().includes(q) ||
        t.governingLaw.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className={`flex flex-col h-full space-y-3 ${className}`}>
      {/* Search Header */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#666666]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search 45+ templates (e.g. Writ 199, Bail, SHA, NDA)..."
          className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[#F5F4F2] border border-[#E5E4E2] text-[#2D2D2D] placeholder:text-[#666666] focus:outline-none focus:border-[#1A1A1A]/50 focus:ring-1 focus:ring-[#1A1A1A]/30 transition-all font-sans"
        />
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-1.5 pb-2 border-b border-[#E5E4E2]">
        {categories.map((c) => (
          <button
            key={c.label}
            onClick={() => setSelectedCategory(c.label)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              selectedCategory === c.label
                ? "bg-blue-600 text-white border border-blue-500 shadow-sm"
                : "text-[#4A4A4A] hover:text-[#1A1A1A] bg-white border border-[#E5E4E2] hover:bg-[#F5F4F2]"
            }`}
          >
            <span>{c.label}</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
              selectedCategory === c.label ? "bg-[#1A1A1A] text-white font-bold" : "bg-[#F5F4F2] text-[#4A4A4A]"
            }`}>
              {c.count}
            </span>
          </button>
        ))}
      </div>

      {/* Templates List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-10 text-[#666666] text-xs">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30 text-[#666666]" />
            No drafting templates match your search criteria.
          </div>
        ) : (
          filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="p-3 rounded-xl bg-[#F5F4F2] border border-[#E5E4E2] hover:border-[#D9D8D6] transition-all group hover:bg-white/90"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded bg-[#F5F4F2] text-[10px] text-[#1A1A1A] border border-[#E5E4E2] font-medium">
                      {template.category}
                    </span>
                    <span className="text-[10px] text-[#666666] font-serif truncate max-w-[180px]">
                      {template.forum}
                    </span>
                  </div>
                  <h3 className="text-xs font-semibold text-[#1A1A1A] group-hover:text-[#1A1A1A] transition-colors">
                    {template.title}
                  </h3>
                </div>
              </div>

              <p className="text-[11px] text-[#666666] mb-2.5 line-clamp-2 leading-relaxed">
                {template.description}
              </p>

              {/* Tag Chips */}
              <div className="flex flex-wrap gap-1 mb-3">
                {template.tags.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-white text-[#666666] border border-[#E5E4E2]"
                  >
                    #{t}
                  </span>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E5E4E2]/60">
                <button
                  type="button"
                  onClick={() => setPreviewTemplate(template)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[#666666] hover:text-[#2D2D2D] hover:bg-[#F5F4F2] transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  <span>Preview</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onInsertTemplateAtCursor(template)}
                    title="Insert template text at cursor position"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#F5F4F2] hover:bg-[#EBEBEB] text-[#2D2D2D] text-[11px] font-medium border border-[#E5E4E2] transition-colors"
                  >
                    <PlusCircle className="w-3 h-3" />
                    <span>Insert</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLoadTemplate(template)}
                    title="Load this template into the active editor canvas"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#1A1A1A] hover:bg-[#2D2D2D] text-white text-[11px] font-semibold transition-all shadow-sm active:scale-95"
                  >
                    <FolderOpen className="w-3 h-3" />
                    <span>Load Template</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E4E2] rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#E5E4E2] flex items-start justify-between gap-3 bg-white/90">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-[#1A1A1A]/10 text-[#1A1A1A] text-xs font-semibold border border-[#1A1A1A]/20">
                    {previewTemplate.category}
                  </span>
                  <span className="text-xs text-[#666666]">{previewTemplate.governingLaw}</span>
                </div>
                <h2 className="text-base font-bold text-[#1A1A1A] font-serif">
                  {previewTemplate.title}
                </h2>
                <p className="text-xs text-[#666666] mt-0.5">{previewTemplate.forum}</p>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="p-1 rounded-lg text-[#666666] hover:text-[#2D2D2D] hover:bg-[#F5F4F2] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Legal Preview */}
            <div className="p-4 overflow-y-auto flex-1 bg-white/70">
              <div className="p-4 rounded-xl bg-white border border-[#E5E4E2] font-serif text-xs text-[#2D2D2D] leading-relaxed whitespace-pre-wrap select-text">
                {previewTemplate.body}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-[#E5E4E2] bg-white flex items-center justify-between">
              <div className="text-[11px] text-[#666666] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1A1A1A]" />
                <span>Standard Pakistani Legal Drafting Format</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewTemplate(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-[#4A4A4A] hover:bg-[#F5F4F2] border border-[#E5E4E2] transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onLoadTemplate(previewTemplate);
                    setPreviewTemplate(null);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#2D2D2D] text-white text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  Load into Studio Editor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

