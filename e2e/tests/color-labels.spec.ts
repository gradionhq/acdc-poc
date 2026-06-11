import { test, expect } from '../fixtures';

test('two notes with different colors show the correct visual accent', async ({ page }) => {
  const titleRed = `[color-e2e] red-${Date.now()}`;
  const titleBlue = `[color-e2e] blue-${Date.now()}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create a red note
  await page.getByLabel(/title/i).fill(titleRed);
  await page.getByLabel(/body/i).fill('red body');
  await page.getByRole('button', { name: 'Color red' }).first().click();
  await page.getByRole('button', { name: /add note/i }).click();

  // Wait for red note to appear
  const redItem = page.getByRole('listitem').filter({ hasText: titleRed });
  await expect(redItem).toBeVisible();
  await expect(redItem).toHaveAttribute('data-color', 'red');

  // Create a blue note
  await page.getByLabel(/title/i).fill(titleBlue);
  await page.getByLabel(/body/i).fill('blue body');
  await page.getByRole('button', { name: 'Color blue' }).first().click();
  await page.getByRole('button', { name: /add note/i }).click();

  // Wait for blue note to appear
  const blueItem = page.getByRole('listitem').filter({ hasText: titleBlue });
  await expect(blueItem).toBeVisible();
  await expect(blueItem).toHaveAttribute('data-color', 'blue');

  // Confirm red note still has its color accent (may be on the same page or page 1)
  if (await redItem.isVisible()) {
    await expect(redItem).toHaveAttribute('data-color', 'red');
  }

  // Clean up
  if (await blueItem.isVisible()) {
    await blueItem.getByRole('button', { name: /delete/i }).click();
    await expect(blueItem).toHaveCount(0);
  }
  if (await redItem.isVisible()) {
    await redItem.getByRole('button', { name: /delete/i }).click();
    await expect(redItem).toHaveCount(0);
  }
});
