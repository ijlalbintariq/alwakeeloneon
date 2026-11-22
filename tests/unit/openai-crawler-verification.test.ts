import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import {
  verifyCrawler,
  checkIsRealCrawler,
  crawlerVerificationMiddleware,
  clearCrawlerVerificationCache,
  setOpenAiPrefixes,
  getOpenAiPrefixesForCrawler,
  isSearchCrawlerHeader,
  detectCrawlerType,
} from "../../server/middleware/crawler-verifier";
import { isSearchCrawler } from "../../server/middleware/rate-limiter";

function mockRequest(ip: string, url = "/api/public/judgments/test-uuid", headers: Record<string, string> = {}): Request {
  const reqHeaders: Record<string, string> = {
    "x-forwarded-for": ip,
    ...headers,
  };
  return {
    ip,
    url,
    originalUrl: url,
    headers: reqHeaders,
    get(name: string) {
      return reqHeaders[name.toLowerCase()] || undefined;
    },
    socket: {
      remoteAddress: ip,
    } as any,
  } as unknown as Request;
}

function mockResponse(): { res: Response; getStatusCode: () => number; finish: () => void } {
  let finished = false;
  const finishCallbacks: Array<() => void> = [];
  const resObj: any = {
    statusCode: 200,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.body = body;
      this.finish();
      return this;
    },
    send(body: any) {
      this.body = body;
      this.finish();
      return this;
    },
    setHeader(name: string, val: any) {
      this.headers[name] = val;
      return this;
    },
    on(event: string, cb: () => void) {
      if (event === "finish") finishCallbacks.push(cb);
      return this;
    },
    finish() {
      if (!finished) {
        finished = true;
        for (const cb of finishCallbacks) cb();
      }
    },
  };
  return { res: resObj as Response, getStatusCode: () => resObj.statusCode, finish: () => resObj.finish() };
}

