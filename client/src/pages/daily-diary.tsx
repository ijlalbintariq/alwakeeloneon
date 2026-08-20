import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CalendarDays,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Loader2,
  Briefcase,
  Clock,
  CheckCircle2,
  Circle,
  Gavel,
  FileText,
  AlertTriangle,
  ArrowRight,
  Pencil,
  Save,
  X,
  Calendar,
  RefreshCw,
  Check,
  Link2,
  ExternalLink,
  Power,
  Sparkles,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { GoogleCalendarButton } from "@/components/google-calendar-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type DiaryItem = {
  id: number | string;
  source: "manual" | "compliance";
  date: string;
  time?: string | null;
  title: string;
  description?: string | null;
  caseId?: number | null;
  caseTitle?: string | null;
  priority: string;
  completed: boolean;
  type?: string;
  status?: string;
  outcome?: string | null;
  nextDate?: string | null;
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "border-red-500/40 bg-red-500/5",
  high: "border-amber-500/30 bg-amber-500/5",
  normal: "border-border",
  low: "border-border/50",
};
const PRIORITY_DOT: Record<string, string> = { urgent: "bg-red-400", high: "bg-amber-400", normal: "bg-foreground/30", low: "bg-slate-500" };
const OUTCOME_OPTIONS = ["instruction", "arguments", "evidence", "disposed_off", "dnp", "adjourned", "reserved", "dismissed", "allowed", "partly_allowed", "order_passed", "other"] as const;

