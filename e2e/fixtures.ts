import { test as base, expect, type Locator, type Page } from '@playwright/test';

// Reset the shared in-memory server before every test so specs don't accumulate
// state. The reset endpoint is mounted only when the server runs with
// ENABLE_TEST_RESET=1 (see playwright.config.ts webServer env).
export const test = base.extend<{ _reset: void }>({
  _reset: [
    async ({ request }, use) => {
      await request.post('http://localhost:3000/api/test/reset').catch(() => {});
      await use(undefined);
    },
    { auto: true },
  ],
});

/**
 * Open the overflow ("More actions") menu on a note list item.
 * The Delete and Duplicate actions live behind this menu.
 */
export async function openOverflowMenu(item: Locator): Promise<void> {
  await item.getByRole('button', { name: /more actions/i }).click();
}

/**
 * Create a note through the UI. The composer now lives in a modal dialog opened
 * by the header "New note" action, so this opens the dialog, fills the fields
 * (and optional comma-separated tags), submits, and waits for the dialog to
 * close — which the app does automatically on a successful save.
 */
export async function createNote(
  page: Page,
  title: string,
  body: string,
  tags?: string,
): Promise<void> {
  await page.getByRole('button', { name: /new note/i }).click();
  const dialog = page.getByRole('dialog', { name: /new note/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^title$/i).fill(title);
  await dialog.getByLabel(/^body$/i).fill(body);
  if (tags !== undefined) {
    await dialog.getByRole('combobox', { name: /^tags$/i }).fill(tags);
  }
  await dialog.getByRole('button', { name: /add note/i }).click();
  // On a successful save the app closes the composer modal.
  await expect(dialog).toHaveCount(0);
}

/**
 * Click the Delete button on a note list item and confirm the ConfirmDialog.
 * Automatically opens the overflow menu first since Delete is in the overflow.
 * Pass the list item locator as `item`; optionally narrow the delete-button
 * selector via `deleteName` (defaults to /delete/i).
 */
export async function confirmDeleteNote(
  item: Locator,
  deleteName: string | RegExp = /delete/i,
): Promise<void> {
  await openOverflowMenu(item);
  await item.getByRole('menuitem', { name: deleteName }).click();
  const dialog = item.page().getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /^delete$/i }).click();
  await expect(dialog).toHaveCount(0);
}

export { expect };
