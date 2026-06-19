import "./load-env";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { runKnowledgePipeline } from "../server/pipeline/knowledge-pipeline";
import { chatWithOpenRouter } from "../server/openrouter";

interface Topic {
  slug: string;
  title: string;
  category: string;
  summary: string;
  query: string;
  readTime: string;
}

const NEW_TOPICS: Topic[] = [
  {
    slug: "defamation-laws-pakistan-civil-criminal-remedies",
    title: "Defamation Laws in Pakistan: Civil vs. Criminal Remedies and Defenses",
    category: "Civil Law",
    summary: "An in-depth legal analysis of the Defamation Ordinance 2002, criminal defamation under PPC Sections 499 and 500, available civil/criminal remedies, and key legal defenses.",
    query: "What is the Defamation Ordinance 2002 in Pakistan? What is Section 499 and 500 PPC for criminal defamation? What are the defenses, procedure, and damages? Citing relevant Pakistani statutes and landmark Supreme Court judgments is mandatory.",
    readTime: "9 min read"
  },
  {
    slug: "guide-to-fir-crpc-pakistan-registration-quashment",
    title: "A Complete Guide to FIR in Pakistan: Registration, Remedies, and Quashment",
    category: "Criminal Law",
    summary: "Learn the legal procedure for registering a First Information Report (FIR) under Section 154 CrPC, legal remedies under Section 22-A/22-B CrPC for police refusal, and the grounds for quashing an FIR under Section 561-A.",
    query: "What is Section 154 CrPC for FIR registration in Pakistan? What are the remedies under Section 22-A and 22-B CrPC? What is Section 561-A CrPC for quashment of FIR? Citing relevant Pakistani statutes and landmark Supreme Court judgments is mandatory.",
    readTime: "10 min read"
  },
  {
    slug: "company-registration-pakistan-secp-companies-act",
    title: "Company Registration in Pakistan: Step-by-Step SECP Guide",
    category: "Commercial Law",
    summary: "A step-by-step guide to incorporating a private limited company under the Companies Act 2017 with the Securities and Exchange Commission of Pakistan (SECP).",
    query: "What is the procedure for registering a private limited company under the Companies Act 2017 in Pakistan? What are the requirements for name reservation, memorandum of association, articles of association, SECP registration, and post-incorporation compliance? Citing relevant statutory sections is mandatory.",
    readTime: "8 min read"
  },
  {
    slug: "arbitration-adr-agreement-arbitration-act-pakistan",
    title: "Understanding ADR and Arbitration under Pakistan's Arbitration Act 1940",
    category: "Commercial Law",
    summary: "An analysis of the Arbitration Act 1940 in Pakistan, covering the validity of arbitration agreements, appointment of arbitrators, challenges to awards, and court enforcement.",
    query: "What is the Arbitration Act 1940 in Pakistan? How are arbitration agreements, arbitrator appointments, and challenges to awards handled? Citing relevant statutory sections and Supreme Court judgments is mandatory.",
    readTime: "9 min read"
  }
];

async function generateArticle(topic: Topic) {
  console.log(`\n🔍 Fetching database context for query: "${topic.query.substring(0, 80)}..."`);
  const pipelineResult = await runKnowledgePipeline(topic.query);
  
  console.log(`📊 Retrieved Context Length: ${pipelineResult.contextString.length} bytes`);
  console.log(`   Has Case Law: ${pipelineResult.hasCaseLaw}, Has Statutes: ${pipelineResult.hasStatutes}`);

  const prompt = `
You are a senior advocate of the High Court in Pakistan and a legal content writer.
Write a comprehensive, professional, and authoritative legal blog article based on the following topic and retrieved database context.

Topic details:
- Title: ${topic.title}
- Category: ${topic.category}
- Summary: ${topic.summary}
- Slug: ${topic.slug}
- Read Time: ${topic.readTime}

Retrieved database context (contains verified statutes, sections, and case law):
${pipelineResult.contextString}

Instructions for writing:
1. Write a comprehensive, long-form guide (1500 to 2500 words).
2. Ground your article strictly in the provided database context. Cite specific statutes (e.g., Pakistan Penal Code 1860, Code of Criminal Procedure 1898, Defamation Ordinance 2002, Companies Act 2017, Arbitration Act 1940) and specific sections/citations (e.g., Section 499 PPC, Section 154 CrPC, PLD/SCMR/CLC citations) present in the context.
3. If no matching database results were found in the context (Safety Gate is active), write a general legal guide about the topic citing general principles under Pakistani law, but do NOT make up or hallucinate specific section numbers or case citations.
4. Structure the article beautifully in Markdown. Use a main heading for the title, subheadings (## 1. Section, ## 2. Section), and bullet points or tables where appropriate.
5. Do NOT include any author name or profile. Keep it strictly focused on the legal details.
6. The output should ONLY contain the Markdown content of the article. Do not include any HTML wraps or meta introduction text. Start directly with the Markdown heading: "# ${topic.title}".

Write the article now:
`;

  console.log(`💬 Calling OpenRouter to generate article for "${topic.title}"...`);
  const response = await chatWithOpenRouter({
    messages: [
      { role: "system", content: "You are a professional legal expert in Pakistani law." },
      { role: "user", content: prompt }
    ],
    temperature: 0.2
  });

  console.log(`✅ Generation complete! Length: ${response.content.length} characters.`);
  return response.content;
}

async function main() {
  const blogDataPath = path.resolve(__dirname, "../shared/blog-data.ts");
  console.log(`Reading blog data from: ${blogDataPath}`);
  let blogDataContent = fs.readFileSync(blogDataPath, "utf-8");

  for (const topic of NEW_TOPICS) {
    console.log(`\n======================================================================`);
    console.log(`Processing Topic: ${topic.title}`);
    console.log(`======================================================================`);
    
    // Check if slug already exists to prevent duplicate addition
    if (blogDataContent.includes(`slug: "${topic.slug}"`)) {
      console.log(`⚠️ Article with slug "${topic.slug}" already exists. Skipping.`);
      continue;
    }

    try {
      const markdown = await generateArticle(topic);
      
      // Escape backticks inside the generated content since it will be inside a template literal
      const escapedMarkdown = markdown.replace(/`/g, "\\`").trim();
      
      // Construct the TS object
      const articleSnippet = `,
  {
    slug: "${topic.slug}",
    title: "${topic.title}",
    category: "${topic.category}",
    summary: "${topic.summary}",
    publishedAt: "2026-06-19",
    readTime: "${topic.readTime}",
    content: \`${escapedMarkdown}\`
  }`;

      // Insert before the closing '];' of BLOG_ARTICLES
      const lastIndex = blogDataContent.lastIndexOf("];");
      if (lastIndex === -1) {
        throw new Error("Could not find closing '];' in blog-data.ts");
      }

      blogDataContent = blogDataContent.substring(0, lastIndex) + articleSnippet + "\n];\n";
      fs.writeFileSync(blogDataPath, blogDataContent, "utf-8");
      console.log(`💾 Saved article successfully to shared/blog-data.ts`);
      
    } catch (error) {
      console.error(`❌ Failed to process topic: ${topic.title}`, error);
    }
  }

  console.log("\n🎉 Generation complete!");
}

main();
