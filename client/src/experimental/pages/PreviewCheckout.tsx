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
  Building2,
  Smartphone,
  Landmark,
  ShieldCheck,
  Sparkles,
  Lock,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  FileText,
  Tag,
  Loader2,
  Scale,
  Receipt,
  HelpCircle,
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

interface ProvinceTax {
  code: string;
  name: string;
  authority: string;
  rate: number; // percentage
}

const PROVINCE_TAX_RATES: ProvinceTax[] = [
  { code: "punjab", name: "Punjab", authority: "Punjab Revenue Authority (PRA)", rate: 16 },
  { code: "sindh", name: "Sindh", authority: "Sindh Revenue Board (SRB)", rate: 13 },
  { code: "ict", name: "Islamabad (ICT)", authority: "Federal Excise / ICT Revenue", rate: 15 },
  { code: "kpk", name: "Khyber Pakhtunkhwa", authority: "KPK Revenue Authority (KPRA)", rate: 15 },
  { code: "balochistan", name: "Balochistan", authority: "Balochistan Revenue Authority (BRA)", rate: 15 },
  { code: "exempt", name: "Tax-Exempt / Bar Association", authority: "Registered Exemption (NTN/STRN)", rate: 0 },
];

const VALID_PROMOS: Record<string, { label: string; discountPct: number }> = {
  CHAMBERS2026: { label: "Chambers 2026 Launch (20% Off)", discountPct: 20 },
  ADVOCATE10: { label: "Advocate Special (10% Off)", discountPct: 10 },
  BARCOUNCIL: { label: "Bar Council Members (15% Off)", discountPct: 15 },
  FREEPREVIEW: { label: "100% Free Sandbox Pass", discountPct: 100 },
};

