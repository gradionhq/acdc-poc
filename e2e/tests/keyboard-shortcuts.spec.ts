import { test, expect } from '../fixtures';

test('pressing "n" focuses the new-note title input', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Ensure focus is not in any input first
  await page.keyboard.press('Escape');

  await page.keyboard.press('n');

  // The new-note title input should now be focused
  const titleInput = page.getByLabel(/^title$/i);
  await expect(titleInput).toBeFocused();
});

test('pressing "/" focuses the search input', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await page.keyboard.press('Escape');

  await page.keyboard.press('/');

  const searchInput = page.getByRole('textbox', { name: /search notes/i });
  await expect(searchInput).toBeFocused();
});

test('pressing "?" opens and closes the shortcut help panel', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await page.keyboard.press('Escape');

  // Open help panel
  await page.keyboard.press('?');
  const helpPanel = page.getByRole('dialog', { name: /keyboard shortcuts/i });
  await expect(helpPanel).toBeVisible();

  // Close with "?" again
  await page.keyboard.press('?');
  await expect(helpPanel).not.toBeVisible();
});

test('pressing Escape closes the help panel', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await page.keyboard.press('Escape');
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).not.toBeVisible();
});

test('"n" is suppressed while typing inside an input', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Type in the search box; pressing "n" while inside it should NOT trigger the shortcut
  const searchInput = page.getByRole('textbox', { name: /search notes/i });
  await searchInput.focus();
  await expect(searchInput).toBeFocused();

  // Focus is still on search — title input should not be focused after pressing "n"
  await page.keyboard.press('n');
  await expect(searchInput).toBeFocused();
});

test('help panel lists expected shortcuts', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await page.keyboard.press('Escape');
  await page.keyboard.press('?');

  const helpPanel = page.getByRole('dialog', { name: /keyboard shortcuts/i });
  await expect(helpPanel).toBeVisible();
  await expect(helpPanel).toContainText('Focus new-note title');
  await expect(helpPanel).toContainText('Focus search');
  await expect(helpPanel).toContainText('Close / cancel / clear focus');
  await expect(helpPanel).toContainText('Toggle this help panel');
});
