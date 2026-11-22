import type { Request, Response, NextFunction } from "express";
import dns from "dns";
import { promisify } from "util";
import ipaddr from "ipaddr.js";
import { resolveRequestIp } from "../replit_integrations/auth/ip";
import searchbotData from "../data/openai-crawlers/searchbot.json";
import chatgptUserData from "../data/openai-crawlers/chatgpt-user.json";
import gptbotData from "../data/openai-crawlers/gptbot.json";

const dnsReverse = promisify(dns.reverse);
const dnsResolve = promisify(dns.resolve);

export type CrawlerType =
  | "OAI-SearchBot"
  | "ChatGPT-User"
  | "GPTBot"
  | "Googlebot"
  | "Bingbot"
  | "Applebot"
  | "YandexBot"
  | "DuckDuckBot"
  | "PerplexityBot"
  | "ClaudeBot"
  | "OtherCrawler"
  | "None";

export type VerificationStatus =
  | "VERIFIED_OPENAI"
  | "VERIFIED_CRAWLER"
  | "UNVERIFIED_CRAWLER"
  | "NOT_A_CRAWLER";

export interface CrawlerVerificationResult {
  status: VerificationStatus;
  crawlerType: CrawlerType;
  ip: string;
  userAgent: string;
  ipRangeMatch: boolean;
  matchedPrefix?: string;
  reverseDnsHostnames: string[];
  reverseDnsStatus: "none" | "matched" | "mismatch" | "timeout" | "error";
  forwardDnsIps: string[];
  forwardDnsStatus: "none" | "matched" | "mismatch" | "timeout" | "error";
  verified: boolean;
  failureReason?: string;
}

export interface IpPrefixItem {
  ipv4Prefix?: string;
  ipv6Prefix?: string;
}

// In-memory prefixes with official OpenAI defaults
let openAiPrefixes: {
  searchbot: IpPrefixItem[];
  chatgptUser: IpPrefixItem[];
  gptbot: IpPrefixItem[];
} = {
  searchbot: (searchbotData.prefixes || []) as IpPrefixItem[],
  chatgptUser: (chatgptUserData.prefixes || []) as IpPrefixItem[],
  gptbot: (gptbotData.prefixes || []) as IpPrefixItem[],
};

// Verification Cache
interface CacheEntry {
  result: CrawlerVerificationResult;
  expiresAt: number;
}
const crawlerVerificationCache = new Map<string, CacheEntry>();
const VERIFIED_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const UNVERIFIED_TTL_MS = 15 * 60 * 1000;    // 15 minutes

// Periodic cache cleanup
const cacheCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of crawlerVerificationCache.entries()) {
    if (entry.expiresAt <= now) {
      crawlerVerificationCache.delete(key);
    }
  }
}, 10 * 60 * 1000);
cacheCleanupInterval.unref?.();

export function clearCrawlerVerificationCache(): void {
  crawlerVerificationCache.clear();
}

export function setOpenAiPrefixes(newPrefixes: Partial<typeof openAiPrefixes>): void {
  openAiPrefixes = { ...openAiPrefixes, ...newPrefixes };
}

export function isSearchCrawlerHeader(ua: string): boolean {
  if (!ua) return false;
  return /googlebot|bingbot|yandexbot|applebot|duckduckbot|slurp|baiduspider|gptbot|oai-searchbot|chatgpt-user|perplexitybot|claudebot/i.test(ua);
}

export function detectCrawlerType(ua: string): CrawlerType {
  if (!ua) return "None";
  if (/oai-searchbot/i.test(ua)) return "OAI-SearchBot";
  if (/chatgpt-user/i.test(ua)) return "ChatGPT-User";
  if (/gptbot/i.test(ua)) return "GPTBot";
  if (/googlebot/i.test(ua)) return "Googlebot";
  if (/bingbot|slurp/i.test(ua)) return "Bingbot";
  if (/applebot/i.test(ua)) return "Applebot";
  if (/yandexbot/i.test(ua)) return "YandexBot";
  if (/duckduckbot/i.test(ua)) return "DuckDuckBot";
  if (/perplexitybot/i.test(ua)) return "PerplexityBot";
  if (/claudebot/i.test(ua)) return "ClaudeBot";
  if (isSearchCrawlerHeader(ua)) return "OtherCrawler";
  return "None";
}

