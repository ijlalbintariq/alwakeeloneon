import { test, expect, type Page, type Locator } from "@playwright/test";

test.use({ baseURL: process.env.GRAPH_TEST_BASE_URL || "http://localhost:5001", channel: "chrome", viewport: { width: 1600, height: 1000 } });
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const edge = (id: number, citation: string, type: string, target: string | number | null, title: string) => ({ id, citationText: citation, linkedCitation: citation, citationType: type, linkedJudgmentId: target, linkedTitle: title, contextExcerpt: `Synthetic excerpt for ${title}.` });
const detail = (id: string, citation: string, title: string, made: any[] = [], received: any[] = []) => ({ id, citation, title, court: "Test Court", decisionDate: "2026-01-01", fullText: "Synthetic judgment body for software verification.", headnotes: "Synthetic headnotes.", citations: { made, received } });

async function setup(page: Page, options: { many?: boolean; slowB?: Promise<void>; missingB?: boolean } = {}) {
  const made = options.many ? Array.from({ length: 35 }, (_, index) => edge(index, `2020 SCMR ${1000 + index}`, "referred_to", null, `Large graph ${index}`)) : [
    edge(1, "2023 SCMR 58", "followed", B, "Outgoing fixture"),
    edge(2, "PLD 2020 Lahore 41", "REVERSED", null, "Negative fixture"),
    edge(3, "2022 PCRLJ 66", "explained", 7, "Explained fixture"),
  ];
  const records: Record<string, any> = {
    [A]: detail(A, "2026 SCMR 99", "Anchor fixture", made, [edge(1, "PLD 2024 SC 17", "approved", C, "Incoming fixture"), edge(4, "2025 CLC 18", "disapproved", null, "Disapproved fixture")]),
    [B]: detail(B, "2023 SCMR 58", "Outgoing fixture"),
    [C]: detail(C, "PLD 2024 SC 17", "Incoming fixture"),
    "7": detail("7", "2022 PCRLJ 66", "Explained fixture"),
    "44444444-4444-4444-8444-444444444444": detail("44444444-4444-4444-8444-444444444444", "PLD 1955 FC 240", "Untreated fixture"),
  };
  records[C].treatment = "reversed";
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => { localStorage.setItem("aw_tour_completed", "true"); });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    let body: any = [];
    if (url.pathname === "/api/auth/user") body = { id: "graph-audit", firstName: "Graph", email: "graph@example.test", subscriptionTier: "chamber", onboardingCompleted: true };
    else if (url.pathname === "/api/usage") body = { tier: "chamber", usage: {}, limits: {} };
    else if (url.pathname.endsWith("/summary")) body = { summary: null };
    else if (/^\/api\/(?:public\/)?judgments\//.test(url.pathname)) {
      const id = decodeURIComponent(url.pathname.split("/").pop()!);
      requests.push(id);
      if (id === B) await options.slowB;
      body = id === B && options.missingB ? null : records[id] || Object.values(records).find((record) => record.citation.replace(/\s+/g, "-") === id);
      if (!body) return route.fulfill({ status: 404, json: { message: "Not found" } });
    } else if (url.pathname === "/api/case-law/search") body = Object.values(records).map((record: any) => ({ id: record.id, citation: record.citation, title: record.title, court: record.court, treatment: record.treatment, isOverruled: record.isOverruled }));
    else if (url.pathname === "/api/case-law/lookup") body = { found: false };
    await route.fulfill({ status: 200, json: body });
  });
  return { requests, errors, records };
}

async function openGraph(page: Page) {
  await page.goto(`/preview/judgments/${A}`);
  const graph = page.getByRole("region", { name: "Precedent graph for 2026 SCMR 99", exact: true });
  await expect(graph).toBeVisible();
  await graph.scrollIntoViewIfNeeded();
  return graph;
}

const node = (graph: Locator, citation: string) => graph.locator('g[data-graph-node="true"]').filter({ hasText: citation });

