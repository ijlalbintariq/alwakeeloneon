import "./load-env";
import "./proxy-env";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { dbAvailable, dbUnavailableReason, pool } from "./db";
import { recordSecurityEvent } from "./security-monitoring";

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
  if (path.startsWith("/api/auth")) return false;
  if (path.startsWith("/api/ai")) return false;
  if (path.startsWith("/api/apex/chat")) return false;
  if (path.startsWith("/api/documents/upload")) return false;
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
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "worker-src 'self' blob:",
    "frame-src 'self' https://accounts.google.com",
    "form-action 'self'",
  ];

  if (isProduction) {
    directives.push("script-src 'self' https://accounts.google.com");
    directives.push("connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com");
    directives.push("upgrade-insecure-requests");
  } else {
    directives.push("script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com");
    directives.push("connect-src 'self' ws: wss: http: https:");
  }

  return directives.join("; ");
}

function getClientIdentifier(req: Request): string {
  const forwarded = req.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.ip || req.socket.remoteAddress || "unknown";
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
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
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
  const ocrEnabled = await isPdfOcrAvailable();
  console.log(`[Startup] PDF OCR ${ocrEnabled ? "enabled" : "disabled"} (requires tesseract + pdftoppm).`);

  if (dbAvailable) {
    const { ensureSearchIndexes } = await import("./storage");
    await ensureSearchIndexes();

    const { initializeSecurityGovernance } = await import("./security-governance");
    await initializeSecurityGovernance();

    const { seedAdminUser } = await import("./seed-admin");
    await seedAdminUser();
  } else {
    console.warn(`[Startup] Skipping DB startup tasks. ${dbUnavailableReason || ""}`.trim());
  }

  await registerRoutes(httpServer, app);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/health/ocr", async (_req, res) => {
    const { isPdfOcrAvailable } = await import("./ocr");
    const enabled = await isPdfOcrAvailable();
    res.status(enabled ? 200 : 503).json({
      ok: enabled,
      dependencies: {
        tesseract: "required",
        pdftoppm: "required",
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

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

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