export function isOpenAICrawler(type: CrawlerType): boolean {
  return type === "OAI-SearchBot" || type === "ChatGPT-User" || type === "GPTBot";
}

export function checkIpInPrefixes(ipStr: string, prefixes: IpPrefixItem[]): { matched: boolean; prefix?: string } {
  try {
    const cleanIp = ipStr.trim();
    if (!ipaddr.isValid(cleanIp)) return { matched: false };
    const addr = ipaddr.parse(cleanIp);
    const isV4 = addr.kind() === "ipv4";

    for (const item of prefixes) {
      const cidrStr = isV4 ? item.ipv4Prefix : item.ipv6Prefix;
      if (!cidrStr) continue;
      try {
        const parsedCidr = ipaddr.parseCIDR(cidrStr);
        const isMatched = isV4
          ? (addr as ipaddr.IPv4).match(parsedCidr as [ipaddr.IPv4, number])
          : (addr as ipaddr.IPv6).match(parsedCidr as [ipaddr.IPv6, number]);
        if (isMatched) {
          return { matched: true, prefix: cidrStr };
        }
      } catch {
        // Skip invalid CIDR if any
      }
    }
  } catch {
    return { matched: false };
  }
  return { matched: false };
}

export function getOpenAiPrefixesForCrawler(type: CrawlerType): IpPrefixItem[] {
  switch (type) {
    case "OAI-SearchBot":
      return openAiPrefixes.searchbot;
    case "ChatGPT-User":
      return openAiPrefixes.chatgptUser;
    case "GPTBot":
      return openAiPrefixes.gptbot;
    default:
      return [];
  }
}

export function checkIpInAnyOpenAiRanges(ip: string): { matched: boolean; crawlerType?: CrawlerType; prefix?: string } {
  const sb = checkIpInPrefixes(ip, openAiPrefixes.searchbot);
  if (sb.matched) return { matched: true, crawlerType: "OAI-SearchBot", prefix: sb.prefix };

  const cu = checkIpInPrefixes(ip, openAiPrefixes.chatgptUser);
  if (cu.matched) return { matched: true, crawlerType: "ChatGPT-User", prefix: cu.prefix };

  const gb = checkIpInPrefixes(ip, openAiPrefixes.gptbot);
  if (gb.matched) return { matched: true, crawlerType: "GPTBot", prefix: gb.prefix };

  return { matched: false };
}

function getExpectedHostDomains(type: CrawlerType): string[] {
  switch (type) {
    case "Googlebot":
      return [".googlebot.com", ".google.com"];
    case "Bingbot":
      return [".search.msn.com", ".msn.com"];
    case "Applebot":
      return [".apple.com"];
    case "YandexBot":
      return [".yandex.ru", ".yandex.net", ".yandex.com"];
    case "DuckDuckBot":
      return [".duckduckgo.com"];
    case "PerplexityBot":
      return [".perplexity.ai", ".perplexity.com"];
    case "ClaudeBot":
      return [".anthropic.com", ".claude.ai"];
    case "OAI-SearchBot":
      return [".openai.com", ".search.openai.com"];
    case "ChatGPT-User":
    case "GPTBot":
      return [".openai.com"];
    default:
      return [];
  }
}

export interface VerifyCrawlerOptions {
  dnsTimeoutMs?: number;
  skipCache?: boolean;
  dnsResolver?: {
    reverse?: (ip: string) => Promise<string[]>;
    resolve?: (hostname: string) => Promise<string[]>;
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMsg: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(timeoutMsg);
      (err as any).code = "ETIMEOUT";
      reject(err);
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    clearTimeout(timer!);
    throw err;
  }
}

