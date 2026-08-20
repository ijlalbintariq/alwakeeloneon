import { Resend } from "resend";

function resolveResendApiKey(): string {
  return String(process.env.RESEND_API_KEY || process.env.EMAIL_RESEND_API_KEY || "").trim();
}

function resolveFromEmail(): string {
  return String(process.env.RESEND_FROM_EMAIL || process.env.FROM_EMAIL || "Al Wakeelo <onboarding@resend.dev>").trim();
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface MatchedHearingItem {
  caseNumber: string;
  caseTitle: string;
  serialNumber: number | null;
  court: string;
  bench: string;
  courtNumber?: string | null;
  judgeName: string;
  listType: string;
  fixationPurpose?: string | null;
  isRedList?: boolean;
}

export async function sendCauseListAlertEmail(
  toEmail: string,
  userName: string,
  targetDate: string,
  hearings: MatchedHearingItem[]
): Promise<boolean> {
  const apiKey = resolveResendApiKey();
  if (!apiKey) {
    console.warn("[CauseListNotifications] No Resend API key configured, skipping email dispatch");
    return false;
  }

  if (!hearings || hearings.length === 0) return false;

  const count = hearings.length;
  const subject = `🔔 Court Hearing Alert: ${count} case${count > 1 ? "s" : ""} fixed for ${targetDate}`;

  const hearingsHtml = hearings
    .map((h) => {
      const courtroomStr = h.courtNumber ? ` (${escapeHtml(h.courtNumber)})` : "";
      const redBadge = h.isRedList
        ? `<span style="background-color: #fee2e2; color: #dc2626; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-left: 6px;">RED CAUSE LIST</span>`
        : "";

      return `
      <div style="border-left: 4px solid #0f766e; background-color: #f8fafc; padding: 12px 16px; margin-bottom: 12px; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: #0f172a; font-size: 15px;">${escapeHtml(h.caseNumber)}</strong>
          ${redBadge}
        </div>
        <div style="color: #334155; font-size: 13px; margin-top: 4px;"><strong>Parties:</strong> ${escapeHtml(h.caseTitle)}</div>
        <div style="color: #334155; font-size: 13px; margin-top: 2px;"><strong>Court:</strong> ${escapeHtml(h.court)} - ${escapeHtml(h.bench)}</div>
        <div style="color: #334155; font-size: 13px; margin-top: 2px;"><strong>Before:</strong> ${escapeHtml(h.judgeName)}${courtroomStr} (Sr. #${h.serialNumber || "?"})</div>
        <div style="color: #64748b; font-size: 12px; margin-top: 2px;"><strong>Purpose:</strong> ${escapeHtml(h.fixationPurpose || "Hearing")} &bull; <strong>List:</strong> ${escapeHtml(h.listType)}</div>
      </div>
    `;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 20px; color: #0f172a;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="background-color: #0f766e; padding: 20px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px;">Al Wakeelo Court Cause List Alert</h2>
          <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Upcoming hearing notice for ${escapeHtml(targetDate)}</p>
        </div>
        
        <div style="padding: 24px;">
          <p style="font-size: 15px; margin-top: 0;">Dear <strong>${escapeHtml(userName)}</strong>,</p>
          <p style="font-size: 14px; color: #475569; margin-bottom: 20px;">
            The automated cause list scraper detected <strong>${count} case${count > 1 ? "s" : ""}</strong> listed in tomorrow's court rosters matching your chamber cases or tracked advocates:
          </p>

          ${hearingsHtml}

          <div style="text-align: center; margin-top: 28px; margin-bottom: 12px;">
            <a href="https://alwakeelo.com/daily-diary" style="background-color: #0f766e; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">Open in Daily Diary</a>
          </div>

          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px;">
            This hearing has been automatically synchronized to your Alwakeelo Daily Diary.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Dear ${userName},\n\nYou have ${count} case(s) listed for ${targetDate}:\n\n` +
    hearings.map(h => `- ${h.caseNumber}: ${h.caseTitle} before ${h.judgeName} (${h.court} - ${h.bench}) Sr. #${h.serialNumber || "?"}`).join("\n") +
    `\n\nView details in your Alwakeelo Daily Diary: https://alwakeelo.com/daily-diary`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: resolveFromEmail(),
      to: toEmail,
      subject,
      html,
      text,
    });

    if (error) {
      console.error("[CauseListNotifications] Email send error:", error);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("[CauseListNotifications] Failed to send email via Resend:", err.message);
    return false;
  }
}
