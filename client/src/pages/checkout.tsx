import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronRight, Loader2, Mail, PhoneCall, ShieldCheck, Sparkles } from "lucide-react";
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
};

function buildCaseDescription(planLabel: string, form: CheckoutFormState): string {
  const lines = [
    `Subscription interest for ${planLabel} plan.`,
    `Organization: ${form.organization || "N/A"}`,
    `City: ${form.city || "N/A"}`,
    `Phone: ${form.phone || "N/A"}`,
    `Notes: ${form.notes || "User requested subscription onboarding and plan activation support."}`,
  ];
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
        caseType: `Subscription - ${selectedPlanData.title}`,
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
                    We currently finalize subscriptions through chamber verification for legal-compliance onboarding.
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
