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
  return String(process.env.EMAIL_BRAND_LOGO_URL || "https://alwakeelo.com/icon-192.png?v=20260312b").trim();
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

export async function sendEmailVerificationEmail(
  to: string,
  verifyUrl: string,
  firstName?: string | null,
): Promise<boolean> {
  if (!getResendClient()) {
    console.log(`[Email] Resend not configured. Verification link for ${to}: ${verifyUrl}`);
    return false;
  }

  const name = firstName || "there";
  const safeName = escapeHtml(name);
  const safeVerifyUrl = escapeHtml(verifyUrl);
  const logoUrl = escapeHtml(resolveBrandLogoUrl());

  const sendResult = await sendEmailViaResend({
    to,
    subject: "Verify Your Email - Al Wakeelo",
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a1222;font-family:Inter,Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a1222;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#101b31;border:1px solid #2a3a56;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:4px 0 0 0;background:#f4b11e;"></td>
          </tr>
          <tr>
            <td style="padding:30px 28px 20px 28px;text-align:center;background:linear-gradient(180deg,#0f172a 0%,#0b1427 100%);border-bottom:1px solid #24344f;">
              <img src="${logoUrl}" alt="Al Wakeelo" width="64" height="64" style="display:block;width:64px;height:64px;border-radius:14px;margin:0 auto 14px;border:1px solid rgba(244,177,30,0.45);" />
              <h1 style="margin:0;color:#f8fafc;font-size:28px;line-height:1.15;font-weight:800;">Verify Your Email</h1>
              <p style="margin:10px 0 0;color:#f4b11e;font-size:11px;line-height:1.4;font-weight:800;letter-spacing:2px;text-transform:uppercase;">
                Al Wakeelo Account Activation
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 10px;color:#e8eefb;font-size:15px;line-height:1.6;">Assalam-o-Alaikum ${safeName},</p>
              <p style="margin:0 0 16px;color:#b6c4d9;font-size:14px;line-height:1.7;">
                Please verify your email to activate your Al Wakeelo account and start using your legal workspace.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
                <tr>
                  <td align="center" bgcolor="#f4b11e" style="border-radius:12px;box-shadow:0 12px 24px rgba(244,177,30,0.24);">
                    <a href="${safeVerifyUrl}" style="display:inline-block;padding:14px 28px;color:#0d172a;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:0.6px;text-transform:uppercase;">
                      Verify Email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 10px;color:#9bb0cc;font-size:12px;line-height:1.6;">
                This verification link expires in 24 hours.
              </p>
              <p style="margin:0;word-break:break-word;">
                <a href="${safeVerifyUrl}" style="color:#f4b11e;font-size:12px;line-height:1.6;text-decoration:underline;">${safeVerifyUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#0b1427;border-top:1px solid #24344f;text-align:center;">
              <p style="margin:0;color:#7a90ae;font-size:10px;line-height:1.6;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;">
                Al Wakeelo • Verification Notice
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text: `Assalam-o-Alaikum ${name},\n\nPlease verify your email to activate your Al Wakeelo account.\n\nVerify link:\n${verifyUrl}\n\nThis link expires in 24 hours.\n\n- Al Wakeelo`,
  });

  if (!sendResult.ok) {
    console.error("[Email] Failed to send verification email:", sendResult.error);
    return false;
  }
  console.log(`[Email] Verification email sent to ${to}`);
  return true;
}

export async function sendWelcomeEmail(
  to: string,
  firstName?: string | null,
  loginUrl?: string,
): Promise<boolean> {
  if (!getResendClient()) {
    console.log(`[Email] Resend not configured. Welcome email skipped for ${to}`);
    return false;
  }

  const name = firstName || "there";
  const safeName = escapeHtml(name);
  const safeLoginUrl = escapeHtml((loginUrl || "https://alwakeelo.com/auth").trim());
  const logoUrl = escapeHtml(resolveBrandLogoUrl());

  const sendResult = await sendEmailViaResend({
    to,
    subject: "Welcome to Al Wakeelo | Your Legal AI Workspace",
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a1222;font-family:'Inter',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a1222;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#101b31;border:1px solid #2a3a56;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:4px 0 0 0;background:#f4b11e;"></td>
          </tr>
          <tr>
            <td style="padding:34px 28px 26px 28px;text-align:center;background:linear-gradient(180deg,#0f172a 0%,#0b1427 100%);border-bottom:1px solid #24344f;">
              <p style="margin:0 0 14px;color:#f4b11e;font-size:11px;line-height:1.4;font-weight:800;letter-spacing:2px;text-transform:uppercase;">
                Pakistan's First Open-Source Legal AI
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;">
                <tr>
                  <td style="width:86px;height:86px;background:#f4b11e;border-radius:20px;text-align:center;vertical-align:middle;box-shadow:0 14px 30px rgba(244,177,30,0.26);">
                    <img src="${logoUrl}" alt="Al Wakeelo" width="56" height="56" style="display:inline-block;width:56px;height:56px;border:0;outline:none;text-decoration:none;" />
                  </td>
                </tr>
              </table>
              <h1 style="margin:0;color:#f8fafc;font-size:31px;line-height:1.15;font-weight:800;letter-spacing:-0.3px;">Welcome to Al Wakeelo</h1>
              <p style="margin:10px 0 0;color:#f4b11e;font-size:12px;line-height:1.5;font-weight:700;letter-spacing:1.7px;text-transform:uppercase;">
                Your Digital Lawyer, Always on Duty
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 10px;color:#e8eefb;font-size:15px;line-height:1.6;">Assalam-o-Alaikum ${safeName},</p>
              <p style="margin:0 0 16px;color:#b6c4d9;font-size:14px;line-height:1.7;">
                Your account is now active. You can start legal research, drafting, and AI-assisted workflows on Pakistani law.
              </p>
              <p style="margin:0 0 18px;color:#b6c4d9;font-size:14px;line-height:1.7;">
                To continue, open your workspace from the button below.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#111e36;border:1px solid #324667;border-radius:12px;">
                <tr>
                  <td style="padding:12px 14px;">
                    <p style="margin:0 0 8px;color:#f4b11e;font-size:11px;line-height:1.4;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;">
                      Quick Start
                    </p>
                    <p style="margin:0;color:#d0dbee;font-size:13px;line-height:1.7;">
                      • Search case law and citations<br/>
                      • Draft petitions and legal notices<br/>
                      • Generate and review contracts faster
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
                <tr>
                  <td align="center" bgcolor="#f4b11e" style="border-radius:12px;box-shadow:0 12px 24px rgba(244,177,30,0.24);">
                    <a href="${safeLoginUrl}" style="display:inline-block;padding:14px 28px;color:#0d172a;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:0.6px;text-transform:uppercase;">
                      Open Al Wakeelo
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#9bb0cc;font-size:12px;line-height:1.6;">
                Need assistance? Contact support at
                <a href="mailto:support@alwakeelo.com" style="color:#f4b11e;text-decoration:none;font-weight:700;">support@alwakeelo.com</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#0b1427;border-top:1px solid #24344f;text-align:center;">
              <p style="margin:0;color:#7a90ae;font-size:10px;line-height:1.6;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;">
                Al Wakeelo • Welcome Notice
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text: `Assalam-o-Alaikum ${name},\n\nWelcome to Al Wakeelo.\nYour account is now active and ready for legal research, drafting, and AI-assisted Pakistani law workflows.\n\nQuick Start:\n- Search case law and citations\n- Draft petitions and legal notices\n- Generate and review contracts faster\n\nOpen your workspace:\n${loginUrl || "https://alwakeelo.com/auth"}\n\nNeed help? support@alwakeelo.com\n\n- Al Wakeelo`,
  });

  if (!sendResult.ok) {
    console.error("[Email] Failed to send welcome email:", sendResult.error);
    return false;
  }
  console.log(`[Email] Welcome email sent to ${to}`);
  return true;
}

type BillingCycle = "monthly" | "quarterly" | "yearly";
type SubscriptionPlan = "standard" | "pro" | "chamber" | "enterprise";

export type SubscriptionInvoiceEmailInput = {
  to: string;
  customerName?: string | null;
  planKey: SubscriptionPlan;
  billingCycle?: BillingCycle | null;
  invoiceNumber?: string | null;
  issuedAt?: Date | null;
  dueAt?: Date | null;
  periodStartAt?: Date | null;
  periodEndAt?: Date | null;
  paymentMethod?: string | null;
  transactionRef?: string | null;
  subtotalPkr?: number | null;
  discountPkr?: number | null;
  taxPkr?: number | null;
};

const PLAN_MONTHLY_PRICE_PKR: Record<SubscriptionPlan, number> = {
  standard: 500,
  pro: 1000,
  chamber: 3000,
  enterprise: 50000,
};

function normalizeBillingCycle(cycle: string | null | undefined): BillingCycle {
  const normalized = String(cycle || "monthly").trim().toLowerCase();
  if (normalized === "quarterly" || normalized === "yearly") return normalized;
  return "monthly";
}

function getCycleMonths(cycle: BillingCycle): number {
  if (cycle === "quarterly") return 3;
  if (cycle === "yearly") return 12;
  return 1;
}

function getCycleDiscountRate(planKey: SubscriptionPlan, cycle: BillingCycle): number {
  if (planKey === "enterprise") return 0;
  if (cycle === "quarterly") return 0.1;
  if (cycle === "yearly") return 0.2;
  return 0;
}

function toRupees(value: number): number {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

function formatPkr(value: number): string {
  return `PKR ${toRupees(value).toLocaleString("en-PK")}`;
}

function formatDatePk(value: Date): string {
  return value.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildInvoiceNumber(now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-AW-${year}${month}${day}-${rand}`;
}

export function buildSubscriptionInvoiceTemplate(input: SubscriptionInvoiceEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const now = new Date();
  const cycle = normalizeBillingCycle(input.billingCycle);
  const plan = String(input.planKey || "pro").toLowerCase() as SubscriptionPlan;
  const cycleMonths = getCycleMonths(cycle);
  const issuedAt = input.issuedAt || now;
  const dueAt = input.dueAt || issuedAt;
  const invoiceNumber = String(input.invoiceNumber || "").trim() || buildInvoiceNumber(issuedAt);
  const customerName = String(input.customerName || "Valued Client").trim();
  const paymentMethod = String(input.paymentMethod || "Online Payment").trim();
  const transactionRef = String(input.transactionRef || "").trim();
  const periodStartAt = input.periodStartAt || issuedAt;
  const periodEndAt = input.periodEndAt || new Date(periodStartAt.getTime() + cycleMonths * 30 * 24 * 60 * 60 * 1000);

  const monthlyPrice = PLAN_MONTHLY_PRICE_PKR[plan] || PLAN_MONTHLY_PRICE_PKR.pro;
  const defaultSubtotal = monthlyPrice * cycleMonths;
  const defaultDiscount = toRupees(defaultSubtotal * getCycleDiscountRate(plan, cycle));
  const subtotal = input.subtotalPkr == null ? defaultSubtotal : toRupees(input.subtotalPkr);
  const discount = input.discountPkr == null ? defaultDiscount : toRupees(input.discountPkr);
  const tax = input.taxPkr == null ? 0 : toRupees(input.taxPkr);
  const total = Math.max(0, subtotal - discount + tax);

  const safeName = escapeHtml(customerName);
  const safeInvoice = escapeHtml(invoiceNumber);
  const safePlan = escapeHtml(plan.toUpperCase());
  const safeCycle = escapeHtml(cycle.charAt(0).toUpperCase() + cycle.slice(1));
  const safeIssued = escapeHtml(formatDatePk(issuedAt));
  const safeDue = escapeHtml(formatDatePk(dueAt));
  const safePeriod = escapeHtml(`${formatDatePk(periodStartAt)} to ${formatDatePk(periodEndAt)}`);
  const safePayment = escapeHtml(paymentMethod);
  const safeTxn = escapeHtml(transactionRef || "N/A");
  const logoUrl = escapeHtml(resolveBrandLogoUrl());

  const subject = `Invoice ${invoiceNumber} - ${plan.toUpperCase()} Plan (${safeCycle})`;
  const text = [
    `Al Wakeelo Subscription Invoice`,
    `Invoice: ${invoiceNumber}`,
    `Customer: ${customerName}`,
    `Plan: ${plan.toUpperCase()} (${cycle})`,
    `Issue Date: ${formatDatePk(issuedAt)}`,
    `Due Date: ${formatDatePk(dueAt)}`,
    `Billing Period: ${formatDatePk(periodStartAt)} to ${formatDatePk(periodEndAt)}`,
    `Payment Method: ${paymentMethod}`,
    `Transaction Ref: ${transactionRef || "N/A"}`,
    `Subtotal: ${formatPkr(subtotal)}`,
    `Discount: -${formatPkr(discount)}`,
    `Tax: ${formatPkr(tax)}`,
    `Total: ${formatPkr(total)}`,
    "",
    "This is a system-generated invoice from Al Wakeelo.",
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0b1220;font-family:Inter,Arial,sans-serif;color:#e2e8f0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;background:#0b1220;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#111a2b;border:1px solid #24324a;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:22px 24px;border-bottom:1px solid #24324a;background:linear-gradient(180deg,#101a2b 0%,#0d1523 100%);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:top;">
                    <img src="${logoUrl}" alt="Al Wakeelo" width="44" height="44" style="display:block;width:44px;height:44px;border-radius:10px;border:1px solid rgba(245,158,11,0.4);" />
                    <h1 style="margin:10px 0 0;font-size:20px;line-height:1.2;color:#f8fafc;">Subscription Invoice</h1>
                    <p style="margin:6px 0 0;font-size:11px;line-height:1.5;letter-spacing:1.3px;text-transform:uppercase;color:#f59e0b;font-weight:700;">Al Wakeelo Billing</p>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <p style="margin:0;font-size:12px;color:#94a3b8;">Invoice No.</p>
                    <p style="margin:2px 0 10px;font-size:14px;font-weight:700;color:#f8fafc;">${safeInvoice}</p>
                    <p style="margin:0;font-size:12px;color:#94a3b8;">Issue Date</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#f8fafc;">${safeIssued}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:22px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="padding:0 0 10px 0;">
                    <p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Billed To</p>
                    <p style="margin:6px 0 0;font-size:15px;color:#f8fafc;font-weight:700;">${safeName}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #24324a;border-radius:12px;overflow:hidden;">
                <tr style="background:#0f172a;">
                  <td style="padding:10px 12px;font-size:12px;color:#94a3b8;border-bottom:1px solid #24324a;">Plan</td>
                  <td style="padding:10px 12px;font-size:12px;color:#94a3b8;border-bottom:1px solid #24324a;">Billing Cycle</td>
                  <td style="padding:10px 12px;font-size:12px;color:#94a3b8;border-bottom:1px solid #24324a;">Period</td>
                </tr>
                <tr>
                  <td style="padding:12px;color:#f8fafc;font-size:13px;font-weight:700;">${safePlan}</td>
                  <td style="padding:12px;color:#f8fafc;font-size:13px;">${safeCycle}</td>
                  <td style="padding:12px;color:#f8fafc;font-size:13px;">${safePeriod}</td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border:1px solid #24324a;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:10px 12px;font-size:13px;color:#cbd5e1;">Subtotal</td>
                  <td align="right" style="padding:10px 12px;font-size:13px;color:#f8fafc;">${escapeHtml(formatPkr(subtotal))}</td>
                </tr>
                <tr style="background:#0f172a;">
                  <td style="padding:10px 12px;font-size:13px;color:#cbd5e1;">Discount</td>
                  <td align="right" style="padding:10px 12px;font-size:13px;color:#f8fafc;">-${escapeHtml(formatPkr(discount))}</td>
                </tr>
                <tr>
                  <td style="padding:10px 12px;font-size:13px;color:#cbd5e1;">Tax</td>
                  <td align="right" style="padding:10px 12px;font-size:13px;color:#f8fafc;">${escapeHtml(formatPkr(tax))}</td>
                </tr>
                <tr style="background:#13223a;border-top:1px solid #2f4668;">
                  <td style="padding:12px;font-size:14px;color:#f8fafc;font-weight:700;">Total</td>
                  <td align="right" style="padding:12px;font-size:14px;color:#f8fafc;font-weight:700;">${escapeHtml(formatPkr(total))}</td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
                <tr>
                  <td style="padding:0;font-size:12px;color:#94a3b8;line-height:1.7;">
                    Payment Method: <span style="color:#f8fafc;">${safePayment}</span><br/>
                    Transaction Ref: <span style="color:#f8fafc;">${safeTxn}</span><br/>
                    Due Date: <span style="color:#f8fafc;">${safeDue}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 24px;background:#0d1523;border-top:1px solid #24324a;">
              <p style="margin:0;font-size:11px;color:#64748b;line-height:1.6;">
                This is a system-generated invoice for subscription billing. For support, contact support@alwakeelo.com.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

export async function sendSubscriptionInvoiceEmail(input: SubscriptionInvoiceEmailInput): Promise<EmailSendResult> {
  const to = String(input.to || "").trim().toLowerCase();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return {
      ok: false,
      provider: "resend",
      error: "A valid recipient email is required.",
    };
  }
  const template = buildSubscriptionInvoiceTemplate({ ...input, to });
  return sendEmailViaResend({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
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

/**
 * Send a branded broadcast email to a single recipient.
 * Call this in a loop for each user to broadcast to all.
 */
export async function sendBroadcastEmail(args: {
  to: string;
  subject: string;
  body: string;
  recipientName?: string;
}): Promise<EmailSendResult> {
  const name = args.recipientName || "there";
  const safeName = escapeHtml(name);
  const safeSubject = escapeHtml(args.subject);
  const logoUrl = escapeHtml(resolveBrandLogoUrl());

  // Convert newlines to <br/> and escape HTML in body
  const safeBodyHtml = escapeHtml(args.body)
    .replace(/\n/g, "<br/>");

  const plainBody = args.body;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a1222;font-family:'Inter',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a1222;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#101b31;border:1px solid #2a3a56;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:4px 0 0 0;background:#f4b11e;"></td>
          </tr>
          <tr>
            <td style="padding:30px 28px 20px 28px;text-align:center;background:linear-gradient(180deg,#0f172a 0%,#0b1427 100%);border-bottom:1px solid #24344f;">
              <img src="${logoUrl}" alt="Al Wakeelo" width="64" height="64" style="display:block;width:64px;height:64px;border-radius:14px;margin:0 auto 14px;border:1px solid rgba(244,177,30,0.45);" />
              <h1 style="margin:0;color:#f8fafc;font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-0.3px;">${safeSubject}</h1>
              <p style="margin:10px 0 0;color:#f4b11e;font-size:11px;line-height:1.4;font-weight:800;letter-spacing:2px;text-transform:uppercase;">
                Al Wakeelo • Official Announcement
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 10px;color:#e8eefb;font-size:15px;line-height:1.6;">Assalam-o-Alaikum ${safeName},</p>
              <div style="margin:0 0 20px;color:#b6c4d9;font-size:14px;line-height:1.8;">
                ${safeBodyHtml}
              </div>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
                <tr>
                  <td align="center" bgcolor="#f4b11e" style="border-radius:12px;box-shadow:0 12px 24px rgba(244,177,30,0.24);">
                    <a href="https://alwakeelo.com/dashboard" style="display:inline-block;padding:14px 28px;color:#0d172a;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:0.6px;text-transform:uppercase;">
                      Open Al Wakeelo
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#9bb0cc;font-size:12px;line-height:1.6;">
                Need assistance? Contact support at
                <a href="mailto:support@alwakeelo.com" style="color:#f4b11e;text-decoration:none;font-weight:700;">support@alwakeelo.com</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#0b1427;border-top:1px solid #24344f;text-align:center;">
              <p style="margin:0;color:#7a90ae;font-size:10px;line-height:1.6;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;">
                Al Wakeelo • Official Communication
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Assalam-o-Alaikum ${name},\n\n${plainBody}\n\nOpen Al Wakeelo: https://alwakeelo.com/dashboard\n\nNeed help? support@alwakeelo.com\n\n- Al Wakeelo`;

  return sendEmailViaResend({
    to: args.to,
    subject: args.subject,
    html,
    text,
  });
}
