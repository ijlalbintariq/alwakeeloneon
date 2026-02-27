import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import MemoryStore from "memorystore";
import { validateDatabaseUrl } from "../../env-config";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const memStoreFactory = MemoryStore(session);
  const validatedDatabaseUrl = validateDatabaseUrl(process.env.DATABASE_URL);
  const canUsePg = validatedDatabaseUrl.ok && !!validatedDatabaseUrl.value && !!process.env.SESSION_SECRET;
  if (!validatedDatabaseUrl.ok) {
    console.error(`[Session] Falling back to memory store. ${validatedDatabaseUrl.reason}`);
  }
  const sessionStore = canUsePg
    ? new pgStore({
        conString: validatedDatabaseUrl.value,
        createTableIfMissing: false,
        ttl: sessionTtl,
        tableName: "sessions",
      })
    : new memStoreFactory({
        checkPeriod: sessionTtl,
      });
  const isProd = process.env.NODE_ENV === "production";
  const secret = process.env.SESSION_SECRET || (!isProd ? "development-secret" : "");
  return session({
    secret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
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
