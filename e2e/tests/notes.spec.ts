import { test, expect, openOverflowMenu, createNote } from '../fixtures';

test('create then delete a note via confirm dialog', async ({ page }) => {
  // Unique per run so a leftover note from an interrupted local re-run (the store
  // is in-memory and reused locally via reuseExistingServer) can't cause a
  // strict-mode multiple-match on the filtered locator below.
  const title = `E2E note ${Date.now()}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await createNote(page, title, 'proof of work');

  const item = page.getByRole('listitem').filter({ hasText: title });
  await expect(item).toBeVisible();

  // Open the overflow menu, then click Delete — a confirmation dialog should appear.
  await openOverflowMenu(item);
  await item.getByRole('menuitem', { name: /delete/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Confirm the deletion.
  await dialog.getByRole('button', { name: /^delete$/i }).click();
  await expect(item).toHaveCount(0);
});

test('cancel in confirm dialog does not delete the note', async ({ page }) => {
  const title = `Cancel-delete note ${Date.now()}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await createNote(page, title, 'should not be deleted');

  const item = page.getByRole('listitem').filter({ hasText: title });
  await expect(item).toBeVisible();

  // Open overflow menu then click Delete — confirm dialog opens.
  await openOverflowMenu(item);
  await item.getByRole('menuitem', { name: new RegExp(`^delete cancel-delete note`, 'i') }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Click Cancel — dialog closes, note is still present.
  await dialog.getByRole('button', { name: /^cancel$/i }).click();
  await expect(dialog).toHaveCount(0);
  await expect(item).toBeVisible();
});
