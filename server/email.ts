import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_EMAIL = process.env.FROM_EMAIL || "Al Wakeelo <onboarding@resend.dev>";

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  firstName?: string | null
): Promise<boolean> {
  if (!resend) {
    console.log(`[Email] Resend not configured. Reset link for ${to}: ${resetUrl}`);
    return false;
  }

  const name = firstName || "there";

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
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

    if (error) {
      console.error("[Email] Failed to send password reset email:", error);
      return false;
    }

    console.log(`[Email] Password reset email sent to ${to}`);
    return true;
  } catch (err) {
    console.error("[Email] Error sending email:", err);
    return false;
  }
}
