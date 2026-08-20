import test from "node:test";
import assert from "node:assert/strict";
import {
  toUtcCalendarTimestamps,
  buildGoogleCalendarUrl,
  buildIcsCalendarFile,
  formatHearingDescription,
  formatHearingLocation,
  CourtHearingCalendarEvent,
} from "../../shared/calendar-builder";

test("toUtcCalendarTimestamps converts Pakistan Standard Time (UTC+5) to correct UTC timestamps", () => {
  // 09:00 AM PKT on 2026-08-25 = 04:00 AM UTC
  const { startIso, endIso } = toUtcCalendarTimestamps("2026-08-25", "09:00", 120);
  assert.equal(startIso, "20260825T040000Z");
  assert.equal(endIso, "20260825T060000Z");

  // 11:30 AM PKT on 2026-08-25 = 06:30 AM UTC, 90 mins duration = 08:00 AM UTC
  const res2 = toUtcCalendarTimestamps("2026-08-25", "11:30", 90);
  assert.equal(res2.startIso, "20260825T063000Z");
  assert.equal(res2.endIso, "20260825T080000Z");

  // Default fallback when time is omitted
  const res3 = toUtcCalendarTimestamps("2026-08-25");
  assert.equal(res3.startIso, "20260825T040000Z");
});

test("formatHearingDescription structures complete Pakistani legal metadata", () => {
  const event: CourtHearingCalendarEvent = {
    title: "Court Hearing: W.P. No. 12450/2024",
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
    isRedList: true,
  };

  const desc = formatHearingDescription(event);
  assert.ok(desc.includes("🚨 PRIORITY / RED CAUSE LIST HEARING"));
  assert.ok(desc.includes("Case Number: W.P. No. 12450/2024"));
  assert.ok(desc.includes("Case Title: Muhammad Aslam VS Federation of Pakistan"));
  assert.ok(desc.includes("Court: Lahore High Court - Principal Seat"));
  assert.ok(desc.includes("Bench / Judge: Mr. Justice Ali Baqar Najafi"));
  assert.ok(desc.includes("Petitioner Counsel: Chaudhry Aitzaz Ahsan Adv."));
  assert.ok(desc.includes("Fixation Purpose: For Final Arguments"));
  assert.ok(desc.includes("Alwakeelo"));
});

test("formatHearingLocation creates clean geographic string", () => {
  const event: CourtHearingCalendarEvent = {
    title: "Trial Hearing",
    court: "Lahore District Courts",
    bench: "Aiwan-e-Adl (Sessions Division)",
    courtNumber: "Court Room No. 12",
    date: "2026-08-25",
  };

  const loc = formatHearingLocation(event);
  assert.equal(loc, "Court Room No. 12, Aiwan-e-Adl (Sessions Division), Lahore District Courts, Pakistan");
});

test("buildGoogleCalendarUrl creates a valid, pre-filled web deep link", () => {
  const event: CourtHearingCalendarEvent = {
    title: "W.P. No. 12450/2024",
    caseNumber: "W.P. No. 12450/2024",
    court: "Lahore High Court",
    bench: "Principal Seat",
    courtNumber: "Court Room No. 3",
    judgeName: "Mr. Justice Ali Baqar Najafi",
    date: "2026-08-25",
    time: "09:30",
    durationMinutes: 120,
    isRedList: false,
  };

  const url = buildGoogleCalendarUrl(event);
  assert.ok(url.startsWith("https://calendar.google.com/calendar/render?"));
  assert.ok(url.includes("action=TEMPLATE"));
  assert.ok(url.includes("dates=20260825T043000Z%2F20260825T063000Z"));
  assert.ok(url.includes("Mr.+Justice+Ali+Baqar+Najafi") || url.includes("Mr.%20Justice%20Ali%20Baqar%20Najafi"));
});

test("buildIcsCalendarFile outputs valid RFC 5545 standard file with alarm reminder", () => {
  const event: CourtHearingCalendarEvent = {
    title: "Supreme Court Appeal - C.A. 450/2021",
    caseNumber: "C.A. No. 450/2021",
    court: "Supreme Court of Pakistan",
    bench: "Principal Seat (Islamabad)",
    courtNumber: "Court Room No. 1",
    judgeName: "Chief Justice of Pakistan",
    date: "2026-08-25",
    isRedList: true,
  };

  const ics = buildIcsCalendarFile(event);
  assert.ok(ics.startsWith("BEGIN:VCALENDAR"));
  assert.ok(ics.includes("VERSION:2.0"));
  assert.ok(ics.includes("BEGIN:VEVENT"));
  assert.ok(ics.includes("SUMMARY:[RED LIST] Supreme Court Appeal - C.A. 450/2021"));
  assert.ok(ics.includes("BEGIN:VALARM"));
  assert.ok(ics.includes("TRIGGER:-PT60M"));
  assert.ok(ics.endsWith("END:VCALENDAR"));
});
