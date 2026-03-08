import { Resend } from "resend";

export type EmailProviderStatus = {
  provider: "resend";
  configured: boolean;
  hasApiKey: boolean;
  fromEmail: string;
  fromDomain: string | null;
};

export type EmailSendResult = {
  ok: boolean;
  provider: "resend";
  messageId?: string;
  error?: string;
};

function resolveResendApiKey(): string {
  return String(process.env.RESEND_API_KEY || process.env.EMAIL_RESEND_API_KEY || "").trim();
}

function resolveFromEmail(): string {
  return String(
    process.env.RESEND_FROM_EMAIL ||
      process.env.FROM_EMAIL ||
      "Al Wakeelo <onboarding@resend.dev>",
  ).trim();
}

function resolveBrandLogoUrl(): string {
  return String(process.env.EMAIL_BRAND_LOGO_URL || "https://alwakeelo.com/icon-192.png").trim();
}

function extractAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] || raw).trim();
}

function extractDomain(raw: string): string | null {
  const address = extractAddress(raw);
  const at = address.lastIndexOf("@");
  if (at === -1 || at === address.length - 1) return null;
  return address.slice(at + 1).toLowerCase();
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getResendClient(): Resend | null {
  const apiKey = resolveResendApiKey();
  return apiKey ? new Resend(apiKey) : null;
}

export function getEmailProviderStatus(): EmailProviderStatus {
  const fromEmail = resolveFromEmail();
  const hasApiKey = !!resolveResendApiKey();
  return {
    provider: "resend",
    configured: hasApiKey,
    hasApiKey,
    fromEmail,
    fromDomain: extractDomain(fromEmail),
  };
}

async function sendEmailViaResend(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<EmailSendResult> {
  const resend = getResendClient();
  if (!resend) {
    return {
      ok: false,
      provider: "resend",
      error: "RESEND_API_KEY is not configured.",
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: resolveFromEmail(),
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });

    if (error) {
      return {
        ok: false,
        provider: "resend",
        error: typeof error.message === "string" ? error.message : "Resend send failed.",
      };
    }

    return {
      ok: true,
      provider: "resend",
      messageId: typeof (data as any)?.id === "string" ? (data as any).id : undefined,
    };
  } catch (err: any) {
    return {
      ok: false,
      provider: "resend",
      error: typeof err?.message === "string" ? err.message : "Unexpected email error.",
    };
  }
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  firstName?: string | null
): Promise<boolean> {
  if (!getResendClient()) {
    console.log(`[Email] Resend not configured. Reset link for ${to}: ${resetUrl}`);
    return false;
  }

  const name = firstName || "there";
  const safeName = escapeHtml(name);
  const safeResetUrl = escapeHtml(resetUrl);
  const logoUrl = escapeHtml(resolveBrandLogoUrl());

  const sendResult = await sendEmailViaResend({
    to,
    subject: "Reset Your Password - Al Wakeelo",
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#111827;border:1px solid #1f2937;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:32px 28px 18px 28px;text-align:center;background:linear-gradient(180deg,#111827 0%,#0b1220 100%);">
              <img src="${logoUrl}" alt="Al Wakeelo" width="64" height="64" style="display:block;width:64px;height:64px;border-radius:14px;margin:0 auto 16px;border:1px solid rgba(245,158,11,0.35);" />
              <h1 style="margin:0;color:#f8fafc;font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-0.3px;">Al Wakeelo</h1>
              <p style="margin:8px 0 0;color:#f59e0b;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Password Reset Request</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 10px;color:#e2e8f0;font-size:15px;line-height:1.6;">Assalam-o-Alaikum ${safeName},</p>
              <p style="margin:0 0 20px;color:#94a3b8;font-size:14px;line-height:1.7;">
                We received a request to reset your Al Wakeelo account password.
                For your security, use the button below to create a new password.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
                <tr>
                  <td align="center" bgcolor="#f59e0b" style="border-radius:12px;">
                    <a href="${safeResetUrl}" style="display:inline-block;padding:14px 28px;color:#0f172a;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:0.6px;text-transform:uppercase;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 12px;color:#64748b;font-size:12px;line-height:1.6;">
                This secure link expires in <strong style="color:#cbd5e1;">1 hour</strong>.
                If you did not request this, you can ignore this email.
              </p>

              <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;line-height:1.6;">
                If the button does not work, copy and paste this link into your browser:
              </p>
              <p style="margin:0;word-break:break-word;">
                <a href="${safeResetUrl}" style="color:#fbbf24;font-size:12px;line-height:1.6;text-decoration:underline;">${safeResetUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#0b1220;border-top:1px solid #1f2937;text-align:center;">
              <p style="margin:0;color:#475569;font-size:10px;line-height:1.6;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;">
                Al Wakeelo • Secure Authentication Notice
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text: `Hi ${name},\n\nWe received a request to reset the password for your Al Wakeelo account.\n\nClick the link below to set a new password:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.\n\n- Al Wakeelo`,
  });
  if (!sendResult.ok) {
    console.error("[Email] Failed to send password reset email:", sendResult.error);
    return false;
  }
  console.log(`[Email] Password reset email sent to ${to}`);
  return true;
}

export async function sendResendTestEmail(to: string): Promise<EmailSendResult> {
  const providerStatus = getEmailProviderStatus();
  return sendEmailViaResend({
    to,
    subject: "Al Wakeelo Email Setup Test",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:24px;background:#0f172a;font-family:Inter,Arial,sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border:1px solid #334155;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:24px 28px;">
            <h1 style="margin:0 0 10px;color:#f8fafc;font-size:20px;">Resend Configuration Verified</h1>
            <p style="margin:0 0 14px;color:#94a3b8;font-size:14px;line-height:1.6;">
              This is a test email from Al Wakeelo. Your Resend integration is working.
            </p>
            <p style="margin:0;color:#cbd5e1;font-size:13px;line-height:1.6;">
              Provider: <strong>${providerStatus.provider}</strong><br/>
              From: <strong>${providerStatus.fromEmail}</strong>
            </p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text: `Resend configuration verified.\nProvider: ${providerStatus.provider}\nFrom: ${providerStatus.fromEmail}`,
  });
}

export function getEmailFromAddress(): string {
  return resolveFromEmail();
}

export function isEmailProviderConfigured(): boolean {
  return getEmailProviderStatus().configured;
}

export function getEmailProviderName(): "resend" {
  return "resend";
}
