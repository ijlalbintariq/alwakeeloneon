import React, { useState } from "react";
import { Link } from "wouter";
import {
  Scale,
  ShieldAlert,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Lock,
  Gavel,
  HelpCircle,
  Mail,
  Zap
} from "lucide-react";
import { PublicPreviewShell } from "@/experimental/components/public/PublicPreviewShell";

export default function PreviewTerms() {
  const [activeSection, setActiveSection] = useState<string>("sec-1");

  const sections = [
    { id: "sec-1", title: "1. Acceptance of Terms" },
    { id: "sec-2", title: "2. Description of Legal AI Workstation" },
    { id: "sec-3", title: "3. Mandatory Legal Disclaimer & Advocate Duty" },
    { id: "sec-4", title: "4. User Accounts & Bar Enrollment" },
    { id: "sec-5", title: "5. Subscription Plans & Monthly Token Quotas" },
    { id: "sec-6", title: "6. Acceptable Use & Prohibited Conduct" },
    { id: "sec-7", title: "7. Intellectual Property & Public Domain Law" },
    { id: "sec-8", title: "8. User Uploaded Briefs & License Grant" },
    { id: "sec-9", title: "9. SLA Commitments & Platform Availability" },
    { id: "sec-10", title: "10. Limitation of Liability & Caps" },
    { id: "sec-11", title: "11. Indemnification Obligations" },
    { id: "sec-12", title: "12. Governing Law & Pakistani Jurisdiction" },
    { id: "sec-13", title: "13. Suspension & Termination of Accounts" },
    { id: "sec-14", title: "14. Severability & Non-Waiver" },
    { id: "sec-15", title: "15. Amendments & Contact Information" },
  ];

  const scrollTo = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <PublicPreviewShell>
      <div className="space-y-10 md:space-y-12">
        {/* ── HEADER ── */}
        <section className="space-y-4 max-w-4xl mx-auto text-center pt-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#EBF5F0] border border-[#A3D4BC] rounded-full text-xs text-[#105B38] font-bold uppercase tracking-wider">
            <Scale className="w-3.5 h-3.5 text-[#105B38]" />
            Terms of Service & Service Level Agreement
          </div>
          <h1
            className="text-4xl sm:text-5xl font-extrabold text-[#0F172A] tracking-tight leading-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Terms and Conditions of Use
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] max-w-2xl mx-auto">
            Last Updated: August 2026 · Official Legal Terms of Majnoon Studio (Pvt.) Ltd.
          </p>

          {/* Critical Disclaimer Card */}
          <div className="mt-6 p-4 sm:p-5 bg-[#FEF2F2] border border-[#FECACA] rounded-2xl text-left shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#FEE2E2] flex items-center justify-center text-[#DC2626] shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs sm:text-sm font-bold text-[#991B1B]">
                  Mandatory Legal Notice for Advocates &amp; Litigants
                </h3>
                <p className="text-xs text-[#7F1D1D] leading-relaxed">
                  Alwakeelo is an intelligent research &amp; drafting assistant, NOT a substitute for licensed legal representation. All citations and pleadings must be verified before court submission.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-white text-[#991B1B] text-[11px] font-bold rounded-full border border-[#FECACA] whitespace-nowrap">
              Advocate Verification Required
            </span>
          </div>
        </section>

        {/* ── TWO-COLUMN LAYOUT ── */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Sticky Table of Contents */}
          <div className="lg:col-span-4 sticky top-24 hidden lg:block">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 space-y-3 shadow-sm max-h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] border-b border-[#F1F5F9] pb-2">
                Sections Index
              </h4>
              <nav className="space-y-1">
                {sections.map((sec) => (
                  <button
                    key={sec.id}
                    onClick={() => scrollTo(sec.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors block truncate ${
                      activeSection === sec.id
                        ? "bg-[#EBF5F0] text-[#105B38] font-bold"
                        : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                    }`}
                  >
                    {sec.title}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Right Main Legal Prose */}
          <div className="lg:col-span-8 bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-10 space-y-10 shadow-sm leading-relaxed text-xs sm:text-sm text-[#334155]">
            {/* Section 1 */}
            <section id="sec-1" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                1. Acceptance of Terms
              </h2>
              <p>
                These Terms and Conditions ("Terms") constitute a legally binding agreement between you ("User", "Advocate", "Chamber", or "Organization") and <strong className="text-[#0F172A]">Majnoon Studio (Pvt.) Ltd.</strong> ("Company", "we", "us", or "our"), governing your access to and use of the <strong className="text-[#0F172A]">Alwakeelo</strong> AI legal intelligence platform, website, mobile progressive web application, Microsoft 365 Word Add-in, and associated API services (collectively, the "Service").
              </p>
              <p>
                By creating an account, logging in, or utilizing any feature of Alwakeelo, you unequivocally agree to be bound by these Terms. If you do not agree with any provision herein, you must immediately discontinue use of the Service.
              </p>
            </section>

            {/* Section 2 */}
            <section id="sec-2" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                2. Description of Legal AI Workstation
              </h2>
              <p>
                Alwakeelo provides a suite of specialized legal technology tools tailored to Pakistani practice, including:
              </p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-[#334155]">
                <li>600,000+ indexed Supreme Court and High Court judgments with precedent citation network graphs.</li>
                <li>83,117 statutory sections directory across 5,887 Federal and Provincial Acts with Limitation Act and Court Fee calculators.</li>
                <li>High Court and District Court petition and pleading drafting tools.</li>
                <li>Commercial contract generation, clause libraries, and risk redline audit engines.</li>
                <li>Pleading compliance audit scanners (Order VII Rule 11 CPC, S.24(c) Specific Relief Act).</li>
                <li>Microsoft 365 Word Add-in integration and mobile PWA applications.</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section id="sec-3" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                3. Mandatory Legal Disclaimer &amp; Advocate Verification Duty
              </h2>
              <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-2xl space-y-2 text-[#991B1B]">
                <p className="font-bold text-xs uppercase tracking-wider">
                  Professional Practice Notice
                </p>
                <p className="leading-relaxed text-xs sm:text-sm">
                  Alwakeelo is an artificial intelligence research and drafting accelerator. It DOES NOT render binding legal opinions, establish an attorney-client relationship, or guarantee specific judicial outcomes in any Pakistani court of law.
                </p>
                <p className="leading-relaxed text-xs">
                  The enrolled advocate or user retains sole, non-delegable professional responsibility for independently verifying all statutory sections, case law citations, limitation windows, and pleading averments prior to signing, commissioning, or filing any document before any court, tribunal, or authority.
                </p>
              </div>
            </section>

            {/* Section 4 */}
            <section id="sec-4" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                4. User Accounts &amp; Bar Enrollment
              </h2>
              <p>
                To access advanced workstation features, you must register an account. You agree to provide accurate, current, and complete registration information (including Bar Council enrollment credentials where applicable). You are solely responsible for maintaining the confidentiality of your account credentials and for all activities occurring under your authenticated session.
              </p>
            </section>

            {/* Section 5 */}
            <section id="sec-5" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                5. Subscription Plans &amp; Monthly Token Quotas
              </h2>
              <p>
                The Service offers tiered subscription plans (Free Starter, Senior Counsel Pro, Chamber Enterprise) with specified monthly AI action quotas. Quotas reset automatically at the beginning of each billing cycle. Unused monthly action quotas do not roll over to subsequent months unless explicitly provided in an Enterprise SLA agreement.
              </p>
              <p>
                All subscription fees are denominated in Pakistani Rupees (PKR) and are subject to applicable provincial sales taxes on services (PRA 16%, SRB 13%, KPRA 15%, BRA 15%, ICT 15%).
              </p>
            </section>

            {/* Section 6 */}
            <section id="sec-6" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                6. Acceptable Use &amp; Prohibited Conduct
              </h2>
              <p>You agree NOT to use the Service to:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-[#334155]">
                <li>Violate any provision of the Constitution or laws of the Islamic Republic of Pakistan.</li>
                <li>Conduct automated scraping, bulk data extraction, or denial-of-service attacks against our databases.</li>
                <li>Attempt to reverse-engineer, decompile, or extract the underlying model weights and algorithms.</li>
                <li>Impersonate a licensed Advocate Supreme Court or High Court advocate when unauthorized.</li>
                <li>Circumvent or tamper with subscription token quotas or licensing authentication tokens.</li>
              </ul>
            </section>

            {/* Section 7 */}
            <section id="sec-7" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                7. Intellectual Property &amp; Public Domain Law
              </h2>
              <p>
                All software code, user interface designs, neural RAG indexing algorithms, logos, and proprietary templates are the exclusive intellectual property of Majnoon Studio (Pvt.) Ltd.
              </p>
              <p>
                Official Pakistani statutory enactments, gazette notifications, and published judicial judgments referenced in the database are public domain materials under Pakistani copyright laws.
              </p>
            </section>

            {/* Section 8 */}
            <section id="sec-8" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                8. User Uploaded Briefs &amp; License Grant
              </h2>
              <p>
                You retain complete, unencumbered ownership of all case briefs, contracts, and documents uploaded to your chamber workspace. You grant Alwakeelo a limited, revocable, non-exclusive license solely to process and analyze such files in temporary volatile memory for the express purpose of providing the requested AI research and drafting services to you.
              </p>
            </section>

            {/* Section 9 */}
            <section id="sec-9" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                9. SLA Commitments &amp; Platform Availability
              </h2>
              <p>
                We target a <strong className="text-[#0F172A]">99.5% Service Uptime</strong> for active paid subscription tiers. Scheduled maintenance windows during off-peak court hours (11:00 PM – 4:00 AM PKT) will be announced in advance via dashboard notifications. We maintain automated multi-region PostgreSQL failovers to ensure zero data loss.
              </p>
            </section>

            {/* Section 10 */}
            <section id="sec-10" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                10. Limitation of Liability &amp; Caps
              </h2>
              <p>
                To the maximum extent permitted under Pakistani law, neither Majnoon Studio (Pvt.) Ltd. nor its directors, officers, or engineering partners shall be liable for any indirect, incidental, special, or consequential damages, including loss of case, missed limitation deadlines, or legal costs arising out of the use or inability to use the Service.
              </p>
              <p>
                Our aggregate liability for any and all claims under these Terms shall be strictly capped at the total subscription fees actually paid by you to Alwakeelo in the twelve (12) months preceding the event giving rise to liability.
              </p>
            </section>

            {/* Section 11 */}
            <section id="sec-11" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                11. Indemnification Obligations
              </h2>
              <p>
                You agree to indemnify, defend, and hold harmless Majnoon Studio (Pvt.) Ltd. and its team from any third-party claims, liabilities, damages, and legal costs arising from: (a) your violation of these Terms; (b) any pleading or contract filed by you in court without independent verification; or (c) your infringement of third-party intellectual property or privacy rights.
              </p>
            </section>

            {/* Section 12 */}
            <section id="sec-12" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                12. Governing Law &amp; Pakistani Jurisdiction
              </h2>
              <p>
                These Terms shall be governed by, construed, and enforced in accordance with the laws of the <strong className="text-[#0F172A]">Islamic Republic of Pakistan</strong>. Any legal dispute, controversy, or claim arising out of or relating to these Terms shall be subject to the exclusive jurisdiction of the competent courts situated in <strong className="text-[#0F172A]">Islamabad Capital Territory</strong> or <strong className="text-[#0F172A]">Lahore, Pakistan</strong>.
              </p>
            </section>

            {/* Section 13 */}
            <section id="sec-13" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                13. Suspension &amp; Termination of Accounts
              </h2>
              <p>
                We reserve the right to suspend or terminate accounts that breach these Terms, engage in unauthorized reverse engineering, or attempt fraudulent payment transactions. Users may cancel their subscription at any time through the Billing panel.
              </p>
            </section>

            {/* Section 14 */}
            <section id="sec-14" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                14. Severability &amp; Non-Waiver
              </h2>
              <p>
                If any provision of these Terms is deemed unlawful, void, or unenforceable by a Pakistani court of competent jurisdiction, that provision shall be severed without affecting the validity and enforceability of the remaining provisions.
              </p>
            </section>

            {/* Section 15 */}
            <section id="sec-15" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                15. Amendments &amp; Contact Information
              </h2>
              <p>
                We may revise these Terms from time to time. Continued use of the platform following the effective date of updated Terms constitutes your binding acceptance. For legal inquiries regarding these Terms:
              </p>
              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl text-xs space-y-1.5">
                <p><strong className="text-[#0F172A]">Entity:</strong> Majnoon Studio (Pvt.) Ltd.</p>
                <p><strong className="text-[#0F172A]">Legal Compliance Counsel:</strong> <a href="mailto:support@alwakeelo.com" className="text-[#105B38] font-mono underline">support@alwakeelo.com</a></p>
                <p><strong className="text-[#0F172A]">Chambers Helpline:</strong> <a href="tel:00923358341897" className="text-[#105B38] font-mono">+92 335 834 1897</a></p>
              </div>
            </section>
          </div>
        </section>
      </div>
    </PublicPreviewShell>
  );
}
