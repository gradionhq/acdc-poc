import { test, expect } from '../fixtures';

test('live word and character count updates as user types in the body field', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Initial state: 0 words, 0 characters
  await expect(page.getByText('0 words, 0 characters')).toBeVisible();

  // Type a known string and assert the displayed counts are correct
  await page.getByLabel(/body/i).fill('hello world');
  await expect(page.getByText('2 words, 11 characters')).toBeVisible();

  // Extend with more words
  await page.getByLabel(/body/i).fill('the quick brown fox');
  await expect(page.getByText('4 words, 19 characters')).toBeVisible();

  // Clear the body field — count should return to 0
  await page.getByLabel(/body/i).fill('');
  await expect(page.getByText('0 words, 0 characters')).toBeVisible();
});
