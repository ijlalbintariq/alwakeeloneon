import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { extractText, getDocumentProxy } from "unpdf";

test.use({ baseURL: process.env.DRAFTING_TEST_BASE_URL || "http://localhost:5001", channel: "chrome", viewport: { width: 1600, height: 1000 } });

const seedTab = (id = "a", title = "Audit Draft", text = "Original pleading.") => ({ id, title, category: "General", pageProfileId: "court-legal", htmlContent: `<p>${text}</p>`, textContent: text, lastModified: 1 });

async function setup(page: Page, options: { tabs?: Array<ReturnType<typeof seedTab> & { dbDraftId?: number }>; onSave?: (payload: any, method: string) => Promise<void>; ai?: any; userId?: string; initialDrafts?: any[]; failSaves?: boolean } = {}) {
  const userId = options.userId || "drafting-audit";
  await page.addInitScript(({ tabs, userId }) => {
    localStorage.setItem("aw_tour_completed", "true");
    if (!localStorage.getItem("audit-initialized")) {
      localStorage.setItem("audit-initialized", "true");
      localStorage.setItem(`alwakeelo_drafting_tabs_v1:${userId}`, JSON.stringify({ tabs, activeTabId: tabs[0].id }));
    }
  }, { tabs: options.tabs || [seedTab()], userId });
  const saves: Array<{ method: string; payload: any; id: number }> = [];
  const aiRequests: any[] = [];
  const drafts = new Map<number, any>((options.initialDrafts || []).map((draft) => [draft.id, draft]));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    let body: any = [];
    if (url.pathname === "/api/auth/user") body = { id: userId, email: "audit@example.test", firstName: "Audit", tier: "chamber", onboardingCompleted: true };
    else if (url.pathname === "/api/style-memory/settings") body = { module: "legal-drafting", enabled: true, ownershipMode: "user-org", strictness: method === "PUT" ? request.postDataJSON().strictness || "balanced" : "balanced", sampleCounts: { upload: 0, savedDraft: 0, acceptedRedline: 0, total: 0 } };
    else if (url.pathname === "/api/style-memory/samples") body = { items: [] };
    else if (url.pathname === "/api/usage") body = { tier: "chamber", usage: {}, limits: {} };
    else if (url.pathname === "/api/drafts" && method === "GET") body = [...drafts.values()];
    else if (url.pathname.startsWith("/api/drafts") && ["POST", "PATCH"].includes(method)) {
      if (options.failSaves) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Database unavailable" }) });
        return;
      }
      const payload = request.postDataJSON();
      const id = method === "POST" ? drafts.size + 1 : Number(url.pathname.split("/").pop());
      saves.push({ method, payload, id });
      await options.onSave?.(payload, method);
      body = { ...payload, id, updatedAt: new Date().toISOString() };
      drafts.set(id, body);
    } else if (url.pathname.startsWith("/api/drafts/") && method === "DELETE") {
      drafts.delete(Number(url.pathname.split("/").pop()));
      body = { message: "Deleted" };
    } else if (url.pathname === "/api/retrieval/clauses/generate") {
      aiRequests.push(request.postDataJSON());
      body = options.ai || { operation: "full-rewrite", clause: "Revised pleading.", assistantMessage: "Proposed revision." };
    } else if (url.pathname === "/api/ai/drafting/generate") body = { textContent: "" };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  return { saves, aiRequests, drafts, errors };
}

async function openEditor(page: Page) {
  await page.goto("/preview/drafting");
  await page.getByRole("button", { name: /Return to Active Draft/ }).click();
  await expect(page.locator(".tiptap")).toBeVisible();
}

async function sendPrompt(page: Page, prompt = "Rewrite this whole pleading") {
  await page.getByPlaceholder("Command AI to draft or amend", { exact: false }).fill(prompt);
  await page.getByPlaceholder("Command AI to draft or amend", { exact: false }).press("Enter");
}

