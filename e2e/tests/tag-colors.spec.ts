import { test, expect } from '../fixtures';

// Creates a note via the UI with the given tags (comma-separated).
// Waits for the title input to clear, confirming the server accepted the note.
async function createNote(
  page: import('@playwright/test').Page,
  title: string,
  body: string,
  tags: string,
): Promise<void> {
  const titleInput = page.getByLabel(/^title$/i);
  await titleInput.fill(title);
  await page.getByLabel(/^body$/i).fill(body);
  await page.getByRole('textbox', { name: /^tags$/i }).fill(tags);
  await page.getByRole('button', { name: /add note/i }).click();
  await expect(titleInput).toHaveValue('');
}

test('assigning a color to a tag colors its chip on the note card', async ({ page }) => {
  const stamp = Date.now();
  const title = `[tag-color] Note-${stamp}`;
  const tag = `tagcolor-${stamp}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create a note carrying the tag.
  await createNote(page, title, 'body', tag);

  const noteItem = page.getByRole('listitem').filter({ hasText: title });
  await expect(noteItem).toBeVisible();

  // Initially the chip uses the default (no) color.
  const chipOnCard = noteItem.locator(`[data-tag="${tag}"]`);
  await expect(chipOnCard).toHaveAttribute('data-tag-color', 'none');

  // Open the tag manager and assign the tag a color.
  await page.getByRole('button', { name: /manage tags/i }).click();
  await expect(page.getByRole('region', { name: /tag manager/i })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`set ${tag} color green`, 'i') }).click();

  // The swatch reflects the selection.
  await expect(
    page.getByRole('button', { name: new RegExp(`set ${tag} color green`, 'i') }),
  ).toHaveAttribute('aria-pressed', 'true');

  // Close the tag manager and verify the chip on the note card is now green.
  await page.getByRole('button', { name: /hide tag manager/i }).click();

  const coloredChip = noteItem.locator(`[data-tag="${tag}"]`);
  await expect(coloredChip).toHaveAttribute('data-tag-color', 'green');

  // The rendered chip text must keep an accessible (non-transparent) color.
  await expect(coloredChip).toHaveCSS('color', /rgb/);

  // The colored chip also appears in the filter bar chip row.
  const filterChips = page.getByLabel(/filter by tag chips/i);
  await expect(filterChips.locator(`[data-tag="${tag}"]`)).toHaveAttribute(
    'data-tag-color',
    'green',
  );
});
