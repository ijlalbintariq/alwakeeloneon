/**
 * Safepay Payment Gateway Service
 *
 * Wraps the @sfpy/node-core SDK to provide payment session creation,
 * checkout URL generation, and payment verification for subscription billing.
 */

import Safepay from "@sfpy/node-core";
import { db } from "./db";
import { storage } from "./storage";
import { paymentRecords } from "@shared/schema";
import { eq, and, gte } from "drizzle-orm";

// ── Configuration ────────────────────────────────────────────────────────────

const SAFEPAY_API_KEY = process.env.SAFEPAY_API_KEY || "sec_f3085efc-66e5-45c9-9d5c-ecc8fb2e9844";
const SAFEPAY_SECRET_KEY = process.env.SAFEPAY_SECRET_KEY || "ac2eb23d5a78c279ef409c846ab0489a5ac68627c529d8320d67437ab68aacf5";
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

/**
 * Generate a Time-Based Token (TBT) from the secret key.
 * The TBT is a short-lived auth token required by Safepay's
 * hosted checkout page to authenticate the payment session.
 */
export async function generateTBT(): Promise<string> {
  const safepay = getSafepay();
  const response = await safepay.client.passport.create();
  const token = response?.data || "";
  if (!token) {
    throw new Error("Safepay did not return a valid TBT from passport endpoint");
  }
  return token;
}

export type CreateSessionParams = {
  amountPkr: number;
  currency?: string;
};

export type CreateSessionResult = {
  tracker: string;
  tbt: string;
};

/**
 * Create a new payment session with Safepay.
 * Returns the tracker ID and a fresh TBT needed for checkout.
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
  const trackerObj = data?.tracker || data;
  const trackerToken = typeof trackerObj === "string"
    ? trackerObj
    : trackerObj?.token || data?.token || "";

  if (!trackerToken) {
    throw new Error("Safepay did not return a valid tracker from session setup");
  }

  // Generate a fresh Time-Based Token for the checkout page
  const tbt = await generateTBT();

  return { tracker: trackerToken, tbt };
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
  tbt: string;
  cancelUrl?: string;
  redirectUrl?: string;
  source?: "hosted" | "popup";
};

/**
 * Generate a checkout URL that redirects the user to Safepay's hosted payment page.
 */
