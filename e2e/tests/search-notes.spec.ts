import { test, expect } from '@playwright/test';

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
  const stamp = Date.now();
  const alphaTitle = `[search-e2e] Alpha-${stamp}`;
  const betaTitle = `[search-e2e] Beta-${stamp}`;
  const gammaTitle = `[search-e2e] Gamma-${stamp}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create three notes
  await createNote(page, alphaTitle, 'content alpha');
  await createNote(page, betaTitle, 'content beta');
  await createNote(page, gammaTitle, 'content gamma');

  // Navigate to page 1 so we can verify which notes are visible
  const prevBtn = page.getByRole('button', { name: /previous page/i });
  while (await prevBtn.isEnabled()) {
    await prevBtn.click();
  }

  // Wait for at least one of our seeded notes to appear
  await expect(page.getByRole('list')).toContainText(alphaTitle);

  // Type in the search box — filter to notes whose title contains "Alpha"
  const searchBox = page.getByRole('textbox', { name: /search notes/i });
  await searchBox.fill(alphaTitle);

  // Only alphaTitle note should be visible; beta and gamma should vanish
  await expect(page.getByRole('list')).toContainText(alphaTitle);
  await expect(page.getByRole('list')).not.toContainText(betaTitle);
  await expect(page.getByRole('list')).not.toContainText(gammaTitle);

  // Clear the search — all notes should be visible again
  await searchBox.clear();
  await expect(page.getByRole('list')).toContainText(alphaTitle);
  await expect(page.getByRole('list')).toContainText(betaTitle);
  await expect(page.getByRole('list')).toContainText(gammaTitle);
});

test('search returns empty list when no notes match', async ({ page }) => {
  const stamp = Date.now();
  const noteTitle = `[search-e2e] NoMatch-${stamp}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await createNote(page, noteTitle, 'body content');

  // Navigate to page 1
  const prevBtn = page.getByRole('button', { name: /previous page/i });
  while (await prevBtn.isEnabled()) {
    await prevBtn.click();
  }

  await expect(page.getByRole('list')).toContainText(noteTitle);

  // Search for a term guaranteed not to match
  const searchBox = page.getByRole('textbox', { name: /search notes/i });
  await searchBox.fill('zzz-no-match-xyz');

  await expect(page.getByRole('list')).not.toContainText(noteTitle);

  // Restore normal view
  await searchBox.clear();
  await expect(page.getByRole('list')).toContainText(noteTitle);
});

test('search filters by body text (case-insensitive)', async ({ page }) => {
  const stamp = Date.now();
  const titleWithKeyword = `[search-e2e] BodySearch-${stamp}`;
  const titleWithoutKeyword = `[search-e2e] Other-${stamp}`;
  const uniqueBodyWord = `uniquekeyword${stamp}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await createNote(page, titleWithKeyword, `has ${uniqueBodyWord} in body`);
  await createNote(page, titleWithoutKeyword, 'ordinary body text');

  // Navigate to page 1
  const prevBtn = page.getByRole('button', { name: /previous page/i });
  while (await prevBtn.isEnabled()) {
    await prevBtn.click();
  }

  await expect(page.getByRole('list')).toContainText(titleWithKeyword);

  const searchBox = page.getByRole('textbox', { name: /search notes/i });
  await searchBox.fill(uniqueBodyWord.toUpperCase());

  await expect(page.getByRole('list')).toContainText(titleWithKeyword);
  await expect(page.getByRole('list')).not.toContainText(titleWithoutKeyword);

  await searchBox.clear();
});
