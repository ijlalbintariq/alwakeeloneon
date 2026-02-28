import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";
import { validateDatabaseUrl, validatePgHost } from "../../env-config";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
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
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
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
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
