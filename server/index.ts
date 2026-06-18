import "./load-env";
import "./proxy-env";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { dbAvailable, dbUnavailableReason, pool } from "./db";
import { recordSecurityEvent } from "./security-monitoring";
import { authRateLimiter, aiRateLimiter, globalApiRateLimiter, crawlerVerificationMiddleware } from "./middleware/rate-limiter";

const app = express();
const httpServer = createServer(app);
app.disable("x-powered-by");
app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "10mb" }));

app.use(crawlerVerificationMiddleware);

app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "production") return next();

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const isHttps = req.secure || forwardedProto === "https";

  if (isHttps) return next();
  if (req.path.startsWith("/health")) return next();

  const host = req.get("host");
  if (!host) return next();
  return res.redirect(308, `https://${host}${req.originalUrl}`);
});

// Redirect non-www to www in production — fixes Google's
// "Duplicate, Google chose different canonical than user" warning.
// Canonical is www.alwakeelo.com (matches sitemap, canonical tags, OG tags).
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "production") return next();

  const host = req.get("host") || "";
  // Only redirect the apex domain to www — skip if already www or other subdomain
  if (host === "alwakeelo.com") {
    return res.redirect(301, `https://www.alwakeelo.com${req.originalUrl}`);
  }
  return next();
});

const SAFE_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isSameOriginRequest(req: Request): boolean {
  const host = req.get("host");
  if (!host) return false;

  const expectedOrigin = `${req.protocol}://${host}`;
  const origin = req.get("origin");
  if (origin) {
    return origin === expectedOrigin;
  }

  const referer = req.get("referer");
  if (!referer) {
    // Non-browser clients often omit Origin/Referer. Keep API compatibility.
    return true;
  }

  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
}

function shouldLogResponseBody(path: string): boolean {
  // Never log response bodies for sensitive or high-volume endpoints
  if (path.startsWith("/api/auth")) return false;
  if (path.startsWith("/api/ai")) return false;
  if (path.startsWith("/api/apex")) return false;
  if (path.startsWith("/api/documents")) return false;
  if (path.startsWith("/api/bookmarks")) return false;
  if (path.startsWith("/api/threads")) return false;
  if (path.startsWith("/api/public/judgments")) return false;
  if (path.startsWith("/api/search-history")) return false;
  if (path.startsWith("/api/activity")) return false;
  if (path.startsWith("/api/usage")) return false;
  if (path.startsWith("/api/diary")) return false;
  if (path.startsWith("/api/rag")) return false;
  // Only log bodies for admin, health, and error-level responses
  return true;
}

function compactResponseBody(body: unknown): string {
  const raw = JSON.stringify(body);
  if (!raw) return "";
  const limit = 800;
  if (raw.length <= limit) return raw;
  return `${raw.slice(0, limit)}...<truncated>`;
}

function buildContentSecurityPolicy(isProduction: boolean): string {
  const directives: string[] = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
    "worker-src 'self' blob:",
    "frame-src 'self' https://accounts.google.com",
    "form-action 'self'",
  ];

  if (isProduction) {
    directives.push("script-src 'self' https://accounts.google.com https://pagead2.googlesyndication.com");
    directives.push("connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://pagead2.googlesyndication.com");
    directives.push("upgrade-insecure-requests");
  } else {
    directives.push("script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com");
    directives.push("connect-src 'self' ws: wss: http: https:");
  }

  return directives.join("; ");
}

function getClientIdentifier(req: Request): string {
  // Use req.ip which respects Express's `trust proxy` setting.
  // DO NOT read x-forwarded-for directly — it is client-spoofable.
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function isRequestAbortedError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || "").toUpperCase();
  const message = String(err.message || "").toLowerCase();
  return (
    code === "ECONNRESET" ||
    code === "ECONNABORTED" ||
    code === "ERR_STREAM_PREMATURE_CLOSE" ||
    message.includes("request aborted") ||
    message.includes("socket hang up")
  );
}

