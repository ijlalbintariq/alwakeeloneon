import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function OwnershipStatementPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-primary/35">
                <img src="/logo.svg" alt="Al Wakeelo logo" className="w-full h-full object-cover" />
              </div>
              <span className="text-sm font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>Al Wakeelo</span>
            </div>
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-10 md:py-16">
        <h1 className="text-4xl font-bold italic mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Ownership Statement</h1>
        <p className="text-sm text-muted-foreground mb-12">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="prose prose-invert prose-slate max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold text-primary mb-3">1. Platform Ownership</h2>
            <p className="text-foreground leading-relaxed">
              Al Wakeelo platform, including its product design, software code, user interface, trademarks, branding assets, workflows, and proprietary integrations, is owned by Al Wakeelo and protected under applicable intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">2. User-Provided Content</h2>
            <p className="text-foreground leading-relaxed">
              You retain ownership of the documents, files, prompts, and inputs you upload or submit. By using the service, you grant Al Wakeelo a limited license to process this content solely for service delivery, support, and product security operations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">3. AI-Generated Outputs</h2>
            <p className="text-foreground leading-relaxed">
              AI-generated outputs are produced for your operational use within legal research and drafting workflows. Final legal responsibility, validation, and professional use remains with the user and licensed legal practitioners.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">4. Public Legal Materials</h2>
            <p className="text-foreground leading-relaxed">
              Pakistani statutes, judgments, and other public legal references remain the property of their respective issuing authorities and public institutions. Al Wakeelo does not claim ownership of public-domain legal texts.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">5. Restrictions</h2>
            <ul className="list-disc list-inside text-foreground space-y-1 ml-4">
              <li>No unauthorized copying or resale of platform code or proprietary UI components.</li>
              <li>No reverse engineering, decompilation, or extraction of protected system logic.</li>
              <li>No misuse of trademarks, logos, or brand identity without written permission.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">6. Contact</h2>
            <p className="text-foreground leading-relaxed">
              For ownership or intellectual property matters, contact:
            </p>
            <p className="text-primary font-semibold mt-2">support@alwakeelo.com</p>
          </section>
        </div>
      </div>
    </div>
  );
}
