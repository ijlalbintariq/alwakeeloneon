import { test, expect } from '@playwright/test';

test('Real User Legal Drafting Flow', async ({ page }) => {
  test.setTimeout(45000); 

  await page.goto('http://localhost:5001/preview/auth');

  await page.route('/api/auth/user', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 9999, email: 'test_chamber@alwakeelo.com', firstName: 'Advocate', lastName: 'Test', tier: 'chamber', onboardingCompleted: true 
      })
    });
  });

  await page.evaluate(() => {
    localStorage.setItem('alwakeelo_preview_auth', 'true');
  });

  await page.goto('http://localhost:5001/preview/drafting');
  
  const blankBtn = page.locator('button', { hasText: 'Blank Court Sheet' }).first();
  await expect(blankBtn).toBeVisible({ timeout: 10000 });
  await blankBtn.click();
  
  const editor = page.locator('.tiptap').first(); 
  await expect(editor).toBeVisible({ timeout: 10000 });

  const searchInput = page.getByPlaceholder(/Command AI to draft or amend/);
  await expect(searchInput).toBeVisible();
  
  const legalQuery = "Draft a complete Bail Application under Section 497 CrPC for a client accused of Section 302 PPC. Include prayer clause.";
  await searchInput.fill(legalQuery);
  
  await page.route('/api/retrieval/clauses/generate', async route => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        clause: "IN THE COURT OF SESSIONS JUDGE, LAHORE\n\nBail Application No. _____ of 2026\n\nState vs. Client Name\nFIR No. 123/2026, U/S 302 PPC, P.S. Model Town\n\nAPPLICATION FOR POST-ARREST BAIL UNDER SECTION 497 Cr.P.C.\n\nRespectfully Sheweth,\n1. That the applicant has been falsely implicated in the aforementioned FIR.\n2. That there is no direct evidence connecting the applicant with the alleged offense.\n\nPRAYER\nIt is therefore prayed that the applicant may be granted post-arrest bail till the final disposal of the case.",
        explanation: "Here is the requested bail application under Section 497 CrPC:",
        title: "Bail Application under 497 CrPC"
      })
    });
  });

  const sendBtn = page.getByRole('button', { name: 'Draft', exact: true });
  await sendBtn.click();

  const insertBtn = page.locator('button', { hasText: 'Insert' }).first();
  await expect(insertBtn).toBeVisible({ timeout: 10000 });

  await insertBtn.click();

  const editorText = await editor.innerText();
  expect(editorText.toLowerCase()).toContain('application for post-arrest bail');
  expect(editorText.toLowerCase()).toContain('prayer');

  console.log("SUCCESSFULLY COMPLETED DRAFTING E2E FLOW - FULL SUCCESS!");
});
