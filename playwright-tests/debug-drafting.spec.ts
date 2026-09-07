import { test } from '@playwright/test';

test('Debug Drafting Studio DOM', async ({ page }) => {
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
  await page.waitForTimeout(3000);
  
  const text = await page.locator('body').innerText();
  console.log("DRAFTING STUDIO BODY:\n===================\n", text);
  console.log("\nURL:", page.url());
});
