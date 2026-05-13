import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { injectSeoMeta } from "./seo-meta";

const KNOWN_SPA_ROUTES: RegExp[] = [
  /^\/$/,
  /^\/auth$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
  /^\/share\/[^/]+$/,
  /^\/privacy$/,
  /^\/terms$/,
  /^\/install$/,
  /^\/dashboard$/,
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

  function sendIndexWithSeo(req: express.Request, res: express.Response, statusCode = 200): void {
    // Express 5 with `app.use("/{*path}")` mounts the handler with the wildcard
    // as the mount path, so `req.path` returns the residual ("/") rather than
    // the full request path. Use originalUrl (minus query) to get the real
    // route — this is what crawlers actually requested.
    const raw = req.originalUrl || req.url || req.path || "/";
    const pathname = raw.split("?")[0] || "/";
    const html = injectSeoMeta(indexHtmlTemplate, pathname);
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

  // SPA shell with per-route SEO meta injection.
  app.use("/{*path}", (req, res) => {
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
      return sendIndexWithSeo(req, res, 200);
    }

    const wantsHtml = (req.get("accept") || "").includes("text/html");
    if (wantsHtml) {
      return sendIndexWithSeo(req, res, 404);
    }
    return res.status(404).end();
  });
}