test("edits made during a create are saved with PATCH and survive reload", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const harness = await setup(page, { onSave: async (_payload, method) => { if (method === "POST") await gate; } });
  await openEditor(page);
  await expect.poll(() => harness.saves.length).toBe(1);
  await page.locator(".tiptap").fill("Latest edits made during save.");
  // Let the second autosave enqueue while the create is still in flight.
  await page.waitForTimeout(1700);
  expect(harness.saves).toHaveLength(1);
  release();
  await expect.poll(() => harness.saves.filter((save) => save.method === "PATCH").length).toBeGreaterThan(0);
  expect(harness.saves.filter((save) => save.method === "POST")).toHaveLength(1);
  expect(harness.saves.at(-1)?.payload.metadata.textContent).toBe("Latest edits made during save.");
  await page.reload();
  await page.getByRole("button", { name: /Return to Active Draft/ }).click();
  await expect(page.locator(".tiptap")).toHaveText("Latest edits made during save.");
  expect(harness.errors).toEqual([]);
});

test("launchpad templates autosave without requiring a keystroke and retain filing type", async ({ page }) => {
  const harness = await setup(page);
  await page.goto("/preview/drafting");
  await page.getByText("Constitutional Writ Petition (Art. 199)", { exact: true }).click();
  await expect(page.locator(".tiptap")).toContainText(/P\s*R\s*A\s*Y\s*E\s*R/);
  await expect.poll(() => harness.saves.some((save) => save.payload.metadata.documentType === "high-court-writ-petition")).toBe(true);
  expect(harness.errors).toEqual([]);
});

test("a URL citation is inserted while the editor is hidden and HTML stays literal", async ({ page }) => {
  const harness = await setup(page);
  const cite = 'PLD 2023 SC 145 <img src=x onerror=alert(1)>';
  await page.goto(`/preview/drafting?cite=${encodeURIComponent(cite)}`);
  await expect(page.locator(".tiptap")).toContainText(cite);
  await expect(page.locator(".tiptap img")).toHaveCount(0);
  await expect.poll(() => harness.saves.some((save) => save.payload.metadata.textContent.includes(cite))).toBe(true);
  expect(harness.errors).toEqual([]);
});

test("whole-document AI reviews cannot overwrite newer edits", async ({ page }) => {
  const harness = await setup(page);
  await openEditor(page);
  await sendPrompt(page);
  await expect(page.getByRole("button", { name: "Accept & Apply All" })).toBeVisible();
  await page.locator(".tiptap").fill("Newer manual pleading edits.");
  await page.getByRole("button", { name: "Accept & Apply All" }).click();
  await expect(page.locator(".tiptap")).toHaveText("Newer manual pleading edits.");
  await expect(page.getByText("Draft Has Changed", { exact: true })).toBeVisible();
  expect(harness.errors).toEqual([]);
});

