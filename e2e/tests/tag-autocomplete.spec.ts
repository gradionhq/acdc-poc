import { test, expect } from '../fixtures';

/**
 * Helper: create a note via the UI and wait for the title input to clear
 * (confirming the server accepted the note).
 */
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
    await page.getByRole('combobox', { name: /^tags$/i }).fill(tags);
  }
  await page.getByRole('button', { name: /add note/i }).click();
  await expect(titleInput).toHaveValue('');
}

test('tag autocomplete — shared tag appears as suggestion on a new note form', async ({ page }) => {
  const stamp = Date.now();
  const sharedTag = `shared${stamp}`;
  const title1 = `[autocomplete-e2e] Note1-${stamp}`;
  const title2 = `[autocomplete-e2e] Note2-${stamp}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create two notes that both use the shared tag so it exists in the store.
  await createNote(page, title1, 'body of note one', sharedTag);
  await createNote(page, title2, 'body of note two', sharedTag);

  // Type a prefix of the shared tag in the note composer tags input.
  const tagsInput = page.getByRole('combobox', { name: /^tags$/i });
  const prefix = sharedTag.slice(0, 4); // e.g. "shar"
  await tagsInput.fill(prefix);

  // The suggestion dropdown should appear with the shared tag.
  const listbox = page.getByRole('listbox', { name: /tag suggestions/i });
  await expect(listbox).toBeVisible();
  const suggestion = listbox.getByRole('option', { name: sharedTag });
  await expect(suggestion).toBeVisible();
});

test('tag autocomplete — selecting a suggestion adds the tag and clears segment', async ({
  page,
}) => {
  const stamp = Date.now();
  const sharedTag = `autocomplete${stamp}`;
  const title1 = `[autocomplete-e2e] SelNote1-${stamp}`;
  const title2 = `[autocomplete-e2e] SelNote2-${stamp}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await createNote(page, title1, 'body', sharedTag);
  await createNote(page, title2, 'body', sharedTag);

  const tagsInput = page.getByRole('combobox', { name: /^tags$/i });
  const prefix = sharedTag.slice(0, 5);
  await tagsInput.fill(prefix);

  const listbox = page.getByRole('listbox', { name: /tag suggestions/i });
  await expect(listbox).toBeVisible();

  // Select the suggestion via keyboard (ArrowDown + Enter).
  await tagsInput.press('ArrowDown');
  await tagsInput.press('Enter');

  // After selection the full tag should appear in the input value.
  await expect(tagsInput).toHaveValue(new RegExp(sharedTag));

  // The listbox should close.
  await expect(listbox).toHaveCount(0);
});

test('tag autocomplete — Escape closes the suggestion dropdown', async ({ page }) => {
  const stamp = Date.now();
  const sharedTag = `escape${stamp}`;
  const title1 = `[autocomplete-e2e] EscNote1-${stamp}`;
  const title2 = `[autocomplete-e2e] EscNote2-${stamp}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await createNote(page, title1, 'body', sharedTag);
  await createNote(page, title2, 'body', sharedTag);

  const tagsInput = page.getByRole('combobox', { name: /^tags$/i });
  await tagsInput.fill(sharedTag.slice(0, 3));

  const listbox = page.getByRole('listbox', { name: /tag suggestions/i });
  await expect(listbox).toBeVisible();

  await tagsInput.press('Escape');
  await expect(listbox).toHaveCount(0);
});

test('tag autocomplete — clicking outside closes the suggestion dropdown', async ({ page }) => {
  const stamp = Date.now();
  const sharedTag = `clickout${stamp}`;
  const title1 = `[autocomplete-e2e] ClickNote1-${stamp}`;
  const title2 = `[autocomplete-e2e] ClickNote2-${stamp}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await createNote(page, title1, 'body', sharedTag);
  await createNote(page, title2, 'body', sharedTag);

  const tagsInput = page.getByRole('combobox', { name: /^tags$/i });
  await tagsInput.fill(sharedTag.slice(0, 4));

  const listbox = page.getByRole('listbox', { name: /tag suggestions/i });
  await expect(listbox).toBeVisible();

  // Click somewhere outside the input/dropdown (the page heading).
  await page.getByRole('heading', { name: 'Notes' }).click();
  await expect(listbox).toHaveCount(0);
});

test('tag autocomplete — Enter without highlight still allows free-form tag creation', async ({
  page,
}) => {
  const stamp = Date.now();
  const brand = `brandnew${stamp}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  const titleInput = page.getByLabel(/^title$/i);
  await titleInput.fill(`[autocomplete-e2e] FreeTag-${stamp}`);
  await page.getByLabel(/^body$/i).fill('free tag body');

  const tagsInput = page.getByRole('combobox', { name: /^tags$/i });
  // No suggestions exist for this brand-new tag — just type and submit.
  await tagsInput.fill(brand);
  await expect(page.getByRole('listbox')).toHaveCount(0);

  await page.getByRole('button', { name: /add note/i }).click();
  await expect(titleInput).toHaveValue('');

  // The note should appear with the free-form tag.
  const searchBox = page.getByRole('textbox', { name: /search notes/i });
  await searchBox.fill(`FreeTag-${stamp}`);
  const item = page.getByRole('listitem').filter({ hasText: `FreeTag-${stamp}` });
  await expect(item).toBeVisible();
  await expect(item).toContainText(brand);
});
