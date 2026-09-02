import { PublicPreviewShell } from "@/experimental/components/public/PublicPreviewShell";
import { useState } from "react";
import { useDocumentHead } from "@/hooks/use-document-head";
import { ChevronDown, ChevronRight, HelpCircle, Search } from "lucide-react";

type FaqItem = {
  q: string;
  a: string;
};

type FaqSection = {
  title: string;
  items: FaqItem[];
};

const FAQ_SECTIONS: FaqSection[] = [
  {
    title: "General Platform",
    items: [
      {
        q: "What is Al Wakeelo?",
        a: "Al Wakeelo is Pakistan's first AI-powered legal assistant platform. It leverages large language models fine-tuned on Pakistani law and a comprehensive database of over 600,000 High Court and Supreme Court judgments to help advocates, law chambers, and individuals perform research and document drafting."
      },
      {
        q: "Who is behind Al Wakeelo?",
        a: "Al Wakeelo is built, maintained, and operated by Majnoon Studio, a registered digital product developer in Pakistan. We consult with leading legal professionals to ensure the relevance and accuracy of our AI's formatting and analysis."
      },
      {
        q: "Does Al Wakeelo replace a lawyer?",
        a: "No. Al Wakeelo is a legal research and drafting assistant. It provides informational drafts and legal citations grounded in Pakistani law, but does not provide binding legal advice. For any official legal action or representation in court, you must consult a licensed advocate."
      }
    ]
  },
  {
    title: "AI & Citations Accuracy",
    items: [
      {
        q: "How does the AI prevent hallucinations (fake cases)?",
        a: "Standard AI models (like ChatGPT) frequently invent fake legal precedents. Al Wakeelo solves this through a Retrieval-Augmented Generation (RAG) pipeline. Before answering any query, our engine queries our database of 600,000+ real judgments, extracts verified precedents, and forces the AI model to construct its response strictly using those verified citations."
      },
      {
        q: "What court records are indexed?",
        a: "Our database contains Supreme Court of Pakistan, Lahore High Court, Sindh High Court, Peshawar High Court, Islamabad High Court, Balochistan High Court, and Federal Shariat Court decisions. We support major reporting journals, including PLD, SCMR, CLC, YLR, MLD, CLD, and PCrLJ."
      },
      {
        q: "How do I verify if a citation in the chat is real?",
        a: "Any citation generated in the chat window is hyperlinked. Clicking on it will open a dedicated page showing the title, court, decision date, headnotes, and a verified preview of that judgment's text."
      }
    ]
  },
  {
    title: "Drafting & Statutory Scanners",
    items: [
      {
        q: "How does the Document Analyzer detect Order VII Rule 11 CPC defects?",
        a: "The Document Analyzer scans plaint and pleading text for mandatory procedural elements under the Code of Civil Procedure 1908. It specifically validates whether a clear cause of action is disclosed, verifies valuation under the Court Fees Act 1870, and checks if the suit is barred by any statutory enactment under Order VII Rule 11 CPC."
      },
      {
        q: "How does the platform compute Limitation Act deadlines and section 4 rollovers?",
        a: "The Limitation Engine parses transaction and breach dates against the First Schedule of the Limitation Act 1908 (e.g. Article 113 for 3-year specific performance suits). If the statutory expiry date falls on a Sunday or gazetted court holiday, it automatically applies Limitation Act Section 4 weekend rollover rules to the next working day."
      },
      {
        q: "What documents can the Legal Drafting module write?",
        a: "Al Wakeelo can draft writ petitions, bail applications (pre-arrest, post-arrest, protective), appeals, civil suits (for declaration, injunctions), stay applications, and statutory legal notices under Pakistani law."
      },
      {
        q: "What is Style-Memory RAG?",
        a: "Style-Memory RAG allows the AI to learn from your chamber's own documents. By uploading your past successful pleadings and contracts, the AI analyzes your preferred wording, structural templates, and formatting style to ensure that new drafts match your unique style."
      }
    ]
  },
  {
    title: "Privacy, Zero-Training & Data Security",
    items: [
      {
        q: "What is the Zero-Training guarantee for uploaded briefs and client data?",
        a: "Under our strict Zero-Training guarantee, no confidential client pleadings, uploaded briefs, or chamber conversations are ever used to train base AI models. All data is processed ephemerally in isolated secure memory spaces with AES-256 and TLS 1.3 encryption in compliance with PECA 2016 and the Qanun-e-Shahadat Order 1984."
      },
      {
        q: "Is my chat history and case data private?",
        a: "Absolutely. All user query data, conversations, and document uploads are strictly protected under secure database controls. Only users inside your authenticated chamber or organization can view shared drafts, files, or thread histories."
      },
      {
        q: "Are my uploaded documents stored permanently?",
        a: "Documents uploaded to your Knowledge Vault or Case Files are stored securely on our encrypted serverless storage. If you upload a PDF file inside the chat window for quick analysis, it is parsed and chunked in memory for that session but not retained permanently."
      }
    ]
  }
];

