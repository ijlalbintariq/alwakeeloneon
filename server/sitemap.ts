/**
 * Dynamic sitemap for alwakeelo.com.
 *
 * Layout:
 *   /sitemap.xml                       sitemap index (this points to the others)
 *   /sitemap-static.xml                marketing + policy pages
 *   /sitemap-judgments-{n}.xml         judgments paged at PAGE_SIZE per file
 *   /sitemap-statutes-{n}.xml          statutes paged at PAGE_SIZE per file
 *
 * Sitemap spec: max 50,000 URLs and 50 MB uncompressed per file. We use a
 * conservative 10,000 URLs per page to keep memory pressure low on Render's
 * Starter plan and to give us multiple smaller files Googlebot can prioritise.
 *
 * Counts are cached for 1 hour to avoid repeated `count(*)` on every Googlebot
 * fetch of the index. Page XML is computed on demand (Postgres ORDER BY id
 * LIMIT/OFFSET is fast on indexed primary keys).
 */

import type { Request, Response } from "express";
import { eq, asc } from "drizzle-orm";
import { db } from "./db";
import { judgments, statuteDocuments } from "@shared/schema";

const PAGE_SIZE = 10_000;
const COUNT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CachedCount {
  value: number;
  expiresAt: number;
}

const countCache = new Map<string, CachedCount>();

export function clearSitemapCache(): void {
  countCache.clear();
}

async function cachedCount(key: string, loader: () => Promise<number>): Promise<number> {
  const now = Date.now();
  const hit = countCache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;
  const value = await loader();
  countCache.set(key, { value, expiresAt: now + COUNT_CACHE_TTL_MS });
  return value;
}

async function countActiveJudgments(): Promise<number> {
  return cachedCount("judgments", async () => {
    const [row] = await db
      .select({ count: sqlCountStar() })
      .from(judgments)
      .where(eq(judgments.isActive, true));
    return Number(row?.count || 0);
  });
}

async function countStatuteDocuments(): Promise<number> {
  return cachedCount("statute_documents", async () => {
    const [row] = await db.select({ count: sqlCountStar() }).from(statuteDocuments);
    return Number(row?.count || 0);
  });
}

// Tiny helper so we don't import drizzle-orm's sql at every call site.
import { sql } from "drizzle-orm";
function sqlCountStar() {
  return sql<number>`count(*)`;
}

// Pin to the canonical www host. We deliberately ignore PUBLIC_SITE_URL here
// because Render currently has it set to the apex (https://alwakeelo.com),
// while the site's canonical and final URL is https://www.alwakeelo.com.
// Emitting non-canonical URLs in the sitemap dilutes indexing signals.
const CANONICAL_ORIGIN = "https://www.alwakeelo.com";

