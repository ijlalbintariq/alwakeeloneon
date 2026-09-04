import { useMemo, useState } from "react";
import {
  ArrowRight,
  Search,
  FileText,
  MessageSquare,
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
      className={`group h-full p-7 bg-card border border-border rounded-2xl hover:border-[#105B38]/40 transition-all hover:shadow-xl hover:shadow-[#105B38]/5 flex flex-col relative ${className}`}
    >
      {badge && (
        <span className="absolute top-4 right-4 inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] text-amber-500 font-extrabold uppercase tracking-wider">
          <Sparkles size={10} className="animate-pulse" />
          {badge}
        </span>
      )}
      <div
        className={`w-12 h-12 rounded-xl ${bgClass} flex items-center justify-center mb-4 transition-transform group-hover:scale-105`}
      >
        <Icon size={22} className={iconClass} />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-2 min-h-[3.25rem]">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">
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
    bgClass: "bg-[#105B38]/10",
    iconClass: "text-[#105B38]",
  },
  {
    icon: FileText,
    title: "Microsoft Word Add-in",
    desc: "Use AL WAKEELO directly inside MS Word to research case law, lookup 5,900+ statutes, audit contract risks, and draft petitions without leaving Word.",
    bgClass: "bg-[#105B38]/10",
    iconClass: "text-[#105B38]",
    badge: "New Feature",
  },
  {
    icon: Search,
    title: "Judgment Search",
    desc: "Find relevant Pakistani case law with quick citation-focused search and contextual summaries.",
    bgClass: "bg-blue-500/10",
    iconClass: "text-blue-500",
  },
  {
    icon: BookOpen,
    title: "Citation Search",
    desc: "Search directly by year, journal, and page to locate precise judgments and linked details quickly.",
    bgClass: "bg-indigo-500/10",
    iconClass: "text-indigo-400",
  },
  {
    icon: BookOpen,
    title: "Statute Lookup",
    desc: "Navigate Pakistani statutes and sections with plain-language legal explanations.",
    bgClass: "bg-emerald-500/10",
    iconClass: "text-emerald-500",
  },
  {
    icon: FileText,
    title: "Legal Drafting",
    desc: "Prepare petitions, notices, applications, and legal replies with structured templates, clause-ready sections, and style-consistent drafting support.",
    bgClass: "bg-[#105B38]/10",
    iconClass: "text-[#105B38]",
  },
  {
    icon: Users,
    title: "Style-Memory RAG",
    desc: "Train AI on your uploads, drafts, and accepted edits so output follows your legal style and preferred language.",
    bgClass: "bg-sky-500/10",
    iconClass: "text-sky-500",
  },
  {
    icon: Shield,
    title: "Contract Drafting",
    desc: "Generate client-ready contracts with structured clause sets, risk score breakdown, redline suggestions, and cleaner final drafts for negotiation or execution.",
    bgClass: "bg-red-500/10",
    iconClass: "text-red-500",
  },
  {
    icon: Cpu,
    title: "AI Integrations (MCP)",
    desc: "Connect AL WAKEELO's RAG database directly to Claude, ChatGPT, or Gemini settings using your secure API key.",
    bgClass: "bg-amber-500/10",
    iconClass: "text-amber-500",
  },
  {
    icon: Paperclip,
    title: "Case Documents",
    desc: "Upload, review, and organize matter-specific documents with faster legal analysis support.",
    bgClass: "bg-cyan-500/10",
    iconClass: "text-cyan-500",
  },
  {
    icon: FileText,
    title: "Knowledge Vault",
    desc: "Maintain private user documents and global admin legal resources for retrieval-grounded outputs.",
    bgClass: "bg-violet-500/10",
    iconClass: "text-violet-400",
  },
  {
    icon: Users,
    title: "Organization Workspace",
    desc: "Support chamber and team workflows with shared access controls and collaboration-ready structure.",
    bgClass: "bg-teal-500/10",
    iconClass: "text-teal-400",
  },
  {
    icon: Mic,
    title: "Audio Transcription",
    desc: "Convert legal voice notes and recorded audio into text for research, drafting, and case preparation.",
    bgClass: "bg-lime-500/10",
    iconClass: "text-lime-600 dark:text-lime-400",
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
    <div className="preview-theme-scope min-h-screen bg-background text-foreground overflow-x-hidden antialiased selection:bg-[#105B38]/20 selection:text-[#0F172A] dark:text-[#F8FAFC]">
      {/* 1. Header Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate("/preview")}
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#105B38]/30 shadow-lg shadow-[#105B38]/10 bg-card flex items-center justify-center">
              <img
                src="/logo.svg"
                alt="AL WAKEELO logo"
                className="w-full h-full object-cover"
              />
            </div>
            <span
              className="text-xl font-bold italic tracking-tight"
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
              className="text-sm font-medium text-foreground hover:text-[#105B38] transition-colors"
            >
              Home
            </a>
            <a
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                if (window.location.pathname === '/preview' || window.location.pathname === '/' || window.location.pathname === '/preview/') {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  navigate('/preview#features');
                }
              }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </a>
            <a
              href="/preview/pricing"
              onClick={(e) => {
                e.preventDefault();
                if (window.location.pathname === '/preview' || window.location.pathname === '/' || window.location.pathname === '/preview/') {
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  navigate('/preview#pricing');
                }
              }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </a>
            <a
              href="/preview/about"
              onClick={(e) => {
                e.preventDefault();
                navigate("/preview/about");
              }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              About
            </a>
            <a
              href="/preview/contact"
              onClick={(e) => {
                e.preventDefault();
                navigate("/preview/contact");
              }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact
            </a>
            <a
              href="/preview/faq"
              onClick={(e) => {
                e.preventDefault();
                navigate("/preview/faq");
              }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              FAQ
            </a>
            <a
              href="/preview/blog"
              onClick={(e) => {
                e.preventDefault();
                navigate("/preview/blog");
              }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Blog
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="h-10 w-10 rounded-xl border border-border bg-transparent text-foreground hover:bg-card p-0 inline-flex items-center justify-center transition-colors"
              aria-label={
                resolvedTheme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              data-testid="landing-theme-toggle"
            >
              {resolvedTheme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              className="md:hidden h-10 w-10 rounded-xl border border-border bg-transparent text-foreground hover:bg-card p-0 inline-flex items-center justify-center"
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
          <div className="md:hidden border-t border-border/70 bg-background/95 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-3">
              <a
                href="/preview"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileNavOpen(false);
                  navigate("/preview");
                }}
                className="text-sm font-medium text-foreground hover:text-[#105B38] transition-colors"
              >
                Home
              </a>
              <a
                href="#features"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileNavOpen(false);
                  if (window.location.pathname === '/preview' || window.location.pathname === '/' || window.location.pathname === '/preview/') {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  navigate('/preview#features');
                }
                }}
                className="text-sm font-medium text-foreground hover:text-[#105B38] transition-colors"
              >
                Features
              </a>
              <a
                href="#pricing"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileNavOpen(false);
                  if (window.location.pathname === '/preview' || window.location.pathname === '/' || window.location.pathname === '/preview/') {
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  navigate('/preview#pricing');
                }
                }}
                className="text-sm font-medium text-foreground hover:text-[#105B38] transition-colors"
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
                className="text-sm font-medium text-foreground hover:text-[#105B38] transition-colors"
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
                className="text-sm font-medium text-foreground hover:text-[#105B38] transition-colors"
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
                className="text-sm font-medium text-foreground hover:text-[#105B38] transition-colors"
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
                className="text-sm font-medium text-foreground hover:text-[#105B38] transition-colors"
              >
                Blog
              </a>
              <div className="pt-2 border-t border-border/80 flex flex-col gap-2">
                <a
                  href="mailto:support@alwakeelo.com"
                  className="inline-flex items-center gap-2 text-sm text-[#105B38] hover:text-foreground transition-colors"
                >
                  <Mail size={14} /> support@alwakeelo.com
                </a>
                <a
                  href="tel:00923358341897"
                  className="inline-flex items-center gap-2 text-sm text-[#105B38] hover:text-foreground transition-colors"
                >
                  <PhoneCall size={14} /> 00923358341897
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* 2. Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-6">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#105B38]/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#105B38]/3 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#105B38]/10 border border-[#105B38]/20 dark:border-[#105B38]/40 rounded-full mb-8">
            <span className="w-2 h-2 bg-[#105B38] rounded-full animate-pulse" />
            <span className="text-[11px] text-[#105B38] font-bold uppercase tracking-widest">
              Pakistan's First Open-Source Legal AI Platform
            </span>
          </div>

          <h1
            className="text-5xl md:text-7xl font-bold leading-tight mb-6"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            <span className="italic">AL WAKEELO AI Workspace</span>
            <br />
            <span className="text-[#105B38] italic">for Advocates & Chambers</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
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
              href="/preview/contact?consult=1#consult"
              onClick={(e) => {
                e.preventDefault();
                navigate("/preview/contact?consult=1#consult");
              }}
              className="w-full sm:w-auto px-8 py-4 border border-border text-foreground rounded-2xl text-sm font-bold hover:border-[#105B38] hover:text-[#105B38] transition-all flex items-center justify-center gap-2"
            >
              Book Chamber Consultation <ArrowRight size={16} />
            </a>
          </div>

          <div className="mt-4">
            <a
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                if (window.location.pathname === '/preview' || window.location.pathname === '/' || window.location.pathname === '/preview/') {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  navigate('/preview#features');
                }
              }}
              className="inline-flex items-center gap-2 text-sm font-bold text-foreground hover:text-[#105B38] transition-all"
            >
              Explore Features
              <ArrowRight size={14} />
            </a>
          </div>

          <div className="flex items-center justify-center gap-8 mt-12 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-[#105B38]" />
              <span className="text-xs font-bold uppercase tracking-wider">
                PECA 2016 Compliant &amp; Encrypted Legal Privilege Security
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-[#105B38]" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Pakistani Law Focus
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Zap size={16} className="text-[#105B38]" />
              <span className="text-xs font-bold uppercase tracking-wider">
                AI Powered
              </span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Users size={16} className="text-[#105B38]" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Discussed on Reddit
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. How It Works Section */}
      <section className="py-16 md:py-20 px-6 bg-card border-y border-border/60">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] text-[#105B38] font-black uppercase tracking-[0.3em] mb-3">
              How It Works
            </p>
            <h2
              className="text-3xl md:text-4xl font-bold italic"
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
                className="rounded-2xl border border-border bg-card p-6 hover:border-[#105B38]/30 transition-all hover:shadow-lg"
              >
                <p className="text-[10px] text-[#105B38] font-black tracking-[0.3em] mb-2">
                  {item.step}
                </p>
                <h3 className="text-foreground text-lg font-bold mb-2">
                  {item.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. MCP Integration Feature Section */}
      <section className="py-16 md:py-24 px-6 bg-gradient-to-b from-background to-card border-b border-border/60">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs text-amber-500 font-bold uppercase tracking-widest">
              <Sparkles size={12} className="animate-pulse" />
              New Feature
            </div>
            <h2
              className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground leading-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Bring AL WAKEELO RAG <br />
              <span className="text-[#105B38] italic">
                directly into Claude &amp; ChatGPT
              </span>
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
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
            <div className="absolute inset-0 bg-[#105B38]/5 rounded-3xl blur-2xl -z-10" />
            <div className="rounded-3xl border border-border bg-card p-6 md:p-8 space-y-6 shadow-xl">
              <div className="flex gap-4 items-start border-b border-border pb-4">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 flex-shrink-0">
                  <Cpu size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">
                    Claude Connectors
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Paste our secure token URL directly into Claude Connectors
                    settings to list and call RAG search tools.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start border-b border-border pb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 flex-shrink-0">
                  <Compass size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">
                    Official ChatGPT Plugin
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Search for AL WAKEELO in ChatGPT Plugins, connect your
                    account, and mention @AL WAKEELO directly in chat.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 flex-shrink-0">
                  <Terminal size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">
                    Google Gemini Spark
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Bridge AL WAKEELO directly into Google Workspace Gemini
                    sessions using our stateful remote transport.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Official Microsoft Word Add-in Feature Section */}
      <section className="py-16 md:py-24 px-6 bg-gradient-to-b from-background to-card border-y border-border/60">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs text-amber-500 font-extrabold uppercase tracking-widest">
                <Sparkles size={12} className="animate-pulse" />
                New Feature
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#105B38]/10 border border-[#105B38]/20 dark:border-[#105B38]/40 rounded-full text-xs text-[#105B38] font-bold uppercase tracking-widest">
                <FileText size={14} />
                Official MS Word Add-in
              </div>
            </div>
            <h2
              className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground leading-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              AL WAKEELO Legal AI <br />
              <span className="text-[#105B38] italic">
                Inside Microsoft Word
              </span>
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
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
                className="px-6 py-3.5 bg-card hover:bg-muted text-foreground border border-border rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2"
              >
                View Setup Guide <ArrowRight size={13} />
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 relative">
            <div className="absolute inset-0 bg-[#105B38]/5 rounded-3xl blur-2xl -z-10" />
            <div className="rounded-3xl border border-border bg-card p-6 md:p-8 space-y-6 shadow-xl">
              <div className="flex gap-4 items-start border-b border-border pb-4">
                <div className="w-10 h-10 rounded-xl bg-[#105B38]/10 flex items-center justify-center text-[#105B38] flex-shrink-0">
                  <Search size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">
                    600K+ Judgment Search
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Instant keyword &amp; pinpoint citation search (PLD, SCMR,
                    YLR) right in your Word sidebar.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start border-b border-border pb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 flex-shrink-0">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">
                    Legal Drafting &amp; Court Petitions
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Draft High Court petitions, bail applications, replies, and
                    notices directly inside MS Word.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start border-b border-border pb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 flex-shrink-0">
                  <Shield size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">
                    Contract Risk &amp; Redline Audit
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Scan agreements for missing indemnity or jurisdiction
                    clauses with 1-click Word fix insertion.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 flex-shrink-0">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">
                    5,900+ Statute &amp; Section Lookup
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Explore statutory sections, punishments, and legal
                    explanations directly inside your Word document.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Platform Preview Section */}
      <section className="py-16 md:py-20 px-6 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] text-[#105B38] font-black uppercase tracking-[0.3em] mb-3">
              Platform Preview
            </p>
            <h2
              className="text-3xl md:text-4xl font-bold italic"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Built Like a Modern Legal Workspace
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-3xl border-2 border-[#105B38]/40 bg-white dark:bg-gradient-to-b dark:from-[#1a1f2e] dark:to-[#0f1420] p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#105B38] dark:text-[#10B981]">
                  Research Panel
                </p>
                <span className="text-[10px] text-[#64748B] dark:text-slate-400">Live Workspace</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-[#105B38]/20 dark:border-[#105B38]/30 bg-[#F8FAFC] dark:bg-white dark:bg-[#131E2E]/5 p-3 text-xs text-[#334155] dark:text-slate-200">
                  Judgment Search:{" "}
                  <span className="text-[#105B38] dark:text-[#10B981] font-semibold">2023 SCMR 1450</span>
                </div>
                <div className="rounded-xl border border-[#105B38]/20 dark:border-[#105B38]/30 bg-[#F8FAFC] dark:bg-white dark:bg-[#131E2E]/5 p-3 text-xs text-[#334155] dark:text-slate-200">
                  Statute Lookup:{" "}
                  <span className="text-[#105B38] dark:text-[#10B981] font-semibold">CPC S.9</span>
                </div>
                <div className="rounded-xl border border-[#105B38]/20 dark:border-[#105B38]/30 bg-[#F8FAFC] dark:bg-white dark:bg-[#131E2E]/5 p-3 text-xs text-[#334155] dark:text-slate-200">
                  AI Summary:{" "}
                  <span className="text-[#0F172A] dark:text-slate-100">
                    Actionable litigation notes generated.
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border-2 border-[#105B38]/40 bg-white dark:bg-gradient-to-b dark:from-[#1a1f2e] dark:to-[#0f1420] p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#105B38] dark:text-[#10B981]">
                  Drafting Panel
                </p>
                <span className="text-[10px] text-[#64748B] dark:text-slate-400">
                  Conversion Ready
                </span>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-[#105B38]/20 dark:border-[#105B38]/30 bg-[#F8FAFC] dark:bg-white dark:bg-[#131E2E]/5 p-3 text-xs text-[#334155] dark:text-slate-200">
                  Legal Draft:{" "}
                  <span className="text-[#105B38] dark:text-[#10B981] font-semibold">Petition structure ready</span>
                </div>
                <div className="rounded-xl border border-[#105B38]/20 dark:border-[#105B38]/30 bg-[#F8FAFC] dark:bg-white dark:bg-[#131E2E]/5 p-3 text-xs text-[#334155] dark:text-slate-200">
                  Contract Risk:{" "}
                  <span className="text-[#105B38] dark:text-[#10B981] font-semibold">Critical clauses flagged</span>
                </div>
                <div className="rounded-xl border border-[#105B38]/20 dark:border-[#105B38]/30 bg-[#F8FAFC] dark:bg-white dark:bg-[#131E2E]/5 p-3 text-xs text-[#334155] dark:text-slate-200">
                  Client Intake:{" "}
                  <span className="text-[#0F172A] dark:text-slate-100">
                    Submit case + chamber callback.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. 13 Core Capabilities Section */}
      <section id="features" className="py-20 md:py-28 px-6 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] text-[#105B38] font-black uppercase tracking-[0.3em] mb-3">
              Capabilities
            </p>
            <h2
              className="text-3xl md:text-4xl font-bold italic"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Everything You Need in One Platform
            </h2>
            <p className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-4 max-w-xl mx-auto">
              From case research to contract drafting, AL WAKEELO handles the
              full spectrum of legal work.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CORE_FEATURES.map((item, index) => {
              const isLast = index === CORE_FEATURES.length - 1;
              const mdSingleLast = CORE_FEATURES.length % 2 === 1 && isLast;
              const lgSingleLast = CORE_FEATURES.length % 3 === 1 && isLast;
              const className = [
                mdSingleLast ? "md:col-span-2" : "",
                lgSingleLast ? "lg:col-span-1 lg:col-start-2" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <FeatureCard
                  key={item.title}
                  icon={item.icon}
                  title={item.title}
                  desc={item.desc}
                  bgClass={item.bgClass}
                  iconClass={item.iconClass}
                  badge={item.badge}
                  className={className}
                />
              );
            })}
          </div>

          <div className="mt-8 text-center">
            <a
              href={ctaTarget}
              onClick={(e) => {
                e.preventDefault();
                navigate(ctaTarget);
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-border text-foreground text-sm font-bold hover:border-[#105B38] hover:text-[#105B38] transition-all"
            >
              Explore Full Platform <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* 8. Who It's For Section */}
      <section className="py-14 px-6 bg-background border-y border-border/60">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <p className="text-[11px] text-[#105B38] font-black uppercase tracking-[0.3em] mb-3">
              Who It's For
            </p>
            <h2
              className="text-2xl md:text-3xl font-bold italic"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Built for Real Legal Workflows
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: "Independent Advocates",
                desc: "Faster research, drafting, and client-prep from a single workspace.",
              },
              {
                title: "Law Chambers",
                desc: "Shared legal operations with structured outputs and chamber-grade consistency.",
              },
              {
                title: "In-house Legal Teams",
                desc: "Quick legal analysis and document review for day-to-day legal operations.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] p-5 hover:border-[#105B38]/30 transition-all"
              >
                <h3 className="text-foreground text-lg font-bold mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. 5-Tier Pricing Matrix Section */}
      <section id="pricing" className="py-20 md:py-28 px-6 bg-[#F1F5F9] dark:bg-[#0B131E]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] text-[#105B38] font-black uppercase tracking-[0.3em] mb-3">
              Plans
            </p>
            <h2
              className="text-3xl md:text-4xl font-bold italic"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Choose Your Plan
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
              Transparent pricing by AI actions, model access, output caps, and
              upload/OCR limits.
            </p>
            <div className="mt-6 inline-flex items-center rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] p-1.5 gap-1">
              {[
                { key: "monthly" as const, label: "Monthly" },
                { key: "quarterly" as const, label: "3 Months (10% Off)" },
                { key: "yearly" as const, label: "Yearly (20% Off)" },
              ].map((cycle) => (
                <button
                  key={cycle.key}
                  type="button"
                  onClick={() => setBillingCycle(cycle.key)}
                  className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${
                    billingCycle === cycle.key
                      ? "bg-[#105B38] text-white"
                      : "text-[#334155] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-white"
                  }`}
                  data-testid={`pricing-cycle-${cycle.key}`}
                >
                  {cycle.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
            {landingPlans.map((plan) => (
              <div
                key={plan.key}
                onClick={() => setSelectedPlan(plan.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedPlan(plan.key);
                  }
                }}
                className={`p-7 rounded-3xl transition-all cursor-pointer ${
                  plan.highlighted
                    ? "bg-gradient-to-b from-[#105B38]/10 to-[#EBF5F0] dark:from-[#105B38]/10 dark:to-[#1e293b] border-2 border-[#105B38]/30 shadow-xl shadow-[#105B38]/10"
                    : "bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] hover:border-[#A3D4BC] dark:hover:border-[#105B38]/40"
                } ${selectedPlan === plan.key ? "ring-2 ring-[#105B38]" : ""}`}
              >
                <p
                  className={`text-[10px] font-black uppercase tracking-widest mb-1 ${
                    plan.highlighted ? "text-[#105B38] dark:text-[#10B981]" : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"
                  }`}
                >
                  {plan.badge}
                </p>
                <h3 className="text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                  {plan.title}
                </h3>
                <p className="text-[#105B38] text-sm font-black mb-1">
                  {plan.key === "free"
                    ? plan.price
                    : plan.key === "enterprise"
                    ? plan.price
                    : getPlanCyclePricing(plan, billingCycle).totalLabel}
                </p>
                {plan.key !== "free" && plan.key !== "enterprise" && (
                  <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mb-1">
                    {getPlanCyclePricing(plan, billingCycle).effectiveMonthlyLabel}{" "}
                    · {getPlanCyclePricing(plan, billingCycle).savingsLabel}
                  </p>
                )}
                {plan.key === "enterprise" && billingCycle !== "monthly" && (
                  <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mb-1">
                    Enterprise billing remains custom and contact-led.
                  </p>
                )}
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mb-5">
                  {plan.subtitle}
                </p>
                <ul className="space-y-2.5 mb-7">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed"
                    >
                      <ChevronRight
                        size={13}
                        className="text-[#105B38] flex-shrink-0 mt-0.5"
                      />{" "}
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.key === "enterprise" ? (
                  <a
                    href="mailto:support@alwakeelo.com?subject=Enterprise%20Consultation"
                    className="w-full py-3 border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] rounded-xl text-xs font-black uppercase tracking-widest hover:border-[#105B38] hover:text-[#105B38] dark:hover:border-[#10B981] dark:hover:text-[#10B981] transition-all flex items-center justify-center"
                  >
                    {plan.cta}
                  </a>
                ) : plan.key === "free" ? (
                  <a
                    href={user ? "/preview/dashboard" : "/preview/auth"}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(user ? "/preview/dashboard" : "/preview/auth");
                    }}
                    className="w-full py-3 border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] rounded-xl text-xs font-black uppercase tracking-widest hover:border-[#105B38] hover:text-[#105B38] dark:hover:border-[#10B981] dark:hover:text-[#10B981] transition-all flex items-center justify-center"
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <a
                    href={`/preview/checkout?plan=${plan.key}&cycle=${billingCycle}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(
                        `/preview/checkout?plan=${plan.key}&cycle=${billingCycle}`
                      );
                    }}
                    className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center ${
                      plan.highlighted
                        ? "bg-[#105B38] text-white hover:bg-[#0D4A2E] shadow-lg shadow-[#105B38]/20"
                        : "border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] hover:border-[#105B38] hover:text-[#105B38] dark:hover:border-[#10B981] dark:hover:text-[#10B981]"
                    }`}
                  >
                    {plan.cta}
                  </a>
                )}
              </div>
            ))}
          </div>

          {selectedPlan === "chamber" && (
            <div className="mt-8 rounded-2xl border border-border bg-card p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#105B38] mb-3">
                Chamber Expansion
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-[#334155] dark:text-[#CBD5E1]">
                <p>
                  Extra seat:{" "}
                  <span className="text-[#105B38] font-bold">
                    +PKR 1,000/month per user
                  </span>
                </p>
                <p>
                  Extra AI limit:{" "}
                  <span className="text-[#105B38] font-bold">
                    +350 AI actions/month per user
                  </span>
                </p>
                <p>
                  Suggested upload add-on:{" "}
                  <span className="text-[#105B38] font-bold">
                    +300 files/month per user
                  </span>
                </p>
                <p>
                  Suggested Apex add-on:{" "}
                  <span className="text-[#105B38] font-bold">
                    +50 Apex requests/month per user
                  </span>
                </p>
              </div>
              <p className="mt-3 text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                AI action counting: 1 chat/draft/summarize request = 1 action.
                Audio transcription: every 2 minutes = 1 action.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 10. About Section */}
      <section id="about" className="py-20 md:py-28 px-6 bg-background">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[11px] text-[#105B38] font-black uppercase tracking-[0.3em] mb-3">
            About
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold italic mb-6"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Built for Pakistani Legal Professionals
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-2xl mx-auto">
            AL WAKEELO combines cutting-edge AI technology with deep knowledge of
            Pakistani law to provide lawyers, advocates, and legal professionals
            with a powerful research and drafting assistant. Our platform is
            backed by a comprehensive database of Pakistani judgments,
            statutes, and legal texts. Trusted by advocates and discussed across
            platforms including Reddit, legal forums, and professional networks.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
            {[
              { num: legalDocumentsLabel, label: "Documents Indexed" },
              { num: `${CORE_FEATURES.length}+`, label: "Modules Available" },
              { num: "<10s", label: "Avg Response Time" },
              { num: "Advocates+", label: "Used by Advocates & Chambers" },
            ].map((stat, i) => (
              <div
                key={i}
                className="p-6 bg-card border border-border rounded-2xl hover:border-[#105B38]/30 transition-all"
              >
                <p className="text-2xl font-bold text-[#105B38] mb-1">
                  {stat.num}
                </p>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 11. Chamber Consultation Contact Section */}
      <section id="contact" className="py-20 px-6 bg-card">
        <div className="max-w-3xl mx-auto text-center">
          <div id="consult" className="h-0 w-0" />
          <h2
            className="text-3xl md:text-4xl font-bold italic mb-4"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Ready for Professional Consultation?
          </h2>
          <p className="text-muted-foreground mb-8">
            Start with AI guidance, then connect with our chamber for
            professional legal consultation.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={ctaTarget}
              onClick={(e) => {
                e.preventDefault();
                navigate(ctaTarget);
              }}
              className="px-8 py-3.5 bg-[#105B38] text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-[#0D4A2E] transition-all flex items-center gap-2 shadow-xl shadow-[#105B38]/20"
            >
              {user ? "Go to Dashboard" : "Start Now"} <ArrowRight size={16} />
            </a>
            <a
              href="mailto:support@alwakeelo.com?subject=Legal%20Consultation"
              className="px-8 py-3.5 border border-border text-foreground rounded-2xl text-sm font-bold hover:border-[#105B38] hover:text-[#105B38] transition-all inline-flex items-center gap-2"
            >
              <Mail size={15} /> Email Chamber
            </a>
            <a
              href="tel:00923358341897"
              className="px-8 py-3.5 border border-border text-foreground rounded-2xl text-sm font-bold hover:border-[#105B38] hover:text-[#105B38] transition-all inline-flex items-center gap-2"
            >
              <PhoneCall size={15} /> Call Chamber
            </a>
          </div>
        </div>
      </section>

      {/* 12. FAQ Section */}
      <section className="py-16 px-6 bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[11px] text-[#105B38] font-black uppercase tracking-[0.3em] mb-3">
              FAQ
            </p>
            <h2
              className="text-3xl md:text-4xl font-bold italic"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <div
                key={item.q}
                className="rounded-2xl border border-border bg-card p-5 hover:border-[#105B38]/30 transition-all"
              >
                <h3 className="text-base font-bold text-foreground mb-2">
                  {item.q}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* 13. Footer */}
      <footer className="py-10 px-6 bg-background border-t border-border/50">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => navigate("/preview")}
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#105B38]/30 bg-card flex items-center justify-center">
                <img
                  src="/logo.svg"
                  alt="AL WAKEELO logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <span
                className="text-sm font-bold italic"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                AL WAKEELO
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <a
                href="/preview/about"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/preview/about");
                }}
                className="text-sm text-muted-foreground hover:text-[#105B38] transition-colors"
              >
                About Us
              </a>
              <a
                href="/preview/contact"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/preview/contact");
                }}
                className="text-sm text-muted-foreground hover:text-[#105B38] transition-colors"
              >
                Contact Us
              </a>
              <a
                href="/preview/faq"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/preview/faq");
                }}
                className="text-sm text-muted-foreground hover:text-[#105B38] transition-colors"
              >
                FAQ
              </a>
              <a
                href="/preview/blog"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/preview/blog");
                }}
                className="text-sm text-muted-foreground hover:text-[#105B38] transition-colors"
              >
                Legal Blog
              </a>
              <a
                href="/preview/privacy"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/preview/privacy");
                }}
                className="text-sm text-muted-foreground hover:text-[#105B38] transition-colors"
              >
                Privacy Policy
              </a>
              <a
                href="/preview/terms"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/preview/terms");
                }}
                className="text-sm text-muted-foreground hover:text-[#105B38] transition-colors"
              >
                Terms and Conditions
              </a>
              <a
                href="/preview/cancellation-return-refund-policy"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/preview/cancellation-return-refund-policy");
                }}
                className="text-sm text-muted-foreground hover:text-[#105B38] transition-colors"
              >
                Cancellation/Return/Refund Policy
              </a>
              <a
                href="/preview/ownership-statement"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/preview/ownership-statement");
                }}
                className="text-sm text-muted-foreground hover:text-[#105B38] transition-colors"
              >
                Ownership Statement
              </a>
              <a
                href="https://www.reddit.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-[#105B38] transition-colors"
              >
                Reddit Community
              </a>
              <a
                href="https://www.linkedin.com/company/al-wakeelo"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-[#105B38] transition-colors"
              >
                LinkedIn
              </a>
            </div>

            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} AL WAKEELO. All rights reserved.
            </p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              AL WAKEELO by{" "}
              <span className="text-muted-foreground font-semibold">
                Majnun Studio
              </span>
            </p>
          </div>
        </div>
      </footer>
    

      {/* Floating Version 2.0 Announcement Banner */}
      <div className="fixed bottom-6 left-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-700 pointer-events-auto">
        <div className="bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-2xl rounded-2xl p-4 md:p-5 max-w-sm flex items-start gap-4 relative">
          <div className="flex-shrink-0 w-10 h-10 bg-[#105B38]/10 rounded-full flex items-center justify-center text-[#105B38]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"></path><path d="m9 12 2 2 4-4"></path></svg>
          </div>
          <div className="pr-4">
            <h4 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] mb-1">AL WAKEELO Version 2.0 is Live!</h4>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] leading-relaxed">
              We've completely overhauled the platform. If you experience any issues with the new interface, kindly direct message our support at <a href="tel:00923358341897" className="text-[#105B38] font-bold hover:underline">+92 335 8341897</a>.
            </p>
          </div>
          <button 
            onClick={(e) => e.currentTarget.parentElement?.parentElement?.remove()}
            className="absolute top-3 right-3 text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
</div>
  );
}