export async function verifyCrawler(
  ip: string,
  ua: string,
  options: VerifyCrawlerOptions = {}
): Promise<CrawlerVerificationResult> {
  const crawlerType = detectCrawlerType(ua);
  if (crawlerType === "None") {
    return {
      status: "NOT_A_CRAWLER",
      crawlerType: "None",
      ip,
      userAgent: ua,
      ipRangeMatch: false,
      reverseDnsHostnames: [],
      reverseDnsStatus: "none",
      forwardDnsIps: [],
      forwardDnsStatus: "none",
      verified: false,
    };
  }

  const cacheKey = `${ip}:${crawlerType}`;
  if (!options.skipCache) {
    const cached = crawlerVerificationCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }
  }

  const dnsTimeoutMs = options.dnsTimeoutMs ?? 2500;
  const reverseFn = options.dnsResolver?.reverse || dnsReverse;
  const resolveFn = options.dnsResolver?.resolve || dnsResolve;
  const expectedDomains = getExpectedHostDomains(crawlerType);

  // 1. OpenAI Crawlers: Official published IP ranges verification
  if (isOpenAICrawler(crawlerType)) {
    const prefixes = getOpenAiPrefixesForCrawler(crawlerType);
    const rangeMatch = checkIpInPrefixes(ip, prefixes);

    if (!rangeMatch.matched) {
      const otherMatch = checkIpInAnyOpenAiRanges(ip);
      const failureReason = otherMatch.matched
        ? `crawler_type_mismatch: IP belongs to ${otherMatch.crawlerType} (${otherMatch.prefix}), but request claimed ${crawlerType}`
        : `ip_range_mismatch: IP ${ip} is not in published OpenAI IP ranges for ${crawlerType}`;

      const res: CrawlerVerificationResult = {
        status: "UNVERIFIED_CRAWLER",
        crawlerType,
        ip,
        userAgent: ua,
        ipRangeMatch: false,
        reverseDnsHostnames: [],
        reverseDnsStatus: "none",
        forwardDnsIps: [],
        forwardDnsStatus: "none",
        verified: false,
        failureReason,
      };

      crawlerVerificationCache.set(cacheKey, {
        result: res,
        expiresAt: Date.now() + UNVERIFIED_TTL_MS,
      });
      return res;
    }

    // IP strictly matched the official OpenAI published range!
    // Perform reverse and forward DNS check
    let reverseDnsHostnames: string[] = [];
    let reverseDnsStatus: "none" | "matched" | "mismatch" | "timeout" | "error" = "none";
    let forwardDnsIps: string[] = [];
    let forwardDnsStatus: "none" | "matched" | "mismatch" | "timeout" | "error" = "none";
    let dnsFailureReason: string | undefined;

    try {
      reverseDnsHostnames = await withTimeout(
        reverseFn(ip),
        dnsTimeoutMs,
        "Reverse DNS lookup timed out"
      );
      if (reverseDnsHostnames.length > 0) {
        const matchesDomain = reverseDnsHostnames.some((h) =>
          expectedDomains.some((dom) => h.toLowerCase().endsWith(dom))
        );
        if (matchesDomain) {
          reverseDnsStatus = "matched";
          const matchingHost = reverseDnsHostnames.find((h) =>
            expectedDomains.some((dom) => h.toLowerCase().endsWith(dom))
          )!;

          try {
            forwardDnsIps = await withTimeout(
              resolveFn(matchingHost),
              dnsTimeoutMs,
              "Forward DNS lookup timed out"
            );
            if (forwardDnsIps.includes(ip)) {
              forwardDnsStatus = "matched";
            } else {
              forwardDnsStatus = "mismatch";
              dnsFailureReason = `forward_dns_mismatch: Hostname ${matchingHost} resolved to [${forwardDnsIps.join(", ")}] which does not include client IP ${ip}`;
            }
          } catch (fwdErr: any) {
            if (fwdErr.code === "ETIMEOUT") {
              forwardDnsStatus = "timeout";
              dnsFailureReason = "dns_timeout: Forward DNS lookup timed out";
            } else {
              forwardDnsStatus = "error";
              dnsFailureReason = `forward_dns_error: ${fwdErr.message || "Failed to resolve hostname"}`;
            }
          }
        } else {
          reverseDnsStatus = "mismatch";
          dnsFailureReason = `failed_dns_verification: PTR hostnames [${reverseDnsHostnames.join(", ")}] do not match official OpenAI domain requirements`;
        }
      } else {
        reverseDnsStatus = "none";
      }
    } catch (revErr: any) {
      if (revErr.code === "ETIMEOUT") {
        reverseDnsStatus = "timeout";
        dnsFailureReason = "dns_timeout: Reverse DNS lookup timed out";
      } else if (
        revErr.code === "ENOTFOUND" ||
        revErr.code === "ENODATA" ||
        revErr.code === "NXDOMAIN"
      ) {
        // Normal for OpenAI infrastructure — OpenAI does not publish PTR records
        reverseDnsStatus = "none";
      } else {
        reverseDnsStatus = "error";
        dnsFailureReason = `reverse_dns_error: ${revErr.message || "Reverse lookup failed"}`;
      }
    }

    // Fail securely if DNS lookup returned a timeout or an invalid domain
    if (reverseDnsStatus === "timeout" || forwardDnsStatus === "timeout") {
      const res: CrawlerVerificationResult = {
        status: "UNVERIFIED_CRAWLER",
        crawlerType,
        ip,
        userAgent: ua,
        ipRangeMatch: true,
        matchedPrefix: rangeMatch.prefix,
        reverseDnsHostnames,
        reverseDnsStatus,
        forwardDnsIps,
        forwardDnsStatus,
        verified: false,
        failureReason: dnsFailureReason || "dns_timeout: DNS verification exceeded timeout limit",
      };
      crawlerVerificationCache.set(cacheKey, { result: res, expiresAt: Date.now() + UNVERIFIED_TTL_MS });
      return res;
    }

    if (reverseDnsStatus === "mismatch") {
      const res: CrawlerVerificationResult = {
        status: "UNVERIFIED_CRAWLER",
        crawlerType,
        ip,
        userAgent: ua,
        ipRangeMatch: true,
        matchedPrefix: rangeMatch.prefix,
        reverseDnsHostnames,
        reverseDnsStatus,
        forwardDnsIps,
        forwardDnsStatus,
        verified: false,
        failureReason: dnsFailureReason || "failed_dns_verification: PTR domain mismatch",
      };
      crawlerVerificationCache.set(cacheKey, { result: res, expiresAt: Date.now() + UNVERIFIED_TTL_MS });
      return res;
    }

    if (reverseDnsStatus === "matched" && forwardDnsStatus === "mismatch") {
      const res: CrawlerVerificationResult = {
        status: "UNVERIFIED_CRAWLER",
        crawlerType,
        ip,
        userAgent: ua,
        ipRangeMatch: true,
        matchedPrefix: rangeMatch.prefix,
        reverseDnsHostnames,
        reverseDnsStatus,
        forwardDnsIps,
        forwardDnsStatus,
        verified: false,
        failureReason: dnsFailureReason || "forward_dns_mismatch: Hostname does not resolve back to client IP",
      };
      crawlerVerificationCache.set(cacheKey, { result: res, expiresAt: Date.now() + UNVERIFIED_TTL_MS });
      return res;
    }

    // Valid OpenAI request!
    const res: CrawlerVerificationResult = {
      status: "VERIFIED_OPENAI",
      crawlerType,
      ip,
      userAgent: ua,
      ipRangeMatch: true,
      matchedPrefix: rangeMatch.prefix,
      reverseDnsHostnames,
      reverseDnsStatus,
      forwardDnsIps,
      forwardDnsStatus,
      verified: true,
    };

    crawlerVerificationCache.set(cacheKey, { result: res, expiresAt: Date.now() + VERIFIED_TTL_MS });
    return res;
  }

  // 2. FCrDNS Crawlers (Googlebot, Bingbot, Applebot, etc.)
  let reverseDnsHostnames: string[] = [];
  let reverseDnsStatus: "none" | "matched" | "mismatch" | "timeout" | "error" = "none";
  let forwardDnsIps: string[] = [];
  let forwardDnsStatus: "none" | "matched" | "mismatch" | "timeout" | "error" = "none";
  let failureReason: string | undefined;

  try {
    reverseDnsHostnames = await withTimeout(
      reverseFn(ip),
      dnsTimeoutMs,
      "Reverse DNS lookup timed out"
    );

    if (reverseDnsHostnames.length > 0) {
      const matchesDomain = reverseDnsHostnames.some((h) =>
        expectedDomains.some((dom) => h.toLowerCase().endsWith(dom))
      );

      if (matchesDomain) {
        reverseDnsStatus = "matched";
        const matchingHost = reverseDnsHostnames.find((h) =>
          expectedDomains.some((dom) => h.toLowerCase().endsWith(dom))
        )!;

        try {
          forwardDnsIps = await withTimeout(
            resolveFn(matchingHost),
            dnsTimeoutMs,
            "Forward DNS lookup timed out"
          );
          if (forwardDnsIps.includes(ip)) {
            forwardDnsStatus = "matched";
          } else {
            forwardDnsStatus = "mismatch";
            failureReason = `forward_dns_mismatch: ${matchingHost} does not resolve to ${ip}`;
          }
        } catch (fwdErr: any) {
          forwardDnsStatus = fwdErr.code === "ETIMEOUT" ? "timeout" : "error";
          failureReason = `forward_dns_${forwardDnsStatus}: ${fwdErr.message}`;
        }
      } else {
        reverseDnsStatus = "mismatch";
        failureReason = `ptr_domain_mismatch: [${reverseDnsHostnames.join(", ")}] not in ${expectedDomains.join(", ")}`;
      }
    } else {
      reverseDnsStatus = "none";
      failureReason = "no_ptr_record";
    }
  } catch (revErr: any) {
    if (revErr.code === "ETIMEOUT") {
      reverseDnsStatus = "timeout";
      failureReason = "dns_timeout: Reverse lookup timed out";
    } else if (revErr.code === "ENOTFOUND" || revErr.code === "ENODATA" || revErr.code === "NXDOMAIN") {
      reverseDnsStatus = "none";
      failureReason = "no_ptr_record: Host not found";
    } else {
      reverseDnsStatus = "error";
      failureReason = `reverse_dns_error: ${revErr.message}`;
    }
  }

  const isVerified = reverseDnsStatus === "matched" && forwardDnsStatus === "matched";
  const status: VerificationStatus = isVerified ? "VERIFIED_CRAWLER" : "UNVERIFIED_CRAWLER";

  const res: CrawlerVerificationResult = {
    status,
    crawlerType,
    ip,
    userAgent: ua,
    ipRangeMatch: false,
    reverseDnsHostnames,
    reverseDnsStatus,
    forwardDnsIps,
    forwardDnsStatus,
    verified: isVerified,
    failureReason: isVerified ? undefined : failureReason,
  };

  crawlerVerificationCache.set(cacheKey, {
    result: res,
    expiresAt: Date.now() + (isVerified ? VERIFIED_TTL_MS : UNVERIFIED_TTL_MS),
  });
  return res;
}