export function generateCheckoutUrl(params: CheckoutUrlParams): string {
  const safepay = getSafepay();
  const { tracker, tbt, cancelUrl, redirectUrl, source = "hosted" } = params;

  return safepay.checkout.createCheckoutUrl({
    env: SAFEPAY_ENVIRONMENT,
    tracker,
    tbt,
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
    const response = await safepay.reporter.payments.fetch(tracker);
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

const EXPERIMENTAL_PLAN_MONTHLY_PRICES_PKR: Record<string, number> = {
  starter: 0,
  standard: 500,
  pro: 1000,
  chamber: 4500,
  enterprise: 50000,
};
export function calculatePlanAmount(planKey: string, billingCycle: string, isExperimental = false): number {
  const monthlyPrice = isExperimental ? EXPERIMENTAL_PLAN_MONTHLY_PRICES_PKR[planKey] : PLAN_MONTHLY_PRICES_PKR[planKey];
  if (monthlyPrice === undefined) {
    throw new Error(`Unknown plan: ${planKey}`);
  }

  const cycle = billingCycle || "monthly";
  const months = cycle === "yearly" ? 12 : cycle === "quarterly" ? 3 : 1;
  const baseTotal = monthlyPrice * months;

  if ((!isExperimental && !DISCOUNT_ELIGIBLE_PLANS.has(planKey)) || cycle === "monthly") {
    return baseTotal;
  }

  const discountPct = CYCLE_DISCOUNTS[cycle] || 0;
  return Math.round(baseTotal * (1 - discountPct / 100));
}

// ── Payment Fulfillment & Reconciliation ────────────────────────────────────

/**
 * Fulfill a completed Safepay payment: mark record completed, activate subscription, and send invoice email.
 */
export async function fulfillSafepayPayment(
  tracker: string,
  verificationData?: any,
): Promise<{ success: boolean; alreadyCompleted?: boolean; error?: string }> {
  const paymentRecord = await storage.getPaymentRecordByTracker(tracker);
  if (!paymentRecord) {
    return { success: false, error: "Payment record not found" };
  }
  if (paymentRecord.status === "completed") {
    return { success: true, alreadyCompleted: true };
  }

  // Update payment record to completed
  await storage.updatePaymentRecordStatus(tracker, "completed", verificationData || {});

  // Determine cycle and period window
  const cycle = paymentRecord.billingCycle === "quarterly" || paymentRecord.billingCycle === "yearly"
    ? paymentRecord.billingCycle
    : "monthly";
  const months = cycle === "quarterly" ? 3 : cycle === "yearly" ? 12 : 1;
  const startAt = new Date();
  const endAt = new Date(startAt);
  endAt.setMonth(endAt.getMonth() + months);

  await storage.updateUserSubscription(paymentRecord.userId, {
    subscriptionTier: paymentRecord.planKey,
    subscriptionCycle: cycle,
    subscriptionStartAt: startAt,
    subscriptionEndAt: endAt,
    autoRenew: Boolean(paymentRecord.autoRenew),
  });

  console.log(`[Safepay Fulfill] Subscription activated: tracker=${tracker}, user=${paymentRecord.userId}, plan=${paymentRecord.planKey}`);

  // Send confirmation invoice email
  try {
    const userProfile = await storage.getUserProfile(paymentRecord.userId);
    if (userProfile && userProfile.email) {
      const { sendSubscriptionInvoiceEmail } = await import("./email");
      await sendSubscriptionInvoiceEmail({
        to: userProfile.email,
        customerName: `${userProfile.firstName || ""} ${userProfile.lastName || ""}`.trim() || "Valued Customer",
        planKey: paymentRecord.planKey as any,
        billingCycle: paymentRecord.billingCycle as any,
        issuedAt: new Date(),
        periodStartAt: startAt,
        periodEndAt: endAt,
        paymentMethod: "Credit/Debit Card (via Safepay)",
        transactionRef: tracker,
        subtotalPkr: paymentRecord.amountPkr,
        discountPkr: 0,
        taxPkr: 0,
      });
      console.log(`[Safepay Fulfill] Invoice email sent to ${userProfile.email}`);
    }
  } catch (err: any) {
    console.error(`[Safepay Fulfill] Failed to send invoice email for user ${paymentRecord.userId}:`, err?.message || err);
  }

  return { success: true };
}

/**
 * Reconcile any pending payments for a specific user (called e.g. on profile load).
 * If any pending payment is verified as successful, it is immediately activated.
 */
export async function reconcileUserPendingPayments(userId: string): Promise<boolean> {
  try {
    const records = await storage.getPaymentRecordsByUser(userId);
    const now = Date.now();
    // Only check pending payments from the last 72 hours
    const recentPending = records.filter(
      (r) =>
        r.status === "pending" &&
        r.createdAt &&
        now - new Date(r.createdAt).getTime() <= 72 * 60 * 60 * 1000
    );

    let anyUpgraded = false;
    for (const record of recentPending) {
      const verification = await verifyPayment(record.safepayTracker);
      if (verification.success) {
        console.log(`[Safepay Auto-Reconcile] Detected successful payment on user visit: tracker=${record.safepayTracker}`);
        await fulfillSafepayPayment(record.safepayTracker, verification.data);
        anyUpgraded = true;
      }
    }
    return anyUpgraded;
  } catch (err: any) {
    console.error(`[Safepay Auto-Reconcile] Error checking user ${userId}:`, err?.message || err);
    return false;
  }
}

/**
 * Check and reconcile all pending payments created across the system in the last 72 hours.
 */
export async function reconcileAllPendingPayments(): Promise<void> {
  try {
    const threshold = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const pending = await db
      .select()
      .from(paymentRecords)
      .where(
        and(
          eq(paymentRecords.status, "pending"),
          gte(paymentRecords.createdAt, threshold)
        )
      );

    if (pending.length === 0) return;

    for (const record of pending) {
      try {
        const verification = await verifyPayment(record.safepayTracker);
        if (verification.success) {
          console.log(`[Safepay Background Reconcile] Auto-completed paid tracker ${record.safepayTracker} for user ${record.userId}`);
          await fulfillSafepayPayment(record.safepayTracker, verification.data);
        }
      } catch (err: any) {
        console.error(`[Safepay Background Reconcile] Error on tracker ${record.safepayTracker}:`, err?.message || err);
      }
    }
  } catch (err: any) {
    console.error("[Safepay Background Reconcile] Global check error:", err?.message || err);
  }
}

let reconcilerTimer: NodeJS.Timeout | null = null;

/**
 * Starts a background periodic worker that polls pending payments every 5 minutes
 * so no payment is ever missed even if the user drops off and webhooks fail.
 */
export function startSafepayReconcilerWorker(): void {
  if (reconcilerTimer) return;
  console.log("[Safepay Worker] Background payment reconciler started (interval: 5 minutes)");
  setTimeout(() => {
    reconcileAllPendingPayments().catch(() => {});
  }, 15_000);

  reconcilerTimer = setInterval(() => {
    reconcileAllPendingPayments().catch(() => {});
  }, 5 * 60 * 1000);
}

