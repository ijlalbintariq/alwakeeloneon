import { test, expect, type Page } from "@playwright/test";

test.use({ baseURL: process.env.CHAT_TEST_BASE_URL || "http://localhost:5001", channel: "chrome", viewport: { width: 1600, height: 1000 } });
const answer = 'A synthetic answer citing PLD 2024 SC 17.\n\n```references\n{"laws":[{"name":"Synthetic Act","section":"7","description":"Fixture statute"}],"judgments":[{"citation":"PLD 2024 SC 17","title":"Fixture authority","court":"Test Court"}]}\n```';
const events = (content = answer) => `data: ${JSON.stringify({ text: content })}\n\ndata: ${JSON.stringify({ done: true, model: "fixture-model" })}\n\n`;
const prompt = (page: Page) => page.getByPlaceholder("Ask about Pakistani statutes", { exact: false });
const assistant = (page: Page) => page.locator('[data-chat-role="assistant"]');

async function setup(page: Page, options: { body?: string; json?: any; status?: number; chatGate?: Promise<void>; ragGate?: Promise<void>; loadGate?: Promise<void>; voiceGate?: Promise<void>; onSave?: (payload: any) => Promise<void>; failSaves?: { value: boolean }; savedId?: number; blockedStorage?: boolean; voice?: boolean } = {}) {
  await page.addInitScript(({ savedId, blockedStorage, voice }) => {
    localStorage.setItem("aw_tour_completed", "true");
    if (savedId && !localStorage.getItem("chat-test-initialized")) {
      localStorage.setItem("chat-test-initialized", "true");
      localStorage.setItem("alwakeelo-preview-active-thread-id:chat-audit", String(savedId));
    }
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { (window as any).copiedText = text; } } });
    if (blockedStorage) {
      for (const name of ["getItem", "setItem", "removeItem"] as const) {
        const original = Storage.prototype[name];
        Storage.prototype[name] = function (key: string, ...args: any[]) {
          if (key.startsWith("alwakeelo-preview-active-thread-id")) throw new DOMException("Blocked", "SecurityError");
          return (original as any).call(this, key, ...args);
        };
      }
    }
    if (voice) {
      Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
      (window as any).MediaRecorder = class {
        static isTypeSupported() { return true; }
        state = "inactive"; mimeType = "audio/webm"; ondataavailable: any; onstop: any;
        start() { this.state = "recording"; }
        stop() { this.ondataavailable?.({ data: new Blob(["synthetic audio"], { type: this.mimeType }) }); this.state = "inactive"; this.onstop?.(); }
      };
    }
  }, { savedId: options.savedId, blockedStorage: options.blockedStorage, voice: options.voice });
  const calls = { chat: [] as any[], rag: [] as any[], saves: [] as any[], loads: [] as number[], shares: [] as number[] };
  const errors: string[] = [];
  const records: Record<number, any> = {
    11: { id: 11, title: "History A", messages: [{ id: 1, role: "user", content: "First historical question" }, { id: 2, role: "assistant", content: "Historical answer A." }] },
    22: { id: 22, title: "History B", messages: [{ id: 3, role: "user", content: "Second historical question" }, { id: 4, role: "assistant", content: "Historical answer B." }] },
  };
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let body: any = [];
    if (path === "/api/auth/user") body = { id: "chat-audit", firstName: "Chat", email: "chat@example.test", subscriptionTier: "chamber", onboardingCompleted: true };
    else if (path === "/api/usage") body = { tier: "chamber", usage: {}, limits: {} };
    else if (path === "/api/case-files") body = [{ id: 7, title: "Fixture file" }];
    else if (path === "/api/threads") body = Object.values(records).map(({ id, title }) => ({ id, title }));
    else if (path === "/api/threads/upsert-turn") {
      const payload = request.postDataJSON(); calls.saves.push(payload);
      await options.onSave?.(payload);
      if (options.failSaves?.value) return route.fulfill({ status: 503, json: { message: "Storage unavailable" } });
      const id = payload.threadId || 33;
      records[id] ||= { id, title: payload.title, messages: [] };
      records[id].messages.push({ id: crypto.randomUUID(), role: "user", content: payload.userMessage }, { id: crypto.randomUUID(), role: "assistant", content: payload.assistantMessage });
      body = { threadId: id, thread: { id } };
    } else if (/^\/api\/threads\/\d+$/.test(path)) {
      const id = Number(path.split("/").pop()); calls.loads.push(id);
      if (id === 22) await options.loadGate;
      body = records[id];
    } else if (path.endsWith("/share")) {
      calls.shares.push(Number(path.split("/").at(-2)));
      body = { shareUrl: "/share/fixture-token" };
    } else if (path === "/api/ai/chat") {
      const payload = request.headers()["content-type"]?.includes("application/json") ? request.postDataJSON() : request.postData();
      calls.chat.push(payload);
      await options.chatGate;
      if (options.status) return route.fulfill({ status: options.status, json: { message: "Fixture quota limit" } });
      if (options.json) return route.fulfill({ json: options.json });
      return route.fulfill({ contentType: "text/event-stream", body: options.body ?? events() });
    } else if (path === "/api/rag/ask") {
      calls.rag.push(request.postDataJSON()); await options.ragGate;
      body = { answer: "Vault fixture answer.", citations: [{ documentId: 1, sourceDocumentId: 42, title: "Fixture vault source", quote: "Source fixture quotation" }] };
    } else if (path === "/api/ai/transcribe") { await options.voiceGate; body = { transcription: "Dictated fixture question" }; }
    else if (path === "/api/caseLaw/lookup-batch") body = { results: {} };
    await route.fulfill({ status: 200, json: body });
  });
  return { calls, errors, records };
}

