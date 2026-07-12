import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple manual .env parser
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const firstEq = trimmed.indexOf("=");
    if (firstEq === -1) continue;
    const key = trimmed.slice(0, firstEq).trim();
    let val = trimmed.slice(firstEq + 1).trim();
    // Strip quotes if any
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnv();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";

interface ArticleMeta {
  keyword: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  date: string;
}

const articlesToGenerate: ArticleMeta[] = [
  {
    keyword: "Legal Document Automation for Law Firms: 2026 Guide",
    slug: "legal-document-automation-law-firms-2026-guide",
    title: "Legal Document Automation for Law Firms: 2026 Guide",
    category: "Legal Tech",
    summary: "A complete guide on how modern law firms use automated document assembly systems, conditional logic, and templates to streamline legal drafting in 2026.",
    date: "2026-07-12"
  },
  {
    keyword: "Top 4 Best Legal AI Tools Alternatives 2026",
    slug: "best-legal-ai-tools-alternatives-2026",
    title: "Top 4 Best Legal AI Tools Alternatives in 2026",
    category: "Legal Tech",
    summary: "An objective review of the leading generative AI platforms for lawyers, comparing features, accuracy, and pricing for alternatives to global services.",
    date: "2026-07-13"
  },
  {
    keyword: "lease agreement pakistan",
    slug: "lease-agreement-pakistan",
    title: "Lease Agreement in Pakistan: Complete Legal Drafting Guide & Format",
    category: "Property Law",
    summary: "Learn the essential components of a legally binding residential or commercial lease agreement under Pakistani rent restriction laws, including a standard template.",
    date: "2026-07-14"
  },
  {
    keyword: "affidavit format pakistan",
    slug: "affidavit-format-pakistan",
    title: "Affidavit Format in Pakistan: Writing Guide & Standard Templates",
    category: "Legal Drafting",
    summary: "A step-by-step guide to drafting affidavits in Pakistan under the Oaths Act 1873, complete with correct verification clauses and format guidelines.",
    date: "2026-07-15"
  },
  {
    keyword: "power of attorney drafting",
    slug: "power-of-attorney-drafting",
    title: "Power of Attorney Drafting Guide: Legal Requirements in Pakistan",
    category: "Legal Drafting",
    summary: "How to draft general and special power of attorney documents in Pakistan, covering registration under the Registration Act 1908 and stamp duty guidelines.",
    date: "2026-07-16"
  },
  {
    keyword: "ai for legal drafting",
    slug: "ai-for-legal-drafting",
    title: "AI for Legal Drafting: Transforming Pakistani Law Chambers",
    category: "Legal Tech",
    summary: "An analysis of how artificial intelligence is changing the litigation lifecycle for advocates in Pakistan, from petition templates to citation lookup.",
    date: "2026-07-17"
  },
  {
    keyword: "best legal drafting ai",
    slug: "best-legal-drafting-ai",
    title: "Best Legal Drafting AI Tools for Lawyers in 2026",
    category: "Legal Tech",
    summary: "Comparing the top legal drafting assistant platforms in 2026, detailing feature integration, custom styles, and case database grounding.",
    date: "2026-07-18"
  },
  {
    keyword: "lexisnexis alternatives",
    slug: "lexisnexis-alternatives",
    title: "Top Alternatives to LexisNexis for Legal Research in Pakistan",
    category: "Legal Research",
    summary: "Comparing cost-effective and local alternatives to LexisNexis for searching judgments, statutes, and precedents in the Pakistani legal system.",
    date: "2026-07-19"
  },
  {
    keyword: "harvey ai alternatives",
    slug: "harvey-ai-alternatives",
    title: "Harvey AI Alternatives: Best Legal GenAI Platforms for Law Firms",
    category: "Legal Tech",
    summary: "Discovering custom RAG-grounded legal assistant platforms that provide equivalent workflows to Harvey AI for contract review and research.",
    date: "2026-07-20"
  },
  {
    keyword: "NDA Pakistan",
    slug: "nda-pakistan",
    title: "Non-Disclosure Agreement (NDA) in Pakistan: Drafting Guide & Templates",
    category: "Corporate Law",
    summary: "How to draft enforceable non-disclosure and confidentiality agreements in Pakistan under the Contract Act 1872, complete with sample clauses.",
    date: "2026-07-21"
  },
  {
    keyword: "legal drafting pakistan",
    slug: "legal-drafting-pakistan",
    title: "Legal Drafting in Pakistan: Rules, Forms, and Pleading Standards",
    category: "Legal Drafting",
    summary: "A masterclass on the formal rules of pleadings in civil and criminal litigation in Pakistan under the CPC 1908 and High Court Rules.",
    date: "2026-07-22"
  },
  {
    keyword: "legal notice drafting pakistan",
    slug: "legal-notice-drafting-pakistan",
    title: "How to Draft a Legal Notice in Pakistan: Format & Templates",
    category: "Legal Drafting",
    summary: "The mandatory structure of legal notices under Pakistani law, including defamation notices under Section 8 of the Defamation Ordinance 2002.",
    date: "2026-07-23"
  },
  {
    keyword: "partnership deed drafting",
    slug: "partnership-deed-drafting",
    title: "Partnership Deed Drafting Guide under Partnership Act 1932",
    category: "Corporate Law",
    summary: "A practical guide to drafting partnership agreements, registration with the Registrar of Firms, and key clauses for profit sharing and dissolution.",
    date: "2026-07-24"
  },
  {
    keyword: "legal drafting templates",
    slug: "legal-drafting-templates",
    title: "Free Legal Drafting Templates for Pakistani Lawyers",
    category: "Legal Drafting",
    summary: "Access a catalog of standard petition headers, verification blocks, and index forms conforming to district and High Court guidelines in Pakistan.",
    date: "2026-07-25"
  },
  {
    keyword: "best legal drafting software",
    slug: "best-legal-drafting-software",
    title: "Best Legal Drafting Software for Law Firms in 2026",
    category: "Legal Tech",
    summary: "Reviewing the top document assembly tools, template repositories, and editor add-ins that streamline contract generation and filing.",
    date: "2026-07-26"
  },
  {
    keyword: "case brief writing",
    slug: "case-brief-writing",
    title: "How to Write a Case Brief: Guide for Pakistani Law Students & Advocates",
    category: "Legal Research",
    summary: "Learn the IRAC method (Issue, Rule, Analysis, Conclusion) to effectively dissect and summarize complex Pakistani High Court and Supreme Court judgments.",
    date: "2026-07-27"
  },
  {
    keyword: "best legal ai platforms",
    slug: "best-legal-ai-platforms",
    title: "Top Legal AI Platforms in 2026: Comprehensive Review",
    category: "Legal Tech",
    summary: "An updated review of the legal tech landscape in 2026, comparing conversational assistants, drafting assistants, and predictive analytic engines.",
    date: "2026-07-28"
  },
  {
    keyword: "vakalatnama drafting",
    slug: "vakalatnama-drafting",
    title: "Vakalatnama Drafting Guide: Legal Representation in Pakistan",
    category: "Legal Drafting",
    summary: "The formal structure of power of attorney in courts (Vakalatnama) in Pakistan, covering execution, court fees, stamp duties, and advocate powers.",
    date: "2026-07-29"
  },
  {
    keyword: "constitutional law research",
    slug: "constitutional-law-research",
    title: "How to Conduct Constitutional Law Research in Pakistan",
    category: "Legal Research",
    summary: "A roadmap to finding constitutional precedents, interpreting Article 199 writ powers, and researching historical amendments to the 1973 Constitution.",
    date: "2026-07-30"
  },
  {
    keyword: "legal workflow automation",
    slug: "legal-workflow-automation",
    title: "Legal Workflow Automation: Streamlining Law Firm Operations",
    category: "Legal Tech",
    summary: "How to automate client intake, hearing calendars, task dependencies, and invoice scheduling inside busy advocate chambers.",
    date: "2026-07-31"
  },
  {
    keyword: "contract review checklist",
    slug: "contract-review-checklist",
    title: "Contract Review Checklist: 10 Clauses Every Lawyer Must Check",
    category: "Corporate Law",
    summary: "Essential checkpoints for vetting commercial contracts under the Contract Act 1872, focusing on indemnity, limitation of liability, and jurisdiction.",
    date: "2026-08-01"
  },
  {
    keyword: "legal prompt engineering",
    slug: "legal-prompt-engineering",
    title: "Legal Prompt Engineering: How to Guide AI for Precise Drafting",
    category: "Legal Tech",
    summary: "The ultimate guide on structuring system prompts, introducing legal templates, and enforcing strict jurisdictional boundaries for AI outputs.",
    date: "2026-08-02"
  }
];

