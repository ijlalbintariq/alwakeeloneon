/**
 * Proxy-aware HTTP fetch for court portal scraping.
 *
 * When CAUSELIST_PROXY_URL and CAUSELIST_PROXY_SECRET are set,
 * requests are routed through the Cloudflare Worker proxy
 * (which runs from edge nodes in Pakistan for low latency).
 *
 * When not set, falls back to direct axios.get (for local dev).
 */
import axios, { type AxiosResponse } from "axios";

const PROXY_URL = process.env.CAUSELIST_PROXY_URL;
const PROXY_SECRET = process.env.CAUSELIST_PROXY_SECRET;

/**
 * Fetches a URL, optionally routing through the Cloudflare Worker proxy.
 * Drop-in replacement for axios.get() in court adapters.
 */
export async function proxyGet(
  url: string,
  opts: {
    headers?: Record<string, string>;
    timeout?: number;
    responseType?: string;
    validateStatus?: (status: number) => boolean;
  } = {}
): Promise<AxiosResponse> {
  if (PROXY_URL && PROXY_SECRET) {
    // Route through Cloudflare Worker proxy
    const resp = await axios.post(
      PROXY_URL,
      { url, headers: opts.headers || {} },
      {
        timeout: opts.timeout || 60_000,
        responseType: (opts.responseType as any) || "arraybuffer",
        headers: {
          "x-proxy-token": PROXY_SECRET,
          "content-type": "application/json",
        },
        validateStatus: (status) => {
          // Proxy returns 502 on upstream failure, treat as retriable
          if (status === 502) return false;
          // Use caller's validateStatus if provided
          if (opts.validateStatus) return opts.validateStatus(status);
          return status >= 200 && status < 300;
        },
      }
    );

    // Map the original status from proxy header
    const originalStatus = parseInt(
      resp.headers["x-original-status"] || String(resp.status),
      10
    );
    resp.status = originalStatus;

    return resp;
  }

  // Direct fetch fallback (local dev / no proxy configured)
  return axios.get(url, opts as any);
}

/**
 * Convenience: check if proxy is configured
 */
export function isProxyConfigured(): boolean {
  return !!(PROXY_URL && PROXY_SECRET);
}