function siteOrigin(_req: Request): string {
  return CANONICAL_ORIGIN;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function urlBlock(loc: string, lastmod?: string | null, changefreq?: string, priority?: string): string {
  const parts: string[] = [`  <url>`, `    <loc>${xmlEscape(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`    <priority>${priority}</priority>`);
  parts.push(`  </url>`);
  return parts.join("\n");
}

function sitemapIndexEntry(loc: string, lastmod: string): string {
  return `  <sitemap>\n    <loc>${xmlEscape(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`;
}

// ─── Public route handlers ───────────────────────────────────────────────

export async function handleSitemapIndex(req: Request, res: Response): Promise<void> {
  try {
    const origin = siteOrigin(req);
    const today = new Date().toISOString().slice(0, 10);

    const judgmentTotal = await countActiveJudgments().catch(() => 0);
    const judgmentPages = Math.max(0, Math.ceil(judgmentTotal / PAGE_SIZE));

    const statuteTotal = await countStatuteDocuments().catch(() => 0);
    const statutePages = Math.max(0, Math.ceil(statuteTotal / PAGE_SIZE));

    const entries: string[] = [];
    entries.push(sitemapIndexEntry(`${origin}/sitemap-static.xml`, today));
    for (let n = 1; n <= judgmentPages; n += 1) {
      entries.push(sitemapIndexEntry(`${origin}/sitemap-judgments-${n}.xml`, today));
    }
    for (let n = 1; n <= statutePages; n += 1) {
      entries.push(sitemapIndexEntry(`${origin}/sitemap-statutes-${n}.xml`, today));
    }

    const body =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      entries.join("\n") +
      `\n</sitemapindex>\n`;

    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.type("application/xml").send(body);
  } catch (err) {
    console.error("[sitemap:index] failed", err);
    res.status(500).type("text/plain").send("Sitemap index failed");
  }
}

const STATIC_URLS: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: "/",                                  changefreq: "weekly",  priority: "1.0" },
  { path: "/about",                             changefreq: "monthly", priority: "0.8" },
  { path: "/contact",                            changefreq: "monthly", priority: "0.8" },
  { path: "/faq",                               changefreq: "monthly", priority: "0.8" },
  { path: "/blog",                              changefreq: "daily",   priority: "0.8" },
  { path: "/blog/muslim-family-laws-pakistan-nikah-talaq-khula", changefreq: "weekly", priority: "0.7" },
  { path: "/blog/understanding-bail-criminal-procedure-pakistan", changefreq: "weekly", priority: "0.7" },
  { path: "/blog/contract-act-1872-pakistan-business-agreements", changefreq: "weekly", priority: "0.7" },
  { path: "/blog/cybercrime-laws-peca-pakistan-digital-rights", changefreq: "weekly", priority: "0.7" },
  { path: "/blog/demystifying-pakistani-land-revenue-records-fard-mutation", changefreq: "weekly", priority: "0.7" },
  { path: "/judgments",                         changefreq: "daily",   priority: "0.9" },
  { path: "/judgments/browse",                  changefreq: "daily",   priority: "0.9" },
  { path: "/statute-search",                    changefreq: "weekly",  priority: "0.9" },
  { path: "/al-wakeelo",                        changefreq: "weekly",  priority: "0.9" },
  { path: "/legal-drafting",                    changefreq: "weekly",  priority: "0.8" },
  { path: "/contract-drafting",                 changefreq: "weekly",  priority: "0.8" },
  { path: "/citation-search",                   changefreq: "weekly",  priority: "0.7" },
  { path: "/install",                           changefreq: "monthly", priority: "0.5" },
  { path: "/privacy",                           changefreq: "monthly", priority: "0.4" },
  { path: "/terms",                             changefreq: "monthly", priority: "0.4" },
  { path: "/cancellation-return-refund-policy", changefreq: "monthly", priority: "0.3" },
  { path: "/ownership-statement",               changefreq: "monthly", priority: "0.3" },
];

export function handleSitemapStatic(req: Request, res: Response): void {
  const origin = siteOrigin(req);
  const today = new Date().toISOString().slice(0, 10);
  const blocks = STATIC_URLS.map((u) =>
    urlBlock(`${origin}${u.path}`, today, u.changefreq, u.priority),
  );
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    blocks.join("\n") +
    `\n</urlset>\n`;
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
  res.type("application/xml").send(body);
}

function parsePageNumber(raw: string | undefined): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 100_000) return null;
  return n;
}

export async function handleSitemapJudgments(req: Request, res: Response): Promise<void> {
  const n = parsePageNumber(typeof req.params.n === "string" ? req.params.n : undefined);
  if (n == null) return void res.status(404).type("text/plain").send("Invalid sitemap page");

  try {
    const offset = (n - 1) * PAGE_SIZE;
    const rows = await db
      .select({ id: judgments.id, updatedAt: judgments.updatedAt })
      .from(judgments)
      .where(eq(judgments.isActive, true))
      .orderBy(asc(judgments.id))
      .limit(PAGE_SIZE)
      .offset(offset);

    if (rows.length === 0) return void res.status(404).type("text/plain").send("Sitemap page out of range");

    const origin = siteOrigin(req);
    const blocks = rows.map((row: { id: string; updatedAt: Date | null }) =>
      urlBlock(`${origin}/judgment/${row.id}`, isoDate(row.updatedAt), "yearly", "0.6"),
    );
    const body =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      blocks.join("\n") +
      `\n</urlset>\n`;

    res.setHeader("Cache-Control", "public, max-age=21600, s-maxage=21600"); // 6h
    res.type("application/xml").send(body);
  } catch (err) {
    console.error(`[sitemap:judgments:${n}] failed`, err);
    res.status(500).type("text/plain").send("Sitemap page failed");
  }
}

export async function handleSitemapStatutes(req: Request, res: Response): Promise<void> {
  const n = parsePageNumber(typeof req.params.n === "string" ? req.params.n : undefined);
  if (n == null) return void res.status(404).type("text/plain").send("Invalid sitemap page");

  try {
    const offset = (n - 1) * PAGE_SIZE;
    const rows = await db
      .select({ id: statuteDocuments.id, createdAt: statuteDocuments.createdAt })
      .from(statuteDocuments)
      .orderBy(asc(statuteDocuments.id))
      .limit(PAGE_SIZE)
      .offset(offset);

    if (rows.length === 0) return void res.status(404).type("text/plain").send("Sitemap page out of range");

    const origin = siteOrigin(req);
    const blocks = rows.map((row: { id: number; createdAt: Date | null }) =>
      urlBlock(`${origin}/statute-view/${row.id}`, isoDate(row.createdAt), "yearly", "0.6"),
    );
    const body =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      blocks.join("\n") +
      `\n</urlset>\n`;

    res.setHeader("Cache-Control", "public, max-age=21600, s-maxage=21600");
    res.type("application/xml").send(body);
  } catch (err) {
    console.error(`[sitemap:statutes:${n}] failed`, err);
    res.status(500).type("text/plain").send("Sitemap page failed");
  }
}