function AccordionItem({ q, a }: FaqItem) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-[#E2E8F0] dark:border-[#1E2D44] bg-white/40 dark:bg-[#131E2E]/40 rounded-2xl overflow-hidden transition-all hover:bg-white dark:bg-[#131E2E]/60">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left p-5 text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none"
      >
        <span>{q}</span>
        {open ? <ChevronDown size={16} className="text-[#105B38] flex-shrink-0" /> : <ChevronRight size={16} className="text-[#64748B] dark:text-[#94A3B8] flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed border-t border-[#E2E8F0]/40 dark:border-[#1E2D44]/40 whitespace-pre-line">
          {a}
        </div>
      )}
    </div>
  );
}

export default function PreviewFaq() {
  const [searchQuery, setSearchQuery] = useState("");

  useDocumentHead({
    title: "Frequently Asked Questions (FAQ) | Al Wakeelo",
    description: "Got questions about Al Wakeelo? Read our comprehensive FAQ covering features, AI grounding, database statistics, and subscriptions.",
    path: "/faq",
  });

  const filteredSections = FAQ_SECTIONS.map((section) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return section;
    const items = section.items.filter(
      (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
    );
    return { ...section, items };
  }).filter((section) => section.items.length > 0);

  return (
    <PublicPreviewShell>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="space-y-10 fade-in">
          <section className="text-center space-y-4 py-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#105B38]/10 border border-[#105B38]/20 rounded-full text-xs text-[#105B38] font-bold uppercase tracking-widest">
              FAQ
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
              Frequently Asked Questions <br/>
              <span className="text-[#105B38] italic">about Al Wakeelo</span>
            </h1>
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8] max-w-2xl mx-auto leading-relaxed">
              Find answers to common questions about platform accuracy, legal assistance limits, case database coverage, and security structures.
            </p>

            <div className="max-w-md mx-auto relative pt-4">
              <Search className="absolute left-3.5 top-7 text-[#64748B] dark:text-[#94A3B8]" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search questions (e.g. Limitation Act, Order VII Rule 11, Zero-Training)..."
                className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#105B38]/50 shadow-sm"
              />
            </div>
          </section>

          <section className="space-y-10 pt-6 border-t border-[#E2E8F0] dark:border-[#1E2D44]">
            {filteredSections.length === 0 ? (
              <div className="text-center py-12 text-sm text-[#64748B] dark:text-[#94A3B8]">
                No questions found matching "{searchQuery}". Try a different search term.
              </div>
            ) : (
              filteredSections.map((section) => (
                <div key={section.title} className="space-y-4">
                  <h2 className="text-lg font-bold italic text-[#105B38] flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                    <HelpCircle size={16} /> {section.title}
                  </h2>
                  <div className="space-y-3">
                    {section.items.map((item, idx) => (
                      <AccordionItem key={idx} q={item.q} a={item.a} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
    </PublicPreviewShell>
  );
}
