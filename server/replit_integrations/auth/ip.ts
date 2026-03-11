import type { Request } from "express";

function normalizeIp(raw: string | undefined | null): string {
  const value = String(raw || "").trim();
  if (!value) return "unknown";
  if (value === "::1") return "127.0.0.1";
  if (value.startsWith("::ffff:")) return value.slice(7);
  return value;
}

export function resolveRequestIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const forwardedIp = firstForwarded?.split(",")[0]?.trim();
  return normalizeIp(forwardedIp || req.ip || req.socket.remoteAddress || "unknown");
}

export function isSingleIpEnforced(): boolean {
  const raw = String(process.env.AUTH_SINGLE_IP_ENFORCED || "").trim().toLowerCase();
  if (!raw) return process.env.NODE_ENV === "production";
  return raw !== "false" && raw !== "0" && raw !== "no" && raw !== "off";
}