async function send(page: Page, text = "Synthetic question") {
  await prompt(page).fill(text);
  await prompt(page).press("Enter");
}
async function history(page: Page, title: string) {
  await page.getByTitle("Consultation History", { exact: true }).click();
  await page.getByRole("button").filter({ has: page.getByText(title, { exact: true }) }).click();
}

test("streamed answers retain structured references in saved and restored history", async ({ page }) => {
  const harness = await setup(page);
  await page.goto("/preview/chat"); await send(page);
  await expect(assistant(page)).toContainText("Synthetic Act");
  await expect.poll(() => harness.calls.saves.length).toBe(1);
  expect(harness.calls.saves[0].assistantMessage).toBe(answer);
  await page.reload();
  await expect(assistant(page)).toContainText("Synthetic Act");
  await expect(page.getByText("Referenced Precedents", { exact: true })).toBeVisible();
  await expect(page.getByText("Verified Precedents from Database", { exact: true })).toHaveCount(0);
  expect(harness.errors).toEqual([]);
});

test("explicit thread links take priority over the saved thread and retain unrelated URL state", async ({ page }) => {
  const harness = await setup(page, { savedId: 11 });
  await page.goto("/preview/chat?threadId=22&view=compact#anchor");
  await expect(assistant(page)).toContainText("Historical answer B.");
  expect(harness.calls.loads).toEqual([22]);
  expect(page.url()).toContain("view=compact#anchor");
  expect(harness.errors).toEqual([]);
});

test("new chat does not restore the previous thread when queries refresh", async ({ page }) => {
  const harness = await setup(page, { savedId: 11 });
  await page.goto("/preview/chat"); await expect(assistant(page)).toContainText("Historical answer A.");
  await page.getByTitle("New Chat", { exact: true }).click(); await send(page, "Fresh question");
  await expect.poll(() => harness.calls.saves.length).toBe(1);
  expect(harness.calls.saves[0].threadId).toBeUndefined();
  await expect(assistant(page)).not.toContainText("Historical answer A.");
  expect(harness.errors).toEqual([]);
});

test("a response from a cancelled consultation cannot populate or save into a new chat", async ({ page }) => {
  let release!: () => void;
  const harness = await setup(page, { chatGate: new Promise((resolve) => { release = resolve; }) });
  await page.goto("/preview/chat"); await send(page);
  await expect.poll(() => harness.calls.chat.length).toBe(1);
  await page.getByTitle("New Chat", { exact: true }).click();
  release(); await page.waitForLoadState("networkidle");
  await expect(assistant(page)).toHaveCount(0);
  await expect(prompt(page)).toBeEnabled();
  expect(harness.calls.saves).toEqual([]); expect(harness.errors).toEqual([]);
});

