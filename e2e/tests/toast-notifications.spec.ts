import { test, expect } from '../fixtures';

/**
 * Toast notifications e2e spec.
 *
 * Uses unique per-run tokens so re-runs against a live (reuseExistingServer)
 * in-memory server cannot collide with leftovers from an earlier interrupted run.
 * All locators are scoped to the specific list item so they remain unambiguous
 * even when multiple notes and/or multiple toasts are visible simultaneously.
 */

test('create a note — success toast appears then disappears', async ({ page }) => {
  const token = `toast-create-${Date.now()}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await page.getByLabel(/^title$/i).fill(token);
  await page.getByLabel(/^body$/i).fill('toast create body');
  await page.getByRole('button', { name: /add note/i }).click();

  // Success toast must appear with the correct text
  const toast = page.getByText('Note created');
  await expect(toast).toBeVisible();

  // Toast auto-dismisses within 5 seconds (configured at 4 s)
  await expect(toast).not.toBeVisible({ timeout: 6000 });
});

test('delete a note — success toast appears', async ({ page }) => {
  const token = `toast-delete-${Date.now()}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create the note first
  await page.getByLabel(/^title$/i).fill(token);
  await page.getByLabel(/^body$/i).fill('toast delete body');
  await page.getByRole('button', { name: /add note/i }).click();

  // Wait for the note to appear in the list
  const item = page.getByRole('listitem').filter({ hasText: token });
  await expect(item).toBeVisible();

  // Dismiss any lingering create-toast so delete toast is unambiguous
  const createToast = page.getByText('Note created');
  if (await createToast.isVisible()) {
    await page.getByRole('button', { name: /dismiss notification: note created/i }).click();
  }

  // Delete the note
  await item.getByRole('button', { name: new RegExp(`^delete ${token}$`, 'i') }).click();

  // Delete success toast must appear
  await expect(page.getByText('Note deleted')).toBeVisible();
});

test('toast can be manually dismissed', async ({ page }) => {
  const token = `toast-dismiss-${Date.now()}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await page.getByLabel(/^title$/i).fill(token);
  await page.getByLabel(/^body$/i).fill('toast dismiss body');
  await page.getByRole('button', { name: /add note/i }).click();

  const toast = page.getByText('Note created');
  await expect(toast).toBeVisible();

  // Manually dismiss the toast
  await page.getByRole('button', { name: /dismiss notification: note created/i }).click();

  // Toast must disappear immediately (well within auto-dismiss window)
  await expect(toast).not.toBeVisible({ timeout: 1000 });
});

test('multiple toasts stack without overlapping', async ({ page }) => {
  const token = `toast-stack-${Date.now()}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create two notes quickly so two toasts appear
  await page.getByLabel(/^title$/i).fill(`${token}-a`);
  await page.getByLabel(/^body$/i).fill('first');
  await page.getByRole('button', { name: /add note/i }).click();
  await expect(page.getByLabel(/^title$/i)).toHaveValue('');

  await page.getByLabel(/^title$/i).fill(`${token}-b`);
  await page.getByLabel(/^body$/i).fill('second');
  await page.getByRole('button', { name: /add note/i }).click();

  // Both "Note created" toasts should be present
  const toasts = page.getByTestId('toast');
  await expect(toasts).toHaveCount(2);

  // Toasts must not overlap: each should have a distinct bounding box
  const boxes = await toasts.evaluateAll((els: Element[]) =>
    els.map((el) => (el as HTMLElement).getBoundingClientRect().top),
  );
  // All y-positions must be distinct (toasts stacked vertically)
  const uniqueTops = new Set(boxes);
  expect(uniqueTops.size).toBe(boxes.length);
});

test('toasts do not block UI interaction — can still click buttons while toast visible', async ({
  page,
}) => {
  const token = `toast-noblock-${Date.now()}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create a note (toast appears)
  await page.getByLabel(/^title$/i).fill(token);
  await page.getByLabel(/^body$/i).fill('noblock body');
  await page.getByRole('button', { name: /add note/i }).click();

  const item = page.getByRole('listitem').filter({ hasText: token });
  await expect(item).toBeVisible();

  // While the toast is still visible, interact with the UI
  const createToast = page.getByText('Note created');
  await expect(createToast).toBeVisible();

  // Clicking the Pin button must work even with toast visible
  await item.getByRole('button', { name: new RegExp(`^pin ${token}$`, 'i') }).click();

  // A "Note pinned" toast should appear (confirming the action succeeded)
  await expect(page.getByText('Note pinned')).toBeVisible();
});
