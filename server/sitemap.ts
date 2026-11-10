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
 * fetch of the index. Judgment pages use the same candidate filter, ordered by
 * decision date then UUID; actual header checks omit unconfirmed candidates.
 */

import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { and, asc, desc, inArray } from "drizzle-orm";
import { db } from "./db";
import { judgments, statuteDocuments } from "@shared/schema";
import { BLOG_ARTICLES } from "../shared/blog-data";
import { getIndexableJudgmentIds, indexableJudgmentCandidateFilter } from "./judgment-indexability";

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
      .where(indexableJudgmentCandidateFilter);
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

function sitemapIndexEntry(loc: string): string {
  return `  <sitemap>\n    <loc>${xmlEscape(loc)}</loc>\n  </sitemap>`;
}

// ─── Public route handlers ───────────────────────────────────────────────

export async function handleSitemapIndex(req: Request, res: Response): Promise<void> {
  try {
    const origin = siteOrigin(req);
    const judgmentTotal = await countActiveJudgments();
    const judgmentPages = Math.max(0, Math.ceil(judgmentTotal / PAGE_SIZE));

    const statuteTotal = await countStatuteDocuments();
    const statutePages = Math.max(0, Math.ceil(statuteTotal / PAGE_SIZE));

    const entries: string[] = [];
    entries.push(sitemapIndexEntry(`${origin}/sitemap-static.xml`));
    entries.push(sitemapIndexEntry(`${origin}/sitemap-judgments-priority.xml`));
    entries.push(sitemapIndexEntry(`${origin}/sitemap-judgments-tier2.xml`));
    for (let n = 1; n <= judgmentPages; n += 1) {
      entries.push(sitemapIndexEntry(`${origin}/sitemap-judgments-${n}.xml`));
    }
    for (let n = 1; n <= statutePages; n += 1) {
      entries.push(sitemapIndexEntry(`${origin}/sitemap-statutes-${n}.xml`));
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
  const blocks = STATIC_URLS.map((u) =>
    urlBlock(`${origin}${u.path}`, null, u.changefreq, u.priority),
  );
  blocks.push(...BLOG_ARTICLES.map(article => urlBlock(
    `${origin}/blog/${article.slug}`, isoDate(article.publishedAt), "monthly", "0.7",
  )));
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
      .where(indexableJudgmentCandidateFilter)
      .orderBy(desc(judgments.decisionDate), asc(judgments.id))
      .limit(PAGE_SIZE)
      .offset(offset);

    if (rows.length === 0) return void res.status(404).type("text/plain").send("Sitemap page out of range");

    const origin = siteOrigin(req);
    const confirmed = await getIndexableJudgmentIds(rows.map((row: { id: string }) => row.id));
    const blocks = rows.filter((row: { id: string }) => confirmed.has(row.id)).map((row: { id: string; updatedAt: Date | null }) =>
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

export async function handleSitemapJudgmentsPriority(req: Request, res: Response): Promise<void> {
  try {
    const origin = siteOrigin(req);
    // Curated historical candidates still require current identity validation.
    const filePath = path.resolve(process.cwd(), "shared/priority-judgments.json");
    const priorityJudgments: Array<{ id: string; clicks: number; impressions: number }> = JSON.parse(
      fs.readFileSync(filePath, "utf8")
    );

    const blocks = await listedJudgmentBlocks(priorityJudgments.map(row => row.id), origin, "weekly", "1.0");
    const body =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      blocks.join("\n") +
      `\n</urlset>\n`;

    res.setHeader("Cache-Control", "public, max-age=21600, s-maxage=21600"); // 6h
    res.type("application/xml").send(body);
  } catch (err) {
    console.error("[sitemap:judgments:priority] failed", err);
    res.status(500).type("text/plain").send("Priority judgments sitemap failed");
  }
}

export async function handleSitemapJudgmentsTier2(req: Request, res: Response): Promise<void> {
  try {
    const origin = siteOrigin(req);
    // The file's historical dates are not evidence of a page modification.
    const filePath = path.resolve(process.cwd(), "shared/tier2-judgments.json");
    const tier2Judgments: Array<{ id: string; date?: string }> = JSON.parse(
      fs.readFileSync(filePath, "utf8")
    );

    const blocks = await listedJudgmentBlocks(tier2Judgments.map(row => row.id), origin, "monthly", "0.8");
    const body =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      blocks.join("\n") +
      `\n</urlset>\n`;

    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400"); // 24h
    res.type("application/xml").send(body);
  } catch (err) {
    console.error("[sitemap:judgments:tier2] failed", err);
    res.status(500).type("text/plain").send("Tier 2 judgments sitemap failed");
  }
}

async function listedJudgmentBlocks(ids: string[], origin: string, changefreq: string, priority: string): Promise<string[]> {
  const confirmed = [...await getIndexableJudgmentIds(ids)];
  const blocks: string[] = [];
  for (let offset = 0; offset < confirmed.length; offset += 250) {
    const rows = await db.select({ id: judgments.id, updatedAt: judgments.updatedAt })
      .from(judgments).where(and(indexableJudgmentCandidateFilter, inArray(judgments.id, confirmed.slice(offset, offset + 250))));
    blocks.push(...rows.map((row: { id: string; updatedAt: Date | null }) =>
      urlBlock(`${origin}/judgment/${row.id}`, isoDate(row.updatedAt), changefreq, priority)));
  }
  return blocks;
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