test("a late save does not replace the thread selected while it was pending", async ({ page }) => {
  let release!: () => void;
  const harness = await setup(page, { onSave: async () => new Promise<void>((resolve) => { release = resolve; }) });
  await page.goto("/preview/chat"); await send(page);
  await expect.poll(() => harness.calls.saves.length).toBe(1);
  await history(page, "History B"); await expect(assistant(page)).toContainText("Historical answer B.");
  release(); await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => localStorage.getItem("alwakeelo-preview-active-thread-id:chat-audit"))).toBe("22");
  await expect(assistant(page)).toContainText("Historical answer B."); expect(harness.errors).toEqual([]);
});

test("slower history requests cannot overwrite the latest selected thread", async ({ page }) => {
  let release!: () => void;
  const harness = await setup(page, { loadGate: new Promise((resolve) => { release = resolve; }) });
  await page.goto("/preview/chat"); await history(page, "History B");
  await expect.poll(() => harness.calls.loads.includes(22)).toBe(true);
  await history(page, "History A"); await expect(assistant(page)).toContainText("Historical answer A.");
  release(); await page.waitForLoadState("networkidle");
  await expect(assistant(page)).toContainText("Historical answer A."); expect(harness.errors).toEqual([]);
});

test("partial stream errors remain visible and are not saved as complete answers", async ({ page }) => {
  const harness = await setup(page, { body: 'data: {"searching":true}\n\ndata: {"text":"Partial fixture answer"}\n\ndata: {"error":"Provider fixture failed"}\n\n' });
  await page.goto("/preview/chat"); await send(page);
  await expect(page.getByRole("alert")).toContainText("Provider fixture failed");
  await expect(assistant(page)).toContainText("Partial fixture answer");
  await expect(page.getByText("Searching Pakistani Judicial Precedents Database...", { exact: true })).toHaveCount(0);
  expect(harness.calls.saves).toEqual([]); expect(harness.errors).toEqual([]);
});

test("an unfinished stream reports interruption rather than silently saving its partial output", async ({ page }) => {
  const harness = await setup(page, { body: 'data: {"text":"Incomplete fixture"}\n\n' });
  await page.goto("/preview/chat"); await send(page);
  await expect(page.getByRole("alert")).toContainText("ended before completion");
  expect(harness.calls.saves).toEqual([]); expect(harness.errors).toEqual([]);
});

test("empty JSON responses restore the prompt and attachment for retry", async ({ page }) => {
  const harness = await setup(page, { json: { content: "" } });
  await page.goto("/preview/chat");
  await page.locator('input[type="file"]').setInputFiles({ name: "fixture.txt", mimeType: "text/plain", buffer: Buffer.from("Fictional input") });
  await send(page);
  await expect(page.getByRole("alert")).toContainText("empty answer");
  await expect(prompt(page)).toHaveValue("Synthetic question");
  await expect(page.getByRole("button", { name: "Remove fixture.txt", exact: true })).toBeVisible();
  expect(harness.calls.saves).toEqual([]); expect(harness.errors).toEqual([]);
});

test("failed saves show recovery controls and retry the same turn without another AI call", async ({ page }) => {
  const failSaves = { value: true };
  const harness = await setup(page, { failSaves });
  await page.goto("/preview/chat"); await send(page);
  await expect(page.getByText("This consultation has not been saved.", { exact: false })).toBeVisible();
  await expect(prompt(page)).toBeDisabled();
  failSaves.value = false;
  await page.getByRole("button", { name: "Retry saving consultation", exact: true }).click();
  await expect(prompt(page)).toBeEnabled();
  expect(harness.calls.chat).toHaveLength(1); expect(harness.calls.saves).toHaveLength(2);
  expect(harness.errors).toEqual([]);
});

