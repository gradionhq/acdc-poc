import { test, expect, confirmDeleteNote } from '../fixtures';

// Helper: create a note and wait for the form to reset (title cleared).
async function createNote(
  page: import('@playwright/test').Page,
  title: string,
  body: string,
): Promise<void> {
  const titleInput = page.getByLabel(/^title$/i);
  await titleInput.fill(title);
  await page.getByLabel(/^body$/i).fill(body);
  await page.getByRole('button', { name: /add note/i }).click();
  await expect(titleInput).toHaveValue('');
}

// Wait for the notes list to finish loading / re-fetching.
async function waitForNotesListReady(page: import('@playwright/test').Page): Promise<void> {
  await page
    .getByRole('list', { name: 'Notes list' })
    .waitFor({ state: 'visible', timeout: 10000 });
}

// Navigate pages until a list item containing `title` is found; return its locator.
async function findNoteItem(
  page: import('@playwright/test').Page,
  title: string,
): Promise<import('@playwright/test').Locator> {
  const prevBtn = page.getByRole('button', { name: /previous page/i });
  const nextBtn = page.getByRole('button', { name: /next page/i });

  // Go to page 1 first
  while (await prevBtn.isEnabled()) {
    await prevBtn.click();
    await waitForNotesListReady(page);
  }

  for (;;) {
    await waitForNotesListReady(page);
    const item = page.getByRole('listitem').filter({ hasText: title });
    const found = await item
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (found) return item;
    if (!(await nextBtn.isEnabled())) break;
    await nextBtn.click();
  }
  throw new Error(`Note with title "${title}" not found in any page`);
}

test('delete a note moves it to trash; it disappears from the main list', async ({ page }) => {
  const token = `trash-e2e-${Date.now()}`;
  const noteTitle = `${token}-note`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create a note
  await createNote(page, noteTitle, 'body for trash test');

  // Note is visible in the active list
  const noteItem = await findNoteItem(page, noteTitle);
  await expect(noteItem).toBeVisible();

  // Delete via confirm dialog — uses the confirmDeleteNote helper
  await confirmDeleteNote(noteItem);

  // Note must disappear from the active list
  await expect(page.getByRole('listitem').filter({ hasText: noteTitle })).toHaveCount(0, {
    timeout: 5000,
  });
});

test('trashed note appears in Trash view with a Restore button', async ({ page }) => {
  const token = `trash-view-e2e-${Date.now()}`;
  const noteTitle = `${token}-note`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create and trash the note
  await createNote(page, noteTitle, 'body for trash view test');
  const noteItem = await findNoteItem(page, noteTitle);
  await confirmDeleteNote(noteItem);
  await expect(page.getByRole('listitem').filter({ hasText: noteTitle })).toHaveCount(0, {
    timeout: 5000,
  });

  // Switch to Trash view
  await page.getByRole('button', { name: /^show trash$/i }).click();
  await waitForNotesListReady(page);

  // Note must appear in the trash view
  const trashedItem = await findNoteItem(page, noteTitle);
  await expect(trashedItem).toBeVisible();

  // Restore button should be visible
  await expect(
    trashedItem.getByRole('button', { name: new RegExp(`^restore ${noteTitle}$`, 'i') }),
  ).toBeVisible();
});

test('restore a trashed note: it disappears from trash and reappears in the main list', async ({
  page,
}) => {
  const token = `restore-e2e-${Date.now()}`;
  const noteTitle = `${token}-note`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create and trash the note
  await createNote(page, noteTitle, 'body for restore test');
  const noteItem = await findNoteItem(page, noteTitle);
  await confirmDeleteNote(noteItem);
  await expect(page.getByRole('listitem').filter({ hasText: noteTitle })).toHaveCount(0, {
    timeout: 5000,
  });

  // Switch to Trash view
  await page.getByRole('button', { name: /^show trash$/i }).click();
  await waitForNotesListReady(page);

  // Restore the note
  const trashedItem = await findNoteItem(page, noteTitle);
  await trashedItem
    .getByRole('button', { name: new RegExp(`^restore ${noteTitle}$`, 'i') })
    .click();

  // Note must disappear from the trash view
  await expect(page.getByRole('listitem').filter({ hasText: noteTitle })).toHaveCount(0, {
    timeout: 5000,
  });

  // Switch back to the active list — note must reappear
  await page.getByRole('button', { name: /^show active notes$/i }).click();
  await waitForNotesListReady(page);
  const restoredItem = await findNoteItem(page, noteTitle);
  await expect(restoredItem).toBeVisible();
});

test('permanently delete a trashed note removes it entirely', async ({ page }) => {
  const token = `hardremove-e2e-${Date.now()}`;
  const noteTitle = `${token}-note`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create and trash the note — wait for the "Note created" toast to clear so it
  // does not obscure the overflow menu when we open it next.
  await createNote(page, noteTitle, 'body for permanent delete test');
  await expect(page.getByText(/note created/i)).toBeVisible();
  await expect(page.getByText(/note created/i)).toHaveCount(0, { timeout: 6000 });
  const noteItem = await findNoteItem(page, noteTitle);
  await confirmDeleteNote(noteItem);
  await expect(page.getByRole('listitem').filter({ hasText: noteTitle })).toHaveCount(0, {
    timeout: 5000,
  });

  // Switch to Trash view
  await page.getByRole('button', { name: /^show trash$/i }).click();
  await waitForNotesListReady(page);

  // Permanently delete via the danger button + confirm dialog
  const trashedItem = await findNoteItem(page, noteTitle);
  await trashedItem
    .getByRole('button', { name: new RegExp(`^permanently delete ${noteTitle}$`, 'i') })
    .click();

  // A confirm dialog should appear
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /^delete permanently$/i }).click();
  await expect(dialog).toHaveCount(0);

  // Note must not appear in the trash view
  await expect(page.getByRole('listitem').filter({ hasText: noteTitle })).toHaveCount(0, {
    timeout: 5000,
  });

  // Switch to active list — note must not appear there either.
  // (We skip waitForNotesListReady here since the active list will be empty
  // and an empty <ul> may be considered "not visible" by Playwright.)
  await page.getByRole('button', { name: /^show active notes$/i }).click();
  // Brief settle time for the refetch to complete, then verify absence.
  await page.waitForTimeout(1500);
  await expect(page.getByRole('listitem').filter({ hasText: noteTitle })).toHaveCount(0, {
    timeout: 5000,
  });
});
