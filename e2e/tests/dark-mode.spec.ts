import { test, expect } from '@playwright/test';

// Helper: get the value of data-theme on <html>
async function getTheme(page: import('@playwright/test').Page): Promise<string | null> {
  return page.evaluate(() => document.documentElement.getAttribute('data-theme'));
}

// Navigate to '/' with a clean localStorage state so the test starts from a
// known baseline regardless of what previous tests stored. We achieve this by
// visiting the page, clearing the key via evaluate, then reloading so the app
// re-initialises from the now-empty storage.
async function gotoClean(
  page: import('@playwright/test').Page,
  colorScheme: 'light' | 'dark' = 'light',
): Promise<void> {
  await page.emulateMedia({ colorScheme });
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('theme'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();
}

test.describe('dark mode toggle', () => {
  test('defaults to light when no stored preference and no OS dark preference', async ({
    page,
  }) => {
    await gotoClean(page, 'light');
    expect(await getTheme(page)).toBe('light');
  });

  test('defaults to dark when OS prefers dark and no stored preference', async ({ page }) => {
    await gotoClean(page, 'dark');
    expect(await getTheme(page)).toBe('dark');
  });

  test('toggle button switches theme from light to dark', async ({ page }) => {
    await gotoClean(page, 'light');
    expect(await getTheme(page)).toBe('light');

    await page.getByRole('button', { name: /switch to dark mode/i }).click();
    expect(await getTheme(page)).toBe('dark');
  });

  test('toggle button switches theme from dark to light', async ({ page }) => {
    await gotoClean(page, 'dark');
    expect(await getTheme(page)).toBe('dark');

    await page.getByRole('button', { name: /switch to light mode/i }).click();
    expect(await getTheme(page)).toBe('light');
  });

  test('selected theme persists after page reload', async ({ page }) => {
    // Start clean (light)
    await gotoClean(page, 'light');
    expect(await getTheme(page)).toBe('light');

    // Switch to dark — the hook writes 'dark' to localStorage
    await page.getByRole('button', { name: /switch to dark mode/i }).click();
    expect(await getTheme(page)).toBe('dark');
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');

    // Reload — localStorage is NOT cleared here, so the stored 'dark' should be
    // read back by the hook on reinitialisation.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();
    expect(await getTheme(page)).toBe('dark');

    // Switch back to light and reload again — should restore light.
    await page.getByRole('button', { name: /switch to light mode/i }).click();
    expect(await getTheme(page)).toBe('light');
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();
    expect(await getTheme(page)).toBe('light');
  });
});
