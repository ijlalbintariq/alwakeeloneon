import React, { useState } from "react";
import { Link } from "wouter";
import {
  Shield,
  Lock,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Mail,
  Scale,
  Database,
  Layers,
  ArrowRight,
  EyeOff
} from "lucide-react";
import { PublicPreviewShell } from "@/experimental/components/public/PublicPreviewShell";

export default function PreviewPrivacy() {
  const [activeSection, setActiveSection] = useState<string>("sec-1");

  const sections = [
    { id: "sec-1", title: "1. Introduction & Ownership" },
    { id: "sec-2", title: "2. Pakistani Legal Context & Privilege" },
    { id: "sec-3", title: "3. Categories of Information Collected" },
    { id: "sec-4", title: "4. Zero-Training Guarantee on Legal Briefs" },
    { id: "sec-5", title: "5. Ephemeral In-Memory Document Parsing" },
    { id: "sec-6", title: "6. Encryption & Data Security Standards" },
    { id: "sec-7", title: "7. Chamber Workspace Isolation" },
    { id: "sec-8", title: "8. Third-Party Processors & Disclosures" },
    { id: "sec-9", title: "9. Data Retention & Permanent Deletion" },
    { id: "sec-10", title: "10. Advocate Rights & Data Portability" },
    { id: "sec-11", title: "11. Cookies & Authentication Sessions" },
    { id: "sec-12", title: "12. PECA 2016 & International Alignment" },
    { id: "sec-13", title: "13. Policy Updates & Modifications" },
    { id: "sec-14", title: "14. Data Protection Officer Contact" },
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
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#EBF5F0] dark:bg-[#105B38]/20 border border-[#A3D4BC] dark:border-[#10B981]/30 rounded-full text-xs text-[#105B38] font-bold uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5 text-[#105B38]" />
            Chamber Data Protection & Confidentiality
          </div>
          <h1
            className="text-4xl sm:text-5xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight leading-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Privacy Policy & Data Security
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] max-w-2xl mx-auto">
            Last Updated: August 2026 · Official Legal Document of Majnoon Studio (Pvt.) Ltd.
          </p>

          {/* Key Guarantee Banner */}
          <div className="mt-6 p-4 sm:p-5 bg-white dark:bg-[#131E2E] border border-[#A3D4BC] dark:border-[#10B981]/30 rounded-2xl text-left shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#EBF5F0] dark:bg-[#105B38]/20 flex items-center justify-center text-[#105B38] shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Zero-Training Guarantee on Confidential Chamber Briefs
                </h3>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                  Your case files, drafts, and client records are NEVER used to train foundational AI models.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-[#EBF5F0] dark:bg-[#105B38]/20 text-[#105B38] text-[11px] font-bold rounded-full border border-[#A3D4BC] dark:border-[#10B981]/30 whitespace-nowrap">
              Protected by PECA 2016
            </span>
          </div>
        </section>

        {/* ── TWO-COLUMN CONTENT & NAVIGATION ── */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Table of Contents (Sticky on Desktop) */}
          <div className="lg:col-span-4 sticky top-24 hidden lg:block">
            <div className="bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-2xl p-5 space-y-3 shadow-sm max-h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC] border-b border-[#F1F5F9] pb-2">
                Table of Contents
              </h4>
              <nav className="space-y-1">
                {sections.map((sec) => (
                  <button
                    key={sec.id}
                    onClick={() => scrollTo(sec.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors block truncate ${
                      activeSection === sec.id
                        ? "bg-[#EBF5F0] dark:bg-[#105B38]/20 text-[#105B38] font-bold"
                        : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E]"
                    }`}
                  >
                    {sec.title}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Right Main Legal Prose (8 cols) */}
          <div className="lg:col-span-8 bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-3xl p-6 sm:p-10 space-y-10 shadow-sm leading-relaxed text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1]">
            {/* Section 1 */}
            <section id="sec-1" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                1. Introduction &amp; Ownership Notice
              </h2>
              <p>
                This Privacy Policy explains how <strong className="text-[#0F172A] dark:text-[#F8FAFC]">Alwakeelo</strong> ("Platform", "Service", "we", "us", or "our"), operated by <strong className="text-[#0F172A] dark:text-[#F8FAFC]">Majnoon Studio (Pvt.) Ltd.</strong> (registered business name in Pakistan), collects, processes, secures, and protects information when advocates, legal chambers, organizations, and individuals utilize our legal technology workstation and associated services.
              </p>
              <p>
                By accessing or using Alwakeelo, you acknowledge that you have read, understood, and agreed to the data practices described in this Privacy Policy.
              </p>
            </section>

            {/* Section 2 */}
            <section id="sec-2" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                2. Pakistani Legal Context &amp; Attorney-Client Privilege
              </h2>
              <p>
                We recognize that legal research and case drafting in Pakistan involve sensitive, constitutionally protected legal communications. Our systems and procedures are specifically architected to respect:
              </p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-[#334155] dark:text-[#CBD5E1]">
                <li>
                  <strong className="text-[#0F172A] dark:text-[#F8FAFC]">Article 9 of the Qanun-e-Shahadat Order, 1984:</strong> Legal professional communications and attorney-client confidentiality protections.
                </li>
                <li>
                  <strong className="text-[#0F172A] dark:text-[#F8FAFC]">Pakistan Legal Practitioners and Bar Councils Rules:</strong> Ethical standards mandating advocate vigilance over client confidences.
                </li>
                <li>
                  <strong className="text-[#0F172A] dark:text-[#F8FAFC]">Prevention of Electronic Crimes Act (PECA 2016):</strong> Statutory protections safeguarding unauthorized access to electronic data.
                </li>
              </ul>
            </section>

            {/* Section 3 */}
            <section id="sec-3" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                3. Categories of Information Collected
              </h2>
              <p>We collect information only to the extent necessary to deliver high-performance legal AI services:</p>
              <div className="space-y-2.5 pt-1">
                <div className="p-3 bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-xl space-y-1">
                  <p className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">A. Account &amp; Bar Profile Data</p>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                    Full name, official email address, phone/WhatsApp number, Bar Council enrollment registration number, advocate standing (ASC / AHC), and chamber firm name.
                  </p>
                </div>
                <div className="p-3 bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-xl space-y-1">
                  <p className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">B. Research Queries &amp; Pleading Content</p>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                    Legal search terms, statutory section queries, draft court petitions, plaints, and active conversation threads used during drafting sessions.
                  </p>
                </div>
                <div className="p-3 bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-xl space-y-1">
                  <p className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">C. Billing &amp; Provincial Tax Details</p>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                    Subscription plan tier, billing cycle, provincial tax deduction records (PRA / SRB / KPRA / BRA / ICT), and encrypted transaction tokens. No raw credit card CVVs are stored on our servers.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section id="sec-4" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                4. Strict Zero-Training Guarantee on Legal Briefs
              </h2>
              <div className="p-4 bg-[#EBF5F0] dark:bg-[#105B38]/20 border border-[#A3D4BC] dark:border-[#10B981]/30 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#105B38]">
                  <EyeOff className="w-4 h-4" /> Ironclad Policy
                </div>
                <p className="text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC] font-semibold leading-relaxed">
                  Alwakeelo explicitly covenants that user-submitted case files, litigation strategy notes, client identities, and private chamber uploads are NEVER used to train, retrain, or fine-tune public foundation AI models (such as Claude, OpenAI, or Gemini).
                </p>
                <p className="text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                  Your inputs are processed strictly through isolated, zero-retention enterprise API endpoints governed by strict non-disclosure covenants.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section id="sec-5" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                5. Ephemeral In-Memory Document Parsing
              </h2>
              <p>
                When you attach a PDF, Word document (.docx), or scanned exhibit inside the AI Chat or Document Analyzer for instant analysis:
              </p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-[#334155] dark:text-[#CBD5E1]">
                <li>The document is parsed in volatile, encrypted server memory (RAM).</li>
                <li>Chunks and vector embeddings are generated dynamically for the duration of the active consultation session.</li>
                <li>Upon session termination or document detachment, the in-memory chunks are permanently disposed of.</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section id="sec-6" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                6. Encryption &amp; Data Security Standards
              </h2>
              <p>We deploy bank-grade security protocols across all infrastructure layers:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-[#334155] dark:text-[#CBD5E1]">
                <li><strong className="text-[#0F172A] dark:text-[#F8FAFC]">Data in Transit:</strong> 256-bit TLS 1.3 encryption across all web, mobile, and Word Add-in API traffic.</li>
                <li><strong className="text-[#0F172A] dark:text-[#F8FAFC]">Data at Rest:</strong> AES-256 encryption on all persistent database storage partitions.</li>
                <li><strong className="text-[#0F172A] dark:text-[#F8FAFC]">Password Security:</strong> One-way cryptographic hashing using salted bcrypt algorithms.</li>
                <li><strong className="text-[#0F172A] dark:text-[#F8FAFC]">Access Control:</strong> Strict role-based access control (RBAC) preventing unauthorized cross-chamber data access.</li>
              </ul>
            </section>

            {/* Section 7 */}
            <section id="sec-7" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                7. Chamber Workspace Isolation
              </h2>
              <p>
                For multi-lawyer chamber accounts and enterprise law firms, data is logically isolated per chamber tenant. Only authorized advocates, partners, and associates within your designated chamber roster can view shared matter files, cause lists, and drafted pleadings.
              </p>
            </section>

            {/* Section 8 */}
            <section id="sec-8" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                8. Third-Party Processors &amp; Disclosures
              </h2>
              <p>
                We do NOT sell, rent, or monetize your personal or chamber data. We disclose information only to vetted sub-processors essential to operating the platform:
              </p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-[#334155] dark:text-[#CBD5E1]">
                <li><strong className="text-[#0F172A] dark:text-[#F8FAFC]">Secure Cloud Infrastructure:</strong> High-availability serverless PostgreSQL database providers.</li>
                <li><strong className="text-[#0F172A] dark:text-[#F8FAFC]">Payment Gateways:</strong> Safepay, Kuickpay, and 1Bill for automated invoice and subscription settlement.</li>
                <li><strong className="text-[#0F172A] dark:text-[#F8FAFC]">Legal Compulsion:</strong> Only when strictly required by a competent court of record in Pakistan under lawful process.</li>
              </ul>
            </section>

            {/* Section 9 */}
            <section id="sec-9" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                9. Data Retention &amp; Permanent Deletion
              </h2>
              <p>
                We retain your account data for as long as your subscription remains active. You may at any time request permanent deletion of your profile, case files, bookmarks, and search logs via the Chamber Settings panel or by emailing <a href="mailto:support@alwakeelo.com" className="text-[#105B38] underline font-semibold">support@alwakeelo.com</a>. Upon request, all data is expunged within 14 business days.
              </p>
            </section>

            {/* Section 10 */}
            <section id="sec-10" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                10. Advocate Rights &amp; Data Portability
              </h2>
              <p>As an enrolled advocate or chamber user, you have the right to:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-[#334155] dark:text-[#CBD5E1]">
                <li>Export all drafted petitions and contracts in DOCX, PDF, and Markdown format at 100% fidelity.</li>
                <li>Export your research query logs and curated precedent bookmarks.</li>
                <li>Rectify inaccurate Bar Council profile information.</li>
                <li>Revoke shared link permissions to past dialogues.</li>
              </ul>
            </section>

            {/* Section 11 */}
            <section id="sec-11" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                11. Cookies &amp; Authentication Sessions
              </h2>
              <p>
                We utilize strict, encrypted HTTP-only session cookies and local storage tokens solely for user authentication, CSRF mitigation, and chamber theme preferences. We do NOT use invasive third-party cross-site advertising trackers.
              </p>
            </section>

            {/* Section 12 */}
            <section id="sec-12" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                12. PECA 2016 &amp; International Alignment
              </h2>
              <p>
                Our data processing operations are governed by the laws of the Islamic Republic of Pakistan, in particular the Prevention of Electronic Crimes Act (PECA 2016). For overseas Pakistani advocates and international law firms, our data principles align with international best practices (including GDPR principles of data minimization and purpose limitation).
              </p>
            </section>

            {/* Section 13 */}
            <section id="sec-13" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                13. Policy Updates &amp; Notifications
              </h2>
              <p>
                We may periodically update this Privacy Policy to reflect legislative amendments or technological enhancements. Material updates will be communicated through your registered chamber email and platform dashboard banner at least 7 days prior to implementation.
              </p>
            </section>

            {/* Section 14 */}
            <section id="sec-14" className="space-y-3 scroll-mt-28">
              <h2
                className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 border-b border-[#F1F5F9] pb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                14. Data Protection Officer &amp; Contact
              </h2>
              <p>
                For privacy inquiries, data deletion requests, or compliance audits, please contact our Data Protection Officer:
              </p>
              <div className="p-4 bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-2xl text-xs space-y-1.5">
                <p><strong className="text-[#0F172A] dark:text-[#F8FAFC]">Data Protection Officer:</strong> Legal Compliance Cell</p>
                <p><strong className="text-[#0F172A] dark:text-[#F8FAFC]">Parent Entity:</strong> Majnoon Studio (Pvt.) Ltd.</p>
                <p><strong className="text-[#0F172A] dark:text-[#F8FAFC]">Direct Compliance Email:</strong> <a href="mailto:support@alwakeelo.com" className="text-[#105B38] font-mono font-semibold underline">support@alwakeelo.com</a></p>
                <p><strong className="text-[#0F172A] dark:text-[#F8FAFC]">Chamber Helpline:</strong> <a href="tel:00923358341897" className="text-[#105B38] font-mono font-semibold">+92 335 834 1897</a></p>
              </div>
            </section>
          </div>
        </section>
      </div>
    </PublicPreviewShell>
  );
}
