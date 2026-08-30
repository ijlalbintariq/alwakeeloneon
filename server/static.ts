import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { injectSeoMeta, type SeoMeta } from "./seo-meta";
import { db } from "./db";
import { judgments, statuteDocuments } from "@shared/schema";
import { eq } from "drizzle-orm";
import { BLOG_ARTICLES } from "../shared/blog-data";

const KNOWN_SPA_ROUTES: RegExp[] = [
  /^\/$/,
  /^\/about$/,
  /^\/contact$/,
  /^\/faq$/,
  /^\/blog$/,
  /^\/blog\/[^/]+$/,
  /^\/auth$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
  /^\/share\/[^/]+$/,
  /^\/privacy$/,
  /^\/terms$/,
  /^\/cancellation-return-refund-policy$/,
  /^\/ownership-statement$/,
  /^\/install$/,
  /^\/word-addin-guide$/,
  /^\/dashboard$/,
  /^\/judgments$/,
  /^\/judgments\/browse$/,
  /^\/judgment-search$/,
  /^\/judgment-view$/,
  /^\/citation-search$/,
  /^\/judgment\/[^/]+$/,
  /^\/statute-search$/,
  /^\/statute-view\/[^/]+$/,
  /^\/al-wakeelo$/,
  /^\/legal-drafting$/,
  /^\/contract-drafting$/,
  /^\/case-documents$/,
  /^\/bookmarks$/,
  /^\/history$/,
  /^\/knowledge-vault$/,
  /^\/organization$/,
  /^\/admin$/,
  /^\/settings$/,
  /^\/admin-setup$/,
  /^\/checkout$/,
  /^\/checkout\/success$/,
];

function isKnownSpaRoute(pathname: string): boolean {
  return KNOWN_SPA_ROUTES.some((pattern) => pattern.test(pathname));
}

