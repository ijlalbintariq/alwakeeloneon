/**
 * Safepay Payment Gateway Service
 *
 * Wraps the @sfpy/node-core SDK to provide payment session creation,
 * checkout URL generation, and payment verification for subscription billing.
 */

import Safepay from "@sfpy/node-core";

// ── Configuration ────────────────────────────────────────────────────────────

const SAFEPAY_API_KEY = process.env.SAFEPAY_API_KEY || "";
const SAFEPAY_SECRET_KEY = process.env.SAFEPAY_SECRET_KEY || "";
const SAFEPAY_ENVIRONMENT = (process.env.SAFEPAY_ENVIRONMENT || "sandbox") as "sandbox" | "production" | "development";
const SAFEPAY_WEBHOOK_SECRET = process.env.SAFEPAY_WEBHOOK_SECRET || "";

const HOST_MAP: Record<string, string> = {
  development: "https://dev.api.getsafepay.com",
  sandbox: "https://sandbox.api.getsafepay.com",
  production: "https://api.getsafepay.com",
};

// ── SDK Instance ─────────────────────────────────────────────────────────────

let safepayInstance: any = null;

function getSafepay(): any {
  if (!SAFEPAY_SECRET_KEY) {
    throw new Error("Safepay is not configured: SAFEPAY_SECRET_KEY is missing");
  }
  if (!safepayInstance) {
    safepayInstance = new Safepay(SAFEPAY_SECRET_KEY, {
      authType: "secret",
      host: HOST_MAP[SAFEPAY_ENVIRONMENT] || HOST_MAP.sandbox,
    });
  }
  return safepayInstance;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Check if Safepay is configured with a valid secret key.
 */
export function isSafepayConfigured(): boolean {
  return Boolean(SAFEPAY_SECRET_KEY);
}

/**
 * Get the current Safepay environment.
 */
export function getSafepayEnvironment(): string {
  return SAFEPAY_ENVIRONMENT;
}

/**
 * Get the webhook secret for verifying webhook payloads.
 */
export function getSafepayWebhookSecret(): string {
  return SAFEPAY_WEBHOOK_SECRET;
}

export type CreateSessionParams = {
  amountPkr: number;
  currency?: string;
};

export type CreateSessionResult = {
  tracker: string;
  token: string;
};

/**
 * Create a new payment session with Safepay.
 * Returns the tracker ID and token (tbt) needed for checkout.
 */
export async function createPaymentSession(params: CreateSessionParams): Promise<CreateSessionResult> {
  const safepay = getSafepay();
  const { amountPkr, currency = "PKR" } = params;

  const response = await safepay.payments.session.setup({
    merchant_api_key: SAFEPAY_API_KEY,
    intent: "CYBERSOURCE",
    mode: "payment",
    currency,
    amount: amountPkr * 100, // Safepay expects amount in paisa (smallest unit)
  });

  const data = response?.data || response;

  // Safepay SDK returns: { tracker: { token: "track_xxx", ... }, capabilities: {...} }
  // The tracker string is nested inside data.tracker.token
  const trackerObj = data?.tracker || data;
  const trackerToken = typeof trackerObj === "string"
    ? trackerObj
    : trackerObj?.token || data?.token || "";

  if (!trackerToken) {
    throw new Error("Safepay did not return a valid tracker/token from session setup");
  }

  return { tracker: trackerToken, token: trackerToken };
}

/**
 * Attach metadata to a payment tracker (plan, billing cycle, user info).
 */
export async function configurePaymentMetadata(
  tracker: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const safepay = getSafepay();
  await safepay.order.configure.metadata(
    { tracker },
    { data: metadata },
  );
}

export type CheckoutUrlParams = {
  tracker: string;
  token: string;
  cancelUrl?: string;
  redirectUrl?: string;
  source?: "hosted" | "popup";
};

/**
 * Generate a checkout URL that redirects the user to Safepay's hosted payment page.
 */
export function generateCheckoutUrl(params: CheckoutUrlParams): string {
  const safepay = getSafepay();
  const { tracker, token, cancelUrl, redirectUrl, source = "hosted" } = params;

  return safepay.checkout.createCheckoutUrl({
    env: SAFEPAY_ENVIRONMENT,
    tracker,
    tbt: token,
    source,
    cancel_url: cancelUrl,
    redirect_url: redirectUrl,
  });
}

/**
 * Verify a payment's status by its tracker ID.
 * Returns the order data from Safepay.
 */
export async function verifyPayment(tracker: string): Promise<{
  success: boolean;
  state: string;
  data: Record<string, unknown>;
}> {
  const safepay = getSafepay();

  try {
    const response = await safepay.order.tracker.action({ tracker });
    const data = response?.data || response;
    const state = String(data?.state || data?.status || "").toUpperCase();
    const isSuccess = state === "TRACKER_ENDED" || state === "COMPLETED" || state === "PAID";

    return {
      success: isSuccess,
      state,
      data: data || {},
    };
  } catch (err: any) {
    console.error(`[Safepay] Failed to verify payment tracker ${tracker}:`, err?.message || err);
    return {
      success: false,
      state: "VERIFICATION_FAILED",
      data: { error: err?.message || "Verification failed" },
    };
  }
}

/**
 * Cancel a pending payment order.
 */
export async function cancelPayment(tracker: string): Promise<void> {
  const safepay = getSafepay();
  try {
    await safepay.order.cancel.delete({ tracker });
  } catch (err: any) {
    console.warn(`[Safepay] Failed to cancel tracker ${tracker}:`, err?.message || err);
  }
}

// ── Pricing Helpers ──────────────────────────────────────────────────────────

const PLAN_MONTHLY_PRICES_PKR: Record<string, number> = {
  standard: 500,
  pro: 1000,
  chamber: 4500,
  enterprise: 50000,
};

const CYCLE_DISCOUNTS: Record<string, number> = {
  monthly: 0,
  quarterly: 10,
  yearly: 20,
};

const DISCOUNT_ELIGIBLE_PLANS = new Set(["standard", "pro", "chamber"]);

/**
 * Calculate the total PKR amount for a plan + billing cycle combination.
 */
export function calculatePlanAmount(planKey: string, billingCycle: string): number {
  const monthlyPrice = PLAN_MONTHLY_PRICES_PKR[planKey];
  if (!monthlyPrice) {
    throw new Error(`Unknown plan: ${planKey}`);
  }

  const cycle = billingCycle || "monthly";
  const months = cycle === "yearly" ? 12 : cycle === "quarterly" ? 3 : 1;
  const baseTotal = monthlyPrice * months;

  if (!DISCOUNT_ELIGIBLE_PLANS.has(planKey) || cycle === "monthly") {
    return baseTotal;
  }

  const discountPct = CYCLE_DISCOUNTS[cycle] || 0;
  return Math.round(baseTotal * (1 - discountPct / 100));
}
