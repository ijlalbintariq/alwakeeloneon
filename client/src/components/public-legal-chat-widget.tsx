import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { MessageCircle, Send, X, PhoneCall, FilePlus, Loader2, Scale, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LegalMarkdown } from "@/components/legal-markdown";
import { parseReferences } from "@/components/reference-cards";
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

type PublicFunnelEventType = "widget_open" | "message_sent" | "lead_form_open" | "lead_submitted" | "contact_click";

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

const URGENCY_OPTIONS = [
  { key: "low", label: "Low" },
  { key: "normal", label: "Normal" },
  { key: "high", label: "High" },
  { key: "urgent", label: "Urgent" },
] as const;

const PUBLIC_ROUTES = new Set(["/", "/privacy", "/terms", "/install"]);

function getOrCreatePublicSessionId(): string {
  const key = "alwakeelo_public_session_id";
  const existing = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  if (existing && existing.trim()) return existing;
  const generated = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  if (typeof window !== "undefined") window.localStorage.setItem(key, generated);
  return generated;
}

export function PublicLegalChatWidget() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Assalam-o-Alaikum. I'm AlWakeelo Legal Consultation Assistant. Share your issue for general legal guidance. If needed, you can consult our chamber and hire a lawyer.",
    },
  ]);
  const [isSending, setIsSending] = useState(false);
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(10);
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [sessionId] = useState<string>(() => getOrCreatePublicSessionId());
  const [leadForm, setLeadForm] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    caseType: "Civil Litigation",
    urgency: "normal",
    preferredCallbackTime: "",
    caseDescription: "",
    consentToContact: false,
  });
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const autoLaunchHandledRef = useRef(false);

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

  useEffect(() => {
    if (!shouldRender || autoLaunchHandledRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search || "");
    const hash = (window.location.hash || "").toLowerCase();
    const shouldAutoOpen = params.get("consult") === "1" || params.get("hire") === "1" || hash === "#consult";
    if (!shouldAutoOpen) return;
    autoLaunchHandledRef.current = true;
    setIsOpen(true);
    void trackPublicEvent("widget_open", { path: location, source: "deep-link" });
  }, [location, shouldRender]);

  async function trackPublicEvent(eventType: PublicFunnelEventType, metadata?: Record<string, unknown>) {
    try {
      await fetch("/api/public-chat/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          eventType,
          sessionId,
          metadata: metadata || {},
        }),
      });
    } catch {
      // Intentionally swallow telemetry errors.
    }
  }

  async function sendMessage(e?: FormEvent) {
    e?.preventDefault();
    const message = input.trim();
    if (!message || isSending || limitReached) return;
    void trackPublicEvent("message_sent", { chars: message.length, limitReached });

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
      if (data.showCaseIntake) {
        setShowCaseForm(true);
        void trackPublicEvent("lead_form_open", { from: "assistant_nudge" });
      }

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

  function handleMessageInputKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void sendMessage();
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
        body: JSON.stringify({
          ...leadForm,
          sessionId,
        }),
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
        city: "",
        caseType: "Civil Litigation",
        urgency: "normal",
        preferredCallbackTime: "",
        caseDescription: "",
        consentToContact: false,
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
          onClick={() => {
            const next = !isOpen;
            setIsOpen(next);
            if (next) void trackPublicEvent("widget_open", { path: location });
          }}
          className="rounded-full h-12 px-5 bg-primary hover:bg-primary text-foreground font-black text-xs tracking-wide shadow-xl shadow-primary/30"
          data-testid="public-chat-toggle"
        >
          <MessageCircle size={16} className="mr-2" />
          <span>Ask Legal Assistant</span>
        </Button>
      </div>

      {isOpen && (
        <Card className="fixed bottom-20 right-6 z-[80] w-[min(94vw,420px)] border border-primary/30 bg-background shadow-2xl shadow-black/50">
          <CardHeader className="pb-2 px-4 py-3 border-b border-border flex flex-row items-center justify-between">
            <div>
              <p className="text-sm font-bold text-primary">Legal Consultation Desk</p>
              <p className="text-[10px] text-muted-foreground">Consultation &amp; Hiring Support</p>
              <p className="text-[10px] text-muted-foreground">Free messages left: {remaining ?? "-"}</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              <X size={16} />
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            <div ref={scrollerRef} className="h-[360px] overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg, idx) => {
                const parsed = msg.role === "assistant" ? parseReferences(msg.content) : null;
                const displayContent = parsed ? parsed.cleanContent : msg.content;
                return (
                  <div
                    key={`${msg.role}-${idx}`}
                    className={`flex items-start gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${
                        msg.role === "assistant"
                          ? "bg-primary text-foreground"
                          : "bg-card border border-primary/30 text-primary"
                      }`}
                    >
                      {msg.role === "assistant" ? <Scale size={15} /> : <UserIcon size={14} />}
                    </div>
                    <div className={`flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"} max-w-[85%]`}>
                      <p className={`text-[10px] font-black uppercase tracking-wider ${msg.role === "assistant" ? "text-primary" : "text-muted-foreground"}`}>
                        {msg.role === "assistant" ? "Al Wakeelo Assistant" : "You"}
                      </p>
                      <div
                        className={`rounded-2xl p-3 ${
                          msg.role === "assistant"
                            ? "bg-primary/5 border border-primary/25 rounded-tl-none"
                            : "bg-card/95 border border-primary rounded-tr-none"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <LegalMarkdown content={displayContent} className="text-sm" />
                        ) : (
                          <p className="text-foreground leading-relaxed whitespace-pre-wrap text-sm">{displayContent}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!showCaseForm && (
              <div className="px-4 pt-3 pb-3 space-y-2 border-t border-border">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowContactInfo((prev) => !prev);
                      void trackPublicEvent("contact_click", { from: "widget-actions" });
                    }}
                    className="h-9 border-border text-foreground hover:bg-card text-[11px]"
                  >
                    <PhoneCall size={14} className="mr-1" /> Contact Chamber
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCaseForm(true);
                      void trackPublicEvent("lead_form_open", { from: "widget-actions" });
                    }}
                    className="h-9 border-border text-foreground hover:bg-card text-[11px]"
                  >
                    <FilePlus size={14} className="mr-1" /> Submit Case
                  </Button>
                </div>
                {showContactInfo && (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-foreground">
                    <p className="font-semibold text-primary">Consultation Contact</p>
                    <p>
                      Email:{" "}
                      <a
                        className="underline hover:text-foreground"
                        href="mailto:support@alwakeelo.com"
                        onClick={() => void trackPublicEvent("contact_click", { channel: "email" })}
                      >
                        support@alwakeelo.com
                      </a>
                    </p>
                    <p>
                      Phone:{" "}
                      <a
                        className="underline hover:text-foreground"
                        href="tel:00923096875797"
                        onClick={() => void trackPublicEvent("contact_click", { channel: "phone" })}
                      >
                        00923096875797
                      </a>
                    </p>
                  </div>
                )}
              </div>
            )}

            {showCaseForm && (
              <form onSubmit={submitCaseLead} className="px-4 pb-3 pt-1 space-y-2 border-t border-border">
                <p className="text-[11px] text-foreground font-semibold">Submit Case Details</p>
                <Input
                  placeholder="Name"
                  value={leadForm.name}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="h-9 bg-background border-border text-foreground"
                  required
                />
                <Input
                  placeholder="Phone Number"
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="h-9 bg-background border-border text-foreground"
                  required
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={leadForm.email}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="h-9 bg-background border-border text-foreground"
                  required
                />
                <Input
                  placeholder="City"
                  value={leadForm.city}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, city: e.target.value }))}
                  className="h-9 bg-background border-border text-foreground"
                  required
                />
                <Select
                  value={leadForm.caseType}
                  onValueChange={(value) => setLeadForm((prev) => ({ ...prev, caseType: value }))}
                >
                  <SelectTrigger className="h-9 bg-background border-border text-foreground">
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
                <Select
                  value={leadForm.urgency}
                  onValueChange={(value) => setLeadForm((prev) => ({ ...prev, urgency: value }))}
                >
                  <SelectTrigger className="h-9 bg-background border-border text-foreground">
                    <SelectValue placeholder="Urgency" />
                  </SelectTrigger>
                  <SelectContent>
                    {URGENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.key} value={opt.key}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Preferred Callback Time (Optional)"
                  value={leadForm.preferredCallbackTime}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, preferredCallbackTime: e.target.value }))}
                  className="h-9 bg-background border-border text-foreground"
                />
                <Textarea
                  placeholder="Case Description"
                  rows={4}
                  value={leadForm.caseDescription}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, caseDescription: e.target.value }))}
                  className="bg-background border-border text-foreground"
                  required
                />
                <label className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={leadForm.consentToContact}
                    onChange={(e) => setLeadForm((prev) => ({ ...prev, consentToContact: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 accent-amber-500"
                    required
                  />
                  <span>I consent to be contacted by Al Wakeelo chamber for legal consultation about this case.</span>
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    disabled={isSubmittingLead || !leadForm.consentToContact}
                    className="flex-1 h-9 bg-primary text-foreground hover:bg-primary text-xs font-black"
                  >
                    {isSubmittingLead ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                    Submit Case
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowCaseForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {!showCaseForm && (
              <form onSubmit={sendMessage} className="px-4 py-3 flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleMessageInputKeyDown}
                  placeholder={limitReached ? "Daily free limit reached" : "Describe your legal issue..."}
                  rows={2}
                  disabled={isSending || limitReached}
                  className="min-h-[52px] max-h-[120px] bg-background border-border text-foreground resize-y"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={isSending || limitReached || !input.trim()}
                  className="h-11 w-11 bg-primary text-foreground hover:bg-primary"
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
