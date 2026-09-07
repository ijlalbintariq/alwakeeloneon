import { db } from './server/db';
import { paymentRecords, users } from './shared/schema';
import { desc, eq, or, sql } from 'drizzle-orm';

async function check() {
  console.log("=== CHECKING PAYMENT RECORDS ===");
  const allRecent = await db.select({
    id: paymentRecords.id,
    userId: paymentRecords.userId,
    planKey: paymentRecords.planKey,
    billingCycle: paymentRecords.billingCycle,
    amountPkr: paymentRecords.amountPkr,
    status: paymentRecords.status,
    safepayTracker: paymentRecords.safepayTracker,
    createdAt: paymentRecords.createdAt,
    completedAt: paymentRecords.completedAt,
    userEmail: users.email,
    userName: sql`concat(${users.firstName}, ' ', ${users.lastName})`,
    userTier: users.subscriptionTier,
  })
  .from(paymentRecords)
  .leftJoin(users, eq(paymentRecords.userId, users.id))
  .orderBy(desc(paymentRecords.createdAt))
  .limit(20);

  console.log("Recent 20 payments:", JSON.stringify(allRecent, null, 2));

  const records800 = allRecent.filter(r => r.amountPkr === 800 || (r.amountPkr >= 700 && r.amountPkr <= 900));
  console.log("=== PAYMENTS AROUND 800 PKR ===", JSON.stringify(records800, null, 2));

  const paidUsers = await db.select({
    id: users.id,
    email: users.email,
    firstName: users.firstName,
    lastName: users.lastName,
    phoneNumber: users.phoneNumber,
    tier: users.subscriptionTier,
    cycle: users.subscriptionCycle,
    startAt: users.subscriptionStartAt,
    endAt: users.subscriptionEndAt,
    updatedAt: users.updatedAt,
    createdAt: users.createdAt,
  })
  .from(users)
  .where(or(
    eq(users.subscriptionTier, 'pro'),
    eq(users.subscriptionTier, 'standard'),
    eq(users.subscriptionTier, 'chamber'),
    eq(users.subscriptionTier, 'enterprise')
  ))
  .orderBy(desc(users.updatedAt))
  .limit(10);

  console.log("=== USERS WITH PAID TIERS ===", JSON.stringify(paidUsers, null, 2));

  process.exit(0);
}

check().catch((err) => {
  console.error("Check failed:", err);
  process.exit(1);
});

