import { Resend } from "resend";

function resolveResendApiKey(): string {
  return String(process.env.RESEND_API_KEY || process.env.EMAIL_RESEND_API_KEY || "").trim();
}

function resolveFromEmail(): string {
  return String(process.env.RESEND_FROM_EMAIL || process.env.FROM_EMAIL || "Al Wakeelo <onboarding@resend.dev>").trim();
}

function resolveBrandLogoUrl(): string {
  return "https://www.alwakeelo.com/logo-email.png";
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
  const subject = `⚖️ Court Hearing Alert: ${count} case${count > 1 ? "s" : ""} fixed for ${targetDate}`;
  const safeName = escapeHtml(userName);
  const safeDate = escapeHtml(targetDate);
  const logoUrl = escapeHtml(resolveBrandLogoUrl());

  const hearingsHtml = hearings
    .map((h) => {
      const courtroomStr = h.courtNumber ? ` (${escapeHtml(h.courtNumber)})` : "";
      const dotColor = h.isRedList ? "#ef4444" : "#f4b11e";
      const redBadge = h.isRedList
        ? `<span style="display:inline-block;padding:2px 8px;border-radius:6px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#ef4444;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">RED CAUSE LIST</span>`
        : `<span style="display:inline-block;padding:2px 8px;border-radius:6px;background:#1a2744;border:1px solid #2a3a56;color:#f4b11e;font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">${escapeHtml(h.listType)}</span>`;

      return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;background:#111e36;border:1px solid #24344f;border-radius:14px;overflow:hidden;">
        <tr>
          <td style="padding:16px 18px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:12px;vertical-align:top;padding-top:4px;">
                  <div style="width:9px;height:9px;border-radius:50%;background:${dotColor};box-shadow:0 0 8px ${dotColor}88;"></div>
                </td>
                <td style="padding-left:12px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <strong style="color:#f8fafc;font-size:15px;font-weight:800;letter-spacing:0.3px;font-family:'Playfair Display',Georgia,serif;">${escapeHtml(h.caseNumber)}</strong>
                    <div style="margin-left:8px;">${redBadge}</div>
                  </div>
                  <p style="margin:4px 0 0;color:#e2e8f0;font-size:13px;font-weight:600;line-height:1.4;">${escapeHtml(h.caseTitle)}</p>
                  <p style="margin:6px 0 0;color:#b6c4d9;font-size:12px;line-height:1.5;">
                    <strong style="color:#f4b11e;">Court:</strong> ${escapeHtml(h.court)} (${escapeHtml(h.bench)})<br>
                    <strong style="color:#f4b11e;">Before:</strong> ${escapeHtml(h.judgeName)}${courtroomStr} &bull; <strong style="color:#94a3b8;">Sr. #${h.serialNumber || "?"}</strong><br>
                    <strong style="color:#f4b11e;">Purpose:</strong> ${escapeHtml(h.fixationPurpose || "For Hearing")}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a1222;font-family:Inter,Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a1222;padding:32px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#101b31;border:1px solid #2a3a56;border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
          <!-- Top Gold Accent Bar -->
          <tr><td style="padding:4px 0 0 0;background:linear-gradient(90deg, #f4b11e 0%, #d97706 100%);"></td></tr>
          
          <!-- Header Banner -->
          <tr>
            <td style="padding:32px 28px 24px 28px;text-align:center;background:linear-gradient(180deg,#0f172a 0%,#0b1427 100%);border-bottom:1px solid #24344f;">
              <img src="${logoUrl}" alt="Al Wakeelo" width="56" height="56" style="display:block;width:56px;height:56px;border-radius:14px;margin:0 auto 14px;border:1px solid rgba(244,177,30,0.45);" />
              <p style="margin:0 0 6px;color:#f4b11e;font-size:10px;line-height:1.4;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;">Pakistan Judicial Intelligence</p>
              <h1 style="margin:0;color:#f8fafc;font-size:24px;line-height:1.2;font-weight:800;font-family:'Playfair Display',Georgia,serif;">Court Cause List Fixation</h1>
              <p style="margin:8px 0 0;color:#94a3b8;font-size:13px;font-weight:500;">Hearing notice for <strong style="color:#f4b11e;">${safeDate}</strong></p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 6px;color:#e8eefb;font-size:15px;line-height:1.6;">Assalam-o-Alaikum <strong>${safeName}</strong>,</p>
              <p style="margin:0 0 20px;color:#b6c4d9;font-size:14px;line-height:1.7;">
                The automated cause list scraper detected <strong style="color:#f4b11e;">${count} case${count > 1 ? "s" : ""}</strong> listed in tomorrow's courtroom rosters matching your tracked cases and advocate profile:
              </p>

              <!-- Hearings List -->
              ${hearingsHtml}

              <!-- Action Button CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;width:100%;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" bgcolor="#f4b11e" style="border-radius:12px;box-shadow:0 12px 24px rgba(244,177,30,0.25);">
                          <a href="https://alwakeelo.com/daily-diary" style="display:inline-block;padding:14px 32px;color:#0d172a;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;font-family:Inter,Arial,sans-serif;">Open in Daily Diary</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0;color:#64748b;font-size:12px;text-align:center;line-height:1.5;">
                💡 This case has been automatically synced to your <strong>Daily Diary</strong> and connected <strong>Google Calendar</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 28px;background:#0b1427;border-top:1px solid #24344f;text-align:center;">
              <p style="margin:0 0 4px;color:#7a90ae;font-size:10px;line-height:1.6;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;">Al Wakeelo • National Legal Workspace</p>
              <p style="margin:0 0 4px;color:#64748b;font-size:11px;line-height:1.6;">Support & Legal Assistance: <a href="mailto:support@alwakeelo.com" style="color:#f4b11e;text-decoration:none;font-weight:700;">support@alwakeelo.com</a></p>
              <p style="margin:0;color:#4a6080;font-size:9px;">Manage notification preferences in your Alwakeelo User Settings</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Assalam-o-Alaikum ${userName},\n\nYou have ${count} case(s) listed for ${targetDate}:\n\n` +
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
