import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Lock,
  RefreshCw,
  AlertCircle,
  Tag,
  Loader2,
  Receipt,
  Percent,
} from "lucide-react";
import "@/experimental/styles/preview-theme.css";

export type BillingCycle = "monthly" | "quarterly" | "yearly";

export interface PlanDetail {
  id: string;
  name: string;
  badge: string;
  monthlyPricePkr: number;
  seats: string;
  aiActions: string;
  features: string[];
}

export const CHECKOUT_PLANS: Record<string, PlanDetail> = {
  starter: {
    id: "starter",
    name: "Free Starter",
    badge: "Solo Counsel",
    monthlyPricePkr: 0,
    seats: "1 Advocate Seat",
    aiActions: "10 AI Actions / mo",
    features: [
      "10 AI Actions per month",
      "Standard AI model access",
      "83,117 Pakistani Statutes & 5,887 Acts",
      "Limitation Act Schedule calculator",
      "10 case file uploads (100 pages PDF chat)",
    ],
  },
  standard: {
    id: "standard",
    name: "Standard",
    badge: "Practitioner",
    monthlyPricePkr: 500,
    seats: "1 Advocate Seat",
    aiActions: "120 AI Actions / mo",
    features: [
      "120 AI Actions per month",
      "Standard AI model (8,192 tokens/request)",
      "600k+ SC & High Court case law citations",
      "Court Fee Calculator across 5 provinces",
      "30 case uploads (250 pages PDF chat)",
      "Daily Court Diary & Cause List tracker",
    ],
  },
  pro: {
    id: "pro",
    name: "Senior Counsel Pro",
    badge: "Most Popular",
    monthlyPricePkr: 1000,
    seats: "1 Advocate Seat",
    aiActions: "350 AI Actions / mo",
    features: [
      "350 AI Actions per month",
      "Standard + Turbo AI models (8,192 tokens)",
      "Pinpoint Citation Reader & Overruled badges",
      "Interactive Precedent Network Citation Graph",
      "6-Pillar Procedural Compliance (O.7 R.11 CPC)",
      "Microsoft Word Add-in Manifest (.xml)",
      "100 case uploads (500 pages PDF chat)",
    ],
  },
  chamber: {
    id: "chamber",
    name: "Chamber Team",
    badge: "Chamber Practice",
    monthlyPricePkr: 4500,
    seats: "Up to 3 Counsel Seats",
    aiActions: "1,200 AI Actions / mo (Pooled)",
    features: [
      "1,200 AI Actions/mo (pooled team quota)",
      "Up to 3 full Advocate User Seats",
      "Standard + Turbo + Apex AI models",
      "180 Apex Deep Reasoning requests/mo",
      "Shared Chamber Knowledge Vault & Bookmarks",
      "Commercial Contract Studio (24+ templates)",
      "300 case uploads (1,500 pages PDF chat)",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise Chamber",
    badge: "Institutional",
    monthlyPricePkr: 50000,
    seats: "Custom Seats (10+)",
    aiActions: "30,000+ AI Actions / mo",
    features: [
      "30,000+ AI Actions/month with custom burst",
      "Custom advocate seats & role matrix",
      "Full Apex access (4,500 Apex requests/mo)",
      "Priority GPU cluster routing (<5s latency)",
      "Dedicated Chamber Account Manager & 99.9% SLA",
      "Private On-Premise / Hybrid Vector DB",
      "Custom Bar Council Single Sign-On (SAML)",
    ],
  },
};

const VALID_PROMOS: Record<string, { label: string; discountPct: number }> = {
  CHAMBERS2026: { label: "Chambers 2026 Launch (20% Off)", discountPct: 20 },
  ADVOCATE10: { label: "Advocate Special (10% Off)", discountPct: 10 },
  BARCOUNCIL: { label: "Bar Council Members (15% Off)", discountPct: 15 },
  FREEPREVIEW: { label: "100% Free Sandbox Pass", discountPct: 100 },
};

export default function PreviewCheckout() {
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();
  
  if (!isAuthLoading && !user) {
    return <Redirect to="/preview/auth" />;
  }

  // Read query parameters
  const queryParams = useMemo(() => {
    const search = window.location.search || (location.includes("?") ? `?${location.split("?")[1]}` : "");
    return new URLSearchParams(search);
  }, [location]);

  const rawPlanKey = queryParams.get("plan") || "pro";
  const rawCycle = queryParams.get("cycle") || "monthly";

  // Plan & Cycle state
  const [selectedPlanKey, setSelectedPlanKey] = useState<string>(
    CHECKOUT_PLANS[rawPlanKey.toLowerCase()] ? rawPlanKey.toLowerCase() : "pro"
  );
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>(
    rawCycle === "quarterly" || rawCycle === "yearly" ? rawCycle : "monthly"
  );

  // Sync state if URL query params change
  useEffect(() => {
    const planParam = queryParams.get("plan");
    const cycleParam = queryParams.get("cycle");
    if (planParam && CHECKOUT_PLANS[planParam.toLowerCase()]) {
      setSelectedPlanKey(planParam.toLowerCase());
    }
    if (cycleParam && (cycleParam === "monthly" || cycleParam === "quarterly" || cycleParam === "yearly")) {
      setSelectedCycle(cycleParam as BillingCycle);
    }
  }, [queryParams]);

  // Promo code state
  const [promoInput, setPromoInput] = useState<string>("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; label: string; discountPct: number } | null>(null);
  const [promoError, setPromoError] = useState<string>("");

  // Auto-renew toggle
  const [autoRenew, setAutoRenew] = useState<boolean>(true);

  // Checkout Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingPhase, setProcessingPhase] = useState<string>("");

  // Calculations
  const currentPlan = CHECKOUT_PLANS[selectedPlanKey] || CHECKOUT_PLANS.pro;

  const cycleMonths = selectedCycle === "monthly" ? 1 : selectedCycle === "quarterly" ? 3 : 12;
  const cycleDiscountPct = selectedCycle === "monthly" ? 0 : selectedCycle === "quarterly" ? 10 : 20;

  const basePrice = currentPlan.monthlyPricePkr * cycleMonths;
  const cycleSavings = Math.round(basePrice * (cycleDiscountPct / 100));
  const subtotalAfterCycle = basePrice - cycleSavings;

  const promoDiscount = appliedPromo ? Math.round(subtotalAfterCycle * (appliedPromo.discountPct / 100)) : 0;
  const finalTotal = Math.max(0, subtotalAfterCycle - promoDiscount);

  // Handle plan pick
  const handlePlanChange = (key: string) => {
    setSelectedPlanKey(key);
  };

  // Handle cycle pick
  const handleCycleChange = (cyc: BillingCycle) => {
    setSelectedCycle(cyc);
  };

  // Handle promo application
  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    setPromoError("");
    const cleaned = promoInput.trim().toUpperCase();
    if (!cleaned) return;

    if (VALID_PROMOS[cleaned]) {
      setAppliedPromo({
        code: cleaned,
        label: VALID_PROMOS[cleaned].label,
        discountPct: VALID_PROMOS[cleaned].discountPct,
      });
      setPromoInput("");
    } else {
      setPromoError(`Promo code "${cleaned}" is invalid or expired.`);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoError("");
  };

  // Complete Payment Action via Safepay
  const handleCompletePayment = async () => {
    if (finalTotal === 0) {
      toast({
        title: "Free Subscription Activated",
        description: "Your free plan has been activated successfully.",
      });
      navigate("/preview/dashboard");
      return;
    }

    setIsProcessing(true);
    setProcessingPhase("Connecting to Safepay secure payment gateway...");

    try {
      // Save order metadata in localStorage for post-redirect confirmation
      const orderRecord = {
        orderId: `AWK-${Date.now().toString().slice(-6)}`,
        planKey: selectedPlanKey,
        planTitle: currentPlan.name,
        billingCycle: selectedCycle,
        cycleMonths,
        basePrice,
        cycleSavings,
        promoDiscount,
        finalTotal,
        paymentMethod: "safepay",
        counselName: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Advocate",
        counselEmail: user?.email || "",
        autoRenew,
        timestamp: new Date().toISOString(),
        status: "processing",
      };
      localStorage.setItem("alwakeelo_preview_last_order", JSON.stringify(orderRecord));

      // Attempt real payment session creation via /api/safepay/create-session
      const res = await fetch("/api/safepay/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          planKey: selectedPlanKey,
          billingCycle: selectedCycle,
          autoRenew,
          isExperimental: true,
        }),
      });

      const data = await res.json();

      if (res.ok && data.checkoutUrl) {
        setProcessingPhase("Redirecting to Safepay checkout...");
        window.location.href = data.checkoutUrl;
        return;
      }

      setIsProcessing(false);
      setProcessingPhase("");
      toast({
        title: "Payment Gateway Notice",
        description: data.message || "Could not initiate payment session. Please try again.",
        variant: "destructive",
      });
    } catch (err: any) {
      setIsProcessing(false);
      setProcessingPhase("");
      toast({
        title: "Connection Error",
        description: err?.message || "Unable to reach the payment server. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="preview-theme-scope min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans selection:bg-[#105B38]/20 selection:text-[#0F172A]">
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/preview/pricing" className="flex items-center gap-2 text-xs font-bold text-[#64748B] hover:text-[#105B38] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Pricing</span>
          </Link>
          <span className="text-[#CBD5E1]">|</span>
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Al Wakeelo" className="w-5 h-5 object-contain" />
            <span className="font-bold text-[#0F172A] font-serif text-sm">AL WAKEELO SECURE CHECKOUT</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono font-semibold px-3 py-1 rounded-full bg-[#EBF5F0] text-[#105B38] border border-[#A3D4BC]">
          <Lock className="w-3.5 h-3.5 text-[#105B38]" />
          <span>256-BIT SSL ENCRYPTED</span>
        </div>
      </header>

      {/* 2. Main Checkout Body */}
      <main className="flex-1 px-4 sm:px-8 py-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Plan Customizer & Safepay Gateway (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Select Plan & Billing Cycle */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#105B38] text-white text-xs font-bold font-mono flex items-center justify-center">
                    1
                  </span>
                  <h2 className="text-base font-bold text-[#0F172A] font-serif">
                    Select Chamber Plan & Billing Frequency
                  </h2>
                </div>
                <span className="text-xs font-mono text-[#64748B]">Step 1 of 2</span>
              </div>

              {/* Billing Cycle Selector Tabs */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-[#F1F5F9] rounded-xl mb-5">
                {(["monthly", "quarterly", "yearly"] as BillingCycle[]).map((cycle) => {
                  const isSelected = selectedCycle === cycle;
                  const discount = cycle === "quarterly" ? "10% Off" : cycle === "yearly" ? "20% Off" : null;
                  return (
                    <button
                      key={cycle}
                      type="button"
                      onClick={() => handleCycleChange(cycle)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all capitalize flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? "bg-white text-[#105B38] shadow-sm border border-[#E2E8F0]"
                          : "text-[#64748B] hover:text-[#0F172A]"
                      }`}
                    >
                      <span>{cycle}</span>
                      {discount && (
                        <span className="text-[10px] bg-[#EBF5F0] text-[#105B38] px-1.5 py-0.2 rounded font-mono font-bold">
                          {discount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Plan Options Grid */}
              <div className="space-y-3">
                {Object.values(CHECKOUT_PLANS).map((plan) => {
                  const isSelected = selectedPlanKey === plan.id;
                  const price =
                    plan.monthlyPricePkr === 0
                      ? "Free Forever"
                      : `PKR ${plan.monthlyPricePkr.toLocaleString("en-US")}/mo`;

                  return (
                    <div
                      key={plan.id}
                      onClick={() => handlePlanChange(plan.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? "bg-[#EBF5F0]/50 border-[#105B38] ring-1 ring-[#105B38]"
                          : "bg-white border-[#E2E8F0] hover:border-[#CBD5E1]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? "border-[#105B38] bg-[#105B38]" : "border-[#94A3B8]"
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#0F172A]">{plan.name}</span>
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.2 rounded bg-slate-100 text-slate-700">
                              {plan.badge}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#64748B]">
                            {plan.seats} · {plan.aiActions}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-[#0F172A]">{price}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Safepay Secure Payment Gateway */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#105B38] text-white text-xs font-bold font-mono flex items-center justify-center">
                    2
                  </span>
                  <h2 className="text-base font-bold text-[#0F172A] font-serif">
                    Secure Payment Gateway (Safepay)
                  </h2>
                </div>
                <span className="text-xs font-mono text-[#64748B]">Step 2 of 2</span>
              </div>

              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#105B38]" />
                    <span className="text-xs font-bold text-[#0F172A]">Debit & Credit Card Checkout</span>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                    Safepay Verified
                  </span>
                </div>

                <p className="text-xs text-[#475569] leading-relaxed">
                  Your payment is processed through <strong>Safepay</strong>, Pakistan's leading PCI-DSS Level 1 certified payment gateway. You will be redirected to Safepay's secure checkout page to complete your payment with instant 3D-Secure authentication.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="p-3 bg-white rounded-xl border border-[#E2E8F0] flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-[#105B38] shrink-0" />
                    <div>
                      <span className="text-[11px] font-bold text-[#0F172A] block">PCI-DSS Compliant</span>
                      <span className="text-[10px] text-[#64748B]">Zero card data stored</span>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-[#E2E8F0] flex items-center gap-2.5">
                    <Lock className="w-4 h-4 text-[#105B38] shrink-0" />
                    <div>
                      <span className="text-[11px] font-bold text-[#0F172A] block">3D-Secure 2.0</span>
                      <span className="text-[10px] text-[#64748B]">OTP verification</span>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-[#E2E8F0] flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-[#105B38] shrink-0" />
                    <div>
                      <span className="text-[11px] font-bold text-[#0F172A] block">Instant Activation</span>
                      <span className="text-[10px] text-[#64748B]">Automated provisioning</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-[11px] text-[#64748B]">
                  <span>Supported Cards: Visa, Mastercard, PayPak, UnionPay</span>
                  <span className="font-mono text-[#105B38] font-semibold">PKR Settlement</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary & Action Card (5 Cols) */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-sm sticky top-20">
              <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[#105B38]" />
                  <h3 className="text-base font-bold font-serif text-[#0F172A]">
                    Order Summary
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold text-[#105B38] bg-[#EBF5F0] px-2 py-0.5 rounded-full border border-[#A3D4BC]">
                  LIVE BILLING
                </span>
              </div>

              {/* Selected Plan Details */}
              <div className="py-4 border-b border-[#E2E8F0]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-[#0F172A] font-serif">{currentPlan.name} Plan</span>
                  <span className="font-mono text-xs font-bold text-[#0F172A]">
                    PKR {currentPlan.monthlyPricePkr.toLocaleString("en-US")}/mo
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-[#64748B]">
                  <span>Billing Frequency:</span>
                  <span className="font-semibold text-[#0F172A] capitalize">
                    {selectedCycle} ({cycleMonths} {cycleMonths === 1 ? "month" : "months"})
                  </span>
                </div>
              </div>

              {/* Promo Code Input */}
              <div className="py-4 border-b border-[#E2E8F0]">
                <label className="text-xs font-bold text-[#334155] block mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#105B38]" />
                  <span>Promo Code / Advocate Voucher</span>
                </label>

                {appliedPromo ? (
                  <div className="flex items-center justify-between p-2.5 bg-[#EBF5F0] border border-[#A3D4BC] rounded-xl">
                    <div className="flex items-center gap-2 text-xs">
                      <Percent className="w-4 h-4 text-[#105B38]" />
                      <div>
                        <span className="font-mono font-bold text-[#105B38]">{appliedPromo.code}</span>
                        <span className="text-[10px] text-[#2D5A40] block">{appliedPromo.label}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePromo}
                      className="text-xs text-red-600 hover:text-red-800 font-bold px-2 py-1"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyPromo} className="flex gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value)}
                      placeholder="Try CHAMBERS2026 or ADVOCATE10"
                      className="flex-1 px-3 py-2 rounded-lg border border-[#E2E8F0] text-xs focus:outline-none focus:ring-1 focus:ring-[#105B38] font-mono uppercase"
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold transition-all"
                    >
                      Apply
                    </button>
                  </form>
                )}

                {promoError && (
                  <p className="text-[11px] text-red-600 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{promoError}</span>
                  </p>
                )}
              </div>

              {/* Price Breakdown Table */}
              <div className="py-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-[#475569]">
                  <span>Base Price ({cycleMonths} mos × PKR {currentPlan.monthlyPricePkr.toLocaleString("en-US")}):</span>
                  <span className="font-mono font-semibold text-[#0F172A]">PKR {basePrice.toLocaleString("en-US")}</span>
                </div>

                {cycleSavings > 0 && (
                  <div className="flex items-center justify-between text-[#105B38]">
                    <span>Cycle Discount ({cycleDiscountPct}%):</span>
                    <span className="font-mono font-bold">- PKR {cycleSavings.toLocaleString("en-US")}</span>
                  </div>
                )}

                {promoDiscount > 0 && (
                  <div className="flex items-center justify-between text-[#105B38]">
                    <span>Promo Discount ({appliedPromo?.discountPct}%):</span>
                    <span className="font-mono font-bold">- PKR {promoDiscount.toLocaleString("en-US")}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold font-serif text-[#0F172A] block">Net Payable Amount</span>
                    <span className="text-[10px] text-[#64748B]">Instant activation</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-mono font-black text-[#105B38] block">
                      PKR {finalTotal.toLocaleString("en-US")}
                    </span>
                    <span className="text-[10px] font-mono text-[#64748B]">
                      {selectedCycle} settlement
                    </span>
                  </div>
                </div>
              </div>

              {/* Auto-renew Toggle */}
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] mb-4 flex items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-[#105B38] mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-[#0F172A] block">Auto-Renew Subscription</span>
                    <span className="text-[10px] text-[#64748B] block leading-tight">
                      Cancel anytime with 1-click in Chamber Settings.
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoRenew}
                  onChange={(e) => setAutoRenew(e.target.checked)}
                  className="w-4 h-4 text-[#105B38] rounded border-gray-300 focus:ring-[#105B38]"
                />
              </div>

              {/* Complete Payment Button */}
              <button
                type="button"
                onClick={handleCompletePayment}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white font-bold text-xs uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-75"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting to Safepay...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Pay PKR {finalTotal.toLocaleString("en-US")} with Safepay</span>
                  </>
                )}
              </button>

              {isProcessing && (
                <div className="mt-3 p-3 bg-[#EBF5F0] border border-[#A3D4BC] rounded-xl text-center text-xs font-mono text-[#105B38] animate-pulse">
                  {processingPhase}
                </div>
              )}

              {/* Trust Badge Guarantee */}
              <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-center gap-2 text-[11px] text-[#64748B]">
                <ShieldCheck className="w-4 h-4 text-[#105B38]" />
                <span>7-Day Unconditional Chamber Refund Policy</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
