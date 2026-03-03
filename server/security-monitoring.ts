type SecurityEventType =
  | "auth_anomaly"
  | "upload_signature_failure"
  | "malware_detected"
  | "malware_scan_error"
  | "csrf_block";

export interface SecurityEventSnapshot {
  id: number;
  type: SecurityEventType;
  key: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  metadata: Record<string, unknown> | null;
}

const WINDOW_MS = 10 * 60 * 1000;
const ALERT_THRESHOLD = 5;
const MAX_EVENTS = 1000;

type CounterState = {
  count: number;
  firstSeen: number;
  lastSeen: number;
  metadata: Record<string, unknown> | null;
};

const counters = new Map<string, CounterState>();
const events: SecurityEventSnapshot[] = [];
let eventSeq = 1;

function makeCounterKey(type: SecurityEventType, key: string): string {
  return `${type}:${key || "unknown"}`;
}

function isStale(counter: CounterState, now: number): boolean {
  return now - counter.lastSeen > WINDOW_MS;
}

function compactEvents(): void {
  if (events.length <= MAX_EVENTS) return;
  events.splice(MAX_EVENTS);
}

function toIso(ts: number): string {
  return new Date(ts).toISOString();
}

function upsertEvent(
  type: SecurityEventType,
  key: string,
  counter: CounterState,
): SecurityEventSnapshot {
  const existingIndex = events.findIndex((e) => e.type === type && e.key === key);
  const payload: SecurityEventSnapshot = {
    id: existingIndex >= 0 ? events[existingIndex].id : eventSeq++,
    type,
    key,
    count: counter.count,
    firstSeenAt: toIso(counter.firstSeen),
    lastSeenAt: toIso(counter.lastSeen),
    metadata: counter.metadata,
  };

  if (existingIndex >= 0) {
    events.splice(existingIndex, 1);
  }
  events.unshift(payload);
  compactEvents();
  return payload;
}

export function recordSecurityEvent(
  type: SecurityEventType,
  key: string,
  metadata?: Record<string, unknown>,
): SecurityEventSnapshot {
  const now = Date.now();
  const counterKey = makeCounterKey(type, key);
  const existing = counters.get(counterKey);

  let state: CounterState;
  if (!existing || isStale(existing, now)) {
    state = {
      count: 1,
      firstSeen: now,
      lastSeen: now,
      metadata: metadata || null,
    };
  } else {
    state = {
      count: existing.count + 1,
      firstSeen: existing.firstSeen,
      lastSeen: now,
      metadata: metadata || existing.metadata,
    };
  }

  counters.set(counterKey, state);
  const snapshot = upsertEvent(type, key, state);

  if (snapshot.count >= ALERT_THRESHOLD && snapshot.count % ALERT_THRESHOLD === 0) {
    console.warn(
      `[Security Alert] ${type} repeated ${snapshot.count} times in ${Math.round(
        (now - state.firstSeen) / 1000,
      )}s for key="${key}"`,
    );
  }

  return snapshot;
}

export function getSecurityEvents(limit: number = 200): SecurityEventSnapshot[] {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 200));
  return events.slice(0, safeLimit);
}