test("AI reviews are isolated between tabs and can be restored in their own tab", async ({ page }) => {
  const harness = await setup(page, { tabs: [seedTab(), seedTab("b", "Other Draft", "Other document.")] });
  await openEditor(page);
  await sendPrompt(page);
  await expect(page.getByRole("button", { name: "Accept & Apply All" })).toBeVisible();
  await page.getByText("Other Draft", { exact: true }).click();
  await expect(page.locator(".tiptap")).toHaveText("Other document.");
  await expect(page.getByRole("button", { name: "Accept & Apply All" })).toHaveCount(0);
  await page.getByText("Audit Draft", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Accept & Apply All" })).toBeVisible();
  // Restoring the same unchanged document must not invalidate its own review.
  await page.getByRole("button", { name: "Accept & Apply All" }).click();
  await expect(page.locator(".tiptap")).toHaveText("Revised pleading.");
  expect(harness.errors).toEqual([]);
});

test("standalone AI clauses insert without replacing the pleading", async ({ page }) => {
  const harness = await setup(page, { ai: { operation: "clause", clause: "Additional clause.", assistantMessage: "Proposed clause." } });
  await openEditor(page);
  await page.locator(".tiptap").press("ControlOrMeta+End");
  await sendPrompt(page, "Add a clause");
  await page.getByRole("button", { name: "Accept & Insert" }).click();
  await expect(page.locator(".tiptap")).toContainText("Original pleading.");
  await expect(page.locator(".tiptap")).toContainText("Additional clause.");
  await expect.poll(() => harness.saves.some((save) => save.payload.metadata.textContent.includes("Additional clause."))).toBe(true);
  expect(harness.errors).toEqual([]);
});

test("paper settings persist and generated PDF/DOCX files download", async ({ page }, testInfo) => {
  const htmlContent = '<h1 style="text-align:center">DRAFTING EXPORT AUDIT</h1><p>First page text with <strong>bold emphasis</strong> and authority <span data-type="citation" citation="PLD 2023 SC 145"></span>.</p><table><tbody><tr><th>Item</th><th>Details</th></tr><tr><td>A</td><td>Audit table row</td></tr></tbody></table><div data-type="legal-page-break" data-page-break="true"></div><h2>SECOND PAGE</h2><p>Final audit paragraph.</p>';
  const harness = await setup(page, { tabs: [{ ...seedTab(), htmlContent, textContent: "DRAFTING EXPORT AUDIT\nFirst page text with bold emphasis and authority PLD 2023 SC 145.\nItem Details A Audit table row\nSECOND PAGE\nFinal audit paragraph." }] });
  await openEditor(page);
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByRole("combobox", { name: "Court Paper Format" }).selectOption("a4");
  await expect.poll(() => harness.saves.some((save) => save.payload.metadata.pageProfileId === "a4")).toBe(true);
  await page.getByRole("button", { name: /Export/ }).click();
  for (const format of ["pdf", "docx"] as const) {
    if (format === "docx") {
      await page.getByRole("button", { name: /Export/ }).click();
      await page.getByRole("button", { name: /Microsoft Word/ }).click();
    }
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: `Download ${format.toUpperCase()}`, exact: true }).click();
    const file = testInfo.outputPath(`drafting-audit.${format}`);
    await (await download).saveAs(file);
    if (format === "pdf") {
      const pdf = await getDocumentProxy(new Uint8Array(readFileSync(file)));
      const extracted = await extractText(pdf, { mergePages: true });
      expect(extracted.totalPages).toBe(2);
      expect(extracted.text.match(/\bPage\b/g)).toHaveLength(2);
      expect(extracted.text).toContain("PLD 2023 SC 145");
      const content = await (await pdf.getPage(1)).getTextContent();
      const items = content.items.filter((item): item is Extract<typeof item, { str: string }> => "str" in item);
      const normal = items.find((item) => item.str.includes("First page"));
      const bold = items.find((item) => item.str.includes("bold emphasis"));
      expect(normal).toBeDefined();
      expect(bold).toBeDefined();
      expect(normal!.fontName).not.toBe(bold!.fontName);
      await pdf.destroy();
    }
  }
  expect(harness.errors).toEqual([]);
});

test("closing a draft during a save failure keeps its content open", async ({ page }) => {
  const harness = await setup(page, { tabs: [seedTab(), seedTab("b", "Other Draft", "Other document.")], failSaves: true });
  await openEditor(page);
  await page.locator(".tiptap").fill("Unsaved pleading must be retained.");
  await page.getByRole("button", { name: "Close Audit Draft", exact: true }).click();
  await expect(page.getByText("Draft Kept Open", { exact: true })).toBeVisible();
  await expect(page.locator(".tiptap")).toHaveText("Unsaved pleading must be retained.");
  expect(harness.errors).toEqual([]);
});

test("a document link with a citation inserts into the requested saved draft", async ({ page }) => {
  const harness = await setup(page, { initialDrafts: [{ id: 17, title: "Saved Target", content: "<p>Target pleading.</p>", templateType: "General", metadata: { textContent: "Target pleading.", pageProfileId: "a4", documentType: "affidavit" } }] });
  await page.goto("/preview/drafting?docId=17&cite=PLD%202023%20SC%20145");
  await expect(page.locator(".tiptap")).toContainText("Target pleading.");
  await expect(page.locator(".tiptap")).toContainText("PLD 2023 SC 145");
  await expect.poll(() => harness.saves.some((save) => save.id === 17 && save.payload.metadata.textContent.includes("PLD 2023 SC 145"))).toBe(true);
  expect(harness.errors).toEqual([]);
});