test("treatment aliases filter correctly in graph and list views and search trims spaces", async ({ page }) => {
  const harness = await setup(page);
  const graph = await openGraph(page);
  await expect(graph.getByText("5 Links", { exact: true })).toBeVisible();
  await graph.getByRole("button", { name: "Relied Upon", exact: true }).click();
  await expect(graph.locator('g[data-graph-node="true"]')).toHaveCount(2);
  await graph.getByRole("button", { name: "Negative", exact: true }).click();
  await expect(graph.locator('g[data-graph-node="true"]')).toHaveCount(2);
  await graph.getByRole("button", { name: "Distinguished", exact: true }).click();
  await expect(graph.locator('g[data-graph-node="true"]')).toHaveCount(1);
  await graph.getByRole("button", { name: "All", exact: true }).click();
  const search = graph.getByPlaceholder("Filter graph nodes by citation/title...");
  await search.fill("  2023 SCMR 58  ");
  await expect(graph.locator('g[data-graph-node="true"]')).toHaveCount(1);
  await graph.getByTitle("Precedent List Matrix").click();
  await expect(search).toBeVisible();
  await search.fill("no such precedent");
  await expect(graph.getByRole("status")).toHaveText("No citation links match the current filters.");
  await search.clear();
  await expect(graph.getByText("Outgoing fixture", { exact: true })).toBeVisible();
  expect(harness.errors).toEqual([]);
});

test("opposite-direction nodes with the same edge ID select independently and hidden nodes clear", async ({ page }) => {
  const harness = await setup(page);
  const graph = await openGraph(page);
  await node(graph, "2023 SCMR 58").locator("rect").click();
  await expect(graph.getByText("Outgoing fixture", { exact: true })).toBeVisible();
  await node(graph, "PLD 2024 SC 17").locator("rect").click();
  await expect(graph.getByText("Incoming fixture", { exact: true })).toBeVisible();
  expect(page.url()).toContain(A);
  await graph.getByRole("button", { name: "Negative", exact: true }).click();
  await expect(graph.getByRole("button", { name: "Open Judgment", exact: true })).toHaveCount(0);
  expect(harness.errors).toEqual([]);
});

test("double-click opens a precedent once and numeric judgment targets work", async ({ page }) => {
  const harness = await setup(page);
  const graph = await openGraph(page);
  await node(graph, "2023 SCMR 58").locator("rect").dblclick();
  await expect(page).toHaveURL(new RegExp(B));
  await expect(page.getByRole("region", { name: "Precedent graph for 2023 SCMR 58", exact: true })).toBeVisible();
  expect(harness.requests.filter((id) => id === B)).toHaveLength(1);
  await page.goto(`/preview/judgments/${A}`);
  await node(graph, "2022 PCRLJ 66").focus();
  await node(graph, "2022 PCRLJ 66").press("Enter");
  await graph.getByRole("button", { name: "Open Judgment", exact: true }).click();
  await expect(page).toHaveURL(/\/preview\/judgments\/7$/);
  expect(harness.errors).toEqual([]);
});

