import type { Express, Request } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";
import { sendEmailVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from "../../email";
import { dbAvailable, dbUnavailableReason, pool } from "../../db";
import { isUserBanned, logAuditEvent } from "../../security-governance";
import { recordSecurityEvent } from "../../security-monitoring";
import { isSingleIpEnforced, resolveRequestIp } from "./ip";
import { verifyCaptchaToken } from "../../captcha";

const TERMS_VERSION = "2026-03";
const TERMS_REQUIRED_MESSAGE = "You must agree to the Terms and Conditions to create an account.";
const AUTH_SINGLE_IP_ENFORCED = isSingleIpEnforced();
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const GENERIC_FORGOT_PASSWORD_MESSAGE = "If an account with that email exists, a password reset link has been sent.";
const GOOGLE_FORGOT_PASSWORD_MESSAGE = "This account uses Google sign-in. Please continue with Google instead of password reset.";
const GENERIC_VERIFICATION_RESEND_MESSAGE = "If an account with that email exists, a verification link has been sent.";
const ADMIN_MAX_CONCURRENT_SESSIONS = Math.max(1, Number(process.env.AUTH_ADMIN_MAX_SESSIONS || 3));

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  acceptedTerms: z.boolean().refine((value) => value === true, {
    message: TERMS_REQUIRED_MESSAGE,
  }),
  termsVersion: z.string().trim().max(40).optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const authAttemptHistory = new Map<string, number[]>();

function applyAuthRateLimit(
  req: Request,
  res: any,
  routeKey: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const ip = resolveRequestIp(req);
  const key = `${routeKey}:${ip}`;
  const now = Date.now();
  const windowStart = now - windowMs;
  const existing = authAttemptHistory.get(key) || [];
  const recent = existing.filter((ts) => ts >= windowStart);

  if (recent.length >= maxRequests) {
    recordSecurityEvent("auth_anomaly", `rate-limit:${routeKey}:${ip}`, {
      routeKey,
      ip,
      maxRequests,
      windowMs,
    });
    res.setHeader("Retry-After", Math.ceil(windowMs / 1000));
    res.status(429).json({ message: "Too many authentication attempts. Please try again later." });
    return false;
  }

  recent.push(now);
  authAttemptHistory.set(key, recent);
  return true;
}

const authRateCleanupTimer = setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, attempts] of authAttemptHistory.entries()) {
    const recent = attempts.filter((ts) => ts >= cutoff);
    if (recent.length === 0) {
      authAttemptHistory.delete(key);
    } else {
      authAttemptHistory.set(key, recent);
    }
  }
}, 30 * 60 * 1000);
authRateCleanupTimer.unref?.();

function normalizeSiteBaseUrl(req: Request): string {
  const configured = String(process.env.PUBLIC_SITE_URL || process.env.VITE_PUBLIC_SITE_URL || "").trim();
  if (configured) return configured.replace(/\/+$/, "");

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0]?.trim();
  const proto = forwardedProto || req.protocol || "https";
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0]?.trim();
  const host = forwardedHost || req.get("host") || "localhost";
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function getGoogleRedirectUri(req: Request): string {
  const configured = String(process.env.GOOGLE_REDIRECT_URI || "").trim();
  if (configured) return configured;
  return `${normalizeSiteBaseUrl(req)}/api/auth/google/callback`;
}

