import { useMemo, useState } from "react";
import {
  ArrowRight,
  Search,
  FileText,
  BookOpen,
  Shield,
  Zap,
  Crown,
  Users,
  Mic,
  Paperclip,
  Globe,
  ChevronRight,
  LayoutDashboard,
  Menu,
  X,
  PhoneCall,
  Mail,
  Sun,
  Moon,
  Cpu,
  Terminal,
  Compass,
  Sparkles,
  Download,
  Scale,
  Gavel,
  ShieldCheck,
  Check,
} from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentHead } from "@/hooks/use-document-head";
import { useTheme } from "@/hooks/use-theme";
import {
  SUBSCRIPTION_PLANS,
  getPlanCyclePricing,
  type BillingCycle,
  type SubscriptionPlanKey,
} from "@/lib/subscription-plans";
import "@/experimental/styles/preview-theme.css";

function FeatureCard({
  icon: Icon,
  title,
  desc,
  bgClass,
  iconClass,
  badge,
  className = "",
}: {
  icon: any;
  title: string;
  desc: string;
  bgClass: string;
  iconClass: string;
  badge?: string;
  className?: string;
}) {
  return (
    <div
      className={`group h-full p-7 bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-2xl hover:border-[#105B38]/50 dark:hover:border-emerald-500/50 transition-all hover:shadow-xl hover:shadow-[#105B38]/5 dark:hover:shadow-none flex flex-col relative ${className}`}
    >
      {badge && (
        <span className="absolute top-4 right-4 inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-full text-[10px] text-amber-800 dark:text-amber-300 font-extrabold uppercase tracking-wider">
          <Sparkles size={10} className="animate-pulse" />
          {badge}
        </span>
      )}
      <div
        className={`w-12 h-12 rounded-xl ${bgClass} flex items-center justify-center mb-4 transition-transform group-hover:scale-105`}
      >
        <Icon size={22} className={iconClass} />
      </div>
      <h3 className="text-lg font-bold text-[#0F172A] dark:text-white mb-2 min-h-[3.25rem]">
        {title}
      </h3>
      <p className="text-sm text-[#475569] dark:text-slate-300 leading-relaxed flex-1">
        {desc}
      </p>
    </div>
  );
}

