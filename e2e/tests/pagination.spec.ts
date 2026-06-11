import { test, expect } from '../fixtures';

// Creates `count` notes with unique titles and returns them.
async function seedNotes(page: import('@playwright/test').Page, count: number): Promise<string[]> {
  const titles: string[] = [];
  for (let i = 1; i <= count; i++) {
    const title = `Pagination note ${Date.now()}-${i}`;
    titles.push(title);
    const titleInput = page.getByLabel(/title/i);
    await titleInput.fill(title);
    await page.getByLabel(/body/i).fill(`body ${i}`);
    await page.getByRole('button', { name: /add note/i }).click();
    // Wait for form to reset (title cleared) — confirms the note was accepted
    // before proceeding. The note may land on page 2+ and not be visible in the
    // current list, so we cannot rely on the list containing the new title.
    await expect(titleInput).toHaveValue('');
  }
  return titles;
}

test('pagination: next/prev controls work across multiple pages', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Switch to oldest sort so newly created notes land on the last page.
  // This ensures the app navigates to the last page after the 6th create,
  // which is the state this test is designed to assert.
  await page.getByRole('combobox', { name: /sort notes/i }).selectOption('oldest');

  // Seed 6 notes so we have 2 pages (pageSize = 5)
  const titles = await seedNotes(page, 6);

  // After creating the 6th note the app navigates to the LAST page so the
  // new note is immediately visible (oldest-first server ordering).
  // With pageSize=5 and 6 notes, page 2 is the last page.
  const prevBtn = page.getByRole('button', { name: /previous page/i });
  const nextBtn = page.getByRole('button', { name: /next page/i });

  // We should be on page 2 (last page): Next disabled, Previous enabled
  await expect(nextBtn).toBeDisabled();
  await expect(prevBtn).toBeEnabled();

  // The 6th (newest) note must be visible; the 1st (oldest) must not
  await expect(page.getByRole('list')).toContainText(titles[5]);
  await expect(page.getByRole('list')).not.toContainText(titles[0]);

  // Navigate back to page 1
  await prevBtn.click();
  await expect(page.getByRole('list')).toContainText(titles[0]);
  await expect(page.getByRole('list')).not.toContainText(titles[5]);

  // On page 1: Previous disabled, Next enabled
  await expect(prevBtn).toBeDisabled();
  await expect(nextBtn).toBeEnabled();

  // Navigate forward to page 2 again
  await nextBtn.click();
  await expect(page.getByRole('list')).toContainText(titles[5]);
  await expect(page.getByRole('list')).not.toContainText(titles[0]);

  // On the last page: Next disabled, Previous enabled
  await expect(nextBtn).toBeDisabled();
  await expect(prevBtn).toBeEnabled();

  // Clean up: delete all seeded notes.
  // Always go to page 1 first, then delete whatever is visible. Repeat until
  // all seeded titles are gone. This is robust to page shifts after deletion.
  const remaining = new Set(titles);
  while (remaining.size > 0) {
    // Go to page 1 to start from a known position
    while (await prevBtn.isEnabled()) {
      await prevBtn.click();
    }
    let deleted = false;
    for (const title of [...remaining]) {
      const item = page.getByRole('listitem').filter({ hasText: title });
      if (await item.isVisible()) {
        await item.getByRole('button', { name: /delete/i }).click();
        await expect(item).toHaveCount(0);
        remaining.delete(title);
        deleted = true;
        break; // restart the outer loop so page state is refreshed
      }
    }
    if (!deleted) {
      // All remaining notes must be on page 2+; advance one page and retry
      if (await nextBtn.isEnabled()) {
        await nextBtn.click();
      } else {
        break; // nothing left to delete
      }
    }
  }
});
