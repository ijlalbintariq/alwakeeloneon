import { db } from "../server/db";
import { users } from "../shared/models/auth";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

// Auto-load .env
try {
  if (typeof (process as any).loadEnvFile === "function") {
    (process as any).loadEnvFile();
  }
} catch {}

async function main() {
  const email = (process.argv[2] || "ijlalbintariq420@gmail.com").trim().toLowerCase();
  const password = process.argv[3] || "AlwakeeloAdmin2026!";

  console.log(`\n======================================================`);
  console.log(`Setting password & Admin role for: ${email}`);
  console.log(`======================================================\n`);

  const passwordHash = await bcrypt.hash(password, 12);
  const [existing] = await db.select().from(users).where(eq(users.email, email));

  if (existing) {
    await db
      .update(users)
      .set({
        passwordHash,
        authProvider: "email",
        isAdmin: true,
        subscriptionTier: "enterprise",
        emailVerified: true,
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));

    console.log(`✅ Success! Account updated:`);
    console.log(`- Email: ${email}`);
    console.log(`- Password: ${password}`);
    console.log(`- Role: Administrator (isAdmin: true)`);
    console.log(`- Subscription: Enterprise`);
    console.log(`- Email Verified: true`);
  } else {
    const [created] = await db
      .insert(users)
      .values({
        email,
        firstName: "Ijlal",
        lastName: "Tariq",
        passwordHash,
        authProvider: "email",
        isAdmin: true,
        subscriptionTier: "enterprise",
        emailVerified: true,
        emailVerifiedAt: new Date(),
      })
      .returning();

    console.log(`✅ Success! New Administrator account created:`);
    console.log(`- Email: ${email}`);
    console.log(`- Password: ${password}`);
    console.log(`- Role: Administrator (isAdmin: true)`);
    console.log(`- Subscription: Enterprise`);
  }

  console.log(`\nYou can now log in at http://localhost:5001/auth with these credentials.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error setting password:", err);
  process.exit(1);
});
