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

// Wait for the active notes list to finish its async fetch. The skeleton is
// only shown on the very first load; background refetches (e.g. after an
// archive/unarchive action or a view switch) replace the list contents
// silently. We wait for the non-busy `ul[aria-label="Notes list"]` to be
// present so `findNoteItem` doesn't race the refetch.
async function waitForNotesListReady(page: import('@playwright/test').Page): Promise<void> {
  // The non-busy list (aria-busy is absent or false on the real list).
  await page
    .getByRole('list', { name: 'Notes list' })
    .waitFor({ state: 'visible', timeout: 10000 });
}

// Navigate through pages until an item matching `title` is visible, then return
// the locator. Starts from page 1. Waits for the list to be ready on each
// page so we don't race an in-flight async refetch.
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
    // Wait for the list to settle on this page before inspecting items.
    await waitForNotesListReady(page);
    const item = page.getByRole('listitem').filter({ hasText: title });
    // Use waitFor instead of isVisible so we give the freshly-rendered page
    // a chance to display the note before concluding it is absent.
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

  // Switch to archived view and wait for the refetch to land before paginating.
  await page.getByRole('button', { name: /show archived notes/i }).click();
  await waitForNotesListReady(page);

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

  // Switch to archived view and wait for the refetch to land before paginating.
  await page.getByRole('button', { name: /show archived notes/i }).click();
  await waitForNotesListReady(page);
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
  // Wait for the list to be ready (the view switch triggers an async refetch;
  // findNoteItem uses waitFor per-page so it won't race the refetch).
  await page.getByRole('button', { name: /show active notes/i }).click();
  await waitForNotesListReady(page);
  const restoredItem = await findNoteItem(page, noteTitle);
  await expect(restoredItem).toBeVisible();
});
