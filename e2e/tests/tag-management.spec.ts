import { test, expect } from '../fixtures';

// Creates a note via the UI with optional tags (comma-separated).
// Waits for the title input to clear, confirming the server accepted the note.
async function createNote(
  page: import('@playwright/test').Page,
  title: string,
  body: string,
  tags?: string,
): Promise<void> {
  const titleInput = page.getByLabel(/^title$/i);
  await titleInput.fill(title);
  await page.getByLabel(/^body$/i).fill(body);
  if (tags !== undefined) {
    await page.getByRole('textbox', { name: /^tags$/i }).fill(tags);
  }
  await page.getByRole('button', { name: /add note/i }).click();
  await expect(titleInput).toHaveValue('');
}

test('tag management panel: rename a tag, verify notes updated, then delete it', async ({
  page,
}) => {
  const stamp = Date.now();
  const titleA = `[tag-mgmt] NoteA-${stamp}`;
  const titleB = `[tag-mgmt] NoteB-${stamp}`;
  const originalTag = `tagmgmt-orig-${stamp}`;
  const renamedTag = `tagmgmt-renamed-${stamp}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create two notes sharing the same tag
  await createNote(page, titleA, 'body a', originalTag);
  await createNote(page, titleB, 'body b', originalTag);

  // Open the tag manager panel
  await page.getByRole('button', { name: /manage tags/i }).click();
  await expect(page.getByRole('region', { name: /tag manager/i })).toBeVisible();

  // The tag should appear in the list with count 2
  const tagManagerPanel = page.getByRole('region', { name: /tag manager/i });
  await expect(
    tagManagerPanel.getByRole('listitem').filter({ hasText: originalTag }),
  ).toBeVisible();

  // Rename the tag
  await page.getByRole('button', { name: new RegExp(`rename tag ${originalTag}`, 'i') }).click();
  const renameInput = page.getByRole('textbox', { name: new RegExp(`rename ${originalTag}`, 'i') });
  await expect(renameInput).toBeVisible();
  await renameInput.fill(renamedTag);
  await page.getByRole('button', { name: /^save$/i }).click();

  // The renamed tag should appear; original tag should be gone from the list
  await expect(tagManagerPanel.getByRole('listitem').filter({ hasText: renamedTag })).toBeVisible();
  await expect(
    tagManagerPanel
      .getByRole('listitem')
      .filter({ hasText: originalTag })
      .filter({ hasText: 'notes' }),
  ).not.toBeVisible();

  // Close the tag manager panel and verify notes were updated
  await page.getByRole('button', { name: /hide tag manager/i }).click();

  const searchBox = page.getByRole('textbox', { name: /search notes/i });
  await searchBox.fill(`[tag-mgmt]`);

  // Both notes should now carry the renamed tag
  const noteA = page.getByRole('listitem').filter({ hasText: titleA });
  const noteB = page.getByRole('listitem').filter({ hasText: titleB });
  await expect(noteA).toContainText(renamedTag);
  await expect(noteA).not.toContainText(originalTag);
  await expect(noteB).toContainText(renamedTag);
  await expect(noteB).not.toContainText(originalTag);

  // Reopen tag manager and delete the renamed tag
  await page.getByRole('button', { name: /manage tags/i }).click();
  await expect(page.getByRole('region', { name: /tag manager/i })).toBeVisible();

  const tagManagerPanelReopened = page.getByRole('region', { name: /tag manager/i });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: new RegExp(`delete tag ${renamedTag}`, 'i') }).click();

  // Renamed tag should disappear from the list
  await expect(
    tagManagerPanelReopened
      .getByRole('listitem')
      .filter({ hasText: renamedTag })
      .filter({ hasText: 'note' }),
  ).not.toBeVisible();

  // Close manager and verify tag is gone from notes
  await page.getByRole('button', { name: /hide tag manager/i }).click();

  const noteAAfter = page.getByRole('listitem').filter({ hasText: titleA });
  const noteBAfter = page.getByRole('listitem').filter({ hasText: titleB });
  await expect(noteAAfter).not.toContainText(renamedTag);
  await expect(noteBAfter).not.toContainText(renamedTag);
});

test('tag management: renaming a tag to an existing name shows an error', async ({ page }) => {
  const stamp = Date.now();
  const title1 = `[tag-mgmt] RenameErr1-${stamp}`;
  const title2 = `[tag-mgmt] RenameErr2-${stamp}`;
  const tagA = `tagmgmt-a-${stamp}`;
  const tagB = `tagmgmt-b-${stamp}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await createNote(page, title1, 'body', tagA);
  await createNote(page, title2, 'body', tagB);

  await page.getByRole('button', { name: /manage tags/i }).click();
  await expect(page.getByRole('region', { name: /tag manager/i })).toBeVisible();

  // Try to rename tagA → tagB (tagB already exists)
  await page.getByRole('button', { name: new RegExp(`rename tag ${tagA}`, 'i') }).click();
  const renameInput = page.getByRole('textbox', { name: new RegExp(`rename ${tagA}`, 'i') });
  await renameInput.fill(tagB);
  await page.getByRole('button', { name: /^save$/i }).click();

  // An error message should be displayed
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(/already exists/i);
});
