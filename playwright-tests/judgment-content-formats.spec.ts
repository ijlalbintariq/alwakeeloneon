import { test, expect, type Page } from "@playwright/test";
import { jsPDF } from "jspdf";
import fs from "node:fs/promises";

test.use({ baseURL: process.env.JUDGMENT_TEST_BASE_URL || "http://127.0.0.1:5190", channel: "chrome" });
const id = "11111111-1111-4111-8111-111111111111";
const plain = "Stored judgment text is readable without an original PDF file. ".repeat(8);
const base = { id, citation: "2024 SCMR 1085", title: "Ahmad Khan vs State", court: "Supreme Court", decisionDate: null, headnotes: null, previewText: "", previewWordCount: 0, totalWordCount: 0, isPreview: false, isTruncated: false, citations: { made: [], received: [] }, textIntegrity: "missing", pdfUrl: null };
async function setup(page: Page, record: any, authenticated = false) {
  const pdf = new jsPDF();
  pdf.text("Synthetic judgment PDF for software testing", 15, 20);
  await page.route("**/test-record.pdf", route => route.fulfill({ contentType: "application/pdf", body: Buffer.from(pdf.output("arraybuffer")) }));
  await page.route("**/api/**", route => {
    const pathname = new URL(route.request().url()).pathname;
    let data: any = [];
    if (pathname === "/api/auth/user") data = authenticated ? { id: "format-test", email: "test@example.test", subscriptionTier: "chamber", onboardingCompleted: true } : null;
    else if (pathname === "/api/usage") data = { tier: "chamber", usage: {}, limits: {} };
    else if (pathname.endsWith("/summary")) data = { summary: null };
    else if (pathname.includes(`/judgments/${id}`)) data = record;
    return route.fulfill({ json: data });
  });
  await page.addInitScript(() => localStorage.setItem("aw_tour_completed", "true"));
}

test("public PDF-only judgment exposes original file without a fake text download", async ({ page }) => {
  await setup(page, { ...base, pdfUrl: "/test-record.pdf", contentFormat: "pdf", textWarning: "PDF available. Searchable text has not been verified." });
  await page.goto(`/preview/p/${id}`);
  await expect(page.getByRole("link", { name: "Open original PDF", exact: true })).toHaveAttribute("href", "/test-record.pdf");
  await expect(page.locator('iframe[title="Judgment PDF"]')).toHaveAttribute("src", "/test-record.pdf");
  await expect(page.getByRole("button", { name: "Download text as PDF", exact: true })).toHaveCount(0);
});

test("public text-only judgment remains readable with its verification warning", async ({ page }) => {
  await setup(page, { ...base, previewText: plain, contentFormat: "text", textIntegrity: "unknown", textWarning: "Case identity unverified." });
  await page.goto(`/preview/p/${id}`);
  await expect(page.getByRole("alert")).toContainText("Case identity unverified.");
  await expect(page.getByText(plain.trim(), { exact: true })).toBeVisible();
  await expect(page.locator('iframe[title="Judgment PDF"]')).toHaveCount(0);
});

test("workspace PDF-only judgment keeps original link and reader", async ({ page }) => {
  await setup(page, { ...base, fullText: "", pdfUrl: "/test-record.pdf", contentFormat: "pdf", textWarning: "PDF available." }, true);
  await page.goto(`/preview/judgments/${id}`);
  await expect(page.getByRole("link", { name: "Original PDF", exact: true })).toHaveAttribute("href", "/test-record.pdf");
  await expect(page.locator('iframe[title="Judgment PDF"]')).toHaveAttribute("src", "/test-record.pdf");
  await expect(page.getByRole("button", { name: "Text as PDF", exact: true })).toHaveCount(0);
});

test("text PDF downloads preserve the identity warning", async ({ page }) => {
  await setup(page, { ...base, fullText: plain, contentFormat: "text", textIntegrity: "unknown", textWarning: "IDENTITY_UNVERIFIED" }, true);
  await page.goto(`/preview/judgments/${id}`);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Text as PDF", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/_Database_Text\.pdf$/);
  const content = await fs.readFile((await file.path())!, "utf8");
  expect(content).toContain("IDENTITY_UNVERIFIED");
  expect(content).not.toContain("Authenticated from");
});

test("PDF export rejects a newly blocked record instead of using stale reader text", async ({ page }) => {
  const record = { ...base, fullText: plain, contentFormat: "text", textIntegrity: "own", textWarning: "" };
  await setup(page, record, true);
  await page.goto(`/preview/judgments/${id}`);
  const button = page.getByRole("button", { name: "Text as PDF", exact: true });
  await expect(button).toBeVisible();
  Object.assign(record, { fullText: "", contentFormat: "unavailable", textIntegrity: "unknown", textWarning: "Known identity conflict" });
  let downloads = 0;
  page.on("download", () => downloads++);
  await button.click();
  await expect(page.getByText("Known identity conflict", { exact: true })).toBeVisible();
  expect(downloads).toBe(0);
});
