import test from "node:test";
import assert from "node:assert/strict";
import {
  getPktTime,
  getNextWorkingDayStr,
  getTodayStr,
} from "../../server/services/causelist/causelist-cron";

test("getPktTime accurately formats Pakistan Standard Time (UTC+5)", () => {
  // Test with fixed UTC date: 2026-08-20 19:00:00 UTC -> 2026-08-21 00:00:00 PKT
  const testDate = new Date("2026-08-20T19:00:00Z");
  const pkt = getPktTime(testDate);

  assert.equal(pkt.year, 2026);
  assert.equal(pkt.month, 8);
  assert.equal(pkt.day, 21);
  assert.equal(pkt.hour, 0);
  assert.equal(pkt.minute, 0);
  assert.equal(pkt.dateKey, "2026-08-21");
});

test("getNextWorkingDayStr moves to tomorrow on regular days", () => {
  // Tuesday 2026-08-18 -> Wednesday 2026-08-19
  const tuesday = new Date("2026-08-18T10:00:00Z");
  const nextDay = getNextWorkingDayStr(tuesday);
  assert.equal(nextDay, "2026-08-19");
});

test("getNextWorkingDayStr skips Sunday and advances to Monday", () => {
  // Saturday 2026-08-22 -> skips Sunday 2026-08-23 -> Monday 2026-08-24
  const saturday = new Date("2026-08-22T10:00:00Z");
  const nextWorkingDay = getNextWorkingDayStr(saturday);
  assert.equal(nextWorkingDay, "2026-08-24");
});

test("getTodayStr returns YYYY-MM-DD for current PKT day", () => {
  const testDate = new Date("2026-08-21T06:00:00Z");
  const todayStr = getTodayStr(testDate);
  assert.equal(todayStr, "2026-08-21");
});