test("embedded attachment context is hidden in the bubble and included in follow-up and saved messages", async ({ page }) => {
  const embedded = "Review fixture\n[Attached: fixture.txt]\n\n[ATTACHED DOCUMENTS]\nSECRET FIXTURE CONTENT\n[END ATTACHED DOCUMENTS]";
  const harness = await setup(page, { body: `data: {"text":"File fixture answer"}\n\ndata: ${JSON.stringify({ done: true, embeddedAttachmentContent: embedded })}` });
  await page.goto("/preview/chat");
  await page.locator('input[type="file"]').setInputFiles({ name: "fixture.txt", mimeType: "text/plain", buffer: Buffer.from("SECRET FIXTURE CONTENT") });
  await send(page, "Review fixture");
  await expect.poll(() => harness.calls.saves.length).toBe(1);
  expect(harness.calls.saves[0].userMessage).toBe(embedded);
  await expect(page.locator('[data-chat-role="user"]')).not.toContainText("SECRET FIXTURE CONTENT");
  await expect(prompt(page)).toBeEnabled(); await send(page, "Follow-up fixture");
  await expect.poll(() => harness.calls.chat.length).toBe(2);
  expect(harness.calls.chat[1].messages[0].content).toBe(embedded);
  expect(harness.errors).toEqual([]);
});

test("Vault history excludes the current question and stop cancels a delayed answer", async ({ page }) => {
  let release!: () => void;
  const harness = await setup(page, { savedId: 11, ragGate: new Promise((resolve) => { release = resolve; }) });
  await page.goto("/preview/chat"); await expect(assistant(page)).toContainText("Historical answer A.");
  await page.getByRole("button", { name: "Knowledge Vault", exact: true }).click();
  await send(page, "Vault follow-up question");
  await expect.poll(() => harness.calls.rag.length).toBe(1);
  expect(harness.calls.rag[0].conversationHistory).toHaveLength(2);
  expect(harness.calls.rag[0].conversationHistory.some((message: any) => message.content === "Vault follow-up question")).toBe(false);
  await page.getByTitle("Stop Generating", { exact: true }).click();
  release(); await page.waitForLoadState("networkidle");
  await expect(assistant(page)).not.toContainText("Vault fixture answer.");
  expect(harness.calls.saves).toEqual([]); expect(harness.errors).toEqual([]);
});

test("manual dictation puts the transcription into the prompt", async ({ page }) => {
  const harness = await setup(page, { voice: true });
  await page.goto("/preview/chat"); await page.getByTitle("Voice Dictation (Urdu / English)", { exact: true }).click();
  await page.getByRole("button", { name: "Done & Transcribe", exact: true }).click();
  await expect(prompt(page)).toHaveValue("Dictated fixture question"); expect(harness.errors).toEqual([]);
});

test("prompt links prefill without sending and continue working while chat is mounted", async ({ page }) => {
  const harness = await setup(page, { savedId: 11 });
  await page.goto("/preview/chat?q=Fixture%20link&keep=1");
  await expect(prompt(page)).toHaveValue("Fixture link"); expect(harness.calls.loads).toEqual([]);
  await page.evaluate(() => { history.pushState({}, "", "/preview/chat?prompt=Second%20link"); window.dispatchEvent(new PopStateEvent("popstate")); });
  await expect(prompt(page)).toHaveValue("Second link"); expect(harness.calls.chat).toEqual([]); expect(harness.errors).toEqual([]);
});

test("blocked active-thread storage does not prevent chatting", async ({ page }) => {
  const harness = await setup(page, { blockedStorage: true });
  await page.goto("/preview/chat"); await send(page);
  await expect.poll(() => harness.calls.saves.length).toBe(1);
  await expect(prompt(page)).toBeEnabled(); expect(harness.errors).toEqual([]);
});

test("share waits for persistence and clipboard denial reports failure without an unhandled rejection", async ({ page }) => {
  const harness = await setup(page);
  await page.goto("/preview/chat"); await send(page); await expect(prompt(page)).toBeEnabled();
  await expect.poll(() => harness.calls.saves.length).toBe(1);
  await page.getByTitle("Share Consultation URL", { exact: true }).click();
  await expect.poll(() => harness.calls.shares.length).toBe(1); expect(harness.calls.shares).toEqual([33]);
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new DOMException("Denied", "NotAllowedError"); }; });
  await page.getByTitle("Copy Markdown Text", { exact: true }).click();
  await expect(page.getByText("Copy failed", { exact: true })).toBeVisible(); expect(harness.errors).toEqual([]);
});

