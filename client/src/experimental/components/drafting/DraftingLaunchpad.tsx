import React, { useState, useMemo } from "react";
import {
  Sparkles,
  Bot,
  BookOpen,
  Search,
  Scale,
  FileText,
  Gavel,
  ArrowRight,
  ArrowLeft,
  Plus,
  Building2,
  FileSignature,
  FilePlus,
  Zap,
  Shield,
  Layers,
  ChevronRight,
} from "lucide-react";
import {
  ALL_DRAFTING_TEMPLATES,
  type DraftingTemplate,
  type TemplateCategory,
} from "@/experimental/components/drafting/drafting-data";
import { cn } from "@/lib/utils";

interface DraftingLaunchpadProps {
  onSelectTemplate: (template: DraftingTemplate) => void;
  onStartWithAiBrief: (brief: {
    draftType: "pleading" | "contract";
    forum: string;
    matterTitle: string;
    reliefType: string;
    facts: string;
  }) => Promise<void>;
  onStartBlank: () => void;
  onBackToEditor?: () => void;
  activeTabTitle?: string;
}

export const DraftingLaunchpad: React.FC<DraftingLaunchpadProps> = ({
  onSelectTemplate,
  onStartWithAiBrief,
  onStartBlank,
  onBackToEditor,
  activeTabTitle,
}) => {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>("All");
  const [searchQuery, setSearchQuery] = useState("");

  // AI Brief Form State
  const [draftType, setDraftType] = useState<"pleading" | "contract">("pleading");
  const [forum, setForum] = useState("Lahore High Court, Lahore");
  const [matterTitle, setMatterTitle] = useState("");
  const [reliefType, setReliefType] = useState("Writ Petition (Article 199)");
  const [facts, setFacts] = useState("");
  const [isInitializingAi, setIsInitializingAi] = useState(false);

  // Switch presets when changing draft type
  const handleDraftTypeChange = (type: "pleading" | "contract") => {
    setDraftType(type);
    if (type === "contract") {
      setForum("Laws of Pakistan (Sindh Jurisdiction)");
      setReliefType("Service Agreement");
      setMatterTitle("");
      setFacts("");
    } else {
      setForum("Lahore High Court, Lahore");
      setReliefType("Writ Petition (Article 199)");
      setMatterTitle("");
      setFacts("");
    }
  };

  const categories: { label: string; value: TemplateCategory; count: number }[] = [
    { label: "All", value: "All", count: ALL_DRAFTING_TEMPLATES.length },
    {
      label: "High Court",
      value: "High Court",
      count: ALL_DRAFTING_TEMPLATES.filter((t) => t.category === "High Court").length,
    },
    {
      label: "Supreme Court",
      value: "Supreme Court",
      count: ALL_DRAFTING_TEMPLATES.filter((t) => t.category === "Supreme Court").length,
    },
    {
      label: "Civil Court",
      value: "Civil Court",
      count: ALL_DRAFTING_TEMPLATES.filter((t) => t.category === "Civil Court").length,
    },
    {
      label: "Sessions & Criminal",
      value: "Sessions & Criminal",
      count: ALL_DRAFTING_TEMPLATES.filter((t) => t.category === "Sessions & Criminal").length,
    },
    {
      label: "Family & Personal",
      value: "Family & Personal",
      count: ALL_DRAFTING_TEMPLATES.filter((t) => t.category === "Family & Personal").length,
    },
    {
      label: "Commercial Contracts",
      value: "Commercial Contracts",
      count: ALL_DRAFTING_TEMPLATES.filter((t) => t.category === "Commercial Contracts").length,
    },
    {
      label: "Affidavits & Notices",
      value: "Affidavits & Notices",
      count: ALL_DRAFTING_TEMPLATES.filter((t) => t.category === "Affidavits & Notices").length,
    },
  ];

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return ALL_DRAFTING_TEMPLATES.filter((t) => {
      const matchCat = activeCategory === "All" || t.category === activeCategory;
      const matchSearch =
        t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [activeCategory, searchQuery]);

  const handleLaunchAiBrief = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matterTitle.trim() && !facts.trim()) return;

    setIsInitializingAi(true);
    try {
      await onStartWithAiBrief({
        draftType,
        forum,
        matterTitle: matterTitle || reliefType,
        reliefType,
        facts,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsInitializingAi(false);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-[#F8FAFC] dark:bg-[#0B131E] p-4 sm:p-6 lg:p-8 custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ── Top Header ────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-[#131E2E] p-6 rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20">
                <FileSignature className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#105B38]">
                Alwakeelo Drafting Studio
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
              What are you drafting today?
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-1 max-w-2xl">
              Select a verified Pakistani court template or brief the AI on your matter so
              statutory rules, court formatting, and precedent grounds are pre-configured.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {onBackToEditor && (
              <button
                type="button"
                onClick={onBackToEditor}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#131E2E] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] border border-[#CBD5E1] text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] transition-all shadow-xs"
                title="Return to currently open drafting canvas"
              >
                <ArrowLeft className="w-4 h-4 text-[#105B38]" />
                <span>Return to Active Draft{activeTabTitle ? ` (${activeTabTitle})` : ""}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onStartBlank}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-bold text-[#334155] dark:text-[#CBD5E1] transition-all shadow-xs"
            >
              <FilePlus className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]" />
              <span>Blank Court Sheet (8.5×14&quot;)</span>
            </button>
          </div>
        </div>

        {/* ── Option 1: AI-Guided Pleading Brief (Tell AI What You're Drafting) ── */}
        <div className="bg-white dark:bg-[#131E2E] rounded-2xl border border-emerald-200 dark:border-emerald-500/20/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-emerald-50/5 dark:bg-emerald-500/100 dark:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#105B38] text-white shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Option 1: Brief the AI (Draft from Scratch)
                </h2>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                  AI initializes court headers, party designations, grounds, and prayer.
                </p>
              </div>
            </div>

            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100/70 text-[#105B38] text-[11px] font-bold">
              <Sparkles className="w-3 h-3" />
              AI Automated
            </span>
          </div>

          <form onSubmit={handleLaunchAiBrief} className="p-6 space-y-4">
            <div className="flex gap-2 mb-4 bg-[#F8FAFC] dark:bg-[#0B131E] p-1 rounded-lg w-fit border border-[#E2E8F0] dark:border-[#1E2D44]">
              <button
                type="button"
                onClick={() => handleDraftTypeChange("pleading")}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                  draftType === "pleading"
                    ? "bg-white dark:bg-[#131E2E] text-[#105B38] shadow-sm border border-[#E2E8F0] dark:border-[#1E2D44]"
                    : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
                }`}
              >
                Court Pleadings
              </button>
              <button
                type="button"
                onClick={() => handleDraftTypeChange("contract")}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                  draftType === "contract"
                    ? "bg-white dark:bg-[#131E2E] text-[#105B38] shadow-sm border border-[#E2E8F0] dark:border-[#1E2D44]"
                    : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
                }`}
              >
                Commercial Contracts
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Judicial Forum / Governing Law */}
              <div>
                <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] block mb-1">
                  {draftType === "pleading" ? "Court / Judicial Forum" : "Governing Law / Jurisdiction"}
                </label>
                {draftType === "pleading" ? (
                  <select
                    value={forum}
                    onChange={(e) => setForum(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#105B38]"
                  >
                    <option value="Lahore High Court, Lahore">Lahore High Court, Lahore</option>
                    <option value="Sindh High Court, Karachi">Sindh High Court, Karachi</option>
                    <option value="Islamabad High Court, Islamabad">Islamabad High Court, Islamabad</option>
                    <option value="Peshawar High Court, Peshawar">Peshawar High Court, Peshawar</option>
                    <option value="High Court of Balochistan, Quetta">High Court of Balochistan, Quetta</option>
                    <option value="Supreme Court of Pakistan">Supreme Court of Pakistan</option>
                    <option value="Court of Senior Civil Judge, Lahore">Court of Senior Civil Judge (Civil)</option>
                    <option value="Court of Judge Family Court">Family Court</option>
                    <option value="Court of Sessions Judge / Criminal">Sessions / Magistrate Court</option>
                  </select>
                ) : (
                  <input
                    value={forum}
                    onChange={(e) => setForum(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#105B38]"
                    placeholder="e.g. Laws of Pakistan"
                  />
                )}
              </div>

              {/* Relief Type / Contract Type */}
              <div>
                <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] block mb-1">
                  {draftType === "pleading" ? "Relief / Petition Type" : "Contract / Agreement Type"}
                </label>
                <input
                  type="text"
                  placeholder={draftType === "pleading" ? "e.g. Writ Petition, Bail Before Arrest" : "e.g. Non-Disclosure Agreement"}
                  value={reliefType}
                  onChange={(e) => setReliefType(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:text-[#475569] focus:outline-none focus:border-[#105B38]"
                />
              </div>

              {/* Matter Title / Agreement Name */}
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] block mb-1">
                  {draftType === "pleading" ? "Matter Title (Optional)" : "Agreement Name (Optional)"}
                </label>
                <input
                  type="text"
                  placeholder={draftType === "pleading" ? "e.g. Challenging arbitrary suspension order" : "e.g. Software Dev Agreement"}
                  value={matterTitle}
                  onChange={(e) => setMatterTitle(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:text-[#475569] focus:outline-none focus:border-[#105B38]"
                />
              </div>
            </div>

            {/* Factual Matrix / Key Terms */}
            <div>
              <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center justify-between mb-1">
                <span>{draftType === "pleading" ? "Factual Matrix / Brief Facts" : "Key Terms & Obligations"}</span>
                <span className="text-[10px] font-medium text-[#94A3B8] dark:text-[#475569]">Shift + Enter for new line</span>
              </label>
              <textarea
                placeholder={draftType === "pleading" ? "Describe the timeline of events, impugned orders, and core grievances...\n(e.g., The respondent issued a show-cause notice on 15th August without providing a hearing...)" : "Describe payment terms, obligations, IP rights, confidentiality...\n(e.g., Party A will pay 500k PKR upon delivery. All IP belongs to Party A.)"}
                value={facts}
                onChange={(e) => setFacts(e.target.value)}
                rows={2}
                className="w-full p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:text-[#475569] focus:outline-none focus:border-[#105B38] resize-none"
              />
            </div>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={isInitializingAi}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isInitializingAi
                    ? "Formulating Court Pleading..."
                    : "Initialize AI Drafting Studio"}
                </span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </form>
        </div>

        {/* ── Option 2: Choose from 45+ Pakistani Templates ─────────────────── */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#105B38]" />
                <span>Option 2: Select from 45+ Verified Court Templates</span>
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-0.5">
                Standard high court & civil court formats with pre-filled statutory provisions.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-[#94A3B8] dark:text-[#475569] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates (e.g. bail, writ, lease)..."
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:text-[#475569] focus:outline-none focus:border-[#105B38]"
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
            {categories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setActiveCategory(cat.value)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5",
                  activeCategory === cat.value
                    ? "bg-[#105B38] text-white shadow-xs"
                    : "bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E]"
                )}
              >
                <span>{cat.label}</span>
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px]",
                    activeCategory === cat.value
                      ? "bg-white dark:bg-[#131E2E]/20 text-white"
                      : "bg-[#F1F5F9] dark:bg-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"
                  )}
                >
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          {/* Template Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                onClick={() => onSelectTemplate(template)}
                className="group p-4 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] hover:border-[#105B38] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20">
                      {template.category}
                    </span>

                    <span className="text-[10px] text-[#94A3B8] dark:text-[#475569] font-mono">
                      ~{Math.ceil(template.body.split(/\s+/).length / 280)} pgs
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#105B38] transition-colors leading-snug line-clamp-2">
                    {template.title}
                  </h3>

                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] font-serif line-clamp-2 mt-2 leading-relaxed">
                    {template.body.slice(0, 140)}...
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs text-[#105B38] font-bold">
                  <span>Start with this template</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
