import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Briefcase, Plus, ChevronLeft, Users, FileText, Calendar, StickyNote, Trash2, Loader2, Scale, AlertCircle, Upload, ShieldCheck, CheckCircle2, Gavel } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type CaseFile = {
  id: number; title: string; caseType: string; court?: string; caseNumber?: string;
  status: string; priority: string; description?: string; referenceNo?: string;
  createdAt: string; updatedAt: string;
  clientCount?: number; documentCount?: number; complianceCount?: number;
  primaryClient?: string | null;
  nextHearing?: { title: string; dueDate: string } | null;
  clients?: any[]; documents?: any[]; compliance?: any[]; notes?: any[];
};

const CASE_TYPES = ["criminal","civil","family","constitutional","tax","corporate","banking","labor","property","other"] as const;
const STATUS_COLORS: Record<string,string> = { active: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", pending: "text-amber-400 bg-amber-500/10 border-amber-500/30", closed: "text-red-400 bg-red-500/10 border-red-500/30", archived: "text-slate-400 bg-slate-500/10 border-slate-500/30" };
const PRIORITY_COLORS: Record<string,string> = { urgent: "text-red-400", high: "text-amber-400", normal: "text-foreground/60", low: "text-slate-400" };

function formatDate(d: string) { return new Date(d).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }); }

function CreateCaseModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState(""); const [caseType, setCaseType] = useState("other");
  const [court, setCourt] = useState(""); const [caseNumber, setCaseNumber] = useState("");
  const [description, setDescription] = useState(""); const [priority, setPriority] = useState("normal");
  const create = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/case-files", { title, caseType, court: court || undefined, caseNumber: caseNumber || undefined, description: description || undefined, priority }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/case-files"] }); toast({ title: "Case file created" }); onClose(); },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Briefcase size={18} className="text-primary" /> New Case File</h2>
        <input placeholder="Case Title *" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" />
        <div className="grid grid-cols-2 gap-3">
          <select value={caseType} onChange={e => setCaseType(e.target.value)} className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none">
            {CASE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
          </select>
          <select value={priority} onChange={e => setPriority(e.target.value)} className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none">
            {["low","normal","high","urgent"].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
          </select>
        </div>
        <input placeholder="Court (optional)" value={court} onChange={e => setCourt(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
        <input placeholder="Case Number (optional)" value={caseNumber} onChange={e => setCaseNumber(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
        <textarea placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none" />
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={() => create.mutate()} disabled={!title.trim() || create.isPending} className="px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50">
            {create.isPending ? <Loader2 size={14} className="animate-spin" /> : "Create Case"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CaseDetail({ id }: { id: number }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: cf, isLoading } = useQuery<CaseFile>({ queryKey: [`/api/case-files/${id}`] });
  const [tab, setTab] = useState<"overview"|"parties"|"documents"|"dates"|"compliance"|"notes">("overview");
  const [noteText, setNoteText] = useState("");
  const [clientName, setClientName] = useState(""); const [clientRole, setClientRole] = useState("client");
  const [compTitle, setCompTitle] = useState(""); const [compDate, setCompDate] = useState(""); const [compType, setCompType] = useState("identity");
  const [nextHearingDate, setNextHearingDate] = useState("");
  const [nextHearingTitle, setNextHearingTitle] = useState("");
  const [eventType, setEventType] = useState("hearing");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");

  const addNote = useMutation({ mutationFn: async () => { await apiRequest("POST", `/api/case-files/${id}/notes`, { content: noteText }); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/case-files/${id}`] }); setNoteText(""); } });
  const addClient = useMutation({ mutationFn: async () => { await apiRequest("POST", `/api/case-files/${id}/clients`, { name: clientName, role: clientRole }); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/case-files/${id}`] }); setClientName(""); } });
  const addComp = useMutation({ mutationFn: async () => { await apiRequest("POST", `/api/case-files/${id}/compliance`, { title: compTitle, dueDate: compDate, type: compType }); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/case-files/${id}`] }); setCompTitle(""); setCompDate(""); } });
  const delNote = useMutation({ mutationFn: async (nid: number) => { await apiRequest("DELETE", `/api/case-files/${id}/notes/${nid}`); }, onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/case-files/${id}`] }) });
  const delClient = useMutation({ mutationFn: async (cid: number) => { await apiRequest("DELETE", `/api/case-files/${id}/clients/${cid}`); }, onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/case-files/${id}`] }) });

  const setNextHearing = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/case-files/${id}/compliance`, {
        title: nextHearingTitle.trim() || "Next Hearing",
        dueDate: nextHearingDate,
        type: "hearing",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/case-files/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/diary"] });
      setNextHearingDate("");
      setNextHearingTitle("");
      toast({ title: "Next hearing set & added to diary" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const addEvent = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/case-files/${id}/compliance`, {
        title: eventTitle.trim(),
        dueDate: eventDate,
        type: eventType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/case-files/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/diary"] });
      setEventTitle(""); setEventDate("");
      toast({ title: "Date added & synced to diary" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary" size={24} /></div>;
  if (!cf) return <div className="text-center py-20 text-muted-foreground">Case not found</div>;

  const tabs = [
    { key: "overview", label: "Overview", icon: Briefcase },
    { key: "parties", label: "Parties", icon: Users },
    { key: "documents", label: "Documents", icon: FileText },
    { key: "dates", label: "Dates", icon: Gavel },
    { key: "compliance", label: "Compliance", icon: ShieldCheck },
    { key: "notes", label: "Notes", icon: StickyNote },
  ] as const;

  return (
    <div className="space-y-4">
      <button onClick={() => navigate("/case-files")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ChevronLeft size={14} /> Back to Cases</button>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>{cf.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${STATUS_COLORS[cf.status] || ""}`}>{cf.status}</span>
            <span className="text-xs text-muted-foreground">{cf.caseType}</span>
            {cf.court && <span className="text-xs text-muted-foreground">• {cf.court}</span>}
            {cf.caseNumber && <span className="text-xs text-primary/70 font-mono">{cf.caseNumber}</span>}
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map(t => <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><t.icon size={12} />{t.label}</button>)}
      </div>

      {tab === "overview" && (
        <div className="space-y-3">
          {cf.description && <div className="bg-card/50 border border-border rounded-xl p-4"><p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-1">Description</p><p className="text-sm text-foreground whitespace-pre-wrap">{cf.description}</p></div>}

          {/* Quick Set Next Hearing */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-black text-primary flex items-center gap-1.5"><Gavel size={12} /> Set Next Hearing Date</p>
            <p className="text-xs text-muted-foreground">This will automatically add the date to your Daily Diary.</p>
            <div className="flex gap-2 flex-wrap">
              <input
                placeholder="e.g. Arguments / Evidence"
                value={nextHearingTitle}
                onChange={e => setNextHearingTitle(e.target.value)}
                className="flex-1 min-w-[160px] bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
              />
              <input
                type="date"
                value={nextHearingDate}
                onChange={e => setNextHearingDate(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
              />
              <button
                onClick={() => setNextHearing.mutate()}
                disabled={!nextHearingDate || setNextHearing.isPending}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
              >
                {setNextHearing.isPending ? <Loader2 size={12} className="animate-spin" /> : <Calendar size={12} />}
                Set Date
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[{ label: "Parties", val: cf.clients?.length || 0 }, { label: "Documents", val: cf.documents?.length || 0 }, { label: "Compliance", val: cf.compliance?.length || 0 }, { label: "Notes", val: cf.notes?.length || 0 }].map(s =>
              <div key={s.label} className="bg-card/50 border border-border rounded-xl p-3 text-center"><p className="text-2xl font-bold text-foreground">{s.val}</p><p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">{s.label}</p></div>
            )}
          </div>

          {/* Upcoming Hearings Timeline */}
          {(() => {
            const upcomingHearings = (cf.compliance || [])
              .filter((c: any) => (c.type === "hearing" || c.type === "filing_deadline") && c.status !== "done" && c.status !== "missed")
              .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
            if (upcomingHearings.length === 0) return null;
            return (
              <div className="bg-card/30 border border-border rounded-xl p-4 space-y-2">
                <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground flex items-center gap-1.5"><Calendar size={12} /> Upcoming Hearings</p>
                <div className="space-y-1.5">
                  {upcomingHearings.slice(0, 5).map((h: any) => {
                    const d = new Date(h.dueDate);
                    const isPast = d < new Date();
                    return (
                      <div key={h.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${isPast ? "border-red-500/20 bg-red-500/5" : "border-border"}`}>
                        <div className={`text-center min-w-[40px] ${isPast ? "text-red-400" : "text-primary"}`}>
                          <p className="text-lg font-black leading-none">{d.getDate()}</p>
                          <p className="text-[9px] uppercase font-bold">{d.toLocaleDateString(undefined, { month: "short" })}</p>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-foreground">{h.title}</p>
                          <p className="text-[10px] text-muted-foreground">{h.type.replace(/_/g, " ")}{h.court ? ` • ${h.court}` : ""}</p>
                        </div>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${isPast ? "border-red-500/30 text-red-400 bg-red-500/10" : "border-amber-500/30 text-amber-400 bg-amber-500/10"}`}>
                          {isPast ? "overdue" : h.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {tab === "parties" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input placeholder="Name" value={clientName} onChange={e => setClientName(e.target.value)} className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none" />
            <select value={clientRole} onChange={e => setClientRole(e.target.value)} className="bg-background border border-border rounded-lg px-2 py-2 text-sm outline-none">
              {["client","opponent","witness","guarantor","co-accused","other"].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button onClick={() => clientName.trim() && addClient.mutate()} disabled={!clientName.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold disabled:opacity-50">Add</button>
          </div>
          {(cf.clients || []).map((c: any) => (
            <div key={c.id} className="flex items-center justify-between bg-card/50 border border-border rounded-xl p-3">
              <div><p className="text-sm font-bold text-foreground">{c.name}</p><p className="text-[10px] text-primary/70 uppercase font-bold">{c.role}{c.cnic ? ` • ${c.cnic}` : ""}{c.phone ? ` • ${c.phone}` : ""}</p></div>
              <button onClick={() => delClient.mutate(c.id)} className="text-muted-foreground hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
          {(cf.clients || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No parties added yet</p>}
        </div>
      )}

      {tab === "documents" && (
        <div className="space-y-3">
          {(cf.documents || []).map((d: any) => (
            <div key={d.id} className="flex items-center justify-between bg-card/50 border border-border rounded-xl p-3">
              <div><p className="text-sm font-bold text-foreground">{d.docTitle || d.label || "Document"}</p>{d.label && <p className="text-[10px] text-primary/70">{d.label}</p>}</div>
            </div>
          ))}
          {(cf.documents || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No documents linked. Upload documents in Knowledge Vault first, then link them here.</p>}
        </div>
      )}

      {tab === "dates" && (() => {
        const EVENT_TYPES = ["hearing", "filing_deadline", "limitation"] as const;
        const events = (cf.compliance || []).filter((c: any) => EVENT_TYPES.includes(c.type));
        const sorted = [...events].sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        return (
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
              <p className="text-[10px] uppercase tracking-widest font-black text-primary flex items-center gap-1.5"><Gavel size={12} /> Add Court Date</p>
              <p className="text-xs text-muted-foreground">Dates added here automatically appear in your Daily Diary.</p>
              <div className="flex gap-2 flex-wrap">
                <input placeholder="e.g. Arguments / Filing" value={eventTitle} onChange={e => setEventTitle(e.target.value)} className="flex-1 min-w-[140px] bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" />
                <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" />
              </div>
              <div className="flex gap-2 flex-wrap">
                <select value={eventType} onChange={e => setEventType(e.target.value)} className="flex-1 min-w-[160px] bg-background border border-border rounded-lg px-2 py-2 text-sm text-foreground outline-none">
                  <option value="hearing">Hearing</option>
                  <option value="filing_deadline">Filing Deadline</option>
                  <option value="limitation">Limitation</option>
                </select>
                <button onClick={() => eventTitle.trim() && eventDate && addEvent.mutate()} disabled={!eventTitle.trim() || !eventDate || addEvent.isPending} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1.5">
                  {addEvent.isPending ? <Loader2 size={12} className="animate-spin" /> : <Calendar size={12} />}
                  Add Date
                </button>
              </div>
            </div>

            {sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No court dates added yet</p>
            ) : (
              <div className="space-y-1.5">
                {sorted.map((h: any) => {
                  const d = new Date(h.dueDate);
                  const isPast = d < new Date() && h.status !== "done";
                  const isDone = h.status === "done";
                  return (
                    <div key={h.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${isPast ? "border-red-500/20 bg-red-500/5" : isDone ? "border-emerald-500/20 bg-emerald-500/5 opacity-60" : "border-border bg-card/50"}`}>
                      <div className={`text-center min-w-[44px] ${isPast ? "text-red-400" : isDone ? "text-emerald-400" : "text-primary"}`}>
                        <p className="text-lg font-black leading-none">{d.getDate()}</p>
                        <p className="text-[9px] uppercase font-bold">{d.toLocaleDateString(undefined, { month: "short", year: "2-digit" })}</p>
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>{h.title}</p>
                        <p className="text-[10px] text-muted-foreground">{h.type.replace(/_/g, " ")}{h.court ? ` • ${h.court}` : ""}</p>
                      </div>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${isPast ? "border-red-500/30 text-red-400 bg-red-500/10" : isDone ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-amber-500/30 text-amber-400 bg-amber-500/10"}`}>
                        {isPast ? "overdue" : h.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {tab === "compliance" && (() => {
        const COMP_TYPES = ["identity", "letter_of_authority", "client_matter_enquiry", "action_agreed_form", "client_care_letter", "conflict_check", "compliance", "other"];
        const compItems = (cf.compliance || []).filter((c: any) => COMP_TYPES.includes(c.type));
        return (
          <div className="space-y-4">
            <div className="bg-card/30 border border-border rounded-xl p-4 space-y-3">
              <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Add Compliance Item</p>
              <div className="flex gap-2 flex-wrap">
                <input placeholder="Title" value={compTitle} onChange={e => setCompTitle(e.target.value)} className="flex-1 min-w-[140px] bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none" />
                <input type="date" value={compDate} onChange={e => setCompDate(e.target.value)} className="bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none" />
              </div>
              <div className="flex gap-2 flex-wrap">
                <select value={compType} onChange={e => setCompType(e.target.value)} className="flex-1 min-w-[160px] bg-background border border-border rounded-lg px-2 py-2 text-sm outline-none">
                  <option value="identity">Identity</option>
                  <option value="letter_of_authority">Letter of Authority</option>
                  <option value="client_matter_enquiry">Client Matter Enquiry</option>
                  <option value="action_agreed_form">Action Agreed Form</option>
                  <option value="client_care_letter">Client Care Letter</option>
                  <option value="conflict_check">Conflict Check</option>
                  <option value="compliance">General Compliance</option>
                  <option value="other">Other</option>
                </select>
                <button onClick={() => compTitle.trim() && compDate && addComp.mutate()} disabled={!compTitle.trim() || !compDate} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold disabled:opacity-50">Add</button>
              </div>
            </div>

            {["identity","letter_of_authority","client_matter_enquiry","action_agreed_form","client_care_letter","conflict_check"].some(t => !compItems.find((c: any) => c.type === t && c.status === "done")) && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-widest font-black text-amber-400 mb-2 flex items-center gap-1.5"><ShieldCheck size={12} /> Compliance Checklist</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                  {[
                    { type: "identity", label: "Identity" },
                    { type: "letter_of_authority", label: "Letter of Authority" },
                    { type: "client_matter_enquiry", label: "Client Matter Enquiry" },
                    { type: "action_agreed_form", label: "Action Agreed Form" },
                    { type: "client_care_letter", label: "Client Care Letter" },
                    { type: "conflict_check", label: "Conflict Check" },
                  ].map(item => {
                    const done = compItems.find((c: any) => c.type === item.type && c.status === "done");
                    return (
                      <div key={item.type} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${done ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" : "border-border bg-background text-muted-foreground"}`}>
                        {done ? <CheckCircle2 size={12} /> : <div className="w-3 h-3 rounded-full border border-muted-foreground/40" />}
                        {item.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {compItems.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between bg-card/50 border border-border rounded-xl p-3">
                <div>
                  <p className="text-sm font-bold text-foreground">{c.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{c.type.replace(/_/g," ")} • {formatDate(c.dueDate)}</span>
                    {c.documentId && <span className="text-[10px] text-primary/70 flex items-center gap-0.5"><Upload size={9} /> doc attached</span>}
                  </div>
                </div>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${STATUS_COLORS[c.status] || ""}`}>{c.status}</span>
              </div>
            ))}
            {compItems.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No compliance items yet</p>}
          </div>
        );
      })()}

      {tab === "notes" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <textarea placeholder="Add a case note..." value={noteText} onChange={e => setNoteText(e.target.value)} rows={2} className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none resize-none" />
            <button onClick={() => noteText.trim() && addNote.mutate()} disabled={!noteText.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold disabled:opacity-50 self-end">Add</button>
          </div>
          {(cf.notes || []).map((n: any) => (
            <div key={n.id} className="flex items-start justify-between bg-card/50 border border-border rounded-xl p-3">
              <div><p className="text-sm text-foreground whitespace-pre-wrap">{n.content}</p><p className="text-[10px] text-muted-foreground mt-1">{formatDate(n.createdAt)}</p></div>
              <button onClick={() => delNote.mutate(n.id)} className="text-muted-foreground hover:text-red-400 mt-1"><Trash2 size={14} /></button>
            </div>
          ))}
          {(cf.notes || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>}
        </div>
      )}
    </div>
  );
}

export default function CaseFilesPage() {
  const [, params] = useRoute("/case-files/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const { data: cases = [], isLoading } = useQuery<CaseFile[]>({ queryKey: ["/api/case-files"] });
  const delCase = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/case-files/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/case-files"] }); toast({ title: "Case deleted" }); },
  });

  if (params?.id) return (
    <div className="h-full overflow-y-auto rounded-[1.25rem] border border-[hsl(var(--preview-border))] preview-bg text-foreground shadow-2xl p-5 md:p-8">
      <CaseDetail id={Number(params.id)} />
    </div>
  );

  return (
    <div className="h-full overflow-y-auto rounded-[1.25rem] border border-[hsl(var(--preview-border))] preview-bg text-foreground shadow-2xl">
      <div className="px-5 md:px-8 py-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] font-black text-foreground/75 mb-1">Case Management</p>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Case <span className="text-primary">Files</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Organize your legal matters, clients, and deadlines</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition">
            <Plus size={16} /> New Case
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-primary" size={24} /></div>
        ) : cases.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Briefcase size={48} className="mx-auto text-muted-foreground/30" />
            <p className="text-lg font-bold text-foreground">No Case Files Yet</p>
            <p className="text-sm text-muted-foreground">Create your first case file to start organizing your legal matters</p>
            <button onClick={() => setShowCreate(true)} className="mt-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold">Create First Case</button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {cases.map(cf => (
              <div key={cf.id} onClick={() => navigate(`/case-files/${cf.id}`)} className="bg-card/50 border border-border rounded-2xl p-4 cursor-pointer hover:border-primary/30 transition-all group">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition">{cf.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${STATUS_COLORS[cf.status] || ""}`}>{cf.status}</span>
                      <span className="text-[10px] text-muted-foreground">{cf.caseType}</span>
                      {cf.priority !== "normal" && <span className={`text-[10px] font-bold ${PRIORITY_COLORS[cf.priority] || ""}`}>● {cf.priority}</span>}
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); delCase.mutate(cf.id); }} className="text-muted-foreground/40 hover:text-red-400 p-1"><Trash2 size={14} /></button>
                </div>
                {cf.primaryClient && <p className="text-xs text-foreground/70 mb-1"><Users size={10} className="inline mr-1" />{cf.primaryClient}</p>}
                {cf.court && <p className="text-[10px] text-muted-foreground"><Scale size={10} className="inline mr-1" />{cf.court}{cf.caseNumber ? ` — ${cf.caseNumber}` : ""}</p>}
                <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border/50">
                  <span className="text-[10px] text-muted-foreground"><Users size={10} className="inline mr-0.5" /> {cf.clientCount || 0}</span>
                  <span className="text-[10px] text-muted-foreground"><FileText size={10} className="inline mr-0.5" /> {cf.documentCount || 0}</span>
                  <span className="text-[10px] text-muted-foreground"><Calendar size={10} className="inline mr-0.5" /> {cf.complianceCount || 0}</span>
                  {cf.nextHearing && <span className="text-[10px] text-amber-400 ml-auto">Next: {formatDate(cf.nextHearing.dueDate)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showCreate && <CreateCaseModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
