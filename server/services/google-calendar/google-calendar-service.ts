import axios from "axios";
import { db } from "../../db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  CourtHearingCalendarEvent,
  formatHearingDescription,
  formatHearingLocation,
  toUtcCalendarTimestamps,
} from "@shared/calendar-builder";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";

const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

/**
 * Builds the Google OAuth 2.0 authorization URL for calendar access
 */
export function getGoogleCalendarAuthUrl(userId: string, redirectUri: string): string {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured in environment variables.");
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: CALENDAR_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state: userId,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchanges authorization code for access and refresh tokens, then saves to DB
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  userId: string
): Promise<{ success: boolean; email?: string; error?: string }> {
  if (!db) return { success: false, error: "Database unavailable" };
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return { success: false, error: "Google OAuth credentials missing on server." };
  }

  try {
    const tokenRes = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const { access_token, refresh_token, expires_in, scope } = tokenRes.data;
    const tokenExpiry = new Date(Date.now() + (expires_in || 3600) * 1000);

    // Fetch user profile email
    let userEmail: string | undefined;
    try {
      const profileRes = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      userEmail = profileRes.data.email;
    } catch {
      // Non-critical if userinfo is unavailable
    }

    // Persist to user_google_calendar_connections
    await db
      .insert(schema.userGoogleCalendarConnections)
      .values({
        userId,
        email: userEmail,
        accessToken: access_token,
        refreshToken: refresh_token || null,
        tokenExpiry,
        scope,
        calendarId: "primary",
        autoSyncEnabled: true,
      })
      .onConflictDoUpdate({
        target: [schema.userGoogleCalendarConnections.userId],
        set: {
          email: userEmail,
          accessToken: access_token,
          refreshToken: refresh_token ? refresh_token : undefined,
          tokenExpiry,
          scope,
          updatedAt: new Date(),
        },
      });

    return { success: true, email: userEmail };
  } catch (err: any) {
    console.error("[GoogleCalendarService] Token exchange failed:", err?.response?.data || err.message);
    return { success: false, error: err?.response?.data?.error_description || err.message };
  }
}

/**
 * Retrieves a valid access token for a user, automatically refreshing if expired
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  if (!db) return null;

  const [conn] = await db
    .select()
    .from(schema.userGoogleCalendarConnections)
    .where(eq(schema.userGoogleCalendarConnections.userId, userId))
    .limit(1);

  if (!conn) return null;

  const isExpired = !conn.tokenExpiry || new Date(conn.tokenExpiry).getTime() - 60_000 < Date.now();

  if (!isExpired) {
    return conn.accessToken;
  }

  // Token is expired; attempt refresh using refresh_token
  if (!conn.refreshToken || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return null;
  }

  try {
    const refreshRes = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: conn.refreshToken,
        grant_type: "refresh_token",
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const { access_token, expires_in } = refreshRes.data;
    const newExpiry = new Date(Date.now() + (expires_in || 3600) * 1000);

    await db
      .update(schema.userGoogleCalendarConnections)
      .set({
        accessToken: access_token,
        tokenExpiry: newExpiry,
        updatedAt: new Date(),
      })
      .where(eq(schema.userGoogleCalendarConnections.userId, userId));

    return access_token;
  } catch (err: any) {
    console.error("[GoogleCalendarService] Refresh token failed:", err?.response?.data || err.message);
    return null;
  }
}

/**
 * Builds standard Google Calendar API v3 event resource payload
 */
export function buildGoogleApiEventPayload(event: CourtHearingCalendarEvent) {
  const [year, month, day] = event.date.split("-").map((v) => parseInt(v, 10));
  let hours = 9;
  let minutes = 0;

  if (event.time && event.time.includes(":")) {
    const [h, m] = event.time.split(":").map((v) => parseInt(v, 10));
    if (!isNaN(h) && h >= 0 && h < 24) hours = h;
    if (!isNaN(m) && m >= 0 && m < 60) minutes = m;
  }

  // Start Date in Asia/Karachi (PKT UTC+5)
  const pad = (n: number) => String(n).padStart(2, "0");
  const startDateTime = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00+05:00`;
  
  const endHours = hours + 2; // Default 2 hours
  const endDateTime = `${year}-${pad(month)}-${pad(day)}T${pad(Math.min(endHours, 23))}:${pad(minutes)}:00+05:00`;

  const titlePrefix = event.isRedList ? "🚨 [RED LIST] " : "🏛️ ";

  return {
    summary: `${titlePrefix}${event.title}`,
    description: formatHearingDescription(event),
    location: formatHearingLocation(event),
    start: {
      dateTime: startDateTime,
      timeZone: "Asia/Karachi",
    },
    end: {
      dateTime: endDateTime,
      timeZone: "Asia/Karachi",
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 60 },
        { method: "email", minutes: 120 },
      ],
    },
    colorId: event.isRedList ? "11" : "2", // 11 = Red/Flamingo, 2 = Sage/Green
  };
}

/**
 * Creates an event directly in the user's primary Google Calendar
 */
export async function createGoogleCalendarEvent(
  userId: string,
  event: CourtHearingCalendarEvent
): Promise<string | null> {
  const token = await getValidAccessToken(userId);
  if (!token) return null;

  try {
    const payload = buildGoogleApiEventPayload(event);
    const res = await axios.post(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    return res.data.id || null;
  } catch (err: any) {
    console.error("[GoogleCalendarService] Failed to create event:", err?.response?.data || err.message);
    return null;
  }
}

/**
 * Updates an existing Google Calendar event
 */
export async function updateGoogleCalendarEvent(
  userId: string,
  googleEventId: string,
  event: CourtHearingCalendarEvent
): Promise<boolean> {
  const token = await getValidAccessToken(userId);
  if (!token) return false;

  try {
    const payload = buildGoogleApiEventPayload(event);
    await axios.patch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    return true;
  } catch (err: any) {
    console.error("[GoogleCalendarService] Failed to update event:", err?.response?.data || err.message);
    return false;
  }
}

/**
 * Deletes an event from the user's Google Calendar
 */
export async function deleteGoogleCalendarEvent(
  userId: string,
  googleEventId: string
): Promise<boolean> {
  const token = await getValidAccessToken(userId);
  if (!token) return false;

  try {
    await axios.delete(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return true;
  } catch (err: any) {
    console.error("[GoogleCalendarService] Failed to delete event:", err?.response?.data || err.message);
    return false;
  }
}

/**
 * Returns connection status and preferences
 */
export async function getCalendarConnectionStatus(userId: string) {
  if (!db) return { isConnected: false };

  const [conn] = await db
    .select()
    .from(schema.userGoogleCalendarConnections)
    .where(eq(schema.userGoogleCalendarConnections.userId, userId))
    .limit(1);

  if (!conn) {
    return { isConnected: false };
  }

  return {
    isConnected: true,
    email: conn.email,
    autoSyncEnabled: conn.autoSyncEnabled,
    syncRemindersMinutes: conn.syncRemindersMinutes,
    updatedAt: conn.updatedAt,
  };
}

/**
 * Disconnects the Google Calendar integration
 */
export async function disconnectGoogleCalendar(userId: string): Promise<boolean> {
  if (!db) return false;

  await db
    .delete(schema.userGoogleCalendarConnections)
    .where(eq(schema.userGoogleCalendarConnections.userId, userId));

  return true;
}
