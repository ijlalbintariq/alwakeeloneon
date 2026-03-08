import crypto from "node:crypto";
import path from "node:path";

type UploadArgs = {
  buffer: Buffer;
  fileName: string;
  contentType?: string;
  prefix: string;
  metadata?: Record<string, string>;
};

export type UploadedObject = {
  provider: "r2";
  bucket: string;
  objectKey: string;
  etag: string | null;
  publicUrl: string | null;
};

const R2_ACCOUNT_ID = (process.env.R2_ACCOUNT_ID || "").trim();
const R2_ACCESS_KEY_ID = (process.env.R2_ACCESS_KEY_ID || "").trim();
const R2_SECRET_ACCESS_KEY = (process.env.R2_SECRET_ACCESS_KEY || "").trim();
const R2_BUCKET = (process.env.R2_BUCKET || "").trim();
const R2_REGION = (process.env.R2_REGION || "auto").trim();
const R2_ENDPOINT = (process.env.R2_ENDPOINT || (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : "")).trim().replace(/\/+$/, "");
const R2_PUBLIC_BASE_URL = (process.env.R2_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");

let warnedUnavailable = false;

function isConfigured(): boolean {
  return !!(R2_BUCKET && R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

export function isR2StorageEnabled(): boolean {
  const enabled = isConfigured();
  if (!enabled && !warnedUnavailable) {
    warnedUnavailable = true;
    console.log("[R2] Not configured. Using legacy inline storage behavior.");
  }
  return enabled;
}

function sha256Hex(payload: Buffer | string): string {
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
}

function getSigningKey(secret: string, shortDate: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, shortDate);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

function encodePathPreservingSlash(input: string): string {
  return input
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function sanitizePathPart(input: string): string {
  return (input || "file")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "file";
}

function buildObjectKey(prefix: string, fileName: string): string {
  const ext = path.extname(fileName || "").toLowerCase().slice(0, 12);
  const base = path.basename(fileName || "upload", ext);
  const safeBase = sanitizePathPart(base);
  const safePrefix = prefix
    .split("/")
    .map(sanitizePathPart)
    .filter(Boolean)
    .join("/");
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  return `${safePrefix}/${suffix}-${safeBase}${ext}`;
}

function buildPublicUrl(objectKey: string): string | null {
  if (!R2_PUBLIC_BASE_URL) return null;
  return `${R2_PUBLIC_BASE_URL}/${encodePathPreservingSlash(objectKey)}`;
}

function buildDates(now: Date) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return {
    longDate: iso,
    shortDate: iso.slice(0, 8),
  };
}

async function signedR2Request(args: {
  method: "PUT" | "DELETE" | "GET";
  objectKey: string;
  body?: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
}): Promise<Response> {
  if (!isConfigured()) {
    throw new Error("R2 is not configured.");
  }

  const now = new Date();
  const { longDate, shortDate } = buildDates(now);
  const endpoint = new URL(R2_ENDPOINT);
  const host = endpoint.host;
  const encodedKey = encodePathPreservingSlash(args.objectKey);
  const canonicalUri = `/${encodeURIComponent(R2_BUCKET)}/${encodedKey}`;
  const requestUrl = `${R2_ENDPOINT}${canonicalUri}`;

  // Keep a private payload copy to avoid side effects from caller-owned buffers.
  const payload = args.method === "PUT" ? Buffer.from(args.body || Buffer.alloc(0)) : Buffer.alloc(0);
  const payloadHash = sha256Hex(payload);
  const credentialScope = `${shortDate}/${R2_REGION}/s3/aws4_request`;

  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": longDate,
  };

  if (args.contentType) {
    headers["content-type"] = args.contentType;
  }

  if (args.metadata) {
    for (const [key, value] of Object.entries(args.metadata)) {
      const metaKey = `x-amz-meta-${sanitizePathPart(key)}`;
      headers[metaKey] = String(value).trim();
    }
  }

  const sortedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${headers[k]}`).join("\n") + "\n";
  const signedHeaders = sortedHeaderKeys.join(";");

  const canonicalRequest = [
    args.method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    longDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = getSigningKey(R2_SECRET_ACCESS_KEY, shortDate, R2_REGION, "s3");
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const requestHeaders = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    requestHeaders.set(key, value);
  }
  requestHeaders.set("Authorization", authorization);

  return fetch(requestUrl, {
    method: args.method,
    headers: requestHeaders,
    body: args.method === "PUT" ? payload : undefined,
  });
}

export async function uploadBufferToR2(args: UploadArgs): Promise<UploadedObject | null> {
  if (!isR2StorageEnabled()) return null;

  const objectKey = buildObjectKey(args.prefix, args.fileName);
  try {
    const res = await signedR2Request({
      method: "PUT",
      objectKey,
      body: args.buffer,
      contentType: args.contentType || "application/octet-stream",
      metadata: args.metadata,
    });

    if (!res.ok) {
      const reason = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText} ${reason}`.trim());
    }

    return {
      provider: "r2",
      bucket: R2_BUCKET,
      objectKey,
      etag: res.headers.get("etag"),
      publicUrl: buildPublicUrl(objectKey),
    };
  } catch (err: any) {
    console.error("[R2] Upload failed; continuing with DB-only fallback:", err?.message || err);
    return null;
  }
}

export async function deleteR2Object(objectKey: string): Promise<boolean> {
  if (!isR2StorageEnabled() || !objectKey) return false;
  try {
    const res = await signedR2Request({
      method: "DELETE",
      objectKey,
    });
    if (!res.ok && res.status !== 404) {
      const reason = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText} ${reason}`.trim());
    }
    return true;
  } catch (err: any) {
    console.warn("[R2] Failed to delete object:", objectKey, err?.message || err);
    return false;
  }
}

export async function getR2ObjectText(objectKey: string): Promise<string | null> {
  if (!isR2StorageEnabled() || !objectKey) return null;
  try {
    const res = await signedR2Request({
      method: "GET",
      objectKey,
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      const reason = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText} ${reason}`.trim());
    }
    return await res.text();
  } catch (err: any) {
    console.warn("[R2] Failed to fetch object text:", objectKey, err?.message || err);
    return null;
  }
}

export async function getR2ObjectBinary(objectKey: string): Promise<{ buffer: Buffer; contentType: string | null } | null> {
  if (!isR2StorageEnabled() || !objectKey) return null;
  try {
    const res = await signedR2Request({
      method: "GET",
      objectKey,
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      const reason = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText} ${reason}`.trim());
    }
    const arr = await res.arrayBuffer();
    return {
      buffer: Buffer.from(arr),
      contentType: res.headers.get("content-type"),
    };
  } catch (err: any) {
    console.warn("[R2] Failed to fetch object binary:", objectKey, err?.message || err);
    return null;
  }
}
