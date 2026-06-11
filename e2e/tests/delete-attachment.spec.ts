import { test, expect, confirmDeleteNote } from '../fixtures';
import { Buffer } from 'node:buffer';

test('upload two attachments, delete one, assert only the other remains', async ({ page }) => {
  const title = `[delete-att-e2e] note-${Date.now()}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create the note
  await page.getByLabel(/title/i).fill(title);
  await page.getByLabel(/body/i).fill('delete attachment test body');
  await page.getByRole('button', { name: /add note/i }).click();

  const item = page.getByRole('listitem').filter({ hasText: title });
  await expect(item).toBeVisible();

  // Open the attachments panel
  await item.getByRole('button', { name: /attachments for/i }).click();
  await expect(item.getByText(/no attachments yet/i)).toBeVisible();

  const fileInput = item.locator('input[type="file"]');

  // Upload first attachment
  await fileInput.setInputFiles({
    name: 'keep-me.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('i should stay'),
  });
  await expect(item.getByRole('link', { name: /keep-me\.txt/i })).toBeVisible();

  // Upload second attachment
  await fileInput.setInputFiles({
    name: 'delete-me.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('i will be removed'),
  });
  await expect(item.getByRole('link', { name: /delete-me\.txt/i })).toBeVisible();

  // Both files should be in the list
  await expect(item.getByRole('link', { name: /keep-me\.txt/i })).toBeVisible();
  await expect(item.getByRole('link', { name: /delete-me\.txt/i })).toBeVisible();

  // Click delete on delete-me.txt; accept the confirmation dialog
  page.once('dialog', (dialog) => dialog.accept());
  await item.getByRole('button', { name: /delete attachment delete-me\.txt/i }).click();

  // delete-me.txt must be gone; keep-me.txt must remain
  await expect(item.getByRole('link', { name: /delete-me\.txt/i })).toHaveCount(0);
  await expect(item.getByRole('link', { name: /keep-me\.txt/i })).toBeVisible();

  // Clean up
  await confirmDeleteNote(item, /^delete \[delete-att-e2e\]/i);
  await expect(item).toHaveCount(0);
});
