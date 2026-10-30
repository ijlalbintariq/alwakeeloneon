const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const pg = require("pg");
const bcrypt = require("bcryptjs");
const { request, chromium } = require("@playwright/test");

const baseURL = process.env.LIVE_BASE_URL || "https://www.alwakeelo.com";
const browserOnly = process.argv.includes("--browser-only");
const reportPath = path.resolve(`reports/drafting-live-${browserOnly ? "browser" : "validation"}-2026-10-30.json`);
const artifactDir = "/tmp/alwakeelo-drafting-live";
const databaseUrl = process.env.DATABASE_URL || fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "");
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 15000 });
const id = crypto.randomUUID();
const email = `codex-drafting-audit-${id}@example.test`;
const password = crypto.randomBytes(24).toString("base64url");
const report = { startedAt: new Date().toISOString(), baseURL, accountId: id, deployedCommit: null, checks: [], cleanup: false };
let api, browser, context, provisioned = false;

function check(name, passed, detail = {}) {
  report.checks.push({ name, passed, ...detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
}

async function main() {
  fs.mkdirSync(artifactDir, { recursive: true, mode: 0o700 });
  try {
    api = await request.newContext({ baseURL, timeout: 180000 });
    const health = await (await api.get("/health")).json();
    report.deployedCommit = health.commit;
    check("production health", health.ok === true, { commit: health.commit });
    await pool.query(`INSERT INTO users (id,email,password_hash,first_name,last_name,auth_provider,email_verified,email_verified_at,onboarding_completed,subscription_tier,subscription_start_at,subscription_end_at,is_admin,auto_renew)
      VALUES ($1,$2,$3,'Drafting','Audit','email',true,now(),true,'chamber',now(),now()+interval '1 day',false,false)`, [id, email, await bcrypt.hash(password, 12)]);
    provisioned = true;
    const login = await api.post("/api/auth/login", { data: { email, password } });
    check("normal production login", login.ok(), { status: login.status() });
    if (!login.ok()) throw new Error(`Test-account login failed (${login.status()}): ${(await login.text()).slice(0, 300)}`);
    const authenticated = await (await api.get("/api/auth/user")).json();
    if (authenticated.id !== id) throw new Error("Authenticated account does not match the disposable account");

    const title = `CODEX LIVE AUDIT ${id}`;
    const create = await api.post("/api/drafts", { data: {
      title, templateType: "General", content: "<p>Live drafting audit version one.</p>",
      metadata: { textContent: "Live drafting audit version one.", pageProfileId: "a4", documentType: "affidavit" },
    } });
    check("create draft", create.status() === 201, { status: create.status() });
    if (!create.ok()) throw new Error(`Draft create failed (${create.status()})`);
    const draft = await create.json();
    report.draftId = draft.id;
    check("filing type persists", draft.metadata?.documentType === "affidavit", { returnedDocumentType: draft.metadata?.documentType ?? null });
    const patched = await api.patch(`/api/drafts/${draft.id}`, { data: { content: "<p>Live drafting audit version two.</p>", metadata: { textContent: "Live drafting audit version two.", pageProfileId: "a4", documentType: "affidavit" } } });
    const persisted = await pool.query("SELECT content,metadata FROM legal_drafts WHERE id=$1 AND user_id=$2", [draft.id, id]);
    check("API update reaches the real database", patched.ok() && persisted.rows[0]?.content === "<p>Live drafting audit version two.</p>");
    const guest = await request.newContext({ baseURL });
    const privateDraft = await guest.get(`/api/drafts/${draft.id}`);
    check("unauthenticated draft access denied", privateDraft.status() === 401, { status: privateDraft.status() });
    await guest.dispose();

    if (!browserOnly) {
    console.log("Calling the production drafting endpoint with real retrieval and AI providers…");
    const started = Date.now();
    const generated = await api.post("/api/retrieval/clauses/generate", { data: {
      prompt: "Draft an affidavit using only these fictional test facts: [TEST PERSON], with CNIC [CNIC], received one sealed envelope on 29 October 2026 in Lahore and did not open it. Use placeholders for the court, case number, address and signature. Do not invent facts or cite case law. This is an automated software audit document.",
      draftText: "", documentType: "affidavit", documentTypeOverride: "affidavit", assistantMode: "draft", module: "legal-drafting", stream: false,
    } });
    const generatedData = await generated.json();
    const text = generatedData.clause || generatedData.text || generatedData.content || "";
    check("real AI draft generation", [200, 422].includes(generated.status()) && typeof text === "string" && text.length > 100, { status: generated.status(), elapsedMs: Date.now() - started, characters: text.length, operation: generatedData.operation, message: generatedData.message });
    if (text) {
      fs.writeFileSync(path.join(artifactDir, "generated-affidavit.txt"), text, { mode: 0o600 });
      check("draft retains the supplied test facts", /envelope/i.test(text) && /2026/.test(text));
      const selected = text.split("\n").find((line) => /envelope/i.test(line))?.trim();
      if (selected) {
        const revised = await api.post("/api/retrieval/clauses/generate", { data: {
          prompt: "Change only the selected passage to state clearly that the sealed envelope remained unopened. Keep all dates, names, placeholders and the rest of the affidavit unchanged.",
          draftText: text, documentType: "affidavit", documentTypeOverride: "affidavit", assistantMode: "draft", module: "legal-drafting", stream: false,
          selectedSnippet: selected, selectedSnippetStart: text.indexOf(selected), selectedSnippetEnd: text.indexOf(selected) + selected.length, forceTargetedEdit: true,
        } });
        const edit = await revised.json();
        const output = edit.clause || edit.text || edit.content || "";
        const position = text.indexOf(selected);
        check("real AI selected-passage edit", [200, 422].includes(revised.status()) && typeof edit.replacementSnippet === "string" && output.startsWith(text.slice(0, position)) && output.endsWith(text.slice(position + selected.length)), { status: revised.status(), operation: edit.operation, replacementCharacters: edit.replacementSnippet?.length || 0, message: edit.message });
      }
    }

    }
    browser = await chromium.launch({ channel: "chrome" });
    context = await browser.newContext({ storageState: await api.storageState(), viewport: { width: 1600, height: 1000 } });
    await context.addInitScript(() => {
      if (window === window.top && location.protocol === "https:") localStorage.setItem("aw_tour_completed", "true");
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`${baseURL}/preview/drafting?docId=${draft.id}`);
    const editor = page.locator(".tiptap");
    await editor.waitFor({ state: "visible", timeout: 45000 });
    check("live studio loads saved draft", (await editor.innerText()).includes("version two"));
    const saved = page.waitForResponse((response) => response.url().endsWith(`/api/drafts/${draft.id}`) && response.request().method() === "PATCH", { timeout: 25000 });
    await editor.fill("Live browser persistence sentinel for the disposable audit account.");
    const saveResponse = await saved;
    const browserData = await pool.query("SELECT content FROM legal_drafts WHERE id=$1 AND user_id=$2", [draft.id, id]);
    check("unmocked browser autosave reaches production database", saveResponse.ok() && browserData.rows[0]?.content.includes("Live browser persistence sentinel"));
    await page.reload();
    await page.waitForFunction(() => document.querySelector(".tiptap") || Array.from(document.querySelectorAll("button")).some((button) => button.textContent.includes("Return to Active Draft")), undefined, { timeout: 45000 });
    if (!await editor.isVisible()) await page.getByRole("button", { name: /Return to Active Draft/ }).click();
    await editor.waitFor({ state: "visible", timeout: 45000 });
    check("production refresh recovery", (await editor.innerText()).includes("Live browser persistence sentinel"));
    await page.evaluate(() => {
      const range = document.createRange();
      range.selectNodeContents(document.querySelector(".tiptap p"));
      const selection = window.getSelection();
      selection.removeAllRanges(); selection.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
    const polish = page.getByRole("button", { name: /Polish/ });
    await polish.waitFor({ state: "visible" });
    check("deployed selection AI button is unobstructed", await polish.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }));
    await page.screenshot({ path: path.join(artifactDir, "production-selection.png") });
    check("live studio has no browser exceptions", pageErrors.length === 0, { errors: pageErrors });
  } catch (error) {
    report.error = error.message;
    console.error(error.message);
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    if (provisioned) {
      try {
        // Delete only this run's UUID after checking its reserved audit email.
        const own = await pool.query("SELECT email FROM users WHERE id=$1", [id]);
        if (own.rows[0]?.email !== email) throw new Error("Cleanup ownership check failed");
        await pool.query("BEGIN");
        await pool.query("DELETE FROM sessions WHERE sess->>'userId'=$1", [id]);
        const children = await pool.query(`SELECT c.conrelid::regclass::text AS table_name, a.attname AS column_name
          FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
          WHERE c.contype='f' AND c.confrelid='users'::regclass AND array_length(c.conkey,1)=1`);
        for (const child of children.rows) {
          if (!/^[a-z_][a-z_0-9]*$/.test(child.table_name) || !/^[a-z_][a-z_0-9]*$/.test(child.column_name)) throw new Error("Unexpected cleanup identifier");
          await pool.query(`DELETE FROM "${child.table_name}" WHERE "${child.column_name}"=$1`, [id]);
        }
        await pool.query("DELETE FROM users WHERE id=$1 AND email=$2", [id, email]);
        await pool.query("COMMIT");
        report.cleanup = true;
        console.log("Removed disposable account, drafts, sessions, and dependent test rows.");
      } catch (error) {
        await pool.query("ROLLBACK").catch(() => {});
        report.cleanupError = error.message;
        console.error(`Test cleanup failed: ${error.message}`);
      }
    }
    await api?.dispose().catch(() => {});
    await pool.end();
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
    if (report.error || !report.cleanup || report.checks.some((result) => !result.passed)) process.exitCode = 1;
    console.log(`Report: ${reportPath}`);
  }
}

main();
