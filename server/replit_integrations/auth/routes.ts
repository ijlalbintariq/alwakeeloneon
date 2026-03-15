import type { Express, Request } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";
import { sendEmailVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from "../../email";
import { dbAvailable, dbUnavailableReason } from "../../db";
import { isUserBanned, logAuditEvent } from "../../security-governance";
import { recordSecurityEvent } from "../../security-monitoring";
import { isSingleIpEnforced, resolveRequestIp } from "./ip";
import { verifyCaptchaToken } from "../../captcha";

const TERMS_VERSION = "2026-03";
const TERMS_REQUIRED_MESSAGE = "You must agree to the Terms and Conditions to create an account.";
const AUTH_SINGLE_IP_ENFORCED = isSingleIpEnforced();
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const GENERIC_FORGOT_PASSWORD_MESSAGE = "If an account with that email exists, a password reset link has been sent.";
const GENERIC_VERIFICATION_RESEND_MESSAGE = "If an account with that email exists, a verification link has been sent.";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
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

async function persistSession(req: any, res: any, user: any, statusCode: number = 200): Promise<void> {
  const loginIp = resolveRequestIp(req);
  let sessionEpoch = Number(user?.sessionEpoch || 0);
  if (AUTH_SINGLE_IP_ENFORCED) {
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

      const { email, password, firstName, lastName, termsVersion } = parsed.data;

      const existingUser = await authStorage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await authStorage.upsertUser({
        email,
        firstName,
        lastName,
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

      const payload = await verifyRes.json();

      if (payload.aud !== clientId) {
        recordSecurityEvent("auth_anomaly", "google-token-audience-mismatch", {});
        return res.status(401).json({ message: "Token audience mismatch" });
      }

      const email = payload.email;
      const user = await authStorage.getUserByEmail(email);

      if (user) {
        if (user.authProvider === "email") {
          return res.status(409).json({ message: "An account with this email already exists using email/password. Please sign in with your email and password." });
        }
        if (await isUserBanned(user.id)) {
          recordSecurityEvent("auth_anomaly", `banned-login:${user.id}`, { provider: "google" });
          return res.status(403).json({ message: "Your account is suspended. Please contact support." });
        }
      } else {
        return res.status(404).json({
          message: "No account found for this Google email. Please sign up first, then use Google sign-in.",
        });
      }
      if (!user!.emailVerified) {
        await authStorage.markUserEmailVerified(user!.id).catch(() => {});
      }

      await logAuditEvent("auth.login", user!.id, user!.id, { provider: "google" }).catch(() => {});
      await persistSession(req, res, user!);
      return;
    } catch (error) {
      console.error("Google token auth error:", error);
      res.status(500).json({ message: "Google sign-in failed" });
    }
  });

  app.get("/api/auth/google/status", (_req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    res.json({ available: !!clientId, clientId });
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

      if (!user || user.authProvider !== "email") {
        return res.json({ message: GENERIC_FORGOT_PASSWORD_MESSAGE });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await authStorage.createPasswordResetToken(user.id, token, expiresAt);

      const resetUrl = `${req.protocol}://${req.get("host")}/reset-password?token=${token}`;

      const emailSent = await sendPasswordResetEmail(parsed.data.email, resetUrl, user.firstName);

      if (!emailSent) {
        console.warn(`[Auth] Password reset email could not be sent for ${parsed.data.email}.`);
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
}
