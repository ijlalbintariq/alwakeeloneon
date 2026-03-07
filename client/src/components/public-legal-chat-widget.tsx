import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { MessageCircle, Send, X, Briefcase, PhoneCall, FilePlus, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type PublicChatResponse = {
  limitReached?: boolean;
  message?: string;
  reply?: string;
  remaining?: number;
  limit?: number;
  messageCount?: number;
  showCaseIntake?: boolean;
};

const CASE_TYPE_OPTIONS = [
  "Civil Litigation",
  "Criminal Law",
  "Family Law",
  "Property / Real Estate",
  "Corporate / Commercial",
  "Labor / Employment",
  "Tax / Revenue",
  "Constitutional",
  "Other",
];

const PUBLIC_ROUTES = new Set(["/", "/privacy", "/terms", "/install"]);

export function PublicLegalChatWidget() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Assalam-o-Alaikum. I am AlWakeelo AI Legal Intake Assistant. Share your legal issue, and I can provide general guidance.",
    },
  ]);
  const [isSending, setIsSending] = useState(false);
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(10);
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [leadForm, setLeadForm] = useState({
    name: "",
    phone: "",
    email: "",
    caseType: "Civil Litigation",
    caseDescription: "",
  });
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const shouldRender = useMemo(() => {
    if (user) return false;
    if (location.startsWith("/share/")) return false;
    return PUBLIC_ROUTES.has(location);
  }, [location, user]);

  useEffect(() => {
    if (!isOpen) return;
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [isOpen, messages, showCaseForm]);

  async function sendMessage(e?: FormEvent) {
    e?.preventDefault();
    const message = input.trim();
    if (!message || isSending || limitReached) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setIsSending(true);

    try {
      const res = await fetch("/api/public-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message }),
      });
      const data: PublicChatResponse = await res.json().catch(() => ({}));

      if (!res.ok && !data.limitReached) {
        throw new Error(data.message || "Failed to get response");
      }

      if (data.limitReached) {
        setLimitReached(true);
        setRemaining(0);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              data.message ||
              "You have reached the free AI consultation limit. For professional legal assistance you can contact our chamber or hire a lawyer.",
          },
        ]);
        return;
      }

      if (typeof data.remaining === "number") setRemaining(data.remaining);
      if (data.showCaseIntake) setShowCaseForm(true);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "I am unable to respond right now. Please try again.",
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err?.message || "Service is temporarily unavailable. Please try again shortly.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  async function submitCaseLead(e: FormEvent) {
    e.preventDefault();
    if (isSubmittingLead) return;

    setIsSubmittingLead(true);
    try {
      const res = await fetch("/api/public-chat/submit-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(leadForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Failed to submit case");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Your case has been submitted successfully. Our chamber may contact you soon.",
        },
      ]);
      setShowCaseForm(false);
      setLeadForm({
        name: "",
        phone: "",
        email: "",
        caseType: "Civil Litigation",
        caseDescription: "",
      });
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err?.message || "Failed to submit your case. Please try again.",
        },
      ]);
    } finally {
      setIsSubmittingLead(false);
    }
  }

  if (!shouldRender) return null;

  return (
    <>
      <div className="fixed bottom-6 right-6 z-[70]">
        <Button
          onClick={() => setIsOpen((v) => !v)}
          className="rounded-full h-12 px-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs tracking-wide shadow-xl shadow-amber-500/30"
          data-testid="public-chat-toggle"
        >
          <MessageCircle size={16} className="mr-2" />
          Ask AI Legal Assistant
        </Button>
      </div>

      {isOpen && (
        <Card className="fixed bottom-20 right-6 z-[80] w-[min(94vw,420px)] border border-amber-500/30 bg-[#0f172a] shadow-2xl shadow-black/50">
          <CardHeader className="pb-2 px-4 py-3 border-b border-slate-800 flex flex-row items-center justify-between">
            <div>
              <p className="text-sm font-bold text-amber-400">AI Legal Assistant</p>
              <p className="text-[10px] text-slate-400">Free messages left: {remaining ?? "-"}</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="text-slate-400 hover:text-white"
              onClick={() => setIsOpen(false)}
            >
              <X size={16} />
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            <div ref={scrollerRef} className="h-[360px] overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg, idx) => (
                <div
                  key={`${msg.role}-${idx}`}
                  className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "ml-8 bg-amber-500 text-slate-950 font-medium"
                      : "mr-8 bg-slate-800 text-slate-100"
                  }`}
                >
                  {msg.content}
                </div>
              ))}
            </div>

            {limitReached && (
              <div className="px-4 pb-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      window.location.href = "/auth";
                    }}
                    className="h-9 bg-amber-500 text-slate-950 hover:bg-amber-400 text-[11px] font-bold"
                  >
                    <Briefcase size={14} className="mr-1" /> Hire Lawyer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      window.location.href = "/#about";
                    }}
                    className="h-9 border-slate-700 text-slate-200 hover:bg-slate-800 text-[11px]"
                  >
                    <PhoneCall size={14} className="mr-1" /> Contact Chamber
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCaseForm(true)}
                    className="h-9 border-slate-700 text-slate-200 hover:bg-slate-800 text-[11px]"
                  >
                    <FilePlus size={14} className="mr-1" /> Submit Case
                  </Button>
                </div>
              </div>
            )}

            {showCaseForm && (
              <form onSubmit={submitCaseLead} className="px-4 pb-3 pt-1 space-y-2 border-t border-slate-800">
                <p className="text-[11px] text-slate-300 font-semibold">Submit Case Details</p>
                <Input
                  placeholder="Name"
                  value={leadForm.name}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="h-9 bg-[#111827] border-slate-700 text-slate-100"
                  required
                />
                <Input
                  placeholder="Phone Number"
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="h-9 bg-[#111827] border-slate-700 text-slate-100"
                  required
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={leadForm.email}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="h-9 bg-[#111827] border-slate-700 text-slate-100"
                  required
                />
                <Select
                  value={leadForm.caseType}
                  onValueChange={(value) => setLeadForm((prev) => ({ ...prev, caseType: value }))}
                >
                  <SelectTrigger className="h-9 bg-[#111827] border-slate-700 text-slate-100">
                    <SelectValue placeholder="Case Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CASE_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Case Description"
                  rows={4}
                  value={leadForm.caseDescription}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, caseDescription: e.target.value }))}
                  className="bg-[#111827] border-slate-700 text-slate-100"
                  required
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    disabled={isSubmittingLead}
                    className="flex-1 h-9 bg-amber-500 text-slate-950 hover:bg-amber-400 text-xs font-black"
                  >
                    {isSubmittingLead ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                    Submit Case
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 text-slate-400 hover:text-slate-200"
                    onClick={() => setShowCaseForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {!showCaseForm && (
              <form onSubmit={sendMessage} className="px-4 py-3 border-t border-slate-800 flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={limitReached ? "Daily free limit reached" : "Describe your legal issue..."}
                  rows={2}
                  disabled={isSending || limitReached}
                  className="min-h-[52px] max-h-[120px] bg-[#111827] border-slate-700 text-slate-100 resize-y"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={isSending || limitReached || !input.trim()}
                  className="h-11 w-11 bg-amber-500 text-slate-950 hover:bg-amber-400"
                >
                  {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
