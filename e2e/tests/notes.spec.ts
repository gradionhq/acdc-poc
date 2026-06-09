import { test, expect } from '@playwright/test';

test('create then delete a note', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await page.getByLabel(/title/i).fill('E2E note');
  await page.getByLabel(/body/i).fill('proof of work');
  await page.getByRole('button', { name: /add note/i }).click();

  const item = page.getByRole('listitem').filter({ hasText: 'E2E note' });
  await expect(item).toBeVisible();

  await item.getByRole('button', { name: /delete/i }).click();
  await expect(item).toHaveCount(0);
});