function base64UrlEncode(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildOAuthAuthRedirect(query: Record<string, string>): string {
  const params = new URLSearchParams(query);
  const suffix = params.toString();
  return suffix ? `/auth?${suffix}` : "/auth";
}

async function requireCaptchaOrReject(req: Request, res: any, action: string): Promise<boolean> {
  const captchaResult = await verifyCaptchaToken(req, req.body?.captchaToken, action);
  if (captchaResult.ok) return true;
  if (captchaResult.reason !== "captcha_disabled") {
    recordSecurityEvent("captcha_failure", `auth:${action}:${resolveRequestIp(req)}`, {
      action,
      reason: captchaResult.reason || "unknown",
    });
  }
  res.status(403).json({ message: "Captcha verification failed. Please try again." });
  return false;
}

async function issueEmailVerification(user: any, req: Request, source: "register" | "resend"): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
  await authStorage.createEmailVerificationToken(user.id, token, expiresAt);
  const verifyUrl = `${normalizeSiteBaseUrl(req)}/auth?verify=${encodeURIComponent(token)}`;
  await sendEmailVerificationEmail(user.email, verifyUrl, user.firstName).catch((err) => {
    console.warn("[Auth] Verification email send failed:", err?.message || err);
  });
  await logAuditEvent("auth.verification.sent", user.id, user.id, { source }).catch(() => {});
}

async function establishSession(req: any, user: any): Promise<void> {
  const loginIp = resolveRequestIp(req);
  let sessionEpoch = Number(user?.sessionEpoch || 0);
  if (AUTH_SINGLE_IP_ENFORCED && !user?.isAdmin) {
    const lock = await authStorage.issueSingleSessionLock(user.id, loginIp);
    sessionEpoch = lock.sessionEpoch;
  }

  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((regenErr: any) => {
      if (regenErr) return reject(regenErr);
      (req.session as any).userId = user.id;
      (req.session as any).sessionEpoch = sessionEpoch;
      (req.session as any).loginIp = loginIp;
      req.session.save((saveErr: any) => {
        if (saveErr) return reject(saveErr);
        return resolve();
      });
    });
  });

  if (user?.isAdmin) {
    await enforceAdminSessionLimit(user.id, String(req.sessionID || "").trim() || null);
  }
}

async function enforceAdminSessionLimit(userId: string, keepSid: string | null): Promise<void> {
  if (!pool || ADMIN_MAX_CONCURRENT_SESSIONS < 1) return;

  try {
    const active = await pool.query(
      `select sid
         from sessions
        where expire > now()
          and coalesce(sess->>'userId','') = $1
        order by expire desc, sid desc`,
      [userId],
    );
    const sids = (active.rows || [])
      .map((row: any) => String(row?.sid || "").trim())
      .filter(Boolean);
    if (sids.length <= ADMIN_MAX_CONCURRENT_SESSIONS) return;

    const keep = new Set<string>();
    if (keepSid && sids.includes(keepSid)) keep.add(keepSid);
    for (const sid of sids) {
      if (keep.size >= ADMIN_MAX_CONCURRENT_SESSIONS) break;
      keep.add(sid);
    }
    const toDelete = sids.filter((sid: string) => !keep.has(sid));
    if (toDelete.length > 0) {
      await pool.query(`delete from sessions where sid = any($1::text[])`, [toDelete]);
      recordSecurityEvent("auth_anomaly", `admin-session-trim:${userId}`, {
        userId,
        kept: Array.from(keep),
        removedCount: toDelete.length,
        maxSessions: ADMIN_MAX_CONCURRENT_SESSIONS,
      });
    }
  } catch (err: any) {
    console.warn("[Auth] Could not enforce admin session limit:", err?.message || err);
  }
}

async function persistSession(req: any, res: any, user: any, statusCode: number = 200): Promise<void> {
  await establishSession(req, user);
  const { passwordHash: _, ...safeUser } = user;
  res.status(statusCode).json(safeUser);
}

function isDatabaseConnectivityError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  const code = err.code || "";
  const message = (err.message || "").toLowerCase();
  return (
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "EAI_AGAIN" ||
    message.includes("getaddrinfo") ||
    message.includes("connection") ||
    message.includes("database")
  );
}

