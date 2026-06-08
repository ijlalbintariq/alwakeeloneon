import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { injectSeoMeta, type SeoMeta } from "./seo-meta";
import { db } from "./db";
import { judgments } from "@shared/schema";
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
  const SEO_MAX_CONCURRENT = 3;
  const SEO_QUERY_TIMEOUT_MS = 3_000;

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
          decisionDate: judgments.decisionDate
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

        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const preRenderBlock = `<div id="seo-prerender" aria-hidden="true" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap">
  <h1>${esc(title)}${citation ? ` — ${esc(citation)}` : ""}</h1>
  ${citation ? `<p>Citation: ${esc(citation)}</p>` : ""}
  <p>Court: ${esc(courtName)}</p>
  ${yearStr ? `<p>Year: ${esc(yearStr)}</p>` : ""}
  ${decisionDateStr ? `<p>Decision Date: ${esc(decisionDateStr)}</p>` : ""}
  <p>This judgment is available in full text on Al Wakeelo — Pakistan&#39;s AI legal assistant. Search Pakistani case law by citation, party name, court, and year.</p>
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

  async function sendIndexWithSeo(req: express.Request, res: express.Response, statusCode = 200): Promise<void> {
    // Express 5 with `app.use("/{*path}")` mounts the handler with the wildcard
    // as the mount path, so `req.path` returns the residual ("/") rather than
    // the full request path. Use originalUrl (minus query) to get the real
    // route — this is what crawlers actually requested.
    const raw = req.originalUrl || req.url || req.path || "/";
    const pathname = raw.split("?")[0] || "/";

    let customMeta: SeoMeta | undefined;
    let preRenderBlock: string | undefined;
    const judgmentMatch = pathname.match(/^\/judgment\/([^/]+)$/);
    if (judgmentMatch) {
      const judgmentId = judgmentMatch[1];
      const seoData = await getJudgmentSeoData(judgmentId);
      if (seoData) {
        customMeta = seoData.meta;
        preRenderBlock = seoData.preRenderBlock;
      }
    }

    let html = injectSeoMeta(indexHtmlTemplate, pathname, customMeta);

    // Inject pre-rendered body block for judgment pages so Google can index
    // the citation, parties, and court as real body text without JavaScript.
    if (preRenderBlock) {
      html = html.replace("</body>", `${preRenderBlock}\n</body>`);
    }

    res.setHeader("Cache-Control", HTML_CACHE_HEADER);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(statusCode).send(html);
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
