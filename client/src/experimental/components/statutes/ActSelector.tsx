/**
 * ============================================================================
 * ACT & ENACTMENT SELECTOR (ActSelector.tsx)
 * Strictly isolated in client/src/experimental/
 * ============================================================================
 * Provides:
 * 1. Major Enactment Quick Picker chips (PPC, CrPC, Constitution, CPC, SRA, etc.)
 * 2. Searchable modal/popover directory for all 5,887 Pakistani Acts from ACTS_MANIFEST.
 * 3. Instant category filtering and section count badges.
 * ============================================================================
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  BookOpen,
  Search,
  ChevronDown,
  X,
  Layers,
  Scale,
  ShieldAlert,
  Landmark,
  Building2,
  FileCheck,
  Users,
  Cpu,
  Coins,
  Check,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACTS_MANIFEST,
  TOTAL_PAKISTANI_ACTS_COUNT,
  type ActManifestItem,
} from "../../data/actsManifest";
import {
  MAJOR_ENACTMENT_METAS,
  type MajorEnactmentMeta,
} from "../../data/majorEnactmentsData";

export interface ActSelectorProps {
  selectedStatute: string;
  onSelectAct: (statuteTitle: string, shortCode?: string) => void;
  className?: string;
}

export const ActSelector: React.FC<ActSelectorProps> = ({
  selectedStatute,
  onSelectAct,
  className,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isModalOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 80);
    }
  }, [isModalOpen]);

  // Categories list with counts
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const act of ACTS_MANIFEST) {
      const cat = act.category || "other";
      map.set(cat, (map.get(cat) || 0) + 1);
    }
    return [
      { id: "all", label: "All Acts", count: ACTS_MANIFEST.length },
      ...Array.from(map.entries()).map(([id, count]) => ({
        id,
        label: id.charAt(0).toUpperCase() + id.slice(1),
        count,
      })),
    ];
  }, []);

  // Filtered 5,887 Acts list
  const filteredActs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return ACTS_MANIFEST.filter((act) => {
      if (selectedCategory !== "all" && act.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        act.title.toLowerCase().includes(q) ||
        (act.shortCode && act.shortCode.toLowerCase().includes(q)) ||
        (act.year && act.year.toString().includes(q)) ||
        act.category.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, selectedCategory]);

  const handleSelect = (title: string, shortCode?: string) => {
    onSelectAct(title, shortCode);
    setIsModalOpen(false);
    setSearchQuery("");
  };

  return (
    <div className={cn("space-y-2.5", className)}>
      {/* Top Bar: Quick Enactment Chips & Browse 5,887 Acts Button */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <BookOpen className="h-3.5 w-3.5 text-emerald-600" />
          <span>Major Pakistani Enactments:</span>
        </div>

        {/* Browse All 5,887 Acts Trigger */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-800 transition-all"
        >
          <Search className="h-3 w-3 text-slate-500" />
          <span>Browse All 5,887 Acts</span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600">
            {TOTAL_PAKISTANI_ACTS_COUNT.toLocaleString()}
          </span>
          <ChevronDown className="h-3 w-3 text-slate-400" />
        </button>
      </div>

      {/* Horizontal Scrolling Quick Enactment Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200">
        {MAJOR_ENACTMENT_METAS.map((meta) => {
          const isSelected =
            selectedStatute.toLowerCase() === meta.statute.toLowerCase() ||
            selectedStatute.toLowerCase().includes(meta.shortCode.toLowerCase());

          return (
            <button
              key={meta.shortCode}
              type="button"
              onClick={() => handleSelect(meta.statute, meta.shortCode)}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                isSelected
                  ? "bg-[#1B365D] text-white shadow-xs ring-1 ring-[#1B365D]"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60"
              )}
              title={`${meta.statute} (${meta.count} Sections)`}
            >
              <span className="font-bold">{meta.shortCode}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] font-semibold",
                  isSelected
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-600"
                )}
              >
                {meta.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 5,887 Acts Search & Selection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Pakistani Acts & Statutes Directory
                  </h3>
                  <p className="text-xs text-slate-500">
                    Complete catalog of {TOTAL_PAKISTANI_ACTS_COUNT.toLocaleString()} Pakistani statutory enactments (83,117 sections)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Search Input & Category Filter */}
            <div className="border-b border-slate-100 p-4 space-y-3 bg-white">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 5,887 Acts by name, year, or acronym (e.g. Penal Code, 1898, Companies, PECA)..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/50 pl-9 pr-8 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200 text-xs">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1 font-medium transition-colors",
                      selectedCategory === cat.id
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    <span>{cat.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 text-[10px]",
                        selectedCategory === cat.id
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 text-slate-600"
                      )}
                    >
                      {cat.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Acts List */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
              <div className="mb-2 text-xs font-semibold text-slate-500">
                Found {filteredActs.length.toLocaleString()} matching Acts
              </div>

              {filteredActs.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    No Pakistani Acts matching &ldquo;{searchQuery}&rdquo;
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Try another keyword or reset the category filter.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {filteredActs.slice(0, 150).map((act) => {
                    const isSelected =
                      selectedStatute.toLowerCase() === act.title.toLowerCase();

                    return (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => handleSelect(act.title, act.shortCode)}
                        className={cn(
                          "flex flex-col items-start justify-between rounded-xl border p-3 text-left transition-all",
                          isSelected
                            ? "border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500 shadow-xs"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 shadow-2xs"
                        )}
                      >
                        <div className="flex w-full items-start justify-between gap-1.5">
                          <span className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                            {act.title}
                          </span>
                          {isSelected && (
                            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          {act.shortCode && (
                            <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-800">
                              {act.shortCode}
                            </span>
                          )}
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600 capitalize">
                            {act.category}
                          </span>
                          {act.year && <span>{act.year}</span>}
                          <span>•</span>
                          <span className="font-semibold text-slate-700">
                            {act.sectionCount} {act.sectionCount === 1 ? "section" : "sections"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing top results from <strong>{TOTAL_PAKISTANI_ACTS_COUNT.toLocaleString()}</strong> official enactments
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
