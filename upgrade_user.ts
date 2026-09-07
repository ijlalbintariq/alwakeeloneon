import { db } from './server/db';
import { users } from './shared/schema';
import { eq } from 'drizzle-orm';

async function upgrade() {
  await db.update(users)
    .set({
      emailVerified: true,
      emailVerifiedAt: new Date(),
      subscriptionTier: 'enterprise',
      isAdmin: true // Might as well make the test account an admin
    })
    .where(eq(users.email, 'enterprise-test@alwakeelo.com'));
  console.log("Upgraded enterprise-test@alwakeelo.com");
  process.exit(0);
}
upgrade();
