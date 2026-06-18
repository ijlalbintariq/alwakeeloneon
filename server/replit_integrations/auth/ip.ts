import type { Request } from "express";

function normalizeIp(raw: string | undefined | null): string {
  const value = String(raw || "").trim();
  if (!value) return "unknown";
  if (value === "::1") return "127.0.0.1";
  if (value.startsWith("::ffff:")) return value.slice(7);
  return value;
}

export function resolveRequestIp(req: Request): string {
  // Use req.ip which respects Express's `trust proxy` setting (set to 1 in index.ts).
  // This prevents X-Forwarded-For spoofing: the header is sanitized by Express based
  // on the configured trust depth before it reaches req.ip.
  // DO NOT read req.headers["x-forwarded-for"] directly — it is client-controlled.
  return normalizeIp(req.ip || req.socket?.remoteAddress || "unknown");
}

export function isSingleIpEnforced(): boolean {
  const raw = String(process.env.AUTH_SINGLE_IP_ENFORCED || "").trim().toLowerCase();
  if (!raw) return process.env.NODE_ENV === "production";
  return raw !== "false" && raw !== "0" && raw !== "no" && raw !== "off";
}
