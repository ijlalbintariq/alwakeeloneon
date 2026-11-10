import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { injectSeoMeta, lookupSeoMeta, type SeoMeta } from "./seo-meta";
import { db } from "./db";
import { judgments, statuteDocuments, courtsRef } from "@shared/schema";
import { prepareJudgmentDetail, resolveJudgment } from "./citation-verify";
import { eq, sql } from "drizzle-orm";
import { BLOG_ARTICLES } from "../shared/blog-data";
import { judgmentCitationHref, PAKISTANI_CITATION_REGEX } from "../shared/judgment-links";
import { canonicalPublicPath, judgmentDirectoryPath } from "../shared/public-routes";
import { getIndexableJudgmentIds, indexableJudgmentCandidateFilter } from "./judgment-indexability";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BLOG_REVIEW_NOTICE, BLOG_RESEARCH_SOURCES, blogReadMinutes } from "../shared/blog-editorial";
import { getPublicJudgmentDirectory } from "./judgment-directory";

export function renderPublicMarkdown(content: string): string {
  // The article template already supplies the title. Raw HTML stays disabled.
  const body = content.replace(/^#\s+[^\n]*(?:\r?\n|$)/, "");
  return renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], skipHtml: true }, body));
}

export function serializeJsonLd(value: object): string {
  return JSON.stringify(value, null, 2).replace(/</g, "\\u003c");
}