test("mobile composer stays within the viewport and IME Enter does not submit", async ({ page }, testInfo) => {
  const harness = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/preview/chat");
  await prompt(page).fill("Fixture composition");
  await prompt(page).dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true });
  expect(harness.calls.chat).toEqual([]);
  for (const control of [prompt(page), page.getByTitle("Send Legal Query", { exact: true })]) {
    const box = (await control.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
  }
  await page.screenshot({ path: testInfo.outputPath("chat-mobile.png") }); expect(harness.errors).toEqual([]);
});

test("partial-answer warnings remain attached to saved answers after reload", async ({ page }) => {
  const harness = await setup(page, { body: 'data: {"text":"Partial answer with completion marker"}\n\ndata: {"warning":"Upstream interrupted"}\n\ndata: {"done":true}\n\n' });
  await page.goto("/preview/chat"); await send(page);
  await expect.poll(() => harness.calls.saves.length).toBe(1);
  expect(harness.calls.saves[0].assistantMessage).toContain("Incomplete response: Upstream interrupted");
  await page.reload(); await expect(assistant(page)).toContainText("Incomplete response: Upstream interrupted");
  expect(harness.errors).toEqual([]);
});

test("Vault source attribution survives saving and history restoration", async ({ page }) => {
  const harness = await setup(page);
  await page.goto("/preview/chat"); await page.getByRole("button", { name: "Knowledge Vault", exact: true }).click();
  await send(page, "Vault source question"); await expect(assistant(page)).toContainText("Fixture vault source");
  await expect.poll(() => harness.calls.saves.length).toBe(1);
  expect(harness.calls.saves[0].assistantMessage).toContain("Source fixture quotation");
  await page.reload(); await expect(assistant(page)).toContainText("Knowledge Vault Sources");
  await expect(assistant(page)).toContainText("Source fixture quotation"); expect(harness.errors).toEqual([]);
});

test("a completion event releases a connection even if the server leaves it open", async ({ page }) => {
  const harness = await setup(page);
  await page.addInitScript(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      if (String(input) === "/api/ai/chat") {
        return new Response(new ReadableStream({ start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"text":"Open connection answer"}\n\ndata: {"done":true}\n\n'));
        }, cancel() { (window as any).chatStreamCancelled = true; } }), { headers: { "Content-Type": "text/event-stream" } });
      }
      return original(input, init);
    };
  });
  await page.goto("/preview/chat"); await send(page);
  await expect.poll(() => harness.calls.saves.length).toBe(1);
  expect(await page.evaluate(() => (window as any).chatStreamCancelled)).toBe(true);
  await expect(prompt(page)).toBeEnabled(); expect(harness.errors).toEqual([]);
});

test("retrieved-only precedents are not marked as AI-cited", async ({ page }) => {
  const hit = { citation: "PLD 2024 SC 17", title: "Retrieved fixture", court: "Test Court", snippet: "Fixture excerpt" };
  const harness = await setup(page, { body: `data: ${JSON.stringify({ caseLawCard: { hits: [hit], totalFound: 1, queriesUsed: [] } })}\n\ndata: {"text":"A response with no cited authority."}\n\ndata: {"done":true}\n\n` });
  await page.goto("/preview/chat"); await send(page);
  await page.getByRole("button", { name: "Verified Precedents from Database", exact: false }).click();
  await expect(page.getByText("PLD 2024 SC 17", { exact: true })).toBeVisible();
  await expect(page.getByText("AI Cited", { exact: true })).toHaveCount(0);
  expect(harness.errors).toEqual([]);
});

test("an automatic voice transcription cannot fill a newly started consultation", async ({ page }) => {
  let release!: () => void;
  const harness = await setup(page, { voice: true, voiceGate: new Promise((resolve) => { release = resolve; }) });
  await page.clock.install();
  await page.goto("/preview/chat");
  await page.getByTitle("Voice Dictation (Urdu / English)", { exact: true }).click();
  await page.clock.fastForward(120_000);
  await expect(page.getByText("Transcribing audio with Whisper AI model...", { exact: true })).toBeVisible();
  await page.getByTitle("New Chat", { exact: true }).click();
  await expect(prompt(page)).toBeEnabled();
  release(); await page.waitForLoadState("networkidle");
  await expect(prompt(page)).toHaveValue("");
  expect(harness.errors).toEqual([]);
});
