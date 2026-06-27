import { Fragment, useState } from "react";
import { useDocumentHead } from "@/hooks/use-document-head";
import { ChevronDown, ChevronRight, HelpCircle } from "lucide-react";
import { Banner300x250Ad } from "@/components/ad-banner";

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
    title: "Drafting & Styling",
    items: [
      {
        q: "What documents can the Legal Drafting module write?",
        a: "Al Wakeelo can draft writ petitions, bail applications (pre-arrest, post-arrest, protective), appeals, civil suits (for declaration, injunctions), stay applications, and statutory legal notices under Pakistani law."
      },
      {
        q: "Does the drafting follow Pakistani court rules?",
        a: "Yes. The AI is instructed to format pleadings exactly like real advocate drafts in Pakistan. It includes court headers, parties blocks, numbered paragraphs, specific statutory grounds, prayer clauses, and mandatory verification statements."
      },
      {
        q: "What is Style-Memory RAG?",
        a: "Style-Memory RAG allows the AI to learn from your chamber's own documents. By uploading your past successful pleadings and contracts, the AI analyzes your preferred wording, structural templates, and formatting style to ensure that new drafts match your unique style."
      }
    ]
  },
  {
    title: "Privacy & Data Security",
    items: [
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
    <div className="border border-border bg-card/40 rounded-2xl overflow-hidden transition-all hover:bg-card/60">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left p-5 text-sm font-bold text-foreground focus:outline-none"
      >
        <span>{q}</span>
        {open ? <ChevronDown size={16} className="text-primary flex-shrink-0" /> : <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 text-xs text-muted-foreground leading-relaxed border-t border-border/40 whitespace-pre-line">
          {a}
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  useDocumentHead({
    title: "Frequently Asked Questions (FAQ) | Al Wakeelo",
    description: "Got questions about Al Wakeelo? Read our comprehensive FAQ covering features, AI grounding, database statistics, and subscriptions.",
    path: "/faq",
  });

  return (
    <div className="space-y-10 fade-in">
      <section className="text-center space-y-4 py-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary font-bold uppercase tracking-widest">
          FAQ
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
          Frequently Asked Questions <br/>
          <span className="text-primary italic">about Al Wakeelo</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Find answers to common questions about platform accuracy, legal assistance limits, case database coverage, and security structures.
        </p>
      </section>

      <section className="space-y-10 pt-6 border-t border-border">
        {FAQ_SECTIONS.map((section, sIdx) => (
          <Fragment key={section.title}>
            <div className="space-y-4">
              <h2 className="text-lg font-bold italic text-primary flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                <HelpCircle size={16} /> {section.title}
              </h2>
              <div className="space-y-3">
                {section.items.map((item, idx) => (
                  <AccordionItem key={idx} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
            {sIdx === 1 && (
              <Banner300x250Ad className="my-6" />
            )}
          </Fragment>
        ))}
      </section>
    </div>
  );
}
