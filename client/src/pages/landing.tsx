import { useMemo, useState } from "react";
import { ArrowRight, Search, FileText, MessageSquare, BookOpen, Shield, Zap, Crown, Users, Mic, Paperclip, Globe, ChevronRight, LayoutDashboard, Menu, X, PhoneCall, Mail, Sun, Moon, Cpu, Terminal, Compass, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentHead } from "@/hooks/use-document-head";
import { useTheme } from "@/hooks/use-theme";
import { SUBSCRIPTION_PLANS, getPlanCyclePricing, type BillingCycle, type SubscriptionPlanKey } from "@/lib/subscription-plans";

function FeatureCard({
  icon: Icon,
  title,
  desc,
  bgClass,
  iconClass,
  className = "",
}: {
  icon: any;
  title: string;
  desc: string;
  bgClass: string;
  iconClass: string;
  className?: string;
}) {
  return (
    <div className={`group h-full p-7 bg-card border border-border rounded-2xl hover:border-border transition-all hover:shadow-xl flex flex-col ${className}`}>
      <div className={`w-12 h-12 rounded-xl ${bgClass} flex items-center justify-center mb-4`}>
        <Icon size={22} className={iconClass} />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-2 min-h-[3.25rem]">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">{desc}</p>
    </div>
  );
}

const CORE_FEATURES = [
  { icon: MessageSquare, title: "AI Legal Chat", desc: "Consult with an AI legal advisor trained on Pakistani law. Get strategy and next-step guidance fast.", bgClass: "bg-primary/10", iconClass: "text-primary" },
  { icon: Crown, title: "Al Wakeelo Engine", desc: "Use the main legal AI workspace with grounded responses, references, and practical next-step guidance.", bgClass: "bg-primary/10", iconClass: "text-primary" },
  { icon: Search, title: "Judgment Search", desc: "Find relevant Pakistani case law with quick citation-focused search and contextual summaries.", bgClass: "bg-blue-500/10", iconClass: "text-blue-500" },
  { icon: BookOpen, title: "Citation Search", desc: "Search directly by year, journal, and page to locate precise judgments and linked details quickly.", bgClass: "bg-indigo-500/10", iconClass: "text-indigo-400" },
  { icon: BookOpen, title: "Statute Lookup", desc: "Navigate Pakistani statutes and sections with plain-language legal explanations.", bgClass: "bg-emerald-500/10", iconClass: "text-emerald-500" },
  { icon: FileText, title: "Legal Drafting", desc: "Prepare petitions, notices, applications, and legal replies with structured templates, clause-ready sections, and style-consistent drafting support.", bgClass: "bg-primary/10", iconClass: "text-primary" },
  { icon: Users, title: "Style-Memory RAG", desc: "Train AI on your uploads, drafts, and accepted edits so output follows your legal style and preferred language.", bgClass: "bg-sky-500/10", iconClass: "text-sky-500" },
  { icon: Shield, title: "Contract Drafting", desc: "Generate client-ready contracts with structured clause sets, risk score breakdown, redline suggestions, and cleaner final drafts for negotiation or execution.", bgClass: "bg-red-500/10", iconClass: "text-red-500" },
  { icon: Cpu, title: "AI Integrations (MCP)", desc: "Connect AL WAKEELO's RAG database directly to Claude, ChatGPT, or Gemini settings using your secure API key.", bgClass: "bg-amber-500/10", iconClass: "text-amber-500" },
  { icon: Paperclip, title: "Case Documents", desc: "Upload, review, and organize matter-specific documents with faster legal analysis support.", bgClass: "bg-cyan-500/10", iconClass: "text-cyan-500" },
  { icon: FileText, title: "Knowledge Vault", desc: "Maintain private user documents and global admin legal resources for retrieval-grounded outputs.", bgClass: "bg-violet-500/10", iconClass: "text-violet-400" },
  { icon: Users, title: "Organization Workspace", desc: "Support chamber and team workflows with shared access controls and collaboration-ready structure.", bgClass: "bg-teal-500/10", iconClass: "text-teal-400" },
  { icon: Mic, title: "Audio Transcription", desc: "Convert legal voice notes and recorded audio into text for research, drafting, and case preparation.", bgClass: "bg-lime-500/10", iconClass: "text-lime-400" },
];

const FAQ_ITEMS = [
  {
    q: "Can I use Al Wakeelo for Pakistani case law research?",
    a: "Yes. You can search judgments, explore statutes, and use AI-assisted legal research workflows focused on Pakistani law.",
  },
  {
    q: "Does Al Wakeelo replace a licensed advocate?",
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
    q: "Is Alwakeelo discussed on Reddit or legal forums?",
    a: "Yes — Pakistani lawyers and legal researchers discuss Al Wakeelo on Reddit, legal tech communities, and professional networks. We actively welcome community feedback and incorporate it into platform improvements.",
  },
];