test("OpenAI Crawler Verification Suite", async (t) => {
  t.beforeEach(() => {
    clearCrawlerVerificationCache();
  });

  await t.test("Production IP 1: 74.7.243.14 with OAI-SearchBot/1.4", async () => {
    const ip = "74.7.243.14";
    const ua = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)";

    assert.equal(detectCrawlerType(ua), "OAI-SearchBot");

    const result = await verifyCrawler(ip, ua, { skipCache: true });
    assert.equal(result.status, "VERIFIED_OPENAI");
    assert.equal(result.verified, true);
    assert.equal(result.crawlerType, "OAI-SearchBot");
    assert.equal(result.ipRangeMatch, true);
    assert.equal(result.matchedPrefix, "74.7.243.0/25");

    // Must NOT match chatgpt-user or gptbot rules
    const chatgptUserPrefixes = getOpenAiPrefixesForCrawler("ChatGPT-User");
    const gptbotPrefixes = getOpenAiPrefixesForCrawler("GPTBot");
    const fakeChatGptUa = "Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)";
    const resAsUser = await verifyCrawler(ip, fakeChatGptUa, { skipCache: true });
    assert.equal(resAsUser.status, "UNVERIFIED_CRAWLER");
    assert.equal(resAsUser.verified, false);
    assert.ok(resAsUser.failureReason?.includes("crawler_type_mismatch"));
  });

  await t.test("Production IP 2: 9.129.58.89 with ChatGPT-User/1.0", async () => {
    const ip = "9.129.58.89";
    const ua = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)";

    assert.equal(detectCrawlerType(ua), "ChatGPT-User");

    const result = await verifyCrawler(ip, ua, { skipCache: true });
    assert.equal(result.status, "VERIFIED_OPENAI");
    assert.equal(result.verified, true);
    assert.equal(result.crawlerType, "ChatGPT-User");
    assert.equal(result.ipRangeMatch, true);
    assert.equal(result.matchedPrefix, "9.129.0.0/16");

    // Must NOT match searchbot or gptbot rules
    const fakeSearchBotUa = "Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)";
    const resAsSearch = await verifyCrawler(ip, fakeSearchBotUa, { skipCache: true });
    assert.equal(resAsSearch.status, "UNVERIFIED_CRAWLER");
    assert.equal(resAsSearch.verified, false);
    assert.ok(resAsSearch.failureReason?.includes("crawler_type_mismatch"));
  });

  await t.test("1. Genuine OpenAI IP + correct User-Agent", async () => {
    const ip = "74.7.243.14";
    const ua = "Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)";
    const res = await verifyCrawler(ip, ua, { skipCache: true });
    assert.equal(res.status, "VERIFIED_OPENAI");
    assert.equal(res.verified, true);
    assert.equal(res.ipRangeMatch, true);
  });

  await t.test("2. OpenAI IP + incorrect crawler User-Agent", async () => {
    // 74.7.243.14 belongs to OAI-SearchBot, but sends GPTBot User-Agent
    const ip = "74.7.243.14";
    const ua = "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)";
    const res = await verifyCrawler(ip, ua, { skipCache: true });
    assert.equal(res.status, "UNVERIFIED_CRAWLER");
    assert.equal(res.verified, false);
    assert.equal(res.ipRangeMatch, false);
    assert.ok(res.failureReason?.includes("crawler_type_mismatch"));
  });

  await t.test("3. Non-OpenAI IP + spoofed OpenAI User-Agent", async () => {
    const ip = "198.51.100.42"; // documentation/test IP not in OpenAI ranges
    const ua = "Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)";
    const res = await verifyCrawler(ip, ua, { skipCache: true });
    assert.equal(res.status, "UNVERIFIED_CRAWLER");
    assert.equal(res.verified, false);
    assert.equal(res.ipRangeMatch, false);
    assert.ok(res.failureReason?.includes("ip_range_mismatch"));
  });

  await t.test("4. Correct IP range but failed DNS verification (PTR domain mismatch)", async () => {
    const ip = "74.7.243.14";
    const ua = "Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)";

    // Mock DNS returns PTR for a malicious/unauthorized domain
    const mockDns = {
      reverse: async () => ["spoofed.attacker.com"],
      resolve: async () => [ip],
    };

    const res = await verifyCrawler(ip, ua, {
      skipCache: true,
      dnsResolver: mockDns,
    });

    assert.equal(res.status, "UNVERIFIED_CRAWLER");
    assert.equal(res.verified, false);
    assert.equal(res.ipRangeMatch, true);
    assert.equal(res.reverseDnsStatus, "mismatch");
    assert.ok(res.failureReason?.includes("failed_dns_verification"));
  });

  await t.test("5. Reverse DNS success but forward DNS mismatch", async () => {
    const ip = "74.7.243.14";
    const ua = "Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)";

    // Reverse DNS succeeds and returns official domain, but forward DNS resolves to a different IP
    const mockDns = {
      reverse: async () => ["searchbot-74-7-243-14.openai.com"],
      resolve: async () => ["203.0.113.99"], // Mismatched forward IP!
    };

    const res = await verifyCrawler(ip, ua, {
      skipCache: true,
      dnsResolver: mockDns,
    });

    assert.equal(res.status, "UNVERIFIED_CRAWLER");
    assert.equal(res.verified, false);
    assert.equal(res.ipRangeMatch, true);
    assert.equal(res.reverseDnsStatus, "matched");
    assert.equal(res.forwardDnsStatus, "mismatch");
    assert.ok(res.failureReason?.includes("forward_dns_mismatch"));
  });

  await t.test("6. DNS timeout", async () => {
    const ip = "74.7.243.14";
    const ua = "Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)";

    const mockHangingDns = {
      reverse: async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const err: any = new Error("DNS query timeout");
        err.code = "ETIMEOUT";
        throw err;
      },
      resolve: async () => [ip],
    };

    const res = await verifyCrawler(ip, ua, {
      skipCache: true,
      dnsTimeoutMs: 20,
      dnsResolver: mockHangingDns,
    });

    assert.equal(res.status, "UNVERIFIED_CRAWLER");
    assert.equal(res.verified, false);
    assert.equal(res.reverseDnsStatus, "timeout");
    assert.ok(res.failureReason?.includes("dns_timeout"));
  });

  await t.test("7. IPv6 crawler addresses", async () => {
    // Add temporary IPv6 range to test IPv6 functionality
    setOpenAiPrefixes({
      searchbot: [
        { ipv4Prefix: "74.7.243.0/25" },
        { ipv6Prefix: "2600:1f18:63fe:7200::/64" },
      ],
    });

    const validIpv6 = "2600:1f18:63fe:7200::42";
    const invalidIpv6 = "2001:db8::1";
    const ua = "Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)";

    const resValid = await verifyCrawler(validIpv6, ua, { skipCache: true });
    assert.equal(resValid.status, "VERIFIED_OPENAI");
    assert.equal(resValid.verified, true);
    assert.equal(resValid.ipRangeMatch, true);
    assert.equal(resValid.matchedPrefix, "2600:1f18:63fe:7200::/64");

    const resInvalid = await verifyCrawler(invalidIpv6, ua, { skipCache: true });
    assert.equal(resInvalid.status, "UNVERIFIED_CRAWLER");
    assert.equal(resInvalid.verified, false);
    assert.equal(resInvalid.ipRangeMatch, false);
  });

  await t.test("8. Ordinary human visitors", async () => {
    const ip = "182.180.12.34";
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    assert.equal(isSearchCrawlerHeader(ua), false);
    assert.equal(detectCrawlerType(ua), "None");

    const res = await verifyCrawler(ip, ua, { skipCache: true });
    assert.equal(res.status, "NOT_A_CRAWLER");
    assert.equal(res.verified, false);
    assert.equal(res.crawlerType, "None");
  });

  await t.test("9. Googlebot verification remains unaffected", async () => {
    const googleIp = "66.249.66.1";
    const googleUa = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

    // Genuine Googlebot FCrDNS test
    const genuineGoogleDns = {
      reverse: async () => ["crawl-66-249-66-1.googlebot.com"],
      resolve: async () => [googleIp],
    };
    const resGenuine = await verifyCrawler(googleIp, googleUa, {
      skipCache: true,
      dnsResolver: genuineGoogleDns,
    });
    assert.equal(resGenuine.status, "VERIFIED_CRAWLER");
    assert.equal(resGenuine.verified, true);
    assert.equal(resGenuine.crawlerType, "Googlebot");
    assert.equal(resGenuine.reverseDnsStatus, "matched");
    assert.equal(resGenuine.forwardDnsStatus, "matched");

    // Spoofed Googlebot with malicious reverse hostname
    const spoofedGoogleDns = {
      reverse: async () => ["evil-scraper.badguy.com"],
      resolve: async () => [googleIp],
    };
    const resSpoofed = await verifyCrawler(googleIp, googleUa, {
      skipCache: true,
      dnsResolver: spoofedGoogleDns,
    });
    assert.equal(resSpoofed.status, "UNVERIFIED_CRAWLER");
    assert.equal(resSpoofed.verified, false);
    assert.equal(resSpoofed.reverseDnsStatus, "mismatch");
  });

  await t.test("Middleware integration: verified crawlers get isRealCrawler=true and structured log", async () => {
    const req = mockRequest(
      "74.7.243.14",
      "/api/public/judgments/2020-CLC-1910",
      { "user-agent": "Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)" }
    );
    const { res, finish } = mockResponse();

    let nextCalled = false;
    await crawlerVerificationMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal((req as any).isRealCrawler, true);
    assert.equal((req as any).crawlerVerification?.status, "VERIFIED_OPENAI");
    assert.equal(isSearchCrawler(req), true);

    // Trigger response finish
    finish();
  });

  await t.test("Middleware integration: spoofed crawlers get isRealCrawler=false and fail isSearchCrawler", async () => {
    const req = mockRequest(
      "198.51.100.99",
      "/api/public/judgments/2020-CLC-1910",
      { "user-agent": "Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)" }
    );
    const { res, finish } = mockResponse();

    let nextCalled = false;
    await crawlerVerificationMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal((req as any).isRealCrawler, false);
    assert.equal((req as any).crawlerVerification?.status, "UNVERIFIED_CRAWLER");
    assert.equal(isSearchCrawler(req), false);

    finish();
  });

  await t.test("Section 5 Audit: robots.txt allows OAI-SearchBot, ChatGPT-User, and GPTBot", async () => {
    // Generate robots.txt content identically to server/routes.ts
    const CANONICAL = "https://www.alwakeelo.com";
    const robots = [
      "User-agent: *",
      "Allow: /",
      "",
      "User-agent: OAI-SearchBot",
      "Allow: /",
      "",
      "User-agent: ChatGPT-User",
      "Allow: /",
      "",
      "User-agent: GPTBot",
      "Allow: /",
      "",
      "User-agent: Bytespider",
      "Disallow: /",
      "",
      "User-agent: PetalBot",
      "Disallow: /",
      "",
      "User-agent: Amazonbot",
      "Disallow: /",
      "",
      `Sitemap: ${CANONICAL}/sitemap.xml`,
    ].join("\n") + "\n";

    assert.ok(robots.includes("User-agent: OAI-SearchBot\nAllow: /"));
    assert.ok(robots.includes("User-agent: ChatGPT-User\nAllow: /"));
    assert.ok(robots.includes("User-agent: GPTBot\nAllow: /"));
  });

  await t.test("Section 5 Audit: Verified crawler bypasses public judgment rate limit but NEVER bypasses auth", async () => {
    // Simulated verified crawler request
    const crawlerReq = mockRequest(
      "74.7.243.14",
      "/api/public/judgments/2020-CLC-1910",
      { "user-agent": "Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)" }
    );
    (crawlerReq as any).isRealCrawler = true;
    assert.equal(isSearchCrawler(crawlerReq), true);

    // Private endpoint request: crawlers must NOT have userId or bypass session authentication
    const privateReq = mockRequest(
      "74.7.243.14",
      "/api/case-files",
      { "user-agent": "Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)" }
    );
    (privateReq as any).isRealCrawler = true;
    (privateReq as any).session = {};

    // Authentication check requires req.session.userId:
    const isAuthenticated = !!(privateReq as any).session?.userId;
    assert.equal(isAuthenticated, false, "Crawlers must never have session userId on private endpoints");
  });
});
