import { test, expect } from '@playwright/test';

test.describe('Experimental Modules UI Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5001/preview/auth');
    await page.route('/api/auth/user', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1, email: 'test@example.com', firstName: 'Playwright', lastName: 'Tester', tier: 'chamber', onboardingCompleted: true
        })
      });
    });
    await page.evaluate(() => {
      localStorage.setItem('alwakeelo_preview_auth', 'true');
    });
  });

  test('Document Analyzer Module - UI & Components Load Correctly', async ({ page }) => {
    await page.goto('http://localhost:5001/preview/document-analyzer');
    await expect(page.locator('h1').filter({ hasText: 'AI Procedural Compliance & Document Analyzer' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('select')).toBeVisible();
    
    // Check the upload button
    const uploadBtn = page.locator('button', { hasText: 'Upload Document' }).first();
    await expect(uploadBtn).toBeVisible();
    await uploadBtn.click();
    
    // Check the modal contents
    await expect(page.locator('text=Select PDF or DOCX file')).toBeVisible();
  });

  test('Judgments Module - Search Debounce & Loading State', async ({ page }) => {
    await page.goto('http://localhost:5001/preview/judgments');
    const searchInput = page.getByPlaceholder(/Search by Case Title, Legal Issue/);
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    
    await page.route('/api/case-law/search*', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({ status: 200, json: [] });
    });

    await searchInput.fill('murder bail application');
    await searchInput.press('Enter');
    const loadingText = page.locator('text=Searching 600,000+ Pakistani Precedent Records');
    await expect(loadingText).toBeVisible();
  });

  test('Legal Drafting Studio - Loads and displays editor', async ({ page }) => {
    await page.goto('http://localhost:5001/preview/drafting');
    
    // Verify one of the specific headers
    await expect(page.locator('span', { hasText: 'Legal Drafting Studio' }).first()).toBeVisible({ timeout: 10000 });
    
    // Verify the editor area is present
    const editor = page.locator('.ProseMirror').first();
    await expect(editor).toBeVisible();
  });

});
