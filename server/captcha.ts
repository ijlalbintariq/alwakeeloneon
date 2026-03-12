import type { Request } from "express";

export type CaptchaVerificationResult = {
  ok: boolean;
  reason?: string;
};

function envEnabled(name: string, defaultValue: boolean = false): boolean {
  const raw = String(process.env[name] || "").trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = typeof value === "string" ? value.split(",")[0]?.trim() : "";
  const socketIp = (req.socket?.remoteAddress || "").trim();
  const raw = first || socketIp || "unknown";
  return raw.startsWith("::ffff:") ? raw.slice(7) : raw;
}

export function isCaptchaEnforced(): boolean {
  return envEnabled("CAPTCHA_ENFORCED", false);
}

export async function verifyCaptchaToken(
  req: Request,
  token: string | undefined | null,
  action: string,
): Promise<CaptchaVerificationResult> {
  if (!isCaptchaEnforced()) {
    return { ok: true, reason: "captcha_disabled" };
  }

  const responseToken = String(token || "").trim();
  if (!responseToken) {
    return { ok: false, reason: "missing_token" };
  }

  const turnstileSecret = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
  if (turnstileSecret) {
    try {
      const body = new URLSearchParams();
      body.set("secret", turnstileSecret);
      body.set("response", responseToken);
      body.set("remoteip", getClientIp(req));
      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const parsed = await verifyRes.json().catch(() => ({} as any));
      const success = Boolean(parsed?.success);
      const actionOk = !parsed?.action || parsed.action === action;
      if (success && actionOk) {
        return { ok: true };
      }
      return { ok: false, reason: "turnstile_rejected" };
    } catch (err: any) {
      return { ok: false, reason: err?.message || "turnstile_error" };
    }
  }

  const recaptchaSecret = String(process.env.RECAPTCHA_SECRET_KEY || "").trim();
  if (recaptchaSecret) {
    try {
      const body = new URLSearchParams();
      body.set("secret", recaptchaSecret);
      body.set("response", responseToken);
      body.set("remoteip", getClientIp(req));
      const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const parsed = await verifyRes.json().catch(() => ({} as any));
      if (Boolean(parsed?.success)) {
        return { ok: true };
      }
      return { ok: false, reason: "recaptcha_rejected" };
    } catch (err: any) {
      return { ok: false, reason: err?.message || "recaptcha_error" };
    }
  }

  return { ok: false, reason: "captcha_secret_missing" };
}
