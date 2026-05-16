/**
 * Diary Email System — Daily & Weekly digest emails for lawyers
 * Uses the existing Resend infrastructure from email.ts
 */
import { storage } from "./storage";
import { isEmailProviderConfigured } from "./email";

// Re-use the internal sendEmailViaResend pattern
import { Resend } from "resend";

function resolveResendApiKey(): string {
  return String(process.env.RESEND_API_KEY || process.env.EMAIL_RESEND_API_KEY || "").trim();
}
function resolveFromEmail(): string {
  return String(process.env.RESEND_FROM_EMAIL || process.env.FROM_EMAIL || "Al Wakeelo <onboarding@resend.dev>").trim();
}
function resolveBrandLogoUrl(): string {
  return String(process.env.EMAIL_BRAND_LOGO_URL || "https://alwakeelo.com/icon-192.png?v=20260312b").trim();
}

function escapeHtml(value: string): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const apiKey = resolveResendApiKey();
  if (!apiKey) { console.warn("[DiaryMailer] No Resend API key"); return false; }
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({ from: resolveFromEmail(), to, subject, html, text });
    if (error) { console.error("[DiaryMailer] Send error:", error); return false; }
    return true;
  } catch (err: any) {
    console.error("[DiaryMailer] Exception:", err?.message);
    return false;
  }
}

// ─── Email Templates ──────────────────────────────────────

type DiaryEmailItem = {
  title: string;
  time?: string | null;
  type?: string;
  source: string;
  court?: string | null;
  judge?: string | null;
  caseTitle?: string | null;
  description?: string | null;
  priority?: string;
  outcome?: string | null;
  nextDate?: string | null;
};

