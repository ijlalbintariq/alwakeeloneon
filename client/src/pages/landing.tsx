import { useState } from "react";
import { Scale, ArrowRight, Search, FileText, MessageSquare, BookOpen, Shield, Zap, Crown, Users, Mic, Paperclip, Globe, ChevronRight, LayoutDashboard, Menu, X, PhoneCall, Mail } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { SUBSCRIPTION_PLANS, type SubscriptionPlanKey } from "@/lib/subscription-plans";

function FeatureCard({ icon: Icon, title, desc, bgClass, iconClass }: { icon: any; title: string; desc: string; bgClass: string; iconClass: string }) {
  return (
    <div className="group p-7 bg-[#1e293b] border border-slate-800 rounded-2xl hover:border-slate-700 transition-all hover:shadow-xl">
      <div className={`w-12 h-12 rounded-xl ${bgClass} flex items-center justify-center mb-4`}>
        <Icon size={22} className={iconClass} />
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}

const CORE_FEATURES = [
  { icon: MessageSquare, title: "AI Legal Chat", desc: "Consult with an AI legal advisor trained on Pakistani law. Get strategy and next-step guidance fast.", bgClass: "bg-amber-500/10", iconClass: "text-amber-500" },
  { icon: Search, title: "Judgment Search", desc: "Find relevant Pakistani case law with quick citation-focused search and contextual summaries.", bgClass: "bg-blue-500/10", iconClass: "text-blue-500" },
  { icon: BookOpen, title: "Statute Lookup", desc: "Navigate Pakistani statutes and sections with plain-language legal explanations.", bgClass: "bg-emerald-500/10", iconClass: "text-emerald-500" },
  { icon: FileText, title: "Legal Drafting", desc: "Prepare petitions, notices, and applications faster with drafting workflows.", bgClass: "bg-amber-500/10", iconClass: "text-amber-500" },
  { icon: Shield, title: "Contract Drafting", desc: "Generate professional contracts with structured clauses and risk-focused review.", bgClass: "bg-red-500/10", iconClass: "text-red-500" },
  { icon: Paperclip, title: "Document Analysis", desc: "Upload legal files and get practical insights grounded in your documents.", bgClass: "bg-cyan-500/10", iconClass: "text-cyan-500" },
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
];

export default function LandingPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanKey>("pro");
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
    <div className="min-h-screen bg-[#0f172a] text-white overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0f172a]/90 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Scale size={20} className="text-slate-900" />
            </div>
            <span className="text-xl font-bold italic tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>Al Wakeelo</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="/" className="text-sm text-slate-300 hover:text-white transition-colors">Home</a>
            <a href="#features" className="text-sm text-slate-400 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors">Pricing</a>
            <a href="#about" className="text-sm text-slate-400 hover:text-white transition-colors">About</a>
            <a href="#contact" className="text-sm text-slate-400 hover:text-white transition-colors">Contact</a>
            <a
              href="/?consult=1#consult"
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20"
            >
              Start Consultation
            </a>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              className="md:hidden h-10 w-10 rounded-xl border border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 p-0 inline-flex items-center justify-center"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            >
              {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <a
              href={ctaTarget}
              className="px-6 py-2.5 bg-amber-500 text-slate-950 rounded-xl text-sm font-bold hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              {user ? <><LayoutDashboard size={16} /> Dashboard</> : "Start Now"}
            </a>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="md:hidden border-t border-slate-800/70">
            <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-3">
              <a href="/" onClick={() => setMobileNavOpen(false)} className="text-sm text-slate-200 hover:text-white transition-colors">Home</a>
              <a href="#features" onClick={() => setMobileNavOpen(false)} className="text-sm text-slate-300 hover:text-white transition-colors">Features</a>
              <a href="#pricing" onClick={() => setMobileNavOpen(false)} className="text-sm text-slate-300 hover:text-white transition-colors">Pricing</a>
              <a href="#about" onClick={() => setMobileNavOpen(false)} className="text-sm text-slate-300 hover:text-white transition-colors">About</a>
              <a href="#contact" onClick={() => setMobileNavOpen(false)} className="text-sm text-slate-300 hover:text-white transition-colors">Contact</a>
              <a
                href="/?consult=1#consult"
                onClick={() => setMobileNavOpen(false)}
                className="text-sm text-amber-300 hover:text-amber-200 transition-colors font-bold"
              >
                Start Consultation
              </a>
              <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
                <a href="mailto:support@alwakeelo.com" className="inline-flex items-center gap-2 text-sm text-amber-300 hover:text-amber-200 transition-colors">
                  <Mail size={14} /> support@alwakeelo.com
                </a>
                <a href="tel:00923096875797" className="inline-flex items-center gap-2 text-sm text-amber-300 hover:text-amber-200 transition-colors">
                  <PhoneCall size={14} /> 00923096875797
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>

      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-6">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500/3 rounded-full blur-[120px]" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full mb-8">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-[11px] text-amber-400 font-bold uppercase tracking-widest">Pakistan's First Open-Source AI Legal Assistant</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6" style={{ fontFamily: "'Playfair Display', serif" }}>
            <span className="italic">Your Digital</span>{" "}
            <span className="text-amber-500 italic">Lawyer,</span>
            <br />
            <span className="italic">Always on Duty</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Al Wakeelo is Pakistan's first open-source AI legal assistant. Search judgments, analyze statutes,
            draft contracts, and get expert legal guidance — all powered by advanced AI trained on Pakistani law.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/?consult=1#consult"
              className="w-full sm:w-auto px-8 py-4 bg-amber-500 text-slate-950 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-amber-400 transition-all flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20"
            >
              Consult AI Now <ArrowRight size={16} />
            </a>
            <a
              href={ctaTarget}
              className="w-full sm:w-auto px-8 py-4 border border-slate-700 text-slate-200 rounded-2xl text-sm font-bold hover:border-amber-500 hover:text-amber-300 transition-all flex items-center justify-center gap-2"
            >
              {user ? "Go to Dashboard" : "Hire a Lawyer"} <ArrowRight size={16} />
            </a>
            <a
              href="#features"
              className="w-full sm:w-auto px-8 py-4 border border-slate-700 text-slate-300 rounded-2xl text-sm font-bold hover:border-slate-500 hover:text-white transition-all text-center"
            >
              Explore Features
            </a>
          </div>

          <div className="flex items-center justify-center gap-8 mt-12 text-slate-500">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-amber-500/60" />
              <span className="text-xs font-bold uppercase tracking-wider">Secure & Private</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-amber-500/60" />
              <span className="text-xs font-bold uppercase tracking-wider">Pakistani Law Focus</span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Zap size={16} className="text-amber-500/60" />
              <span className="text-xs font-bold uppercase tracking-wider">AI Powered</span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 px-6 bg-[#111b2d] border-y border-slate-800/60">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] text-amber-500 font-black uppercase tracking-[0.3em] mb-3">How It Works</p>
            <h2 className="text-3xl md:text-4xl font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>
              From Query to Consultation in 3 Steps
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                step: "01",
                title: "Ask Your Legal Question",
                desc: "Start with AI guidance for Pakistani law issues through chat and legal search.",
              },
              {
                step: "02",
                title: "Review Drafts & Evidence",
                desc: "Use drafting, contract, and document tools to prepare a stronger legal position.",
              },
              {
                step: "03",
                title: "Consult the Chamber",
                desc: "Submit case details or contact the chamber for professional advocate review.",
              },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl border border-slate-800 bg-[#1a2437] p-6">
                <p className="text-[10px] text-amber-400 font-black tracking-[0.3em] mb-2">{item.step}</p>
                <h3 className="text-white text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 px-6 bg-[#0f172a]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] text-amber-500 font-black uppercase tracking-[0.3em] mb-3">Platform Preview</p>
            <h2 className="text-3xl md:text-4xl font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>
              Built Like a Modern Legal Workspace
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-[#1f2a40] to-[#131c2e] p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">Research Panel</p>
                <span className="text-[10px] text-slate-500">Live Workspace</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-700 bg-[#0f172a] p-3 text-xs text-slate-300">Judgment Search: <span className="text-amber-300">2023 SCMR 1450</span></div>
                <div className="rounded-xl border border-slate-700 bg-[#0f172a] p-3 text-xs text-slate-300">Statute Lookup: <span className="text-amber-300">CPC S.9</span></div>
                <div className="rounded-xl border border-slate-700 bg-[#0f172a] p-3 text-xs text-slate-300">AI Summary: <span className="text-slate-200">Actionable litigation notes generated.</span></div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-[#241f17] to-[#17120f] p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">Drafting Panel</p>
                <span className="text-[10px] text-slate-500">Conversion Ready</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-amber-500/20 bg-[#0f172a] p-3 text-xs text-slate-300">Legal Draft: <span className="text-amber-300">Petition structure ready</span></div>
                <div className="rounded-xl border border-amber-500/20 bg-[#0f172a] p-3 text-xs text-slate-300">Contract Risk: <span className="text-amber-300">Critical clauses flagged</span></div>
                <div className="rounded-xl border border-amber-500/20 bg-[#0f172a] p-3 text-xs text-slate-300">Client Intake: <span className="text-slate-200">Submit case + chamber callback.</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 md:py-28 px-6 bg-[#0f172a]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] text-amber-500 font-black uppercase tracking-[0.3em] mb-3">Capabilities</p>
            <h2 className="text-3xl md:text-4xl font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>
              Everything You Need in One Platform
            </h2>
            <p className="text-slate-400 mt-4 max-w-xl mx-auto">
              From case research to contract drafting, Al Wakeelo handles the full spectrum of legal work.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CORE_FEATURES.map((item) => (
              <FeatureCard
                key={item.title}
                icon={item.icon}
                title={item.title}
                desc={item.desc}
                bgClass={item.bgClass}
                iconClass={item.iconClass}
              />
            ))}
          </div>
          <div className="mt-8 text-center">
            <a
              href={ctaTarget}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-700 text-slate-300 text-sm font-bold hover:border-amber-500 hover:text-amber-300 transition-all"
            >
              Explore Full Platform <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 md:py-28 px-6 bg-[#131c2e]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] text-amber-500 font-black uppercase tracking-[0.3em] mb-3">Plans</p>
            <h2 className="text-3xl md:text-4xl font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>
              Choose Your Plan
            </h2>
            <p className="text-slate-400 mt-4 max-w-xl mx-auto">
              Transparent pricing by AI actions, model access, output caps, and upload/OCR limits.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {SUBSCRIPTION_PLANS.map((plan) => (
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
                    ? "bg-gradient-to-b from-amber-500/10 to-[#1e293b] border-2 border-amber-500/30 shadow-xl shadow-amber-500/10"
                    : "bg-[#1e293b] border border-slate-800 hover:border-slate-700"
                } ${selectedPlan === plan.key ? "ring-2 ring-amber-400/70" : ""}`}
              >
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${plan.highlighted ? "text-amber-500" : "text-slate-500"}`}>
                  {plan.badge}
                </p>
                <h3 className="text-2xl font-bold text-white mb-1">{plan.title}</h3>
                <p className="text-amber-400 text-sm font-black mb-1">{plan.price}</p>
                <p className="text-xs text-slate-500 mb-5">{plan.subtitle}</p>
                <ul className="space-y-2.5 mb-7">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                      <ChevronRight size={13} className="text-amber-500 flex-shrink-0 mt-0.5" /> {feature}
                    </li>
                  ))}
                </ul>
                {plan.key === "enterprise" ? (
                  <a
                    href="mailto:support@alwakeelo.com?subject=Enterprise%20Consultation"
                    className="w-full py-3 border border-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest hover:border-amber-500 hover:text-amber-400 transition-all flex items-center justify-center"
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <a
                    href={`/checkout?plan=${plan.key}`}
                    className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center ${
                      plan.highlighted
                        ? "bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-lg shadow-amber-500/20"
                        : "border border-slate-700 text-slate-300 hover:border-amber-500 hover:text-amber-400"
                    }`}
                  >
                    {plan.cta}
                  </a>
                )}
              </div>
            ))}
          </div>

          {selectedPlan === "chamber" && (
            <div className="mt-8 rounded-2xl border border-slate-800 bg-[#1b2537] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-500 mb-3">Chamber Expansion</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300">
                <p>Extra seat: <span className="text-amber-300 font-bold">+PKR 1,000/month per user</span></p>
                <p>Extra AI limit: <span className="text-amber-300 font-bold">+350 AI actions/month per user</span></p>
                <p>Suggested upload add-on: <span className="text-amber-300 font-bold">+300 files/month per user</span></p>
                <p>Suggested Apex add-on: <span className="text-amber-300 font-bold">+50 Apex requests/month per user</span></p>
              </div>
              <p className="mt-3 text-[11px] text-slate-400">
                AI action counting: 1 chat/draft/summarize request = 1 action. Audio transcription: every 2 minutes = 1 action.
              </p>
            </div>
          )}
        </div>
      </section>

      <section id="about" className="py-20 md:py-28 px-6 bg-[#0f172a]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[11px] text-amber-500 font-black uppercase tracking-[0.3em] mb-3">About</p>
          <h2 className="text-3xl md:text-4xl font-bold italic mb-6" style={{ fontFamily: "'Playfair Display', serif" }}>
            Built for Pakistani Legal Professionals
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed mb-8 max-w-2xl mx-auto">
            Al Wakeelo combines cutting-edge AI technology with deep knowledge of Pakistani law to provide 
            lawyers, advocates, and legal professionals with a powerful research and drafting assistant. 
            Our platform is backed by a comprehensive database of Pakistani judgments, statutes, and legal texts.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
            {[
              { num: legalDocumentsLabel, label: "Legal Documents" },
              { num: "AI", label: "Powered Analysis" },
              { num: "24/7", label: "Available" },
              { num: "PKR", label: "Local Currency" },
            ].map((stat, i) => (
              <div key={i} className="p-6 bg-[#1e293b] border border-slate-800 rounded-2xl">
                <p className="text-2xl font-bold text-amber-500 mb-1">{stat.num}</p>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="py-20 px-6 bg-[#131c2e]">
        <div className="max-w-3xl mx-auto text-center">
          <div id="consult" className="h-0 w-0" />
          <h2 className="text-3xl md:text-4xl font-bold italic mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            Ready for Professional Consultation?
          </h2>
          <p className="text-slate-400 mb-8">
            Start with AI guidance, then connect with our chamber for professional legal consultation.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={ctaTarget}
              className="px-8 py-3.5 bg-amber-500 text-slate-950 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-amber-400 transition-all flex items-center gap-2 shadow-xl shadow-amber-500/20"
            >
              {user ? "Go to Dashboard" : "Start Now"} <ArrowRight size={16} />
            </a>
            <a
              href="mailto:support@alwakeelo.com?subject=Legal%20Consultation"
              className="px-8 py-3.5 border border-slate-700 text-slate-200 rounded-2xl text-sm font-bold hover:border-amber-500 hover:text-amber-300 transition-all inline-flex items-center gap-2"
            >
              <Mail size={15} /> Email Chamber
            </a>
            <a
              href="tel:00923096875797"
              className="px-8 py-3.5 border border-slate-700 text-slate-200 rounded-2xl text-sm font-bold hover:border-amber-500 hover:text-amber-300 transition-all inline-flex items-center gap-2"
            >
              <PhoneCall size={15} /> Call Chamber
            </a>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 bg-[#0f172a]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[11px] text-amber-500 font-black uppercase tracking-[0.3em] mb-3">FAQ</p>
            <h2 className="text-3xl md:text-4xl font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <div key={item.q} className="rounded-2xl border border-slate-800 bg-[#1a2437] p-5">
                <h3 className="text-base font-bold text-white mb-2">{item.q}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <footer className="py-10 px-6 bg-[#0f172a] border-t border-slate-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
                <Scale size={16} className="text-slate-900" />
              </div>
              <span className="text-sm font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>Al Wakeelo</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="/privacy" onClick={(e) => { e.preventDefault(); navigate("/privacy"); }} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Privacy Policy</a>
              <a href="/terms" onClick={(e) => { e.preventDefault(); navigate("/terms"); }} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Terms and Conditions</a>
              <a href="/cancellation-return-refund-policy" onClick={(e) => { e.preventDefault(); navigate("/cancellation-return-refund-policy"); }} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Cancellation/Return/Refund Policy</a>
              <a href="/ownership-statement" onClick={(e) => { e.preventDefault(); navigate("/ownership-statement"); }} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Ownership Statement</a>
            </div>
            <p className="text-xs text-slate-600">
              &copy; {new Date().getFullYear()} Al Wakeelo. All rights reserved.
            </p>
          </div>
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-600">
              Al Wakeelo by <span className="text-slate-400 font-semibold">Majnun Studio</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
