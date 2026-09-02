import React, { useState } from "react";
import { Link } from "wouter";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  FileText,
  Mail,
  Send,
  HelpCircle,
  ExternalLink,
  Loader2,
  DollarSign
} from "lucide-react";
import { PublicPreviewShell } from "@/experimental/components/public/PublicPreviewShell";

export default function PreviewRefundPolicy() {
  const [activeTab, setActiveTab] = useState<"policy" | "request">("policy");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [refundRef, setRefundRef] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    transactionRef: "",
    planTier: "Pro (PKR 4,500/mo)",
    reason: "Technical Issue / Server Outage",
    explanation: "",
  });

  const handleRefundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.transactionRef.trim() || !form.explanation.trim()) {
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const generatedRef = "";
      setRefundRef(generatedRef);
      setLoading(false);
      setSubmitted(true);
    }, 800);
  };

  return (
    <PublicPreviewShell>
      <div className="space-y-10 md:space-y-12">
        {/* ── HEADER ── */}
        <section className="space-y-4 max-w-4xl mx-auto text-center pt-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#EBF5F0] border border-[#A3D4BC] rounded-full text-xs text-[#105B38] font-bold uppercase tracking-wider">
            <CreditCard className="w-3.5 h-3.5 text-[#105B38]" />
            Billing &amp; Consumer Protection
          </div>
          <h1
            className="text-4xl sm:text-5xl font-extrabold text-[#0F172A] tracking-tight leading-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Cancellation, Return &amp; Refund Policy
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] max-w-2xl mx-auto">
            Last Updated: August 2026 · Official Policy of Majnoon Studio (Pvt.) Ltd.
          </p>

          {/* 7-Day Guarantee Hero Badge */}
          <div className="mt-6 p-4 sm:p-5 bg-white border border-[#A3D4BC] rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-left">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#EBF5F0] flex items-center justify-center text-[#105B38] shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs sm:text-sm font-bold text-[#0F172A]">
                  7-Day Unconditional Money-Back Guarantee
                </h3>
                <p className="text-xs text-[#64748B]">
                  New subscribers can request a 100% refund within 7 calendar days of initial purchase.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("request")}
              className="px-4 py-2 bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold rounded-xl transition-all shadow-sm shrink-0"
            >
              Submit Refund Request
            </button>
          </div>
        </section>

        {/* ── TOGGLE TABS (POLICY VS SUBMIT REQUEST) ── */}
        <div className="flex justify-center border-b border-[#E2E8F0]">
          <div className="flex gap-2 -mb-px">
            <button
              onClick={() => setActiveTab("policy")}
              className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                activeTab === "policy"
                  ? "border-[#105B38] text-[#105B38]"
                  : "border-transparent text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              Official Policy Terms
            </button>
            <button
              onClick={() => setActiveTab("request")}
              className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                activeTab === "request"
                  ? "border-[#105B38] text-[#105B38]"
                  : "border-transparent text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              Interactive Refund Request Form
            </button>
          </div>
        </div>

        {/* ── TAB 1: POLICY TERMS ── */}
        {activeTab === "policy" && (
          <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-10 space-y-8 shadow-sm leading-relaxed text-xs sm:text-sm text-[#334155] max-w-4xl mx-auto">
            {/* Section 1 */}
            <section className="space-y-3">
              <h2
                className="text-lg font-bold text-[#0F172A] border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                1. Scope of Policy
              </h2>
              <p>
                This Cancellation, Return, and Refund Policy applies to all paid subscriptions, token top-ups, and enterprise chamber licenses purchased on the <strong className="text-[#0F172A]">Alwakeelo</strong> legal intelligence platform, operated by <strong className="text-[#0F172A]">Majnoon Studio (Pvt.) Ltd.</strong>
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h2
                className="text-lg font-bold text-[#0F172A] border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                2. Subscription Cancellation Mechanics
              </h2>
              <p>
                You may cancel your recurring subscription at any time with 1-click inside the Chamber Settings &rarr; Billing panel, or by emailing our billing desk at <a href="mailto:support@alwakeelo.com" className="text-[#105B38] underline font-semibold">support@alwakeelo.com</a>.
              </p>
              <p>
                When you cancel, your subscription will not automatically renew at the end of the active billing term. You retain full access to all features and AI token quotas until the expiration of your paid cycle.
              </p>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h2
                className="text-lg font-bold text-[#0F172A] border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                3. Digital Nature of Services (No Physical Returns)
              </h2>
              <p>
                Because Alwakeelo is a digital software-as-a-service (SaaS) platform providing instant computational AI access, database search indexes, and document generation, physical product returns are not applicable.
              </p>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h2
                className="text-lg font-bold text-[#0F172A] border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                4. 7-Day Unconditional Money-Back Guarantee
              </h2>
              <div className="p-4 bg-[#EBF5F0] border border-[#A3D4BC] rounded-2xl space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#105B38]">
                  First-Time Subscriber Guarantee
                </h4>
                <p className="text-xs text-[#0F172A] font-medium leading-relaxed">
                  If you purchase a paid Alwakeelo subscription (Pro or Chamber) for the first time and are not completely satisfied for any reason, you may request a 100% full refund within seven (7) calendar days of your initial charge date.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h2
                className="text-lg font-bold text-[#0F172A] border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                5. Refund Eligibility Criteria
              </h2>
              <p>Outside the 7-day guarantee window, refunds will be approved under the following conditions:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-[#334155]">
                <li><strong className="text-[#0F172A]">Duplicate Charge:</strong> Verified billing errors resulting in double-charging on your credit card, Kuickpay, or bank transfer.</li>
                <li><strong className="text-[#0F172A]">Unscheduled Platform Outage:</strong> Continuous platform unavailability exceeding forty-eight (48) consecutive hours caused by our server infrastructure.</li>
                <li><strong className="text-[#0F172A]">Unauthorized Fraudulent Charge:</strong> Charge made after reporting stolen account credentials or unauthorized credit card usage.</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section className="space-y-3">
              <h2
                className="text-lg font-bold text-[#0F172A] border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                6. Non-Refundable Scenarios
              </h2>
              <p>Refunds will NOT be granted in the following circumstances:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-[#334155]">
                <li>Subscription cycles where more than 50% of the monthly AI action quota has been consumed.</li>
                <li>Refund requests submitted after more than seven (7) calendar days from the charge date without a verified technical failure.</li>
                <li>Discontent with specific judicial outcomes or subjective dissatisfaction with court rulings retrieved.</li>
                <li>Accounts banned for violation of our Acceptable Use Policy (such as automated scraping or reverse engineering).</li>
              </ul>
            </section>

            {/* Section 7 */}
            <section className="space-y-3">
              <h2
                className="text-lg font-bold text-[#0F172A] border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                7. Refund Processing Timeline &amp; Banking Modes
              </h2>
              <p>
                Once approved, refunds are initiated within <strong className="text-[#0F172A]">7 to 14 business days</strong>. Depending on your financial institution:
              </p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-[#334155]">
                <li><strong className="text-[#0F172A]">Safepay Credit/Debit Cards:</strong> Reversal appears on your card statement within 5–10 banking days.</li>
                <li><strong className="text-[#0F172A]">Kuickpay / 1Bill / Bank Wire:</strong> Transferred directly to your provided IBAN within 7 banking days.</li>
                <li><strong className="text-[#0F172A]">JazzCash / EasyPaisa:</strong> Credited to your registered mobile wallet within 3–5 banking days.</li>
              </ul>
            </section>

            {/* Section 8 */}
            <section className="space-y-3">
              <h2
                className="text-lg font-bold text-[#0F172A] border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                8. Contact for Billing Support
              </h2>
              <p>
                To request a refund or inquire about a billing charge:
              </p>
              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl text-xs space-y-1.5">
                <p><strong className="text-[#0F172A]">Billing Desk:</strong> Majnoon Studio (Pvt.) Ltd.</p>
                <p><strong className="text-[#0F172A]">Email:</strong> <a href="mailto:support@alwakeelo.com" className="text-[#105B38] font-mono underline">support@alwakeelo.com</a></p>
                <p><strong className="text-[#0F172A]">Chambers Hotline:</strong> <a href="tel:00923358341897" className="text-[#105B38] font-mono">+92 335 834 1897</a></p>
              </div>
            </section>
          </div>
        )}

        {/* ── TAB 2: INTERACTIVE REFUND REQUEST FORM ── */}
        {activeTab === "request" && (
          <div className="max-w-2xl mx-auto">
            {submitted ? (
              <div className="bg-white border border-[#A3D4BC] rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-sm flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-[#EBF5F0] border border-[#A3D4BC] flex items-center justify-center text-[#105B38] animate-bounce">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3
                    className="text-2xl font-bold text-[#0F172A]"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Refund Request Logged
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Your refund ticket number is:
                  </p>
                  <div className="inline-block px-4 py-1.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg font-mono font-bold text-sm text-[#105B38]">
                    {refundRef}
                  </div>
                  <p className="text-xs text-[#334155] leading-relaxed pt-2">
                    Our billing team has received your refund request for invoice <strong className="text-[#0F172A]">{form.transactionRef}</strong>. We will review your account activity and process your refund within 7–14 business days to your original payment method.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setForm({
                      name: "",
                      email: "",
                      transactionRef: "",
                      planTier: "Pro (PKR 4,500/mo)",
                      reason: "Technical Issue / Server Outage",
                      explanation: "",
                    });
                  }}
                  className="px-5 py-2.5 bg-[#105B38] text-white text-xs font-bold rounded-xl hover:bg-[#0D4A2E] transition-colors"
                >
                  Submit Another Billing Inquiry
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleRefundSubmit}
                className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 space-y-5 shadow-sm"
              >
                <div className="space-y-1">
                  <h3
                    className="text-xl font-bold text-[#0F172A]"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Submit a Subscription Refund Request
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Please provide your transaction reference details. All requests are reviewed within 24 hours.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#334155] uppercase tracking-wider">
                      Account Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Adv. Muhammad Usman"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#105B38]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#334155] uppercase tracking-wider">
                      Registered Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. usman@chambers.pk"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#105B38]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#334155] uppercase tracking-wider">
                      Transaction / Invoice Ref *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. TRK-892182 or Bank Slip Ref"
                      value={form.transactionRef}
                      onChange={(e) => setForm({ ...form, transactionRef: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#105B38] font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#334155] uppercase tracking-wider">
                      Subscription Plan
                    </label>
                    <select
                      value={form.planTier}
                      onChange={(e) => setForm({ ...form, planTier: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#105B38]"
                    >
                      <option value="Pro (PKR 4,500/mo)">Senior Counsel Pro (PKR 4,500/mo)</option>
                      <option value="Chamber (PKR 18,000/mo)">Chamber Enterprise (PKR 18,000/mo)</option>
                      <option value="Annual Pro (PKR 43,200/yr)">Annual Senior Counsel (PKR 43,200/yr)</option>
                      <option value="Annual Chamber (PKR 172,800/yr)">Annual Chamber (PKR 172,800/yr)</option>
                      <option value="Token Top-up Pack">Custom Token Top-up Pack</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#334155] uppercase tracking-wider">
                    Reason for Refund Request *
                  </label>
                  <select
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#105B38]"
                  >
                    <option value="7-Day Guarantee (First-time subscriber)">7-Day Guarantee (First-time subscriber)</option>
                    <option value="Duplicate or accidental charge">Duplicate or accidental charge</option>
                    <option value="Technical Issue / Server Outage">Technical Issue / Server Outage</option>
                    <option value="Purchased wrong plan tier">Purchased wrong plan tier</option>
                    <option value="Other billing dispute">Other billing dispute</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#334155] uppercase tracking-wider">
                    Explanation &amp; Bank Account IBAN (if bank transfer) *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide details about the issue and your 24-digit Pakistani IBAN (e.g. PK36MEZN00...) for bank transfer refund..."
                    value={form.explanation}
                    onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#105B38] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validating Transaction Records...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Official Refund Claim</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </PublicPreviewShell>
  );
}