export default function LandingPage() {
  useDocumentHead({
    title: "Alwakeelo AI - Pakistan Law Search & AI Legal Assistant | Digital Lawyer",
    description:
      "Pakistan's premier AI-powered digital lawyer and case law search. Search 600,000+ judgments (PLD, SCMR, YLR), search Pakistan Penal Code, CPC & CrPC, draft petitions, and generate legally binding contracts.",
    path: "/",
  });
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { resolvedTheme, toggle: toggleTheme } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanKey | "free">("pro");
  const landingPlans = useMemo(() => [
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
  ], []);
  const { data: platformMetrics } = useQuery<{ legalDocuments: number; updatedAt: string }>({
    queryKey: ["/api/public/platform-metrics"],
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const ctaTarget = user ? "/dashboard" : "/auth";
  const legalDocumentsCount = Math.max(0, Number(platformMetrics?.legalDocuments || 0));
  const legalDocumentsLabel = new Intl.NumberFormat("en-US").format(legalDocumentsCount);
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
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-amber-400/30 shadow-lg shadow-amber-500/20">
              <img src="/logo.svg" alt="Alwakeelo logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-bold italic tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>Alwakeelo</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="/" className="text-sm text-foreground hover:text-foreground transition-colors">Home</a>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <a href="/about" onClick={(e) => { e.preventDefault(); navigate("/about"); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</a>
            <a href="/contact" onClick={(e) => { e.preventDefault(); navigate("/contact"); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</a>
            <a href="/faq" onClick={(e) => { e.preventDefault(); navigate("/faq"); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
            <a href="/blog" onClick={(e) => { e.preventDefault(); navigate("/blog"); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Blog</a>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="h-10 w-10 rounded-xl border border-border bg-transparent text-foreground hover:bg-card p-0 inline-flex items-center justify-center transition-colors"
              aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
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
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              {user ? <><LayoutDashboard size={16} /> Dashboard</> : "Start Now"}
            </a>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="md:hidden border-t border-border/70">
            <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-3">
              <a href="/" onClick={() => setMobileNavOpen(false)} className="text-sm text-foreground hover:text-foreground transition-colors">Home</a>
              <a href="#features" onClick={() => setMobileNavOpen(false)} className="text-sm text-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" onClick={() => setMobileNavOpen(false)} className="text-sm text-foreground hover:text-foreground transition-colors">Pricing</a>
              <a href="/about" onClick={(e) => { e.preventDefault(); setMobileNavOpen(false); navigate("/about"); }} className="text-sm text-foreground hover:text-foreground transition-colors">About</a>
              <a href="/contact" onClick={(e) => { e.preventDefault(); setMobileNavOpen(false); navigate("/contact"); }} className="text-sm text-foreground hover:text-foreground transition-colors">Contact</a>
              <a href="/faq" onClick={(e) => { e.preventDefault(); setMobileNavOpen(false); navigate("/faq"); }} className="text-sm text-foreground hover:text-foreground transition-colors">FAQ</a>
              <a href="/blog" onClick={(e) => { e.preventDefault(); setMobileNavOpen(false); navigate("/blog"); }} className="text-sm text-foreground hover:text-foreground transition-colors">Blog</a>
              <div className="pt-2 border-t border-border/80 flex flex-col gap-2">
                <a href="mailto:support@alwakeelo.com" className="inline-flex items-center gap-2 text-sm text-primary hover:text-foreground transition-colors">
                  <Mail size={14} /> support@alwakeelo.com
                </a>
                <a href="tel:00923358341897" className="inline-flex items-center gap-2 text-sm text-primary hover:text-foreground transition-colors">
                  <PhoneCall size={14} /> 00923358341897
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>

      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-6">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/3 rounded-full blur-[120px]" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-8">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-[11px] text-primary font-bold uppercase tracking-widest">Pakistan's First Open-Source Legal AI Platform</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6" style={{ fontFamily: "'Playfair Display', serif" }}>
            <span className="italic">Alwakeelo AI Workspace</span>
            <br />
            <span className="text-primary italic">for Advocates & Chambers</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Research case law, draft petitions and contracts, and generate client-ready legal documents in minutes
            with Alwakeelo AI, fine-tuned for Pakistani legal practice.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={ctaTarget}
              className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-primary transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20"
            >
              {user ? "Open Dashboard" : "Start Free"} <ArrowRight size={16} />
            </a>
            <a
              href="/?consult=1#consult"
              className="w-full sm:w-auto px-8 py-4 border border-border text-foreground rounded-2xl text-sm font-bold hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"
            >
              Book Chamber Consultation <ArrowRight size={16} />
            </a>
          </div>
          <div className="mt-4">
            <a
              href="#features"
              className="inline-flex items-center gap-2 text-sm font-bold text-foreground hover:text-foreground transition-all"
            >
              Explore Features
              <ArrowRight size={14} />
            </a>
          </div>

          <div className="flex items-center justify-center gap-8 mt-12 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-primary/60" />
              <span className="text-xs font-bold uppercase tracking-wider">Secure & Private</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-primary/60" />
              <span className="text-xs font-bold uppercase tracking-wider">Pakistani Law Focus</span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Zap size={16} className="text-primary/60" />
              <span className="text-xs font-bold uppercase tracking-wider">AI Powered</span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Users size={16} className="text-primary/60" />
              <span className="text-xs font-bold uppercase tracking-wider">Discussed on Reddit</span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 px-6 bg-card border-y border-border/60">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] text-primary font-black uppercase tracking-[0.3em] mb-3">How It Works</p>
            <h2 className="text-3xl md:text-4xl font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>
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
              <div key={item.step} className="rounded-2xl border border-border bg-card p-6">
                <p className="text-[10px] text-primary font-black tracking-[0.3em] mb-2">{item.step}</p>
                <h3 className="text-foreground text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MCP Integration Feature Section */}
      <section className="py-16 md:py-24 px-6 bg-gradient-to-b from-background to-card border-b border-border/60">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs text-amber-500 font-bold uppercase tracking-widest">
              <Sparkles size={12} className="animate-pulse" />
              New Feature
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
              Bring AL WAKEELO RAG <br/>
              <span className="text-primary italic">directly into Claude &amp; ChatGPT</span>
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Connect our massive database of 600,000+ judgments and laws directly to your own AI chatbot app. 
              No more copying and pasting—simply generate a secure API Key and start searching Pakistan laws inside Claude Desktop, Claude Connectors, or ChatGPT Custom GPTs.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <button
                onClick={() => navigate("/mcp")}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
              >
                View MCP Integration Guide <ArrowRight size={13} />
              </button>
            </div>
          </div>
          
          <div className="lg:col-span-6 relative">
            <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-2xl -z-10" />
            <div className="rounded-3xl border border-border bg-card p-6 md:p-8 space-y-6 shadow-xl">
              <div className="flex gap-4 items-start border-b border-border pb-4">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 flex-shrink-0">
                  <Cpu size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">Claude Connectors</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Paste our secure token URL directly into Claude Connectors settings to list and call RAG search tools.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start border-b border-border pb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  <Compass size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">ChatGPT Custom Actions</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Import our OpenAPI schema URL into your Custom GPT Actions to instantly integrate statutory search.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 flex-shrink-0">
                  <Terminal size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">Google Gemini Spark</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Bridge AL WAKEELO directly into Google Workspace Gemini sessions using our stateful remote transport.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 px-6 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] text-primary font-black uppercase tracking-[0.3em] mb-3">Platform Preview</p>
            <h2 className="text-3xl md:text-4xl font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>
              Built Like a Modern Legal Workspace
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-border bg-gradient-to-b from-[#1f2a40] to-[#131c2e] p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">Research Panel</p>
                <span className="text-[10px] text-slate-400">Live Workspace</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-background p-3 text-xs text-foreground">Judgment Search: <span className="text-primary">2023 SCMR 1450</span></div>
                <div className="rounded-xl border border-border bg-background p-3 text-xs text-foreground">Statute Lookup: <span className="text-primary">CPC S.9</span></div>
                <div className="rounded-xl border border-border bg-background p-3 text-xs text-foreground">AI Summary: <span className="text-foreground">Actionable litigation notes generated.</span></div>
              </div>
            </div>
            <div className="rounded-3xl border border-border bg-gradient-to-b from-[#241f17] to-[#17120f] p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">Drafting Panel</p>
                <span className="text-[10px] text-slate-400">Conversion Ready</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-primary/20 bg-background p-3 text-xs text-foreground">Legal Draft: <span className="text-primary">Petition structure ready</span></div>
                <div className="rounded-xl border border-primary/20 bg-background p-3 text-xs text-foreground">Contract Risk: <span className="text-primary">Critical clauses flagged</span></div>
                <div className="rounded-xl border border-primary/20 bg-background p-3 text-xs text-foreground">Client Intake: <span className="text-foreground">Submit case + chamber callback.</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 md:py-28 px-6 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] text-primary font-black uppercase tracking-[0.3em] mb-3">Capabilities</p>
            <h2 className="text-3xl md:text-4xl font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>
              Everything You Need in One Platform
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
              From case research to contract drafting, Al Wakeelo handles the full spectrum of legal work.
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
                  className={className}
                />
              );
            })}
          </div>
          <div className="mt-8 text-center">
            <a
              href={ctaTarget}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-border text-foreground text-sm font-bold hover:border-primary hover:text-primary transition-all"
            >
              Explore Full Platform <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </section>

      <section className="py-14 px-6 bg-background border-y border-border/60">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <p className="text-[11px] text-primary font-black uppercase tracking-[0.3em] mb-3">Who It's For</p>
            <h2 className="text-2xl md:text-3xl font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>
              Built for Real Legal Workflows
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "Independent Advocates", desc: "Faster research, drafting, and client-prep from a single workspace." },
              { title: "Law Chambers", desc: "Shared legal operations with structured outputs and chamber-grade consistency." },
              { title: "In-house Legal Teams", desc: "Quick legal analysis and document review for day-to-day legal operations." },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-foreground text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 md:py-28 px-6 bg-card">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] text-primary font-black uppercase tracking-[0.3em] mb-3">Plans</p>
            <h2 className="text-3xl md:text-4xl font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>
              Choose Your Plan
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
              Transparent pricing by AI actions, model access, output caps, and upload/OCR limits.
            </p>
            <div className="mt-6 inline-flex items-center rounded-xl border border-border bg-background p-1.5 gap-1">
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
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:text-foreground"
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
                    ? "bg-gradient-to-b from-primary/10 to-[#1e293b] border-2 border-primary/30 shadow-xl shadow-primary/10"
                    : "bg-card border border-border hover:border-border"
                } ${selectedPlan === plan.key ? "ring-2 ring-primary/70" : ""}`}
              >
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${plan.highlighted ? "text-primary" : "text-muted-foreground"}`}>
                  {plan.badge}
                </p>
                <h3 className="text-2xl font-bold text-foreground mb-1">{plan.title}</h3>
                <p className="text-primary text-sm font-black mb-1">
                  {plan.key === "free"
                    ? plan.price
                    : plan.key === "enterprise"
                      ? plan.price
                      : getPlanCyclePricing(plan, billingCycle).totalLabel}
                </p>
                {plan.key !== "free" && plan.key !== "enterprise" && (
                  <p className="text-[10px] text-muted-foreground mb-1">
                    {getPlanCyclePricing(plan, billingCycle).effectiveMonthlyLabel} · {getPlanCyclePricing(plan, billingCycle).savingsLabel}
                  </p>
                )}
                {plan.key === "enterprise" && billingCycle !== "monthly" && (
                  <p className="text-[10px] text-muted-foreground mb-1">Enterprise billing remains custom and contact-led.</p>
                )}
                <p className="text-xs text-muted-foreground mb-5">{plan.subtitle}</p>
                <ul className="space-y-2.5 mb-7">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-foreground leading-relaxed">
                      <ChevronRight size={13} className="text-primary flex-shrink-0 mt-0.5" /> {feature}
                    </li>
                  ))}
                </ul>
                {plan.key === "enterprise" ? (
                  <a
                    href="mailto:support@alwakeelo.com?subject=Enterprise%20Consultation"
                    className="w-full py-3 border border-border text-foreground rounded-xl text-xs font-black uppercase tracking-widest hover:border-primary hover:text-primary transition-all flex items-center justify-center"
                  >
                    {plan.cta}
                  </a>
                ) : plan.key === "free" ? (
                  <a
                    href={user ? "/dashboard" : "/auth"}
                    className="w-full py-3 border border-border text-foreground rounded-xl text-xs font-black uppercase tracking-widest hover:border-primary hover:text-primary transition-all flex items-center justify-center"
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <a
                    href={`/checkout?plan=${plan.key}&cycle=${billingCycle}`}
                    className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center ${
                      plan.highlighted
                        ? "bg-primary text-primary-foreground hover:bg-primary shadow-lg shadow-primary/20"
                        : "border border-border text-foreground hover:border-primary hover:text-primary"
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
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary mb-3">Chamber Expansion</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-foreground">
                <p>Extra seat: <span className="text-primary font-bold">+PKR 1,000/month per user</span></p>
                <p>Extra AI limit: <span className="text-primary font-bold">+350 AI actions/month per user</span></p>
                <p>Suggested upload add-on: <span className="text-primary font-bold">+300 files/month per user</span></p>
                <p>Suggested Apex add-on: <span className="text-primary font-bold">+50 Apex requests/month per user</span></p>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                AI action counting: 1 chat/draft/summarize request = 1 action. Audio transcription: every 2 minutes = 1 action.
              </p>
            </div>
          )}
        </div>
      </section>

      <section id="about" className="py-20 md:py-28 px-6 bg-background">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[11px] text-primary font-black uppercase tracking-[0.3em] mb-3">About</p>
          <h2 className="text-3xl md:text-4xl font-bold italic mb-6" style={{ fontFamily: "'Playfair Display', serif" }}>
            Built for Pakistani Legal Professionals
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-2xl mx-auto">
            Al Wakeelo combines cutting-edge AI technology with deep knowledge of Pakistani law to provide 
            lawyers, advocates, and legal professionals with a powerful research and drafting assistant. 
            Our platform is backed by a comprehensive database of Pakistani judgments, statutes, and legal texts.
            Trusted by advocates and discussed across platforms including Reddit, legal forums, and professional networks.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
            {[
              { num: legalDocumentsLabel, label: "Documents Indexed" },
              { num: `${CORE_FEATURES.length}+`, label: "Modules Available" },
              { num: "<10s", label: "Avg Response Time" },
              { num: "Advocates+", label: "Used by Advocates & Chambers" },
            ].map((stat, i) => (
              <div key={i} className="p-6 bg-card border border-border rounded-2xl">
                <p className="text-2xl font-bold text-primary mb-1">{stat.num}</p>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="py-20 px-6 bg-card">
        <div className="max-w-3xl mx-auto text-center">
          <div id="consult" className="h-0 w-0" />
          <h2 className="text-3xl md:text-4xl font-bold italic mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            Ready for Professional Consultation?
          </h2>
          <p className="text-muted-foreground mb-8">
            Start with AI guidance, then connect with our chamber for professional legal consultation.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={ctaTarget}
              className="px-8 py-3.5 bg-primary text-primary-foreground rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-primary transition-all flex items-center gap-2 shadow-xl shadow-primary/20"
            >
              {user ? "Go to Dashboard" : "Start Now"} <ArrowRight size={16} />
            </a>
            <a
              href="mailto:support@alwakeelo.com?subject=Legal%20Consultation"
              className="px-8 py-3.5 border border-border text-foreground rounded-2xl text-sm font-bold hover:border-primary hover:text-primary transition-all inline-flex items-center gap-2"
            >
              <Mail size={15} /> Email Chamber
            </a>
            <a
              href="tel:00923358341897"
              className="px-8 py-3.5 border border-border text-foreground rounded-2xl text-sm font-bold hover:border-primary hover:text-primary transition-all inline-flex items-center gap-2"
            >
              <PhoneCall size={15} /> Call Chamber
            </a>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[11px] text-primary font-black uppercase tracking-[0.3em] mb-3">FAQ</p>
            <h2 className="text-3xl md:text-4xl font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <div key={item.q} className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-base font-bold text-foreground mb-2">{item.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <footer className="py-10 px-6 bg-background border-t border-border/50">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-amber-400/30">
                <img src="/logo.svg" alt="Alwakeelo logo" className="w-full h-full object-cover" />
              </div>
              <span className="text-sm font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>Alwakeelo</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <a href="/about" onClick={(e) => { e.preventDefault(); navigate("/about"); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">About Us</a>
              <a href="/contact" onClick={(e) => { e.preventDefault(); navigate("/contact"); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact Us</a>
              <a href="/faq" onClick={(e) => { e.preventDefault(); navigate("/faq"); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
              <a href="/blog" onClick={(e) => { e.preventDefault(); navigate("/blog"); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Legal Blog</a>
              <a href="/privacy" onClick={(e) => { e.preventDefault(); navigate("/privacy"); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="/terms" onClick={(e) => { e.preventDefault(); navigate("/terms"); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms and Conditions</a>
              <a href="/cancellation-return-refund-policy" onClick={(e) => { e.preventDefault(); navigate("/cancellation-return-refund-policy"); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Cancellation/Return/Refund Policy</a>
              <a href="/ownership-statement" onClick={(e) => { e.preventDefault(); navigate("/ownership-statement"); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Ownership Statement</a>
              <a href="https://www.reddit.com/" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Reddit Community</a>
              <a href="https://www.linkedin.com/company/al-wakeelo" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">LinkedIn</a>
            </div>
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Alwakeelo. All rights reserved.
            </p>
          </div>
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Alwakeelo by <span className="text-muted-foreground font-semibold">Majnun Studio</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