const HTML_CACHE_HEADER = "public, max-age=0, must-revalidate, s-maxage=300";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Read index.html once at startup so per-request SEO meta injection is
  // a pure string-replace (no disk I/O per crawl).
  const indexHtmlPath = path.resolve(distPath, "index.html");
  const indexHtmlTemplate = fs.readFileSync(indexHtmlPath, "utf8");

  // 24-hour cache for dynamic SEO metadata to keep Render/Neon DB load near zero
  const seoCache = new Map<string, { meta: SeoMeta; preRenderBlock: string; expiresAt: number }>();
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  const MAX_SEO_CACHE_SIZE = 500; // Limit cache to ~30MB to prevent Render out-of-memory (OOM) status 137/139

  function setSeoCache(key: string, data: { meta: SeoMeta; preRenderBlock: string; expiresAt: number }) {
    if (seoCache.size >= MAX_SEO_CACHE_SIZE) {
      // Map iteration is in insertion order, so this drops the oldest 100 entries
      let i = 0;
      for (const k of seoCache.keys()) {
        seoCache.delete(k);
        if (++i >= 100) break;
      }
    }
    seoCache.set(key, data);
  }

  // Returns { meta, preRenderBlock } tuple — null when judgment not found.
  // Concurrency limiter for SEO DB lookups — prevents crawlers from exhausting the pool
  let seoActiveQueries = 0;
  const SEO_MAX_CONCURRENT = 50;
  const SEO_QUERY_TIMEOUT_MS = 8_000;

  async function getJudgmentSeoData(id: string): Promise<{ meta: SeoMeta; preRenderBlock: string } | undefined> {
    const now = Date.now();
    const cached = seoCache.get(id);
    if (cached && cached.expiresAt > now) {
      return { meta: cached.meta, preRenderBlock: cached.preRenderBlock };
    }

    // Drop if too many concurrent SEO queries — serve without custom meta instead of queueing
    if (seoActiveQueries >= SEO_MAX_CONCURRENT) {
      return undefined;
    }

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (!isUuid) return undefined;

      seoActiveQueries++;
      const queryPromise = db
        .select({
          title: judgments.title,
          citationString: judgments.citationString,
          courtNameSnapshot: judgments.courtNameSnapshot,
          decisionDate: judgments.decisionDate,
          petitioner: judgments.petitioner,
          respondent: judgments.respondent,
          headnotes: judgments.headnotes,
          fullText: judgments.fullText,
        })
        .from(judgments)
        .where(eq(judgments.id, id))
        .limit(1);

      // Race against a timeout — don't let SEO lookups stall forever
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SEO query timeout")), SEO_QUERY_TIMEOUT_MS)
      );

      const [row] = await Promise.race([queryPromise, timeoutPromise]) as any[];
      seoActiveQueries = Math.max(0, seoActiveQueries - 1);

      if (row) {
        const title = row.title ? String(row.title).trim() : "";
        const citation = row.citationString ? String(row.citationString).trim() : "";
        const courtName = row.courtNameSnapshot ? String(row.courtNameSnapshot).trim() : "Supreme Court / High Court of Pakistan";
        const decisionDateStr = row.decisionDate ? new Date(row.decisionDate).toISOString().slice(0, 10) : "";
        const yearStr = decisionDateStr ? decisionDateStr.slice(0, 4) : "";
        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const petitioner = row.petitioner ? String(row.petitioner).trim() : "";
        const respondent = row.respondent ? String(row.respondent).trim() : "";
        const headnotes = row.headnotes ? String(row.headnotes).trim() : "";
        const rawFullText = row.fullText ? String(row.fullText).trim() : "";
        const courtSlug = courtName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

        // Schema markup: CourtCase + BreadcrumbList for rich snippets
        const schema = [
          {
            "@context": "https://schema.org",
            "@type": "CourtCase",
            "name": title,
            "identifier": citation || id,
            "caseNumber": citation || id,
            "court": {
              "@type": "GovernmentOrganization",
              "name": courtName
            },
            "inLanguage": "en",
            "isAccessibleForFree": true,
            ...(decisionDateStr ? { "datePublished": decisionDateStr } : {})
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.alwakeelo.com/" },
              { "@type": "ListItem", "position": 2, "name": "Judgments", "item": "https://www.alwakeelo.com/judgments" },
              { "@type": "ListItem", "position": 3, "name": courtName, "item": `https://www.alwakeelo.com/judgments/browse?court=${encodeURIComponent(courtSlug)}` },
              { "@type": "ListItem", "position": 4, "name": citation || title, "item": `https://www.alwakeelo.com/judgment/${id}` }
            ]
          }
        ];
        const schemaMarkup = `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;

        const meta: SeoMeta = {
          title: `${title}${citation ? ` (${citation})` : ""} | Al Wakeelo`,
          description: `Read the full case law: ${title}${citation ? `, ${citation}` : ""} on Al Wakeelo — Pakistan's AI legal assistant. Full judgment text, court, and citations.`,
          index: true,
          schemaMarkup,
        };

        // Deliver up to 25,000 characters of full judgment text (approx 4,000-5,000 words)
        const MAX_JUDGMENT_CHARS = 25000;
        const isTruncated = rawFullText.length > MAX_JUDGMENT_CHARS;
        const fullTextContent = isTruncated
          ? rawFullText.slice(0, MAX_JUDGMENT_CHARS).replace(/\s+\S*$/, "") + "…"
          : rawFullText;

        const formattedParagraphs = fullTextContent
          ? fullTextContent
              .split(/\n\s*\n/)
              .map(p => p.trim())
              .filter(Boolean)
              .map(p => `<p style="margin-bottom:12px;line-height:1.6;">${esc(p)}</p>`)
              .join("\n")
          : "<p>Judgment text available in database.</p>";

        const partiesLine = petitioner && respondent
          ? `<p><strong>Parties:</strong> ${esc(petitioner)} vs ${esc(respondent)}</p>`
          : petitioner
            ? `<p><strong>Petitioner:</strong> ${esc(petitioner)}</p>`
            : "";
        const headnotesBlock = headnotes
          ? `<div style="margin:20px 0;padding:15px;background:#fdfcf9;border:1px solid #e5e0d8;border-radius:6px;"><h2>Headnotes</h2><p style="white-space:pre-wrap;line-height:1.6;">${esc(headnotes.slice(0, 3000))}</p></div>`
          : "";

        // Visible prerender block with breadcrumbs, /seo-geo legal summary block, full text, and internal links
        const preRenderBlock = `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <nav aria-label="Breadcrumb" style="margin-bottom:15px;font-size:14px;color:#666;">
    <a href="/" style="color:#0066cc;text-decoration:none;">Home</a> &gt; 
    <a href="/judgments" style="color:#0066cc;text-decoration:none;">Judgments</a> &gt; 
    <a href="/judgments/browse?court=${encodeURIComponent(courtSlug)}" style="color:#0066cc;text-decoration:none;">${esc(courtName)}</a>
    ${yearStr ? ` &gt; <a href="/judgments/browse?year=${encodeURIComponent(yearStr)}" style="color:#0066cc;text-decoration:none;">${esc(yearStr)}</a>` : ''} &gt; 
    <span>${esc(citation || title)}</span>
  </nav>

  <h1>${esc(title)}${citation ? ` — ${esc(citation)}` : ""}</h1>
  ${citation ? `<p><strong>Official Citation:</strong> ${esc(citation)}</p>` : ""}
  <p><strong>Court / Jurisdiction:</strong> <a href="/judgments/browse?court=${encodeURIComponent(courtSlug)}" style="color:#0066cc;">${esc(courtName)}</a></p>
  ${yearStr ? `<p><strong>Year of Decision:</strong> <a href="/judgments/browse?year=${encodeURIComponent(yearStr)}" style="color:#0066cc;">${esc(yearStr)}</a></p>` : ""}
  ${decisionDateStr ? `<p><strong>Decision Date:</strong> ${esc(decisionDateStr)}</p>` : ""}
  ${partiesLine}

  <section style="margin:20px 0;padding:15px;background:#f8fafc;border-left:4px solid #f59e0b;border-radius:4px;">
    <h2 style="font-size:18px;margin-top:0;">Case Summary &amp; Legal Holding</h2>
    <p style="margin:0;line-height:1.6;">
      This judicial decision was delivered by the <strong>${esc(courtName)}</strong>${decisionDateStr ? ` on ${esc(decisionDateStr)}` : ''}. 
      The matter involves proceedings between <strong>${esc(petitioner || 'Petitioner')}</strong> and <strong>${esc(respondent || 'Respondent')}</strong>${citation ? `, officially reported as <strong>${esc(citation)}</strong>` : ''}. 
      The court reviewed applicable Pakistani statutes, procedural requirements, and governing case-law authorities. 
      The full text below contains the complete facts, arguments, and legal reasoning rendered by the honorable bench.
    </p>
  </section>

  ${headnotesBlock}

  <section style="margin:25px 0;">
    <h2>Full Judgment Text &amp; Judicial Ruling</h2>
    ${formattedParagraphs}
    ${isTruncated ? `<p style="font-style:italic;color:#666;margin-top:15px;">Read the unabridged text and precedent citation network on <a href="https://www.alwakeelo.com/judgment/${id}">Al Wakeelo Legal Research Platform</a>.</p>` : ''}
  </section>

  <section style="margin-top:30px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:14px;">
    <h3>Related Legal Research &amp; Directories</h3>
    <ul style="line-height:1.8;">
      <li>Browse all judgments from <a href="/judgments/browse?court=${encodeURIComponent(courtSlug)}">${esc(courtName)}</a></li>
      ${yearStr ? `<li>Browse Pakistani court decisions from the year <a href="/judgments/browse?year=${encodeURIComponent(yearStr)}">${esc(yearStr)}</a></li>` : ''}
      <li>Search Pakistani statutes: <a href="/statute-search">Constitution of Pakistan 1973, PPC, CrPC, CPC &amp; Family Laws</a></li>
      <li>Analyze this case with <a href="/al-wakeelo">Al Wakeelo AI Legal Assistant</a></li>
    </ul>
  </section>
</div>`;

        setSeoCache(id, { meta, preRenderBlock, expiresAt: now + CACHE_TTL_MS });
        return { meta, preRenderBlock };
      }
    } catch (err: any) {
      seoActiveQueries = Math.max(0, seoActiveQueries - 1);
      // Silently swallow timeouts — page still loads, just without custom SEO meta
      if (err?.message !== "SEO query timeout") {
        console.error(`[SEO Meta] Failed dynamic lookup for judgment ${id}:`, err);
      }
    }
    return undefined;
  }

  // ── Static page pre-render blocks ────────────────────────────────────────
  // Non-JS crawlers (Bing, Yandex, ChatGPT search) see real text immediately
  // without needing to execute JavaScript. Hidden from sighted users via
  // display:none — React's #root takes over visually.
  const STATIC_PRERENDER: Record<string, string> = {
    "/": `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <h1>Alwakeelo AI — Pakistan's AI-Powered Legal Assistant</h1>
  <p>Alwakeelo AI is Pakistan's first AI legal assistant, built for lawyers, law students, and anyone navigating Pakistani law. Search over 600,000 judgments from the Supreme Court of Pakistan, Lahore High Court, Sindh High Court, Peshawar High Court, Islamabad High Court, Balochistan High Court, and Federal Shariat Court.</p>
  <h2>Features</h2>
  <ul>
    <li><strong>Judgment Search</strong> — Search 600,000+ Pakistani judgments by citation, party name, court, year, and keyword. Includes PLD, SCMR, YLR, MLD, CLD, CLC, PCrLJ law reports.</li>
    <li><strong>AI Legal Chat</strong> — Ask questions about Pakistani law and receive answers grounded in verified case law and statutes. Al Wakeelo cites real judgments and sections.</li>
    <li><strong>Legal Drafting</strong> — AI-assisted drafting of court-ready writ petitions, bail applications, and legal notices under Pakistani procedural law.</li>
    <li><strong>Contract Drafting</strong> — Draft rental agreements, employment contracts, sale agreements, and partnership deeds compliant with the Contract Act 1872.</li>
    <li><strong>Statute Search</strong> — Search the Constitution of Pakistan, Pakistan Penal Code (PPC), Code of Criminal Procedure (CrPC), Code of Civil Procedure (CPC), Qanun-e-Shahadat Order, Family Laws, and more.</li>
    <li><strong>Citation Network</strong> — Explore which cases cite each other and trace the legal reasoning chain across Pakistani courts.</li>
  </ul>
  <h2>Jurisdictions Covered</h2>
  <p>The Supreme Bench of Pakistan, Lahore High Bench, Sindh High Bench, Peshawar High Bench, Islamabad judiciary, Balochistan judiciary, Federal Shariat appellate forum, district-level forums, and specialized tribunals.</p>
  <h2>Law Reports</h2>
  <p>PLD (Pakistan Legal Decisions), SCMR (Supreme Court Monthly Review), YLR (Yearly Law Reporter), MLD (Monthly Law Digest), CLC (Civil Law Cases), CLD (Corporate Law Decisions), PCrLJ (Pakistan Criminal Law Journal), and more.</p>
  <h2>How Al Wakeelo Works</h2>
  <p>Al Wakeelo uses Retrieval-Augmented Generation (RAG) technology to ground every response in verified Pakistani legal sources. When you ask a question, the AI searches our database of 600,000+ judgments and Pakistani statutes, retrieves relevant precedents, and constructs its answer using only verified citations. This eliminates the hallucination problem common in standard AI models.</p>
  <h2>Who Uses Al Wakeelo</h2>
  <p>Al Wakeelo serves practicing advocates across Pakistan, law firms and chambers in Karachi, Lahore, Islamabad, Peshawar, and Quetta, law students preparing for bar examinations and legal research, corporate legal departments needing contract drafting and compliance review, and citizens seeking to understand their rights under Pakistani law.</p>
  <h2>Pakistani Statutes Available</h2>
  <p>Search the full text of major Pakistani legislation: Constitution of Pakistan 1973, Pakistan Penal Code 1860 (PPC), Code of Criminal Procedure 1898 (CrPC), Code of Civil Procedure 1908 (CPC), Qanun-e-Shahadat Order 1984 (QSO), Contract Act 1872, Transfer of Property Act 1882, Specific Relief Act 1877, Muslim Family Laws Ordinance 1961, Prevention of Electronic Crimes Act 2016 (PECA), Companies Act 2017, and more.</p>
  <h2>AI-Powered Legal Drafting</h2>
  <p>Draft court-ready legal documents including writ petitions under Article 199 of the Constitution, bail applications (pre-arrest and post-arrest), civil suit plaints, legal notices, appeals, and stay applications. All drafts follow Pakistani judicial formatting standards with proper prayer clauses, statutory references, and verification statements. Contract drafting covers lease agreements, employment contracts, NDAs, partnership deeds, and sale agreements under the Contract Act 1872, Stamp Act 1899, and Registration Act 1908.</p>
</div>`,

    "/judgments": `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <h1>Pakistani Judgment Search — 600,000+ Cases</h1>
  <p>Search over 600,000 Pakistani judicial decisions from the Supreme Bench, provincial High Benches, the Federal Shariat forum, and special tribunals. Find case law by citation number, party name, jurisdiction, year, and legal keywords.</p>
  <h2>Search by Citation</h2>
  <p>Look up judgments by their official citation — PLD 2024 SC 100, 2023 SCMR 500, 2022 YLR 200, MLD, CLC, CLD, PCrLJ citations are all searchable across every reporting journal.</p>
  <h2>Search by Party Name</h2>
  <p>Find cases by petitioner or respondent name. Search for proceedings involving the State, Federation of Pakistan, Provincial Governments, NAB, FIA, or private parties.</p>
  <h2>Jurisdictions Covered</h2>
  <p>The Supreme Bench of Pakistan, Lahore High Bench, Sindh High Bench, Peshawar High Bench, Islamabad judiciary, Balochistan judiciary, and the Federal Shariat appellate forum.</p>
  <h2>Full Judgment Text</h2>
  <p>Read the complete text of each decision including headnotes, case summary, parties, decision date, and related citations. Every judgment links to the precedents it relies on and subsequent decisions that reference it.</p>
</div>`,

    "/judgments/browse": `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <h1>Browse Pakistani Case Law &amp; Judgments Directory</h1>
  <p>Browse our directory of 600,000+ Pakistani judicial decisions organized by jurisdiction, year, and law journal. Find cases from the Supreme Bench, all five provincial High Benches, and the Federal Shariat appellate forum.</p>
  <h2>Browse by Jurisdiction</h2>
  <p>Select any Pakistani judicial body to browse its decisions chronologically — the apex bench, regional High Benches, the Shariat appellate forum, and specialized tribunals.</p>
  <h2>Browse by Year</h2>
  <p>Navigate decisions by year from 1947 to present. Find landmark rulings and recent precedents across every tier of the Pakistani judiciary.</p>
  <h2>Browse by Law Journal</h2>
  <p>PLD (Pakistan Legal Decisions), SCMR (Supreme Monthly Review), YLR (Yearly Law Reporter), MLD (Monthly Law Digest), CLC (Civil Law Cases), CLD (Corporate Law Decisions), PCrLJ (Pakistan Criminal Law Journal).</p>
</div>`,

    "/statute-search": `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <h1>Pakistani Statute Search — Constitution, PPC, CPC, CrPC, Family Laws</h1>
  <p>Search Pakistani statutes by name, section number, or keyword. Access the full text of every major Pakistani law including the Constitution, criminal codes, civil procedure, family law, and commercial legislation.</p>
  <h2>Major Statutes Available</h2>
  <ul>
    <li><strong>Constitution of Pakistan, 1973</strong> — Fundamental rights, governance structure, and constitutional provisions.</li>
    <li><strong>Pakistan Penal Code, 1860 (PPC)</strong> — Criminal offences, punishments, and definitions under Pakistani criminal law.</li>
    <li><strong>Code of Criminal Procedure, 1898 (CrPC)</strong> — Criminal court procedures, bail, arrest, investigation, and trial procedures.</li>
    <li><strong>Code of Civil Procedure, 1908 (CPC)</strong> — Civil court procedures, suits, appeals, execution of decrees.</li>
    <li><strong>Qanun-e-Shahadat Order, 1984 (QSO)</strong> — Law of evidence applicable in Pakistani courts.</li>
    <li><strong>Muslim Family Laws Ordinance, 1961</strong> — Marriage registration, divorce, maintenance, and inheritance for Muslim families.</li>
    <li><strong>Contract Act, 1872</strong> — Formation, performance, and breach of contracts.</li>
    <li><strong>Transfer of Property Act, 1882</strong> — Sale, mortgage, lease, gift, and exchange of property.</li>
    <li><strong>Specific Relief Act, 1877</strong> — Injunctions, specific performance, declaratory decrees.</li>
  </ul>
</div>`,

    "/al-wakeelo": `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <h1>Al Wakeelo Engine — Pakistani Legal AI Chat</h1>
  <p>Chat with Al Wakeelo, Pakistan's AI legal assistant. Ask questions about Pakistani statutes, judgments, court procedures, and legal rights. Al Wakeelo provides answers grounded in verified case law citations from 600,000+ Pakistani judgments.</p>
  <h2>What You Can Ask</h2>
  <ul>
    <li>Questions about Pakistani criminal law — bail, FIR, arrest, quashment, acquittal, PPC sections</li>
    <li>Civil matters — property disputes, contracts, injunctions, declaratory suits, partition, pre-emption</li>
    <li>Family law — divorce (khula, talaq), maintenance (nafaqa), custody, dower (mehr), guardianship</li>
    <li>Constitutional rights — fundamental rights, writ petitions, habeas corpus, Article 199</li>
    <li>Labour and employment law — termination, gratuity, service disputes, NIRC</li>
    <li>Tax and revenue matters — income tax, sales tax, customs, FBR appeals</li>
    <li>Banking and financial law — recovery suits, banking courts, negotiable instruments</li>
  </ul>
  <h2>How It Works</h2>
  <p>Al Wakeelo uses retrieval-augmented generation (RAG) to search verified Pakistani judgments and statutes before answering. Every citation is verified against our database of 600,000+ cases. Responses include exact case citations (PLD, SCMR, YLR, MLD) and statute sections you can click to read the full text.</p>
</div>`,

    "/legal-drafting": `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <h1>Legal Drafting — Court-Ready Petitions &amp; Applications</h1>
  <p>Draft writ petitions, bail applications, appeals, legal notices, and court documents under Pakistani law. Al Wakeelo's AI-assisted legal drafting generates court-ready documents with verified case law citations and proper Pakistani judicial formatting.</p>
  <h2>Document Types</h2>
  <ul>
    <li><strong>Writ Petitions</strong> — Under Article 199 of the Constitution for High Court jurisdiction.</li>
    <li><strong>Bail Applications</strong> — Pre-arrest bail, post-arrest bail, and bail confirmation applications.</li>
    <li><strong>Criminal Appeals</strong> — Appeals against conviction, sentence, and acquittal.</li>
    <li><strong>Civil Suits</strong> — Suits for declaration, injunction, specific performance, and possession.</li>
    <li><strong>Legal Notices</strong> — Demand notices, eviction notices, and statutory notices under Pakistani law.</li>
    <li><strong>Applications</strong> — Stay applications, transfer applications, and miscellaneous court applications.</li>
  </ul>
  <h2>Pakistani Court Formatting</h2>
  <p>All drafts follow Pakistani judicial formatting standards with proper prayer clauses, section references, case law citations, and verification statements required by Pakistani courts.</p>
</div>`,

    "/contract-drafting": `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <h1>Contract Drafting — Pakistani Contract Act 1872</h1>
  <p>Draft legally compliant contracts under Pakistani law. Al Wakeelo generates rental agreements, employment contracts, sale agreements, partnership deeds, and more — all compliant with the Contract Act 1872 and relevant Pakistani legislation.</p>
  <h2>Contract Types</h2>
  <ul>
    <li><strong>Rental &amp; Lease Agreements</strong> — Residential and commercial tenancy agreements with rent escalation, security deposit, and eviction clauses.</li>
    <li><strong>Employment Contracts</strong> — Employment agreements with probation, termination, gratuity, and non-compete clauses.</li>
    <li><strong>Sale Agreements</strong> — Property sale agreements, vehicle sale agreements, and business sale agreements.</li>
    <li><strong>Partnership Deeds</strong> — Partnership agreements with profit sharing, dissolution, and dispute resolution clauses.</li>
    <li><strong>Service Agreements</strong> — Consulting, freelance, and professional service contracts.</li>
    <li><strong>Non-Disclosure Agreements</strong> — Confidentiality agreements for business and legal matters.</li>
  </ul>
  <h2>Legal Compliance</h2>
  <p>All contracts reference applicable Pakistani statutes including the Contract Act 1872, Stamp Act 1899, Registration Act 1908, and Arbitration Act 1940.</p>
</div>`,

    "/citation-search": `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <h1>Citation Search — Pakistani Case Law</h1>
  <p>Look up Pakistani case law by citation. Search PLD, SCMR, CLC, MLD, YLR, CLD, PCrLJ, and other Pakistani law report citations. Find the full text of any cited judgment instantly.</p>
  <h2>Supported Citation Formats</h2>
  <p>PLD 2024 Supreme Court 100, 2023 SCMR 500, 2022 YLR 200, 2021 MLD 1500, 2020 CLC 300, PCrLJ 2023 Lahore 800, and all standard Pakistani law report citation formats.</p>
  <h2>Citation Network</h2>
  <p>See which cases cite a given judgment and which judgments it relies on. Trace legal reasoning chains across Pakistani courts.</p>
</div>`,

    "/install": `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <h1>Install Al Wakeelo on iPhone, Android, or Desktop</h1>
  <p>Install Al Wakeelo as a Progressive Web App (PWA) on your device. Get instant access to Pakistan's AI legal assistant without downloading from an app store. Works on iPhone, Android, Windows, and macOS.</p>
  <h2>Installation Guides</h2>
  <ul>
    <li><strong>iPhone / iPad</strong> — Open Al Wakeelo in Safari, tap the Share button, and select "Add to Home Screen."</li>
    <li><strong>Android</strong> — Open Al Wakeelo in Chrome, tap the three-dot menu, and select "Add to Home Screen" or "Install App."</li>
    <li><strong>Windows / macOS</strong> — Open Al Wakeelo in Chrome or Edge, click the install icon in the address bar, and confirm installation.</li>
  </ul>
</div>`,

    "/privacy": `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <h1>Privacy Policy — Al Wakeelo</h1>
  <p>How Al Wakeelo collects, uses, and protects your data. This privacy policy covers account information, AI chat history, document uploads, search history, and your rights as a user in Pakistan.</p>
  <p>Al Wakeelo is committed to protecting your privacy and complying with applicable Pakistani data protection laws. We use industry-standard security measures to protect your personal and legal data.</p>
</div>`,

    "/terms": `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <h1>Terms of Service — Al Wakeelo</h1>
  <p>Al Wakeelo terms of service covering acceptable use, AI output disclaimer, subscription terms, and legal notices for users in Pakistan. By using Al Wakeelo, you agree to these terms.</p>
  <p>Al Wakeelo provides AI-generated legal information and drafting suggestions. AI outputs are not binding legal advice. Users should consult a licensed attorney for official legal representation in Pakistani courts.</p>
</div>`,

    "/cancellation-return-refund-policy": `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <h1>Cancellation, Return &amp; Refund Policy — Al Wakeelo</h1>
  <p>Al Wakeelo subscription cancellation, return, and refund policy. Learn about billing cycle handling, refund eligibility, pro-rated refunds, and how to cancel your Al Wakeelo subscription plan.</p>
  <p>Since Al Wakeelo provides digital services, AI responses, and document processing, physical returns do not apply. Refund requests are evaluated on a case-by-case basis.</p>
</div>`,

    "/ownership-statement": `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <h1>Ownership Statement — Al Wakeelo</h1>
  <p>Al Wakeelo ownership and operator information. Company details, registration, and the team behind Pakistan's AI legal assistant. Al Wakeelo is a product focused on making Pakistani legal research accessible through artificial intelligence.</p>
</div>`,

    "/about": `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <h1>About Al Wakeelo</h1>
  <p>Al Wakeelo is Pakistan's premier AI legal assistant workspace. Our mission is to make justice and legal knowledge accessible to all citizens, advocates, and chambers in Pakistan using advanced artificial intelligence.</p>
  <p>Operated by Majnoon Studio, Al Wakeelo brings together a database of over 600,000 court judgments, federal and provincial statutes, and case-intake logs in a single secure platform.</p>
  
  <h2>Mission and Vision</h2>
  <p>Our vision is to revolutionize the legal landscape of Pakistan by democratizing access to case law and statutory information. We believe that empowering legal professionals with cutting-edge AI tools will significantly reduce the time spent on manual research, allowing advocates to focus on strategy, argumentation, and client advocacy. We are committed to transparency, accuracy, and providing an unbiased, reliable legal assistant that acts as a digital co-counsel for every legal practitioner.</p>
  
  <h2>The Technology</h2>
  <p>At the core of Al Wakeelo is our advanced Retrieval-Augmented Generation (RAG) pipeline. Traditional AI models often suffer from "hallucinations"—inventing fake case laws or sections. Al Wakeelo solves this by explicitly searching our proprietary database of over 600,000 verified Pakistani court judgments and statutes before generating an answer. Every legal principle or citation provided by our engine is grounded in actual judicial precedents from the Supreme Court, High Courts, and Federal Shariat Court, ensuring unparalleled accuracy and reliability for our users.</p>
  
  <h2>The Team</h2>
  <p>Al Wakeelo is built and maintained by Majnoon Studio, a dedicated team of engineers, legal researchers, and data scientists. We work closely with practicing advocates and legal experts in Pakistan to ensure our platform meets the rigorous demands of court-ready drafting and profound legal analysis. Our team continuously updates our legal databases and refines our AI models to stay current with the latest jurisprudence and amendments in Pakistani law.</p>

  <h2>Our Core Values</h2>
  <ul>
    <li><strong>Accuracy and Grounding</strong> — We verify citations against real judgments to eliminate hallucinations.</li>
    <li><strong>Privacy First</strong> — Your queries, chat history, and files are protected with industry-standard encryption and access controls.</li>
    <li><strong>Empowering Advocates</strong> — We build tools that genuinely accelerate research, drafting, and case preparation for legal professionals across the nation.</li>
  </ul>
</div>`,

    "/contact": `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <h1>Contact Al Wakeelo</h1>
  <p>Have questions, need technical support, or want to explore enterprise solutions for your law firm? Reach out to Al Wakeelo and the dedicated team at Majnoon Studio. We are here to assist you with platform navigation, subscription inquiries, and providing demonstrations of our AI capabilities.</p>
  
  <h2>Support Channels</h2>
  <p>We offer multiple ways to get in touch with our support and sales teams to ensure you receive timely assistance.</p>
  <ul>
    <li><strong>Email Support:</strong> Send us an email at support@alwakeelo.com. We typically respond to all technical support and billing inquiries within 24 hours.</li>
    <li><strong>Phone / WhatsApp:</strong> For urgent queries or to speak with a representative directly, you can reach us at 00923358341897.</li>
    <li><strong>In-App Chat:</strong> Registered users can utilize the built-in feedback and support features directly from the Al Wakeelo dashboard.</li>
  </ul>
  
  <h2>Business Hours</h2>
  <p>Our support team is available during standard business hours to assist you with any questions or issues you may encounter while using the platform.</p>
  <ul>
    <li>Monday to Friday: 9:00 AM - 5:00 PM (PKT)</li>
    <li>Saturday & Sunday: Closed (System maintenance and automated support only)</li>
  </ul>
  
  <h2>Office Location & Consultations</h2>
  <p>Al Wakeelo is operated by Majnoon Studio. While our platform is fully digital and accessible online from anywhere in Pakistan, we do arrange virtual meetings and professional chamber consultations for law firms looking to integrate our AI solutions into their existing workflows. Please contact us via email or WhatsApp to schedule a dedicated session with our implementation team.</p>

  <p>For immediate assistance with common queries, you can also check our comprehensive FAQ section or submit your messages directly using the contact form on our web application.</p>
</div>`,

    "/faq": `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <h1>Frequently Asked Questions (FAQ)</h1>
  <p>Answers to common questions about Al Wakeelo, Pakistan's AI legal assistant.</p>
  <h2>General FAQ</h2>
  <h3>What is Al Wakeelo?</h3>
  <p>Al Wakeelo is an AI-powered legal assistant designed to search Pakistani judgments, statutes, and help draft petitions, contracts, and legal documents.</p>
  <h3>Can Al Wakeelo give binding legal advice?</h3>
  <p>No, Al Wakeelo provides research assistance. All official representation and binding advice must be obtained from a licensed advocate.</p>
  <h3>How many judgments are in the database?</h3>
  <p>We index over 600,000 Pakistani judgments from 1947 to present day, including Supreme Court, High Courts, and Federal Shariat Court decisions.</p>
</div>`,

    "/blog": `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <h1>Al Wakeelo Legal Guides &amp; Blog</h1>
  <p>Read comprehensive legal guides and articles written by advocates and legal experts on Pakistani law. Learn about your rights, legal procedures, and contract requirements under Pakistani legislation.</p>
  <h2>Available Guides</h2>
  <ul>
    <li>Guide to Muslim Family Laws in Pakistan: Nikah, Talaq, and Khula</li>
    <li>Understanding Bail and Criminal Procedure under Pakistani CrPC</li>
    <li>The Contract Act 1872: Essentials of Business Agreements in Pakistan</li>
    <li>Cybercrime and Digital Media Laws in Pakistan: A Practical Guide to PECA 2016</li>
    <li>Demystifying Pakistani Land Revenue Records: Fard, Khasra, and Mutation (Intaqal)</li>
    <li>How to File a Civil Suit in Pakistan: A Step-by-Step Guide</li>
    <li>Section 489-F PPC: The Law on Dishonoured Cheques in Pakistan</li>
    <li>Inheritance Rights and Islamic Succession Law in Pakistan</li>
    <li>Consumer Protection Laws in Pakistan: Filing Complaints and Claiming Compensation</li>
    <li>How to Register a Trademark in Pakistan</li>
    <li>Writ Petitions and Article 199 of the Constitution of Pakistan</li>
    <li>Rent and Tenancy Laws in Pakistan: Tenant Rights and Eviction Procedures</li>
    <li>Labor and Employment Rights in Pakistan: A Comprehensive Legal Guide</li>
    <li>Power of Attorney in Pakistan: Types, Registration, and Legal Requirements</li>
    <li>Understanding Property Transfer as Gift (Hiba) under Pakistani Law</li>
    <li>Defamation Laws in Pakistan: Civil vs. Criminal Remedies and Defenses</li>
    <li>A Complete Guide to FIR in Pakistan: Registration, Remedies, and Quashment</li>
    <li>Company Registration in Pakistan: Step-by-Step SECP Guide</li>
    <li>Understanding ADR and Arbitration under Pakistan's Arbitration Act 1940</li>
    <li>Legal Document Automation for Law Firms: 2026 Guide</li>
    <li>Top 4 Best Legal AI Tools Alternatives in 2026</li>
    <li>Lease Agreement in Pakistan: Complete Legal Drafting Guide & Format</li>
    <li>Affidavit Format in Pakistan: Writing Guide & Standard Templates</li>
    <li>Power of Attorney Drafting Guide: Legal Requirements in Pakistan</li>
    <li>AI for Legal Drafting: Transforming Pakistani Law Chambers</li>
    <li>Best Legal Drafting AI Tools for Lawyers in 2026</li>
    <li>Top Alternatives to LexisNexis for Legal Research in Pakistan</li>
    <li>Harvey AI Alternatives: Best Legal GenAI Platforms for Law Firms</li>
    <li>Non-Disclosure Agreement (NDA) in Pakistan: Drafting Guide & Templates</li>
    <li>Legal Drafting in Pakistan: Rules, Forms, and Pleading Standards</li>
    <li>How to Draft a Legal Notice in Pakistan: Format & Templates</li>
    <li>Partnership Deed Drafting Guide under Partnership Act 1932</li>
    <li>Free Legal Drafting Templates for Pakistani Lawyers</li>
    <li>Best Legal Drafting Software for Law Firms in 2026</li>
    <li>How to Write a Case Brief: Guide for Pakistani Law Students & Advocates</li>
    <li>Top Legal AI Platforms in 2026: Comprehensive Review</li>
    <li>Vakalatnama Drafting Guide: Legal Representation in Pakistan</li>
    <li>How to Conduct Constitutional Law Research in Pakistan</li>
    <li>Legal Workflow Automation: Streamlining Law Firm Operations</li>
    <li>Contract Review Checklist: 10 Clauses Every Lawyer Must Check</li>
    <li>Legal Prompt Engineering: How to Guide AI for Precise Drafting</li>
  </ul>
</div>`,
  };

  // ── Statute pre-rendering (DB lookup, same pattern as judgments) ────────
  async function getStatuteSeoData(id: string): Promise<{ meta: SeoMeta; preRenderBlock: string } | undefined> {
    const now = Date.now();
    const cacheKey = `statute-${id}`;
    const cached = seoCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return { meta: cached.meta, preRenderBlock: cached.preRenderBlock };
    }

    if (seoActiveQueries >= SEO_MAX_CONCURRENT) return undefined;

    try {
      const numId = Number(id);
      if (!Number.isInteger(numId) || numId < 1) return undefined;

      seoActiveQueries++;
      const queryPromise = db
        .select({
          title: statuteDocuments.title,
          content: statuteDocuments.content,
          category: statuteDocuments.category,
        })
        .from(statuteDocuments)
        .where(eq(statuteDocuments.id, numId))
        .limit(1);

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SEO query timeout")), SEO_QUERY_TIMEOUT_MS)
      );

      const [row] = await Promise.race([queryPromise, timeoutPromise]) as any[];
      seoActiveQueries = Math.max(0, seoActiveQueries - 1);

      if (row) {
        const title = row.title ? String(row.title).trim() : "Pakistani Statute";
        const category = row.category ? String(row.category).trim() : "general";
        const rawContent = row.content ? String(row.content).trim() : "";
        const contentExcerpt = rawContent.length > 2000
          ? rawContent.slice(0, 2000).replace(/\s+\S*$/, "") + "…"
          : rawContent;

        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

        const schema = {
          "@context": "https://schema.org",
          "@type": "Legislation",
          "name": title,
          "legislationType": category,
          "jurisdiction": "Pakistan",
        };
        const schemaMarkup = `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;

        const meta: SeoMeta = {
          title: `${title} — Full Text | Al Wakeelo`,
          description: `Read the full text of ${title} on Al Wakeelo. Pakistani statute with sections, schedules, and amendments. AI-powered search and analysis.`,
          index: true,
          schemaMarkup,
        };

        const preRenderBlock = `<div id="seo-prerender" style="display:none" aria-hidden="true">
  <h1>${esc(title)}</h1>
  <p><strong>Category:</strong> ${esc(category)}</p>
  <p><strong>Jurisdiction:</strong> Pakistan</p>
  <div><h2>Statute Text</h2><p>${esc(contentExcerpt)}</p></div>
  <p><em>Read the full statute on <a href="https://www.alwakeelo.com/statute-view/${id}">Al Wakeelo</a> — Pakistan's AI-powered legal research platform.</em></p>
</div>`;

        setSeoCache(cacheKey, { meta, preRenderBlock, expiresAt: now + CACHE_TTL_MS });
        return { meta, preRenderBlock };
      }
    } catch (err: any) {
      seoActiveQueries = Math.max(0, seoActiveQueries - 1);
      if (err?.message !== "SEO query timeout") {
        console.error(`[SEO Meta] Failed dynamic lookup for statute ${id}:`, err);
      }
    }
    return undefined;
  }

  async function sendIndexWithSeo(req: express.Request, res: express.Response, statusCode = 200): Promise<void> {
    // Express 5 with `app.use("/{*path}")` mounts the handler with the wildcard
    // as the mount path, so `req.path` returns the residual ("/") rather than
    // the full request path. Use originalUrl (minus query) to get the real
    // route — this is what crawlers actually requested.
    const raw = req.originalUrl || req.url || req.path || "/";
    const pathname = raw.split("?")[0] || "/";

    let customMeta: SeoMeta | undefined;
    let preRenderBlock: string | undefined;
    let notFound = false;

    // Dynamic judgment pages — DB lookup for per-judgment SEO
    const judgmentMatch = pathname.match(/^\/judgment\/([^/]+)$/);
    if (judgmentMatch) {
      const judgmentId = judgmentMatch[1];
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(judgmentId);
      if (!isUuid) {
        notFound = true;
      } else {
        const seoData = await getJudgmentSeoData(judgmentId);
        if (seoData) {
          customMeta = seoData.meta;
          preRenderBlock = seoData.preRenderBlock;
        } else {
          // Serve fallback 200 shell instead of dropping to 404 during crawl bursts
          customMeta = {
            title: "Pakistani Case Law & Judgments | Al Wakeelo",
            description: "Read full text Pakistani court judgments, legal precedents, and verified citations on Al Wakeelo — Pakistan's AI legal assistant.",
            index: true,
          };
          preRenderBlock = `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <h1>Pakistani Case Law &amp; Judgments — Al Wakeelo</h1>
  <p>Search over 600,000 Pakistani judgments from the Supreme Court, High Courts, and Federal Shariat Court on Al Wakeelo.</p>
  <p><a href="/judgments">Browse All Judgments</a> | <a href="/judgments/browse">Judgments Directory</a> | <a href="/">Home</a></p>
</div>`;
        }
      }
    }

    // Dynamic statute pages — DB lookup for per-statute SEO
    const statuteMatch = pathname.match(/^\/statute-view\/([^/]+)$/);
    if (statuteMatch && !preRenderBlock) {
      const statuteId = statuteMatch[1];
      const seoData = await getStatuteSeoData(statuteId);
      if (seoData) {
        customMeta = seoData.meta;
        preRenderBlock = seoData.preRenderBlock;
      }
    }

    // Dynamic blog articles — SEO pre-rendering from shared blog data
    const blogMatch = pathname.match(/^\/blog\/([^/]+)$/);
    if (blogMatch && !preRenderBlock) {
      const slug = blogMatch[1];
      const article = BLOG_ARTICLES.find((a) => a.slug === slug);
      if (article) {
        const wordCount = article.content.split(/\s+/).length;
        const schema = {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "headline": article.title,
          "description": article.summary,
          "datePublished": article.publishedAt,
          "dateModified": article.publishedAt,
          "genre": article.category,
          "keywords": article.category,
          "wordCount": wordCount,
          "url": `https://www.alwakeelo.com/blog/${article.slug}`,
          "mainEntityOfPage": `https://www.alwakeelo.com/blog/${article.slug}`,
          "image": "https://www.alwakeelo.com/icon-512.png",
          "author": {
            "@type": "Organization",
            "name": "Al Wakeelo Legal Team",
            "url": "https://www.alwakeelo.com/about"
          },
          "publisher": {
            "@type": "Organization",
            "name": "Al Wakeelo",
            "url": "https://www.alwakeelo.com",
            "logo": {
              "@type": "ImageObject",
              "url": "https://www.alwakeelo.com/icon-512.png"
            }
          }
        };
        const breadcrumb = {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.alwakeelo.com" },
            { "@type": "ListItem", "position": 2, "name": "Legal Guides", "item": "https://www.alwakeelo.com/blog" },
            { "@type": "ListItem", "position": 3, "name": article.title, "item": `https://www.alwakeelo.com/blog/${article.slug}` }
          ]
        };
        const schemaMarkup = `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>\n<script type="application/ld+json">\n${JSON.stringify(breadcrumb, null, 2)}\n</script>`;
        customMeta = {
          title: `${article.title} | Al Wakeelo Legal Guides`,
          description: article.summary,
          index: true,
          schemaMarkup,
        };
        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        preRenderBlock = `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <h1>${esc(article.title)}</h1>
  <p><strong>Category:</strong> ${esc(article.category)}</p>
  <p><strong>Published:</strong> ${esc(article.publishedAt)}</p>
  <p><strong>Read Time:</strong> ${esc(article.readTime)}</p>
  <div>${esc(article.content)}</div>
</div>`;
      } else {
        notFound = true;
      }
    }

    // Static pages — use pre-built prerender blocks
    const normalizedPath = pathname !== "/" ? pathname.replace(/\/+$/, "") || "/" : "/";
    if (!preRenderBlock && STATIC_PRERENDER[normalizedPath]) {
      preRenderBlock = STATIC_PRERENDER[normalizedPath];
    }

    let html = injectSeoMeta(indexHtmlTemplate, pathname, customMeta);

    // Inject pre-rendered body block so crawlers can index real text
    // without needing JavaScript to render the React SPA.
    if (preRenderBlock) {
      html = html.replace("</body>", `${preRenderBlock}\n</body>`);
    }

    // Return 404 for judgment pages that don't exist — prevents Google's
    // "Soft 404" classification where pages return 200 but have no content.
    const finalStatus = notFound ? 404 : statusCode;

    res.setHeader("Cache-Control", HTML_CACHE_HEADER);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(finalStatus).send(html);
  }

  const wordAddinDistPath = path.resolve(process.cwd(), "word-addin/dist");
  if (fs.existsSync(wordAddinDistPath)) {
    console.log(`[Static] Serving MS Word Add-in static files at /word-addin from ${wordAddinDistPath}`);
    app.use("/word-addin", express.static(wordAddinDistPath, {
      etag: true,
      maxAge: "7d",
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", HTML_CACHE_HEADER);
        } else {
          res.setHeader("Cache-Control", "public, max-age=604800, immutable");
        }
      }
    }));
  }

  app.use(express.static(distPath, {
    etag: true,
    maxAge: "7d",
    // Don't let express.static serve index.html itself — we want every HTML
    // response (including "/") to flow through sendIndexWithSeo so SEO meta
    // is injected. Static middleware still serves /assets, /favicon.png, etc.
    index: false,
    setHeaders: (res, filePath) => {
      const isHtml = filePath.endsWith(".html");
      if (isHtml) {
        // Browser must revalidate, but Cloudflare may serve the HTML from its
        // edge for up to 5 min. Cuts TTFB for global visitors and bot crawls
        // without serving stale auth state to authenticated users (auth state
        // is established client-side after the shell loads).
        res.setHeader("Cache-Control", HTML_CACHE_HEADER);
      } else {
        res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      }
    },
  }));

  // ── Server-side 301 redirects for legacy URLs ──────────────────────────
  // These are old URLs that still get crawled. A proper 301 tells Google
  // to consolidate link equity to the canonical URL and stops the
  // "Duplicate, Google chose different canonical" warning.
  const LEGACY_REDIRECTS: Array<[RegExp, string]> = [
    [/^\/judgment-search$/, "/judgments"],
  ];

  for (const [pattern, target] of LEGACY_REDIRECTS) {
    app.get(pattern, (req, res) => {
      const qs = req.originalUrl.split("?")[1];
      res.redirect(301, qs ? `${target}?${qs}` : target);
    });
  }

  // SPA shell with per-route SEO meta injection.
  app.use("/{*path}", async (req, res) => {
    const pathname = req.path || "/";
    const method = (req.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      return res.status(404).end();
    }

    if (pathname.startsWith("/api/")) {
      return res.status(404).end();
    }

    const normalizedPath = pathname !== "/"
      ? pathname.replace(/\/+$/, "") || "/"
      : "/";

    if (isKnownSpaRoute(normalizedPath)) {
      // For judgment pages, use the judgmentNotFound flag from sendIndexWithSeo
      // to return 404 instead of 200 for non-existent judgments
      await sendIndexWithSeo(req, res, 200);
      return;
    }

    const wantsHtml = (req.get("accept") || "").includes("text/html");
    if (wantsHtml) {
      await sendIndexWithSeo(req, res, 404);
      return;
    }
    res.status(404).end();
  });
}
