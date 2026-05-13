import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useDocumentHead } from "@/hooks/use-document-head";

export default function TermsOfServicePage() {
  useDocumentHead({
    title: "Terms of Service",
    description: "Al Wakeelo terms of service: acceptable use, AI output disclaimer, subscription terms, and legal notices for users in Pakistan.",
    path: "/terms",
  });
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-amber-400/35">
                <img src="/logo.svg" alt="Al Wakeelo logo" className="w-full h-full object-cover" />
              </div>
              <span className="text-sm font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>Al Wakeelo</span>
            </div>
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-10 md:py-16">
        <h1 className="text-4xl font-bold italic mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Terms and Conditions</h1>
        <p className="text-sm text-muted-foreground mb-6">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
        <div className="mb-10 rounded-xl border border-primary/35 bg-primary/10 px-4 py-3">
          <p className="text-sm text-foreground leading-relaxed">
            <span className="font-semibold">Business Ownership Notice:</span> Al Wakeelo is owned and operated by{" "}
            <span className="font-semibold text-foreground">Majnoon Studio</span> (registered business name).
          </p>
        </div>

        <div className="prose prose-invert prose-slate max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold text-primary mb-3">1. Acceptance of Terms</h2>
            <p className="text-foreground leading-relaxed">
              By accessing or using Al Wakeelo ("the Service"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, you may not access or use the Service. These Terms constitute a legally binding agreement between you and Al Wakeelo.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">2. Description of Service</h2>
            <p className="text-foreground leading-relaxed">
              Al Wakeelo is an AI-powered legal assistant platform designed for Pakistani legal professionals. The Service provides AI legal consultation, judgment and statute search, legal document drafting, contract generation, document analysis, audio transcription, and a knowledge vault of Pakistani legal texts. The Service utilizes advanced artificial intelligence to generate responses and analysis.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">3. Important Legal Disclaimer</h2>
            <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-foreground leading-relaxed font-semibold">
                Al Wakeelo is an AI-powered tool and does NOT constitute legal advice. The information and analysis provided by the Service should not be relied upon as a substitute for professional legal advice from a qualified, licensed Pakistani lawyer or advocate. AI-generated content may contain errors, inaccuracies, or outdated information. Users are solely responsible for verifying all legal information, citations, and advice independently before relying upon it in any legal matter. Al Wakeelo shall not be held liable for any decisions made based on the Service's output.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">4. User Accounts</h2>
            <p className="text-foreground leading-relaxed mb-3">To use the Service, you must:</p>
            <ul className="list-disc list-inside text-foreground space-y-1 ml-4">
              <li>Create an account using a valid email address or Google OAuth sign-in</li>
              <li>Be at least 18 years of age</li>
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Immediately notify us of any unauthorized use of your account</li>
            </ul>
            <p className="text-foreground leading-relaxed mt-3">
              You are responsible for all activities that occur under your account. We reserve the right to suspend or terminate accounts that violate these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">5. Subscription Plans and Usage Limits</h2>
            <p className="text-foreground leading-relaxed mb-3">The Service offers multiple subscription tiers:</p>
            <ul className="list-disc list-inside text-foreground space-y-1 ml-4">
              <li><strong className="text-foreground">Standard:</strong> 120 AI actions/month with Standard mode</li>
              <li><strong className="text-foreground">Pro:</strong> 350 AI actions/month with Standard + Turbo mode</li>
              <li><strong className="text-foreground">Chamber:</strong> 1,200 pooled AI actions/month for up to 3 users with Standard + Turbo + Apex mode</li>
              <li><strong className="text-foreground">Enterprise:</strong> Custom fair-use limits with priority routing and custom seats</li>
            </ul>
            <p className="text-foreground leading-relaxed mt-3">
              Usage limits reset monthly. Exceeding your plan's limits will restrict access to AI features until the next billing cycle or until you upgrade your plan. We reserve the right to modify plan features and pricing with reasonable notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">6. Acceptable Use</h2>
            <p className="text-foreground leading-relaxed mb-3">You agree NOT to use the Service to:</p>
            <ul className="list-disc list-inside text-foreground space-y-1 ml-4">
              <li>Violate any applicable Pakistani law or regulation</li>
              <li>Submit false, misleading, or fraudulent information</li>
              <li>Attempt to gain unauthorized access to other users' accounts or data</li>
              <li>Use automated scripts, bots, or tools to access the Service excessively</li>
              <li>Reverse-engineer, decompile, or disassemble any part of the Service</li>
              <li>Share, resell, or redistribute AI-generated content as professional legal advice without proper verification</li>
              <li>Upload malicious files, viruses, or harmful content</li>
              <li>Use the Service for any purpose that is illegal, harmful, or unethical</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">7. Intellectual Property</h2>
            <p className="text-foreground leading-relaxed">
              The Service, including its design, logos, code, and AI models, is the intellectual property of Al Wakeelo and is protected by applicable intellectual property laws. You retain ownership of the content you upload to the Service (documents, files). AI-generated responses are provided for your use but may not be claimed as original legal opinions. The Pakistani legal texts, statutes, and judgments referenced by the Service are public domain materials.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">8. Uploaded Content and Documents</h2>
            <p className="text-foreground leading-relaxed">
              When you upload documents (PDF, TXT, DOCX) or audio files, you grant Al Wakeelo a limited, non-exclusive license to process these files solely for the purpose of providing AI analysis and transcription services. Uploaded files are processed temporarily and are not permanently stored on our servers after the analysis is complete. You are responsible for ensuring you have the right to upload and share any documents you submit.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">9. Conversation Sharing</h2>
            <p className="text-foreground leading-relaxed">
              The Service allows you to share conversations via unique links. When you share a conversation, it becomes accessible to anyone with the link without requiring authentication. You are responsible for the content shared and should not share conversations containing sensitive, confidential, or privileged legal information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">10. Limitation of Liability</h2>
            <p className="text-foreground leading-relaxed">
              To the maximum extent permitted by Pakistani law, Al Wakeelo shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or business opportunities, arising from your use of the Service. The Service is provided on an "as is" and "as available" basis without warranties of any kind, either express or implied. Our total liability to you for any claims arising from the use of the Service shall not exceed the amount you have paid for the Service in the preceding twelve (12) months.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">11. Indemnification</h2>
            <p className="text-foreground leading-relaxed">
              You agree to indemnify and hold harmless Al Wakeelo, its owners, operators, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or in any way connected with your use of the Service, your violation of these Terms, or your violation of any third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">12. Governing Law</h2>
            <p className="text-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the Islamic Republic of Pakistan. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts located in Pakistan. Any reference to statutes, judgments, or legal principles within the Service is based on Pakistani law unless otherwise specified.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">13. Termination</h2>
            <p className="text-foreground leading-relaxed">
              We reserve the right to suspend or terminate your account at any time for violation of these Terms, without prior notice. Upon termination, your right to use the Service will immediately cease. You may also close your account at any time. Termination does not relieve you of any obligations incurred prior to termination.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">14. Modifications to Terms</h2>
            <p className="text-foreground leading-relaxed">
              We reserve the right to modify these Terms at any time. Changes will be posted on this page with an updated "Last updated" date. Continued use of the Service after any modifications constitutes acceptance of the revised Terms. We encourage you to review these Terms periodically.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">15. Contact Information</h2>
            <p className="text-foreground leading-relaxed">
              For questions or concerns regarding these Terms and Conditions, please contact us at:
            </p>
            <p className="text-primary font-semibold mt-2">support@alwakeelo.com</p>
          </section>
        </div>
      </div>

      <footer className="py-8 px-3 sm:px-6 border-t border-border/50">
        <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} Al Wakeelo. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="/privacy" onClick={(e) => { e.preventDefault(); navigate("/privacy"); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
