import { test, expect } from '../fixtures';

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

// Navigate through pages until an item matching `title` is visible, then return
// the locator. Starts from page 1.
async function findNoteItem(
  page: import('@playwright/test').Page,
  title: string,
): Promise<import('@playwright/test').Locator> {
  const prevBtn = page.getByRole('button', { name: /previous page/i });
  const nextBtn = page.getByRole('button', { name: /next page/i });

  // Go to page 1 first
  while (await prevBtn.isEnabled()) {
    await prevBtn.click();
  }

  for (;;) {
    const item = page.getByRole('listitem').filter({ hasText: title });
    if (await item.isVisible()) return item;
    if (!(await nextBtn.isEnabled())) break;
    await nextBtn.click();
  }
  throw new Error(`Note with title "${title}" not found in any page`);
}

test('archive a note: it disappears from the main list and appears in the archived view', async ({
  page,
}) => {
  const token = `archive-e2e-${Date.now()}`;
  const noteTitle = `${token}-note`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create a note
  await createNote(page, noteTitle, 'note body for archive test');

  // Note is visible in the active list
  const noteItem = await findNoteItem(page, noteTitle);
  await expect(noteItem).toBeVisible();

  // Archive the note
  await noteItem.getByRole('button', { name: new RegExp(`^archive ${noteTitle}$`, 'i') }).click();

  // Note must disappear from the active list
  await expect(page.getByRole('listitem').filter({ hasText: noteTitle })).toHaveCount(0, {
    timeout: 5000,
  });

  // Switch to archived view
  await page.getByRole('button', { name: /show archived notes/i }).click();

  // Note must appear in the archived view
  const archivedItem = await findNoteItem(page, noteTitle);
  await expect(archivedItem).toBeVisible();

  // Unarchive button should be present (not Archive)
  await expect(
    archivedItem.getByRole('button', { name: new RegExp(`^unarchive ${noteTitle}$`, 'i') }),
  ).toBeVisible();
});

test('unarchive a note: it disappears from the archived view and returns to the main list', async ({
  page,
}) => {
  const token = `unarchive-e2e-${Date.now()}`;
  const noteTitle = `${token}-note`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create and archive a note
  await createNote(page, noteTitle, 'body');
  const noteItem = await findNoteItem(page, noteTitle);
  await noteItem.getByRole('button', { name: new RegExp(`^archive ${noteTitle}$`, 'i') }).click();
  await expect(page.getByRole('listitem').filter({ hasText: noteTitle })).toHaveCount(0, {
    timeout: 5000,
  });

  // Switch to archived view and confirm it is there
  await page.getByRole('button', { name: /show archived notes/i }).click();
  const archivedItem = await findNoteItem(page, noteTitle);
  await expect(archivedItem).toBeVisible();

  // Unarchive it
  await archivedItem
    .getByRole('button', { name: new RegExp(`^unarchive ${noteTitle}$`, 'i') })
    .click();

  // Note must disappear from the archived view
  await expect(page.getByRole('listitem').filter({ hasText: noteTitle })).toHaveCount(0, {
    timeout: 5000,
  });

  // Switch back to active view — note must reappear.
  // Use toBeVisible (which auto-retries) directly on the expected item so the
  // assertion waits for the list fetch to complete before we call findNoteItem.
  await page.getByRole('button', { name: /show active notes/i }).click();
  await expect(page.getByRole('listitem').filter({ hasText: noteTitle })).toBeVisible({
    timeout: 8000,
  });
  const restoredItem = await findNoteItem(page, noteTitle);
  await expect(restoredItem).toBeVisible();
});
