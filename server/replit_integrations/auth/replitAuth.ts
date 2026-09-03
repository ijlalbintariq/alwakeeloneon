import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";
import { validateDatabaseUrl, validatePgHost } from "../../env-config";
import { isUserBanned } from "../../security-governance";
import { recordSecurityEvent } from "../../security-monitoring";
import { authStorage } from "./storage";
import { isSingleIpEnforced, resolveRequestIp } from "./ip";

const AUTH_SINGLE_IP_ENFORCED = isSingleIpEnforced();
const SESSION_INVALIDATED_MESSAGE = "Your session expired because your account was used from another location. Please sign in again.";

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
      secure: false,
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
    let user;
    try {
      user = await authStorage.getUser(userId);
    } catch (err: any) {
      if (process.env.NODE_ENV !== "production" && (req.session as any).user) {
        user = (req.session as any).user;
      } else {
        console.error("[Auth] Database error fetching user in isAuthenticated:", err?.message || err);
        return res.status(500).json({ message: "Database connection busy. Please reload." });
      }
    }
    if (!user && process.env.NODE_ENV !== "production" && (req.session as any).user) {
      user = (req.session as any).user;
    }
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (await isUserBanned(userId)) {
      recordSecurityEvent("auth_anomaly", `banned-session:${userId}`, { path: req.path, method: req.method });
      req.session.destroy(() => {});
      return res.status(403).json({ message: "Your account is suspended. Please contact support." });
    }
    if (AUTH_SINGLE_IP_ENFORCED && !user.isAdmin) {
      const activeEpoch = Number(user.sessionEpoch || 0);
      const sessionEpoch = Number((req.session as any).sessionEpoch || NaN);
      const expectedIp = String(user.activeSessionIp || "").trim();
      const requestIp = resolveRequestIp(req);
      const epochMismatch = !Number.isFinite(sessionEpoch) || sessionEpoch !== activeEpoch;
      const ipMismatch = !!expectedIp && requestIp !== expectedIp;
      if (epochMismatch || ipMismatch) {
        recordSecurityEvent("auth_anomaly", `single-session-mismatch:${userId}`, {
          path: req.path,
          method: req.method,
          requestIp,
          expectedIp: expectedIp || null,
          sessionEpoch: Number.isFinite(sessionEpoch) ? sessionEpoch : null,
          activeEpoch,
        });
        req.session.destroy(() => {});
        return res.status(401).json({ message: SESSION_INVALIDATED_MESSAGE });
      }
    }
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
