import { test, expect } from '../fixtures';

test('create then edit a note and see updated text', async ({ page }) => {
  const title = `[edit-e2e] note-${Date.now()}`;
  const updatedTitle = `${title} updated`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create the note
  await page.getByLabel(/title/i).fill(title);
  await page.getByLabel(/body/i).fill('original body');
  await page.getByRole('button', { name: /add note/i }).click();

  const item = page.getByRole('listitem').filter({ hasText: title });
  await expect(item).toBeVisible();

  // Open the inline edit form (aria-label is "Edit <title>", anchored with ^ to
  // avoid matching "Attachments for …edit…" when the title contains "edit").
  await item.getByRole('button', { name: /^edit /i }).click();

  // The edit inputs should now be visible
  const editTitleInput = page.getByRole('textbox', { name: /edit title/i });
  const editBodyInput = page.getByRole('textbox', { name: /edit body/i });
  await expect(editTitleInput).toBeVisible();
  await expect(editBodyInput).toBeVisible();

  // Update the title
  await editTitleInput.clear();
  await editTitleInput.fill(updatedTitle);

  // Save
  await page.getByRole('button', { name: /save/i }).click();

  // The updated title should now appear in the list
  const updatedItem = page.getByRole('listitem').filter({ hasText: updatedTitle });
  await expect(updatedItem).toBeVisible();

  // The original title should be gone
  await expect(
    page.getByRole('listitem').filter({ hasText: title }).filter({ hasNotText: updatedTitle }),
  ).toHaveCount(0);
});
