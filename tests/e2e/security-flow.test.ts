import test from "node:test";
import assert from "node:assert/strict";

class CookieClient {
  private cookies = new Map<string, string>();

  constructor(private readonly baseUrl: string) {}

  private setCookie(raw: string): void {
    const pair = raw.split(";")[0]?.trim();
    if (!pair) return;
    const eqIdx = pair.indexOf("=");
    if (eqIdx <= 0) return;
    const key = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (!key) return;
    this.cookies.set(key, value);
  }

  private readSetCookies(res: Response): void {
    const hdr = res.headers as Headers & { getSetCookie?: () => string[] };
    const setCookies = typeof hdr.getSetCookie === "function" ? hdr.getSetCookie() : [];
    if (setCookies.length > 0) {
      for (const raw of setCookies) this.setCookie(raw);
      return;
    }
    const fallback = res.headers.get("set-cookie");
    if (fallback) this.setCookie(fallback);
  }

  private cookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  async request(pathname: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers || {});
    const cookie = this.cookieHeader();
    if (cookie) headers.set("cookie", cookie);

    const res = await fetch(new URL(pathname, this.baseUrl), {
      ...init,
      headers,
    });
    this.readSetCookies(res);
    return res;
  }
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

test("admin ban/unban and upload protections", { timeout: 120000 }, async (t) => {
  const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:5000";
  const adminEmail = process.env.E2E_ADMIN_EMAIL || "";
  const adminPassword = process.env.E2E_ADMIN_PASSWORD || "";

  if (!adminEmail || !adminPassword) {
    t.skip("Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin security flow.");
    return;
  }

  const dbHealth = await fetch(new URL("/health/db", baseUrl)).catch(() => null);
  if (!dbHealth || !dbHealth.ok) {
    t.skip("Database is unavailable for E2E tests.");
    return;
  }

  const admin = new CookieClient(baseUrl);
  const userClient = new CookieClient(baseUrl);
  let createdUserId = "";
  const createdEmail = `codex.e2e.${Date.now()}@example.com`;
  const createdPassword = "TestPass123!";

  try {
    const loginRes = await admin.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    assert.equal(loginRes.status, 200, "admin login must succeed");

    const createRes = await admin.request("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: createdEmail,
        password: createdPassword,
        firstName: "E2E",
        lastName: "User",
        subscriptionTier: "free",
      }),
    });
    assert.equal(createRes.status, 201, "admin user creation must succeed");
    const createBody = await readJson(createRes);
    createdUserId = createBody?.user?.id || "";
    assert.ok(createdUserId, "created user id missing");

    const banRes = await admin.request(`/api/admin/users/${createdUserId}/ban`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "e2e security test" }),
    });
    assert.equal(banRes.status, 200, "ban endpoint must succeed");

    const bannedLoginRes = await userClient.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: createdEmail, password: createdPassword }),
    });
    assert.equal(bannedLoginRes.status, 403, "banned user must not be able to login");

    const unbanRes = await admin.request(`/api/admin/users/${createdUserId}/ban`, {
      method: "DELETE",
    });
    assert.equal(unbanRes.status, 200, "unban endpoint must succeed");

    const userLoginRes = await userClient.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: createdEmail, password: createdPassword }),
    });
    assert.equal(userLoginRes.status, 200, "unbanned user login must succeed");

    const form = new FormData();
    form.append("files", new Blob(["not-a-real-pdf"]), "fake.pdf");
    const uploadRes = await userClient.request("/api/documents/upload", {
      method: "POST",
      body: form,
    });
    assert.equal(uploadRes.status, 400, "invalid file signature upload must be rejected");
    const uploadBody = await readJson(uploadRes);
    const responseText = JSON.stringify(uploadBody);
    assert.match(responseText, /(signature|malware|invalid)/i);

    const adminUploadForm = new FormData();
    adminUploadForm.append("category", "general");
    adminUploadForm.append("files", new Blob(["not-a-real-pdf"]), "admin-fake.pdf");
    const adminUploadRes = await admin.request("/api/admin/knowledge", {
      method: "POST",
      body: adminUploadForm,
    });
    assert.equal(adminUploadRes.status, 400, "admin upload with invalid signature must be rejected");

    const logsRes = await admin.request("/api/admin/audit-logs?limit=200");
    assert.equal(logsRes.status, 200, "audit logs endpoint must succeed");
    const logs = (await readJson(logsRes)) as Array<{ action: string; targetUserId: string | null }>;
    assert.ok(Array.isArray(logs), "audit logs payload must be an array");
    assert.ok(logs.some((log) => log.action === "admin.user.ban" && log.targetUserId === createdUserId));
    assert.ok(logs.some((log) => log.action === "admin.user.unban" && log.targetUserId === createdUserId));
  } finally {
    if (createdUserId) {
      await admin.request(`/api/admin/users/${createdUserId}`, { method: "DELETE" }).catch(() => {});
    }
  }
});