function buildItemCardHtml(item: DiaryEmailItem): string {
  const safeTitle = escapeHtml(item.title);
  const isCompliance = item.source === "compliance";
  const dotColor = isCompliance ? "#ef4444" : "#f4b11e";
  const typeLabel = item.type ? escapeHtml(item.type.replace(/_/g, " ")) : "";

  let meta = "";
  if (item.court) meta += escapeHtml(item.court);
  if (item.time) meta += (meta ? " • " : "") + escapeHtml(item.time);
  if (typeLabel && isCompliance) meta += (meta ? " • " : "") + typeLabel;
  if (item.judge) meta += (meta ? " • " : "") + "Justice " + escapeHtml(item.judge);

  let extra = "";
  if (item.description) extra += `<p style="margin:6px 0 0;color:#9bb0cc;font-size:12px;line-height:1.5;">${escapeHtml(item.description)}</p>`;
  if (item.outcome) {
    extra += `<p style="margin:6px 0 0;"><span style="display:inline-block;padding:2px 8px;border-radius:6px;background:#1a2744;border:1px solid #2a3a56;color:#f4b11e;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${escapeHtml(item.outcome.replace(/_/g, " "))}</span></p>`;
  }
  if (item.nextDate) {
    const nd = new Date(item.nextDate + "T00:00:00");
    const ndLabel = nd.toLocaleDateString("en-PK", { weekday: "short", month: "short", day: "numeric" });
    extra += `<p style="margin:4px 0 0;color:#f4b11e;font-size:11px;font-weight:700;">→ Next Date: ${escapeHtml(ndLabel)}</p>`;
  }

  const caseLabel = item.caseTitle ? `<p style="margin:4px 0 0;color:#7a90ae;font-size:11px;">Case: ${escapeHtml(item.caseTitle)}</p>` : "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;background:#111e36;border:1px solid #24344f;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:14px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:10px;vertical-align:top;padding-top:4px;">
                <div style="width:8px;height:8px;border-radius:50%;background:${dotColor};"></div>
              </td>
              <td style="padding-left:10px;">
                <p style="margin:0;color:#f8fafc;font-size:14px;font-weight:700;line-height:1.3;">${safeTitle}</p>
                ${meta ? `<p style="margin:4px 0 0;color:#b6c4d9;font-size:12px;line-height:1.5;">${meta}</p>` : ""}
                ${caseLabel}
                ${extra}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function buildDailyDigestHtml(userName: string, items: DiaryEmailItem[], dateLabel: string): { html: string; text: string } {
  const safeName = escapeHtml(userName);
  const safeDateLabel = escapeHtml(dateLabel);
  const logoUrl = escapeHtml(resolveBrandLogoUrl());

  const itemsHtml = items.length > 0
    ? items.map(buildItemCardHtml).join("")
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;background:#111e36;border:1px solid #24344f;border-radius:12px;">
        <tr><td style="padding:20px;text-align:center;">
          <p style="margin:0;color:#7a90ae;font-size:14px;">No hearings or tasks scheduled</p>
        </td></tr>
       </table>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a1222;font-family:Inter,Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a1222;padding:28px 14px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#101b31;border:1px solid #2a3a56;border-radius:20px;overflow:hidden;">
        <tr><td style="padding:4px 0 0 0;background:#f4b11e;"></td></tr>
        <tr>
          <td style="padding:30px 28px 20px 28px;text-align:center;background:linear-gradient(180deg,#0f172a 0%,#0b1427 100%);border-bottom:1px solid #24344f;">
            <img src="${logoUrl}" alt="Al Wakeelo" width="56" height="56" style="display:block;width:56px;height:56px;border-radius:14px;margin:0 auto 14px;border:1px solid rgba(244,177,30,0.45);" />
            <h1 style="margin:0;color:#f8fafc;font-size:24px;line-height:1.15;font-weight:800;">Daily Diary</h1>
            <p style="margin:8px 0 0;color:#f4b11e;font-size:11px;line-height:1.4;font-weight:800;letter-spacing:2px;text-transform:uppercase;">${safeDateLabel}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 6px;color:#e8eefb;font-size:15px;line-height:1.6;">Assalam-o-Alaikum ${safeName},</p>
            <p style="margin:0 0 18px;color:#b6c4d9;font-size:14px;line-height:1.7;">
              ${items.length > 0 ? `You have <strong style="color:#f4b11e;">${items.length}</strong> ${items.length === 1 ? "item" : "items"} on your schedule:` : "Your schedule for tomorrow is clear."}
            </p>
            ${itemsHtml}
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 0;">
              <tr>
                <td align="center" bgcolor="#f4b11e" style="border-radius:12px;box-shadow:0 12px 24px rgba(244,177,30,0.24);">
                  <a href="https://alwakeelo.com/daily-diary" style="display:inline-block;padding:14px 28px;color:#0d172a;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:0.6px;text-transform:uppercase;">Open in Al Wakeelo</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px;background:#0b1427;border-top:1px solid #24344f;text-align:center;">
            <p style="margin:0 0 4px;color:#7a90ae;font-size:10px;line-height:1.6;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;">Al Wakeelo • Daily Diary Reminder</p>
            <p style="margin:0 0 4px;color:#64748b;font-size:11px;line-height:1.6;">Need help? <a href="mailto:support@alwakeelo.com" style="color:#f4b11e;text-decoration:none;font-weight:700;">support@alwakeelo.com</a></p>
            <p style="margin:0;color:#4a6080;font-size:9px;">Manage email preferences in Settings</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Assalam-o-Alaikum ${userName},\n\nYour schedule for ${dateLabel}:\n\n${items.length > 0 ? items.map(i => `• ${i.title}${i.time ? " at " + i.time : ""}${i.court ? " — " + i.court : ""}`).join("\n") : "No items scheduled."}\n\nOpen: https://alwakeelo.com/daily-diary\n\n- Al Wakeelo`;
  return { html, text };
}

function buildWeeklyDigestHtml(userName: string, itemsByDay: Record<string, DiaryEmailItem[]>): { html: string; text: string } {
  const safeName = escapeHtml(userName);
  const logoUrl = escapeHtml(resolveBrandLogoUrl());
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const sortedDays = Object.keys(itemsByDay).sort();

  let totalItems = 0;
  let activeDays = 0;
  sortedDays.forEach(d => { const c = itemsByDay[d].length; totalItems += c; if (c > 0) activeDays++; });

  let daysHtml = "";
  for (const dayStr of sortedDays) {
    const items = itemsByDay[dayStr];
    const date = new Date(dayStr + "T00:00:00");
    const dayLabel = dayNames[date.getDay() === 0 ? 6 : date.getDay() - 1] || date.toLocaleDateString("en-PK", { weekday: "long" });
    const dateFormatted = date.toLocaleDateString("en-PK", { month: "short", day: "numeric" });

    daysHtml += `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;">
        <tr><td style="padding:8px 0 4px;">
          <p style="margin:0;color:#f4b11e;font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;">${escapeHtml(dayLabel)} • ${escapeHtml(dateFormatted)}</p>
        </td></tr>
      </table>`;

    if (items.length > 0) {
      daysHtml += items.map(buildItemCardHtml).join("");
    } else {
      daysHtml += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;background:#111e36;border:1px solid #1a2744;border-radius:10px;">
        <tr><td style="padding:12px 16px;text-align:center;">
          <p style="margin:0;color:#4a6080;font-size:12px;">No Hearings Scheduled</p>
        </td></tr>
      </table>`;
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a1222;font-family:Inter,Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a1222;padding:28px 14px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#101b31;border:1px solid #2a3a56;border-radius:20px;overflow:hidden;">
        <tr><td style="padding:4px 0 0 0;background:#f4b11e;"></td></tr>
        <tr>
          <td style="padding:30px 28px 20px 28px;text-align:center;background:linear-gradient(180deg,#0f172a 0%,#0b1427 100%);border-bottom:1px solid #24344f;">
            <img src="${logoUrl}" alt="Al Wakeelo" width="56" height="56" style="display:block;width:56px;height:56px;border-radius:14px;margin:0 auto 14px;border:1px solid rgba(244,177,30,0.45);" />
            <h1 style="margin:0;color:#f8fafc;font-size:24px;line-height:1.15;font-weight:800;">Weekly Diary</h1>
            <p style="margin:8px 0 0;color:#f4b11e;font-size:11px;line-height:1.4;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Upcoming Week Summary</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 6px;color:#e8eefb;font-size:15px;line-height:1.6;">Assalam-o-Alaikum ${safeName},</p>
            <p style="margin:0 0 18px;color:#b6c4d9;font-size:14px;line-height:1.7;">
              ${totalItems > 0 ? `You have <strong style="color:#f4b11e;">${totalItems}</strong> ${totalItems === 1 ? "item" : "items"} across <strong style="color:#f4b11e;">${activeDays}</strong> ${activeDays === 1 ? "day" : "days"} next week.` : "Your upcoming week looks clear."}
            </p>
            ${daysHtml}
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 0;">
              <tr>
                <td align="center" bgcolor="#f4b11e" style="border-radius:12px;box-shadow:0 12px 24px rgba(244,177,30,0.24);">
                  <a href="https://alwakeelo.com/daily-diary" style="display:inline-block;padding:14px 28px;color:#0d172a;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:0.6px;text-transform:uppercase;">Open Weekly Diary</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px;background:#0b1427;border-top:1px solid #24344f;text-align:center;">
            <p style="margin:0 0 4px;color:#7a90ae;font-size:10px;line-height:1.6;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;">Al Wakeelo • Weekly Diary Summary</p>
            <p style="margin:0 0 4px;color:#64748b;font-size:11px;line-height:1.6;">Need help? <a href="mailto:support@alwakeelo.com" style="color:#f4b11e;text-decoration:none;font-weight:700;">support@alwakeelo.com</a></p>
            <p style="margin:0;color:#4a6080;font-size:9px;">Manage email preferences in Settings</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Assalam-o-Alaikum ${userName},\n\nYour upcoming week:\n\n${sortedDays.map(d => {
    const items = itemsByDay[d];
    const date = new Date(d + "T00:00:00");
    const label = date.toLocaleDateString("en-PK", { weekday: "long", month: "short", day: "numeric" });
    return `${label}:\n${items.length > 0 ? items.map(i => `  • ${i.title}${i.time ? " at " + i.time : ""}`).join("\n") : "  No hearings scheduled"}`;
  }).join("\n\n")}\n\nOpen: https://alwakeelo.com/daily-diary\n\n- Al Wakeelo`;

  return { html, text };
}

// ─── Digest Runners ──────────────────────────────────────

async function getItemsForDate(userId: string, dateStr: string): Promise<DiaryEmailItem[]> {
  const manual = await storage.getDiaryEntries(userId, dateStr, dateStr);
  const compliance = await storage.getUpcomingCompliance(userId, 100);

  const manualItems: DiaryEmailItem[] = manual.map((e: any) => ({
    title: e.title,
    time: e.time,
    source: "manual",
    description: e.description,
    priority: e.priority,
    outcome: e.outcome,
    nextDate: e.nextDate,
  }));

  const compItems: DiaryEmailItem[] = compliance
    .filter((c: any) => {
      const d = new Date(c.dueDate).toISOString().slice(0, 10);
      return d === dateStr;
    })
    .map((c: any) => ({
      title: c.title,
      time: null,
      type: c.type,
      source: "compliance",
      court: c.court,
      judge: c.judge,
      caseTitle: c.caseTitle,
      description: c.notes,
      priority: c.type === "hearing" ? "high" : "normal",
    }));

  return [...manualItems, ...compItems];
}

export async function sendDailyDigestForUser(userId: string, email: string, firstName: string | null): Promise<boolean> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const dateLabel = tomorrow.toLocaleDateString("en-PK", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const items = await getItemsForDate(userId, tomorrowStr);
  const name = firstName || "Counsel";
  const { html, text } = buildDailyDigestHtml(name, items, dateLabel);

  const sent = await sendEmail(email, `Your Diary for ${dateLabel} — Al Wakeelo`, html, text);
  if (sent) {
    await storage.markDailyDigestSent(userId);
    console.log(`[DiaryMailer] Daily digest sent to ${email}`);
  }
  return sent;
}

export async function sendWeeklyDigestForUser(userId: string, email: string, firstName: string | null): Promise<boolean> {
  const today = new Date();
  // Find next Monday
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysUntilMonday);

  const itemsByDay: Record<string, DiaryEmailItem[]> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    itemsByDay[dateStr] = await getItemsForDate(userId, dateStr);
  }

  const name = firstName || "Counsel";
  const { html, text } = buildWeeklyDigestHtml(name, itemsByDay);

  const mondayLabel = monday.toLocaleDateString("en-PK", { month: "short", day: "numeric" });
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const fridayLabel = friday.toLocaleDateString("en-PK", { month: "short", day: "numeric" });

  const sent = await sendEmail(email, `Weekly Diary: ${mondayLabel} – ${fridayLabel} — Al Wakeelo`, html, text);
  if (sent) {
    await storage.markWeeklyDigestSent(userId);
    console.log(`[DiaryMailer] Weekly digest sent to ${email}`);
  }
  return sent;
}

// ─── Scheduler ──────────────────────────────────────────

async function runDailyDigestJob(): Promise<void> {
  if (!isEmailProviderConfigured()) return;

  try {
    const users = await storage.getUsersForDailyDigest();
    if (users.length === 0) return;

    console.log(`[DiaryMailer] Running daily digest for ${users.length} user(s)`);

    // Send in batches of 5
    for (let i = 0; i < users.length; i += 5) {
      const batch = users.slice(i, i + 5);
      await Promise.all(
        batch.map(u => sendDailyDigestForUser(u.userId, u.email, u.firstName).catch(err => {
          console.error(`[DiaryMailer] Failed for ${u.email}:`, err?.message);
        }))
      );
      if (i + 5 < users.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  } catch (err: any) {
    console.error("[DiaryMailer] Daily digest job error:", err?.message);
  }
}

async function runWeeklyDigestJob(): Promise<void> {
  if (!isEmailProviderConfigured()) return;

  try {
    const users = await storage.getUsersForWeeklyDigest();
    if (users.length === 0) return;

    console.log(`[DiaryMailer] Running weekly digest for ${users.length} user(s)`);

    for (let i = 0; i < users.length; i += 5) {
      const batch = users.slice(i, i + 5);
      await Promise.all(
        batch.map(u => sendWeeklyDigestForUser(u.userId, u.email, u.firstName).catch(err => {
          console.error(`[DiaryMailer] Weekly failed for ${u.email}:`, err?.message);
        }))
      );
      if (i + 5 < users.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  } catch (err: any) {
    console.error("[DiaryMailer] Weekly digest job error:", err?.message);
  }
}

function getPKTHour(): number {
  // Pakistan Standard Time = UTC+5
  const now = new Date();
  const utcHour = now.getUTCHours();
  return (utcHour + 5) % 24;
}

function getPKTDay(): number {
  const now = new Date();
  // Get PKT day of week (0=Sun, 6=Sat)
  const utcDay = now.getUTCDay();
  const utcHour = now.getUTCHours();
  // If UTC+5 rolls over to next day
  if (utcHour + 5 >= 24) return (utcDay + 1) % 7;
  return utcDay;
}

let lastDailyRunDate = "";
let lastWeeklyRunDate = "";

async function checkAndRun(): Promise<void> {
  const pktHour = getPKTHour();
  const pktDay = getPKTDay();
  const todayKey = new Date().toISOString().slice(0, 10);

  // Daily digest: run at 7 PM PKT (19:00)
  if (pktHour === 19 && lastDailyRunDate !== todayKey) {
    lastDailyRunDate = todayKey;
    await runDailyDigestJob();
  }

  // Weekly digest: run Saturday at 7 PM PKT
  if (pktDay === 6 && pktHour === 19 && lastWeeklyRunDate !== todayKey) {
    lastWeeklyRunDate = todayKey;
    await runWeeklyDigestJob();
  }
}

export function startDiaryEmailScheduler(): void {
  console.log("[DiaryMailer] Scheduler started. Daily at 7 PM PKT, Weekly on Saturday.");
  // Check every 15 minutes
  setInterval(() => {
    checkAndRun().catch(err => console.error("[DiaryMailer] Scheduler error:", err?.message));
  }, 15 * 60 * 1000);

  // Also run once at startup (after 30s delay to let DB settle)
  setTimeout(() => {
    checkAndRun().catch(err => console.error("[DiaryMailer] Startup check error:", err?.message));
  }, 30 * 1000);
}
