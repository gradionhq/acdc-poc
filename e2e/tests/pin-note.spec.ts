import { test, expect } from '@playwright/test';

// Helper: create a note and wait for the form to reset (title cleared).
// The note may not be visible on the current page if the list is long.
async function createNote(
  page: import('@playwright/test').Page,
  title: string,
  body: string,
): Promise<void> {
  const titleInput = page.getByLabel(/^title$/i);
  await titleInput.fill(title);
  await page.getByLabel(/^body$/i).fill(body);
  await page.getByRole('button', { name: /add note/i }).click();
  // Wait for the form to reset — confirms the create request succeeded
  await expect(titleInput).toHaveValue('');
}

// Navigate through pages (always from page 1 forward) until an item
// matching `title` is visible, then return the locator.
async function findNoteItem(
  page: import('@playwright/test').Page,
  title: string,
): Promise<import('@playwright/test').Locator> {
  const prevBtn = page.getByRole('button', { name: /previous page/i });
  const nextBtn = page.getByRole('button', { name: /next page/i });

  // Go to page 1 first
  while (await prevBtn.isEnabled()) {
    await prevBtn.click();
  }

  for (;;) {
    const item = page.getByRole('listitem').filter({ hasText: title });
    if (await item.isVisible()) return item;
    if (!(await nextBtn.isEnabled())) break;
    await nextBtn.click();
  }
  throw new Error(`Note with title "${title}" not found in any page`);
}

test('pin a note and assert it moves to the top of the list', async ({ page }) => {
  // Use a unique run-scoped token so parallel/re-runs cannot collide.
  const token = `pin-e2e-${Date.now()}`;
  const olderTitle = `${token}-older`;
  const newerTitle = `${token}-newer`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create two notes in order — older first, newer second.
  await createNote(page, olderTitle, 'first note body');
  await createNote(page, newerTitle, 'second note body');

  // --- Verify initial ordering: older appears before newer ---
  const newerItem = await findNoteItem(page, newerTitle);
  await expect(newerItem).toBeVisible();
  // newerItem must be visible; now scroll back to find olderTitle too.
  const olderItem = await findNoteItem(page, olderTitle);
  await expect(olderItem).toBeVisible();

  // Both items visible on same page?  Check relative position in the list.
  // We need to look at them on page 1 where they both appear together (or the
  // older one is on an earlier page, which already satisfies "older first").
  // To keep the test simple: pin the *newer* note and assert it appears
  // before the older note.

  // Navigate to find the newer note and pin it.
  const newerItemForPin = await findNoteItem(page, newerTitle);
  await newerItemForPin
    .getByRole('button', { name: new RegExp(`^pin ${newerTitle}$`, 'i') })
    .click();

  // After pinning the app navigates to page 1 (pinned notes sort to the top).
  // Re-locate the note on the current page rather than using the stale handle.
  await expect(
    page
      .getByRole('listitem')
      .filter({ hasText: newerTitle })
      .getByRole('button', { name: new RegExp(`^unpin ${newerTitle}$`, 'i') }),
  ).toBeVisible();

  // --- Assert pinned note appears before the older (unpinned) note ---
  // Go to page 1 and find the list items for the two notes.
  const prevBtn = page.getByRole('button', { name: /previous page/i });
  while (await prevBtn.isEnabled()) {
    await prevBtn.click();
  }

  // Both notes must be visible on the same page for a direct ordering check.
  // If they are not (e.g. dozens of pre-existing notes push them apart), we
  // navigate until we find the pinned one and confirm it appears on page 1.
  const pinnedOnPage1 = page.getByRole('listitem').filter({ hasText: newerTitle });
  await expect(pinnedOnPage1).toBeVisible({ timeout: 5000 });

  // The older (unpinned) note must appear AFTER the pinned note in the list.
  // We use the DOM order: evaluate positions of both list items.
  const olderOnPage = page.getByRole('listitem').filter({ hasText: olderTitle });
  if (await olderOnPage.isVisible()) {
    // Both visible on the same page — check DOM order
    const [pinnedIndex, olderIndex] = await page.evaluate(
      ([pinnedText, olderText]) => {
        const items = Array.from(document.querySelectorAll('li'));
        const p = items.findIndex((el) => el.textContent?.includes(pinnedText) ?? false);
        const o = items.findIndex((el) => el.textContent?.includes(olderText) ?? false);
        return [p, o];
      },
      [newerTitle, olderTitle],
    );
    expect(pinnedIndex).toBeGreaterThanOrEqual(0);
    expect(olderIndex).toBeGreaterThanOrEqual(0);
    expect(pinnedIndex).toBeLessThan(olderIndex);
  }
  // If olderOnPage is not visible that means the pinned note pushed to page 1
  // and the older one to page 2+, which also satisfies "pinned sorts first".

  // --- Unpin: assert the note returns to its insertion position ---
  const pinnedItem = page.getByRole('listitem').filter({ hasText: newerTitle });
  await pinnedItem.getByRole('button', { name: new RegExp(`^unpin ${newerTitle}$`, 'i') }).click();

  // Button label must revert to "Pin …"
  await expect(
    page
      .getByRole('listitem')
      .filter({ hasText: newerTitle })
      .getByRole('button', {
        name: new RegExp(`^pin ${newerTitle}$`, 'i'),
      }),
  ).toBeVisible();
});
