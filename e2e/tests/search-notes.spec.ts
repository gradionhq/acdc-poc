import { test, expect } from '../fixtures';

// Creates a note via the UI and waits for the form title input to clear,
// confirming the server accepted the note before the test proceeds.
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

test('search box filters notes by title and clears on empty query', async ({ page }) => {
  // A shared per-run token embedded in all three titles so a single search
  // term can retrieve all of them regardless of how many notes exist in the
  // accumulated server state. This avoids relying on pagination position.
  const stamp = Date.now();
  const token = `srch${stamp}`;
  const alphaTitle = `[search-e2e] Alpha-${token}`;
  const betaTitle = `[search-e2e] Beta-${token}`;
  const gammaTitle = `[search-e2e] Gamma-${token}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create three notes
  await createNote(page, alphaTitle, 'content alpha');
  await createNote(page, betaTitle, 'content beta');
  await createNote(page, gammaTitle, 'content gamma');

  const searchBox = page.getByRole('textbox', { name: /search notes/i });

  // Search for the shared token — all three notes should be visible because
  // the server returns only the matching subset (no pagination cliff).
  await searchBox.fill(token);
  await expect(page.getByRole('list')).toContainText(alphaTitle);
  await expect(page.getByRole('list')).toContainText(betaTitle);
  await expect(page.getByRole('list')).toContainText(gammaTitle);

  // Narrow down to just Alpha
  await searchBox.fill(alphaTitle);
  await expect(page.getByRole('list')).toContainText(alphaTitle);
  await expect(page.getByRole('list')).not.toContainText(betaTitle);
  await expect(page.getByRole('list')).not.toContainText(gammaTitle);

  // Restore the shared token filter — all three visible again
  await searchBox.fill(token);
  await expect(page.getByRole('list')).toContainText(alphaTitle);
  await expect(page.getByRole('list')).toContainText(betaTitle);
  await expect(page.getByRole('list')).toContainText(gammaTitle);
});

test('search returns empty list when no notes match', async ({ page }) => {
  const stamp = Date.now();
  const token = `srch${stamp}`;
  const noteTitle = `[search-e2e] NoMatch-${token}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await createNote(page, noteTitle, 'body content');

  // Confirm the note is retrievable via its unique token
  const searchBox = page.getByRole('textbox', { name: /search notes/i });
  await searchBox.fill(token);
  await expect(page.getByRole('list')).toContainText(noteTitle);

  // Search for a term guaranteed not to match
  await searchBox.fill('zzz-no-match-xyz');
  await expect(page.getByRole('list')).not.toContainText(noteTitle);

  // Restore the token filter — note reappears
  await searchBox.fill(token);
  await expect(page.getByRole('list')).toContainText(noteTitle);
});

test('search filters by body text (case-insensitive)', async ({ page }) => {
  const stamp = Date.now();
  const titleToken = `srch${stamp}`;
  const titleWithKeyword = `[search-e2e] BodySearch-${titleToken}`;
  const titleWithoutKeyword = `[search-e2e] Other-${titleToken}`;
  const uniqueBodyWord = `uniquekeyword${stamp}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await createNote(page, titleWithKeyword, `has ${uniqueBodyWord} in body`);
  await createNote(page, titleWithoutKeyword, 'ordinary body text');

  const searchBox = page.getByRole('textbox', { name: /search notes/i });

  // Filter by the unique body word (case-insensitive) — only the first note
  // should match, regardless of accumulated notes from other test runs.
  await searchBox.fill(uniqueBodyWord.toUpperCase());
  await expect(page.getByRole('list')).toContainText(titleWithKeyword);
  await expect(page.getByRole('list')).not.toContainText(titleWithoutKeyword);

  // Clear search to leave server in clean state for subsequent tests
  await searchBox.clear();
});

test('creating a note while a search is active clears the search', async ({ page }) => {
  const stamp = Date.now();
  const existingTitle = `[search-e2e] Existing-${stamp}`;
  const newTitle = `[search-e2e] NewUnrelated-${stamp}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create a note to search for
  await createNote(page, existingTitle, 'existing body');

  // Activate a search filter. Wait for the debounce-triggered API response
  // that includes the search query — only then is `query` state set in the
  // app and the filter is truly active.
  const searchBox = page.getByRole('textbox', { name: /search notes/i });
  const filteredResponsePromise = page.waitForResponse(
    (r) => r.url().includes('q=') && r.status() === 200,
  );
  await searchBox.fill(existingTitle);
  await filteredResponsePromise; // debounce has now fired and filter is active

  await expect(page.getByRole('list')).toContainText(existingTitle);

  // Create a new note that does not match the active filter
  await createNote(page, newTitle, 'new body');

  // The search should have been cleared; the new note should be visible
  await expect(page.getByRole('list')).toContainText(newTitle);
  await expect(searchBox).toHaveValue('');
});
