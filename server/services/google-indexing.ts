import { google } from "googleapis";

/**
 * Trigger the Google Indexing API to notify Google Search of a new or updated judgment URL.
 * 
 * Looks for Service Account credentials in `process.env.GOOGLE_INDEXING_CREDENTIALS` (JSON string).
 * If credentials are not configured, it will log a warning and return gracefully, ensuring the
 * application continues running without failures.
 */
export async function triggerGoogleIndexing(judgmentId: string, type: "URL_UPDATED" | "URL_DELETED" = "URL_UPDATED"): Promise<void> {
  const targetUrl = `https://www.alwakeelo.com/judgment/${judgmentId}`;
  
  let credentials: any = null;
  if (process.env.GOOGLE_INDEXING_CREDENTIALS) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_INDEXING_CREDENTIALS);
    } catch (err: any) {
      console.warn("[Google Indexing] Failed parsing GOOGLE_INDEXING_CREDENTIALS environment variable:", err?.message);
    }
  }

  if (!credentials) {
    // Graceful no-op when credentials are not configured in environment
    console.log(`[Google Indexing] Credentials not configured. Skipping indexing notification for URL: ${targetUrl}`);
    return;
  }

  try {
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/indexing"]
    });

    await auth.authorize();

    const indexing = google.indexing({
      version: "v3",
      auth
    });

    const response = await indexing.urlNotifications.publish({
      requestBody: {
        url: targetUrl,
        type
      }
    });

    console.log(`[Google Indexing] Successfully notified Google of ${type} for URL: ${targetUrl}. Status:`, response.status);
  } catch (err: any) {
    console.error(`[Google Indexing] Failed to notify Google of ${type} for URL: ${targetUrl}:`, err?.message || err);
  }
}
