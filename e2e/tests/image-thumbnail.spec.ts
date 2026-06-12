import { test, expect, confirmDeleteNote } from '../fixtures';
import { Buffer } from 'node:buffer';

// Minimal 1×1 red PNG (67 bytes) — valid image so the browser can decode it.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';

test('image attachment shows an inline thumbnail; non-image does not', async ({ page }) => {
  const title = `[thumb-e2e] note-${Date.now()}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create the note
  await page.getByLabel(/title/i).fill(title);
  await page.getByLabel(/body/i).fill('thumbnail test body');
  await page.getByRole('button', { name: /add note/i }).click();

  const item = page.getByRole('listitem').filter({ hasText: title });
  await expect(item).toBeVisible();

  // Open the attachments panel
  await item.getByRole('button', { name: /attachments for/i }).click();
  await expect(item.getByText(/no attachments yet/i)).toBeVisible();

  const fileInput = item.locator('input[type="file"]');

  // Upload a PNG image attachment
  await fileInput.setInputFiles({
    name: 'tiny.png',
    mimeType: 'image/png',
    buffer: Buffer.from(TINY_PNG_BASE64, 'base64'),
  });

  // The text download link should appear
  await expect(item.getByRole('link', { name: /^download tiny\.png$/i })).toBeVisible();

  // An <img> thumbnail must be rendered and visible
  const thumbnail = item.getByRole('img', { name: /thumbnail for tiny\.png/i });
  await expect(thumbnail).toBeVisible();
  await expect(thumbnail).toHaveAttribute('loading', 'lazy');

  // Upload a plain-text attachment — it must NOT get a thumbnail
  await fileInput.setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('just text'),
  });
  await expect(item.getByRole('link', { name: /notes\.txt/i })).toBeVisible();
  await expect(item.getByRole('img', { name: /thumbnail for notes\.txt/i })).toHaveCount(0);

  // Clicking the thumbnail still triggers a download
  const [download] = await Promise.all([page.waitForEvent('download'), thumbnail.click()]);
  expect(download.suggestedFilename()).toBe('tiny.png');

  // Clean up
  await confirmDeleteNote(item, new RegExp(`^delete \\[thumb-e2e\\]`, 'i'));
  await expect(item).toHaveCount(0);
});