export const KNOWN_SPA_ROUTES: RegExp[] = [
  /^\/$/,
  /^\/landing$/,
  /^\/pricing$/,
  /^\/install-app$/,
  /^\/refund-policy$/,
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
  /^\/judgments\/[^/]+$/,
  /^\/statute-search$/,
  /^\/statute-view\/[^/]+$/,
  /^\/statutes$/,
  /^\/judges$/,
  /^\/judges\/[^/]+$/,
  /^\/most-cited$/,
  /^\/precedents$/,
  /^\/court-fee-calculator$/,
  /^\/preview(\/.*)?$/,
  /^\/al-wakeelo$/,
  /^\/legal-drafting$/,
  /^\/contract-drafting$/,
  /^\/contracts$/,
  /^\/cases(\/.*)?$/,
  /^\/case-files$/,
  /^\/case-documents$/,
  /^\/diary$/,
  /^\/daily-diary$/,
  /^\/tax-return$/,
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

export function isKnownSpaRoute(pathname: string): boolean {
  return KNOWN_SPA_ROUTES.some((pattern) => pattern.test(pathname));
}

export function linkifyCitationsInHtml(escapedText: string, citationMap?: Map<string, string>): string {
  if (!escapedText) return "";
  return escapedText.replace(PAKISTANI_CITATION_REGEX, (match) => {
    const targetUrl = judgmentCitationHref(match, citationMap);

    return `<a href="${targetUrl}" class="citation-internal-link" style="color:#1d4ed8;text-decoration:underline;font-weight:500;">${match}</a>`;
  });
}

const HTML_CACHE_HEADER = "public, max-age=0, must-revalidate, s-maxage=300";

export function serveStatic(app: Express) {
  const baseDir = typeof __dirname !== "undefined"
    ? __dirname
    : path.resolve(process.cwd(), "server");
  const distPath = fs.existsSync(path.resolve(baseDir, "public"))
    ? path.resolve(baseDir, "public")
    : (fs.existsSync(path.resolve(process.cwd(), "dist/public"))
        ? path.resolve(process.cwd(), "dist/public")
        : path.resolve(baseDir, "public"));
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Read index.html once at startup so per-request SEO meta injection is
  // a pure string-replace (no disk I/O per crawl).
  const indexHtmlPath = path.resolve(distPath, "index.html");
  const indexHtmlTemplate = fs.readFileSync(indexHtmlPath, "utf8");

  // Statute metadata is cached; judgment pages always read current identity.
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

  async function getJudgmentSeoData(id: string): Promise<{ meta: SeoMeta; preRenderBlock: string } | { canonicalId: string } | undefined> {
    function parseBenchJudges(bench: string | null | undefined): Array<{ "@type": "Person"; name: string; jobTitle?: string }> {
      if (!bench || typeof bench !== "string") return [];
      const clean = bench.trim();
      if (!clean) return [];

      const rawParts = clean.split(/\s*;\s*|\r?\n|\s+and\s+/i);
      const judges: Array<{ name: string; title: string }> = [];

      for (const part of rawParts) {
        const commaParts = part.split(/\s*,\s*/);
        let currentJudge = "";
        let currentTitle = "Judge";

        for (let i = 0; i < commaParts.length; i++) {
          const token = commaParts[i].trim();
          if (!token) continue;

          if (/^(?:C\.?J\.?|Chief Justice|J\.?|Judge|Senior Puisne Judge)$/i.test(token)) {
            if (currentJudge) {
              currentTitle = /C\.?J\.?|Chief Justice/i.test(token) ? "Chief Justice" : "Judge";
            }
          } else {
            if (currentJudge) {
              judges.push({ name: currentJudge, title: currentTitle });
              currentTitle = "Judge";
            }
            currentJudge = token;
            if (/Chief Justice/i.test(token) || /\bC\.?J\.?\b/i.test(token)) {
              currentTitle = "Chief Justice";
            }
          }
        }
        if (currentJudge) {
          judges.push({ name: currentJudge, title: currentTitle });
        }
      }

      return judges.map((j) => ({
        "@type": "Person" as const,
        name: j.name,
        jobTitle: j.title,
      }));
    }

    // Read current identity on each request; repairs can happen outside this process.

    // A temporary backend failure must not turn a valid page into a noindex page.
    if (!db || seoActiveQueries >= SEO_MAX_CONCURRENT) {
      throw new Error("SEO lookup temporarily unavailable");
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return undefined;
    seoActiveQueries++;
    try {
      const queryPromise = db
        .select({
          canonicalJudgmentId: judgments.canonicalJudgmentId,
          isActive: judgments.isActive,
          courtId: judgments.courtId,
          title: judgments.title,
          citationString: judgments.citationString,
          courtNameSnapshot: sql<string>`coalesce(${courtsRef.name},${judgments.courtNameSnapshot},'')`,
          decisionDate: judgments.decisionDate,
          petitioner: judgments.petitioner,
          respondent: judgments.respondent,
          bench: judgments.bench,
          headnotes: judgments.headnotes,
          fullText: judgments.fullText,
          pdfUrl: judgments.pdfUrl,
          textStatus: judgments.textStatus,
          textTrueCitation: judgments.textTrueCitation,
        })
        .from(judgments)
        .leftJoin(courtsRef, eq(judgments.courtId, courtsRef.id))
        .where(eq(judgments.id, id))
        .limit(1);

      // Race against a timeout — don't let SEO lookups stall forever
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("SEO query timeout")), SEO_QUERY_TIMEOUT_MS);
      });
      const [row] = await Promise.race([queryPromise, timeoutPromise]).finally(() => clearTimeout(timer)) as any[];

      if (row) {
        if (row.canonicalJudgmentId) {
          if (row.isActive !== false || row.canonicalJudgmentId === id) return undefined;
          const owners = await getIndexableJudgmentIds([row.canonicalJudgmentId]);
          return owners.has(row.canonicalJudgmentId) ? { canonicalId: row.canonicalJudgmentId } : undefined;
        }
        if (row.isActive === false) return undefined;
        const safe = prepareJudgmentDetail({
          id, citation: row.citationString || "", title: row.title || "", court: row.courtNameSnapshot || "",
          fullText: row.fullText || "", pdfUrl: row.pdfUrl, petitioner: row.petitioner,
          respondent: row.respondent, decisionDate: row.decisionDate, headnotes: row.headnotes,
        }, { opening: row.fullText, textStatus: row.textStatus, textTrueCitation: row.textTrueCitation });
        const own = safe.textIntegrity === "own";
        const cleanTitle = own ? safe.title : "Judgment identity unverified";

        const citation = row.citationString ? String(row.citationString).trim() : "";
        const courtName = own ? safe.court || "Court not recorded" : "Court identity unverified";
        const decisionDateStr = own && safe.decisionDate ? new Date(safe.decisionDate).toISOString().slice(0, 10) : "";
        const yearStr = decisionDateStr ? decisionDateStr.slice(0, 4) : "";
        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const petitioner = own && safe.petitioner ? String(safe.petitioner).trim() : "";
        const respondent = own && safe.respondent ? String(safe.respondent).trim() : "";
        const rawFullText: string = own ? safe.fullText : "";
        const courtDirectoryPath = row.courtId ? `/judgments/browse?courtId=${row.courtId}` : "/judgments/browse";

        const pageTitle = citation
          ? `${citation}: ${cleanTitle} — ${courtName} | Al Wakeelo`
          : `${cleanTitle} — ${courtName} | Al Wakeelo`;

        const pageDescription = !own ? `Case identity for ${citation || "this record"} is unverified. Inspect available sources in the judgment reader.` : citation
          ? `Read Pakistani case law ${citation}: ${cleanTitle} decided by ${courtName}. Full text, ratio decidendi, and citations on Al Wakeelo.`
          : `Read Pakistani case law: ${cleanTitle} decided by ${courtName}. Full text, legal holding, and citations on Al Wakeelo.`;

        const benchStr = row.bench ? String(row.bench).trim() : "";
        const benchAuthors = parseBenchJudges(benchStr);
        const articleAuthors = benchAuthors.length > 0
          ? benchAuthors
          : [{ "@type": "Person" as const, "name": courtName || "Superior Judiciary of Pakistan", "jobTitle": "Judge" }];

        const journalMatch = citation ? citation.match(/\b([A-Z]{3,6})\b/) : null;
        const journalCode = journalMatch ? journalMatch[1] : "PLD";

        // Schema markup: LegalArticle + CourtCase + BreadcrumbList in unified @graph
        const schema = {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "LegalArticle",
              "@id": `https://www.alwakeelo.com/judgment/${id}#article`,
              "isPartOf": {
                "@type": "Periodical",
                "name": "Pakistan Law Reports",
                "issn": journalCode
              },
              "headline": pageTitle,
              ...(citation ? { "alternativeHeadline": citation } : {}),
              "name": cleanTitle,
              "description": pageDescription,
              "inLanguage": "en",
              "mainEntityOfPage": `https://www.alwakeelo.com/judgment/${id}`,
              "url": `https://www.alwakeelo.com/judgment/${id}`,
              ...(decisionDateStr ? { "datePublished": decisionDateStr } : {}),
              "author": articleAuthors,
              "publisher": {
                "@type": "Organization",
                "@id": "https://www.alwakeelo.com/#organization",
                "name": "Alwakeelo AI",
                "url": "https://www.alwakeelo.com/"
              },
              "about": {
                "@id": `https://www.alwakeelo.com/judgment/${id}#courtcase`
              },
              ...(safe.headnotes ? { "articleBody": safe.headnotes.slice(0, 3000) } : {})
            },
            {
              "@type": "CourtCase",
              "@id": `https://www.alwakeelo.com/judgment/${id}#courtcase`,
              "name": cleanTitle,
              "identifier": citation || id,
              "caseNumber": citation || id,
              "headline": pageTitle,
              "court": {
                "@type": "GovernmentOrganization",
                "name": courtName,
                "address": {
                  "@type": "PostalAddress",
                  "addressCountry": "PK"
                }
              },
              "inLanguage": "en",
              "isAccessibleForFree": true,
              "about": [
                { "@type": "Thing", "name": "Pakistani Case Law" },
                { "@type": "Thing", "name": "Judicial Precedent" }
              ],
              ...(decisionDateStr ? { "datePublished": decisionDateStr } : {}),
              ...((petitioner || respondent) ? {
                "party": [
                  ...(petitioner ? [{ "@type": "Person" as const, "name": petitioner, "roleName": "Petitioner / Appellant" }] : []),
                  ...(respondent ? [{ "@type": "GovernmentOrganization" as const, "name": respondent, "roleName": "Respondent" }] : [])
                ]
              } : {})
            },
            {
              "@type": "BreadcrumbList",
              "@id": `https://www.alwakeelo.com/judgment/${id}#breadcrumbs`,
              "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.alwakeelo.com/" },
                { "@type": "ListItem", "position": 2, "name": "Judgments", "item": "https://www.alwakeelo.com/judgments" },
                { "@type": "ListItem", "position": 3, "name": courtName, "item": `https://www.alwakeelo.com${courtDirectoryPath}` },
                { "@type": "ListItem", "position": 4, "name": citation || cleanTitle, "item": `https://www.alwakeelo.com/judgment/${id}` }
              ]
            }
          ]
        };
        
        const schemaMarkup = own ? `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2).replace(/</g, "\\u003c")}\n</script>` : "";

        const meta: SeoMeta = {
          title: pageTitle,
          description: pageDescription,
          index: own,
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
              .map(p => `<p style="margin-bottom:14px;line-height:1.75;font-size:15px;color:#1e293b;">${linkifyCitationsInHtml(esc(p))}</p>`)
              .join("\n")
          : `<p>${esc(safe.textWarning || "Judgment identity remains unverified. Inspect available sources in the judgment reader.")}</p>`;

        const partiesLine = petitioner && respondent
          ? `<p style="font-size:14px;color:#475569;margin-bottom:12px;"><strong>Petitioner:</strong> ${esc(petitioner)} <span style="margin:0 8px;">VS</span> <strong>Respondent:</strong> ${esc(respondent)}</p>`
          : "";

        // Visible prerender block styled identically to Alwakeelo's Tailwind tokens
        const preRenderBlock = `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <nav aria-label="Breadcrumb" style="margin-bottom:20px;font-size:13px;color:#64748b;font-weight:500;">
    <a href="/" style="color:#475569;text-decoration:none;">Home</a> &nbsp;/&nbsp; 
    <a href="/judgments" style="color:#475569;text-decoration:none;">Judgments</a> &nbsp;/&nbsp; 
    <a href="${courtDirectoryPath}" style="color:#475569;text-decoration:none;">${esc(courtName)}</a>
    ${yearStr ? ` &nbsp;/&nbsp; <a href="/judgments/browse?year=${encodeURIComponent(yearStr)}" style="color:#475569;text-decoration:none;">${esc(yearStr)}</a>` : ''} &nbsp;/&nbsp; 
    <span style="color:#0f172a;">${esc(citation || cleanTitle)}</span>
  </nav>

  <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:22px 28px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
    ${citation ? `<span style="display:inline-block;padding:4px 12px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:600;color:#1e40af;margin-bottom:14px;">${esc(citation)}</span>` : ""}
    <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">${esc(cleanTitle)}</h1>
    
    ${partiesLine}
    
    <div style="display:flex;flex-wrap:wrap;gap:16px;font-size:14px;color:#64748b;margin-bottom:8px;">
      <span><strong>Court:</strong> <a href="${courtDirectoryPath}" style="color:#1e40af;text-decoration:none;">${esc(courtName)}</a></span>
      ${decisionDateStr ? `<span><strong>Decision Date:</strong> ${esc(decisionDateStr)}</span>` : ""}
    </div>
  </div>

  <section style="margin:28px 0;padding:24px 28px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
    <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin-top:0;margin-bottom:20px;">Full Judgment Text &amp; Judicial Ruling</h2>
    ${formattedParagraphs}
    ${isTruncated ? `<p style="font-style:italic;color:#64748b;margin-top:20px;padding-top:16px;border-top:1px dashed #cbd5e1;">Read the unabridged text and precedent citation network on <a href="https://www.alwakeelo.com/judgment/${id}" style="color:#b45309;text-decoration:none;font-weight:600;">Al Wakeelo Legal Research Platform</a>.</p>` : ''}
  </section>

  <section style="margin-top:36px;padding:20px 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;font-size:14px;color:#334155;">
    <h3 style="font-family:'Playfair Display',serif;font-size:16px;color:#0f172a;margin-top:0;margin-bottom:12px;">Related Legal Research &amp; Directories</h3>
    <ul style="line-height:2.0;margin:0;padding-left:20px;">
      <li>Browse all judgments from <a href="${courtDirectoryPath}" style="color:#1e40af;text-decoration:none;font-weight:500;">${esc(courtName)}</a></li>
      ${yearStr ? `<li>Browse Pakistani court decisions from the year <a href="/judgments/browse?year=${encodeURIComponent(yearStr)}" style="color:#1e40af;text-decoration:none;font-weight:500;">${esc(yearStr)}</a></li>` : ''}
      <li>Search Pakistani statutes: <a href="/statute-search" style="color:#1e40af;text-decoration:none;font-weight:500;">Constitution of Pakistan 1973, PPC, CrPC, CPC &amp; Family Laws</a></li>
      <li>Analyze this case with <a href="/al-wakeelo" style="color:#1e40af;text-decoration:none;font-weight:500;">Al Wakeelo AI Legal Assistant</a></li>
    </ul>
  </section>
</div>`;

        return { meta, preRenderBlock };
      }
    } finally {
      seoActiveQueries = Math.max(0, seoActiveQueries - 1);
    }
    return undefined;
  }

  // ── Static page pre-render blocks ────────────────────────────────────────
  // Visible initial content for readers and crawlers before the client mounts.
  const STATIC_PRERENDER: Record<string, string> = {
    "/pricing": `<main id="seo-prerender" style="padding:24px;max-width:880px;margin:auto;line-height:1.6;">
      <h1>Al Wakeelo plans and pricing</h1>
      <p>Compare plans for Pakistani legal research, AI-assisted drafting and chambers. Plans differ in AI usage limits, model access and document uploads.</p>
      <p>Check the current price, billing cycle and included limits in the plan selector before subscribing. AI output still requires professional review.</p>
      <a href="/#pricing">View current plan options</a>
    </main>`,
    "/": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Alwakeelo AI — Pakistan's AI-Powered Legal Assistant</h1>
  <p>Alwakeelo AI is a Pakistan-focused AI legal assistant, built for lawyers, law students, and anyone navigating Pakistani law. Search Pakistani judgments from the Supreme Court of Pakistan, Lahore High Court, Sindh High Court, Peshawar High Court, Islamabad High Court, Balochistan High Court, and Federal Shariat Court.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Features</h2>
  <ul>
    <li><strong>Judgment Search</strong> — Search Pakistani judgments by citation, party name, court, year, and keyword. Includes PLD, SCMR, YLR, MLD, CLD, CLC, PCrLJ law reports.</li>
    <li><strong>AI Legal Chat</strong> — Ask questions about Pakistani law and receive answers grounded in verified case law and statutes. Al Wakeelo cites real judgments and sections.</li>
    <li><strong>Legal Drafting</strong> — AI-assisted drafting of court-ready writ petitions, bail applications, and legal notices under Pakistani procedural law.</li>
    <li><strong>Contract Drafting</strong> — Draft rental agreements, employment contracts, sale agreements, and partnership deeds compliant with the Contract Act 1872.</li>
    <li><strong>Statute Search</strong> — Search the Constitution of Pakistan, Pakistan Penal Code (PPC), Code of Criminal Procedure (CrPC), Code of Civil Procedure (CPC), Qanun-e-Shahadat Order, Family Laws, and more.</li>
    <li><strong>Citation Network</strong> — Explore which cases cite each other and trace the legal reasoning chain across Pakistani courts.</li>
  </ul>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Jurisdictions Covered</h2>
  <p>The Supreme Bench of Pakistan, Lahore High Bench, Sindh High Bench, Peshawar High Bench, Islamabad judiciary, Balochistan judiciary, Federal Shariat appellate forum, district-level forums, and specialized tribunals.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Law Reports</h2>
  <p>PLD (Pakistan Legal Decisions), SCMR (Supreme Court Monthly Review), YLR (Yearly Law Reporter), MLD (Monthly Law Digest), CLC (Civil Law Cases), CLD (Corporate Law Decisions), PCrLJ (Pakistan Criminal Law Journal), and more.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">How Al Wakeelo Works</h2>
  <p>Al Wakeelo uses Retrieval-Augmented Generation (RAG) technology to ground every response in verified Pakistani legal sources. When you ask a question, the AI searches our database of Pakistani judgments and Pakistani statutes, retrieves relevant precedents, and constructs its answer using only verified citations. Identity checks help reduce unsupported citations; users must still verify original judgments.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Who Uses Al Wakeelo</h2>
  <p>Al Wakeelo serves practicing advocates across Pakistan, law firms and chambers in Karachi, Lahore, Islamabad, Peshawar, and Quetta, law students preparing for bar examinations and legal research, corporate legal departments needing contract drafting and compliance review, and citizens seeking to understand their rights under Pakistani law.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Pakistani Statutes Available</h2>
  <p>Search the full text of major Pakistani legislation: Constitution of Pakistan 1973, Pakistan Penal Code 1860 (PPC), Code of Criminal Procedure 1898 (CrPC), Code of Civil Procedure 1908 (CPC), Qanun-e-Shahadat Order 1984 (QSO), Contract Act 1872, Transfer of Property Act 1882, Specific Relief Act 1877, Muslim Family Laws Ordinance 1961, Prevention of Electronic Crimes Act 2016 (PECA), Companies Act 2017, and more.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">AI-Powered Legal Drafting</h2>
  <p>Draft court-ready legal documents including writ petitions under Article 199 of the Constitution, bail applications (pre-arrest and post-arrest), civil suit plaints, legal notices, appeals, and stay applications. All drafts follow Pakistani judicial formatting standards with proper prayer clauses, statutory references, and verification statements. Contract drafting covers lease agreements, employment contracts, NDAs, partnership deeds, and sale agreements under the Contract Act 1872, Stamp Act 1899, and Registration Act 1908.</p>
</div>`,

    "/judgments": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Pakistani Judgment Search — Pakistani Cases</h1>
  <p>Search Pakistani judgments from the Supreme Bench, provincial High Benches, the Federal Shariat forum, and special tribunals. Find case law by citation number, party name, jurisdiction, year, and legal keywords.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Search by Citation</h2>
  <p>Look up judgments by their official citation — PLD 2024 SC 100, 2023 SCMR 500, 2022 YLR 200, MLD, CLC, CLD, PCrLJ citations are all searchable across every reporting journal.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Search by Party Name</h2>
  <p>Find cases by petitioner or respondent name. Search for proceedings involving the State, Federation of Pakistan, Provincial Governments, NAB, FIA, or private parties.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Jurisdictions Covered</h2>
  <p>The Supreme Bench of Pakistan, Lahore High Bench, Sindh High Bench, Peshawar High Bench, Islamabad judiciary, Balochistan judiciary, and the Federal Shariat appellate forum.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Full Judgment Text</h2>
  <p>Read the complete text of each decision including headnotes, case summary, parties, decision date, and related citations. Every judgment links to the precedents it relies on and subsequent decisions that reference it.</p>
</div>`,

    "/judgments/browse": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Browse Pakistani Case Law &amp; Judgments Directory</h1>
  <p>Browse our directory of Pakistani judgments organized by jurisdiction, year, and law journal. Find cases from the Supreme Bench, all five provincial High Benches, and the Federal Shariat appellate forum.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Browse by Jurisdiction</h2>
  <p>Select any Pakistani judicial body to browse its decisions chronologically — the apex bench, regional High Benches, the Shariat appellate forum, and specialized tribunals.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Browse by Year</h2>
  <p>Navigate decisions by year from 1947 to present. Find landmark rulings and recent precedents across every tier of the Pakistani judiciary.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Browse by Law Journal</h2>
  <p>PLD (Pakistan Legal Decisions), SCMR (Supreme Monthly Review), YLR (Yearly Law Reporter), MLD (Monthly Law Digest), CLC (Civil Law Cases), CLD (Corporate Law Decisions), PCrLJ (Pakistan Criminal Law Journal).</p>
</div>`,

    "/statute-search": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Pakistani Statute Search — Constitution, PPC, CPC, CrPC, Family Laws</h1>
  <p>Search Pakistani statutes by name, section number, or keyword. Access the full text of every major Pakistani law including the Constitution, criminal codes, civil procedure, family law, and commercial legislation.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Major Statutes Available</h2>
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

    "/al-wakeelo": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Al Wakeelo Engine — Pakistani Legal AI Chat</h1>
  <p>Chat with Al Wakeelo, Pakistan's AI legal assistant. Ask questions about Pakistani statutes, judgments, court procedures, and legal rights. Al Wakeelo provides answers grounded in verified case law citations from Pakistani judgments.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">What You Can Ask</h2>
  <ul>
    <li>Questions about Pakistani criminal law — bail, FIR, arrest, quashment, acquittal, PPC sections</li>
    <li>Civil matters — property disputes, contracts, injunctions, declaratory suits, partition, pre-emption</li>
    <li>Family law — divorce (khula, talaq), maintenance (nafaqa), custody, dower (mehr), guardianship</li>
    <li>Constitutional rights — fundamental rights, writ petitions, habeas corpus, Article 199</li>
    <li>Labour and employment law — termination, gratuity, service disputes, NIRC</li>
    <li>Tax and revenue matters — income tax, sales tax, customs, FBR appeals</li>
    <li>Banking and financial law — recovery suits, banking courts, negotiable instruments</li>
  </ul>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">How It Works</h2>
  <p>Al Wakeelo uses retrieval-augmented generation (RAG) to search verified Pakistani judgments and statutes before answering. Case identities are checked against available judgment headers; a matching database record does not independently authenticate a judgment. Responses include exact case citations (PLD, SCMR, YLR, MLD) and statute sections you can click to read the full text.</p>
</div>`,

    "/legal-drafting": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Legal Drafting — Court-Ready Petitions &amp; Applications</h1>
  <p>Draft writ petitions, bail applications, appeals, legal notices, and court documents under Pakistani law. Al Wakeelo's AI-assisted legal drafting generates court-ready documents with verified case law citations and proper Pakistani judicial formatting.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Document Types</h2>
  <ul>
    <li><strong>Writ Petitions</strong> — Under Article 199 of the Constitution for High Court jurisdiction.</li>
    <li><strong>Bail Applications</strong> — Pre-arrest bail, post-arrest bail, and bail confirmation applications.</li>
    <li><strong>Criminal Appeals</strong> — Appeals against conviction, sentence, and acquittal.</li>
    <li><strong>Civil Suits</strong> — Suits for declaration, injunction, specific performance, and possession.</li>
    <li><strong>Legal Notices</strong> — Demand notices, eviction notices, and statutory notices under Pakistani law.</li>
    <li><strong>Applications</strong> — Stay applications, transfer applications, and miscellaneous court applications.</li>
  </ul>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Pakistani Court Formatting</h2>
  <p>All drafts follow Pakistani judicial formatting standards with proper prayer clauses, section references, case law citations, and verification statements required by Pakistani courts.</p>
</div>`,

    "/contract-drafting": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Contract Drafting — Pakistani Contract Act 1872</h1>
  <p>Draft legally compliant contracts under Pakistani law. Al Wakeelo generates rental agreements, employment contracts, sale agreements, partnership deeds, and more — all compliant with the Contract Act 1872 and relevant Pakistani legislation.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Contract Types</h2>
  <ul>
    <li><strong>Rental &amp; Lease Agreements</strong> — Residential and commercial tenancy agreements with rent escalation, security deposit, and eviction clauses.</li>
    <li><strong>Employment Contracts</strong> — Employment agreements with probation, termination, gratuity, and non-compete clauses.</li>
    <li><strong>Sale Agreements</strong> — Property sale agreements, vehicle sale agreements, and business sale agreements.</li>
    <li><strong>Partnership Deeds</strong> — Partnership agreements with profit sharing, dissolution, and dispute resolution clauses.</li>
    <li><strong>Service Agreements</strong> — Consulting, freelance, and professional service contracts.</li>
    <li><strong>Non-Disclosure Agreements</strong> — Confidentiality agreements for business and legal matters.</li>
  </ul>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Legal Compliance</h2>
  <p>All contracts reference applicable Pakistani statutes including the Contract Act 1872, Stamp Act 1899, Registration Act 1908, and Arbitration Act 1940.</p>
</div>`,

    "/citation-search": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Citation Search — Pakistani Case Law</h1>
  <p>Look up Pakistani case law by citation. Search PLD, SCMR, CLC, MLD, YLR, CLD, PCrLJ, and other Pakistani law report citations. Find the full text of any cited judgment instantly.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Supported Citation Formats</h2>
  <p>PLD 2024 Supreme Court 100, 2023 SCMR 500, 2022 YLR 200, 2021 MLD 1500, 2020 CLC 300, PCrLJ 2023 Lahore 800, and all standard Pakistani law report citation formats.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Citation Network</h2>
  <p>See which cases cite a given judgment and which judgments it relies on. Trace legal reasoning chains across Pakistani courts.</p>
</div>`,

    "/install": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Install Al Wakeelo on iPhone, Android, or Desktop</h1>
  <p>Install Al Wakeelo as a Progressive Web App (PWA) on your device. Get instant access to Pakistan's AI legal assistant without downloading from an app store. Works on iPhone, Android, Windows, and macOS.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Installation Guides</h2>
  <ul>
    <li><strong>iPhone / iPad</strong> — Open Al Wakeelo in Safari, tap the Share button, and select "Add to Home Screen."</li>
    <li><strong>Android</strong> — Open Al Wakeelo in Chrome, tap the three-dot menu, and select "Add to Home Screen" or "Install App."</li>
    <li><strong>Windows / macOS</strong> — Open Al Wakeelo in Chrome or Edge, click the install icon in the address bar, and confirm installation.</li>
  </ul>
</div>`,

    "/privacy": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Privacy Policy — Al Wakeelo</h1>
  <p>How Al Wakeelo collects, uses, and protects your data. This privacy policy covers account information, AI chat history, document uploads, search history, and your rights as a user in Pakistan.</p>
  <p>Al Wakeelo is committed to protecting your privacy and complying with applicable Pakistani data protection laws. We use industry-standard security measures to protect your personal and legal data.</p>
</div>`,

    "/terms": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Terms of Service — Al Wakeelo</h1>
  <p>Al Wakeelo terms of service covering acceptable use, AI output disclaimer, subscription terms, and legal notices for users in Pakistan. By using Al Wakeelo, you agree to these terms.</p>
  <p>Al Wakeelo provides AI-generated legal information and drafting suggestions. AI outputs are not binding legal advice. Users should consult a licensed attorney for official legal representation in Pakistani courts.</p>
</div>`,

    "/cancellation-return-refund-policy": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Cancellation, Return &amp; Refund Policy — Al Wakeelo</h1>
  <p>Al Wakeelo subscription cancellation, return, and refund policy. Learn about billing cycle handling, refund eligibility, pro-rated refunds, and how to cancel your Al Wakeelo subscription plan.</p>
  <p>Since Al Wakeelo provides digital services, AI responses, and document processing, physical returns do not apply. Refund requests are evaluated on a case-by-case basis.</p>
</div>`,

    "/ownership-statement": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Ownership Statement — Al Wakeelo</h1>
  <p>Al Wakeelo ownership and operator information. Company details, registration, and the team behind Pakistan's AI legal assistant. Al Wakeelo is a product focused on making Pakistani legal research accessible through artificial intelligence.</p>
</div>`,

    "/about": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">About Al Wakeelo</h1>
  <p>Al Wakeelo is Pakistan's premier AI legal assistant workspace. Our mission is to make justice and legal knowledge accessible to all citizens, advocates, and chambers in Pakistan using advanced artificial intelligence.</p>
  <p>Operated by Majnoon Studio, Al Wakeelo brings together a database of Pakistani judgments, federal and provincial statutes, and case-intake logs in a single secure platform.</p>
  
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Mission and Vision</h2>
  <p>Our vision is to revolutionize the legal landscape of Pakistan by democratizing access to case law and statutory information. We believe that empowering legal professionals with cutting-edge AI tools will significantly reduce the time spent on manual research, allowing advocates to focus on strategy, argumentation, and client advocacy. We are committed to transparency, accuracy, and providing an unbiased, reliable legal assistant that acts as a digital co-counsel for every legal practitioner.</p>
  
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">The Technology</h2>
  <p>Al Wakeelo uses retrieval-augmented generation to retrieve Pakistani judgments and statutes before drafting an answer. Identity checks help detect contradictory case metadata and unsupported excerpts. These checks do not authenticate court sources or guarantee that an AI answer is accurate. Review the original judgment or legislation before relying on a legal proposition.</p>
  
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">The Team</h2>
  <p>Al Wakeelo is built and maintained by Majnoon Studio, a dedicated team of engineers, legal researchers, and data scientists. We work closely with practicing advocates and legal experts in Pakistan to ensure our platform meets the rigorous demands of court-ready drafting and profound legal analysis. Our team continuously updates our legal databases and refines our AI models to stay current with the latest jurisprudence and amendments in Pakistani law.</p>

  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Our Core Values</h2>
  <ul>
    <li><strong>Accuracy and Grounding</strong> — We check case identity and withhold unsupported citations. Independent source review is still required.</li>
    <li><strong>Privacy First</strong> — Your queries, chat history, and files are protected with industry-standard encryption and access controls.</li>
    <li><strong>Empowering Advocates</strong> — We build tools that genuinely accelerate research, drafting, and case preparation for legal professionals across the nation.</li>
  </ul>
</div>`,

    "/contact": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Contact Al Wakeelo</h1>
  <p>Have questions, need technical support, or want to explore enterprise solutions for your law firm? Reach out to Al Wakeelo and the dedicated team at Majnoon Studio. We are here to assist you with platform navigation, subscription inquiries, and providing demonstrations of our AI capabilities.</p>
  
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Support Channels</h2>
  <p>We offer multiple ways to get in touch with our support and sales teams to ensure you receive timely assistance.</p>
  <ul>
    <li><strong>Email Support:</strong> Send us an email at support@alwakeelo.com. We typically respond to all technical support and billing inquiries within 24 hours.</li>
    <li><strong>Phone / WhatsApp:</strong> For urgent queries or to speak with a representative directly, you can reach us at 00923358341897.</li>
    <li><strong>In-App Chat:</strong> Registered users can utilize the built-in feedback and support features directly from the Al Wakeelo dashboard.</li>
  </ul>
  
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Business Hours</h2>
  <p>Our support team is available during standard business hours to assist you with any questions or issues you may encounter while using the platform.</p>
  <ul>
    <li>Monday to Friday: 9:00 AM - 5:00 PM (PKT)</li>
    <li>Saturday & Sunday: Closed (System maintenance and automated support only)</li>
  </ul>
  
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Office Location & Consultations</h2>
  <p>Al Wakeelo is operated by Majnoon Studio. While our platform is fully digital and accessible online from anywhere in Pakistan, we do arrange virtual meetings and professional chamber consultations for law firms looking to integrate our AI solutions into their existing workflows. Please contact us via email or WhatsApp to schedule a dedicated session with our implementation team.</p>

  <p>For immediate assistance with common queries, you can also check our comprehensive FAQ section or submit your messages directly using the contact form on our web application.</p>
</div>`,

    "/faq": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Frequently Asked Questions (FAQ)</h1>
  <p>Answers to common questions about Al Wakeelo, Pakistan's AI legal assistant.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">General FAQ</h2>
  <h3>What is Al Wakeelo?</h3>
  <p>Al Wakeelo is an AI-powered legal assistant designed to search Pakistani judgments, statutes, and help draft petitions, contracts, and legal documents.</p>
  <h3>Can Al Wakeelo give binding legal advice?</h3>
  <p>No, Al Wakeelo provides research assistance. All official representation and binding advice must be obtained from a licensed advocate.</p>
  <h3>How many judgments are in the database?</h3>
  <p>We index Pakistani judgments from 1947 to present day, including Supreme Court, High Courts, and Federal Shariat Court decisions.</p>
</div>`,

    "/blog": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Al Wakeelo Legal Guides &amp; Blog</h1>
  <p>Read editorial guides on Pakistani law, with research starting points and clear review notices. Learn about your rights, legal procedures, and contract requirements under Pakistani legislation.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Available Guides</h2>
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

    "/court-fee-calculator": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Pakistani Court Fee &amp; Valuation Calculator</h1>
  <p>Free, instant court fee calculation utility under the Court Fees Act 1870 and Suits Valuation Act 1887. Automatically computes ad valorem schedules (7.5%), statutory provincial ceilings (Punjab, Sindh, Islamabad, KP, Balochistan), fixed court fees for High Court Constitutional Writs (Article 199), Family Court suits (Khula, Maintenance, Custody), civil appeals, and revisions.</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Supported Suit Categories</h2>
  <ul>
    <li><strong>Money Suits</strong> — 7.5% ad valorem on subject matter valuation over Rs. 25,000, subject to provincial statutory maximums.</li>
    <li><strong>Declaration with Consequential Relief</strong> — Valuation under Section 7(iv)(c) Court Fees Act 1870 and Section 8 Suits Valuation Act 1887.</li>
    <li><strong>High Court Writ Petitions</strong> — Article 199 Constitutional Petitions (fixed fee Rs. 500).</li>
    <li><strong>Family Court Proceedings</strong> — Fixed statutory fee Rs. 15 for suits under Family Courts Act 1964.</li>
    <li><strong>Bail Applications &amp; Criminal Appeals</strong> — Fixed fees and exemptions under Court Fees Act 1870.</li>
  </ul>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Court-Ready Valuation Paragraphs</h2>
  <p>Generates ready-to-paste valuation clauses formatted for plaints and petitions to eliminate office objections and court fee deficiencies.</p>
</div>`,

    "/most-cited": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Most Cited Pakistani Legal Precedents &amp; Landmark Case Law</h1>
  <p>Discover Pakistan's most influential judicial precedents from the Supreme Court and provincial High Courts. Ranked by citation frequency across Pakistani judgments, complete with judicial treatment history (Relied Upon, Distinguished, Overruled).</p>
  <h2 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0f172a;margin-top:24px;margin-bottom:12px;">Key Precedent Branches</h2>
  <ul>
    <li><strong>Constitutional Law</strong> — Landmark rulings on fundamental rights (Articles 9, 10A, 14, 199, 184(3)).</li>
    <li><strong>Criminal Law &amp; Procedure</strong> — Pre-arrest bail, circumstantial evidence, benefit of doubt, Section 497 CrPC principles.</li>
    <li><strong>Civil Procedure &amp; Property</strong> — Specific performance, temporary injunctions (Order XXXIX CPC), declaratory decrees.</li>
  </ul>
</div>`,

    "/precedents": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Pakistani Landmark Precedents &amp; Citation Network</h1>
  <p>Explore the relational precedent network of superior court rulings in Pakistan. Trace citation lineages, examine judicial treatments, and analyze binding ratios under Article 189 and Article 201 of the Constitution.</p>
</div>`,

    "/judges": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Pakistani Superior Court Judges Directory &amp; Bench Profiles</h1>
  <p>Comprehensive directory and analytical profiles of Supreme Court of Pakistan and High Court judges (Lahore, Sindh, Peshawar, Islamabad, Balochistan). Browse authored judgments, bench combinations, and leading legal precedents.</p>
</div>`,

    "/statutes": `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Digital Compendium of Pakistani Statutes &amp; Legislation</h1>
  <p>Access the full text of primary Pakistani legislation including Constitution of Pakistan 1973, Pakistan Penal Code 1860, Code of Criminal Procedure 1898, Code of Civil Procedure 1908, Qanun-e-Shahadat Order 1984, and Muslim Family Laws Ordinance 1961.</p>
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

    if (!db || seoActiveQueries >= SEO_MAX_CONCURRENT) throw new Error("SEO lookup temporarily unavailable");
    const numId = Number(id);
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(numId) || numId < 1) return undefined;
    seoActiveQueries++;
    try {
      const queryPromise = db
        .select({
          title: statuteDocuments.title,
          content: statuteDocuments.content,
          category: statuteDocuments.category,
        })
        .from(statuteDocuments)
        .where(eq(statuteDocuments.id, numId))
        .limit(1);

      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("SEO query timeout")), SEO_QUERY_TIMEOUT_MS);
      });
      const [row] = await Promise.race([queryPromise, timeoutPromise]).finally(() => clearTimeout(timer)) as any[];

      if (row) {
        const title = row.title ? String(row.title).trim() : "Pakistani Statute";
        const category = row.category ? String(row.category).trim() : "general";
        const rawContent = row.content ? String(row.content).trim() : "";
        const words = rawContent.match(/\S+\s*/g) || [];
        const contentExcerpt = words.slice(0, 1000).join("") + (words.length > 1000 ? "…" : "");

        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

        const schema = {
          "@context": "https://schema.org",
          "@type": "Legislation",
          "name": title,
          "legislationType": category,
          "jurisdiction": "Pakistan",
        };
        const schemaMarkup = `<script type="application/ld+json">\n${serializeJsonLd(schema)}\n</script>`;

        const meta: SeoMeta = {
          title: `${title} — Full Text | Al Wakeelo`,
          description: `Read the full text of ${title} on Al Wakeelo. Pakistani statute with sections, schedules, and amendments. AI-powered search and analysis.`,
          index: true,
          schemaMarkup,
        };

        const preRenderBlock = `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">${esc(title)}</h1>
  <p><strong>Category:</strong> ${esc(category)}</p>
  <p><strong>Jurisdiction:</strong> Pakistan</p>
  <div><h2>Statute text preview</h2>${renderPublicMarkdown(contentExcerpt)}</div>
  <p><em>Read the full statute on <a href="https://www.alwakeelo.com/statute-view/${id}">Al Wakeelo</a> — Pakistan's AI-powered legal research platform.</em></p>
</div>`;

        setSeoCache(cacheKey, { meta, preRenderBlock, expiresAt: now + CACHE_TTL_MS });
        return { meta, preRenderBlock };
      }
    } finally {
      seoActiveQueries = Math.max(0, seoActiveQueries - 1);
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

    const publicPath = canonicalPublicPath(pathname);
    if (publicPath !== pathname) {
      return void res.redirect(301, publicPath + (raw.includes("?") ? raw.slice(raw.indexOf("?")) : ""));
    }

    let customMeta: SeoMeta | undefined;
    let preRenderBlock: string | undefined;
    let notFound = false;

    if (pathname === "/judgments/browse") {
      try {
        const params = new URLSearchParams(raw.split("?")[1] || "");
        const directory = await getPublicJudgmentDirectory(params);
        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const link = (page: number) => {
          const query = new URLSearchParams(params);
          query.set("page", String(page));
          return judgmentDirectoryPath(query);
        };
        customMeta = { ...lookupSeoMeta(pathname), canonicalPath: link(directory.pagination.page) };
        preRenderBlock = `<main id="seo-prerender" style="padding:24px;max-width:880px;margin:auto;line-height:1.6;">
          <nav><a href="/">Home</a> · <a href="/judgments">Judgment search</a> · <a href="/blog">Legal guides</a></nav>
          <h1>Browse Pakistani judgments</h1>
          <p>Page ${directory.pagination.page}. Unconfirmed case identities are omitted.</p>
          <ul>${directory.items.map(row => `<li><a href="/judgment/${row.id}">${esc(row.citation)} — ${esc(row.title)}</a></li>`).join("")}</ul>
          ${directory.items.length ? "" : "<p>No confirmed cases on this page. Try another page or filter.</p>"}
          <nav aria-label="Judgment pages">${directory.pagination.page > 1 ? `<a rel="prev" href="${esc(link(directory.pagination.page - 1))}">Previous page</a>` : ""}
          ${directory.pagination.hasMore ? `<a rel="next" href="${esc(link(directory.pagination.page + 1))}">Next page</a>` : ""}</nav>
        </main>`;
      } catch (error) {
        res.setHeader("Cache-Control", "no-store");
        if (!(error instanceof RangeError)) res.setHeader("Retry-After", "30");
        res.status(error instanceof RangeError ? 400 : 503).send(error instanceof RangeError ? "Invalid directory filters" : "Directory temporarily unavailable. Please retry.");
        return;
      }
    }

    // Dynamic judgment pages — DB lookup for per-judgment SEO (supports both /judgment/:id and /judgments/:id)
    const judgmentMatch = pathname.match(/^\/judgments?\/([^/]+)$/);
    if (judgmentMatch && judgmentMatch[1] !== "browse") {
      const judgmentId = judgmentMatch[1];
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(judgmentId);
      if (!isUuid) {
        // Citation-slug resolution: AI models (ChatGPT, Perplexity) often know
        // the correct citation string but hallucinate the UUID portion of the
        // URL.  Resolve "2020-CLC-1910" or "2020 CLC 1910" to the real UUID
        // and 301-redirect so the canonical URL is always UUID-based.
        const cleanCitation = decodeURIComponent(judgmentId)
          .replace(/[-_]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        try {
          const found = await resolveJudgment(cleanCitation, { id: judgments.id });

          if (found) {
            const qs = raw.includes("?") ? raw.substring(raw.indexOf("?")) : "";
            return res.redirect(301, `/judgment/${found.id}${qs}`);
          }
        } catch (e) {
          console.error("[SEO] Citation slug lookup failed:", e);
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("Retry-After", "30");
          res.status(503).send("Judgment lookup temporarily unavailable. Please retry.");
          return;
        }
        notFound = true;
      } else {
        let seoData;
        try {
          seoData = await getJudgmentSeoData(judgmentId);
        } catch (error) {
          console.error("[SEO] Judgment lookup unavailable:", error);
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("Retry-After", "30");
          res.status(503).send("Judgment lookup temporarily unavailable. Please retry.");
          return;
        }
        if (seoData && "canonicalId" in seoData) {
          const qs = raw.includes("?") ? raw.slice(raw.indexOf("?")) : "";
          return void res.redirect(301, `/judgment/${seoData.canonicalId}${qs}`);
        }
        if (seoData) {
          customMeta = seoData.meta;
          preRenderBlock = seoData.preRenderBlock;
        } else {
          notFound = true;
          customMeta = {
            title: "Pakistani Case Law & Judgments | Al Wakeelo",
            description: "Read full text Pakistani court judgments, legal precedents, and verified citations on Al Wakeelo — Pakistan's AI legal assistant.",
            index: false,
          };
          preRenderBlock = `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">Pakistani Case Law &amp; Judgments — Al Wakeelo</h1>
  <p>This judgment is unavailable. Browse the public directory to find available cases.</p>
  <p><a href="/judgments">Browse All Judgments</a> | <a href="/judgments/browse">Judgments Directory</a> | <a href="/">Home</a></p>
</div>`;
        }
      }
    }

    // Dynamic statute pages — DB lookup for per-statute SEO
    const statuteMatch = pathname.match(/^\/statute-view\/([^/]+)$/);
    if (statuteMatch && !preRenderBlock) {
      const statuteId = statuteMatch[1];
      let seoData;
      try {
        seoData = await getStatuteSeoData(statuteId);
      } catch (error) {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Retry-After", "30");
        res.status(503).send("Statute temporarily unavailable. Please retry.");
        return;
      }
      if (seoData) {
        customMeta = seoData.meta;
        preRenderBlock = seoData.preRenderBlock;
      } else notFound = true;
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
            "name": "Al Wakeelo",
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
        const schemaMarkup = `<script type="application/ld+json">\n${serializeJsonLd(schema)}\n</script>\n<script type="application/ld+json">\n${serializeJsonLd(breadcrumb)}\n</script>`;
        customMeta = {
          title: `${article.title} | Al Wakeelo Legal Guides`,
          description: article.summary,
          index: true,
          schemaMarkup,
        };
        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        preRenderBlock = `<div id="seo-prerender" style="padding:24px 16px;max-width:880px;margin:0 auto;font-family:'Inter', -apple-system, sans-serif;color:#0f172a;line-height:1.6;">
  <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;margin:0 0 16px 0;">${esc(article.title)}</h1>
  <p><strong>Category:</strong> ${esc(article.category)}</p>
  <p><strong>Published:</strong> ${esc(article.publishedAt)}</p>
  <p><strong>Estimated read time:</strong> ${blogReadMinutes(article.content)} minutes</p>
  <p>${esc(BLOG_REVIEW_NOTICE)}</p>
  <div>${renderPublicMarkdown(article.content)}</div>
  <section><h2>Primary-source research</h2>
  <p>These official research portals are starting points, not confirmation that each statement has been independently reviewed.</p>
  <ul>${BLOG_RESEARCH_SOURCES.map(source => `<li><a href="${esc(source.url)}">${esc(source.title)}</a></li>`).join("")}</ul></section>
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

    if (preRenderBlock && !notFound) {
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const articles = pathname === "/blog" ? `<section><h2>Legal guides</h2><ul>${BLOG_ARTICLES.map(article => `<li><a href="/blog/${esc(article.slug)}">${esc(article.title)}</a></li>`).join("")}</ul></section>` : "";
      const navigation = `<nav aria-label="Public resources"><a href="/">Home</a> · <a href="/about">About</a> · <a href="/blog">Legal guides</a> · <a href="/judgments/browse">Judgment directory</a> · <a href="/statute-search">Statute search</a></nav>`;
      preRenderBlock = preRenderBlock.replace(/<\/(div|main)>\s*$/, (_match, tag) => `${articles}${navigation}</${tag}>`);
    }

    if (notFound) customMeta = { title: "Page not found | Al Wakeelo", description: "The requested public page is unavailable.", index: false };

    let html = injectSeoMeta(indexHtmlTemplate, pathname, customMeta);

    // Inject pre-rendered body block so crawlers can index real text
    // without needing JavaScript to render the React SPA.
    if (preRenderBlock) {
      html = html.replace("</body>", `${preRenderBlock}\n</body>`);
    }

    // Return 404 for judgment pages that don't exist — prevents Google's
    // "Soft 404" classification where pages return 200 but have no content.
    const finalStatus = notFound ? 404 : statusCode;

    res.setHeader("Cache-Control", judgmentMatch ? "no-store" : HTML_CACHE_HEADER);
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

  // Enforce singular /judgment/:uuid canonical route with 301 redirect from /judgments/:uuid
  app.get(/^\/judgments\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i, (req, res) => {
    const id = req.params[0];
    const qs = req.originalUrl.split("?")[1];
    return res.redirect(301, qs ? `/judgment/${id}?${qs}` : `/judgment/${id}`);
  });

  // SPA shell with per-route SEO meta injection.
  app.use("/{*path}", async (req, res) => {
    const rawUrl = req.originalUrl || req.url || req.path || "/";
    const pathname = rawUrl.split("?")[0] || "/";
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
