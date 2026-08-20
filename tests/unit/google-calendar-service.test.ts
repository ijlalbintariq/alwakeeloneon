import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGoogleApiEventPayload,
  getGoogleCalendarAuthUrl,
} from "../../server/services/google-calendar/google-calendar-service";
import { CourtHearingCalendarEvent } from "../../shared/calendar-builder";

test("buildGoogleApiEventPayload formats valid Google Calendar API v3 event resource", () => {
  const event: CourtHearingCalendarEvent = {
    title: "W.P. No. 12450/2024 - Hearing",
    caseNumber: "W.P. No. 12450/2024",
    caseTitle: "Muhammad Aslam VS Federation of Pakistan",
    court: "Lahore High Court",
    bench: "Principal Seat",
    courtNumber: "Court Room No. 3",
    judgeName: "Mr. Justice Ali Baqar Najafi",
    petitionerAdvocate: "Chaudhry Aitzaz Ahsan Adv.",
    respondentAdvocate: "Attorney General for Pakistan",
    fixationPurpose: "For Final Arguments",
    date: "2026-08-25",
    time: "09:30",
    isRedList: true,
  };

  const payload = buildGoogleApiEventPayload(event);

  assert.equal(payload.summary, "🚨 [RED LIST] W.P. No. 12450/2024 - Hearing");
  assert.equal(payload.start.timeZone, "Asia/Karachi");
  assert.equal(payload.start.dateTime, "2026-08-25T09:30:00+05:00");
  assert.equal(payload.end.dateTime, "2026-08-25T11:30:00+05:00");
  assert.equal(payload.colorId, "11"); // Red color for red list
  assert.equal(payload.reminders.useDefault, false);
  assert.equal(payload.reminders.overrides.length, 2);
  assert.equal(payload.reminders.overrides[0].minutes, 60);
  assert.equal(payload.reminders.overrides[1].minutes, 120);

  assert.ok(payload.description.includes("Mr. Justice Ali Baqar Najafi"));
  assert.ok(payload.description.includes("Chaudhry Aitzaz Ahsan Adv."));
  assert.ok(payload.location.includes("Court Room No. 3, Principal Seat, Lahore High Court"));
});

test("buildGoogleApiEventPayload handles regular cause list items without red list prefix", () => {
  const event: CourtHearingCalendarEvent = {
    title: "Suit No. 145/2023",
    caseNumber: "Suit No. 145/2023",
    court: "Lahore District Courts",
    bench: "Civil Courts Complex",
    courtNumber: "Court Room No. 12",
    judgeName: "Civil Judge Class-I",
    date: "2026-08-25",
    isRedList: false,
  };

  const payload = buildGoogleApiEventPayload(event);

  assert.equal(payload.summary, "🏛️ Suit No. 145/2023");
  assert.equal(payload.start.dateTime, "2026-08-25T09:00:00+05:00");
  assert.equal(payload.colorId, "2"); // Green/Sage for regular
});

test("getGoogleCalendarAuthUrl throws if credentials are not provided", () => {
  const originalId = process.env.GOOGLE_CLIENT_ID;
  const originalOAuth = process.env.GOOGLE_OAUTH_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_OAUTH_CLIENT_ID;

  try {
    assert.throws(
      () => getGoogleCalendarAuthUrl("test-user-123", "http://localhost:5000/callback"),
      /GOOGLE_CLIENT_ID is not configured/
    );
  } finally {
    if (originalId) process.env.GOOGLE_CLIENT_ID = originalId;
    if (originalOAuth) process.env.GOOGLE_OAUTH_CLIENT_ID = originalOAuth;
  }
});
