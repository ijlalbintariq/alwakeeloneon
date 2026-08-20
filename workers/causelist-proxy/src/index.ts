/**
 * Cloudflare Worker — Court Portal Proxy for Cause List Scraping
 *
 * Deploys on Cloudflare's edge (Lahore, Islamabad, Karachi nodes)
 * to fetch court cause lists with low latency and no IP blocking.
 *
 * The Render backend POSTs { url, headers } to this Worker,
 * which fetches the court portal and returns the raw response.
 *
 * Environment variable:
 *   PROXY_SECRET — shared secret token for authentication
 */

export interface Env {
  PROXY_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Only allow POST
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Auth check
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

      // Fetch the court portal from Cloudflare's edge
      const response = await fetch(body.url, {
        headers: body.headers || {},
        cf: {
          // Cache responses for 5 minutes to reduce load on court portals
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
