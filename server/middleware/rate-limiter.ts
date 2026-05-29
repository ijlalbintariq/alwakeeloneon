import type { Request, Response, NextFunction } from "express";
import { recordSecurityEvent } from "../security-monitoring";
import { resolveRequestIp } from "../replit_integrations/auth/ip";

export function isSearchCrawler(req: Request): boolean {
  const ua = req.get("User-Agent");
  if (!ua) return false;
  return /googlebot|bingbot|yandexbot|applebot|duckduckbot|slurp|baiduspider/i.test(ua);
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

// 1. Auth routes rate limiter: 15 attempts per 15 minutes
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: "Too many authentication attempts. Please try again in 15 minutes.",
  keyPrefix: "auth-limit",
});

// 2. AI chat/queries rate limiter: 30 attempts per 15 minutes
export const aiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many AI requests. Please try again in 15 minutes.",
  keyPrefix: "ai-limit",
});

// 3. Global standard API rate limiter: 100 attempts per 15 minutes
export const globalApiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests to our API. Please try again in 15 minutes.",
  keyPrefix: "global-api-limit",
  skip: (req: Request) => {
    const url = req.originalUrl;
    if (
      url.startsWith("/api/auth") ||
      url.startsWith("/api/ai") ||
      url.startsWith("/api/apex") ||
      url.startsWith("/api/admin")
    ) {
      return true;
    }
    // Skip standard search crawlers on public routes to allow indexing of public judgments/directory listing.
    if (url.startsWith("/api/public") && isSearchCrawler(req)) {
      return true;
    }
    return false;
  },
});
