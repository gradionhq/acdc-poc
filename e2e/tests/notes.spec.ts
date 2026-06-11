import { test, expect } from '../fixtures';

test('create then delete a note', async ({ page }) => {
  // Unique per run so a leftover note from an interrupted local re-run (the store
  // is in-memory and reused locally via reuseExistingServer) can't cause a
  // strict-mode multiple-match on the filtered locator below.
  const title = `E2E note ${Date.now()}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await page.getByLabel(/title/i).fill(title);
  await page.getByLabel(/body/i).fill('proof of work');
  await page.getByRole('button', { name: /add note/i }).click();

  const item = page.getByRole('listitem').filter({ hasText: title });
  await expect(item).toBeVisible();

  await item.getByRole('button', { name: /delete/i }).click();
  await expect(item).toHaveCount(0);
});