function formatDateLabel(d: string) {
  const date = new Date(d + "T00:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === tomorrow.getTime()) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function getWeekDates(baseDate: Date): string[] {
  const start = new Date(baseDate);
  start.setDate(start.getDate() - start.getDay() + 1); // Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export default function DailyDiaryPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekBase, setWeekBase] = useState(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState("normal");
  const [newCaseId, setNewCaseId] = useState<number | "">("");
  const [newOutcome, setNewOutcome] = useState("");
  const [newNextDate, setNewNextDate] = useState("");

  // Check URL query parameters for OAuth callbacks
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("calendar_connected") === "true") {
      toast({
        title: "Google Calendar Connected! 📅",
        description: "Your court hearings and diary events will automatically sync.",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get("calendar_error")) {
      toast({
        title: "Google Calendar Connection Failed",
        description: urlParams.get("calendar_error") || "Authentication was cancelled.",
        variant: "destructive",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);

  const weekDates = useMemo(() => getWeekDates(weekBase), [weekBase]);
  const weekFrom = weekDates[0];
  const weekTo = weekDates[6];

  const { data: items = [], isLoading } = useQuery<DiaryItem[]>({
    queryKey: ["/api/diary", weekFrom, weekTo],
    queryFn: async () => {
      const res = await fetch(`/api/diary?from=${weekFrom}&to=${weekTo}`, { credentials: "include" });
      return res.json();
    },
  });
  const { data: caseFiles = [] } = useQuery<Array<{ id: number; title: string; status: string }>>({ queryKey: ["/api/case-files"] });

  // Google Calendar Integration Status Query
  const { data: calStatus, refetch: refetchCalStatus, isLoading: isCalLoading } = useQuery<{
    isConnected: boolean;
    email?: string;
    autoSyncEnabled?: boolean;
  }>({
    queryKey: ["/api/calendar/google/status"],
    queryFn: async () => {
      const res = await fetch("/api/calendar/google/status", { credentials: "include" });
      if (!res.ok) return { isConnected: false };
      return res.json();
    },
  });

  const connectGoogleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/calendar/google/auth-url", { credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to generate Google auth URL");
      }
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: (e: any) =>
      toast({
        title: "Connection Error",
        description: e.message || "Could not start Google OAuth",
        variant: "destructive",
      }),
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/calendar/google/sync-all", {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "Synced to Google Calendar",
        description: `Successfully pushed upcoming hearings to your Google Calendar.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/diary"] });
    },
    onError: (e: any) =>
      toast({
        title: "Sync Failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  const toggleAutoSyncMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest("POST", "/api/calendar/google/toggle-auto-sync", { enabled });
    },
    onSuccess: () => {
      refetchCalStatus();
      toast({ title: "Auto-sync preference updated" });
    },
  });

  const disconnectGoogleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/calendar/google/disconnect", {});
    },
    onSuccess: () => {
      refetchCalStatus();
      toast({ title: "Google Calendar Disconnected" });
    },
  });

  const dayItems = items.filter(i => i.date === selectedDate);
  const dayCounts = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach(i => { map[i.date] = (map[i.date] || 0) + 1; });
    return map;
  }, [items]);

  const addEntry = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/diary", {
        date: selectedDate,
        time: newTime || undefined,
        title: newTitle,
        description: newDesc || undefined,
        caseId: newCaseId || undefined,
        priority: newPriority,
        outcome: newOutcome || undefined,
        nextDate: newNextDate || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/diary"] });
      setNewTitle(""); setNewTime(""); setNewDesc(""); setNewPriority("normal"); setNewCaseId(""); setNewOutcome(""); setNewNextDate("");
      setShowAdd(false);
      toast({ title: "Entry added" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editOutcome, setEditOutcome] = useState("");
  const [editNextDate, setEditNextDate] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const toggleComplete = useMutation({
    mutationFn: async ({ id, completed }: { id: number; completed: boolean }) => {
      await apiRequest("PATCH", `/api/diary/${id}`, { completed });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/diary"] }),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, any> }) => {
      await apiRequest("PATCH", `/api/diary/${id}`, data);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/diary"] });
      if (editNextDate) {
        const editingItem = dayItems.find(i => i.id === vars.id);
        if (editingItem) {
          autoCreateNextDate.mutate({
            date: editNextDate,
            title: editingItem.title,
            caseId: editingItem.caseId || undefined,
            priority: editingItem.priority,
          });
        }
      }
      setEditingId(null);
      setEditOutcome("");
      setEditNextDate("");
      setEditDesc("");
      toast({ title: "Entry updated" });
    },
    onError: (e: any) => toast({ title: "Update failed", description: e?.message, variant: "destructive" }),
  });

  const autoCreateNextDate = useMutation({
    mutationFn: async (entry: { date: string; title: string; caseId?: number; priority: string }) => {
      await apiRequest("POST", "/api/diary", {
        date: entry.date,
        title: entry.title,
        caseId: entry.caseId || undefined,
        priority: entry.priority,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/diary"] });
      toast({ title: "Next hearing auto-added to diary" });
    },
  });

  const startEditing = (item: DiaryItem) => {
    if (typeof item.id !== "number") return;
    setEditingId(item.id);
    setEditOutcome(item.outcome || "");
    setEditNextDate(item.nextDate || "");
    setEditDesc(item.description || "");
  };

  const delEntry = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/diary/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/diary"] }),
  });

  const prevWeek = () => { const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d); };
  const nextWeek = () => { const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d); };

  return (
    <div className="h-full overflow-y-auto rounded-[1.25rem] border border-[hsl(var(--preview-border))] preview-bg text-foreground shadow-2xl">
      <div className="px-5 md:px-8 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] font-black text-foreground/75 mb-1">Lawyer Workspace</p>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Daily <span className="text-primary">Diary</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Your schedule, hearings, and tasks at a glance</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition">
            <Plus size={16} /> Add Entry
          </button>
        </div>

        {/* Google Calendar Integration Plugin Banner */}
        <div className="bg-card/40 border border-border/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">Google Calendar Integration</h3>
                {calStatus?.isConnected ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1">
                    <Check className="w-3 h-3" /> Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Available
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {calStatus?.isConnected
                  ? `Synced to ${calStatus.email || "Google Account"} — auto-syncing hearings with 60m reminders`
                  : "Connect your Google account to automatically sync court hearings directly to your phone"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {calStatus?.isConnected ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => syncAllMutation.mutate()}
                  disabled={syncAllMutation.isPending}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncAllMutation.isPending ? "animate-spin" : ""}`} />
                  Sync All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-red-500"
                  onClick={() => disconnectGoogleMutation.mutate()}
                  disabled={disconnectGoogleMutation.isPending}
                  title="Disconnect Google Calendar"
                >
                  <Power className="w-3.5 h-3.5" />
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-emerald-600/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                onClick={() => connectGoogleMutation.mutate()}
                disabled={connectGoogleMutation.isPending}
              >
                <Link2 className="w-3.5 h-3.5" />
                Connect Google Calendar
              </Button>
            )}
          </div>
        </div>

        {/* Week Strip */}
        <div className="bg-card/50 border border-border rounded-2xl p-3">
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevWeek} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"><ChevronLeft size={18} /></button>
            <p className="text-sm font-bold text-foreground">
              {new Date(weekFrom + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })} — {new Date(weekTo + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </p>
            <button onClick={nextWeek} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {weekDates.map(d => {
              const isToday = d === today;
              const isSelected = d === selectedDate;
              const count = dayCounts[d] || 0;
              const dayLabel = new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" });
              const dayNum = new Date(d + "T00:00:00").getDate();
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className={`flex flex-col items-center py-2 rounded-xl transition-all ${
                    isSelected ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" :
                    isToday ? "bg-primary/10 border border-primary/30 text-primary" :
                    "hover:bg-accent text-foreground"
                  }`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">{dayLabel}</span>
                  <span className="text-lg font-black">{dayNum}</span>
                  {count > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
                        <div key={i} className={`w-1 h-1 rounded-full ${isSelected ? "bg-primary-foreground/60" : "bg-primary/60"}`} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Add Entry Form */}
        {showAdd && (
          <div className="bg-card/30 border border-primary/20 rounded-2xl p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-widest font-black text-primary">New Entry for {formatDateLabel(selectedDate)}</p>
            <input placeholder="What needs to be done? *" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none" />
              <select value={newPriority} onChange={e => setNewPriority(e.target.value)} className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none">
                {["low","normal","high","urgent"].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
              </select>
              <select value={newCaseId} onChange={e => setNewCaseId(e.target.value ? Number(e.target.value) : "")} className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none md:col-span-2">
                <option value="">No case linked</option>
                {caseFiles.filter((c: any) => c.status === "active" || c.status === "pending").map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={newOutcome} onChange={e => setNewOutcome(e.target.value)} className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none">
                <option value="">Outcome / Result</option>
                {OUTCOME_OPTIONS.map(o => <option key={o} value={o}>{o.replace(/_/g, " ").replace(/\bdnp\b/i, "DNP (Dismissed for Non-Prosecution)")}</option>)}
              </select>
              <div className="relative">
                <input type="date" value={newNextDate} onChange={e => setNewNextDate(e.target.value)} className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none w-full" />
                {!newNextDate && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">Next Date</span>}
              </div>
            </div>
            <textarea placeholder="Notes or instructions..." value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-xs text-muted-foreground hover:bg-accent transition">Cancel</button>
              <button onClick={() => addEntry.mutate()} disabled={!newTitle.trim() || addEntry.isPending} className="px-5 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition disabled:opacity-50 flex items-center gap-1.5">
                {addEntry.isPending && <Loader2 size={12} className="animate-spin" />} Save Entry
              </button>
            </div>
          </div>
        )}

        {/* Selected Day View */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              {formatDateLabel(selectedDate)}
              <span className="text-xs font-normal text-muted-foreground">({dayItems.length} {dayItems.length === 1 ? "item" : "items"})</span>
            </h2>
            {selectedDate !== today && (
              <button onClick={() => setSelectedDate(today)} className="text-xs text-primary hover:underline font-bold">Jump to Today</button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading diary...
            </div>
          ) : dayItems.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-2xl space-y-2">
              <CalendarDays className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-semibold text-muted-foreground">No entries for {formatDateLabel(selectedDate)}</p>
              <button onClick={() => setShowAdd(true)} className="text-xs text-primary font-bold hover:underline">Add something</button>
            </div>
          ) : (
            <div className="space-y-2">
              {dayItems.map(item => (
                <div
                  key={item.id}
                  className={`flex flex-col gap-2 p-3 rounded-xl border transition-all ${
                    item.completed ? "opacity-50" : ""
                  } ${PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.normal}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Toggle / indicator */}
                    <div className="mt-0.5">
                      {item.source === "manual" ? (
                        <button
                          onClick={() => typeof item.id === "number" && toggleComplete.mutate({ id: item.id, completed: !item.completed })}
                          className="text-foreground/50 hover:text-primary"
                        >
                          {item.completed ? <CheckCircle2 size={18} className="text-emerald-400" /> : <Circle size={18} />}
                        </button>
                      ) : (
                        item.type === "hearing" ? <Gavel size={18} className="text-red-400" /> :
                        item.type === "filing_deadline" ? <AlertTriangle size={18} className="text-amber-400" /> :
                        <FileText size={18} className="text-primary/60" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {item.time && (
                          <span className="text-[10px] text-foreground/60 flex items-center gap-0.5 font-bold"><Clock size={9} /> {item.time}</span>
                        )}
                        {item.source === "compliance" && (
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-black">{item.type?.replace(/_/g, " ")}</span>
                        )}
                        {(item.caseTitle || item.caseId) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); if (item.caseId) navigate(`/case-files/${item.caseId}`); }}
                            className="text-[10px] text-primary/70 flex items-center gap-0.5 hover:text-primary hover:underline cursor-pointer"
                          ><Briefcase size={9} /> {item.caseTitle || `Case #${item.caseId}`}</button>
                        )}
                        {item.priority !== "normal" && (
                          <span className="flex items-center gap-1 text-[10px] font-bold"><span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[item.priority]}`} />{item.priority}</span>
                        )}
                      </div>
                      {item.description && editingId !== item.id && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
                      {(item.outcome || item.nextDate) && editingId !== item.id && (
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {item.outcome && (
                            <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-black border ${
                              item.outcome === "disposed_off" || item.outcome === "dismissed" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                              item.outcome === "dnp" || item.outcome === "adjourned" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                              "bg-foreground/5 border-border text-foreground/60"
                            }`}>{item.outcome.replace(/_/g, " ")}</span>
                          )}
                          {item.nextDate && (
                            <span className="text-[10px] text-primary/80 flex items-center gap-0.5 font-bold">
                              <ArrowRight size={9} /> Next: {new Date(item.nextDate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <GoogleCalendarButton
                        event={{
                          title: item.title,
                          caseTitle: item.caseTitle,
                          fixationPurpose: item.description || item.outcome,
                          date: item.date,
                          time: item.time,
                          isRedList: item.priority === "urgent",
                        }}
                        size="icon"
                        variant="ghost"
                        showLabel={false}
                        className="h-7 w-7 text-muted-foreground/50 hover:text-emerald-600"
                      />
                      {item.source === "manual" && typeof item.id === "number" && editingId !== item.id && (
                        <button
                          onClick={() => startEditing(item)}
                          className="text-muted-foreground/40 hover:text-primary p-1 mt-0.5"
                          title="Update outcome & next date"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {item.source === "manual" && typeof item.id === "number" && editingId !== item.id && (
                        <button onClick={() => delEntry.mutate(item.id as number)} className="text-muted-foreground/40 hover:text-red-400 p-1 mt-0.5">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Edit Form */}
                  {editingId === item.id && typeof item.id === "number" && (
                    <div className="border-t border-primary/20 pt-2 mt-1 space-y-2">
                      <p className="text-[9px] uppercase tracking-widest font-black text-primary">Update after hearing</p>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={editOutcome}
                          onChange={(e) => setEditOutcome(e.target.value)}
                          className="bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none"
                        >
                          <option value="">Outcome / Result</option>
                          {OUTCOME_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o.replace(/_/g, " ").replace(/\bdnp\b/i, "DNP (Dismissed for Non-Prosecution)")}
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={editNextDate}
                          onChange={(e) => setEditNextDate(e.target.value)}
                          className="bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none"
                        />
                      </div>
                      <textarea
                        placeholder="Court notes, order summary, or judge directions..."
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        rows={2}
                        className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none resize-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 rounded-lg text-xs text-muted-foreground hover:bg-accent transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() =>
                            updateEntry.mutate({
                              id: item.id as number,
                              data: {
                                outcome: editOutcome || null,
                                nextDate: editNextDate || null,
                                description: editDesc || null,
                              },
                            })
                          }
                          disabled={updateEntry.isPending}
                          className="px-4 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/90 transition flex items-center gap-1"
                        >
                          {updateEntry.isPending ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
