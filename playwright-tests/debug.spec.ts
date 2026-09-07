import { test, expect } from '@playwright/test';

test('Debug Document Analyzer', async ({ page }) => {
  await page.goto('http://localhost:5001/preview/document-analyzer');
  await page.waitForTimeout(2000);
  const text = await page.locator('body').innerText();
  console.log("BODY TEXT:\n", text);
  console.log("URL:", page.url());
});
