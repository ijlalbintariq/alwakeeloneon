import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGoogleApiEventPayload,
} from "../../server/services/google-calendar/google-calendar-service";
import {
  buildGoogleCalendarUrl,
  CourtHearingCalendarEvent,
} from "../../shared/calendar-builder";

test("Nightly scraper matcher constructs valid calendar payloads for LHC, IHC, SHC, SCP, and District Courts", () => {
  const courts = ["LHC", "IHC", "SHC", "SCP", "LHR_DIST"] as const;

  for (const court of courts) {
    const event: CourtHearingCalendarEvent = {
      title: `Court Hearing: W.P. No. 5000/2024 (${court})`,
      court,
      bench: "Principal Seat",
      courtNumber: "Court Room No. 1",
      judgeName: "Hon'ble Judge",
      caseNumber: "W.P. No. 5000/2024",
      caseTitle: "Petitioner VS Respondent",
      petitionerAdvocate: "Barrister Aitzaz",
      fixationPurpose: "For Final Arguments",
      date: "2026-08-25",
      time: "09:00",
      isRedList: court === "LHC",
    };

    const payload = buildGoogleApiEventPayload(event);
    assert.ok(payload.summary.includes("W.P. No. 5000/2024"));
    assert.equal(payload.start.timeZone, "Asia/Karachi");
    assert.equal(payload.start.dateTime, "2026-08-25T09:00:00+05:00");
    assert.ok(payload.description.includes("Barrister Aitzaz"));
    assert.ok(payload.location.includes(court));

    const webUrl = buildGoogleCalendarUrl(event);
    assert.ok(webUrl.includes("calendar.google.com"));
    assert.ok(webUrl.includes("20260825T040000Z")); // 09:00 PKT in UTC
  }
});
