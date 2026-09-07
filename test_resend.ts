import { sendSubscriptionInvoiceEmail } from "./server/email";

async function main() {
  const result = await sendSubscriptionInvoiceEmail({
    to: "test_advocate_2026@gmail.com",
    customerName: "Test Advocate",
    planKey: "pro",
    billingCycle: "monthly",
    issuedAt: new Date(),
    periodStartAt: new Date(),
    periodEndAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    paymentMethod: "Credit/Debit Card (via Safepay)",
    transactionRef: "test_track_123",
    subtotalPkr: 1000,
    discountPkr: 0,
    taxPkr: 0
  });
  console.log("Result:", result);
  process.exit(0);
}
main().catch(console.error);