export async function checkIsRealCrawler(ip: string, ua: string): Promise<boolean> {
  const result = await verifyCrawler(ip, ua);
  return result.verified;
}

export async function crawlerVerificationMiddleware(req: Request, res: Response, next: NextFunction) {
  const ua = req.get("User-Agent") || "";
  const crawlerType = detectCrawlerType(ua);

  if (crawlerType === "None") {
    (req as any).isRealCrawler = false;
    (req as any).crawlerVerification = {
      status: "NOT_A_CRAWLER",
      crawlerType: "None",
      verified: false,
    };
    return next();
  }

  const ip = resolveRequestIp(req);
  const result = await verifyCrawler(ip, ua);

  // Attach structured verification result to request
  (req as any).isRealCrawler = result.verified;
  (req as any).crawlerVerification = result;

  // Structured logging upon response completion
  res.on("finish", () => {
    const statusCode = res.statusCode;
    const endpoint = req.originalUrl || req.url;
    const ts = new Date().toISOString();
    const rangeMatchStr = result.ipRangeMatch
      ? `true (${result.matchedPrefix || "matched"})`
      : "false";
    const ptrStr =
      result.reverseDnsHostnames.length > 0
        ? result.reverseDnsHostnames.join(",")
        : result.reverseDnsStatus;
    const fwdStr =
      result.forwardDnsIps.length > 0
        ? result.forwardDnsIps.join(",")
        : result.forwardDnsStatus;

    if (result.status === "VERIFIED_OPENAI" || result.status === "VERIFIED_CRAWLER") {
      console.log(
        `[Crawler] ${result.status} type=${result.crawlerType} ip=${ip} endpoint=${endpoint} ` +
        `status=${statusCode} timestamp=${ts} ua="${ua}" range_match=${rangeMatchStr} ptr="${ptrStr}" fwd="${fwdStr}"`
      );
    } else if (result.status === "UNVERIFIED_CRAWLER") {
      console.warn(
        `[Security Alert] Crawler User-Agent spoof detected from IP=${ip}, UA="${ua}" type=${result.crawlerType} ` +
        `reason="${result.failureReason}" endpoint=${endpoint} status=${statusCode} timestamp=${ts}`
      );
      console.log(
        `[Crawler] UNVERIFIED_CRAWLER type=${result.crawlerType} ip=${ip} endpoint=${endpoint} ` +
        `status=${statusCode} timestamp=${ts} ua="${ua}" range_match=${rangeMatchStr} ptr="${ptrStr}" ` +
        `fwd="${fwdStr}" reason="${result.failureReason}"`
      );
    }
  });

  next();
}

