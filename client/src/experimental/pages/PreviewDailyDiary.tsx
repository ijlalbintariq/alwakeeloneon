import React, { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PreviewShell } from "@/experimental/components/PreviewShell";
import {
  CalendarDays,
  Clock,
  Plus,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  CheckCircle2,
  Circle,
  Gavel,
  AlertTriangle,
  FileText,
  Briefcase,
  Sparkles,
  Trash2,
  Loader2,
  RefreshCw,
  ArrowRight,
  Pencil,
  AlertCircle,
  Filter,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { GoogleCalendarButton } from "@/components/google-calendar-button";
import { CalendarSyncPanel } from "@/experimental/components/diary/CalendarSyncPanel";
import { PostHearingOutcomeModal, DiaryHearingItem } from "@/experimental/components/diary/PostHearingOutcomeModal";
import { AddDiaryEntryModal } from "@/experimental/components/diary/AddDiaryEntryModal";

const PRIORITY_CARD_STYLES: Record<string, string> = {
  urgent: "bg-rose-50/5 dark:bg-rose-500/100 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 hover:border-rose-300 dark:border-rose-500/30 shadow-xs",
  high: "bg-amber-50/5 dark:bg-amber-500/100 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 hover:border-amber-300 dark:border-amber-500/30",
  normal: "bg-white dark:bg-[#131E2E] border-[#E2E8F0] dark:border-[#1E2D44] hover:border-[#105B38]/30",
  low: "bg-white dark:bg-[#131E2E] border-[#E2E8F0] dark:border-[#1E2D44] hover:border-[#105B38]/30",
};

const PRIORITY_BADGES: Record<string, string> = {
  urgent: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20 font-bold animate-pulse",
  high: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 font-bold",
  normal: "bg-[#F1F5F9] dark:bg-[#1E2D44] text-[#475569] border-[#E2E8F0] dark:border-[#1E2D44]",
  low: "bg-white dark:bg-[#131E2E] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] border-[#E2E8F0] dark:border-[#1E2D44]",
};

function formatDateHeading(dStr: string): string {
  const date = new Date(dStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return "Today's Cause List";
  if (date.getTime() === tomorrow.getTime()) return "Tomorrow's Cause List";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getWeekDates(baseDate: Date): string[] {
  const start = new Date(baseDate);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day of week
  start.setDate(diff);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export const PreviewDailyDiary: React.FC = () => {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [weekBase, setWeekBase] = useState<Date>(new Date());
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [outcomeModalItem, setOutcomeModalItem] = useState<DiaryHearingItem | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const weekDates = useMemo(() => getWeekDates(weekBase), [weekBase]);
  const weekFrom = weekDates[0];
  const weekTo = weekDates[6];

  // 1. Fetch Diary & Compliance items for week
  const { data: items = [], isLoading } = useQuery<DiaryHearingItem[]>({
    queryKey: ["/api/diary", weekFrom, weekTo],
    queryFn: async () => {
      const res = await fetch(`/api/diary?from=${weekFrom}&to=${weekTo}`, {
        credentials: "include",
      });
      return res.json();
    },
  });

  // 2. Completed toggle mutation
  const toggleCompleteMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: number; completed: boolean }) => {
      return apiRequest("PATCH", `/api/diary/${id}`, { completed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/diary"] });
    },
  });

  // 3. Delete diary entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/diary/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/diary"] });
      toast({ title: "Diary entry deleted" });
    },
  });

  // Day counts mapping
  const dayCounts = useMemo(() => {
    const map: Record<string, { total: number; urgent: number }> = {};
    items.forEach((i) => {
      if (!map[i.date]) map[i.date] = { total: 0, urgent: 0 };
      map[i.date].total += 1;
      if (i.priority === "urgent" || i.priority === "high") {
        map[i.date].urgent += 1;
      }
    });
    return map;
  }, [items]);

  // Filter items for selected day
  const dayItems = useMemo(() => {
    return items
      .filter((i) => i.date === selectedDate)
      .filter((i) => {
        if (priorityFilter === "all") return true;
        return i.priority === priorityFilter;
      })
      .sort((a, b) => (a.time || "09:00").localeCompare(b.time || "09:00"));
  }, [items, selectedDate, priorityFilter]);

  const totalHearingsThisWeek = items.length;
  const urgentHearingsThisWeek = items.filter(
    (i) => i.priority === "urgent" || i.priority === "high"
  ).length;
  const completedHearingsThisWeek = items.filter((i) => i.completed).length;

  // Check for overdue items (past dates with uncompleted items)
  const overdueCount = useMemo(() => {
    return items.filter((i) => i.date < today && !i.completed).length;
  }, [items, today]);

  const prevWeek = () => {
    const d = new Date(weekBase);
    d.setDate(d.getDate() - 7);
    setWeekBase(d);
  };

  const nextWeek = () => {
    const d = new Date(weekBase);
    d.setDate(d.getDate() + 7);
    setWeekBase(d);
  };

  const jumpToToday = () => {
    setWeekBase(new Date());
    setSelectedDate(today);
  };

  return (
    <PreviewShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 1. Header Banner */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#105B38]" />
              <span>Daily Court Diary & Cause Lists</span>
            </h1>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-0.5">
              Live judicial hearings schedule with Supreme Court, LHC, and SHC cause list synchronization
            </p>
          </div>

          {/* Header Actions & Quick Metrics */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-semibold">
              <span className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                Weekly: <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{totalHearingsThisWeek}</strong>
              </span>
              <span className="text-[#CBD5E1]">|</span>
              <span className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                Urgent: <strong className="text-rose-600 dark:text-rose-400">{urgentHearingsThisWeek}</strong>
              </span>
              <span className="text-[#CBD5E1]">|</span>
              <span className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                Completed: <strong className="text-[#105B38]">{completedHearingsThisWeek}</strong>
              </span>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white font-bold text-xs transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Hearing</span>
            </button>
          </div>
        </div>

        {/* 2. Dual Calendar Sync Hub Banner */}
        <CalendarSyncPanel />

        {/* 3. Interactive Weekly Strip */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs space-y-4">
          {/* Strip Header Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={prevWeek}
                className="p-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] border border-[#E2E8F0] dark:border-[#1E2D44] transition-colors"
                title="Previous Week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {new Date(weekFrom + "T00:00:00").toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}{" "}
                —{" "}
                {new Date(weekTo + "T00:00:00").toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <button
                onClick={nextWeek}
                className="p-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] border border-[#E2E8F0] dark:border-[#1E2D44] transition-colors"
                title="Next Week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {overdueCount > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 text-xs font-bold">
                  <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                  <span>{overdueCount} Overdue Hearing{overdueCount > 1 ? "s" : ""}</span>
                </span>
              )}

              {selectedDate !== today && (
                <button
                  onClick={jumpToToday}
                  className="px-3 py-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-bold border border-[#E2E8F0] dark:border-[#1E2D44] transition-colors"
                >
                  Jump to Today
                </button>
              )}
            </div>
          </div>

          {/* 7-Day Buttons Grid */}
          <div className="grid grid-cols-7 gap-2 sm:gap-3">
            {weekDates.map((dateStr) => {
              const d = new Date(dateStr + "T00:00:00");
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              const counts = dayCounts[dateStr] || { total: 0, urgent: 0 };
              const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
              const dayNum = d.getDate();

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    "flex flex-col items-center py-3 rounded-2xl border transition-all relative",
                    isSelected
                      ? "bg-[#105B38] text-white border-[#105B38] font-bold shadow-xs scale-[1.02]"
                      : isToday
                      ? "bg-emerald-50/6 dark:bg-emerald-500/100 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-[#105B38] hover:bg-emerald-100/50"
                      : "bg-[#F8FAFC] dark:bg-[#0B131E] border-[#E2E8F0] dark:border-[#1E2D44] text-[#475569] hover:bg-white dark:bg-[#131E2E] hover:border-[#CBD5E1]"
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] uppercase font-mono tracking-wider font-bold",
                      isSelected ? "text-white" : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"
                    )}
                  >
                    {weekday}
                  </span>
                  <span
                    className={cn(
                      "text-base sm:text-lg font-bold",
                      isSelected ? "text-white" : isToday ? "text-[#105B38]" : "text-[#0F172A] dark:text-[#F8FAFC]"
                    )}
                  >
                    {dayNum}
                  </span>

                  {/* Dot Indicators */}
                  <div className="flex items-center gap-1 mt-1 h-2">
                    {counts.total > 0 &&
                      Array.from({ length: Math.min(counts.total, 4) }).map((_, idx) => (
                        <span
                          key={idx}
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            isSelected
                              ? "bg-white dark:bg-[#131E2E]"
                              : counts.urgent > 0 && idx === 0
                              ? "bg-rose-500 animate-pulse"
                              : "bg-[#105B38]"
                          )}
                        />
                      ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Selected Day Hearing Agenda */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {formatDateHeading(selectedDate)}
              </h2>
              <span className="text-xs font-mono text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                ({dayItems.length} hearing{dayItems.length === 1 ? "" : "s"})
              </span>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] text-xs font-bold">Filter:</span>
              {[
                { id: "all", label: "All" },
                { id: "urgent", label: "Red List" },
                { id: "high", label: "High" },
                { id: "normal", label: "Normal" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setPriorityFilter(f.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                    priorityFilter === f.id
                      ? "bg-[#105B38] text-white shadow-xs"
                      : "bg-white dark:bg-[#131E2E] text-[#475569] hover:bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44]"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hearings Cards Grid */}
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
              <Loader2 className="w-6 h-6 animate-spin text-[#105B38]" />
              <span className="text-xs font-mono">Loading court cause list...</span>
            </div>
          ) : dayItems.length === 0 ? (
            <div className="p-12 rounded-2xl bg-white dark:bg-[#131E2E] border border-dashed border-[#E2E8F0] dark:border-[#1E2D44] text-center space-y-3">
              <CalendarDays className="w-10 h-10 text-[#CBD5E1] mx-auto" />
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                No hearings scheduled for {formatDateHeading(selectedDate)}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] max-w-sm mx-auto">
                Add an upcoming court hearing or sync with Supreme Court & High Court cause lists.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white font-bold text-xs shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Schedule Hearing</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dayItems.map((item) => {
                const cardStyle =
                  PRIORITY_CARD_STYLES[item.priority] || PRIORITY_CARD_STYLES.normal;
                const priorityBadge =
                  PRIORITY_BADGES[item.priority] || PRIORITY_BADGES.normal;
                const isOverdue = item.date < today && !item.completed;

                return (
                  <div
                    key={item.id}
                    className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-3.5 ${cardStyle} ${item.completed ? "opacity-60" : ""
                      }`}
                  >
                    <div className="space-y-2.5">
                      {/* Top Header Row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {/* Completed Toggle */}
                          {item.source === "manual" && typeof item.id === "number" && (
                            <button
                              onClick={() =>
                                toggleCompleteMutation.mutate({
                                  id: item.id as number,
                                  completed: !item.completed,
                                })
                              }
                              className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#105B38] transition-colors"
                              title={item.completed ? "Mark Incomplete" : "Mark Completed"}
                            >
                              {item.completed ? (
                                <CheckCircle2 className="w-4 h-4 text-[#105B38]" />
                              ) : (
                                <Circle className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          {/* Time Badge */}
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#F1F5F9] dark:bg-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#1E2D44] text-[11px] font-mono font-bold">
                            <Clock className="w-3 h-3 text-[#105B38]" />
                            <span>{item.time || "09:30 AM"}</span>
                          </span>

                          {/* Priority Badge */}
                          {item.priority !== "normal" && (
                            <span
                              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border ${priorityBadge}`}
                            >
                              {item.priority === "urgent" ? "🚨 Red List" : item.priority}
                            </span>
                          )}
                        </div>

                        {/* Overdue / Source Tag */}
                        <div className="flex items-center gap-1.5">
                          {isOverdue && (
                            <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
                              Overdue
                            </span>
                          )}
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-[#F1F5F9] dark:bg-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] border border-[#E2E8F0] dark:border-[#1E2D44]">
                            {item.source}
                          </span>
                        </div>
                      </div>

                      {/* Case Title & Hearing Stage */}
                      <div>
                        <h3
                          className={`text-sm font-bold ${item.completed ? "line-through text-[#94A3B8] dark:text-[#475569]" : "text-[#0F172A] dark:text-[#F8FAFC]"
                            }`}
                        >
                          {item.title}
                        </h3>

                        {/* Linked Case File */}
                        {(item.caseTitle || item.caseId) && (
                          <div className="mt-1">
                            <Link
                              href="/preview/cases"
                              className="inline-flex items-center gap-1.5 text-xs text-[#105B38] hover:underline font-mono font-semibold"
                            >
                              <Briefcase className="w-3.5 h-3.5" />
                              <span>{item.caseTitle || `Case File #${item.caseId}`}</span>
                            </Link>
                          </div>
                        )}
                      </div>

                      {/* Court Room & Instructions */}
                      {item.description && (
                        <p className="text-xs text-[#475569] bg-[#F8FAFC] dark:bg-[#0B131E] p-3 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44] leading-relaxed">
                          {item.description}
                        </p>
                      )}

                      {/* Post-Hearing Outcome & Chained Next Date */}
                      {(item.outcome || item.nextDate) && (
                        <div className="flex items-center gap-2 pt-1 flex-wrap text-xs">
                          {item.outcome && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20 font-mono font-bold text-[11px]">
                              <Gavel className="w-3 h-3" />
                              <span>Outcome: {item.outcome.replace(/_/g, " ").toUpperCase()}</span>
                            </span>
                          )}

                          {item.nextDate && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#1E2D44] font-mono text-[11px] font-semibold">
                              <ArrowRight className="w-3 h-3 text-[#105B38]" />
                              <span>
                                Next:{" "}
                                {new Date(item.nextDate + "T00:00:00").toLocaleDateString(
                                  undefined,
                                  { month: "short", day: "numeric" }
                                )}
                              </span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Strip */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0] dark:border-[#1E2D44] text-xs">
                      {/* Log Outcome Button */}
                      <button
                        onClick={() => setOutcomeModalItem(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-semibold transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Log Outcome & Next Date</span>
                      </button>

                      {/* Calendar Sync & Delete */}
                      <div className="flex items-center gap-1.5">
                        <GoogleCalendarButton
                          event={{
                            title: item.title,
                            caseTitle: item.caseTitle,
                            fixationPurpose: item.description || item.outcome,
                            date: item.date,
                            time: item.time,
                            isRedList: item.priority === "urgent",
                          }}
                          size="sm"
                          variant="outline"
                          className="bg-white dark:bg-[#131E2E] border-[#E2E8F0] dark:border-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] text-xs rounded-xl"
                        />

                        {item.source === "manual" && typeof item.id === "number" && (
                          <button
                            onClick={() => deleteEntryMutation.mutate(item.id as number)}
                            disabled={deleteEntryMutation.isPending}
                            title="Delete Entry"
                            className="p-2 rounded-xl text-[#94A3B8] dark:text-[#475569] hover:text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Diary Entry Modal */}
      {showAddModal && (
        <AddDiaryEntryModal
          initialDate={selectedDate}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Post-Hearing Outcome Modal */}
      {outcomeModalItem && (
        <PostHearingOutcomeModal
          item={outcomeModalItem}
          onClose={() => setOutcomeModalItem(null)}
        />
      )}
    </PreviewShell>
  );
};
export default PreviewDailyDiary;