test("a saved-document link resumes the existing active tab directly", async ({ page }) => {
  const saved = { id: 17, title: "Audit Draft", content: "<p>Original pleading.</p>", metadata: { textContent: "Original pleading." } };
  const harness = await setup(page, { tabs: [{ ...seedTab(), dbDraftId: 17 }], initialDrafts: [saved] });
  await page.goto("/preview/drafting?docId=17");
  await expect(page.locator(".tiptap")).toHaveText("Original pleading.");
  await expect(page.getByRole("button", { name: "Close Audit Draft", exact: true })).toHaveCount(1);
  expect(harness.errors).toEqual([]);
});

test("an empty table autosaves without a text keystroke", async ({ page }) => {
  const harness = await setup(page, { tabs: [{ ...seedTab(), textContent: "", htmlContent: "<table><tbody><tr><td><p></p></td></tr></tbody></table>" }] });
  await openEditor(page);
  await expect.poll(() => harness.saves.some((save) => save.payload.content.includes("<table>"))).toBe(true);
  expect(harness.errors).toEqual([]);
});

test("a targeted AI edit changes only the selected passage", async ({ page }) => {
  const tab = { ...seedTab(), htmlContent: "<p>Keep before.</p><p>Original pleading.</p><p>Keep after.</p>", textContent: "Keep before.\n\nOriginal pleading.\n\nKeep after." };
  const harness = await setup(page, { tabs: [tab], ai: { operation: "targeted-edit", clause: "Keep before.\n\nImproved passage.\n\nKeep after.", replacementSnippet: "Improved passage." } });
  await openEditor(page);
  await page.evaluate(() => {
    const paragraph = document.querySelectorAll(".tiptap p")[1];
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
  await expect(page.getByText(/Target Locked:/)).toBeVisible();
  await sendPrompt(page, "Improve the selected text");
  await page.getByRole("button", { name: "Accept & Replace", exact: true }).click();
  await expect(page.locator(".tiptap")).toContainText("Keep before.");
  await expect(page.locator(".tiptap")).toContainText("Improved passage.");
  await expect(page.locator(".tiptap")).toContainText("Keep after.");
  await expect(page.locator(".tiptap")).not.toContainText("Original pleading.");
  expect(harness.aiRequests[0].selectedSnippet).toBe("Original pleading.");
  expect(harness.errors).toEqual([]);
});

test("small screens keep the canvas usable and tools can be closed", async ({ page }) => {
  const harness = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page);
  const canvas = page.locator("main").last();
  expect((await canvas.boundingBox())!.width).toBeGreaterThan(350);
  await page.getByRole("button", { name: "AI & Tools", exact: true }).click();
  await expect(page.getByPlaceholder("Command AI to draft or amend", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Close Sidebar", exact: true }).click();
  await page.locator(".tiptap").fill("Written on a small screen.");
  await expect(page.locator(".tiptap")).toHaveText("Written on a small screen.");
  expect(harness.errors).toEqual([]);
});

for (const width of [1600, 390]) {
  test(`selection AI actions stay visible above formatting tools at ${width}px`, async ({ page }) => {
    const paragraphs = Array.from({ length: 60 }, (_, index) => `<p>Legal drafting paragraph ${index} for selection and scrolling.</p>`).join("");
    const harness = await setup(page, { tabs: [{ ...seedTab(), htmlContent: paragraphs, textContent: "Legal drafting paragraphs" }] });
    await page.setViewportSize({ width, height: 1000 });
    await openEditor(page);
    await page.evaluate(() => {
      const paragraph = document.querySelector(".tiptap p")!;
      const range = document.createRange();
      range.selectNodeContents(paragraph);
      window.getSelection()!.removeAllRanges();
      window.getSelection()!.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
    const actions = page.getByRole("toolbar", { name: "AI actions for selected text" });
    await expect(actions).toBeVisible();
    for (const name of [/Polish/, /Shorten/, /Expand/, /Court Tone/, /Ask AI/]) {
      await expect(actions.getByRole("button", { name })).toBeInViewport();
    }
    await page.locator("[data-editor-width]").evaluate((element) => { element.scrollTop = 350; });
    const actionBox = (await actions.boundingBox())!;
    const formattingBox = (await page.locator(".legal-editor-toolbar").boundingBox())!;
    expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(formattingBox.y);
    const polish = actions.getByRole("button", { name: /Polish/ });
    expect(await polish.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    })).toBe(true);
    await polish.click();
    await expect.poll(() => harness.aiRequests.length).toBe(1);
    expect(harness.aiRequests[0].selectedSnippet).toBe("Legal drafting paragraph 0 for selection and scrolling.");
    expect(harness.errors).toEqual([]);
  });
}

test("print preview includes the document without workstation controls", async ({ page }) => {
  const harness = await setup(page);
  await page.addInitScript(() => {
    document.addEventListener("load", (event) => {
      const frame = event.target;
      if (frame instanceof HTMLIFrameElement && frame.title === "Document print preview") {
        frame.contentWindow!.print = () => { (window as any).auditPrintHtml = frame.contentDocument!.documentElement.outerHTML; };
      }
    }, true);
  });
  await openEditor(page);
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByRole("button", { name: /Export Pleading/ }).click();
  await page.getByRole("button", { name: /Direct Print Preview/ }).click();
  await page.getByRole("button", { name: "Open Print Dialog", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).auditPrintHtml || "")).toContain("Original pleading.");
  const printed = await page.evaluate(() => (window as any).auditPrintHtml as string);
  expect(printed).not.toContain("Saved Drafts");
  expect(printed).not.toContain("Command AI");
  expect(harness.errors).toEqual([]);
});

test("style settings load and update using the legal-drafting module", async ({ page }) => {
  const harness = await setup(page);
  await openEditor(page);
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  const strictness = page.getByLabel("Strictness", { exact: false });
  await expect(strictness).toBeEnabled();
  const saved = page.waitForRequest((request) => request.url().includes("/api/style-memory/settings") && request.method() === "PUT");
  await strictness.selectOption("strict");
  expect((await saved).postDataJSON()).toMatchObject({ module: "legal-drafting", strictness: "strict", scope: "user" });
  await expect(strictness).toHaveValue("strict");
  expect(harness.errors).toEqual([]);
});

test("an empty AI brief response leaves the current document available", async ({ page }) => {
  const harness = await setup(page);
  await page.goto("/preview/drafting");
  await page.getByPlaceholder(/Describe the timeline/i).fill("A detailed factual summary for testing.");
  await page.getByRole("button", { name: /Initialize/i }).click();
  await expect(page.getByText("No draft text was returned. Please try again.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Return to Active Draft/ }).click();
  await expect(page.locator(".tiptap")).toHaveText("Original pleading.");
  expect(harness.errors).toEqual([]);
});

test("PDF table rows split across pages without text falling below the paper", async ({ page }, testInfo) => {
  const words = Array.from({ length: 1600 }, (_, index) => `word${index}`).join(" ");
  const harness = await setup(page, { tabs: [{ ...seedTab(), htmlContent: `<table><tbody><tr><th>Long clause</th></tr><tr><td>${words}</td></tr></tbody></table>`, textContent: words }] });
  await openEditor(page);
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByRole("button", { name: /Export Pleading/ }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const file = testInfo.outputPath("long-table.pdf");
  await (await download).saveAs(file);
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(file)));
  expect(pdf.numPages).toBeGreaterThan(1);
  const extracted = await extractText(pdf, { mergePages: true });
  expect(extracted.text).toContain("word1599");
  for (let number = 1; number <= pdf.numPages; number++) {
    const content = await (await pdf.getPage(number)).getTextContent();
    for (const item of content.items) if ("str" in item && item.str.trim()) expect(item.transform[5]).toBeGreaterThan(0);
  }
  await pdf.destroy();
  expect(harness.errors).toEqual([]);
});