// Background auto-refresh of OpenAI IP ranges (every 24 hours)
let refreshTimer: NodeJS.Timeout | null = null;

export async function refreshOpenAiIpRanges(): Promise<boolean> {
  const fetchWithTimeout = async (url: string) => {
    const res = await withTimeout(
      fetch(url, { headers: { "User-Agent": "AlWakeelo-Bot-Verifier/1.0" } }),
      5000,
      `Fetching ${url} timed out`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  try {
    const [sb, cu, gb] = await Promise.all([
      fetchWithTimeout("https://openai.com/searchbot.json"),
      fetchWithTimeout("https://openai.com/chatgpt-user.json"),
      fetchWithTimeout("https://openai.com/gptbot.json"),
    ]);

    if (Array.isArray(sb?.prefixes)) openAiPrefixes.searchbot = sb.prefixes;
    if (Array.isArray(cu?.prefixes)) openAiPrefixes.chatgptUser = cu.prefixes;
    if (Array.isArray(gb?.prefixes)) openAiPrefixes.gptbot = gb.prefixes;

    console.log(
      `[CrawlerVerifier] Successfully refreshed OpenAI IP ranges: SearchBot=${openAiPrefixes.searchbot.length}, ChatGPT-User=${openAiPrefixes.chatgptUser.length}, GPTBot=${openAiPrefixes.gptbot.length}`
    );
    return true;
  } catch (err: any) {
    console.warn(`[CrawlerVerifier] Failed to refresh live OpenAI ranges: ${err.message}. Using bundled ranges.`);
    return false;
  }
}

export function startOpenAiRangeAutoRefresh(intervalMs = 24 * 60 * 60 * 1000): void {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    refreshOpenAiIpRanges().catch(() => {});
  }, intervalMs);
  refreshTimer.unref?.();
}
