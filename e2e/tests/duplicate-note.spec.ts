import { test, expect } from '../fixtures';

test('duplicate a note — two notes with similar titles, editing one does not affect the other', async ({
  page,
}) => {
  const title = `[dup-e2e] note-${Date.now()}`;
  const copyTitle = `Copy of ${title}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create the original note
  await page.getByLabel(/title/i).fill(title);
  await page.getByLabel(/body/i).fill('original body');
  await page.getByRole('button', { name: /add note/i }).click();

  const item = page.getByRole('listitem').filter({ hasText: title });
  await expect(item).toBeVisible();

  // Duplicate the note
  await item.getByRole('button', { name: /^duplicate /i }).click();

  // Both the original and the copy should appear
  const originalItem = page.getByRole('listitem').filter({ hasText: title }).filter({
    hasNotText: copyTitle,
  });
  const copyItem = page.getByRole('listitem').filter({ hasText: copyTitle });

  await expect(originalItem).toBeVisible();
  await expect(copyItem).toBeVisible();

  // Edit the original — the copy's title should stay unchanged
  await originalItem.getByRole('button', { name: /^edit /i }).click();
  const editTitleInput = page.getByRole('textbox', { name: /edit title/i });
  await editTitleInput.clear();
  await editTitleInput.fill(`${title} edited`);
  await page.getByRole('button', { name: /save/i }).click();

  await expect(page.getByRole('listitem').filter({ hasText: `${title} edited` })).toBeVisible();
  await expect(copyItem).toBeVisible();
  await expect(copyItem).toContainText(copyTitle);
});
