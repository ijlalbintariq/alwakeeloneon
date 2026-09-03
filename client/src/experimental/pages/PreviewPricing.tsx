import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Check,
  X,
  Sparkles,
  Shield,
  ShieldCheck,
  Zap,
  Crown,
  Users,
  Building2,
  Scale,
  FileText,
  Search,
  BookOpen,
  Cpu,
  Layers,
  ArrowRight,
  ChevronDown,
  HelpCircle,
  Mail,
  Phone,
  MessageSquare,
  CheckCircle2,
  ExternalLink,
  Award,
  Lock,
  Download,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import "@/experimental/styles/preview-theme.css";

export type BillingCycle = "monthly" | "quarterly" | "yearly";

export interface PlanTier {
  id: string;
  name: string;
  badge?: string;
  monthlyPricePkr: number;
  description: string;
  seats: string;
  aiActions: string;
  popular?: boolean;
  highlighted?: boolean;
  ctaText: string;
  ctaAction?: "checkout" | "enterprise_modal";
  keyFeatures: string[];
}

export const PRICING_PLANS: PlanTier[] = [
  {
    id: "starter",
    name: "Free Starter",
    badge: "Solo Counsel",
    monthlyPricePkr: 0,
    description: "Essential legal research tools for young advocates & solo legal practitioners.",
    seats: "1 Advocate Seat",
    aiActions: "10 AI Actions / mo",
    ctaText: "Start Free",
    ctaAction: "checkout",
    keyFeatures: [
      "10 AI Actions per month",
      "Standard AI model access",
      "Full 83,117 Pakistani Statutes & 5,887 Acts access",
      "Limitation Act Schedule calculator",
      "Up to 10 case file uploads (100 pages PDF chat)",
      "Standard court petition templates",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    badge: "Practitioner",
    monthlyPricePkr: 500,
    description: "Designed for active courtroom advocates needing reliable daily case research.",
    seats: "1 Advocate Seat",
    aiActions: "120 AI Actions / mo",
    ctaText: "Choose Standard",
    ctaAction: "checkout",
    keyFeatures: [
      "120 AI Actions per month",
      "Standard AI model (8,192 tokens/request)",
      "600k+ SC & High Court case law citations",
      "Court Fee Calculator across 5 provinces",
      "Up to 30 case uploads (250 pages PDF chat)",
      "Daily Court Diary & Cause List tracker",
      "Export to Court-Ready DOCX & PDF",
    ],
  },
  {
    id: "pro",
    name: "Senior Counsel Pro",
    badge: "Most Popular",
    monthlyPricePkr: 1000,
    popular: true,
    highlighted: true,
    description: "Advanced intelligence & drafting suite for busy advocates and senior counsel.",
    seats: "1 Advocate Seat",
    aiActions: "350 AI Actions / mo",
    ctaText: "Upgrade to Pro",
    ctaAction: "checkout",
    keyFeatures: [
      "350 AI Actions per month",
      "Standard + Turbo AI models (8,192 tokens)",
      "Pinpoint Citation Reader & Overruled badging",
      "Interactive Precedent Network Citation Graph",
      "6-Pillar Procedural Compliance (O.7 R.11 CPC)",
      "Microsoft Word Add-in Manifest (.xml)",
      "Up to 100 case uploads (500 pages PDF chat)",
      "Style-Memory RAG & Custom Pleading Voice",
    ],
  },
  {
    id: "chamber",
    name: "Chamber Team",
    badge: "Chamber Practice",
    monthlyPricePkr: 4500,
    description: "Collaborative multi-counsel workstation for established law firms & chambers.",
    seats: "Up to 3 Counsel Seats",
    aiActions: "1,200 AI Actions / mo (Pooled)",
    ctaText: "Choose Chamber",
    ctaAction: "checkout",
    keyFeatures: [
      "1,200 AI Actions per month (pooled team quota)",
      "Up to 3 full Advocate User Seats",
      "Standard + Turbo + Apex AI models",
      "180 Apex Deep Reasoning requests/mo",
      "Multi-counsel matter reassignment & docket",
      "Shared Chamber Knowledge Vault & Bookmarks",
      "Commercial Contract Studio (24+ templates)",
      "Up to 300 case uploads (1,500 pages PDF chat)",
      "Claude & ChatGPT MCP Server Integration",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise Chamber",
    badge: "Institutional",
    monthlyPricePkr: 50000,
    description: "Custom high-volume platform for large law firms, corporate legal & bar councils.",
    seats: "Custom Seats (10+)",
    aiActions: "30,000+ AI Actions / mo",
    ctaText: "Contact Chamber",
    ctaAction: "enterprise_modal",
    keyFeatures: [
      "30,000+ AI Actions/month with custom burst",
      "Custom advocate seats & role matrix",
      "Full Apex access (4,500 Apex requests/mo)",
      "Priority GPU cluster routing (<5s latency)",
      "Dedicated Chamber Account Manager & 99.9% SLA",
      "Private On-Premise / Hybrid Vector DB",
      "Custom Bar Council Single Sign-On (SAML)",
      "Tailored AI fine-tuning on chamber precedents",
    ],
  },
];

interface FeatureMatrixRow {
  name: string;
  category: string;
  tooltip?: string;
  starter: string | boolean;
  standard: string | boolean;
  pro: string | boolean;
  chamber: string | boolean;
  enterprise: string | boolean;
}

const FEATURE_MATRIX: FeatureMatrixRow[] = [
  // 1. Legal AI & Research Capabilities
  {
    name: "Monthly AI Actions Quota",
    category: "Legal AI & Precedent Research",
    starter: "10 actions",
    standard: "120 actions",
    pro: "350 actions",
    chamber: "1,200 actions (pooled)",
    enterprise: "30,000+ actions (custom)",
  },
  {
    name: "83,117 Pakistani Statutes & 5,887 Acts Browser",
    category: "Legal AI & Precedent Research",
    starter: true,
    standard: true,
    pro: true,
    chamber: true,
    enterprise: true,
  },
  {
    name: "600,000+ Landmark Judgments & Precedents (PLD/SCMR/YLR)",
    category: "Legal AI & Precedent Research",
    starter: "Basic Search",
    standard: "Full Search",
    pro: "Full Search + Pinpoint",
    chamber: "Full Search + Pinpoint",
    enterprise: "Full Search + Direct DB Access",
  },
  {
    name: "AI Models Included",
    category: "Legal AI & Precedent Research",
    starter: "Standard 3.5",
    standard: "Standard 3.5",
    pro: "Standard + Turbo 4.0",
    chamber: "Standard + Turbo + Apex",
    enterprise: "All Models + Priority Apex",
  },
  {
    name: "Apex Deep Legal Reasoning (0.1% Hallucination)",
    category: "Legal AI & Precedent Research",
    starter: false,
    standard: false,
    pro: false,
    chamber: "180 reqs / mo",
    enterprise: "4,500+ reqs / mo",
  },
  {
    name: "Pinpoint Citation Parser & Overruled Flagging",
    category: "Legal AI & Precedent Research",
    starter: false,
    standard: "Citation Parser",
    pro: true,
    chamber: true,
    enterprise: true,
  },
  {
    name: "Interactive Precedent Network Citation Graph",
    category: "Legal AI & Precedent Research",
    starter: false,
    standard: false,
    pro: true,
    chamber: true,
    enterprise: true,
  },

  // 2. Legal Drafting & Procedural Compliance
  {
    name: "Pakistani Court Petition Drafting Studio",
    category: "Drafting & Procedural Compliance",
    starter: "Standard Templates",
    standard: "Full Drafting Studio",
    pro: "Full Studio + AI Refiner",
    chamber: "Full Studio + Multi-tab",
    enterprise: "Custom Chamber Templates",
  },
  {
    name: "Commercial & Property Contract Studio (24+ Agreements)",
    category: "Drafting & Procedural Compliance",
    starter: false,
    standard: "Basic Deeds",
    pro: "All 24 Templates",
    chamber: "Full Studio + Redlines",
    enterprise: "Full Studio + Redlines",
  },
  {
    name: "6-Pillar Procedural Compliance Audit (O.7 R.11 CPC)",
    category: "Drafting & Procedural Compliance",
    starter: false,
    standard: "Basic Check",
    pro: true,
    chamber: true,
    enterprise: true,
  },
  {
    name: "Limitation Act Schedule & Section 4 Rollover Engine",
    category: "Drafting & Procedural Compliance",
    starter: true,
    standard: true,
    pro: true,
    chamber: true,
    enterprise: true,
  },
  {
    name: "Provincial Court Fee & Pecuniary Calculator (5 Provinces)",
    category: "Drafting & Procedural Compliance",
    starter: true,
    standard: true,
    pro: true,
    chamber: true,
    enterprise: true,
  },
  {
    name: "Style-Memory RAG & Custom Chamber Pleading Voice",
    category: "Drafting & Procedural Compliance",
    starter: false,
    standard: false,
    pro: true,
    chamber: true,
    enterprise: "Custom Fine-tuned Voice",
  },

  // 3. Document Management & Integrations
  {
    name: "Microsoft 365 Word Add-in Manifest (.xml)",
    category: "Integrations & Document Vault",
    starter: false,
    standard: false,
    pro: true,
    chamber: true,
    enterprise: "Enterprise Add-in Deploy",
  },
  {
    name: "Case Matter Dossiers & Case Documents Vault",
    category: "Integrations & Document Vault",
    starter: "10 files (100 pgs)",
    standard: "30 files (250 pgs)",
    pro: "100 files (500 pgs)",
    chamber: "300 files (1,500 pgs)",
    enterprise: "Unlimited / Custom",
  },
  {
    name: "Daily Court Diary & Cause List Sync",
    category: "Integrations & Document Vault",
    starter: false,
    standard: true,
    pro: true,
    chamber: true,
    enterprise: true,
  },
  {
    name: "Whisper Legal Voice Transcription",
    category: "Integrations & Document Vault",
    starter: false,
    standard: "15 mins / mo",
    pro: "60 mins / mo",
    chamber: "300 mins / mo",
    enterprise: "Unlimited",
  },
  {
    name: "Claude & ChatGPT MCP Server Integration",
    category: "Integrations & Document Vault",
    starter: false,
    standard: false,
    pro: false,
    chamber: true,
    enterprise: "Full API & Webhooks",
  },

  // 4. Chamber Collaboration & Security
  {
    name: "Multi-Counsel User Seats",
    category: "Chamber Collaboration & Security",
    starter: "1 Seat",
    standard: "1 Seat",
    pro: "1 Seat",
    chamber: "Up to 3 Seats",
    enterprise: "Custom 10+ Seats",
  },
  {
    name: "Multi-Advocate Pooled AI Quotas",
    category: "Chamber Collaboration & Security",
    starter: false,
    standard: false,
    pro: false,
    chamber: true,
    enterprise: true,
  },
  {
    name: "Shared Chamber Vault & Bookmarks Bank",
    category: "Chamber Collaboration & Security",
    starter: false,
    standard: false,
    pro: false,
    chamber: true,
    enterprise: true,
  },
  {
    name: "Complete Audit Logs & Query Re-run History",
    category: "Chamber Collaboration & Security",
    starter: "7 Days",
    standard: "30 Days",
    pro: "90 Days",
    chamber: "365 Days",
    enterprise: "Unlimited Retained",
  },
  {
    name: "Dedicated Chamber Account Manager & SLA",
    category: "Chamber Collaboration & Security",
    starter: false,
    standard: false,
    pro: "Standard Email Support",
    chamber: "Priority WhatsApp Support",
    enterprise: "Dedicated Manager (99.9% SLA)",
  },
];

const FAQS = [
  {
    q: "Which Pakistani payment methods do you support?",
    a: "We support secure online card payments via Safepay (supporting all Visa, Mastercard, and PayPak debit and credit cards issued by Pakistani and international banks).",
  },
  {
    q: "How does multi-seat pooled AI quota work for the Chamber Plan?",
    a: "On the Chamber Plan (PKR 4,500/mo), you receive 3 user seats for your partners and associates with a shared pool of 1,200 AI actions and 180 Apex deep reasoning queries. Any advocate in your chamber can draw from the pool, with full visibility and usage telemetry in the Admin Panel.",
  },
  {
    q: "What happens if our chamber consumes all monthly AI actions before renewal?",
    a: "You will never lose access to your saved case files, bookmarks, or 83k statutory lookups. You can seamlessly top up on-demand action packs or upgrade your tier directly from your Chamber Dashboard with pro-rated credit for the remainder of your billing cycle.",
  },
  {
    q: "Is our confidential client pleading data encrypted and protected by advocate-client privilege?",
    a: "Yes. Alwakeelo employs strict tenant isolation with AES-256 encryption at rest and TLS 1.3 in transit. We maintain a strict zero-retention policy for AI model training: your uploaded briefs, pleadings, and client notes are never used to train public models.",
  },
  {
    q: "How does the Microsoft Word Add-in work with our subscription?",
    a: "Advocates on Pro, Chamber, and Enterprise plans can download the Alwakeelo Word Add-in manifest file. It brings the full 83k statutes lookup, 600k judgment search, and contract risk scanner directly into Microsoft Word (Desktop & Web) without switching windows.",
  },
  {
    q: "Can we switch between Monthly, Quarterly, and Yearly billing cycles?",
    a: "Yes. You can switch your billing frequency at any time in Account Settings. Choosing a Quarterly cycle grants a 10% discount, while an Annual cycle provides a 20% discount on your overall retainer.",
  },
];

export default function PreviewPricing() {
  const [, navigate] = useLocation();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [enterpriseModalOpen, setEnterpriseModalOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Enterprise Quote Modal Form State
  const [quoteName, setQuoteName] = useState("");
  const [quoteChamber, setQuoteChamber] = useState("");
  const [quoteEmail, setQuoteEmail] = useState("");
  const [quotePhone, setQuotePhone] = useState("");
  const [quoteSeats, setQuoteSeats] = useState("10-25");
  const [quoteCourt, setQuoteCourt] = useState("Lahore High Court");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [quoteSubmitted, setQuoteSubmitted] = useState(false);
  const [quoteRef, setQuoteRef] = useState("");

  const calculatePrice = (monthlyPkr: number, selectedCycle: BillingCycle) => {
    if (monthlyPkr === 0) return { total: 0, perMonth: 0, savings: 0, label: "Free Forever" };
    if (selectedCycle === "monthly") {
      return {
        total: monthlyPkr,
        perMonth: monthlyPkr,
        savings: 0,
        label: `PKR ${monthlyPkr.toLocaleString("en-US")}/mo`,
      };
    }
    if (selectedCycle === "quarterly") {
      const total = Math.round(monthlyPkr * 3 * 0.9);
      const perMonth = Math.round(total / 3);
      const savings = monthlyPkr * 3 - total;
      return {
        total,
        perMonth,
        savings,
        label: `PKR ${total.toLocaleString("en-US")} / 3 mos`,
      };
    }
    // yearly
    const total = Math.round(monthlyPkr * 12 * 0.8);
    const perMonth = Math.round(total / 12);
    const savings = monthlyPkr * 12 - total;
    return {
      total,
      perMonth,
      savings,
      label: `PKR ${total.toLocaleString("en-US")} / yr`,
    };
  };

  const handlePlanSelect = (plan: PlanTier) => {
    if (plan.ctaAction === "enterprise_modal") {
      setEnterpriseModalOpen(true);
    } else {
      navigate(`/preview/checkout?plan=${plan.id}&cycle=${cycle}`);
    }
  };

  const handleQuoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const generatedRef = "";
    setQuoteRef(generatedRef);
    setQuoteSubmitted(true);
  };

  const resetQuoteModal = () => {
    setEnterpriseModalOpen(false);
    setTimeout(() => {
      setQuoteSubmitted(false);
      setQuoteName("");
      setQuoteChamber("");
      setQuoteEmail("");
      setQuotePhone("");
      setQuoteNotes("");
    }, 300);
  };

  return (
    <div className="preview-theme-scope min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans selection:bg-[#105B38]/20 selection:text-[#0F172A]">
      {/* 1. Public Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/preview" className="flex items-center gap-2.5 group">
            <img src="/logo.svg" alt="Al Wakeelo" className="w-9 h-9 object-contain transition-transform group-hover:scale-105" />
            <div>
              <span className="text-base font-bold tracking-tight text-[#0F172A] font-serif block">
                AL WAKEELO
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#105B38] block -mt-1 font-semibold">
                CHAMBERS WORKSPACE
              </span>
            </div>
          </Link>
          <span className="hidden md:inline-block text-xs font-mono px-2 py-0.5 rounded-full bg-[#EBF5F0] text-[#105B38] border border-[#A3D4BC] font-semibold">
            PREVIEW MODE
          </span>
        </div>

        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#475569]">
          <Link href="/preview" className="hover:text-[#105B38] transition-colors">
            Home
          </Link>
          <Link href="/preview/statutes" className="hover:text-[#105B38] transition-colors">
            83k Statutes
          </Link>
          <Link href="/preview/pricing" className="text-[#105B38] font-bold">
            Pricing & Plans
          </Link>
          <Link href="/preview/about" className="hover:text-[#105B38] transition-colors">
            About
          </Link>
          <Link href="/preview/contact" className="hover:text-[#105B38] transition-colors">
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/preview/auth"
            className="text-xs font-bold text-[#334155] hover:text-[#105B38] px-3 py-2 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/preview/dashboard"
            className="text-xs font-bold bg-[#105B38] hover:bg-[#0D4A2E] text-white px-3.5 py-2 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
          >
            <span>Open Workstation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="px-4 sm:px-8 pt-12 pb-8 max-w-7xl mx-auto w-full text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF5F0] border border-[#A3D4BC] text-[#105B38] text-xs font-mono font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>TRANSPARENT PAKISTANI RUPEE PRICING · NO HIDDEN FEES</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold font-serif tracking-tight text-[#0F172A] max-w-3xl mx-auto mb-4">
          Chambers Subscriptions & AI Legal Intelligence Plans
        </h1>
        <p className="text-sm sm:text-base text-[#475569] max-w-2xl mx-auto mb-8">
          Empower your practice with instant precedent research, 83,117 Pakistani statutes,
          court-ready petition drafting, and multi-counsel collaboration.
        </p>

        {/* Billing Cycle Selector Switch */}
        <div className="inline-flex items-center p-1.5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm mb-10 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setCycle("monthly")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              cycle === "monthly"
                ? "bg-[#105B38] text-white shadow-sm"
                : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            Monthly Retainer
          </button>

          <button
            type="button"
            onClick={() => setCycle("quarterly")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              cycle === "quarterly"
                ? "bg-[#105B38] text-white shadow-sm"
                : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            <span>Quarterly (3 Mos)</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                cycle === "quarterly"
                  ? "bg-white/20 text-white"
                  : "bg-[#EBF5F0] text-[#105B38]"
              }`}
            >
              SAVE 10%
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCycle("yearly")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              cycle === "yearly"
                ? "bg-[#105B38] text-white shadow-sm"
                : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            <span>Annual Chambers</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                cycle === "yearly"
                  ? "bg-white/20 text-white"
                  : "bg-[#EBF5F0] text-[#105B38]"
              }`}
            >
              SAVE 20%
            </span>
          </button>
        </div>

        {/* 3. Pricing Cards Grid (5 Tiers) */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5 text-left">
          {PRICING_PLANS.map((plan) => {
            const pricing = calculatePrice(plan.monthlyPricePkr, cycle);

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 ${
                  plan.popular
                    ? "bg-white border-2 border-[#105B38] shadow-lg shadow-[#105B38]/10 ring-2 ring-[#105B38]/20"
                    : "bg-white border border-[#E2E8F0] shadow-sm hover:border-[#CBD5E1]"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#105B38] text-white text-[10px] font-mono font-bold uppercase tracking-wider shadow-sm flex items-center gap-1">
                    <Crown className="w-3 h-3 text-[#C5A880]" />
                    <span>MOST POPULAR</span>
                  </div>
                )}

                <div>
                  {/* Top Metadata */}
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-bold text-[#0F172A] font-serif">
                      {plan.name}
                    </h2>
                    {plan.badge && (
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                        {plan.badge}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#64748B] min-h-[36px] mb-4 leading-relaxed">
                    {plan.description}
                  </p>

                  {/* Price Tag */}
                  <div className="mb-4 pb-4 border-b border-[#F1F5F9]">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black font-mono text-[#0F172A] tracking-tight">
                        {plan.monthlyPricePkr === 0
                          ? "PKR 0"
                          : `PKR ${
                              cycle === "monthly"
                                ? plan.monthlyPricePkr.toLocaleString("en-US")
                                : pricing.perMonth.toLocaleString("en-US")
                            }`}
                      </span>
                      <span className="text-xs text-[#64748B] font-medium">/mo</span>
                    </div>

                    {cycle !== "monthly" && plan.monthlyPricePkr > 0 && (
                      <p className="text-[11px] text-[#105B38] font-mono mt-1 font-semibold flex items-center justify-between">
                        <span>Billed {pricing.label}</span>
                        {pricing.savings > 0 && (
                          <span className="text-[10px] bg-[#EBF5F0] px-1.5 py-0.2 rounded font-bold">
                            Save PKR {pricing.savings.toLocaleString("en-US")}
                          </span>
                        )}
                      </p>
                    )}

                    <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-[#475569] bg-[#F8FAFC] p-2 rounded-lg border border-[#E2E8F0]">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[#105B38]" />
                        {plan.seats}
                      </span>
                      <span className="font-semibold text-[#0F172A]">{plan.aiActions}</span>
                    </div>
                  </div>

                  {/* Feature Bullets */}
                  <ul className="space-y-2.5 mb-6 text-xs text-[#334155]">
                    {plan.keyFeatures.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-[#105B38] shrink-0 mt-0.5" />
                        <span className="leading-snug">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Card CTA Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handlePlanSelect(plan)}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                      plan.popular
                        ? "bg-[#105B38] hover:bg-[#0D4A2E] text-white"
                        : plan.id === "enterprise"
                        ? "bg-[#0F172A] hover:bg-[#1E293B] text-white"
                        : "bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A]"
                    }`}
                  >
                    <span>{plan.ctaText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Comprehensive Feature Comparison Matrix (20+ Capabilities) */}
      <section className="px-4 sm:px-8 py-16 max-w-7xl mx-auto w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF5F0] border border-[#A3D4BC] text-[#105B38] text-xs font-mono font-semibold mb-3">
            <Layers className="w-3.5 h-3.5" />
            <span>20+ SPECIALIZED CAPABILITIES</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold font-serif text-[#0F172A] tracking-tight">
            Detailed Chamber Feature Matrix
          </h2>
          <p className="text-sm text-[#64748B] max-w-2xl mx-auto mt-2">
            Compare all 5 tiers side-by-side to choose the exact operational scope your practice requires.
          </p>
        </div>

        {/* Feature Matrix Table */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#0F172A]">
                  <th className="p-4 font-bold font-serif text-sm w-1/3">Feature / Capability</th>
                  <th className="p-4 font-bold text-center">Starter (PKR 0)</th>
                  <th className="p-4 font-bold text-center">Standard (PKR 500)</th>
                  <th className="p-4 font-bold text-center bg-[#EBF5F0]/60 text-[#105B38]">
                    Pro (PKR 1,000)
                  </th>
                  <th className="p-4 font-bold text-center">Chamber (PKR 4,500)</th>
                  <th className="p-4 font-bold text-center">Enterprise (PKR 50k+)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {Array.from(new Set(FEATURE_MATRIX.map((r) => r.category))).map((cat) => (
                  <React.Fragment key={cat}>
                    <tr className="bg-[#F1F5F9]/80">
                      <td
                        colSpan={6}
                        className="px-4 py-2.5 font-bold font-mono text-[11px] text-[#105B38] uppercase tracking-wider"
                      >
                        {cat}
                      </td>
                    </tr>
                    {FEATURE_MATRIX.filter((r) => r.category === cat).map((row, idx) => (
                      <tr key={idx} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="p-4 font-medium text-[#1E293B] flex items-center gap-1.5">
                          <span>{row.name}</span>
                        </td>

                        {/* Starter */}
                        <td className="p-4 text-center text-[#475569]">
                          {typeof row.starter === "boolean" ? (
                            row.starter ? (
                              <Check className="w-4 h-4 text-[#105B38] mx-auto" />
                            ) : (
                              <X className="w-4 h-4 text-[#94A3B8] mx-auto opacity-50" />
                            )
                          ) : (
                            <span className="font-medium">{row.starter}</span>
                          )}
                        </td>

                        {/* Standard */}
                        <td className="p-4 text-center text-[#475569]">
                          {typeof row.standard === "boolean" ? (
                            row.standard ? (
                              <Check className="w-4 h-4 text-[#105B38] mx-auto" />
                            ) : (
                              <X className="w-4 h-4 text-[#94A3B8] mx-auto opacity-50" />
                            )
                          ) : (
                            <span className="font-medium">{row.standard}</span>
                          )}
                        </td>

                        {/* Pro */}
                        <td className="p-4 text-center bg-[#EBF5F0]/20 text-[#0F172A] font-semibold">
                          {typeof row.pro === "boolean" ? (
                            row.pro ? (
                              <Check className="w-4 h-4 text-[#105B38] mx-auto" />
                            ) : (
                              <X className="w-4 h-4 text-[#94A3B8] mx-auto opacity-50" />
                            )
                          ) : (
                            <span>{row.pro}</span>
                          )}
                        </td>

                        {/* Chamber */}
                        <td className="p-4 text-center text-[#0F172A] font-medium">
                          {typeof row.chamber === "boolean" ? (
                            row.chamber ? (
                              <Check className="w-4 h-4 text-[#105B38] mx-auto" />
                            ) : (
                              <X className="w-4 h-4 text-[#94A3B8] mx-auto opacity-50" />
                            )
                          ) : (
                            <span>{row.chamber}</span>
                          )}
                        </td>

                        {/* Enterprise */}
                        <td className="p-4 text-center text-[#0F172A] font-semibold">
                          {typeof row.enterprise === "boolean" ? (
                            row.enterprise ? (
                              <Check className="w-4 h-4 text-[#105B38] mx-auto" />
                            ) : (
                              <X className="w-4 h-4 text-[#94A3B8] mx-auto opacity-50" />
                            )
                          ) : (
                            <span className="text-[#105B38] font-bold">{row.enterprise}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 5. Enterprise Custom Solution Banner */}
      <section className="px-4 sm:px-8 py-10 max-w-7xl mx-auto w-full">
        <div className="rounded-3xl bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#105B38] text-white p-8 sm:p-12 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-mono mb-4 border border-white/20">
              <Building2 className="w-3.5 h-3.5 text-[#C5A880]" />
              <span>FOR BAR COUNCILS, HIGH COURT ASSOCIATIONS & CORPORATE LEGAL</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-serif tracking-tight mb-3">
              Need on-premise deployment or custom volume?
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              We provide dedicated vector databases, single sign-on (SSO), custom AI fine-tuning
              on your chamber’s historical brief archive, and dedicated SLAs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnterpriseModalOpen(true)}
            className="shrink-0 bg-white hover:bg-slate-100 text-[#0F172A] px-6 py-3.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4 text-[#105B38]" />
            <span>Request Enterprise Consultation</span>
          </button>
        </div>
      </section>

      {/* 6. FAQ Accordion Section */}
      <section className="px-4 sm:px-8 py-16 max-w-4xl mx-auto w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF5F0] border border-[#A3D4BC] text-[#105B38] text-xs font-mono font-semibold mb-3">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>FREQUENTLY ASKED QUESTIONS</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-serif text-[#0F172A] tracking-tight">
            Chamber Subscriptions & Billing FAQs
          </h2>
          <p className="text-sm text-[#64748B] mt-2">
            Everything you need to know about payments, multi-advocate quotas, and data security.
          </p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-serif font-bold text-sm sm:text-base text-[#0F172A] hover:text-[#105B38] transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#64748B] shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-[#105B38]" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 pt-0 text-xs sm:text-sm text-[#475569] leading-relaxed border-t border-[#F1F5F9]">
                    <p className="mt-3">{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="mt-auto bg-white border-t border-[#E2E8F0] px-4 sm:px-8 py-8 text-xs text-[#64748B]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#105B38]" />
            <span className="font-bold text-[#0F172A] font-serif">AL WAKEELO</span>
            <span>· Pakistan's Legal AI Workstation</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/preview/terms" className="hover:text-[#105B38] transition-colors">
              Terms of Service
            </Link>
            <Link href="/preview/privacy" className="hover:text-[#105B38] transition-colors">
              Privacy Policy
            </Link>
            <Link href="/preview/refund-policy" className="hover:text-[#105B38] transition-colors">
              Refund Policy
            </Link>
            <Link href="/preview/contact" className="hover:text-[#105B38] transition-colors">
              Advocate Helpline: 0335 8341897
            </Link>
          </div>
        </div>
      </footer>

      {/* 8. Enterprise Quote Modal */}
      <Dialog open={enterpriseModalOpen} onOpenChange={(open) => !open && resetQuoteModal()}>
        <DialogContent className="sm:max-w-lg bg-white text-[#0F172A] p-6 max-h-[90vh] overflow-y-auto border-[#E2E8F0]">
          <DialogHeader>
            <div className="flex items-center gap-2 text-[#105B38] font-mono text-xs font-semibold mb-1">
              <Building2 className="w-4 h-4" />
              <span>CUSTOM CHAMBERS ENTERPRISE SOLUTION</span>
            </div>
            <DialogTitle className="text-xl font-bold font-serif text-[#0F172A]">
              Request Enterprise Quotation
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              For High Court bar associations, institutional legal departments, and multi-partner firms.
            </DialogDescription>
          </DialogHeader>

          {quoteSubmitted ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#EBF5F0] border-2 border-[#A3D4BC] flex items-center justify-center mx-auto text-[#105B38]">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold font-serif text-[#0F172A]">
                Quotation Request Dispatched!
              </h3>
              <p className="text-xs text-[#475569] leading-relaxed max-w-sm mx-auto">
                Thank you, Counsel. Your consultation reference is{" "}
                <span className="font-mono font-bold text-[#105B38]">{quoteRef}</span>. Our Senior
                Chambers Account Executive will contact you within 2 hours.
              </p>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={resetQuoteModal}
                  className="px-5 py-2.5 rounded-xl bg-[#105B38] text-white text-xs font-bold hover:bg-[#0D4A2E] transition-colors"
                >
                  Return to Pricing
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleQuoteSubmit} className="space-y-4 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#334155] block mb-1">
                    Counsel Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={quoteName}
                    onChange={(e) => setQuoteName(e.target.value)}
                    placeholder="Adv. Muhammad Tariq"
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-xs focus:outline-none focus:ring-1 focus:ring-[#105B38]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#334155] block mb-1">
                    Chamber / Firm Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={quoteChamber}
                    onChange={(e) => setQuoteChamber(e.target.value)}
                    placeholder="Tariq & Co. Legal Chambers"
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-xs focus:outline-none focus:ring-1 focus:ring-[#105B38]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#334155] block mb-1">
                    Official Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={quoteEmail}
                    onChange={(e) => setQuoteEmail(e.target.value)}
                    placeholder="tariq@chambers.pk"
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-xs focus:outline-none focus:ring-1 focus:ring-[#105B38]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#334155] block mb-1">
                    Contact / WhatsApp No. *
                  </label>
                  <input
                    type="tel"
                    required
                    value={quotePhone}
                    onChange={(e) => setQuotePhone(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-xs focus:outline-none focus:ring-1 focus:ring-[#105B38]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#334155] block mb-1">
                    Estimated Advocate Seats
                  </label>
                  <select
                    value={quoteSeats}
                    onChange={(e) => setQuoteSeats(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-xs focus:outline-none focus:ring-1 focus:ring-[#105B38] bg-white"
                  >
                    <option value="5-10">5 - 10 Advocates</option>
                    <option value="10-25">10 - 25 Advocates</option>
                    <option value="25-50">25 - 50 Advocates</option>
                    <option value="50+">50+ Advocates (Bar Council)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#334155] block mb-1">
                    Primary Jurisdiction Bench
                  </label>
                  <select
                    value={quoteCourt}
                    onChange={(e) => setQuoteCourt(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-xs focus:outline-none focus:ring-1 focus:ring-[#105B38] bg-white"
                  >
                    <option value="Supreme Court of Pakistan">Supreme Court of Pakistan</option>
                    <option value="Lahore High Court">Lahore High Court</option>
                    <option value="Sindh High Court">Sindh High Court</option>
                    <option value="Islamabad High Court">Islamabad High Court</option>
                    <option value="Peshawar High Court">Peshawar High Court</option>
                    <option value="Balochistan High Court">Balochistan High Court</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#334155] block mb-1">
                  Custom Requirements / Notes
                </label>
                <textarea
                  rows={3}
                  value={quoteNotes}
                  onChange={(e) => setQuoteNotes(e.target.value)}
                  placeholder="Mention any specific needs: On-premise deployment, custom vector storage, API access, or data privacy requirements..."
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-xs focus:outline-none focus:ring-1 focus:ring-[#105B38]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetQuoteModal}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-[#64748B] hover:text-[#0F172A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-sm transition-all"
                >
                  Submit Quote Request
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