app.use((req, res, next) => {
  const isProduction = process.env.NODE_ENV === "production";
  const isAuthPage = req.path === "/auth";
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // Google Identity Services popup flow can fail with strict same-origin COOP.
  // Allow popups on auth page while keeping stricter policy elsewhere.
  res.setHeader("Cross-Origin-Opener-Policy", isAuthPage ? "same-origin-allow-popups" : "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Origin-Agent-Cluster", "?1");
  res.setHeader("Content-Security-Policy", buildContentSecurityPolicy(isProduction));

  if (isProduction) {
    const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const isHttps = req.secure || forwardedProto === "https";
    if (isHttps) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
  }

  const isUnsafeMethod = !SAFE_HTTP_METHODS.has(req.method.toUpperCase());
  if (req.path.startsWith("/api") && isUnsafeMethod && !isSameOriginRequest(req)) {
    recordSecurityEvent("csrf_block", getClientIdentifier(req), {
      method: req.method,
      path: req.path,
      origin: req.get("origin") || null,
      referer: req.get("referer") || null,
    });
    return res.status(403).json({ message: "Cross-site request blocked." });
  }

  return next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && shouldLogResponseBody(path)) {
        logLine += ` :: ${compactResponseBody(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const { isPdfOcrAvailable } = await import("./ocr");
  const { isCloudPdfOcrAvailable, getCloudPdfOcrProviderName } = await import("./cloud-ocr");
  const localOcrEnabled = await isPdfOcrAvailable();
  const cloudOcrEnabled = isCloudPdfOcrAvailable();
  const cloudProvider = getCloudPdfOcrProviderName();
  console.log(
    `[Startup] PDF OCR local=${localOcrEnabled ? "enabled" : "disabled"} (requires tesseract + pdftoppm), cloud=${cloudOcrEnabled ? `enabled(${cloudProvider})` : "disabled"}.`,
  );

  if (dbAvailable) {
    // Wrap DB startup tasks in a timeout to prevent port-binding failures on Render.
    // If any migration/seed hangs, the server still starts with degraded DB features.
    const DB_STARTUP_TIMEOUT_MS = 120_000; // 2 minutes
    const dbStartupPromise = (async () => {
      const { ensureSearchIndexes } = await import("./storage");
      await ensureSearchIndexes();

      const { initializeSecurityGovernance } = await import("./security-governance");
      await initializeSecurityGovernance();

      const { seedAdminUser } = await import("./seed-admin");
      await seedAdminUser();

      // Ensure ai_output_log table exists (drizzle-kit push may not run in Docker)
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS ai_output_log (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR NOT NULL REFERENCES users(id),
            feature TEXT NOT NULL,
            model TEXT NOT NULL,
            input_snippet TEXT NOT NULL,
            output_snippet TEXT NOT NULL,
            output_length INTEGER NOT NULL DEFAULT 0,
            quality_score INTEGER NOT NULL DEFAULT 4,
            quality_flags TEXT[] NOT NULL DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        console.log("[Startup] ai_output_log table ready.");
      } catch (err: any) {
        console.warn("[Startup] Could not ensure ai_output_log table:", err?.message);
      }

      console.log("[Startup] All DB startup tasks completed.");
    })();

    const dbStartupTimeout = new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        console.error(`[Startup] DB startup tasks did not complete within ${DB_STARTUP_TIMEOUT_MS / 1000}s — continuing server startup without full DB initialization.`);
        resolve();
      }, DB_STARTUP_TIMEOUT_MS);
      // Don't hold the process open for the timeout alone
      if (timer.unref) timer.unref();
      dbStartupPromise.then(() => {
        clearTimeout(timer);
        resolve();
      });
    });

    await Promise.race([dbStartupPromise, dbStartupTimeout]).catch((err) => {
      console.error("[Startup] DB startup tasks failed:", err);
    });
  } else {
    console.warn(`[Startup] Skipping DB startup tasks. ${dbUnavailableReason || ""}`.trim());
  }

  // Apply rate limiters to protect API routes before registering route handlers
  app.use("/api/auth", authRateLimiter);
  app.use("/api/ai", aiRateLimiter);
  app.use("/api/apex", aiRateLimiter);
  app.use("/api", globalApiRateLimiter);

  await registerRoutes(httpServer, app);

  // Start diary email scheduler (daily/weekly digests)
  if (dbAvailable) {
    try {
      const { startDiaryEmailScheduler } = await import("./diary-mailer");
      startDiaryEmailScheduler();
    } catch (err: any) {
      console.warn("[Startup] Could not start diary email scheduler:", err?.message);
    }
  }

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/health/ocr", async (_req, res) => {
    const { isPdfOcrAvailable } = await import("./ocr");
    const { isCloudPdfOcrAvailable, getCloudPdfOcrProviderName } = await import("./cloud-ocr");
    const localEnabled = await isPdfOcrAvailable();
    const cloudEnabled = isCloudPdfOcrAvailable();
    const cloudProvider = getCloudPdfOcrProviderName();
    const enabled = localEnabled || cloudEnabled;
    res.status(enabled ? 200 : 503).json({
      ok: enabled,
      local: {
        ok: localEnabled,
        dependencies: {
          tesseract: "required",
          pdftoppm: "required",
        },
      },
      cloud: {
        ok: cloudEnabled,
        provider: cloudProvider,
        apiKey: cloudEnabled ? "configured" : "missing",
      },
    });
  });

  app.get("/health/db", async (_req, res) => {
    const rawUrl = process.env.DATABASE_URL;
    const pgHost = (process.env.PGHOST || "").trim() || null;
    let host: string | null = null;
    let configured = false;

    if (rawUrl && rawUrl.trim()) {
      configured = true;
      try {
        host = new URL(rawUrl).hostname || null;
      } catch {
        host = null;
      }
    }

    if (!pool) {
      return res.status(503).json({
        ok: false,
        configured,
        host,
        pgHost,
        reason: dbUnavailableReason || "Database pool is not initialized.",
      });
    }

    try {
      await pool.query("select 1");
      return res.json({
        ok: true,
        configured,
        host,
        pgHost,
      });
    } catch (err: any) {
      return res.status(503).json({
        ok: false,
        configured,
        host,
        pgHost,
        reason: err?.message || "Database connectivity check failed.",
      });
    }
  });

  app.use("/api", (_req, res) => {
    return res.status(404).json({ message: "API route not found." });
  });

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (isRequestAbortedError(err) || req.aborted) {
      console.warn(
        `[Request Aborted] ${req.method} ${req.path} :: ${err?.message || "Client disconnected before request completed"}`,
      );
      if (res.headersSent) {
        return next(err);
      }
      return res.status(499).json({ message: "Request was aborted before completion." });
    }

    if (err?.code === "LIMIT_FILE_SIZE") {
      if (res.headersSent) return next(err);
      return res.status(413).json({ message: "Uploaded file exceeds server file-size limit." });
    }
    if (err?.code === "LIMIT_FILE_COUNT" || err?.code === "LIMIT_UNEXPECTED_FILE") {
      if (res.headersSent) return next(err);
      return res.status(400).json({ message: "Too many files were uploaded in one request." });
    }
    if (err instanceof SyntaxError && err && "body" in err) {
      if (res.headersSent) return next(err);
      return res.status(400).json({ message: "Malformed JSON payload." });
    }

    const status = err.status || err.statusCode || 500;
    const message = status >= 500
      ? "Internal Server Error"
      : (typeof err?.message === "string" && err.message.trim() ? err.message : "Request failed");

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Serve API + client on the configured port. In local/dev, gracefully
  // fall back if 5000 is already occupied by another process.
  const preferredPort = parseInt(process.env.PORT || "5000", 10);
  const fallbackPort = parseInt(process.env.DEV_PORT_FALLBACK || "5001", 10);
  const host = "0.0.0.0";
  const allowPortFallback = process.env.NODE_ENV !== "production";
  let reportedListening = false;

  const startServer = (port: number) => {
    httpServer.once("error", (err: any) => {
      if (
        allowPortFallback &&
        err?.code === "EADDRINUSE" &&
        port === preferredPort &&
        fallbackPort !== preferredPort
      ) {
        console.warn(`[Startup] Port ${preferredPort} is busy. Retrying on ${fallbackPort}.`);
        startServer(fallbackPort);
        return;
      }

      console.error("[Startup] Failed to bind HTTP server:", err);
      process.exit(1);
    });

    httpServer.listen(port, host, () => {
      if (reportedListening) return;
      reportedListening = true;
      const addr = httpServer.address();
      const boundPort = typeof addr === "object" && addr ? addr.port : port;
      log(`serving on port ${boundPort}`);
      if (boundPort !== preferredPort) {
        log(`PORT fallback active. Set PORT=${boundPort} to make this explicit.`, "startup");
      }
    });
  };

  startServer(preferredPort);
})();
