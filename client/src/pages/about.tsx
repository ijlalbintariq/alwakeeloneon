import { useDocumentHead } from "@/hooks/use-document-head";
import { Shield, Users, Gavel, Cpu } from "lucide-react";

export default function AboutPage() {
  useDocumentHead({
    title: "About Us | Al Wakeelo — Pakistan's AI Legal Assistant",
    description: "Learn about Al Wakeelo, Pakistan's premier AI legal assistant operated by Majnoon Studio. Discover our mission, values, and technology.",
    path: "/about",
  });

  return (
    <div className="space-y-12 fade-in">
      <section className="text-center space-y-4 py-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary font-bold uppercase tracking-widest">
          Who We Are
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
          Empowering Pakistani Advocates <br/>
          <span className="text-primary italic">with Artificial Intelligence</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Al Wakeelo is Pakistan's first comprehensive legal AI platform, designed to assist advocates, legal professionals, law students, and citizens in research, drafting, and analysis.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center border-t border-border pt-10">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>
            Our Mission: Democratizing Legal Knowledge
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            In Pakistan, legal research has traditionally been slow, expensive, and limited by access to physical law libraries. Al Wakeelo was born out of a desire to change this. 
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            By indexing over 600,000 judgments and major statutes, and training advanced AI models on Pakistani procedural and substantive law, we enable advocates to perform hours of case law research in seconds.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Our goal is to improve the efficiency of the legal process, giving every chamber the research capabilities of a large firm.
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-card/50 p-6 md:p-8 space-y-6">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <Gavel size={18} />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Verified Precedents Only</h3>
              <p className="text-xs text-muted-foreground mt-1">We cross-reference every cited judgment against our database to prevent AI hallucinations.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <Cpu size={18} />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Context-Aware Legal RAG</h3>
              <p className="text-xs text-muted-foreground mt-1">Our system reads your uploads and conversation history to provide relevant case recommendations.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border pt-10 space-y-6">
        <h2 className="text-2xl font-bold italic text-center" style={{ fontFamily: "'Playfair Display', serif" }}>
          Our Core Operations &amp; Team
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl border border-border bg-card/40 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Shield size={18} />
            </div>
            <h3 className="font-bold text-sm">Majnoon Studio</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Al Wakeelo is proudly owned, engineered, and operated by **Majnoon Studio**, a registered digital product development studio in Pakistan.
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-border bg-card/40 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Users size={18} />
            </div>
            <h3 className="font-bold text-sm">Chamber Partnerships</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We collaborate with active advocates of the High Courts and Supreme Court of Pakistan to verify our legal signal tokens and check drafting accuracy.
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-border bg-card/40 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Cpu size={18} />
            </div>
            <h3 className="font-bold text-sm">Neon Database</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Our massive index is hosted on secure Postgres databases with serverless edge caching, giving global-standard speed and reliability.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-primary/30 bg-primary/10 p-6 md:p-8 text-center space-y-4">
        <h2 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
          Ready to experience the future of Pakistani law?
        </h2>
        <p className="text-sm text-foreground max-w-xl mx-auto">
          Create a free account to search 600,000+ judgments, check statutes, and generate cited drafts.
        </p>
        <div className="flex justify-center gap-3">
          <a
            href="/auth?mode=register"
            className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Create Free Account
          </a>
          <a
            href="/contact"
            className="rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-medium text-foreground hover:bg-card/75 transition-colors"
          >
            Contact Chamber
          </a>
        </div>
      </section>
    </div>
  );
}
