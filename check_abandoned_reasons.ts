import { db } from "./server/db";
import { paymentRecords } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { verifyPayment } from "./server/safepay";

async function main() {
  const pending = await db.select({
    tracker: paymentRecords.safepayTracker,
    createdAt: paymentRecords.createdAt,
    amount: paymentRecords.amountPkr
  })
  .from(paymentRecords)
  .where(eq(paymentRecords.status, 'pending'))
  .orderBy(desc(paymentRecords.createdAt))
  .limit(10);

  console.log(`Checking ${pending.length} recent abandoned transactions in Safepay...\n`);

  for (const p of pending) {
    if (!p.tracker) continue;
    try {
      const spData = await verifyPayment(p.tracker);
      
      const attempts = (spData.data?.attempts as any[]) || [];
      const events = (spData.data?.events as any[]) || [];
      
      let reason = "User dropped off at Safepay login/card screen (No attempts made)";
      
      if (attempts.length > 0) {
        // Look at the latest attempt
        const lastAttempt = attempts[attempts.length - 1];
        if (lastAttempt.is_success) {
          reason = "Paid in Safepay, but webhook failed (our DB missed it)";
        } else if (lastAttempt.error) {
           reason = `Payment failed: ${lastAttempt.error.message || lastAttempt.error.code}`;
        } else if (lastAttempt.risk?.score && Number(lastAttempt.risk.score) > 80) {
           reason = "Declined due to high risk score";
        } else if (lastAttempt.enrollment?.authentication_status === "FAILED") {
           reason = "3D Secure / OTP Authentication Failed";
        } else {
           const failedAction = lastAttempt.actions_performed?.find((a:any) => a.kind.includes("FAILED") || a.kind.includes("DECLINED"));
           if (failedAction) {
             reason = `Action failed: ${failedAction.kind}`;
           } else {
             reason = "User attempted but did not complete (declined or closed during 3DS/OTP)";
           }
        }
      }
      
      console.log(`- Tracker: ${p.tracker} (Amount: ${p.amount} PKR)`);
      console.log(`  State: ${spData.state}`);
      console.log(`  Reason: ${reason}\n`);
      
    } catch (err: any) {
      console.log(`- Tracker: ${p.tracker} - Error checking: ${err.message}\n`);
    }
  }

  process.exit(0);
}
main().catch(console.error);
