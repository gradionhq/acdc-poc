import { test as base, expect, type Locator } from '@playwright/test';

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
 * Click the Delete button on a note list item and confirm the ConfirmDialog.
 * Pass the list item locator as `item`; optionally narrow the delete-button
 * selector via `deleteName` (defaults to /delete/i).
 */
export async function confirmDeleteNote(
  item: Locator,
  deleteName: string | RegExp = /delete/i,
): Promise<void> {
  await item.getByRole('button', { name: deleteName }).click();
  const dialog = item.page().getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /^delete$/i }).click();
  await expect(dialog).toHaveCount(0);
}

export { expect };
