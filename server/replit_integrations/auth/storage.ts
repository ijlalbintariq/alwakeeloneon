import { users, passwordResetTokens, emailVerificationTokens, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq, and, gt, isNull, sql } from "drizzle-orm";
import crypto from "crypto";

type BillingCycle = "monthly" | "quarterly" | "yearly";

function normalizeBillingCycle(cycleRaw: string | null | undefined): BillingCycle {
  const cycle = String(cycleRaw || "monthly").toLowerCase();
  if (cycle === "quarterly" || cycle === "yearly") return cycle;
  return "monthly";
}

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  findOrCreateGoogleUser(profile: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    profileImageUrl?: string | null;
    emailVerified?: boolean;
  }): Promise<{ user: User; created: boolean }>;
  upsertUser(user: UpsertUser): Promise<User>;
  issueSingleSessionLock(userId: string, ipAddress: string): Promise<{ sessionEpoch: number; activeSessionIp: string | null }>;
  clearSingleSessionLock(userId: string, expectedSessionEpoch?: number | null): Promise<void>;
  updateUserPassword(userId: string, passwordHash: string): Promise<void>;
  updateUser(userId: string, updates: Partial<User>): Promise<void>;
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  getValidResetToken(token: string): Promise<{ id: string; userId: string } | undefined>;
  markResetTokenUsed(tokenId: string): Promise<void>;
  createEmailVerificationToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  getValidEmailVerificationToken(token: string): Promise<{ id: string; userId: string } | undefined>;
  markEmailVerificationTokenUsed(tokenId: string): Promise<void>;
  markUserEmailVerified(userId: string): Promise<void>;
}

class AuthStorage implements IAuthStorage {
  private hashResetToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async findOrCreateGoogleUser(profile: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    profileImageUrl?: string | null;
    emailVerified?: boolean;
  }): Promise<{ user: User; created: boolean }> {
    const normalizedEmail = String(profile.email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error("google_profile_missing_email");
    }

    const now = new Date();
    const normalizedFirstName = (profile.firstName || "").trim() || undefined;
    const normalizedLastName = (profile.lastName || "").trim() || undefined;
    const normalizedImage = (profile.profileImageUrl || "").trim() || undefined;
    const verified = profile.emailVerified !== false;

    const [inserted] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        profileImageUrl: normalizedImage,
        authProvider: "google",
        passwordHash: null,
        subscriptionTier: "free",
        subscriptionCycle: "monthly",
        subscriptionStartAt: null,
        subscriptionEndAt: null,
        emailVerified: verified,
        emailVerifiedAt: verified ? now : null,
      })
      .onConflictDoNothing({ target: users.email })
      .returning();

    if (inserted) {
      return { user: inserted, created: true };
    }

    const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (!existing) {
      throw new Error("google_user_lookup_failed_after_conflict");
    }

    const patch: Partial<User> & { updatedAt: Date } = {
      updatedAt: now,
    };

    if (!existing.firstName && normalizedFirstName) patch.firstName = normalizedFirstName;
    if (!existing.lastName && normalizedLastName) patch.lastName = normalizedLastName;
    if (!existing.profileImageUrl && normalizedImage) patch.profileImageUrl = normalizedImage;
    if (!existing.emailVerified && verified) {
      patch.emailVerified = true;
      patch.emailVerifiedAt = now;
    }

    const patchKeys = Object.keys(patch);
    if (patchKeys.length > 1) {
      const [updated] = await db
        .update(users)
        .set(patch)
        .where(eq(users.id, existing.id))
        .returning();
      if (updated) return { user: updated, created: false };
    }

    return { user: existing, created: false };
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const normalizedTierRaw = String(userData.subscriptionTier || "free").toLowerCase();
    const normalizedTier =
      (normalizedTierRaw === "free" || normalizedTierRaw === "standard" || normalizedTierRaw === "pro" || normalizedTierRaw === "chamber" || normalizedTierRaw === "enterprise")
          ? normalizedTierRaw
          : "free";
    const normalizedCycle = normalizeBillingCycle(userData.subscriptionCycle || "monthly");
    const safeUserData: UpsertUser = {
      ...userData,
      subscriptionTier: normalizedTier,
      subscriptionCycle: normalizedCycle,
    };

    const [user] = await db
      .insert(users)
      .values(safeUserData)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          ...safeUserData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async issueSingleSessionLock(userId: string, ipAddress: string): Promise<{ sessionEpoch: number; activeSessionIp: string | null }> {
    const now = new Date();
    const normalizedIp = String(ipAddress || "").trim() || "unknown";
    const [updated] = await db
      .update(users)
      .set({
        sessionEpoch: sql`${users.sessionEpoch} + 1`,
        activeSessionIp: normalizedIp,
        activeSessionAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, userId))
      .returning({
        sessionEpoch: users.sessionEpoch,
        activeSessionIp: users.activeSessionIp,
      });

    return {
      sessionEpoch: Number(updated?.sessionEpoch || 0),
      activeSessionIp: updated?.activeSessionIp || null,
    };
  }

  async clearSingleSessionLock(userId: string, expectedSessionEpoch?: number | null): Promise<void> {
    const conditions = [eq(users.id, userId)];
    if (Number.isFinite(Number(expectedSessionEpoch))) {
      conditions.push(eq(users.sessionEpoch, Number(expectedSessionEpoch)));
    }
    await db
      .update(users)
      .set({
        activeSessionIp: null,
        activeSessionAt: null,
        updatedAt: new Date(),
      })
      .where(and(...conditions));
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    const tokenHash = this.hashResetToken(token);
    await db.insert(passwordResetTokens).values({ userId, token: tokenHash, expiresAt });
  }

  async getValidResetToken(token: string): Promise<{ id: string; userId: string } | undefined> {
    const tokenHash = this.hashResetToken(token);
    const [result] = await db
      .select({ id: passwordResetTokens.id, userId: passwordResetTokens.userId })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, tokenHash),
          gt(passwordResetTokens.expiresAt, new Date()),
          isNull(passwordResetTokens.usedAt)
        )
      );
    return result;
  }

  async markResetTokenUsed(tokenId: string): Promise<void> {
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, tokenId));
  }

  async createEmailVerificationToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    const tokenHash = this.hashResetToken(token);
    await db
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(emailVerificationTokens.userId, userId), isNull(emailVerificationTokens.usedAt)));
    await db.insert(emailVerificationTokens).values({ userId, token: tokenHash, expiresAt });
  }

  async getValidEmailVerificationToken(token: string): Promise<{ id: string; userId: string } | undefined> {
    const tokenHash = this.hashResetToken(token);
    const [result] = await db
      .select({ id: emailVerificationTokens.id, userId: emailVerificationTokens.userId })
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.token, tokenHash),
          gt(emailVerificationTokens.expiresAt, new Date()),
          isNull(emailVerificationTokens.usedAt),
        ),
      );
    return result;
  }

  async markEmailVerificationTokenUsed(tokenId: string): Promise<void> {
    await db.update(emailVerificationTokens).set({ usedAt: new Date() }).where(eq(emailVerificationTokens.id, tokenId));
  }

  async markUserEmailVerified(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }
}

export const authStorage = new AuthStorage();
