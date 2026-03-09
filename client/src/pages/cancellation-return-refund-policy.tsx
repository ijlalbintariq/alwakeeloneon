import { Scale, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function CancellationReturnRefundPolicyPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <nav className="sticky top-0 z-50 bg-[#0f172a]/90 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={18} />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
                <Scale size={14} className="text-slate-900" />
              </div>
              <span className="text-sm font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>Al Wakeelo</span>
            </div>
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-10 md:py-16">
        <h1 className="text-4xl font-bold italic mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Cancellation/Return/Refund Policy</h1>
        <p className="text-sm text-slate-500 mb-12">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="prose prose-invert prose-slate max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold text-amber-500 mb-3">1. Scope</h2>
            <p className="text-slate-300 leading-relaxed">
              This policy applies to Al Wakeelo subscription plans and paid services. Please read it carefully before completing a purchase.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-amber-500 mb-3">2. Subscription Cancellation</h2>
            <p className="text-slate-300 leading-relaxed">
              You may request cancellation of your subscription at any time. Cancellation stops future renewals and access adjustments take effect at the end of the active billing period unless otherwise agreed in writing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-amber-500 mb-3">3. Returns</h2>
            <p className="text-slate-300 leading-relaxed">
              Since Al Wakeelo provides digital services, document processing, and AI responses, physical returns do not apply.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-amber-500 mb-3">4. Refund Eligibility</h2>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-4">
              <li>Duplicate or accidental charge confirmed by billing records.</li>
              <li>Technical failure from our side resulting in complete non-delivery of subscribed service.</li>
              <li>Any other case approved by Al Wakeelo billing team in writing.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-amber-500 mb-3">5. Non-Refundable Cases</h2>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-4">
              <li>Used billing cycles where platform features were available and consumed.</li>
              <li>Change of mind after service usage.</li>
              <li>Misunderstanding of legal outcomes or AI-generated content quality expectations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-amber-500 mb-3">6. Refund Request Window</h2>
            <p className="text-slate-300 leading-relaxed">
              Submit refund requests within 7 calendar days of the charge date by emailing support with your account email, payment reference, and reason for the request.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-amber-500 mb-3">7. Processing Timeline</h2>
            <p className="text-slate-300 leading-relaxed">
              Approved refunds are initiated within 7 to 14 business days. Final settlement time depends on your payment provider or bank.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-amber-500 mb-3">8. Contact for Billing Requests</h2>
            <p className="text-slate-300 leading-relaxed">
              For cancellation or refund support, contact:
            </p>
            <p className="text-amber-400 font-semibold mt-2">support@alwakeelo.com</p>
          </section>
        </div>
      </div>
    </div>
  );
}

