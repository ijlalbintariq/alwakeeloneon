import { verifyPayment } from "./server/safepay";
import { storage } from "./server/storage";
import { sendSubscriptionInvoiceEmail } from "./server/email";

// Mock the missing functions if they are internal to routes.ts
function normalizeBillingCycle(c: string) { return c || "monthly"; }
function getSubscriptionWindow(cycle: string, date: Date) {
  const startAt = new Date(date);
  const endAt = new Date(date);
  if (cycle === "yearly") endAt.setFullYear(endAt.getFullYear() + 1);
  else if (cycle === "quarterly") endAt.setMonth(endAt.getMonth() + 3);
  else endAt.setMonth(endAt.getMonth() + 1);
  return { startAt, endAt };
}

async function main() {
  const tracker = "track_52795a20-42e1-4749-9681-35ac0044a9b8";
  const verification = await verifyPayment(tracker);
  if (!verification.success) {
    console.error("Safepay says not success:", verification.state);
    process.exit(1);
  }

  const paymentRecord = await storage.getPaymentRecordByTracker(tracker);
  if (!paymentRecord) {
    console.error("Payment record not found");
    process.exit(1);
  }

  if (paymentRecord.status === "completed") {
    console.log("Already completed in DB");
    process.exit(0);
  }

  await storage.updatePaymentRecordStatus(tracker, "completed", verification.data);

  const normalizedCycle = normalizeBillingCycle(paymentRecord.billingCycle);
  const cycleWindow = getSubscriptionWindow(normalizedCycle, new Date());

  await storage.updateUserSubscription(paymentRecord.userId, {
    subscriptionTier: paymentRecord.planKey,
    subscriptionCycle: normalizedCycle,
    subscriptionStartAt: cycleWindow.startAt,
    subscriptionEndAt: cycleWindow.endAt,
    autoRenew: Boolean(paymentRecord.autoRenew),
  });

  console.log("Subscription updated in DB.");

  const userProfile = await storage.getUserProfile(paymentRecord.userId);
  if (userProfile && userProfile.email) {
    console.log("Sending email to", userProfile.email);
    const emailResult = await sendSubscriptionInvoiceEmail({
      to: userProfile.email,
      customerName: `${userProfile.firstName || ""} ${userProfile.lastName || ""}`.trim() || "Valued Customer",
      planKey: paymentRecord.planKey as any,
      billingCycle: paymentRecord.billingCycle as any,
      issuedAt: new Date(),
      periodStartAt: cycleWindow.startAt,
      periodEndAt: cycleWindow.endAt,
      paymentMethod: "Credit/Debit Card (via Safepay)",
      transactionRef: tracker,
      subtotalPkr: paymentRecord.amountPkr,
      discountPkr: 0,
      taxPkr: 0,
    });
    console.log("Email Result:", emailResult);
  }

  process.exit(0);
}
main().catch(console.error);
