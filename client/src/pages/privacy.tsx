import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function PrivacyPolicyPage() {
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
        <h1 className="text-4xl font-bold italic mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-6">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
        <div className="mb-10 rounded-xl border border-primary/35 bg-primary/10 px-4 py-3">
          <p className="text-sm text-foreground leading-relaxed">
            <span className="font-semibold">Business Ownership Notice:</span> Al Wakeelo is owned and operated by{" "}
            <span className="font-semibold text-foreground">Majnoon Studio</span> (registered business name).
          </p>
        </div>

        <div className="prose prose-invert prose-slate max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold text-primary mb-3">1. Introduction</h2>
            <p className="text-foreground leading-relaxed">
              Al Wakeelo ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered legal assistant platform ("Service"). By using the Service, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">2. Information We Collect</h2>
            <h3 className="text-lg font-semibold text-foreground mb-2">2.1 Personal Information</h3>
            <p className="text-foreground leading-relaxed mb-3">When you create an account, we may collect:</p>
            <ul className="list-disc list-inside text-foreground space-y-1 ml-4">
              <li>Full name and email address</li>
              <li>Password (stored in encrypted/hashed form)</li>
              <li>Profile information provided through Google OAuth sign-in</li>
              <li>Subscription tier and billing information</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground mb-2 mt-4">2.2 Usage Data</h3>
            <p className="text-foreground leading-relaxed mb-3">We automatically collect certain information when you use the Service:</p>
            <ul className="list-disc list-inside text-foreground space-y-1 ml-4">
              <li>Chat conversations and AI query history</li>
              <li>Search queries (judgment and statute searches)</li>
              <li>Uploaded documents and files (for AI analysis purposes)</li>
              <li>Bookmarks and saved items</li>
              <li>API usage statistics and token consumption</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground mb-2 mt-4">2.3 Technical Data</h3>
            <ul className="list-disc list-inside text-foreground space-y-1 ml-4">
              <li>Browser type and version</li>
              <li>Device information</li>
              <li>IP address and approximate location</li>
              <li>Session data and cookies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">3. How We Use Your Information</h2>
            <p className="text-foreground leading-relaxed mb-3">We use the collected information for:</p>
            <ul className="list-disc list-inside text-foreground space-y-1 ml-4">
              <li>Providing and maintaining the AI legal assistant Service</li>
              <li>Processing your queries through our AI engine</li>
              <li>Personalizing your experience and improving our Service</li>
              <li>Managing your account and subscription</li>
              <li>Sending important service notifications</li>
              <li>Enforcing usage limits based on your subscription tier</li>
              <li>Analyzing usage patterns to improve our AI models and responses</li>
              <li>Complying with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">4. Data Sharing and Disclosure</h2>
            <p className="text-foreground leading-relaxed mb-3">We may share your information with:</p>
            <ul className="list-disc list-inside text-foreground space-y-1 ml-4">
              <li><strong className="text-foreground">AI Service Providers:</strong> Your queries and uploaded documents are processed through third-party AI services. Please review their respective privacy policies for details on data handling.</li>
              <li><strong className="text-foreground">Authentication Providers:</strong> If you use Google OAuth, certain profile information is exchanged with Google.</li>
              <li><strong className="text-foreground">Legal Requirements:</strong> We may disclose information if required by Pakistani law, court order, or government request.</li>
            </ul>
            <p className="text-foreground leading-relaxed mt-3">
              We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">5. Data Security</h2>
            <p className="text-foreground leading-relaxed">
              We implement industry-standard security measures to protect your data, including encrypted password storage (bcrypt hashing), secure session management with PostgreSQL-backed sessions, HTTPS encryption for all data in transit, and secure API key management. However, no method of electronic transmission or storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">6. Data Retention</h2>
            <p className="text-foreground leading-relaxed">
              We retain your personal data for as long as your account is active or as needed to provide the Service. Chat history, bookmarks, and search history are retained until you delete them or close your account. Uploaded documents are processed temporarily for AI analysis and are not permanently stored on our servers after processing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">7. Your Rights</h2>
            <p className="text-foreground leading-relaxed mb-3">You have the right to:</p>
            <ul className="list-disc list-inside text-foreground space-y-1 ml-4">
              <li>Access, update, or delete your personal information</li>
              <li>Request a copy of the data we hold about you</li>
              <li>Close your account at any time</li>
              <li>Object to certain types of data processing</li>
              <li>Clear your chat history, search history, and bookmarks</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">8. Cookies and Session Data</h2>
            <p className="text-foreground leading-relaxed">
              We use session cookies to maintain your authenticated state and ensure secure access to the Service. These cookies are essential for the operation of the platform and cannot be disabled while using the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">9. Third-Party Services</h2>
            <p className="text-foreground leading-relaxed">
              Our Service integrates with third-party services for processing legal queries, authentication, and sourcing legal knowledge documents. Each of these services has its own privacy policy governing data use.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">10. Children's Privacy</h2>
            <p className="text-foreground leading-relaxed">
              Our Service is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">11. Changes to This Policy</h2>
            <p className="text-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">12. Contact Us</h2>
            <p className="text-foreground leading-relaxed">
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="text-primary font-semibold mt-2">support@alwakeelo.com</p>
          </section>
        </div>
      </div>

      <footer className="py-8 px-3 sm:px-6 border-t border-border/50">
        <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-slate-600">&copy; {new Date().getFullYear()} Al Wakeelo. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="/terms" onClick={(e) => { e.preventDefault(); navigate("/terms"); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
