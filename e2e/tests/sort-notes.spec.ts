import { test, expect } from '../fixtures';

// Creates a note via the UI and waits for the title input to clear,
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

// Returns the titles of all visible note list items in DOM order.
async function visibleNoteTitles(page: import('@playwright/test').Page): Promise<string[]> {
  const items = page.getByRole('listitem');
  const count = await items.count();
  const titles: string[] = [];
  for (let i = 0; i < count; i++) {
    const titleEl = items.nth(i).locator('span').first();
    const text = await titleEl.textContent();
    if (text) titles.push(text.trim());
  }
  return titles;
}

test('sort options — newest/oldest/title renders correct order', async ({ page }) => {
  // Use a shared timestamp token so all three titles are unique per run and
  // can be retrieved together with a single search term.
  const stamp = Date.now();
  const token = `sort${stamp}`;
  const noteA = `[sort-e2e] Apple-${token}`;
  const noteB = `[sort-e2e] Banana-${token}`;
  const noteC = `[sort-e2e] Cherry-${token}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create notes in a specific order: Apple first, Banana second, Cherry third.
  await createNote(page, noteA, 'body a');
  await createNote(page, noteB, 'body b');
  await createNote(page, noteC, 'body c');

  // Narrow the list to just these three notes using the search box.
  const searchBox = page.getByRole('textbox', { name: /search notes/i });
  await searchBox.fill(token);
  await expect(page.getByRole('list')).toContainText(noteA);
  await expect(page.getByRole('list')).toContainText(noteB);
  await expect(page.getByRole('list')).toContainText(noteC);

  const sortSelect = page.getByRole('combobox', { name: /sort notes/i });

  // ── newest first (default) ──────────────────────────────────────
  await sortSelect.selectOption('newest');
  await expect(page.getByRole('list')).toContainText(noteC);
  const newestTitles = await visibleNoteTitles(page);
  const newestFiltered = newestTitles.filter((t) => t.includes(token));
  expect(newestFiltered[0]).toBe(noteC);
  expect(newestFiltered[1]).toBe(noteB);
  expect(newestFiltered[2]).toBe(noteA);

  // ── oldest first ────────────────────────────────────────────────
  await sortSelect.selectOption('oldest');
  await expect(page.getByRole('list')).toContainText(noteA);
  const oldestTitles = await visibleNoteTitles(page);
  const oldestFiltered = oldestTitles.filter((t) => t.includes(token));
  expect(oldestFiltered[0]).toBe(noteA);
  expect(oldestFiltered[1]).toBe(noteB);
  expect(oldestFiltered[2]).toBe(noteC);

  // ── title A→Z ───────────────────────────────────────────────────
  await sortSelect.selectOption('title');
  await expect(page.getByRole('list')).toContainText(noteA);
  const titleSortedTitles = await visibleNoteTitles(page);
  const titleFiltered = titleSortedTitles.filter((t) => t.includes(token));
  // Apple < Banana < Cherry alphabetically
  expect(titleFiltered[0]).toBe(noteA);
  expect(titleFiltered[1]).toBe(noteB);
  expect(titleFiltered[2]).toBe(noteC);
});

test('pinned notes sort ahead of unpinned regardless of sort option', async ({ page }) => {
  const stamp = Date.now();
  const token = `sortpin${stamp}`;
  const noteFirst = `[sort-e2e] First-${token}`;
  const noteSecond = `[sort-e2e] Second-${token}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await createNote(page, noteFirst, 'body first');
  await createNote(page, noteSecond, 'body second');

  // Narrow the list to just these two notes.
  const searchBox = page.getByRole('textbox', { name: /search notes/i });
  await searchBox.fill(token);
  await expect(page.getByRole('list')).toContainText(noteFirst);
  await expect(page.getByRole('list')).toContainText(noteSecond);

  // Pin the first-created note.
  // Use an anchored regex so we match only the "Pin <title>" button and not
  // other buttons whose aria-labels contain the note title (which itself
  // contains the "pin" token and would cause a strict-mode violation).
  const firstItem = page.getByRole('listitem').filter({ hasText: noteFirst });
  await firstItem.getByRole('button', { name: /^Pin /i }).click();
  await expect(firstItem.getByRole('button', { name: /^Unpin /i })).toBeVisible();

  const sortSelect = page.getByRole('combobox', { name: /sort notes/i });

  // Switch to newest: pinned noteFirst should still appear before noteSecond.
  await sortSelect.selectOption('newest');
  await expect(page.getByRole('list')).toContainText(noteFirst);
  const newestTitles = await visibleNoteTitles(page);
  const filtered = newestTitles.filter((t) => t.includes(token));
  expect(filtered[0]).toBe(noteFirst); // pinned → always first

  // Switch to title sort: same expectation.
  await sortSelect.selectOption('title');
  await expect(page.getByRole('list')).toContainText(noteFirst);
  const titleTitles = await visibleNoteTitles(page);
  const filteredTitle = titleTitles.filter((t) => t.includes(token));
  expect(filteredTitle[0]).toBe(noteFirst); // pinned → always first
});
