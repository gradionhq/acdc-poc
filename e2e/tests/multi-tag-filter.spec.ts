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

test('multi-tag OR filter returns notes matching ANY selected tag', async ({ page }) => {
  const stamp = Date.now();
  const token = `multitag${stamp}`;
  const workTitle = `[multi-tag] Work-${token}`;
  const personalTitle = `[multi-tag] Personal-${token}`;
  const otherTitle = `[multi-tag] Other-${token}`;
  const workTag = `wt${stamp}`;
  const personalTag = `pt${stamp}`;
  const otherTag = `ot${stamp}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create three notes with distinct tags.
  await createNote(page, workTitle, 'work note body', workTag);
  await createNote(page, personalTitle, 'personal note body', personalTag);
  await createNote(page, otherTitle, 'other note body', otherTag);

  // Scope via search so we only see our test notes.
  const searchBox = page.getByRole('textbox', { name: /search notes/i });
  await searchBox.fill(token);

  // All three notes visible initially.
  await expect(page.getByRole('list')).toContainText(workTitle);
  await expect(page.getByRole('list')).toContainText(personalTitle);
  await expect(page.getByRole('list')).toContainText(otherTitle);

  // Ensure the mode toggle is showing "Match ANY" (OR mode is default).
  const modeToggle = page.getByRole('button', { name: /match any/i });
  await expect(modeToggle).toBeVisible();

  // Apply two-tag OR filter — work and personal notes should appear, other should not.
  const tagFilterInput = page.getByRole('textbox', { name: /filter by tag/i });
  await tagFilterInput.fill(`${workTag}, ${personalTag}`);

  await expect(page.getByRole('list')).toContainText(workTitle);
  await expect(page.getByRole('list')).toContainText(personalTitle);
  await expect(page.getByRole('list')).not.toContainText(otherTitle);
});

test('multi-tag AND filter returns fewer results than OR for same tag set', async ({ page }) => {
  const stamp = Date.now();
  const token = `multitag${stamp}`;
  const bothTitle = `[multi-tag] Both-${token}`;
  const workOnlyTitle = `[multi-tag] WorkOnly-${token}`;
  const urgentOnlyTitle = `[multi-tag] UrgentOnly-${token}`;
  const workTag = `wt${stamp}`;
  const urgentTag = `ut${stamp}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create notes: one with both tags, others with only one.
  await createNote(page, bothTitle, 'has both tags', `${workTag}, ${urgentTag}`);
  await createNote(page, workOnlyTitle, 'only work tag', workTag);
  await createNote(page, urgentOnlyTitle, 'only urgent tag', urgentTag);

  // Scope via search.
  const searchBox = page.getByRole('textbox', { name: /search notes/i });
  await searchBox.fill(token);

  const tagFilterInput = page.getByRole('textbox', { name: /filter by tag/i });
  const modeToggle = page.getByRole('button', { name: /match any/i });

  // Apply two-tag OR filter — all three notes have at least one of the tags.
  await tagFilterInput.fill(`${workTag}, ${urgentTag}`);
  await expect(page.getByRole('list')).toContainText(bothTitle);
  await expect(page.getByRole('list')).toContainText(workOnlyTitle);
  await expect(page.getByRole('list')).toContainText(urgentOnlyTitle);

  // Switch to AND mode — only the note with BOTH tags should appear.
  await modeToggle.click();
  await expect(page.getByRole('button', { name: /match all/i })).toBeVisible();

  // AND returns fewer results: only the note with both tags.
  await expect(page.getByRole('list')).toContainText(bothTitle);
  await expect(page.getByRole('list')).not.toContainText(workOnlyTitle);
  await expect(page.getByRole('list')).not.toContainText(urgentOnlyTitle);
});

test('zero-tag filter returns all notes (unfiltered)', async ({ page }) => {
  const stamp = Date.now();
  const token = `multitag${stamp}`;
  const noteATitle = `[multi-tag] NoteA-${token}`;
  const noteBTitle = `[multi-tag] NoteB-${token}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await createNote(page, noteATitle, 'body a', `ta${stamp}`);
  await createNote(page, noteBTitle, 'body b', `tb${stamp}`);

  // Scope via search.
  const searchBox = page.getByRole('textbox', { name: /search notes/i });
  await searchBox.fill(token);

  // Both notes visible with empty tag filter.
  await expect(page.getByRole('list')).toContainText(noteATitle);
  await expect(page.getByRole('list')).toContainText(noteBTitle);
});
