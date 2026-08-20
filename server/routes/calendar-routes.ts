import { Router, Request, Response } from "express";
import { isAuthenticated } from "../replit_integrations/auth/replitAuth";
import {
  getGoogleCalendarAuthUrl,
  exchangeCodeForTokens,
  getCalendarConnectionStatus,
  disconnectGoogleCalendar,
  createGoogleCalendarEvent,
} from "../services/google-calendar/google-calendar-service";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";

const router = Router();

/**
 * GET /api/calendar/google/auth-url
 * Returns Google OAuth consent URL for user
 */
router.get("/google/auth-url", isAuthenticated, (req: any, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const host = req.get("host");
    const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
    const redirectUri = `${protocol}://${host}/api/calendar/google/callback`;

    const authUrl = getGoogleCalendarAuthUrl(userId, redirectUri);
    return res.json({ authUrl });
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to generate auth URL", error: err.message });
  }
});

/**
 * GET /api/calendar/google/callback
 * Handles OAuth 2.0 redirect from Google
 */
router.get("/google/callback", async (req: Request, res: Response) => {
  const code = String(req.query.code || "");
  const stateUserId = String(req.query.state || "");
  const error = req.query.error;

  if (error || !code) {
    return res.redirect(`/daily-diary?calendar_error=${encodeURIComponent(String(error || "Access Denied"))}`);
  }

  const host = req.get("host");
  const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
  const redirectUri = `${protocol}://${host}/api/calendar/google/callback`;

  const result = await exchangeCodeForTokens(code, redirectUri, stateUserId);

  if (result.success) {
    return res.redirect("/daily-diary?calendar_connected=true");
  } else {
    return res.redirect(`/daily-diary?calendar_error=${encodeURIComponent(result.error || "Failed to connect")}`);
  }
});

/**
 * GET /api/calendar/google/status
 * Returns current calendar connection status
 */
router.get("/google/status", isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const status = await getCalendarConnectionStatus(userId);
    return res.json(status);
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to get status", error: err.message });
  }
});

/**
 * POST /api/calendar/google/toggle-auto-sync
 * Toggles auto-sync preference
 */
router.post("/google/toggle-auto-sync", isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { enabled } = req.body;
    if (!db) return res.status(503).json({ message: "Database unavailable" });

    await db
      .update(schema.userGoogleCalendarConnections)
      .set({
        autoSyncEnabled: Boolean(enabled),
        updatedAt: new Date(),
      })
      .where(eq(schema.userGoogleCalendarConnections.userId, userId));

    return res.json({ success: true, autoSyncEnabled: Boolean(enabled) });
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to update preference", error: err.message });
  }
});

/**
 * POST /api/calendar/google/sync-all
 * Pushes all unsynced upcoming daily diary events to Google Calendar
 */
router.post("/google/sync-all", isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!db) return res.status(503).json({ message: "Database unavailable" });

    const todayStr = new Date().toISOString().slice(0, 10);

    // Fetch upcoming diary entries without google_event_id
    const entries = await db
      .select()
      .from(schema.diaryEntries)
      .where(
        and(
          eq(schema.diaryEntries.userId, userId),
          isNull(schema.diaryEntries.googleEventId)
        )
      );

    let syncedCount = 0;
    for (const entry of entries) {
      const eventId = await createGoogleCalendarEvent(userId, {
        title: entry.title,
        date: entry.date,
        time: entry.time,
        fixationPurpose: entry.description || entry.outcome,
        isRedList: entry.priority === "urgent",
      });

      if (eventId) {
        await db
          .update(schema.diaryEntries)
          .set({ googleEventId: eventId })
          .where(eq(schema.diaryEntries.id, entry.id));
        syncedCount++;
      }
    }

    return res.json({ success: true, totalEntries: entries.length, syncedCount });
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to sync entries", error: err.message });
  }
});

/**
 * DELETE /api/calendar/google/disconnect
 * Disconnects the user's Google Calendar connection
 */
router.delete("/google/disconnect", isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    await disconnectGoogleCalendar(userId);
    return res.json({ success: true, message: "Google Calendar disconnected." });
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to disconnect", error: err.message });
  }
});

export default router;
