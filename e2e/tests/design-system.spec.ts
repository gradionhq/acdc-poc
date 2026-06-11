import { test, expect, confirmDeleteNote } from '../fixtures';

/**
 * Design-system e2e spec.
 *
 * Verifies that:
 * - The page uses token-based layout (no inline hard-coded styles on key
 *   elements; layout is handled via CSS class names from the design system).
 * - The three Button variants render with the expected accessible roles and are
 *   visible/functional.
 * - CSS custom-property tokens are applied to the document root.
 *
 * Uses a unique per-run token in note titles so the spec is safe to run
 * alongside the shared in-memory server (workers: 1).
 */

test('design-system tokens are present on :root', async ({ page }) => {
  await page.goto('/');

  // Verify that the primary color token is set (non-empty) — confirms tokens.css loaded.
  const primaryColor = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
  );
  expect(primaryColor).toBeTruthy();
  // The token must resolve to a hex color (the exact shade may be
  // normalized by the browser, so we test format rather than value).
  expect(primaryColor).toMatch(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

  // Spacing token must also be present — confirms the full token set loaded.
  const space4 = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--space-4').trim(),
  );
  expect(space4).toBeTruthy();
});

test('Button variants render with correct accessible roles', async ({ page }) => {
  const token = `DS-${Date.now()}`;
  await page.goto('/');

  // "Add note" is a primary Button — confirm it is a button role
  const submitBtn = page.getByRole('button', { name: /add note/i });
  await expect(submitBtn).toBeVisible();

  // Create a note so the secondary (Edit, Pin) and danger (Delete) buttons appear
  await page.getByLabel(/title/i).fill(`${token} Design test`);
  await page.getByLabel(/body/i).fill('design system proof');
  await submitBtn.click();

  const item = page.getByRole('listitem').filter({ hasText: `${token} Design test` });
  await expect(item).toBeVisible();

  // Secondary buttons
  await expect(item.getByRole('button', { name: /^edit/i })).toBeVisible();
  await expect(item.getByRole('button', { name: /^pin/i })).toBeVisible();

  // Danger button
  await expect(item.getByRole('button', { name: /^delete/i })).toBeVisible();

  // Clean up — delete the note
  await confirmDeleteNote(item, /^delete/i);
  await expect(item).toHaveCount(0);
});

test('page uses token-based layout classes (no inline style on main)', async ({ page }) => {
  await page.goto('/');

  // The <main> element must NOT have a style attribute (all layout via CSS class)
  const mainStyle = await page.locator('main').getAttribute('style');
  expect(mainStyle).toBeNull();
});

test('form inputs receive focus ring via CSS (no inline outline)', async ({ page }) => {
  await page.goto('/');

  // Inputs must not have inline styles that would override the token-based focus ring
  const titleInputStyle = await page.getByLabel(/title/i).first().getAttribute('style');
  expect(titleInputStyle).toBeNull();
});
