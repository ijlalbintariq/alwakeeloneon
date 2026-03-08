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

  const sendResult = await sendEmailViaResend({
    to,
    subject: "Reset Your Password - Al Wakeelo",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#1e293b;border-radius:24px;border:1px solid #334155;overflow:hidden;">
          <tr>
            <td style="padding:40px 36px;text-align:center;">
              <div style="width:56px;height:56px;background:linear-gradient(135deg,#fbbf24,#d97706);border-radius:16px;margin:0 auto 24px;line-height:56px;font-size:28px;color:#0f172a;font-weight:bold;">W</div>

              <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 8px;font-style:italic;letter-spacing:-0.5px;">Al Wakeelo</h1>
              <p style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:4px;font-weight:900;margin:0 0 32px;">Password Recovery</p>

              <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin:0 0 8px;">Hi ${name},</p>
              <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 28px;">We received a request to reset the password for your Al Wakeelo account. Click the button below to set a new password.</p>

              <a href="${resetUrl}" style="display:inline-block;background-color:#f59e0b;color:#0f172a;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:2px;padding:16px 40px;border-radius:16px;text-decoration:none;">Reset Password</a>

              <p style="color:#64748b;font-size:12px;line-height:1.5;margin:24px 0 0;">This link expires in <strong style="color:#94a3b8;">1 hour</strong>. If you didn't request this, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 36px;border-top:1px solid #1e293b;text-align:center;background-color:#0f172a;">
              <p style="color:#475569;font-size:9px;text-transform:uppercase;letter-spacing:3px;font-weight:900;margin:0;">Secured Authentication Protocol</p>
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
