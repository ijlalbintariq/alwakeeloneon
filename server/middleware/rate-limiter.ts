import type { Request, Response, NextFunction } from "express";
import { recordSecurityEvent } from "../security-monitoring";
import { resolveRequestIp } from "../replit_integrations/auth/ip";

import dns from "dns";
import { promisify } from "util";

const reverseDns = promisify(dns.reverse);
const resolveDns = promisify(dns.resolve);

const verifiedCrawlerCache = new Map<string, { verified: boolean; expiresAt: number }>();
const VERIFICATION_TTL = 12 * 60 * 60 * 1000; // 12 hours

export function isSearchCrawlerHeader(ua: string): boolean {
  return /googlebot|bingbot|yandexbot|applebot|duckduckbot|slurp|baiduspider/i.test(ua);
}

export async function checkIsRealCrawler(ip: string, ua: string): Promise<boolean> {
  if (!ua || !isSearchCrawlerHeader(ua)) return false;

  const isGoogle = /googlebot/i.test(ua);
  const isBing = /bingbot|slurp/i.test(ua);
  const isApple = /applebot/i.test(ua);
  const isYandex = /yandexbot/i.test(ua);
  const isDuckDuckGo = /duckduckbot/i.test(ua);

  // Check cache first
  const cached = verifiedCrawlerCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.verified;
  }

  try {
    const hostnames = await reverseDns(ip);
    for (const hostname of hostnames) {
      let matchesDomain = false;
      if (isGoogle && (hostname.endsWith(".googlebot.com") || hostname.endsWith(".google.com"))) {
        matchesDomain = true;
      } else if (isBing && (hostname.endsWith(".search.msn.com") || hostname.endsWith(".msn.com"))) {
        matchesDomain = true;
      } else if (isApple && hostname.endsWith(".apple.com")) {
        matchesDomain = true;
      } else if (isYandex && (hostname.endsWith(".yandex.ru") || hostname.endsWith(".yandex.net") || hostname.endsWith(".yandex.com"))) {
        matchesDomain = true;
      } else if (isDuckDuckGo && hostname.endsWith(".duckduckgo.com")) {
        matchesDomain = true;
      }

      if (matchesDomain) {
        const ips = await resolveDns(hostname);
        if (ips.includes(ip)) {
          verifiedCrawlerCache.set(ip, { verified: true, expiresAt: Date.now() + VERIFICATION_TTL });
          return true;
        }
      }
    }
  } catch (err) {
    // DNS verification errors (host not found, timeout, etc.)
  }

  // Cache failure for 15 minutes to avoid spamming DNS queries
  verifiedCrawlerCache.set(ip, { verified: false, expiresAt: Date.now() + 15 * 60 * 1000 });
  return false;
}

export async function crawlerVerificationMiddleware(req: Request, res: Response, next: NextFunction) {
  const ua = req.get("User-Agent") || "";
  if (!isSearchCrawlerHeader(ua)) {
    (req as any).isRealCrawler = false;
    return next();
  }

  const ip = resolveRequestIp(req);
  const isReal = await checkIsRealCrawler(ip, ua);
  (req as any).isRealCrawler = isReal;

  if (isReal) {
    console.log(`[Crawler] Verified legitimate search crawler: IP=${ip}, User-Agent=${ua}`);
  } else {
    // Log User-Agent spoofing attempt
    console.warn(`[Security Alert] Crawler User-Agent spoof detected from IP=${ip}, UA="${ua}"`);
  }

  next();
}

export function isSearchCrawler(req: Request): boolean {
  if ((req as any).isRealCrawler !== undefined) {
    return (req as any).isRealCrawler === true;
  }
  // Fallback for mock requests in unit tests that lack middleware runs
  const ua = req.get("User-Agent") || "";
  return isSearchCrawlerHeader(ua);
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitRecord>();

// Cleanup stale records periodically to avoid memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now > record.resetAt) {
      store.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);
cleanupTimer.unref?.();

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix: string;
  skip?: (req: Request) => boolean;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, max, message = "Too many requests. Please try again shortly.", keyPrefix, skip } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Allow bypassing rate limits for tests or specific environment cases if needed
    if (process.env.DISABLE_RATE_LIMITS === "true") {
      return next();
    }

    if (skip && skip(req)) {
      return next();
    }

    const ip = resolveRequestIp(req);
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    let record = store.get(key);

    if (!record || now > record.resetAt) {
      record = {
        count: 0,
        resetAt: now + windowMs,
      };
    }

    record.count += 1;
    store.set(key, record);

    const remaining = Math.max(0, max - record.count);
    const resetTimeSeconds = Math.ceil(record.resetAt / 1000);

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", resetTimeSeconds);

    if (record.count > max) {
      recordSecurityEvent("rate_limit_exceeded", ip, {
        path: req.path,
        method: req.method,
        count: record.count,
        limit: max,
        keyPrefix,
      });

      return res.status(429).json({ message });
    }

    return next();
  };
}

// 1. Auth routes rate limiter: 60 per 15 minutes
//    Session-check endpoints (/api/auth/user, /api/auth/google/status) fire on
//    every page load, so they must be excluded — otherwise normal browsing
//    triggers 429 after ~15 pages.
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: "Too many authentication attempts. Please try again in 15 minutes.",
  keyPrefix: "auth-limit",
  skip: (req: Request) => {
    const url = req.originalUrl;
    // These are lightweight session checks, not login attempts
    if (
      url === "/api/auth/user" ||
      url === "/api/auth/google/status" ||
      url.startsWith("/api/auth/session")
    ) {
      return true;
    }
    return false;
  },
});

// 2. AI chat/queries rate limiter (for anonymous/public endpoints): 120 attempts per 15 minutes
// Logged-in users are governed by their account subscription tier limits (checkUsageLimit)
export const aiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: "Too many AI requests. Please try again in 15 minutes.",
  keyPrefix: "ai-limit",
  skip: (req: Request) => {
    // Authenticated users have their own plan quotas and burst limiter
    if ((req.session as any)?.userId) {
      return true;
    }
    return false;
  },
});

// 3. Global standard API rate limiter: 1,000 attempts per 15 minutes for public traffic
// Logged-in lawyers and workspace operations are exempt so typing and autosaves never trigger 429
export const globalApiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "Too many requests to our API. Please try again in 15 minutes.",
  keyPrefix: "global-api-limit",
  skip: (req: Request) => {
    // 1. All authenticated user sessions are exempt from IP-level autosave blocking
    if ((req.session as any)?.userId) {
      return true;
    }

    const url = req.originalUrl;
    // 2. Exempt core application and drafting endpoints
    if (
      url.startsWith("/api/auth") ||
      url.startsWith("/api/ai") ||
      url.startsWith("/api/apex") ||
      url.startsWith("/api/admin") ||
      url.startsWith("/api/documents") ||
      url.startsWith("/api/retrieval") ||
      url.startsWith("/api/user") ||
      url.startsWith("/api/bookmarks") ||
      url.startsWith("/api/style-memory") ||
      url.startsWith("/api/case-files") ||
      url.startsWith("/api/daily-diary") ||
      url.startsWith("/api/judgments") ||
      url.startsWith("/api/statutes")
    ) {
      return true;
    }

    // 3. Skip standard search crawlers on public routes to allow indexing
    if (url.startsWith("/api/public") && isSearchCrawler(req)) {
      return true;
    }

    return false;
  },
});
