import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronRight, CreditCard, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  SUBSCRIPTION_PLANS,
  getPlanCyclePricing,
  getSubscriptionPlanByKey,
  normalizeBillingCycle,
  type BillingCycle,
  type SubscriptionPlanKey,
} from "@/lib/subscription-plans";

export default function CheckoutPage() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const initialPlan = useMemo(
    () => getSubscriptionPlanByKey(new URLSearchParams(window.location.search).get("plan")),
    [],
  );
  const initialCycle = useMemo(
    () => normalizeBillingCycle(new URLSearchParams(window.location.search).get("cycle")),
    [],
  );
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanKey>(initialPlan.key);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialCycle);

  // Detect cancellation redirect from Safepay
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("cancelled") === "true") {
      toast({
        title: "Payment cancelled",
        description: "Your payment was cancelled. You can try again when ready.",
        variant: "destructive",
      });
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryPlan = getSubscriptionPlanByKey(params.get("plan"));
    const queryCycle = normalizeBillingCycle(params.get("cycle"));
    setSelectedPlan(queryPlan.key);
    setBillingCycle(queryCycle);
  }, [location]);

  const selectedPlanData = useMemo(
    () => SUBSCRIPTION_PLANS.find((plan) => plan.key === selectedPlan) || SUBSCRIPTION_PLANS[1],
    [selectedPlan],
  );
  const selectedPlanPricing = useMemo(
    () => getPlanCyclePricing(selectedPlanData, selectedPlanData.key === "enterprise" ? "monthly" : billingCycle),
    [selectedPlanData, billingCycle],
  );

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/safepay/create-session", {
        planKey: selectedPlan,
        billingCycle,
      });
      return res.json();
    },
    onSuccess: (data: { checkoutUrl: string; tracker: string }) => {
      if (data.checkoutUrl) {
        // Redirect to Safepay hosted checkout
        window.location.href = data.checkoutUrl;
      } else {
        toast({
          title: "Checkout error",
          description: "Could not generate payment link. Please try again.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Payment setup failed",
        description: error?.message || "Unable to create payment session. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePlanPick = (planKey: SubscriptionPlanKey) => {
    setSelectedPlan(planKey);
    navigate(`/checkout?plan=${planKey}&cycle=${billingCycle}`);
  };

  const handlePayNow = () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in before making a payment.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (selectedPlan === "enterprise") {
      toast({
        title: "Enterprise plan",
        description: "Please contact our team for enterprise pricing and onboarding.",
      });
      return;
    }

    paymentMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-6 md:px-6 md:py-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <button
            type="button"
            onClick={() => navigate("/#pricing")}
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-foreground hover:text-primary transition-colors"
            data-testid="checkout-back-pricing"
          >
            <ArrowLeft size={14} />
            Back to Pricing
          </button>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-300 font-black uppercase tracking-wider">
            <ShieldCheck size={13} />
            Secure Payment via Safepay
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1.35fr] gap-6">
          {/* Plan Selection Panel */}
          <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary mb-2">Select Plan</p>
            <h1 className="text-2xl md:text-3xl font-bold italic mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              Checkout
            </h1>
            <p className="text-sm text-muted-foreground mb-5">
              Choose your subscription plan and pay securely with Safepay.
            </p>

            <div className="mb-4 inline-flex items-center rounded-xl border border-border bg-background p-1.5 gap-1">
              {[
                { key: "monthly" as const, label: "Monthly" },
                { key: "quarterly" as const, label: "3 Months" },
                { key: "yearly" as const, label: "Yearly" },
              ].map((cycle) => (
                <button
                  key={cycle.key}
                  type="button"
                  onClick={() => {
                    setBillingCycle(cycle.key);
                    navigate(`/checkout?plan=${selectedPlan}&cycle=${cycle.key}`);
                  }}
                  className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${
                    billingCycle === cycle.key
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:text-foreground"
                  }`}
                  data-testid={`checkout-cycle-${cycle.key}`}
                >
                  {cycle.label}
                </button>
              ))}
            </div>

            <div className="space-y-2.5 mb-6">
              {SUBSCRIPTION_PLANS.map((plan) => {
                const pricing = getPlanCyclePricing(plan, billingCycle);
                const priceLabel = plan.key === "enterprise" ? plan.price : pricing.totalLabel;
                return (
                  <button
                    key={plan.key}
                    type="button"
                    onClick={() => handlePlanPick(plan.key)}
                    className={`w-full text-left rounded-xl border px-3 py-3 transition-all ${
                      selectedPlan === plan.key
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-slate-500"
                    }`}
                    data-testid={`checkout-plan-${plan.key}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-foreground">{plan.title}</p>
                        <p className="text-[11px] text-muted-foreground">{priceLabel}</p>
                        {plan.key !== "enterprise" && (
                          <p className="text-[10px] text-muted-foreground">{pricing.effectiveMonthlyLabel}</p>
                        )}
                      </div>
                      {selectedPlan === plan.key ? (
                        <CheckCircle2 size={16} className="text-primary" />
                      ) : (
                        <ChevronRight size={15} className="text-muted-foreground" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">
                {selectedPlanData.title} Plan Includes
              </p>
              <p className="text-[11px] text-muted-foreground mb-3">
                Billing cycle: <span className="text-primary font-semibold">{selectedPlanPricing.cycleLabel}</span>
                {" · "}
                <span className="text-foreground">{selectedPlanPricing.totalLabel}</span>
              </p>
              <ul className="space-y-2">
                {selectedPlanData.features.slice(0, 6).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-foreground">
                    <ChevronRight size={12} className="text-primary mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Payment Panel */}
          <section className="rounded-3xl border border-border bg-card p-5 md:p-7">
            <div className="mb-5">
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                <Sparkles size={12} /> Secure Payment
              </p>
              <h2 className="mt-3 text-2xl font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>
                Complete your payment
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                Review your order and pay securely via Safepay. Card, mobile wallet, and bank payment methods are supported.
              </p>
            </div>

            {/* Order Summary */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-background p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary mb-4">Order Summary</p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Plan</span>
                    <span className="text-sm font-bold text-foreground">{selectedPlanData.title}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Billing Cycle</span>
                    <span className="text-sm font-semibold text-foreground">{selectedPlanPricing.cycleLabel}</span>
                  </div>
                  {selectedPlanPricing.savingsPkr > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Savings</span>
                      <span className="text-sm font-semibold text-emerald-400">{selectedPlanPricing.savingsLabel}</span>
                    </div>
                  )}
                  <div className="border-t border-border pt-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">Total</span>
                    <span className="text-lg font-bold text-primary">{selectedPlanPricing.totalLabel}</span>
                  </div>
                </div>
              </div>

              {/* Account Info */}
              {user && (
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-2">Account</p>
                  <p className="text-sm text-foreground font-semibold">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              )}

              {/* Payment Method Info */}
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={18} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-emerald-300 mb-1">Secure Payment Processing</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      You'll be redirected to Safepay's secure payment page to enter your payment details.
                      We never store or see your card information. Safepay supports credit/debit cards,
                      JazzCash, EasyPaisa, and bank transfers.
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Methods Visual */}
              <div className="flex items-center justify-center gap-4 py-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5">
                  <CreditCard size={13} className="text-muted-foreground" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cards</span>
                </div>
              </div>

              {/* JazzCash / EasyPaisa Notice */}
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
                <p className="text-sm font-extrabold text-foreground leading-relaxed">
                  For JazzCash and EasyPaisa payments, kindly contact us on WhatsApp:{" "}
                  <a
                    href="https://wa.me/923358341897"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:no-underline"
                  >
                    0335 8341897
                  </a>
                </p>
              </div>

              {/* Pay Now Button */}
              {selectedPlan === "enterprise" ? (
                <a
                  href="mailto:support@alwakeelo.com?subject=Enterprise%20Plan%20Inquiry"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-xs font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/90 transition-colors"
                  data-testid="checkout-contact-enterprise"
                >
                  Contact Chamber for Enterprise
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handlePayNow}
                  disabled={paymentMutation.isPending}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-xs font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-70"
                  data-testid="checkout-pay-now"
                >
                  {paymentMutation.isPending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Setting Up Payment...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={14} />
                      Pay {selectedPlanPricing.totalLabel} with Safepay
                    </>
                  )}
                </button>
              )}

              {!user && (
                <p className="text-center text-[11px] text-muted-foreground">
                  Please{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/auth")}
                    className="text-primary underline hover:no-underline"
                  >
                    sign in
                  </button>
                  {" "}to proceed with payment.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
