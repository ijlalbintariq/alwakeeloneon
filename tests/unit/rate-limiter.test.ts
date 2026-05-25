import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import { createRateLimiter } from "../../server/middleware/rate-limiter";

function mockRequest(ip: string, originalUrl = "/api/test", headers: Record<string, string> = {}): Partial<Request> {
  return {
    ip,
    originalUrl,
    headers: {
      "x-forwarded-for": ip,
      ...headers,
    },
    get(name: string) {
      return this.headers?.[name.toLowerCase()] as string || undefined;
    },
    socket: {
      remoteAddress: ip,
    } as any,
  };
}

function mockResponse(): Partial<Response> {
  const headers: Record<string, any> = {};
  const res: Partial<Response> = {
    statusCode: 200,
    headers,
    setHeader(name: string, value: any) {
      headers[name] = value;
      return this as Response;
    },
    status(code: number) {
      this.statusCode = code;
      return this as Response;
    },
    json(body: any) {
      (this as any).body = body;
      return this as Response;
    },
  };
  return res;
}

test("Rate limiter allows requests under the limit and sets headers", async () => {
  const limiter = createRateLimiter({
    windowMs: 5000,
    max: 3,
    keyPrefix: "test-limit-1",
  });

  const req = mockRequest("192.168.1.1");
  const res = mockResponse();
  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  limiter(req as Request, res as Response, next);

  assert.ok(nextCalled, "next() should have been called");
  assert.equal(res.headers?.["X-RateLimit-Limit"], 3);
  assert.equal(res.headers?.["X-RateLimit-Remaining"], 2);
  assert.ok(typeof res.headers?.["X-RateLimit-Reset"] === "number");
});

test("Rate limiter blocks requests over the limit", async () => {
  const limiter = createRateLimiter({
    windowMs: 10000,
    max: 2,
    keyPrefix: "test-limit-2",
  });

  const req = mockRequest("192.168.1.2");
  
  // Call 1
  const res1 = mockResponse();
  let next1 = false;
  limiter(req as Request, res1 as Response, () => { next1 = true; });
  assert.ok(next1);
  assert.equal(res1.headers?.["X-RateLimit-Remaining"], 1);

  // Call 2
  const res2 = mockResponse();
  let next2 = false;
  limiter(req as Request, res2 as Response, () => { next2 = true; });
  assert.ok(next2);
  assert.equal(res2.headers?.["X-RateLimit-Remaining"], 0);

  // Call 3 (Blocked!)
  const res3 = mockResponse();
  let next3 = false;
  limiter(req as Request, res3 as Response, () => { next3 = true; });
  
  assert.ok(!next3, "next() should NOT be called on blocked request");
  assert.equal(res3.statusCode, 429);
  assert.equal((res3 as any).body?.message, "Too many requests. Please try again shortly.");
  assert.equal(res3.headers?.["X-RateLimit-Remaining"], 0);
});

test("Rate limiter supports skip option", async () => {
  const limiter = createRateLimiter({
    windowMs: 5000,
    max: 1,
    keyPrefix: "test-limit-3",
    skip: (req) => req.originalUrl === "/api/skip-me",
  });

  const req1 = mockRequest("192.168.1.3", "/api/skip-me");
  const res1 = mockResponse();
  let next1 = false;
  limiter(req1 as Request, res1 as Response, () => { next1 = true; });
  assert.ok(next1);

  // Call 2 - since skipped, it doesn't count towards the rate limit
  const req2 = mockRequest("192.168.1.3", "/api/skip-me");
  const res2 = mockResponse();
  let next2 = false;
  limiter(req2 as Request, res2 as Response, () => { next2 = true; });
  assert.ok(next2);

  // Call 3 - normal URL will count and trigger rate limit immediately since max is 1
  const req3 = mockRequest("192.168.1.3", "/api/normal");
  const res3 = mockResponse();
  let next3 = false;
  limiter(req3 as Request, res3 as Response, () => { next3 = true; });
  assert.ok(next3);

  // Call 4 - normal URL blocked
  const req4 = mockRequest("192.168.1.3", "/api/normal");
  const res4 = mockResponse();
  let next4 = false;
  limiter(req4 as Request, res4 as Response, () => { next4 = true; });
  assert.ok(!next4);
  assert.equal(res4.statusCode, 429);
});
