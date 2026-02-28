import { db } from "./db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const ADMIN_EMAIL = "ijlalbintariq420@gmail.com";
const ADMIN_FIRST_NAME = "ijlal";
const ADMIN_LAST_NAME = "bin tariq";
const ADMIN_DEFAULT_PASSWORD = "admin12345678";

export async function seedAdminUser() {
  try {
    const [existing] = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL));
    if (existing) {
      if (!existing.isAdmin) {
        await db.update(users).set({ isAdmin: true, subscriptionTier: "pro", updatedAt: new Date() }).where(eq(users.id, existing.id));
        console.log("[Seed] Promoted existing user to admin:", ADMIN_EMAIL);
      }
      return;
    }

    const passwordHash = await bcrypt.hash(ADMIN_DEFAULT_PASSWORD, 12);
    await db.insert(users).values({
      email: ADMIN_EMAIL,
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      passwordHash,
      authProvider: "email",
      subscriptionTier: "pro",
      isAdmin: true,
    });
    console.log("[Seed] Admin user created:", ADMIN_EMAIL);
  } catch (error) {
    console.error("[Seed] Failed to seed admin user:", error);
  }
}