export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/register", async (req, res) => {
    try {
      if (!applyAuthRateLimit(req, res, "register", 10, 15 * 60 * 1000)) return;
      if (!(await requireCaptchaOrReject(req, res, "register"))) return;

      if (!dbAvailable) {
        return res.status(503).json({ message: "Database unavailable", code: "DB_UNAVAILABLE", reason: dbUnavailableReason });
      }

      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { email, password, firstName, lastName, phoneNumber, termsVersion } = parsed.data;

      const existingUser = await authStorage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await authStorage.upsertUser({
        email,
        firstName,
        lastName,
        phoneNumber,
        passwordHash,
        authProvider: "email",
        subscriptionTier: "free",
        emailVerified: false,
        emailVerifiedAt: null,
      });

      await logAuditEvent("auth.register", user.id, user.id, {
        provider: "email",
        termsAcceptedVersion: termsVersion || TERMS_VERSION,
      }).catch(() => {});

      await issueEmailVerification(user, req, "register");
      return res.status(201).json({
        message: "Account created successfully. Please verify your email before signing in.",
        requiresEmailVerification: true,
        email: user.email,
      });
    } catch (error) {
      console.error("Registration error:", error);
      if (!dbAvailable || isDatabaseConnectivityError(error)) {
        return res.status(503).json({
          message: "Database unavailable",
          code: "DB_UNAVAILABLE",
          reason: (error as any)?.message || dbUnavailableReason,
        });
      }
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      if (!applyAuthRateLimit(req, res, "login", 15, 15 * 60 * 1000)) return;
      if (!(await requireCaptchaOrReject(req, res, "login"))) return;

      if (!dbAvailable) {
        return res.status(503).json({ message: "Database unavailable", code: "DB_UNAVAILABLE", reason: dbUnavailableReason });
      }

      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { email, password } = parsed.data;

      const user = await authStorage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        recordSecurityEvent("auth_anomaly", `login-failed:${email.toLowerCase()}`, { reason: "user_not_found_or_no_password" });
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (await isUserBanned(user.id)) {
        recordSecurityEvent("auth_anomaly", `banned-login:${user.id}`, { provider: "email" });
        return res.status(403).json({ message: "Your account is suspended. Please contact support." });
      }

      if (user.authProvider === "google") {
        recordSecurityEvent("auth_anomaly", `provider-mismatch:${email.toLowerCase()}`, { expectedProvider: "google", attemptedProvider: "email" });
        return res.status(401).json({ message: "This account uses Google sign-in. Please use the Google login button." });
      }
      if (!user.emailVerified) {
        return res.status(403).json({
          message: "Please verify your email before signing in. You can request a new verification link.",
          requiresEmailVerification: true,
        });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        recordSecurityEvent("auth_anomaly", `login-failed:${email.toLowerCase()}`, { reason: "invalid_password" });
        return res.status(401).json({ message: "Invalid email or password" });
      }

      await logAuditEvent("auth.login", user.id, user.id, { provider: "email" }).catch(() => {});
      await persistSession(req, res, user);
      return;
    } catch (error) {
      console.error("Login error:", error);
      if (!dbAvailable || isDatabaseConnectivityError(error)) {
        return res.status(503).json({
          message: "Database unavailable",
          code: "DB_UNAVAILABLE",
          reason: (error as any)?.message || dbUnavailableReason,
        });
      }
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const userId = (req.session as any)?.userId as string | undefined;
    const sessionEpoch = Number((req.session as any)?.sessionEpoch || NaN);
    if (userId) {
      logAuditEvent("auth.logout", userId, userId).catch(() => {});
      if (AUTH_SINGLE_IP_ENFORCED) {
        await authStorage.clearSingleSessionLock(userId, Number.isFinite(sessionEpoch) ? sessionEpoch : null).catch(() => {});
      }
    }
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const user = await authStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { passwordHash: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/auth/google/start", async (req, res) => {
    try {
      if (!applyAuthRateLimit(req, res, "google-oauth-start", 30, 15 * 60 * 1000)) return;

      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return res.redirect(
          buildOAuthAuthRedirect({
            google_error: "google_not_configured",
            google_error_detail: "Google sign-in is not configured on server.",
          }),
        );
      }

      const state = base64UrlEncode(crypto.randomBytes(24));
      const codeVerifier = base64UrlEncode(crypto.randomBytes(48));
      const codeChallenge = base64UrlEncode(crypto.createHash("sha256").update(codeVerifier).digest());
      const redirectUri = getGoogleRedirectUri(req);

      (req.session as any).googleOAuth = {
        state,
        codeVerifier,
        createdAt: Date.now(),
      };
      await new Promise<void>((resolve, reject) => {
        req.session.save((err: any) => {
          if (err) return reject(err);
          return resolve();
        });
      });

      const authParams = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        include_granted_scopes: "true",
        prompt: "select_account",
      });
      return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`);
    } catch (error) {
      console.error("Google OAuth start error:", error);
      return res.redirect(
        buildOAuthAuthRedirect({
          google_error: "google_start_failed",
          google_error_detail: "Could not start Google sign-in.",
        }),
      );
    }
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const fail = (code: string, detail?: string) => {
      const payload: Record<string, string> = { google_error: code };
      if (detail) payload.google_error_detail = detail.slice(0, 220);
      return res.redirect(buildOAuthAuthRedirect(payload));
    };

    try {
      if (!applyAuthRateLimit(req, res, "google-oauth-callback", 40, 15 * 60 * 1000)) return;

      if (!dbAvailable) {
        return fail("db_unavailable", "Database unavailable");
      }

      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return fail("google_not_configured", "Google sign-in is not configured on server.");
      }

      const oauthError = String(req.query.error || "").trim();
      const oauthErrorDescription = String(req.query.error_description || "").trim();
      if (oauthError) {
        recordSecurityEvent("auth_anomaly", "google-oauth-denied", {
          error: oauthError,
          description: oauthErrorDescription || undefined,
        });
        return fail("oauth_denied", oauthErrorDescription || oauthError);
      }

      const code = String(req.query.code || "").trim();
      const state = String(req.query.state || "").trim();
      const oauthSession = (req.session as any)?.googleOAuth as
        | { state?: string; codeVerifier?: string; createdAt?: number }
        | undefined;

      (req.session as any).googleOAuth = null;
      await new Promise<void>((resolve) => {
        req.session.save(() => resolve());
      });

      const stateAgeMs = Date.now() - Number(oauthSession?.createdAt || 0);
      const stateLooksValid =
        !!code &&
        !!state &&
        !!oauthSession?.state &&
        state === oauthSession.state &&
        !!oauthSession?.codeVerifier &&
        Number.isFinite(stateAgeMs) &&
        stateAgeMs >= 0 &&
        stateAgeMs <= 10 * 60 * 1000;

      if (!stateLooksValid) {
        recordSecurityEvent("auth_anomaly", "google-oauth-state-mismatch", {
          hasCode: !!code,
          hasState: !!state,
          hasSessionState: !!oauthSession?.state,
          stateAgeMs: Number.isFinite(stateAgeMs) ? stateAgeMs : null,
        });
        return fail("state_mismatch");
      }

      const redirectUri = getGoogleRedirectUri(req);
      const tokenForm = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code_verifier: oauthSession!.codeVerifier!,
      });

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenForm.toString(),
      });
      if (!tokenRes.ok) {
        const detail = await tokenRes.text().catch(() => "");
        recordSecurityEvent("auth_anomaly", "google-oauth-token-exchange-failed", {
          status: tokenRes.status,
          detail: detail.slice(0, 200),
        });
        return fail("token_exchange_failed");
      }

      const tokenPayload = (await tokenRes.json()) as Record<string, unknown>;
      const idToken = String(tokenPayload.id_token || "").trim();
      const accessToken = String(tokenPayload.access_token || "").trim();

      let payload: Record<string, any> = {};
      if (idToken) {
        const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
        if (!verifyRes.ok) {
          recordSecurityEvent("auth_anomaly", "google-oauth-id-token-invalid", { status: verifyRes.status });
          return fail("token_exchange_failed");
        }
        payload = (await verifyRes.json()) as Record<string, any>;
      } else if (accessToken) {
        const userInfoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!userInfoRes.ok) {
          recordSecurityEvent("auth_anomaly", "google-oauth-userinfo-failed", { status: userInfoRes.status });
          return fail("token_exchange_failed");
        }
        payload = (await userInfoRes.json()) as Record<string, any>;
      } else {
        recordSecurityEvent("auth_anomaly", "google-oauth-missing-tokens", {});
        return fail("token_exchange_failed");
      }

      const tokenAudience = String(payload.aud || "").trim();
      const tokenIssuer = String(payload.iss || "").trim();
      const allowedIssuers = new Set(["accounts.google.com", "https://accounts.google.com"]);
      const tokenEmail = String(payload.email || "").trim().toLowerCase();
      const tokenEmailVerified = String(payload.email_verified || "").trim().toLowerCase() === "true" || payload.email_verified === true;
      const tokenSub = String(payload.sub || "").trim();

      if (tokenAudience && tokenAudience !== clientId) {
        recordSecurityEvent("auth_anomaly", "google-token-audience-mismatch", {});
        return fail("token_exchange_failed");
      }

      if (tokenIssuer && !allowedIssuers.has(tokenIssuer)) {
        recordSecurityEvent("auth_anomaly", "google-token-issuer-mismatch", { issuer: tokenIssuer });
        return fail("token_exchange_failed");
      }

      if (!tokenEmail) {
        recordSecurityEvent("auth_anomaly", "google-token-missing-email", { sub: tokenSub || undefined });
        return fail("google_email_missing");
      }

      if (!tokenEmailVerified) {
        recordSecurityEvent("auth_anomaly", "google-token-email-unverified", { email: tokenEmail, sub: tokenSub || undefined });
        return fail("google_email_unverified");
      }

      const firstName = String(payload.given_name || "").trim() || undefined;
      const lastName = String(payload.family_name || "").trim() || undefined;
      const displayName = String(payload.name || "").trim();
      const profileImageUrl = String(payload.picture || "").trim() || undefined;
      const derivedFirstName = firstName || (displayName ? displayName.split(" ")[0] : undefined) || "Google";
      const derivedLastName = lastName || (displayName ? displayName.split(" ").slice(1).join(" ").trim() : undefined) || "User";

      const { user, created } = await authStorage.findOrCreateGoogleUser({
        email: tokenEmail,
        firstName: derivedFirstName,
        lastName: derivedLastName,
        profileImageUrl,
        emailVerified: true,
      });

      if (await isUserBanned(user.id)) {
        recordSecurityEvent("auth_anomaly", `banned-login:${user.id}`, { provider: "google" });
        return fail("account_banned", "Your account is suspended. Please contact support.");
      }

      if (created) {
        await logAuditEvent("auth.register", user.id, user.id, {
          provider: "google",
          termsAcceptedVersion: TERMS_VERSION,
          googleSub: tokenSub || undefined,
        }).catch(() => {});

        sendWelcomeEmail(user.email || tokenEmail, user.firstName || "there").catch((err) => {
          console.warn("[Auth] Google welcome email send failed:", err?.message || err);
        });
      }

      await logAuditEvent("auth.login", user.id, user.id, {
        provider: "google",
        created,
        googleSub: tokenSub || undefined,
      }).catch(() => {});

      await establishSession(req, user);
      return res.redirect("/dashboard");
    } catch (error) {
      console.error("Google OAuth callback error:", error);
      if (!dbAvailable || isDatabaseConnectivityError(error)) {
        return fail("db_unavailable", "Database unavailable");
      }
      return fail("google_callback_failed");
    }
  });

  app.post("/api/auth/google/token", async (req, res) => {
    try {
      if (!applyAuthRateLimit(req, res, "google-token", 20, 15 * 60 * 1000)) return;
      if (!(await requireCaptchaOrReject(req, res, "google-token"))) return;

      const { credential } = req.body || {};
      if (!credential) {
        return res.status(400).json({ message: "No credential provided" });
      }

      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        return res.status(503).json({ message: "Google sign-in is not configured" });
      }

      const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
      if (!verifyRes.ok) {
        recordSecurityEvent("auth_anomaly", "google-token-invalid", {});
        return res.status(401).json({ message: "Invalid Google token" });
      }

      const payload = (await verifyRes.json()) as Record<string, any>;
      const tokenAudience = String(payload.aud || "").trim();
      const tokenIssuer = String(payload.iss || "").trim();
      const allowedIssuers = new Set(["accounts.google.com", "https://accounts.google.com"]);
      const tokenEmail = String(payload.email || "").trim().toLowerCase();
      const tokenEmailVerified = String(payload.email_verified || "").trim().toLowerCase() === "true" || payload.email_verified === true;
      const tokenSub = String(payload.sub || "").trim();

      if (tokenAudience !== clientId) {
        recordSecurityEvent("auth_anomaly", "google-token-audience-mismatch", {});
        return res.status(401).json({ message: "Token audience mismatch" });
      }

      if (tokenIssuer && !allowedIssuers.has(tokenIssuer)) {
        recordSecurityEvent("auth_anomaly", "google-token-issuer-mismatch", { issuer: tokenIssuer });
        return res.status(401).json({ message: "Token issuer mismatch" });
      }

      if (!tokenEmail) {
        recordSecurityEvent("auth_anomaly", "google-token-missing-email", { sub: tokenSub || undefined });
        return res.status(400).json({
          code: "google_email_missing",
          message: "Google account does not provide a usable email address.",
        });
      }

      if (!tokenEmailVerified) {
        recordSecurityEvent("auth_anomaly", "google-token-email-unverified", { email: tokenEmail, sub: tokenSub || undefined });
        return res.status(401).json({
          code: "google_email_unverified",
          message: "Google email is not verified.",
        });
      }

      const firstName = String(payload.given_name || "").trim() || undefined;
      const lastName = String(payload.family_name || "").trim() || undefined;
      const displayName = String(payload.name || "").trim();
      const profileImageUrl = String(payload.picture || "").trim() || undefined;
      const derivedFirstName = firstName || (displayName ? displayName.split(" ")[0] : undefined) || "Google";
      const derivedLastName = lastName || (displayName ? displayName.split(" ").slice(1).join(" ").trim() : undefined) || "User";

      const { user, created } = await authStorage.findOrCreateGoogleUser({
        email: tokenEmail,
        firstName: derivedFirstName,
        lastName: derivedLastName,
        profileImageUrl,
        emailVerified: true,
      });

      if (await isUserBanned(user.id)) {
        recordSecurityEvent("auth_anomaly", `banned-login:${user.id}`, { provider: "google" });
        return res.status(403).json({ message: "Your account is suspended. Please contact support." });
      }

      if (created) {
        await logAuditEvent("auth.register", user.id, user.id, {
          provider: "google",
          termsAcceptedVersion: TERMS_VERSION,
          googleSub: tokenSub || undefined,
        }).catch(() => {});

        sendWelcomeEmail(user.email || tokenEmail, user.firstName || "there").catch((err) => {
          console.warn("[Auth] Google welcome email send failed:", err?.message || err);
        });
      }

      await logAuditEvent("auth.login", user.id, user.id, {
        provider: "google",
        created,
        googleSub: tokenSub || undefined,
      }).catch(() => {});
      await persistSession(req, res, user);
      return;
    } catch (error) {
      console.error("Google token auth error:", error);
      res.status(500).json({ message: "Google sign-in failed" });
    }
  });

  app.get("/api/auth/google/status", (_req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    res.json({
      available: !!clientId && !!clientSecret,
      clientId,
      flow: "authorization_code",
    });
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      if (!applyAuthRateLimit(req, res, "forgot-password", 8, 15 * 60 * 1000)) return;
      if (!(await requireCaptchaOrReject(req, res, "forgot-password"))) return;

      const schema = z.object({ email: z.string().email() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Please provide a valid email address" });
      }

      const user = await authStorage.getUserByEmail(parsed.data.email);

      if (!user) {
        return res.json({ message: GENERIC_FORGOT_PASSWORD_MESSAGE });
      }

      if (user.authProvider === "google") {
        return res.json({
          message: GOOGLE_FORGOT_PASSWORD_MESSAGE,
          provider: "google",
          action: "use_google_signin",
        });
      }

      if (user.authProvider !== "email") {
        return res.json({ message: GENERIC_FORGOT_PASSWORD_MESSAGE });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await authStorage.createPasswordResetToken(user.id, token, expiresAt);

      const resetUrl = `${req.protocol}://${req.get("host")}/reset-password?token=${token}`;

      const emailSent = await sendPasswordResetEmail(parsed.data.email, resetUrl, user.firstName);

      if (!emailSent) {
        console.warn(`[Auth] Password reset email could not be sent for ${parsed.data.email}.`);
        return res.status(503).json({
          message: "We could not send reset email right now. Please try again shortly.",
          code: "EMAIL_TEMPORARILY_UNAVAILABLE",
        });
      }
      return res.json({ message: GENERIC_FORGOT_PASSWORD_MESSAGE });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      if (!applyAuthRateLimit(req, res, "verify-email", 20, 15 * 60 * 1000)) return;
      const schema = z.object({ token: z.string().min(1, "Verification token is required") });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const verification = await authStorage.getValidEmailVerificationToken(parsed.data.token);
      if (!verification) {
        return res.status(400).json({ message: "This verification link has expired or is invalid. Please request a new one." });
      }

      await authStorage.markUserEmailVerified(verification.userId);
      await authStorage.markEmailVerificationTokenUsed(verification.id);
      await logAuditEvent("auth.verification.completed", verification.userId, verification.userId).catch(() => {});

      return res.json({ message: "Email verified successfully. You can now sign in." });
    } catch (error) {
      console.error("Verify email error:", error);
      return res.status(500).json({ message: "Could not verify email. Please try again." });
    }
  });

  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      if (!applyAuthRateLimit(req, res, "resend-verification", 8, 15 * 60 * 1000)) return;
      if (!(await requireCaptchaOrReject(req, res, "resend-verification"))) return;

      const schema = z.object({ email: z.string().email() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Please provide a valid email address" });
      }

      const user = await authStorage.getUserByEmail(parsed.data.email);
      if (user && user.authProvider === "email" && !user.emailVerified) {
        await issueEmailVerification(user, req, "resend");
      }

      return res.json({ message: GENERIC_VERIFICATION_RESEND_MESSAGE });
    } catch (error) {
      console.error("Resend verification error:", error);
      return res.status(500).json({ message: "Could not resend verification email. Please try again." });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      if (!applyAuthRateLimit(req, res, "reset-password", 10, 15 * 60 * 1000)) return;
      if (!(await requireCaptchaOrReject(req, res, "reset-password"))) return;

      const schema = z.object({
        token: z.string().min(1),
        password: z.string().min(8, "Password must be at least 8 characters"),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const resetToken = await authStorage.getValidResetToken(parsed.data.token);
      if (!resetToken) {
        return res.status(400).json({ message: "This reset link has expired or is invalid. Please request a new one." });
      }

      const passwordHash = await bcrypt.hash(parsed.data.password, 12);
      await authStorage.updateUserPassword(resetToken.userId, passwordHash);
      await authStorage.markResetTokenUsed(resetToken.id);

      res.json({ message: "Password has been reset successfully. You can now sign in." });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/auth/complete-onboarding", async (req, res) => {
    try {
      const session = req.session as any;
      if (!session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await authStorage.getUser(session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      await authStorage.updateUser(user.id, { onboardingCompleted: true });
      res.json({ message: "Onboarding completed", onboardingCompleted: true });
    } catch (error) {
      console.error("Complete onboarding error:", error);
      res.status(500).json({ message: "Could not complete onboarding" });
    }
  });
}
