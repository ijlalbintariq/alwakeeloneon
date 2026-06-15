import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { injectSeoMeta, type SeoMeta } from "./seo-meta";
import { db } from "./db";
import { judgments, statuteDocuments } from "@shared/schema";
import { eq } from "drizzle-orm";

const KNOWN_SPA_ROUTES: RegExp[] = [
  /^\/$/,
  /^\/auth$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
  /^\/share\/[^/]+$/,
  /^\/privacy$/,
  /^\/terms$/,
  /^\/cancellation-return-refund-policy$/,
  /^\/ownership-statement$/,
  /^\/install$/,
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

        const schema = {
          "@context": "https://schema.org",
          "@type": "CourtCase",
          "name": title,
          "identifier": citation,
          "caseNumber": citation,
          "court": {
            "@type": "GovernmentOrganization",
            "name": courtName
          },
          ...(decisionDateStr ? { "datePublished": decisionDateStr } : {})
        };
        const schemaMarkup = `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;

        const meta: SeoMeta = {
          title: `${title}${citation ? ` (${citation})` : ""} | Al Wakeelo`,
          description: `Read the full case law: ${title}${citation ? `, ${citation}` : ""} on Al Wakeelo — Pakistan's AI legal assistant. Full judgment text, court, and citations.`,
          index: true,
          schemaMarkup,
        };

        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const petitioner = row.petitioner ? String(row.petitioner).trim() : "";
        const respondent = row.respondent ? String(row.respondent).trim() : "";
        const headnotes = row.headnotes ? String(row.headnotes).trim() : "";
        const rawFullText = row.fullText ? String(row.fullText).trim() : "";
        // Take first ~1500 chars of judgment text for the prerender block
        const fullTextExcerpt = rawFullText.length > 1500
          ? rawFullText.slice(0, 1500).replace(/\s+\S*$/, "") + "…"
          : rawFullText;
        const partiesLine = petitioner && respondent
          ? `<p><strong>Parties:</strong> ${esc(petitioner)} vs ${esc(respondent)}</p>`
          : petitioner
            ? `<p><strong>Petitioner:</strong> ${esc(petitioner)}</p>`
            : "";
        const headnotesBlock = headnotes
          ? `<div><h2>Headnotes</h2><p>${esc(headnotes.slice(0, 2000))}</p></div>`
          : "";
        const textBlock = fullTextExcerpt
          ? `<div><h2>Judgment Text</h2><p>${esc(fullTextExcerpt)}</p></div>`
          : "";

        // Visible prerender block — Google can see and index this content.
        // React will replace it when the SPA mounts via #root.
        const preRenderBlock = `<div id="seo-prerender" style="padding:20px;max-width:800px;margin:0 auto;font-family:serif;color:#333">
  <h1>${esc(title)}${citation ? ` — ${esc(citation)}` : ""}</h1>
  ${citation ? `<p><strong>Citation:</strong> ${esc(citation)}</p>` : ""}
  <p><strong>Court:</strong> ${esc(courtName)}</p>
  ${yearStr ? `<p><strong>Year:</strong> ${esc(yearStr)}</p>` : ""}
  ${decisionDateStr ? `<p><strong>Decision Date:</strong> ${esc(decisionDateStr)}</p>` : ""}
  ${partiesLine}
  ${headnotesBlock}
  ${textBlock}
  <p><em>Read the full judgment on <a href="https://www.alwakeelo.com/judgment/${id}">Al Wakeelo</a> — Pakistan's AI-powered legal research platform.</em></p>
</div>`;

        seoCache.set(id, { meta, preRenderBlock, expiresAt: now + CACHE_TTL_MS });
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
    "/": `<div id="seo-prerender" style="display:none" aria-hidden="true">
  <h1>Al Wakeelo — Pakistan's AI-Powered Legal Assistant</h1>
  <p>Al Wakeelo is Pakistan's first AI legal assistant, built for lawyers, law students, and anyone navigating Pakistani law. Search over 600,000 judgments from the Supreme Court of Pakistan, Lahore High Court, Sindh High Court, Peshawar High Court, Islamabad High Court, Balochistan High Court, and Federal Shariat Court.</p>
  <h2>Features</h2>
  <ul>
    <li><strong>Judgment Search</strong> — Search 600,000+ Pakistani judgments by citation, party name, court, year, and keyword. Includes PLD, SCMR, YLR, MLD, CLD, CLC, PCrLJ law reports.</li>
    <li><strong>AI Legal Chat</strong> — Ask questions about Pakistani law and receive answers grounded in verified case law and statutes. Al Wakeelo cites real judgments and sections.</li>
    <li><strong>Legal Drafting</strong> — AI-assisted drafting of court-ready writ petitions, bail applications, and legal notices under Pakistani procedural law.</li>
    <li><strong>Contract Drafting</strong> — Draft rental agreements, employment contracts, sale agreements, and partnership deeds compliant with the Contract Act 1872.</li>
    <li><strong>Statute Search</strong> — Search the Constitution of Pakistan, Pakistan Penal Code (PPC), Code of Criminal Procedure (CrPC), Code of Civil Procedure (CPC), Qanun-e-Shahadat Order, Family Laws, and more.</li>
    <li><strong>Citation Network</strong> — Explore which cases cite each other and trace the legal reasoning chain across Pakistani courts.</li>
  </ul>
  <h2>Courts Covered</h2>
  <p>Supreme Court of Pakistan, Lahore High Court, Sindh High Court, Peshawar High Court, Islamabad High Court, Balochistan High Court, Federal Shariat Court, District Courts, and Tribunals.</p>
  <h2>Law Reports</h2>
  <p>PLD (Pakistan Legal Decisions), SCMR (Supreme Court Monthly Review), YLR (Yearly Law Reporter), MLD (Monthly Law Digest), CLC (Civil Law Cases), CLD (Corporate Law Decisions), PCrLJ (Pakistan Criminal Law Journal), and more.</p>
</div>`,

    "/judgments": `<div id="seo-prerender" style="display:none" aria-hidden="true">
  <h1>Pakistani Judgment Search — 600,000+ Cases</h1>
  <p>Search over 600,000 Pakistani court judgments from the Supreme Court, High Courts, Federal Shariat Court, and Tribunals. Find case law by citation number, party name, court, year, and legal keywords.</p>
  <h2>Search by Citation</h2>
  <p>Look up judgments by their official citation — PLD 2024 Supreme Court 100, 2023 SCMR 500, 2022 YLR 200, MLD, CLC, CLD, PCrLJ citations are all searchable.</p>
  <h2>Search by Party Name</h2>
  <p>Find cases by petitioner or respondent name. Search for cases involving the State, Federation of Pakistan, Provincial Governments, NAB, FIA, or private parties.</p>
  <h2>Courts Available</h2>
  <p>Supreme Court of Pakistan, Lahore High Court, Sindh High Court, Peshawar High Court, Islamabad High Court, Balochistan High Court, Federal Shariat Court.</p>
  <h2>Full Judgment Text</h2>
  <p>Read the complete text of each judgment including headnotes, case summary, parties, decision date, and related citations. Each judgment links to other cases it cites and cases that cite it.</p>
</div>`,

    "/judgments/browse": `<div id="seo-prerender" style="display:none" aria-hidden="true">
  <h1>Browse Pakistani Case Law &amp; Judgments Directory</h1>
  <p>Browse our directory of 600,000+ Pakistani judgments organized by court, year, and law journal. Find cases from the Supreme Court of Pakistan, Lahore High Court, Sindh High Court, Peshawar High Court, Islamabad High Court, and Balochistan High Court.</p>
  <h2>Browse by Court</h2>
  <p>Select any Pakistani court to browse its judgments chronologically — Supreme Court, High Courts, Federal Shariat Court, and Tribunals.</p>
  <h2>Browse by Year</h2>
  <p>Navigate judgments by year from 1947 to present. Find landmark cases and recent decisions.</p>
  <h2>Browse by Law Journal</h2>
  <p>PLD (Pakistan Legal Decisions), SCMR (Supreme Court Monthly Review), YLR (Yearly Law Reporter), MLD (Monthly Law Digest), CLC (Civil Law Cases), CLD (Corporate Law Decisions), PCrLJ (Pakistan Criminal Law Journal).</p>
</div>`,

    "/statute-search": `<div id="seo-prerender" style="display:none" aria-hidden="true">
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

    "/al-wakeelo": `<div id="seo-prerender" style="display:none" aria-hidden="true">
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

    "/legal-drafting": `<div id="seo-prerender" style="display:none" aria-hidden="true">
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

    "/contract-drafting": `<div id="seo-prerender" style="display:none" aria-hidden="true">
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

    "/citation-search": `<div id="seo-prerender" style="display:none" aria-hidden="true">
  <h1>Citation Search — Pakistani Case Law</h1>
  <p>Look up Pakistani case law by citation. Search PLD, SCMR, CLC, MLD, YLR, CLD, PCrLJ, and other Pakistani law report citations. Find the full text of any cited judgment instantly.</p>
  <h2>Supported Citation Formats</h2>
  <p>PLD 2024 Supreme Court 100, 2023 SCMR 500, 2022 YLR 200, 2021 MLD 1500, 2020 CLC 300, PCrLJ 2023 Lahore 800, and all standard Pakistani law report citation formats.</p>
  <h2>Citation Network</h2>
  <p>See which cases cite a given judgment and which judgments it relies on. Trace legal reasoning chains across Pakistani courts.</p>
</div>`,

    "/install": `<div id="seo-prerender" style="display:none" aria-hidden="true">
  <h1>Install Al Wakeelo on iPhone, Android, or Desktop</h1>
  <p>Install Al Wakeelo as a Progressive Web App (PWA) on your device. Get instant access to Pakistan's AI legal assistant without downloading from an app store. Works on iPhone, Android, Windows, and macOS.</p>
  <h2>Installation Guides</h2>
  <ul>
    <li><strong>iPhone / iPad</strong> — Open Al Wakeelo in Safari, tap the Share button, and select "Add to Home Screen."</li>
    <li><strong>Android</strong> — Open Al Wakeelo in Chrome, tap the three-dot menu, and select "Add to Home Screen" or "Install App."</li>
    <li><strong>Windows / macOS</strong> — Open Al Wakeelo in Chrome or Edge, click the install icon in the address bar, and confirm installation.</li>
  </ul>
</div>`,

    "/privacy": `<div id="seo-prerender" style="display:none" aria-hidden="true">
  <h1>Privacy Policy — Al Wakeelo</h1>
  <p>How Al Wakeelo collects, uses, and protects your data. This privacy policy covers account information, AI chat history, document uploads, search history, and your rights as a user in Pakistan.</p>
  <p>Al Wakeelo is committed to protecting your privacy and complying with applicable Pakistani data protection laws. We use industry-standard security measures to protect your personal and legal data.</p>
</div>`,

    "/terms": `<div id="seo-prerender" style="display:none" aria-hidden="true">
  <h1>Terms of Service — Al Wakeelo</h1>
  <p>Al Wakeelo terms of service covering acceptable use, AI output disclaimer, subscription terms, and legal notices for users in Pakistan. By using Al Wakeelo, you agree to these terms.</p>
  <p>Al Wakeelo provides AI-generated legal information and drafting suggestions. AI outputs are not binding legal advice. Users should consult a licensed attorney for official legal representation in Pakistani courts.</p>
</div>`,

    "/cancellation-return-refund-policy": `<div id="seo-prerender" style="display:none" aria-hidden="true">
  <h1>Cancellation, Return &amp; Refund Policy — Al Wakeelo</h1>
  <p>Al Wakeelo subscription cancellation, return, and refund policy. Learn about billing cycle handling, refund eligibility, pro-rated refunds, and how to cancel your Al Wakeelo subscription plan.</p>
  <p>Since Al Wakeelo provides digital services, AI responses, and document processing, physical returns do not apply. Refund requests are evaluated on a case-by-case basis.</p>
</div>`,

    "/ownership-statement": `<div id="seo-prerender" style="display:none" aria-hidden="true">
  <h1>Ownership Statement — Al Wakeelo</h1>
  <p>Al Wakeelo ownership and operator information. Company details, registration, and the team behind Pakistan's AI legal assistant. Al Wakeelo is a product focused on making Pakistani legal research accessible through artificial intelligence.</p>
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

        seoCache.set(cacheKey, { meta, preRenderBlock, expiresAt: now + CACHE_TTL_MS });
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
          notFound = true;
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
