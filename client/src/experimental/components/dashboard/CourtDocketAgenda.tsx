import React, { useState } from "react";
import { Link } from "wouter";
import {
  Clock,
  CalendarDays,
  Gavel,
  Plus,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Building,
  Sparkles,
  ArrowRight,
  Calendar,
  Filter,
} from "lucide-react";
import { OutcomeLoggerModal, type DiaryEntryItem } from "./OutcomeLoggerModal";
import { AddHearingModal } from "./AddHearingModal";

interface CourtDocketAgendaProps {
  todayAgenda?: DiaryEntryItem[];
  upcomingCompliance?: any[];
  caseFiles?: any[];
  todayStr: string;
  isLoading?: boolean;
}

export const CourtDocketAgenda: React.FC<CourtDocketAgendaProps> = ({
  todayAgenda = [],
  upcomingCompliance = [],
  caseFiles = [],
  todayStr,
  isLoading = false,
}) => {
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntryItem | null>(null);
  const [outcomeModalOpen, setOutcomeModalOpen] = useState<boolean>(false);
  const [addHearingOpen, setAddHearingOpen] = useState<boolean>(false);
  const [filterView, setFilterView] = useState<"today" | "all">("today");

  const handleOpenOutcome = (item: DiaryEntryItem) => {
    setSelectedEntry(item);
    setOutcomeModalOpen(true);
  };

  // Combine or filter items
  const displayItems = filterView === "today" ? todayAgenda : [
    ...todayAgenda,
    ...upcomingCompliance.map((c) => ({
      id: `comp-${c.id}`,
      source: "compliance",
      date: new Date(c.dueDate).toISOString().slice(0, 10),
      time: "10:00 AM",
      title: c.title,
      description: `${c.type?.replace(/_/g, " ")}${c.court ? ` • ${c.court}` : ""}`,
      caseId: c.caseId,
      caseTitle: c.caseTitle,
      priority: c.type === "hearing" ? "high" : "normal",
      completed: c.status === "done",
      status: c.status,
      type: c.type,
    })),
  ];

  // Group items by Court / Forum
  const groupedByCourt: Record<string, DiaryEntryItem[]> = {};
  displayItems.forEach((item) => {
    let courtKey = "High Court / Principal Seat";
    const desc = (item.description || "").toLowerCase();
    const title = (item.title || "").toLowerCase();
    const caseTitle = (item.caseTitle || "").toLowerCase();
    const full = `${desc} ${title} ${caseTitle}`;

    if (full.includes("supreme court") || full.includes("scmr") || full.includes("scp")) {
      courtKey = "Supreme Court of Pakistan";
    } else if (full.includes("lahore high court") || full.includes("lhc")) {
      courtKey = "Lahore High Court (Principal Seat & Benches)";
    } else if (full.includes("sindh high court") || full.includes("shc")) {
      courtKey = "Sindh High Court (Karachi Bench)";
    } else if (full.includes("islamabad high court") || full.includes("ihc")) {
      courtKey = "Islamabad High Court";
    } else if (full.includes("district") || full.includes("sessions") || full.includes("civil")) {
      courtKey = "District & Sessions Courts";
    } else if (full.includes("banking") || full.includes("tax") || full.includes("nab") || full.includes("anti-terrorism")) {
      courtKey = "Special Tribunals & Banking Courts";
    }

    if (!groupedByCourt[courtKey]) {
      groupedByCourt[courtKey] = [];
    }
    groupedByCourt[courtKey].push(item);
  });

  const courtKeys = Object.keys(groupedByCourt);

  return (
    <div className="relative rounded-2xl border border-[#E5E4E2]/90 bg-[#F5F4F2] p-5 sm:p-6 backdrop-blur-sm shadow-xl flex flex-col justify-between">
      <div>
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-[#E5E4E2]">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#1A1A1A] mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span>TODAY'S COURT DOCKET & CAUSE LIST</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold font-serif text-[#1A1A1A] flex items-center gap-2">
              <span>Court Hearing Agenda</span>
              <span className="text-xs font-mono font-normal text-[#666666]">
                (Asia/Karachi PKT)
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg bg-white p-0.5 border border-[#E5E4E2] text-xs">
              <button
                onClick={() => setFilterView("today")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  filterView === "today"
                    ? "bg-[#1A1A1A]/10 text-[#1A1A1A] font-bold border border-[#1A1A1A]/30"
                    : "text-[#666666] hover:text-[#2D2D2D]"
                }`}
              >
                Today ({todayAgenda.length})
              </button>
              <button
                onClick={() => setFilterView("all")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  filterView === "all"
                    ? "bg-[#1A1A1A]/10 text-[#1A1A1A] font-bold border border-[#1A1A1A]/30"
                    : "text-[#666666] hover:text-[#2D2D2D]"
                }`}
              >
                All Docket
              </button>
            </div>

            <button
              onClick={() => setAddHearingOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1A1A1A]/5 hover:bg-[#2D2D2D]/10 border border-[#1A1A1A]/20 text-[#1A1A1A] text-xs font-semibold transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule</span>
            </button>
          </div>
        </div>

        {/* Docket Hearing List */}
        {isLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-white border border-[#E5E4E2] animate-pulse"
              />
            ))}
          </div>
        ) : displayItems.length === 0 ? (
          <div className="py-10 text-center space-y-3 rounded-xl bg-white border border-dashed border-[#E5E4E2]">
            <div className="h-10 w-10 mx-auto rounded-full bg-[#F5F4F2] flex items-center justify-center text-[#666666]">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#2D2D2D]">
                No Hearings Scheduled for Today
              </p>
              <p className="text-xs text-[#666666] max-w-sm mx-auto">
                Chambers cause list is clear. You can schedule new appearances or review upcoming deadlines.
              </p>
            </div>
            <button
              onClick={() => setAddHearingOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#2D2D2D] text-white font-bold text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Court Hearing</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {courtKeys.map((courtName) => (
              <div key={courtName} className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#4A4A4A] font-serif">
                  <Building className="w-3.5 h-3.5 text-[#1A1A1A]" />
                  <span>{courtName}</span>
                  <span className="text-[10px] font-mono text-[#666666]">
                    ({groupedByCourt[courtName].length} matters)
                  </span>
                </div>

                <div className="space-y-2">
                  {groupedByCourt[courtName].map((item) => {
                    const isPriorityUrgent =
                      item.priority === "urgent" ||
                      item.title.toLowerCase().includes("urgent") ||
                      item.title.toLowerCase().includes("stay");

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          item.completed
                            ? "bg-white border-[#E5E4E2]/50 opacity-65"
                            : "bg-black/20 border-[#E5E4E2]/90 hover:border-[#D9D8D6]"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                                isPriorityUrgent
                                  ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                                  : item.priority === "high"
                                  ? "bg-[#1A1A1A]/8 text-[#1A1A1A] border border-[#1A1A1A]/20"
                                  : "bg-emerald-500/15 text-[#1A1A1A] border border-[#E5E4E2]"
                              }`}
                            >
                              {item.priority || "Regular"}
                            </span>

                            {item.time && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#666666] bg-white px-2 py-0.5 rounded border border-[#E5E4E2]">
                                <Clock className="w-3 h-3 text-[#1A1A1A]" />
                                <span>{item.time}</span>
                              </span>
                            )}

                            {item.completed && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#1A1A1A] bg-[#F5F4F2] px-2 py-0.5 rounded border border-[#E5E4E2]">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Concluded</span>
                              </span>
                            )}
                          </div>

                          {/* Quick Outcome Action */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenOutcome(item)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1A1A1A] hover:text-[#1A1A1A] px-2.5 py-1 rounded bg-[#1A1A1A]/5 border border-[#1A1A1A]/15 hover:border-[#D9D8D6] transition-colors"
                            >
                              <Gavel className="w-3 h-3" />
                              <span>{item.outcome ? "Edit Outcome" : "Log Outcome"}</span>
                            </button>
                          </div>
                        </div>

                        {/* Title and details */}
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold text-[#1A1A1A] font-serif">
                            {item.title}
                          </h4>

                          {item.caseTitle && (
                            <p className="text-xs text-[#1A1A1A]/80 font-mono">
                              Matter: {item.caseTitle}
                            </p>
                          )}

                          {item.description && (
                            <p className="text-xs text-[#666666] line-clamp-2">
                              {item.description}
                            </p>
                          )}

                          {item.outcome && (
                            <div className="mt-2 p-2 rounded-lg bg-[#1A1A1A]/5 border border-[#1A1A1A]/15 text-xs text-[#666666]">
                              <span className="font-semibold">Recorded Outcome:</span>{" "}
                              {item.outcome}{" "}
                              {item.nextDate && (
                                <span className="font-mono text-[#666666] ml-2">
                                  [Next: {item.nextDate}]
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Link */}
      <div className="pt-4 mt-4 border-t border-[#E5E4E2] flex items-center justify-between text-xs">
        <span className="text-[#666666] font-mono">
          Integrated with Lahore & Supreme Court Cause Lists
        </span>
        <Link
          href="/preview/diary"
          className="inline-flex items-center gap-1 font-semibold text-[#1A1A1A] hover:text-[#1A1A1A]"
        >
          <span>Open Full Diary & Calendar</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Modals */}
      <OutcomeLoggerModal
        entry={selectedEntry}
        isOpen={outcomeModalOpen}
        onClose={() => {
          setOutcomeModalOpen(false);
          setSelectedEntry(null);
        }}
        todayStr={todayStr}
      />

      <AddHearingModal
        isOpen={addHearingOpen}
        onClose={() => setAddHearingOpen(false)}
        cases={caseFiles}
        defaultDate={todayStr}
      />
    </div>
  );
};