async function generateArticle(meta: ArticleMeta): Promise<string> {
  console.log(`Generating: "${meta.title}"...`);
  const prompt = `You are a senior Pakistani legal expert and legal SEO specialist. 
Write a highly detailed, professional, and authoritative blog post on the topic: "${meta.keyword}".
The title of the post is: "${meta.title}".
The article is categorized under: "${meta.category}".
The summary of the article is: "${meta.summary}".

Your article MUST:
1. Be written in markdown format (do not wrap in markdown code blocks like \`\`\`markdown ... \`\`\`, just output raw markdown).
2. Detail the exact legal provisions, acts, and guidelines of Pakistani law (e.g., Contract Act 1872, Civil Procedure Code (CPC) 1908, Specific Relief Act 1877, Registration Act 1908, stamp duties, court fees, etc.) where applicable.
3. Be structured with professional headers (##, ###), bullet points, and clean lists.
4. Include a standard outline of the drafting steps, requirements, or a clean template/checklist if relevant.
5. Reference real Pakistani courts (Supreme Court, High Courts, District Courts) or legal practices where applicable.
6. Be highly comprehensive (between 1000 and 1500 words). Do not summarize or skip sections. Deliver complete value.

Begin the article directly with a level 1 markdown header:
# ${meta.title}

Write the full article now.`;

  const payload = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: prompt }
    ],
    max_tokens: 4000,
    temperature: 0.3,
  };

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${errorText}`);
  }

  const json = await response.json() as any;
  return json?.choices?.[0]?.message?.content || "";
}

async function run() {
  if (!DEEPSEEK_API_KEY) {
    console.error("DEEPSEEK_API_KEY is not set in .env");
    process.exit(1);
  }

  const blogDataPath = path.join(__dirname, "..", "shared", "blog-data.ts");
  let blogDataContent = fs.readFileSync(blogDataPath, "utf-8");

  const closingIndex = blogDataContent.lastIndexOf("];");
  if (closingIndex === -1) {
    console.error("Could not find the end of the BLOG_ARTICLES array in blog-data.ts");
    process.exit(1);
  }

  let appendedString = "";

  for (const meta of articlesToGenerate) {
    let content = "";
    let retries = 3;
    while (retries > 0) {
      try {
        content = await generateArticle(meta);
        if (content.trim()) break;
      } catch (err: any) {
        console.warn(`Error generating article: ${err.message}. Retries left: ${retries - 1}`);
        retries--;
        await new Promise(res => setTimeout(res, 5000));
      }
    }

    if (!content.trim()) {
      console.error(`Failed to generate article: ${meta.title}`);
      continue;
    }

    // Escape backticks and double quotes in content
    const escapedContent = content
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\${/g, "\\${");

    appendedString += `,\n  {\n    slug: "${meta.slug}",\n    title: "${meta.title.replace(/"/g, '\\"')}",\n    category: "${meta.category}",\n    summary: "${meta.summary.replace(/"/g, '\\"')}",\n    publishedAt: "${meta.date}",\n    readTime: "8 min read",\n    content: \`${escapedContent}\`\n  }`;
  }

  const updatedContent = blogDataContent.slice(0, closingIndex).trim() + appendedString + "\n];\n";
  fs.writeFileSync(blogDataPath, updatedContent, "utf-8");
  console.log("Successfully appended all 22 articles to shared/blog-data.ts!");
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
