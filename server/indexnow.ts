/**
 * IndexNow integration for alwakeelo.com
 *
 * IndexNow is a protocol supported by Bing, Yandex, Seznam, and Naver
 * for instant URL indexing notification. Unlike Google's Indexing API:
 *   - No content-type restrictions (works for any page)
 *   - Up to 10,000 URLs per batch request
 *   - No daily quota limit
 *
 * @see https://www.indexnow.org/documentation
 */

const CANONICAL_ORIGIN = "https://www.alwakeelo.com";

// IndexNow API key — must also be served at /{key}.txt
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || "fa47e1d954142b28c985051a0853150d";

// Endpoints for IndexNow-compatible search engines
const INDEXNOW_ENDPOINTS = [
  "https://api.indexnow.org/indexnow",       // shared endpoint (Bing, Yandex, etc.)
];

const BATCH_SIZE = 10_000;          // max per IndexNow spec
const MIN_INTERVAL_MS = 10_000;     // min 10s between submissions
let lastSubmitTime = 0;

/**
 * Returns the IndexNow API key.
 * Serve this at GET /{key}.txt for verification.
 */
export function getIndexNowKey(): string {
  return INDEXNOW_KEY;
}

/**
 * Submit URLs to IndexNow for instant indexing by Bing/Yandex.
 * Automatically batches into chunks of 10,000.
 *
 * @returns Number of successfully submitted URLs
 */
export async function submitToIndexNow(urls: string[]): Promise<{
  submitted: number;
  errors: number;
  details: Array<{ endpoint: string; status: number; batch: number }>;
}> {
  if (urls.length === 0) return { submitted: 0, errors: 0, details: [] };

  const details: Array<{ endpoint: string; status: number; batch: number }> = [];
  let submitted = 0;
  let errors = 0;

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    // Rate limiting
    const now = Date.now();
    const elapsed = now - lastSubmitTime;
    if (elapsed < MIN_INTERVAL_MS && lastSubmitTime > 0) {
      await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
    }

    for (const endpoint of INDEXNOW_ENDPOINTS) {
      try {
        const body = {
          host: "www.alwakeelo.com",
          key: INDEXNOW_KEY,
          keyLocation: `${CANONICAL_ORIGIN}/${INDEXNOW_KEY}.txt`,
          urlList: batch,
        };

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(body),
        });

        const status = response.status;
        details.push({ endpoint, status, batch: batchNum });

        // IndexNow returns 200 (OK), 202 (Accepted), or 200 with message
        if (status >= 200 && status < 300) {
          submitted += batch.length;
        } else {
          const text = await response.text().catch(() => "");
          console.error(
            `[IndexNow] Batch ${batchNum} failed at ${endpoint}: HTTP ${status} — ${text}`,
          );
          errors += batch.length;
        }
      } catch (err: any) {
        console.error(`[IndexNow] Batch ${batchNum} error at ${endpoint}:`, err.message);
        details.push({ endpoint, status: 0, batch: batchNum });
        errors += batch.length;
      }
    }

    lastSubmitTime = Date.now();
  }

  return { submitted, errors, details };
}

/**
 * Submit a single URL to IndexNow (convenience wrapper for real-time notifications).
 */
export async function notifyIndexNow(url: string): Promise<boolean> {
  try {
    for (const endpoint of INDEXNOW_ENDPOINTS) {
      const params = new URLSearchParams({
        url,
        key: INDEXNOW_KEY,
      });
      const response = await fetch(`${endpoint}?${params}`, { method: "GET" });
      if (response.status >= 200 && response.status < 300) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ── Sitemap Ping (Google + Bing) ──────────────────────────────────────────

let lastPingTime = 0;
const PING_DEBOUNCE_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Ping Google and Bing to re-crawl the sitemap.
 * Debounced to max once per 10 minutes.
 */
export async function pingSitemapToSearchEngines(): Promise<void> {
  const now = Date.now();
  if (now - lastPingTime < PING_DEBOUNCE_MS) return;
  lastPingTime = now;

  const sitemapUrl = encodeURIComponent(`${CANONICAL_ORIGIN}/sitemap.xml`);
  const pingUrls = [
    `https://www.google.com/ping?sitemap=${sitemapUrl}`,
    `https://www.bing.com/ping?sitemap=${sitemapUrl}`,
  ];

  for (const pingUrl of pingUrls) {
    try {
      const res = await fetch(pingUrl, { method: "GET" });
      if (res.ok) {
        console.log(`[SEO] Sitemap ping OK: ${pingUrl}`);
      }
    } catch (err: any) {
      console.error(`[SEO] Sitemap ping failed: ${pingUrl}`, err.message);
    }
  }
}
