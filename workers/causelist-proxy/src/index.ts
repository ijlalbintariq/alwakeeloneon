/**
 * Cloudflare Worker — Court Portal Proxy for Cause List Scraping
 *
 * Deploys on Cloudflare's edge (Lahore, Islamabad, Karachi nodes)
 * to fetch court cause lists with low latency and no IP blocking.
 *
 * Environment variable:
 *   PROXY_SECRET — shared secret token for authentication
 */

export interface Env {
  PROXY_SECRET: string;
}

const DEFAULT_BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const token = request.headers.get("x-proxy-token");
    if (!env.PROXY_SECRET || token !== env.PROXY_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const body = (await request.json()) as {
        url: string;
        headers?: Record<string, string>;
      };

      if (!body.url) {
        return new Response("Missing url", { status: 400 });
      }

      const requestHeaders = {
        ...DEFAULT_BROWSER_HEADERS,
        ...(body.headers || {}),
      };

      // Fetch from Cloudflare edge
      const response = await fetch(body.url, {
        headers: requestHeaders,
        redirect: "follow",
        cf: {
          cacheTtl: 300,
          cacheEverything: true,
        },
      });

      const buffer = await response.arrayBuffer();

      return new Response(buffer, {
        status: response.status,
        headers: {
          "content-type":
            response.headers.get("content-type") ||
            "application/octet-stream",
          "x-original-status": String(response.status),
          "x-content-length": String(buffer.byteLength),
          "access-control-allow-origin": "*",
        },
      });
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: err.message || "Proxy fetch failed" }),
        {
          status: 502,
          headers: { "content-type": "application/json" },
        }
      );
    }
  },
};
