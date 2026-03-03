import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";
import { validateDatabaseUrl, validatePgHost } from "../../env-config";
import { isUserBanned } from "../../security-governance";
import { recordSecurityEvent } from "../../security-monitoring";

function resolveSessionSecret(isProduction: boolean): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return configured;

  if (isProduction) {
    throw new Error("SESSION_SECRET is required in production.");
  }

  console.warn("[Auth] SESSION_SECRET is not set. Using development fallback secret.");
  return "dev-session-secret";
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const isProduction = process.env.NODE_ENV === "production";
  const sessionSecret = resolveSessionSecret(isProduction);
  const validatedDatabaseUrl = validateDatabaseUrl(process.env.DATABASE_URL);
  const validatedPgHost = validatePgHost(process.env.PGHOST);
  const canUsePgStore = validatedDatabaseUrl.ok && validatedPgHost.ok && !!validatedDatabaseUrl.value;

  let sessionStore: session.Store;
  if (canUsePgStore) {
    const pgStore = connectPg(session);
    sessionStore = new pgStore({
      conString: validatedDatabaseUrl.value,
      createTableIfMissing: false,
      ttl: sessionTtl,
      tableName: "sessions",
    });
  } else {
    const MemoryStore = createMemoryStore(session);
    sessionStore = new MemoryStore({
      checkPeriod: sessionTtl,
    });
    const reasons = [validatedDatabaseUrl.reason, validatedPgHost.reason].filter(Boolean).join(" ");
    console.warn(`[Auth] Using MemoryStore because Postgres session store is unavailable. ${reasons || ""}`.trim());
  }

  return session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      maxAge: sessionTtl,
      sameSite: "lax",
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (req.session && (req.session as any).userId) {
    const userId = (req.session as any).userId as string;
    if (await isUserBanned(userId)) {
      recordSecurityEvent("auth_anomaly", `banned-session:${userId}`, { path: req.path, method: req.method });
      req.session.destroy(() => {});
      return res.status(403).json({ message: "Your account is suspended. Please contact support." });
    }
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
