import { Scale, ArrowRight, Search, FileText, MessageSquare, BookOpen, Shield, Zap, Crown, Users, Mic, Paperclip, Globe, ChevronRight, LayoutDashboard } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

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

export default function LandingPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const ctaTarget = user ? "/dashboard" : "/auth";

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
            <a href="#features" className="text-sm text-slate-400 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors">Pricing</a>
            <a href="#about" className="text-sm text-slate-400 hover:text-white transition-colors">About</a>
          </div>
          <a
            href={ctaTarget}
            className="px-6 py-2.5 bg-amber-500 text-slate-950 rounded-xl text-sm font-bold hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
          >
            {user ? <><LayoutDashboard size={16} /> Dashboard</> : "Get Started"}
          </a>
        </div>
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
              href={ctaTarget}
              className="w-full sm:w-auto px-8 py-4 bg-amber-500 text-slate-950 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-amber-400 transition-all flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20"
            >
              {user ? "Go to Dashboard" : "Enter the Chambers"} <ArrowRight size={16} />
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
            <FeatureCard icon={MessageSquare} title="AI Legal Chat" desc="Consult with an AI legal advisor trained on Pakistani law. Get opinions, strategies, and analysis instantly." bgClass="bg-amber-500/10" iconClass="text-amber-500" />
            <FeatureCard icon={Search} title="Judgment Search" desc="Search through Pakistani case law with AI-powered analysis. Find relevant judgments and citations quickly." bgClass="bg-blue-500/10" iconClass="text-blue-500" />
            <FeatureCard icon={BookOpen} title="Statute Lookup" desc="Browse and analyze Pakistani statutes including PPC, CrPC, CPC, and more with AI explanations." bgClass="bg-emerald-500/10" iconClass="text-emerald-500" />
            <FeatureCard icon={FileText} title="Legal Drafting" desc="Draft professional legal documents, petitions, applications, and notices with AI assistance." bgClass="bg-amber-500/10" iconClass="text-amber-500" />
            <FeatureCard icon={Shield} title="Contract Drafting" desc="Generate airtight contracts with proper Pakistani legal conventions, clauses, and formatting." bgClass="bg-red-500/10" iconClass="text-red-500" />
            <FeatureCard icon={Paperclip} title="Document Analysis" desc="Upload PDFs, legal documents, and case files. AI reads and analyzes them for your queries." bgClass="bg-cyan-500/10" iconClass="text-cyan-500" />
            <FeatureCard icon={Mic} title="Voice Transcription" desc="Upload audio recordings of hearings or dictations. AI transcribes and integrates them into your workflow." bgClass="bg-pink-500/10" iconClass="text-pink-500" />
            <FeatureCard icon={Crown} title="Knowledge Vault" desc="Access a curated database of Pakistani legal texts, statutes, and precedents synced from verified sources." bgClass="bg-amber-500/10" iconClass="text-amber-500" />
            <FeatureCard icon={Users} title="Team Collaboration" desc="Share conversations, bookmark insights, and manage your case research history seamlessly." bgClass="bg-indigo-500/10" iconClass="text-indigo-500" />
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 md:py-28 px-6 bg-[#131c2e]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] text-amber-500 font-black uppercase tracking-[0.3em] mb-3">Plans</p>
            <h2 className="text-3xl md:text-4xl font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>
              Choose Your Plan
            </h2>
            <p className="text-slate-400 mt-4 max-w-xl mx-auto">
              Start free and upgrade as your practice grows. All plans include core AI features.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 bg-[#1e293b] border border-slate-800 rounded-3xl hover:border-slate-700 transition-all">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Starter</p>
              <h3 className="text-3xl font-bold text-white mb-1">Free</h3>
              <p className="text-sm text-slate-500 mb-6">Perfect for exploring</p>
              <ul className="space-y-3 mb-8">
                {["10 AI queries/month", "Basic judgment search", "Statute lookup", "Legal drafting", "File attachments"].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                    <ChevronRight size={14} className="text-amber-500 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <a
                href={ctaTarget}
                className="w-full py-3.5 border border-slate-700 text-slate-300 rounded-xl text-sm font-bold hover:border-amber-500 hover:text-amber-500 transition-all flex items-center justify-center"
              >
                Get Started Free
              </a>
            </div>

            <div className="p-8 bg-gradient-to-b from-amber-500/10 to-[#1e293b] border-2 border-amber-500/30 rounded-3xl relative shadow-xl shadow-amber-500/5">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-500 text-slate-950 rounded-full text-[10px] font-black uppercase tracking-widest">
                Most Popular
              </div>
              <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest mb-1">Pro</p>
              <h3 className="text-3xl font-bold text-white mb-1">Pro</h3>
              <p className="text-sm text-slate-500 mb-6">For active practitioners</p>
              <ul className="space-y-3 mb-8">
                {["500 AI queries/month", "Advanced judgment search", "Turbo AI mode (Pro model)", "Contract drafting", "Audio transcription", "Priority support", "Document analysis"].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                    <ChevronRight size={14} className="text-amber-500 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <a
                href={ctaTarget}
                className="w-full py-3.5 bg-amber-500 text-slate-950 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center"
              >
                Upgrade to Pro
              </a>
            </div>

            <div className="p-8 bg-[#1e293b] border border-slate-800 rounded-3xl hover:border-slate-700 transition-all">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Enterprise</p>
              <h3 className="text-3xl font-bold text-white mb-1">Enterprise</h3>
              <p className="text-sm text-slate-500 mb-6">For law firms & teams</p>
              <ul className="space-y-3 mb-8">
                {["Unlimited AI queries", "All Pro features", "Custom knowledge base", "Team collaboration", "Admin dashboard", "Priority API access", "Dedicated support"].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                    <ChevronRight size={14} className="text-amber-500 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <a
                href={ctaTarget}
                className="w-full py-3.5 border border-slate-700 text-slate-300 rounded-xl text-sm font-bold hover:border-amber-500 hover:text-amber-500 transition-all flex items-center justify-center"
              >
                Contact Us
              </a>
            </div>
          </div>
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
              { num: "350+", label: "Legal Documents" },
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

      <section className="py-20 px-6 bg-[#131c2e]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold italic mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            Ready to Transform Your Practice?
          </h2>
          <p className="text-slate-400 mb-8">
            Join hundreds of Pakistani legal professionals already using Al Wakeelo.
          </p>
          <a
            href={ctaTarget}
            className="px-10 py-4 bg-amber-500 text-slate-950 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-amber-400 transition-all flex items-center gap-2 mx-auto shadow-xl shadow-amber-500/20"
          >
            {user ? "Go to Dashboard" : "Start Using Al Wakeelo"} <ArrowRight size={16} />
          </a>
        </div>
      </section>

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
              <a href="/terms" onClick={(e) => { e.preventDefault(); navigate("/terms"); }} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Terms of Service</a>
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