test("fullscreen escapes its parent and closes with Escape", async ({ page }) => {
  const harness = await setup(page);
  const graph = await openGraph(page);
  await graph.getByTitle("Fullscreen Graph").click();
  await expect.poll(async () => (await graph.boundingBox())!.width).toBeGreaterThan(1500);
  expect(await graph.evaluate((element) => element.parentElement === document.body)).toBe(true);
  await expect(graph.getByTitle("Exit Fullscreen")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(graph.getByTitle("Fullscreen Graph")).toBeVisible();
  expect(await graph.evaluate((element) => element.parentElement === document.body)).toBe(false);
  expect(harness.errors).toEqual([]);
});

test("citation arrows point from citing judgments to the cited authority", async ({ page }) => {
  const harness = await setup(page);
  const graph = await openGraph(page);
  for (const citation of ["2023 SCMR 58", "PLD 2024 SC 17"]) {
    const arrow = node(graph, citation).locator("path").first();
    await expect(arrow).toHaveAttribute("marker-end", /url\(#/);
    expect(await arrow.evaluate((element: SVGPathElement) => {
      const start = element.getPointAtLength(0);
      const end = element.getPointAtLength(element.getTotalLength());
      return end.x < start.x;
    })).toBe(true);
  }
  expect(harness.errors).toEqual([]);
});

test("mobile treatment controls remain inside the viewport", async ({ page }, testInfo) => {
  const harness = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const graph = await openGraph(page);
  for (const name of ["All", "Relied Upon", "Distinguished", "Negative", "Referred"]) {
    const control = graph.getByRole("button", { name, exact: true });
    await control.scrollIntoViewIfNeeded();
    const box = (await control.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  }
  await page.screenshot({ path: testInfo.outputPath("graph-mobile.png") });
  expect(harness.errors).toEqual([]);
});

test("an older graph request cannot replace a newer modal or reopen it after closing", async ({ page }) => {
  let release!: () => void;
  const slowB = new Promise<void>((resolve) => { release = resolve; });
  const harness = await setup(page, { slowB });
  await page.goto("/preview/judgments");
  await page.locator("div.group").filter({ has: page.getByText("Outgoing fixture", { exact: true }) }).getByRole("button", { name: "View Graph", exact: true }).click();
  await expect.poll(() => harness.requests.includes(B)).toBe(true);
  await page.locator("div.group").filter({ has: page.getByText("Incoming fixture", { exact: true }) }).getByRole("button", { name: "View Graph", exact: true }).click();
  await expect(page.getByText("Precedent Citation Graph: PLD 2024 SC 17", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close precedent graph", exact: true }).click();
  const pending = page.waitForResponse((response) => response.url().endsWith(`/api/judgments/${B}`));
  release();
  await pending;
  await expect(page.getByRole("button", { name: "Close precedent graph", exact: true })).toHaveCount(0);
  expect(harness.errors).toEqual([]);
});

test("a failed graph-detail request reports a loading error rather than an empty network", async ({ page }) => {
  const harness = await setup(page, { missingB: true });
  await page.goto("/preview/judgments");
  await page.locator("div.group").filter({ has: page.getByText("Outgoing fixture", { exact: true }) }).getByRole("button", { name: "View Graph", exact: true }).click();
  await expect(page.getByText("Graph Loading Failed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close precedent graph", exact: true })).toHaveCount(0);
  expect(harness.errors).toEqual([]);
});

test("negative-treatment badges require record metadata rather than a hardcoded citation", async ({ page }) => {
  const harness = await setup(page);
  await page.goto("/preview/judgments");
  const untreated = page.locator("div.group").filter({ has: page.getByText("Untreated fixture", { exact: true }) });
  await expect(untreated).toBeVisible();
  await expect(untreated.getByText("Overruled Authority", { exact: true })).toHaveCount(0);
  await expect(untreated.getByText("Good Law", { exact: true })).toHaveCount(0);
  await expect(untreated.getByText("No adverse treatment recorded", { exact: true })).toBeVisible();
  const reversed = page.locator("div.group").filter({ has: page.getByText("Incoming fixture", { exact: true }) });
  await expect(reversed.getByText("Negative Treatment", { exact: true })).toBeVisible();
  await expect(reversed.getByText("Overruled Authority", { exact: true })).toHaveCount(0);
  expect(harness.errors).toEqual([]);
});

test("recorded treatment labels stay precise and list navigation supports the keyboard", async ({ page }) => {
  const harness = await setup(page);
  const graph = await openGraph(page);
  await expect(node(graph, "PLD 2020 Lahore 41")).toContainText("REVERSED");
  await expect(node(graph, "2022 PCRLJ 66")).toContainText("EXPLAINED");
  await expect(page.getByText("NEGATIVE PRECEDENT TREATMENT", { exact: true })).toBeVisible();
  await expect(page.getByText("NEGATIVE PRECEDENT WARNING: OVERRULED", { exact: true })).toHaveCount(0);
  await graph.getByTitle("Precedent List Matrix").click();
  await graph.getByRole("button").filter({ has: page.getByText("Outgoing fixture", { exact: true }) }).press("Enter");
  await expect(page).toHaveURL(new RegExp(B));
  expect(harness.requests.filter((id) => id === B)).toHaveLength(1);
  expect(harness.errors).toEqual([]);
});

test("panning at a non-default zoom tracks the pointer without multiplying its distance", async ({ page }) => {
  const harness = await setup(page);
  const graph = await openGraph(page);
  await graph.getByTitle("Zoom In", { exact: true }).click();
  await graph.getByTitle("Zoom In", { exact: true }).click();
  const canvas = graph.getByTestId("precedent-graph-canvas");
  const svg = canvas.locator(":scope > svg");
  const before = (await svg.boundingBox())!;
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 12, box.y + 12);
  await page.mouse.down();
  await page.mouse.move(box.x + 42, box.y + 27);
  await page.mouse.up();
  const after = (await svg.boundingBox())!;
  expect(after.x - before.x).toBeCloseTo(30, 0);
  expect(after.y - before.y).toBeCloseTo(15, 0);
  expect(harness.errors).toEqual([]);
});

test("large graphs retain readable node dimensions and allow scrolling", async ({ page }) => {
  const harness = await setup(page, { many: true });
  const graph = await openGraph(page);
  const canvas = graph.getByTestId("precedent-graph-canvas");
  expect(await canvas.evaluate((element) => element.scrollHeight > element.clientHeight + 1000)).toBe(true);
  const last = node(graph, "2020 SCMR 1034").locator("rect");
  await last.scrollIntoViewIfNeeded();
  expect((await last.boundingBox())!.width).toBeGreaterThanOrEqual(130);
  await expect(last).toBeInViewport();
  expect(harness.errors).toEqual([]);
});

test("a slower previous judgment response cannot overwrite the newly selected judgment", async ({ page }) => {
  let release!: () => void;
  const slowB = new Promise<void>((resolve) => { release = resolve; });
  const harness = await setup(page, { slowB });
  const graph = await openGraph(page);
  await node(graph, "2023 SCMR 58").locator("rect").click();
  await graph.getByRole("button", { name: "Open Judgment", exact: true }).click();
  await expect.poll(() => harness.requests.includes(B)).toBe(true);
  await page.evaluate((id) => { history.pushState({}, "", `/preview/judgments/${id}`); window.dispatchEvent(new PopStateEvent("popstate")); }, C);
  await expect(page.getByRole("region", { name: "Precedent graph for PLD 2024 SC 17", exact: true })).toBeVisible();
  release();
  await page.waitForResponse((response) => response.url().endsWith(`/api/judgments/${B}`));
  await expect(page.getByRole("region", { name: "Precedent graph for PLD 2024 SC 17", exact: true })).toBeVisible();
  expect(harness.errors).toEqual([]);
});

test("returning to the list cancels a pending judgment load immediately", async ({ page }) => {
  let release!: () => void;
  const harness = await setup(page, { slowB: new Promise<void>((resolve) => { release = resolve; }) });
  await page.goto(`/preview/judgments/${B}`);
  await expect.poll(() => harness.requests.includes(B)).toBe(true);
  await page.evaluate(() => { history.pushState({}, "", "/preview/judgments"); window.dispatchEvent(new PopStateEvent("popstate")); });
  await expect(page.getByText("Loading judgment precedent record & citation graph...", { exact: true })).toHaveCount(0);
  release();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("region", { name: "Precedent graph for 2023 SCMR 58", exact: true })).toHaveCount(0);
  expect(harness.errors).toEqual([]);
});

test("a citation-slug route resolves once to the canonical judgment without reloading", async ({ page }) => {
  const harness = await setup(page);
  await page.goto("/preview/judgments/2026-SCMR-99");
  await expect(page.getByRole("region", { name: "Precedent graph for 2026 SCMR 99", exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(harness.requests).toEqual(["2026-SCMR-99"]);
  expect(harness.errors).toEqual([]);
});

test("returning to the previous judgment cancels an unfinished next judgment", async ({ page }) => {
  let release!: () => void;
  const harness = await setup(page, { slowB: new Promise<void>((resolve) => { release = resolve; }) });
  const graph = await openGraph(page);
  await node(graph, "2023 SCMR 58").locator("rect").dblclick();
  await expect.poll(() => harness.requests.includes(B)).toBe(true);
  await page.goBack();
  await expect(graph).toBeVisible();
  release();
  await page.waitForLoadState("networkidle");
  await expect(graph).toBeVisible();
  await expect(page).toHaveURL(new RegExp(A));
  expect(harness.errors).toEqual([]);
});

test("navigating away cancels a pending graph modal request", async ({ page }) => {
  let release!: () => void;
  const harness = await setup(page, { slowB: new Promise<void>((resolve) => { release = resolve; }) });
  await page.goto("/preview/judgments");
  await page.locator("div.group").filter({ has: page.getByText("Outgoing fixture", { exact: true }) }).getByRole("button", { name: "View Graph", exact: true }).click();
  await expect.poll(() => harness.requests.includes(B)).toBe(true);
  await page.locator("div.group").filter({ has: page.getByText("Anchor fixture", { exact: true }) }).getByRole("button", { name: "Read Case", exact: true }).click();
  await expect(page.getByRole("region", { name: "Precedent graph for 2026 SCMR 99", exact: true })).toBeVisible();
  release();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "Close precedent graph", exact: true })).toHaveCount(0);
  expect(harness.errors).toEqual([]);
});
