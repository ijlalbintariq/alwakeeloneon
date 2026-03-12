import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronRight, CreditCard, Loader2, Mail, PhoneCall, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { SUBSCRIPTION_PLANS, getSubscriptionPlanByKey, type SubscriptionPlanKey } from "@/lib/subscription-plans";

type CheckoutFormState = {
  name: string;
  email: string;
  phone: string;
  city: string;
  organization: string;
  notes: string;
  consentToContact: boolean;
  paymentMethod: "card" | "jazzcash" | "easypaisa";
  cardHolderName: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
  cardAddressLine1: string;
  cardApt: string;
  cardState: string;
  cardPostCode: string;
  walletNumber: string;
  walletTxnId: string;
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizeCardNumber(value: string): string {
  return digitsOnly(value).slice(0, 19);
}

function formatCardNumber(value: string): string {
  const normalized = normalizeCardNumber(value);
  return normalized.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function normalizeCardExpiry(value: string): string {
  const digits = digitsOnly(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function isValidCardExpiry(value: string): boolean {
  const match = value.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return false;
  const month = Number(match[1]);
  return month >= 1 && month <= 12;
}

function maskDigits(value: string, keepStart = 2, keepEnd = 2): string {
  const digits = digitsOnly(value);
  if (!digits) return "N/A";
  if (digits.length <= keepStart + keepEnd) return `${digits.slice(0, 1)}***`;
  return `${digits.slice(0, keepStart)}${"*".repeat(Math.max(4, digits.length - keepStart - keepEnd))}${digits.slice(-keepEnd)}`;
}

function buildCaseDescription(planLabel: string, form: CheckoutFormState): string {
  const paymentLine =
    form.paymentMethod === "card"
      ? `Payment: Card | Holder: ${form.cardHolderName || "N/A"} | Number: ${maskDigits(form.cardNumber, 0, 4)} | Expiry: ${form.cardExpiry || "N/A"}`
      : `Payment: ${form.paymentMethod === "jazzcash" ? "JazzCash" : "EasyPaisa"} | Wallet: ${maskDigits(form.walletNumber, 3, 2)} | Txn Ref: ${form.walletTxnId || "N/A"}`;
  const billingLine =
    form.paymentMethod === "card"
      ? `Billing: ${form.cardAddressLine1 || "N/A"}, Apt ${form.cardApt || "-"}, ${form.cardState || "N/A"}, ${form.cardPostCode || "N/A"}`
      : "";

  const lines = [
    `Subscription interest for ${planLabel} plan.`,
    `Organization: ${form.organization || "N/A"}`,
    `City: ${form.city || "N/A"}`,
    `Phone: ${form.phone || "N/A"}`,
    paymentLine,
    billingLine,
    `Notes: ${form.notes || "User requested subscription onboarding and plan activation support."}`,
  ].filter(Boolean);
  const text = lines.join("\n");
  return text.length >= 20 ? text : `${text}\nPlease contact me to activate this plan.`;
}

export default function CheckoutPage() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const initialPlan = useMemo(
    () => getSubscriptionPlanByKey(new URLSearchParams(window.location.search).get("plan")),
    [],
  );
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanKey>(initialPlan.key);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<CheckoutFormState>({
    name: "",
    email: "",
    phone: "",
    city: "",
    organization: "",
    notes: "",
    consentToContact: true,
    paymentMethod: "card",
    cardHolderName: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
    cardAddressLine1: "",
    cardApt: "",
    cardState: "",
    cardPostCode: "",
    walletNumber: "",
    walletTxnId: "",
  });

  useEffect(() => {
    const queryPlan = getSubscriptionPlanByKey(new URLSearchParams(window.location.search).get("plan"));
    setSelectedPlan(queryPlan.key);
  }, [location]);

  useEffect(() => {
    const userName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
    setForm((prev) => ({
      ...prev,
      name: prev.name || userName,
      email: prev.email || user?.email || "",
    }));
  }, [user?.firstName, user?.lastName, user?.email]);

  const selectedPlanData = useMemo(
    () => SUBSCRIPTION_PLANS.find((plan) => plan.key === selectedPlan) || SUBSCRIPTION_PLANS[1],
    [selectedPlan],
  );

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        city: form.city.trim(),
        caseType: `Subscription - ${selectedPlanData.title} (${form.paymentMethod === "card" ? "Card" : form.paymentMethod === "jazzcash" ? "JazzCash" : "EasyPaisa"})`,
        caseDescription: buildCaseDescription(selectedPlanData.title, form),
        urgency: "normal",
        preferredCallbackTime: "",
        consentToContact: form.consentToContact,
      };
      const res = await apiRequest("POST", "/api/public-chat/submit-case", payload);
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Checkout request submitted",
        description: "Our chamber will contact you for subscription activation.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Checkout request failed",
        description: error?.message || "Please check your details and try again.",
        variant: "destructive",
      });
    },
  });

  const handlePlanPick = (planKey: SubscriptionPlanKey) => {
    setSelectedPlan(planKey);
    navigate(`/checkout?plan=${planKey}`);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.consentToContact) {
      toast({
        title: "Consent required",
        description: "Please allow contact so the chamber can activate your subscription.",
        variant: "destructive",
      });
      return;
    }

    if (form.paymentMethod === "card") {
      const cardDigits = normalizeCardNumber(form.cardNumber);
      if (
        !form.cardHolderName.trim() ||
        cardDigits.length < 12 ||
        !isValidCardExpiry(form.cardExpiry) ||
        digitsOnly(form.cardCvv).length < 3 ||
        !form.cardAddressLine1.trim() ||
        !form.cardState.trim() ||
        !form.cardPostCode.trim()
      ) {
        toast({
          title: "Card details incomplete",
          description: "Please provide valid card holder, card number, expiry, CVV, and billing address details.",
          variant: "destructive",
        });
        return;
      }
    } else if (digitsOnly(form.walletNumber).length < 10) {
      toast({
        title: "Wallet number required",
        description: `Please provide a valid ${form.paymentMethod === "jazzcash" ? "JazzCash" : "EasyPaisa"} number.`,
        variant: "destructive",
      });
      return;
    }
    submitMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white px-4 py-6 md:px-6 md:py-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#141e31] px-4 py-3">
          <button
            type="button"
            onClick={() => navigate("/#pricing")}
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-300 hover:text-amber-300 transition-colors"
            data-testid="checkout-back-pricing"
          >
            <ArrowLeft size={14} />
            Back to Pricing
          </button>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-300 font-black uppercase tracking-wider">
            <ShieldCheck size={13} />
            Secure Subscription Checkout
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1.35fr] gap-6">
          <section className="rounded-3xl border border-slate-800 bg-[#141e2f] p-5 md:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-500 mb-2">Select Plan</p>
            <h1 className="text-2xl md:text-3xl font-bold italic mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              Checkout
            </h1>
            <p className="text-sm text-slate-400 mb-5">
              Choose your subscription, submit activation request, and our chamber will confirm onboarding.
            </p>

            <div className="space-y-2.5 mb-6">
              {SUBSCRIPTION_PLANS.map((plan) => (
                <button
                  key={plan.key}
                  type="button"
                  onClick={() => handlePlanPick(plan.key)}
                  className={`w-full text-left rounded-xl border px-3 py-3 transition-all ${
                    selectedPlan === plan.key
                      ? "border-amber-400 bg-amber-500/10"
                      : "border-slate-700 bg-[#0f172a] hover:border-slate-500"
                  }`}
                  data-testid={`checkout-plan-${plan.key}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-white">{plan.title}</p>
                      <p className="text-[11px] text-slate-400">{plan.price}</p>
                    </div>
                    {selectedPlan === plan.key ? (
                      <CheckCircle2 size={16} className="text-amber-400" />
                    ) : (
                      <ChevronRight size={15} className="text-slate-500" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 mb-2">
                {selectedPlanData.title} Plan Includes
              </p>
              <ul className="space-y-2">
                {selectedPlanData.features.slice(0, 6).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-slate-300">
                    <ChevronRight size={12} className="text-amber-400 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-[#141e2f] p-5 md:p-7">
            {submitted ? (
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                  <CheckCircle2 size={13} />
                  Request Received
                </div>
                <h2 className="text-2xl font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Subscription request submitted
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Our chamber team will contact you shortly to complete activation for the <span className="text-amber-300 font-semibold">{selectedPlanData.title}</span> plan.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href="mailto:support@alwakeelo.com?subject=Subscription%20Activation%20Support"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-200 hover:border-amber-500 hover:text-amber-300 transition-colors"
                    data-testid="checkout-email-support"
                  >
                    <Mail size={14} /> Email Chamber
                  </a>
                  <a
                    href="tel:00923096875797"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-200 hover:border-amber-500 hover:text-amber-300 transition-colors"
                    data-testid="checkout-call-support"
                  >
                    <PhoneCall size={14} /> Call Chamber
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(user ? "/settings" : "/auth")}
                  className="w-full rounded-xl bg-amber-500 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-950 hover:bg-amber-400 transition-colors"
                  data-testid="checkout-primary-next"
                >
                  {user ? "Open Account Settings" : "Continue to Sign In"}
                </button>
              </div>
            ) : (
              <>
                <div className="mb-5">
                  <p className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                    <Sparkles size={12} /> Activation Form
                  </p>
                  <h2 className="mt-3 text-2xl font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>
                    Complete your checkout request
                  </h2>
                  <p className="text-sm text-slate-400 mt-2">
                    Select your payment method and submit checkout details for chamber activation.
                  </p>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Full Name</label>
                      <input
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        className="w-full rounded-xl border border-slate-700 bg-[#0f172a] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        required
                        data-testid="checkout-input-name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Email</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                        className="w-full rounded-xl border border-slate-700 bg-[#0f172a] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        required
                        data-testid="checkout-input-email"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Phone Number</label>
                      <input
                        value={form.phone}
                        onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                        className="w-full rounded-xl border border-slate-700 bg-[#0f172a] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        required
                        data-testid="checkout-input-phone"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">City</label>
                      <input
                        value={form.city}
                        onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                        className="w-full rounded-xl border border-slate-700 bg-[#0f172a] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        required
                        data-testid="checkout-input-city"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Organization (Optional)</label>
                    <input
                      value={form.organization}
                      onChange={(e) => setForm((prev) => ({ ...prev, organization: e.target.value }))}
                      className="w-full rounded-xl border border-slate-700 bg-[#0f172a] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      data-testid="checkout-input-organization"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Notes (Optional)</label>
                    <textarea
                      rows={4}
                      value={form.notes}
                      onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                      className="w-full rounded-xl border border-slate-700 bg-[#0f172a] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-y"
                      placeholder="Any onboarding notes or preferred activation schedule..."
                      data-testid="checkout-input-notes"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Payment Method</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, paymentMethod: "card" }))}
                        className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${
                          form.paymentMethod === "card"
                            ? "border-amber-400 bg-amber-500/15 text-amber-200"
                            : "border-slate-700 bg-[#0f172a] text-slate-300 hover:border-slate-500"
                        }`}
                        data-testid="checkout-payment-card"
                      >
                        <span className="inline-flex items-center gap-2"><CreditCard size={13} /> Card</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, paymentMethod: "jazzcash" }))}
                        className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${
                          form.paymentMethod === "jazzcash"
                            ? "border-amber-400 bg-amber-500/15 text-amber-200"
                            : "border-slate-700 bg-[#0f172a] text-slate-300 hover:border-slate-500"
                        }`}
                        data-testid="checkout-payment-jazzcash"
                      >
                        <span className="inline-flex items-center gap-2"><Smartphone size={13} /> JazzCash</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, paymentMethod: "easypaisa" }))}
                        className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${
                          form.paymentMethod === "easypaisa"
                            ? "border-amber-400 bg-amber-500/15 text-amber-200"
                            : "border-slate-700 bg-[#0f172a] text-slate-300 hover:border-slate-500"
                        }`}
                        data-testid="checkout-payment-easypaisa"
                      >
                        <span className="inline-flex items-center gap-2"><Smartphone size={13} /> EasyPaisa</span>
                      </button>
                    </div>
                  </div>

                  {form.paymentMethod === "card" ? (
                    <div className="space-y-3 rounded-xl border border-slate-800 bg-[#0f172a] p-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Card Holder Name</label>
                        <input
                          value={form.cardHolderName}
                          onChange={(e) => setForm((prev) => ({ ...prev, cardHolderName: e.target.value }))}
                          className="w-full rounded-xl border border-slate-700 bg-[#0c1526] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          required={form.paymentMethod === "card"}
                          data-testid="checkout-input-card-holder"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Billing Address</label>
                        <input
                          value={form.cardAddressLine1}
                          onChange={(e) => setForm((prev) => ({ ...prev, cardAddressLine1: e.target.value }))}
                          className="w-full rounded-xl border border-slate-700 bg-[#0c1526] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          placeholder="Street address"
                          required={form.paymentMethod === "card"}
                          data-testid="checkout-input-card-address"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Apt (Optional)</label>
                          <input
                            value={form.cardApt}
                            onChange={(e) => setForm((prev) => ({ ...prev, cardApt: e.target.value }))}
                            className="w-full rounded-xl border border-slate-700 bg-[#0c1526] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            placeholder="Suite / Apt"
                            data-testid="checkout-input-card-apt"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">State</label>
                          <input
                            value={form.cardState}
                            onChange={(e) => setForm((prev) => ({ ...prev, cardState: e.target.value }))}
                            className="w-full rounded-xl border border-slate-700 bg-[#0c1526] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            placeholder="Punjab"
                            required={form.paymentMethod === "card"}
                            data-testid="checkout-input-card-state"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Post Code</label>
                          <input
                            value={form.cardPostCode}
                            onChange={(e) => setForm((prev) => ({ ...prev, cardPostCode: e.target.value.slice(0, 20) }))}
                            className="w-full rounded-xl border border-slate-700 bg-[#0c1526] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            placeholder="54000"
                            required={form.paymentMethod === "card"}
                            data-testid="checkout-input-card-postcode"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Card Number</label>
                        <input
                          value={form.cardNumber}
                          onChange={(e) => setForm((prev) => ({ ...prev, cardNumber: formatCardNumber(e.target.value) }))}
                          className="w-full rounded-xl border border-slate-700 bg-[#0c1526] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          placeholder="1234 5678 9012 3456"
                          required={form.paymentMethod === "card"}
                          data-testid="checkout-input-card-number"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Expiry (MM/YY)</label>
                          <input
                            value={form.cardExpiry}
                            onChange={(e) => setForm((prev) => ({ ...prev, cardExpiry: normalizeCardExpiry(e.target.value) }))}
                            className="w-full rounded-xl border border-slate-700 bg-[#0c1526] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            placeholder="MM/YY"
                            required={form.paymentMethod === "card"}
                            data-testid="checkout-input-card-expiry"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">CVV</label>
                          <input
                            value={form.cardCvv}
                            onChange={(e) => setForm((prev) => ({ ...prev, cardCvv: digitsOnly(e.target.value).slice(0, 4) }))}
                            className="w-full rounded-xl border border-slate-700 bg-[#0c1526] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            placeholder="123"
                            required={form.paymentMethod === "card"}
                            data-testid="checkout-input-card-cvv"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500">For security, CVV is used for local validation only and is not stored.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-xl border border-slate-800 bg-[#0f172a] p-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                          {form.paymentMethod === "jazzcash" ? "JazzCash Number" : "EasyPaisa Number"}
                        </label>
                        <input
                          value={form.walletNumber}
                          onChange={(e) => setForm((prev) => ({ ...prev, walletNumber: digitsOnly(e.target.value).slice(0, 14) }))}
                          className="w-full rounded-xl border border-slate-700 bg-[#0c1526] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          placeholder="03XXXXXXXXX"
                          required={form.paymentMethod !== "card"}
                          data-testid="checkout-input-wallet-number"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Transaction Reference (Optional)</label>
                        <input
                          value={form.walletTxnId}
                          onChange={(e) => setForm((prev) => ({ ...prev, walletTxnId: e.target.value.slice(0, 80) }))}
                          className="w-full rounded-xl border border-slate-700 bg-[#0c1526] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          placeholder="If already paid, add reference ID"
                          data-testid="checkout-input-wallet-txn"
                        />
                      </div>
                    </div>
                  )}

                  <label className="flex items-start gap-2 rounded-xl border border-slate-800 bg-[#0f172a] px-3 py-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.consentToContact}
                      onChange={(e) => setForm((prev) => ({ ...prev, consentToContact: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 accent-amber-500"
                      data-testid="checkout-input-consent"
                    />
                    <span className="text-xs text-slate-300">
                      I consent to being contacted by Al Wakeelo chamber for subscription activation and onboarding.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={submitMutation.isPending}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-950 hover:bg-amber-400 transition-colors disabled:opacity-70"
                    data-testid="checkout-submit"
                  >
                    {submitMutation.isPending ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Checkout Request"
                    )}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