const CORE_FEATURES = [
  {
    icon: Crown,
    title: "AL WAKEELO Engine",
    desc: "Use the main legal AI workspace with grounded responses, references, and practical next-step guidance.",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/50 text-[#105B38] dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60",
    iconClass: "text-[#105B38] dark:text-emerald-400",
  },
  {
    icon: FileText,
    title: "Microsoft Word Add-in",
    desc: "Use AL WAKEELO directly inside MS Word to research case law, lookup 5,900+ statutes, audit contract risks, and draft petitions without leaving Word.",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/50 text-[#105B38] dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60",
    iconClass: "text-[#105B38] dark:text-emerald-400",
    badge: "New Feature",
  },
  {
    icon: Search,
    title: "Judgment Search",
    desc: "Find relevant Pakistani case law with quick citation-focused search and contextual summaries.",
    bgClass: "bg-blue-50 dark:bg-blue-950/50 border border-blue-200/60 dark:border-blue-800/60",
    iconClass: "text-blue-600 dark:text-blue-400",
  },
  {
    icon: BookOpen,
    title: "Citation Search",
    desc: "Search directly by year, journal, and page to locate precise judgments and linked details quickly.",
    bgClass: "bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/60",
    iconClass: "text-indigo-600 dark:text-indigo-400",
  },
  {
    icon: Scale,
    title: "Statute Lookup",
    desc: "Navigate Pakistani statutes and sections with plain-language legal explanations.",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/60",
    iconClass: "text-[#105B38] dark:text-emerald-400",
  },
  {
    icon: FileText,
    title: "Legal Drafting",
    desc: "Prepare petitions, notices, applications, and legal replies with structured templates, clause-ready sections, and style-consistent drafting support.",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/60",
    iconClass: "text-[#105B38] dark:text-emerald-400",
  },
  {
    icon: Users,
    title: "Style-Memory RAG",
    desc: "Train AI on your uploads, drafts, and accepted edits so output follows your legal style and preferred language.",
    bgClass: "bg-sky-50 dark:bg-sky-950/50 border border-sky-200/60 dark:border-sky-800/60",
    iconClass: "text-sky-600 dark:text-sky-400",
  },
  {
    icon: Shield,
    title: "Contract Drafting",
    desc: "Generate client-ready contracts with structured clause sets, risk score breakdown, redline suggestions, and cleaner final drafts for negotiation or execution.",
    bgClass: "bg-rose-50 dark:bg-rose-950/50 border border-rose-200/60 dark:border-rose-800/60",
    iconClass: "text-rose-600 dark:text-rose-400",
  },
  {
    icon: Cpu,
    title: "AI Integrations (MCP)",
    desc: "Connect AL WAKEELO's RAG database directly to Claude, ChatGPT, or Gemini settings using your secure API key.",
    bgClass: "bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/60",
    iconClass: "text-amber-600 dark:text-amber-400",
  },
  {
    icon: Paperclip,
    title: "Case Documents",
    desc: "Upload, review, and organize matter-specific documents with faster legal analysis support.",
    bgClass: "bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200/60 dark:border-cyan-800/60",
    iconClass: "text-cyan-600 dark:text-cyan-400",
  },
  {
    icon: BookOpen,
    title: "Knowledge Vault",
    desc: "Maintain private user documents and global admin legal resources for retrieval-grounded outputs.",
    bgClass: "bg-violet-50 dark:bg-violet-950/50 border border-violet-200/60 dark:border-violet-800/60",
    iconClass: "text-violet-600 dark:text-violet-400",
  },
  {
    icon: Users,
    title: "Organization Workspace",
    desc: "Support chamber and team workflows with shared access controls and collaboration-ready structure.",
    bgClass: "bg-teal-50 dark:bg-teal-950/50 border border-teal-200/60 dark:border-teal-800/60",
    iconClass: "text-teal-600 dark:text-teal-400",
  },
  {
    icon: Mic,
    title: "Audio Transcription",
    desc: "Convert legal voice notes and recorded audio into text for research, drafting, and case preparation.",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/60",
    iconClass: "text-[#105B38] dark:text-emerald-400",
  },
];

const FAQ_ITEMS = [
  {
    q: "Can I use AL WAKEELO for Pakistani case law research?",
    a: "Yes. You can search judgments, explore statutes, and use AI-assisted legal research workflows focused on Pakistani law.",
  },
  {
    q: "Does AL WAKEELO replace a licensed advocate?",
    a: "No. It supports legal research and drafting, but professional legal advice and representation should come from a licensed advocate.",
  },
  {
    q: "How can I contact the chamber for consultation?",
    a: "You can use Contact Chamber or Submit Case from the consultation flows to connect with the chamber.",
  },
  {
    q: "Is my information confidential?",
    a: "The platform is designed with privacy and access controls. For sensitive matters, always use official chamber consultation channels as well.",
  },
  {
    q: "Is AL WAKEELO discussed on Reddit or legal forums?",
    a: "Yes — Pakistani lawyers and legal researchers discuss AL WAKEELO on Reddit, legal tech communities, and professional networks. We actively welcome community feedback and incorporate it into platform improvements.",
  },
];

export default function PreviewLanding() {
  useDocumentHead({
    title: "AL WAKEELO AI - Pakistan Law Search & AI Legal Assistant | Digital Lawyer",
    description:
      "Pakistan's premier AI-powered digital lawyer and case law search. Search 600,000+ judgments (PLD, SCMR, YLR), search Pakistan Penal Code, CPC & CrPC, draft petitions, and generate legally binding contracts.",
    path: "/preview",
  });
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { resolvedTheme, toggle: toggleTheme } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanKey | "free">("pro");

  const landingPlans = useMemo(
    () => [
      {
        key: "free" as const,
        badge: "Free",
        title: "Free",
        monthlyPricePkr: 0,
        price: "PKR 0/mo",
        subtitle: "Starter access",
        cta: "Start Free",
        features: [
          "10 AI chats/month",
          "1 legal draft/month",
          "1 contract draft/month",
          "Mode access: Standard only",
          "Output cap: Standard 8,192 tokens/request",
          "Uploads: 10 files/month",
          "PDF upload in chat: up to 100 pages/month",
        ],
        highlighted: false,
      },
      ...SUBSCRIPTION_PLANS,
    ],
    []
  );

  const { data: platformMetrics } = useQuery<{
    legalDocuments: number;
    updatedAt: string;
  }>({
    queryKey: ["/api/public/platform-metrics"],
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const ctaTarget = user ? "/preview/dashboard" : "/preview/auth";
  const legalDocumentsCount = Math.max(0, Number(platformMetrics?.legalDocuments || 0));
  const legalDocumentsLabel =
    legalDocumentsCount > 0
      ? new Intl.NumberFormat("en-US").format(legalDocumentsCount)
      : "600,000+";

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <div className="preview-theme-scope min-h-screen bg-[#F8FAFC] dark:bg-[#0B131E] text-[#0F172A] dark:text-[#F8FAFC] overflow-x-hidden antialiased selection:bg-[#105B38]/20 selection:text-[#0F172A]">
      {/* ── 1. Header Navigation Bar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-[#0B131E]/90 backdrop-blur-xl border-b border-[#E2E8F0] dark:border-[#1E2D44]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate("/preview")}
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#105B38]/30 shadow-lg shadow-[#105B38]/10 bg-white dark:bg-[#131E2E] flex items-center justify-center">
              <img
                src="/logo.svg"
                alt="AL WAKEELO logo"
                className="w-full h-full object-cover"
              />
            </div>
            <span
              className="text-xl font-bold italic tracking-tight text-[#0F172A] dark:text-white"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              AL WAKEELO
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a
              href="/preview"
              onClick={(e) => {
                e.preventDefault();
                navigate("/preview");
              }}
              className="text-sm font-semibold text-[#105B38] dark:text-emerald-400 transition-colors"
            >
              Home
            </a>
            <a
              href="#features"
              className="text-sm font-medium text-[#475569] dark:text-[#CBD5E1] hover:text-[#105B38] dark:hover:text-emerald-400 transition-colors"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-sm font-medium text-[#475569] dark:text-[#CBD5E1] hover:text-[#105B38] dark:hover:text-emerald-400 transition-colors"
            >
              Pricing
            </a>
            <a
              href="/preview/about"
              onClick={(e) => {
                e.preventDefault();
                navigate("/preview/about");
              }}
              className="text-sm font-medium text-[#475569] dark:text-[#CBD5E1] hover:text-[#105B38] dark:hover:text-emerald-400 transition-colors"
            >
              About
            </a>
            <a
              href="/preview/contact"
              onClick={(e) => {
                e.preventDefault();
                navigate("/preview/contact");
              }}
              className="text-sm font-medium text-[#475569] dark:text-[#CBD5E1] hover:text-[#105B38] dark:hover:text-emerald-400 transition-colors"
            >
              Contact
            </a>
            <a
              href="/preview/faq"
              onClick={(e) => {
                e.preventDefault();
                navigate("/preview/faq");
              }}
              className="text-sm font-medium text-[#475569] dark:text-[#CBD5E1] hover:text-[#105B38] dark:hover:text-emerald-400 transition-colors"
            >
              FAQ
            </a>
            <a
              href="/preview/blog"
              onClick={(e) => {
                e.preventDefault();
                navigate("/preview/blog");
              }}
              className="text-sm font-medium text-[#475569] dark:text-[#CBD5E1] hover:text-[#105B38] dark:hover:text-emerald-400 transition-colors"
            >
              Blog
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="h-10 w-10 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] text-[#334155] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#1B293E] p-0 inline-flex items-center justify-center transition-colors shadow-xs"
              aria-label={
                resolvedTheme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              data-testid="landing-theme-toggle"
            >
              {resolvedTheme === "dark" ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-slate-700" />}
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              className="md:hidden h-10 w-10 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] text-[#334155] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#1B293E] p-0 inline-flex items-center justify-center shadow-xs"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            >
              {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <a
              href={ctaTarget}
              onClick={(e) => {
                e.preventDefault();
                navigate(ctaTarget);
              }}
              className="px-6 py-2.5 bg-[#105B38] text-white rounded-xl text-sm font-bold hover:bg-[#0D4A2E] transition-all shadow-lg shadow-[#105B38]/20 flex items-center gap-2"
            >
              {user ? (
                <>
                  <LayoutDashboard size={16} /> Dashboard
                </>
              ) : (
                "Start Now"
              )}
            </a>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden border-t border-[#E2E8F0] dark:border-[#1E2D44] bg-white/95 dark:bg-[#0B131E]/95 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-3">
              <a
                href="/preview"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileNavOpen(false);
                  navigate("/preview");
                }}
                className="text-sm font-semibold text-[#105B38] dark:text-emerald-400 transition-colors"
              >
                Home
              </a>
              <a
                href="#features"
                onClick={() => setMobileNavOpen(false)}
                className="text-sm font-medium text-[#334155] dark:text-[#CBD5E1] hover:text-[#105B38] transition-colors"
              >
                Features
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileNavOpen(false)}
                className="text-sm font-medium text-[#334155] dark:text-[#CBD5E1] hover:text-[#105B38] transition-colors"
              >
                Pricing
              </a>
              <a
                href="/preview/about"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileNavOpen(false);
                  navigate("/preview/about");
                }}
                className="text-sm font-medium text-[#334155] dark:text-[#CBD5E1] hover:text-[#105B38] transition-colors"
              >
                About
              </a>
              <a
                href="/preview/contact"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileNavOpen(false);
                  navigate("/preview/contact");
                }}
                className="text-sm font-medium text-[#334155] dark:text-[#CBD5E1] hover:text-[#105B38] transition-colors"
              >
                Contact
              </a>
              <a
                href="/preview/faq"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileNavOpen(false);
                  navigate("/preview/faq");
                }}
                className="text-sm font-medium text-[#334155] dark:text-[#CBD5E1] hover:text-[#105B38] transition-colors"
              >
                FAQ
              </a>
              <a
                href="/preview/blog"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileNavOpen(false);
                  navigate("/preview/blog");
                }}
                className="text-sm font-medium text-[#334155] dark:text-[#CBD5E1] hover:text-[#105B38] transition-colors"
              >
                Blog
              </a>
              <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#1E2D44] flex flex-col gap-2">
                <a
                  href="mailto:support@alwakeelo.com"
                  className="inline-flex items-center gap-2 text-sm text-[#105B38] dark:text-emerald-400 hover:underline transition-colors"
                >
                  <Mail size={14} /> support@alwakeelo.com
                </a>
                <a
                  href="tel:00923358341897"
                  className="inline-flex items-center gap-2 text-sm text-[#105B38] dark:text-emerald-400 hover:underline transition-colors"
                >
                  <PhoneCall size={14} /> 00923358341897
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ── 2. Hero Section ── */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-6">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#105B38]/5 dark:bg-emerald-500/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#105B38]/3 dark:bg-emerald-500/3 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-full mb-8">
            <span className="w-2 h-2 bg-[#105B38] dark:bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-[11px] text-[#105B38] dark:text-emerald-300 font-bold uppercase tracking-widest font-mono">
              Pakistan's First Open-Source Legal AI Platform
            </span>
          </div>

          <h1
            className="text-5xl md:text-7xl font-bold leading-tight mb-6 text-[#0F172A] dark:text-white"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            <span className="italic">AL WAKEELO AI Workspace</span>
            <br />
            <span className="text-[#105B38] dark:text-emerald-400 italic">
              for Advocates &amp; Chambers
            </span>
          </h1>

          <p className="text-lg md:text-xl text-[#475569] dark:text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed font-sans">
            Research case law, draft petitions and contracts, and generate
            client-ready legal documents in minutes with AL WAKEELO AI,
            fine-tuned for Pakistani legal practice.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={ctaTarget}
              onClick={(e) => {
                e.preventDefault();
                navigate(ctaTarget);
              }}
              className="w-full sm:w-auto px-8 py-4 bg-[#105B38] text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-[#0D4A2E] transition-all flex items-center justify-center gap-2 shadow-xl shadow-[#105B38]/20"
            >
              {user ? "Open Dashboard" : "Start Free"} <ArrowRight size={16} />
            </a>
            <a
              href="#consult"
              className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-white rounded-2xl text-sm font-bold hover:border-[#105B38] dark:hover:border-emerald-500 hover:text-[#105B38] dark:hover:text-emerald-400 transition-all flex items-center justify-center gap-2 shadow-xs"
            >
              Book Chamber Consultation <ArrowRight size={16} />
            </a>
          </div>

          <div className="mt-4">
            <a
              href="#features"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#105B38] dark:text-emerald-400 hover:underline transition-all"
            >
              Explore Features
              <ArrowRight size={14} />
            </a>
          </div>

          <div className="flex items-center justify-center gap-8 mt-12 text-[#64748B] dark:text-slate-400 flex-wrap">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-[#105B38] dark:text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Secure &amp; Encrypted (PECA 2016 Security &amp; Privilege)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-[#105B38] dark:text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Pakistani Law Focus
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Zap size={16} className="text-[#105B38] dark:text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider">
                AI Powered
              </span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Users size={16} className="text-[#105B38] dark:text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Discussed on Reddit
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. How It Works Section ── */}
      <section className="py-16 md:py-20 px-6 bg-white dark:bg-[#101926] border-y border-[#E2E8F0] dark:border-[#1E2D44]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] text-[#105B38] dark:text-emerald-400 font-black uppercase tracking-[0.3em] mb-3 font-mono">
              How It Works
            </p>
            <h2
              className="text-3xl md:text-4xl font-bold italic text-[#0F172A] dark:text-white"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              From Query to Consultation in 3 Steps
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                step: "01",
                title: "Ask or Upload (2 min)",
                desc: "Start with a legal query or upload your file to trigger focused legal analysis.",
              },
              {
                step: "02",
                title: "Get Cited Output (3 min)",
                desc: "Receive statutes, case references, and structured drafting output with practical direction.",
              },
              {
                step: "03",
                title: "Export or Consult (5 min)",
                desc: "Finalize your output, export documents, or escalate to chamber consultation.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-[#F8FAFC] dark:bg-[#131E2E] p-6 hover:border-[#105B38]/40 dark:hover:border-emerald-500/40 transition-all hover:shadow-md"
              >
                <p className="text-[11px] text-[#105B38] dark:text-emerald-400 font-black tracking-[0.3em] mb-2 font-mono">
                  {item.step}
                </p>
                <h3 className="text-[#0F172A] dark:text-white text-lg font-bold mb-2">
                  {item.title}
                </h3>
                <p className="text-[#475569] dark:text-slate-300 text-sm leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. MCP Integration Feature Section ── */}
      <section className="py-16 md:py-24 px-6 bg-gradient-to-b from-[#F8FAFC] to-white dark:from-[#0B131E] dark:to-[#101926] border-b border-[#E2E8F0] dark:border-[#1E2D44]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-full text-xs text-amber-800 dark:text-amber-300 font-bold uppercase tracking-widest font-mono">
              <Sparkles size={12} className="animate-pulse text-amber-600 dark:text-amber-400" />
              New Feature
            </div>
            <h2
              className="text-3xl md:text-5xl font-extrabold tracking-tight text-[#0F172A] dark:text-white leading-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Bring AL WAKEELO RAG <br />
              <span className="text-[#105B38] dark:text-emerald-400 italic">
                directly into Claude &amp; ChatGPT
              </span>
            </h2>
            <p className="text-sm md:text-base text-[#475569] dark:text-slate-300 leading-relaxed">
              Connect our massive database of 600,000+ judgments and laws
              directly to your own AI chatbot app. No more copying and
              pasting—simply generate a secure API Key and start searching
              Pakistan laws inside Claude Desktop, Claude Connectors, or
              Official ChatGPT Plugin.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <button
                type="button"
                onClick={() => navigate("/preview/mcp")}
                className="px-6 py-3 bg-[#105B38] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#0D4A2E] transition-all shadow-lg shadow-[#105B38]/20 flex items-center gap-2"
              >
                View MCP Integration Guide <ArrowRight size={13} />
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 relative">
            <div className="absolute inset-0 bg-[#105B38]/5 dark:bg-emerald-500/5 rounded-3xl blur-2xl -z-10" />
            <div className="rounded-3xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] p-6 md:p-8 space-y-6 shadow-xl shadow-slate-200/50 dark:shadow-none">
              <div className="flex gap-4 items-start border-b border-[#F1F5F9] dark:border-[#1E2D44] pb-4">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                  <Cpu size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] dark:text-white text-sm">
                    Claude Connectors
                  </h3>
                  <p className="text-xs text-[#475569] dark:text-slate-300 mt-1 leading-relaxed">
                    Paste our secure token URL directly into Claude Connectors
                    settings to list and call RAG search tools.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start border-b border-[#F1F5F9] dark:border-[#1E2D44] pb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-[#105B38] dark:text-emerald-400 shrink-0">
                  <Compass size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] dark:text-white text-sm">
                    Official ChatGPT Plugin
                  </h3>
                  <p className="text-xs text-[#475569] dark:text-slate-300 mt-1 leading-relaxed">
                    Search for AL WAKEELO in ChatGPT Plugins, connect your
                    account, and mention @AL WAKEELO directly in chat.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <Terminal size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] dark:text-white text-sm">
                    Google Gemini Spark
                  </h3>
                  <p className="text-xs text-[#475569] dark:text-slate-300 mt-1 leading-relaxed">
                    Bridge AL WAKEELO directly into Google Workspace Gemini
                    sessions using our stateful remote transport.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Official Microsoft Word Add-in Feature Section ── */}
      <section className="py-16 md:py-24 px-6 bg-gradient-to-b from-white to-[#F8FAFC] dark:from-[#101926] dark:to-[#0B131E] border-y border-[#E2E8F0] dark:border-[#1E2D44]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-full text-xs text-amber-800 dark:text-amber-300 font-extrabold uppercase tracking-widest font-mono">
                <Sparkles size={12} className="animate-pulse text-amber-600 dark:text-amber-400" />
                New Feature
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs text-[#105B38] dark:text-emerald-300 font-bold uppercase tracking-widest font-mono">
                <FileText size={14} />
                Official MS Word Add-in
              </div>
            </div>
            <h2
              className="text-3xl md:text-5xl font-extrabold tracking-tight text-[#0F172A] dark:text-white leading-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              AL WAKEELO Legal AI <br />
              <span className="text-[#105B38] dark:text-emerald-400 italic">
                Inside Microsoft Word
              </span>
            </h2>
            <p className="text-sm md:text-base text-[#475569] dark:text-slate-300 leading-relaxed">
              Research 600,000+ judgments, lookup 5,900+ statutes, audit
              commercial contracts for risk, and consult AI legal advisors—all
              without leaving your Word document.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <a
                href="/word-addin/manifest.xml"
                download="alwakeelo-manifest.xml"
                className="px-6 py-3.5 bg-[#105B38] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#0D4A2E] transition-all shadow-lg shadow-[#105B38]/20 flex items-center gap-2"
              >
                <Download size={15} /> Download Free Add-in Manifest (.xml)
              </a>
              <button
                type="button"
                onClick={() => navigate("/preview/word-addin-guide")}
                className="px-6 py-3.5 bg-white dark:bg-[#131E2E] hover:bg-[#F8FAFC] dark:hover:bg-[#1B293E] text-[#0F172A] dark:text-white border border-[#E2E8F0] dark:border-[#1E2D44] rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 shadow-xs"
              >
                View Setup Guide <ArrowRight size={13} />
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 relative">
            <div className="absolute inset-0 bg-[#105B38]/5 dark:bg-emerald-500/5 rounded-3xl blur-2xl -z-10" />
            <div className="rounded-3xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] p-6 md:p-8 space-y-6 shadow-xl shadow-slate-200/50 dark:shadow-none">
              <div className="flex gap-4 items-start border-b border-[#F1F5F9] dark:border-[#1E2D44] pb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-[#105B38] dark:text-emerald-400 shrink-0">
                  <Search size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] dark:text-white text-sm">
                    600K+ Judgment Search
                  </h3>
                  <p className="text-xs text-[#475569] dark:text-slate-300 mt-1 leading-relaxed">
                    Instant keyword &amp; pinpoint citation search (PLD, SCMR,
                    YLR) right in your Word sidebar.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start border-b border-[#F1F5F9] dark:border-[#1E2D44] pb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] dark:text-white text-sm">
                    Legal Drafting &amp; Court Petitions
                  </h3>
                  <p className="text-xs text-[#475569] dark:text-slate-300 mt-1 leading-relaxed">
                    Draft High Court petitions, bail applications, replies, and
                    notices directly inside MS Word.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start border-b border-[#F1F5F9] dark:border-[#1E2D44] pb-4">