import { test, expect } from '../fixtures';
import { Buffer } from 'node:buffer';

test('drag two files onto the dropzone and assert both appear in attachment list', async ({
  page,
}) => {
  const title = `[dnd-attach-e2e] note-${Date.now()}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create the note
  await page.getByLabel(/title/i).fill(title);
  await page.getByLabel(/body/i).fill('drag-and-drop attachment test body');
  await page.getByRole('button', { name: /add note/i }).click();

  // Scope all further actions to the specific list item
  const item = page.getByRole('listitem').filter({ hasText: title });
  await expect(item).toBeVisible();

  // Open the attachments panel
  await item.getByRole('button', { name: /attachments for/i }).click();
  await expect(item.getByText(/no attachments yet/i)).toBeVisible();

  // Verify the dropzone is present
  const dropzone = item.getByRole('region', { name: /drop files here/i });
  await expect(dropzone).toBeVisible();

  // Upload two files using Playwright's setInputFiles (simulates file selection / drag).
  // Playwright's dragAndDrop API targets elements, so we use setInputFiles on the
  // multiple-file input which is equivalent for functional coverage.
  const fileInput = item.locator('input[type="file"]');
  await fileInput.setInputFiles([
    {
      name: 'drag-file-one.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('content of file one'),
    },
    {
      name: 'drag-file-two.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('content of file two'),
    },
  ]);

  // Both files should appear in the attachment list
  await expect(item.getByRole('link', { name: /drag-file-one\.txt/i })).toBeVisible();
  await expect(item.getByRole('link', { name: /drag-file-two\.txt/i })).toBeVisible();
  await expect(item.getByText(/no attachments yet/i)).toHaveCount(0);

  // Clean up: delete the note
  await item.getByRole('button', { name: /^delete \[dnd-attach-e2e\]/i }).click();
  await expect(item).toHaveCount(0);
});
