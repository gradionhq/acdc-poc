import { test, expect } from '@playwright/test';

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

test('create a tagged note and assert the tag renders', async ({ page }) => {
  // Use a unique per-run token to avoid collisions with accumulated server state.
  const stamp = Date.now();
  const title = `[tags-e2e] Note-${stamp}`;
  const tag = `tag${stamp}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await createNote(page, title, 'proof of work body', tag);

  // Find the note in the list via search to avoid pagination issues.
  const searchBox = page.getByRole('textbox', { name: /search notes/i });
  await searchBox.fill(title);

  const item = page.getByRole('listitem').filter({ hasText: title });
  await expect(item).toBeVisible();

  // The tag must be rendered inside the note list item.
  await expect(item).toContainText(tag);
});

test('edit tags on a note and see updated tags', async ({ page }) => {
  const stamp = Date.now();
  const title = `[tags-e2e] EditTags-${stamp}`;
  const originalTag = `original${stamp}`;
  const updatedTag = `updated${stamp}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await createNote(page, title, 'body for tag editing', originalTag);

  // Locate the note via search to avoid pagination cliff.
  const searchBox = page.getByRole('textbox', { name: /search notes/i });
  await searchBox.fill(title);

  const item = page.getByRole('listitem').filter({ hasText: title });
  await expect(item).toBeVisible();
  await expect(item).toContainText(originalTag);

  // Open inline edit form.
  await item.getByRole('button', { name: /edit/i }).click();

  const editTagsInput = page.getByRole('textbox', { name: /edit tags/i });
  await expect(editTagsInput).toBeVisible();

  // Replace tag.
  await editTagsInput.clear();
  await editTagsInput.fill(updatedTag);

  await page.getByRole('button', { name: /save/i }).click();

  // Updated tag should appear; original tag should be gone.
  const updatedItem = page.getByRole('listitem').filter({ hasText: title });
  await expect(updatedItem).toContainText(updatedTag);
  await expect(updatedItem).not.toContainText(originalTag);
});

test('filter notes by tag using the tag filter input', async ({ page }) => {
  // A shared per-run token embedded in both titles so a single search
  // term can retrieve both notes regardless of accumulated server state.
  const stamp = Date.now();
  const token = `tagsfilter${stamp}`;
  const workTitle = `[tags-e2e] Work-${token}`;
  const personalTitle = `[tags-e2e] Personal-${token}`;
  const workTag = `worktag${stamp}`;
  const personalTag = `personaltag${stamp}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await createNote(page, workTitle, 'work note body', workTag);
  await createNote(page, personalTitle, 'personal note body', personalTag);

  const tagFilterInput = page.getByRole('textbox', { name: /filter by tag/i });
  const searchBox = page.getByRole('textbox', { name: /search notes/i });

  // First scope the list to only our two notes via search, then apply tag filter.
  await searchBox.fill(token);

  // With search active, both notes should be visible in the list.
  await expect(page.getByRole('list')).toContainText(workTitle);
  await expect(page.getByRole('list')).toContainText(personalTitle);

  // Apply tag filter — only the work note should appear (personal is excluded).
  await tagFilterInput.fill(workTag);
  await expect(page.getByRole('list')).toContainText(workTitle);
  await expect(page.getByRole('list')).not.toContainText(personalTitle);

  // Clear tag filter (keep search active) — both notes should reappear.
  await tagFilterInput.clear();
  await expect(page.getByRole('list')).toContainText(workTitle);
  await expect(page.getByRole('list')).toContainText(personalTitle);
});
