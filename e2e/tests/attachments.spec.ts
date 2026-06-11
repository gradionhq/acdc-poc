import { test, expect } from '../fixtures';
import { Buffer } from 'node:buffer';

test('attach a file to a note and download it', async ({ page }) => {
  // Unique title per run — avoids collisions with notes left by other test runs
  // in the shared in-memory server (reuseExistingServer=true locally).
  const title = `[attach-e2e] note-${Date.now()}`;
  const fileContent = 'hello from playwright attachment test';

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create the note
  await page.getByLabel(/title/i).fill(title);
  await page.getByLabel(/body/i).fill('attachment test body');
  await page.getByRole('button', { name: /add note/i }).click();

  // Scope all further actions to the specific list item so pagination
  // and other notes in the shared server cannot cause mis-clicks.
  const item = page.getByRole('listitem').filter({ hasText: title });
  await expect(item).toBeVisible();

  // Open the attachments panel
  await item.getByRole('button', { name: /attachments for/i }).click();
  await expect(item.getByText(/no attachments yet/i)).toBeVisible();

  // Upload a file using Playwright's setInputFiles
  const fileInput = item.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'test-file.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(fileContent),
  });

  // After upload the file should appear in the attachment list
  const downloadLink = item.getByRole('link', { name: /test-file\.txt/i });
  await expect(downloadLink).toBeVisible();
  await expect(item.getByText(/no attachments yet/i)).toHaveCount(0);

  // Trigger the download and verify the file content
  const [download] = await Promise.all([page.waitForEvent('download'), downloadLink.click()]);
  const path = await download.path();
  expect(path).toBeTruthy();
  const { readFileSync } = await import('node:fs');
  const downloaded = readFileSync(path!).toString('utf-8');
  expect(downloaded).toBe(fileContent);

  // Clean up: delete the note so it doesn't pollute other test runs
  await item.getByRole('button', { name: /^delete \[attach-e2e\]/i }).click();
  await expect(item).toHaveCount(0);
});
