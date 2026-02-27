export function validateDatabaseUrl(raw: string | undefined): {
  ok: boolean;
  value?: string;
  reason?: string;
} {
  if (!raw) {
    return { ok: true, value: undefined };
  }

  const value = raw.trim();
  if (!value) {
    return { ok: true, value: undefined };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: "DATABASE_URL is not a valid URL." };
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "postgresql:" && protocol !== "postgres:") {
    return { ok: false, reason: `DATABASE_URL protocol must be postgres/postgresql, got "${protocol}".` };
  }

  if (!parsed.hostname) {
    return { ok: false, reason: "DATABASE_URL has no hostname." };
  }

  if (/^base$/i.test(parsed.hostname)) {
    return { ok: false, reason: 'DATABASE_URL hostname is "base" (placeholder), not a real database host.' };
  }

  return { ok: true, value };
}

