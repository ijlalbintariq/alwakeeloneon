import test from "node:test";
import assert from "node:assert/strict";

import {
  banUser,
  getAuditLogs,
  getUserBan,
  isUserBanned,
  logAuditEvent,
  unbanUser,
} from "../../server/security-governance";

test("ban and unban lifecycle works", async () => {
  const userId = "unit-user-1";
  const adminId = "unit-admin-1";

  await unbanUser(userId);
  assert.equal(await isUserBanned(userId), false);

  await banUser(userId, adminId, "Repeated abuse");
  assert.equal(await isUserBanned(userId), true);

  const ban = await getUserBan(userId);
  assert.ok(ban);
  assert.equal(ban?.userId, userId);
  assert.equal(ban?.bannedBy, adminId);
  assert.equal(ban?.reason, "Repeated abuse");

  await unbanUser(userId);
  assert.equal(await isUserBanned(userId), false);
});

test("audit events are persisted and retrievable", async () => {
  const action = `unit.audit.${Date.now()}`;
  await logAuditEvent(action, "unit-admin-2", "unit-user-2", {
    source: "unit-test",
  });

  const logs = await getAuditLogs(50);
  const hit = logs.find((log) => log.action === action);
  assert.ok(hit, "expected to find freshly inserted audit event");
  assert.equal(hit?.actorUserId, "unit-admin-2");
  assert.equal(hit?.targetUserId, "unit-user-2");
});

