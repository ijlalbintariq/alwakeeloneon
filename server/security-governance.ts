import { pool } from "./db";

export interface UserBanInfo {
  userId: string;
  reason: string | null;
  bannedBy: string | null;
  createdAt: string;
}

export interface AdminAuditLog {
  id: number;
  action: string;
  actorUserId: string | null;
  targetUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

type InMemoryBan = {
  reason: string | null;
  bannedBy: string | null;
  createdAt: string;
};

const inMemoryBans = new Map<string, InMemoryBan>();
const inMemoryAuditLogs: AdminAuditLog[] = [];
let inMemoryAuditId = 1;

function hasDbPool(): boolean {
  return !!pool && typeof (pool as any).query === "function";
}

async function safeRunMigration(label: string, query: string): Promise<void> {
  if (!hasDbPool()) return;
  try {
    await (pool as any).query(query);
  } catch (error: any) {
    console.warn(`[Security Governance] Could not ensure ${label}:`, error?.message || error);
  }
}

function parseMetadata(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function initializeSecurityGovernance(): Promise<void> {
  if (!hasDbPool()) return;

  await safeRunMigration(
    "user_bans_table",
    `
      CREATE TABLE IF NOT EXISTS user_bans (
        user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT,
        banned_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `,
  );

  await safeRunMigration(
    "audit_logs_table",
    `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        actor_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        target_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `,
  );

  await safeRunMigration("idx_user_bans_created_at", "CREATE INDEX IF NOT EXISTS idx_user_bans_created_at ON user_bans (created_at DESC)");
  await safeRunMigration("idx_audit_logs_created_at", "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC)");
  await safeRunMigration("idx_audit_logs_action", "CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action)");
}

export async function banUser(userId: string, bannedBy: string | null, reason?: string): Promise<void> {
  const cleanReason = reason?.trim() || null;
  if (!hasDbPool()) {
    inMemoryBans.set(userId, {
      reason: cleanReason,
      bannedBy,
      createdAt: new Date().toISOString(),
    });
    return;
  }

  await (pool as any).query(
    `
      INSERT INTO user_bans (user_id, reason, banned_by, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        reason = EXCLUDED.reason,
        banned_by = EXCLUDED.banned_by,
        created_at = NOW()
    `,
    [userId, cleanReason, bannedBy],
  );
}

export async function unbanUser(userId: string): Promise<void> {
  if (!hasDbPool()) {
    inMemoryBans.delete(userId);
    return;
  }

  await (pool as any).query("DELETE FROM user_bans WHERE user_id = $1", [userId]);
}

export async function getUserBan(userId: string): Promise<UserBanInfo | null> {
  if (!hasDbPool()) {
    const ban = inMemoryBans.get(userId);
    if (!ban) return null;
    return {
      userId,
      reason: ban.reason,
      bannedBy: ban.bannedBy,
      createdAt: ban.createdAt,
    };
  }

  const result = await (pool as any).query(
    "SELECT user_id, reason, banned_by, created_at FROM user_bans WHERE user_id = $1 LIMIT 1",
    [userId],
  );
  const row = result?.rows?.[0];
  if (!row) return null;
  return {
    userId: String(row.user_id),
    reason: row.reason ? String(row.reason) : null,
    bannedBy: row.banned_by ? String(row.banned_by) : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function isUserBanned(userId: string): Promise<boolean> {
  const ban = await getUserBan(userId);
  return !!ban;
}

export async function getUserBanMap(userIds: string[]): Promise<Record<string, UserBanInfo>> {
  const map: Record<string, UserBanInfo> = {};
  if (userIds.length === 0) return map;

  if (!hasDbPool()) {
    for (const userId of userIds) {
      const ban = inMemoryBans.get(userId);
      if (!ban) continue;
      map[userId] = {
        userId,
        reason: ban.reason,
        bannedBy: ban.bannedBy,
        createdAt: ban.createdAt,
      };
    }
    return map;
  }

  const result = await (pool as any).query(
    `
      SELECT user_id, reason, banned_by, created_at
      FROM user_bans
      WHERE user_id = ANY($1::varchar[])
    `,
    [userIds],
  );

  for (const row of result?.rows || []) {
    const userId = String(row.user_id);
    map[userId] = {
      userId,
      reason: row.reason ? String(row.reason) : null,
      bannedBy: row.banned_by ? String(row.banned_by) : null,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  return map;
}

export async function logAuditEvent(
  action: string,
  actorUserId?: string | null,
  targetUserId?: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const actor = actorUserId || null;
  const target = targetUserId || null;
  const meta = metadata && Object.keys(metadata).length > 0 ? metadata : null;

  if (!hasDbPool()) {
    inMemoryAuditLogs.unshift({
      id: inMemoryAuditId++,
      action,
      actorUserId: actor,
      targetUserId: target,
      metadata: meta,
      createdAt: new Date().toISOString(),
    });
    if (inMemoryAuditLogs.length > 500) {
      inMemoryAuditLogs.length = 500;
    }
    return;
  }

  await (pool as any).query(
    `
      INSERT INTO audit_logs (action, actor_user_id, target_user_id, metadata)
      VALUES ($1, $2, $3, $4::jsonb)
    `,
    [action, actor, target, meta ? JSON.stringify(meta) : null],
  );
}

export async function getAuditLogs(limit: number = 200): Promise<AdminAuditLog[]> {
  const cappedLimit = Math.min(500, Math.max(1, Number(limit) || 200));

  if (!hasDbPool()) {
    return inMemoryAuditLogs.slice(0, cappedLimit);
  }

  const result = await (pool as any).query(
    `
      SELECT id, action, actor_user_id, target_user_id, metadata, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [cappedLimit],
  );

  return (result?.rows || []).map((row: any) => ({
    id: Number(row.id),
    action: String(row.action),
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    targetUserId: row.target_user_id ? String(row.target_user_id) : null,
    metadata: parseMetadata(row.metadata),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}
