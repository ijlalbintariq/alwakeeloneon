import { db } from "./db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const ENABLE_ADMIN_SEED = process.env.ENABLE_ADMIN_SEED === "true";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const ADMIN_FIRST_NAME = process.env.SEED_ADMIN_FIRST_NAME?.trim() || "Admin";
const ADMIN_LAST_NAME = process.env.SEED_ADMIN_LAST_NAME?.trim() || "User";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;
const ADMIN_TIER = process.env.SEED_ADMIN_TIER === "enterprise" ? "enterprise" : "pro";

export async function seedAdminUser() {
  try {
    if (!ENABLE_ADMIN_SEED) return;

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      console.warn("[Seed] Skipping admin seed: set ENABLE_ADMIN_SEED=true with SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD.");
      return;
    }

    if (ADMIN_PASSWORD.length < 12) {
      console.warn("[Seed] Skipping admin seed: SEED_ADMIN_PASSWORD must be at least 12 characters.");
      return;
    }

    const [existing] = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL));
    if (existing) {
      if (!existing.isAdmin) {
        await db.update(users).set({ isAdmin: true, subscriptionTier: ADMIN_TIER, updatedAt: new Date() }).where(eq(users.id, existing.id));
        console.log("[Seed] Promoted existing user to admin:", ADMIN_EMAIL);
      }
      return;
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await db.insert(users).values({
      email: ADMIN_EMAIL,
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      passwordHash,
      authProvider: "email",
      subscriptionTier: ADMIN_TIER,
      isAdmin: true,
    });
    console.log("[Seed] Admin user created:", ADMIN_EMAIL);
  } catch (error) {
    console.error("[Seed] Failed to seed admin user:", error);
  }
}
