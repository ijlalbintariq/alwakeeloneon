import { users, passwordResetTokens, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq, and, gt, isNull, sql } from "drizzle-orm";
import crypto from "crypto";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  issueSingleSessionLock(userId: string, ipAddress: string): Promise<{ sessionEpoch: number; activeSessionIp: string | null }>;
  clearSingleSessionLock(userId: string, expectedSessionEpoch?: number | null): Promise<void>;
  updateUserPassword(userId: string, passwordHash: string): Promise<void>;
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  getValidResetToken(token: string): Promise<{ id: string; userId: string } | undefined>;
  markResetTokenUsed(tokenId: string): Promise<void>;
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

  async upsertUser(userData: UpsertUser): Promise<User> {
    const normalizedTierRaw = String(userData.subscriptionTier || "standard").toLowerCase();
    const normalizedTier =
      normalizedTierRaw === "free"
        ? "standard"
        : (normalizedTierRaw === "standard" || normalizedTierRaw === "pro" || normalizedTierRaw === "chamber" || normalizedTierRaw === "enterprise")
          ? normalizedTierRaw
          : "standard";
    const safeUserData: UpsertUser = {
      ...userData,
      subscriptionTier: normalizedTier,
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
}

export const authStorage = new AuthStorage();
