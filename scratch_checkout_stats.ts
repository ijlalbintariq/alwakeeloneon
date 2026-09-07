import { db } from "./server/db";
import { paymentRecords, users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  const stats = await db.select({
    status: paymentRecords.status,
    count: sql<number>`count(*)`,
  }).from(paymentRecords).groupBy(paymentRecords.status);

  console.log("=== CHECKOUT ATTEMPTS BY STATUS ===");
  console.log(stats);

  const pendingCount = stats.find(s => s.status === 'pending')?.count || 0;
  const completedCount = stats.find(s => s.status === 'completed')?.count || 0;
  const failedCount = stats.find(s => s.status === 'failed')?.count || 0;

  console.log(`\nTotal who started checkout: ${Number(pendingCount) + Number(completedCount) + Number(failedCount)}`);
  console.log(`Successfully paid: ${completedCount}`);
  console.log(`Abandoned/Pending: ${pendingCount}`);
  if (failedCount > 0) console.log(`Failed: ${failedCount}`);

  // Let's get unique users who abandoned
  const uniqueAbandonedUsers = await db.execute(sql`
    SELECT COUNT(DISTINCT user_id) as count 
    FROM payment_records 
    WHERE status = 'pending' 
    AND user_id NOT IN (
      SELECT user_id FROM payment_records WHERE status = 'completed'
    )
  `);
  console.log(`Unique users who abandoned and never bought: ${uniqueAbandonedUsers.rows[0].count}`);

  process.exit(0);
}
main().catch(console.error);