type PaymentMethodType = "card" | "kuickpay" | "wallet" | "wire";

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

  // Tax & Province state
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<string>("punjab");
  const [taxNtn, setTaxNtn] = useState<string>("");

  // Promo code state
  const [promoInput, setPromoInput] = useState<string>("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; label: string; discountPct: number } | null>(null);
  const [promoError, setPromoError] = useState<string>("");

  // Auto-renew toggle
  const [autoRenew, setAutoRenew] = useState<boolean>(true);

  // Payment Method selection
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("card");

  // Card form state
  const [cardName, setCardName] = useState<string>("Adv. Muhammad Hashim");
  const [cardNumber, setCardNumber] = useState<string>("4242 •••• •••• 4242");
  const [cardExpiry, setCardExpiry] = useState<string>("12/28");
  const [cardCvc, setCardCvc] = useState<string>("892");

  // Kuickpay 1Bill state
  const [consumerNumber] = useState<string>("1000549281");
  const [copiedConsumer, setCopiedConsumer] = useState<boolean>(false);

  // Mobile Wallet state
  const [walletProvider, setWalletProvider] = useState<"jazzcash" | "easypaisa" | "nayapay">("jazzcash");
  const [walletPhone, setWalletPhone] = useState<string>("0335 8341897");

  // Bank Wire state
  const [wireRefCode, setWireRefCode] = useState<string>("");
  const [copiedIban, setCopiedIban] = useState<boolean>(false);

  // Advocate / Billing Details
  const [counselName, setCounselName] = useState<string>("Adv. Muhammad Hashim Khan");
  const [counselEmail, setCounselEmail] = useState<string>("hashim.khan@chambers.pk");
  const [barId, setBarId] = useState<string>("HC/LHR/8921/2020");

  // Checkout Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingPhase, setProcessingPhase] = useState<string>("");

  // Calculations
  const currentPlan = CHECKOUT_PLANS[selectedPlanKey] || CHECKOUT_PLANS.pro;
  const currentProvince = PROVINCE_TAX_RATES.find((p) => p.code === selectedProvinceCode) || PROVINCE_TAX_RATES[0];

  const cycleMonths = selectedCycle === "monthly" ? 1 : selectedCycle === "quarterly" ? 3 : 12;
  const cycleDiscountPct = selectedCycle === "monthly" ? 0 : selectedCycle === "quarterly" ? 10 : 20;

  const basePrice = currentPlan.monthlyPricePkr * cycleMonths;
  const cycleSavings = Math.round(basePrice * (cycleDiscountPct / 100));
  const subtotalAfterCycle = basePrice - cycleSavings;

  const promoDiscount = appliedPromo ? Math.round(subtotalAfterCycle * (appliedPromo.discountPct / 100)) : 0;
  const taxableAmount = Math.max(0, subtotalAfterCycle - promoDiscount);

  const taxAmount = Math.round(taxableAmount * (currentProvince.rate / 100));
  const finalTotal = taxableAmount + taxAmount;

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

  const handleCopyConsumer = () => {
    navigator.clipboard.writeText(consumerNumber);
    setCopiedConsumer(true);
    setTimeout(() => setCopiedConsumer(false), 2000);
  };

  const handleCopyIban = () => {
    navigator.clipboard.writeText("PK36HABB0000427991820103");
    setCopiedIban(true);
    setTimeout(() => setCopiedIban(false), 2000);
  };

  // Complete Payment Action (Attempts real gateway or displays Payment integration coming soon)
  const handleCompletePayment = async () => {
    setIsProcessing(true);
    setProcessingPhase("Verifying advocate credentials & Bar Council license...");

    try {
      // Attempt real payment session creation via /api/safepay/create-session
      const res = await fetch("/api/safepay/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          planKey: selectedPlanKey,
          billingCycle: selectedCycle,
          autoRenew, isExperimental: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
          return;
        }
      }

      // If backend payment gateway is not active or returns non-200
      setIsProcessing(false);
      setProcessingPhase("");
      toast({
        title: "Payment Integration Coming Soon",
        description: "Direct online payment gateway is currently in integration. Chamber subscriptions can be activated via direct invoicing or bank wire.",
      });
    } catch (err) {
      setIsProcessing(false);
      setProcessingPhase("");
      toast({
        title: "Payment Integration Coming Soon",
        description: "Direct online payment gateway is currently in integration. Chamber subscriptions can be activated via direct invoicing or bank wire.",
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
          <span>256-BIT SSL ENCRYPTED PAYMENT</span>
        </div>
      </header>

      {/* 2. Main Checkout Body */}
      <main className="flex-1 px-4 sm:px-8 py-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Plan Customizer & Payment Rails (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Select Plan & Billing Cycle */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#105B38] text-white text-xs font-bold font-mono flex items-center justify-center">
                    1
                  </span>
                  <h2 className="text-base font-bold text-[#0F172A] font-serif">
                    Select Chamber Plan & Billing Cycle
                  </h2>
                </div>
                <span className="text-xs font-mono text-[#64748B]">Step 1 of 3</span>
              </div>

              {/* Billing Cycle Switcher */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { id: "monthly" as BillingCycle, label: "Monthly", discount: "0%" },
                  { id: "quarterly" as BillingCycle, label: "Quarterly (3 Mos)", discount: "Save 10%" },
                  { id: "yearly" as BillingCycle, label: "Annual Chambers", discount: "Save 20%" },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleCycleChange(c.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      selectedCycle === c.id
                        ? "bg-[#105B38] text-white shadow-sm"
                        : "bg-[#F8FAFC] border border-[#E2E8F0] text-[#475569] hover:border-[#CBD5E1]"
                    }`}
                  >
                    <span>{c.label}</span>
                    {c.discount !== "0%" && (
                      <span
                        className={`text-[10px] px-1 py-0.2 rounded font-mono font-bold ${
                          selectedCycle === c.id ? "bg-white/20 text-white" : "bg-[#EBF5F0] text-[#105B38]"
                        }`}
                      >
                        {c.discount}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Plan Options Selector */}
              <div className="space-y-2">
                {Object.values(CHECKOUT_PLANS).map((plan) => {
                  const isSelected = selectedPlanKey === plan.id;
                  const price = plan.monthlyPricePkr === 0 ? "PKR 0" : `PKR ${plan.monthlyPricePkr.toLocaleString("en-US")}/mo`;

                  return (
                    <div
                      key={plan.id}
                      onClick={() => handlePlanChange(plan.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "bg-[#EBF5F0]/40 border-[#105B38] ring-1 ring-[#105B38]"
                          : "bg-[#FAFAFA] border-[#E2E8F0] hover:border-[#CBD5E1]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? "border-[#105B38] bg-[#105B38]" : "border-[#94A3B8] bg-white"
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#0F172A] font-serif">{plan.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white text-[#475569] border border-[#E2E8F0]">
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

            {/* Step 2: Provincial Tax & PNTN Details */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#105B38] text-white text-xs font-bold font-mono flex items-center justify-center">
                    2
                  </span>
                  <h2 className="text-base font-bold text-[#0F172A] font-serif">
                    Provincial Jurisdiction & Sales Tax (PRA / SRB / ICT)
                  </h2>
                </div>
                <span className="text-xs font-mono text-[#64748B]">Step 2 of 3</span>
              </div>

              <p className="text-xs text-[#64748B] mb-4">
                In compliance with Federal & Provincial IT and Legal Services Tax Regulations, select your registered practice territory:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {PROVINCE_TAX_RATES.map((prov) => {
                  const isSelected = selectedProvinceCode === prov.code;
                  return (
                    <div
                      key={prov.code}
                      onClick={() => setSelectedProvinceCode(prov.code)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-[#EBF5F0]/50 border-[#105B38] ring-1 ring-[#105B38]"
                          : "bg-[#FAFAFA] border-[#E2E8F0] hover:border-[#CBD5E1]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-[#0F172A]">{prov.name}</span>
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                            prov.rate === 0
                              ? "bg-slate-100 text-slate-700"
                              : "bg-[#EBF5F0] text-[#105B38]"
                          }`}
                        >
                          {prov.rate}% Tax
                        </span>
                      </div>
                      <span className="text-[10px] text-[#64748B] block leading-tight">{prov.authority}</span>
                    </div>
                  );
                })}
              </div>

              {/* NTN / STRN Input for Tax Invoice */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs font-semibold text-[#334155] block mb-1">
                    Counsel Bar Council Enrollment No.
                  </label>
                  <input
                    type="text"
                    value={barId}
                    onChange={(e) => setBarId(e.target.value)}
                    placeholder="HC/LHR/8921/2020"
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-xs focus:outline-none focus:ring-1 focus:ring-[#105B38] font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#334155] block mb-1">
                    Chamber NTN / PNTN (Optional for Tax Credit)
                  </label>
                  <input
                    type="text"
                    value={taxNtn}
                    onChange={(e) => setTaxNtn(e.target.value)}
                    placeholder="9842104-7 (FBR Registered)"
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-xs focus:outline-none focus:ring-1 focus:ring-[#105B38] font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Payment Method Simulator with 4 Real Tabs */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#105B38] text-white text-xs font-bold font-mono flex items-center justify-center">
                    3
                  </span>
                  <h2 className="text-base font-bold text-[#0F172A] font-serif">
                    Pakistani Payment Rail Simulator
                  </h2>
                </div>
                <span className="text-xs font-mono text-[#64748B]">Step 3 of 3</span>
              </div>

              {/* Payment Tabs Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  className={`p-2.5 rounded-xl text-xs font-semibold flex flex-col items-center gap-1.5 transition-all border ${
                    paymentMethod === "card"
                      ? "bg-[#105B38] text-white border-[#105B38] shadow-sm"
                      : "bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:border-[#CBD5E1]"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Card (Visa/MC)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("kuickpay")}
                  className={`p-2.5 rounded-xl text-xs font-semibold flex flex-col items-center gap-1.5 transition-all border ${
                    paymentMethod === "kuickpay"
                      ? "bg-[#105B38] text-white border-[#105B38] shadow-sm"
                      : "bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:border-[#CBD5E1]"
                  }`}
                >
                  <Landmark className="w-4 h-4" />
                  <span>Kuickpay / 1Bill</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("wallet")}
                  className={`p-2.5 rounded-xl text-xs font-semibold flex flex-col items-center gap-1.5 transition-all border ${
                    paymentMethod === "wallet"
                      ? "bg-[#105B38] text-white border-[#105B38] shadow-sm"
                      : "bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:border-[#CBD5E1]"
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>JazzCash / Wallet</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("wire")}
                  className={`p-2.5 rounded-xl text-xs font-semibold flex flex-col items-center gap-1.5 transition-all border ${
                    paymentMethod === "wire"
                      ? "bg-[#105B38] text-white border-[#105B38] shadow-sm"
                      : "bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:border-[#CBD5E1]"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>HBL Bank Wire</span>
                </button>
              </div>

              {/* Tab 1: Card Content */}
              {paymentMethod === "card" && (
                <div className="space-y-3 bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                    <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-[#105B38]" />
                      Debit / Credit Card (Safepay Merchant Gateway)
                    </span>
                    <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                      PCI-DSS Level 1
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#475569] block mb-1">
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder="Advocate Name"
                      className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-xs focus:outline-none focus:ring-1 focus:ring-[#105B38] bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#475569] block mb-1">
                      Card Number
                    </label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="4242 4242 4242 4242"
                      className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-xs focus:outline-none focus:ring-1 focus:ring-[#105B38] font-mono bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] block mb-1">
                        Expiry Date (MM/YY)
                      </label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="12/28"
                        className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-xs focus:outline-none focus:ring-1 focus:ring-[#105B38] font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] block mb-1">
                        Security CVC / CVV
                      </label>
                      <input
                        type="password"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        placeholder="•••"
                        maxLength={4}
                        className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-xs focus:outline-none focus:ring-1 focus:ring-[#105B38] font-mono bg-white"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-[#64748B] italic">
                    * Supports Meezan Bank, HBL, Standard Chartered, UBL, MCB, and all 3D-Secure enabled cards.
                  </p>
                </div>
              )}

              {/* Tab 2: Kuickpay / 1Bill Content */}
              {paymentMethod === "kuickpay" && (
                <div className="space-y-3 bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                    <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-[#105B38]" />
                      1Bill / Kuickpay Online Banking Invoice
                    </span>
                    <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">
                      1Link Cleared
                    </span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#64748B] block">
                        1Link PSID / Consumer Number
                      </span>
                      <span className="text-lg font-mono font-bold text-[#105B38] tracking-widest block">
                        {consumerNumber}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyConsumer}
                      className="px-3 py-1.5 rounded-lg bg-[#EBF5F0] hover:bg-[#D5EBDD] text-[#105B38] text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      {copiedConsumer ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedConsumer ? "Copied!" : "Copy Number"}</span>
                    </button>
                  </div>

                  <div className="text-[11px] text-[#475569] space-y-1.5 leading-relaxed bg-white/70 p-3 rounded-lg border border-[#E2E8F0]/60">
                    <p className="font-bold text-[#0F172A]">How to pay via 1Bill / Internet Banking:</p>
                    <ol className="list-decimal list-inside space-y-1 text-[#475569]">
                      <li>Open your Bank App (HBL, Meezan, Bank Alfalah, UBL, SCB, etc.).</li>
                      <li>Navigate to <strong>Bill Payments &rarr; 1Bill / Kuickpay</strong>.</li>
                      <li>Enter Consumer Number <code className="font-mono text-[#105B38] font-bold">{consumerNumber}</code>.</li>
                      <li>Confirm amount and finalize payment. Chamber access activates instantaneously.</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Tab 3: JazzCash / EasyPaisa Content */}
              {paymentMethod === "wallet" && (
                <div className="space-y-3 bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                    <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-[#105B38]" />
                      Direct Mobile Wallet USSD & Push Prompt
                    </span>
                    <span className="text-[10px] font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                      Instant Push
                    </span>
                  </div>

                  <div className="flex gap-2">
                    {(["jazzcash", "easypaisa", "nayapay"] as const).map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setWalletProvider(w)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                          walletProvider === w
                            ? "bg-[#105B38] text-white shadow-sm"
                            : "bg-white border border-[#E2E8F0] text-[#64748B]"
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#475569] block mb-1">
                      Registered Mobile Wallet Number
                    </label>
                    <input
                      type="tel"
                      value={walletPhone}
                      onChange={(e) => setWalletPhone(e.target.value)}
                      placeholder="0335 8341897"
                      className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-xs focus:outline-none focus:ring-1 focus:ring-[#105B38] font-mono bg-white"
                    />
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                    <p className="text-xs font-bold text-amber-900 mb-1">
                      WhatsApp Chamber Helpline Available
                    </p>
                    <p className="text-[11px] text-amber-800">
                      Need manual wallet transfer assistance? WhatsApp our Chamber Team:{" "}
                      <a
                        href="https://wa.me/923358341897"
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold underline text-[#105B38]"
                      >
                        0335 8341897
                      </a>
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 4: Bank Wire Content */}
              {paymentMethod === "wire" && (
                <div className="space-y-3 bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                    <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#105B38]" />
                      Habib Bank Limited (HBL) Chamber Wire Account
                    </span>
                    <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">
                      Direct Corporate
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-[#E2E8F0] space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Account Title:</span>
                      <span className="font-bold text-[#0F172A]">AL WAKEELO LEGAL TECHNOLOGIES (PVT) LTD</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Bank:</span>
                      <span className="font-semibold text-[#0F172A]">Habib Bank Limited (HBL) - Supreme Court Branch</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Account No:</span>
                      <span className="font-mono font-bold text-[#0F172A]">0042-7991-8201-03</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-[#F1F5F9]">
                      <span className="text-[#64748B]">IBAN:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#105B38]">PK36 HABB 0000 4279 9182 0103</span>
                        <button
                          type="button"
                          onClick={handleCopyIban}
                          className="text-[10px] text-[#105B38] font-bold hover:underline"
                        >
                          {copiedIban ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#475569] block mb-1">
                      Deposit / Transfer Reference Code (if already wired)
                    </label>
                    <input
                      type="text"
                      value={wireRefCode}
                      onChange={(e) => setWireRefCode(e.target.value)}
                      placeholder="e.g. HBL-FT-891024"
                      className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-xs focus:outline-none focus:ring-1 focus:ring-[#105B38] font-mono bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Order Summary & Action Card (5 Cols) */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-sm sticky top-20">
              <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[#105B38]" />
                  <h3 className="text-base font-bold font-serif text-[#0F172A]">
                    Order Summary & Tax
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

                <div className="flex items-center justify-between text-[#475569]">
                  <span>Taxable Subtotal:</span>
                  <span className="font-mono font-semibold text-[#0F172A]">PKR {taxableAmount.toLocaleString("en-US")}</span>
                </div>

                <div className="flex items-center justify-between text-[#475569]">
                  <span>
                    Provincial Sales Tax ({currentProvince.name} {currentProvince.rate}%):
                  </span>
                  <span className="font-mono font-semibold text-[#0F172A]">
                    {taxAmount === 0 ? "Exempt / PKR 0" : `+ PKR ${taxAmount.toLocaleString("en-US")}`}
                  </span>
                </div>

                <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold font-serif text-[#0F172A] block">Net Payable Amount</span>
                    <span className="text-[10px] text-[#64748B]">All statutory taxes included</span>
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
                    <span>Processing Chamber Order...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Authorize & Complete Payment (PKR {finalTotal.toLocaleString("en-US")})</span>
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
