import { test, expect } from '@playwright/test';

test.describe('Alwakeelo Experimental UI Safeguard Tests', () => {

  test('Checkout route bounces unauthenticated traffic to Auth', async ({ page }) => {
    await page.goto('http://localhost:5001/preview/checkout');
    await expect(page).toHaveURL(/.*\/preview\/auth/);
    const heading = page.locator('h1');
    await expect(heading).toHaveText('AL WAKEELO');
  });

  test('Dashboard loads without crashing', async ({ page }) => {
    await page.goto('http://localhost:5001/preview/dashboard');
    const root = page.locator('#root');
    await expect(root).not.toBeEmpty();
  });

});
