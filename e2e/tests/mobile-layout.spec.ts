import { test, expect } from '../fixtures';

/**
 * Mobile layout e2e — runs at 375 × 812 (iPhone SE / 8 viewport).
 *
 * Asserts:
 *  1. No horizontal scroll bar at 375 px width (320 px also checked).
 *  2. Key actions — create note, search, view note — complete without
 *     layout breakage.
 *  3. Touch targets (buttons) report a rendered height ≥ 44 px.
 *
 * State isolation: imports from `../fixtures` so the in-memory store is
 * reset before every test via the auto-fixture. No manual cleanup needed.
 */

const MOBILE_VIEWPORT = { width: 375, height: 812 };
const NARROW_VIEWPORT = { width: 320, height: 568 };

/** Helper: create a note via the form and wait for the title input to clear. */
async function createNote(
  page: import('@playwright/test').Page,
  title: string,
  body: string,
): Promise<void> {
  const titleInput = page.getByLabel(/^title$/i);
  await titleInput.fill(title);
  await page.getByLabel(/^body$/i).fill(body);
  await page.getByRole('button', { name: /add note/i }).click();
  await expect(titleInput).toHaveValue('');
}

/** Return true if the document has a horizontal scrollbar. */
async function hasHorizontalScrollbar(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}

test.describe('mobile layout — 375 × 812', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('no horizontal scroll on mobile viewport', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

    expect(await hasHorizontalScrollbar(page)).toBe(false);
  });

  test('create note completes without layout breakage', async ({ page }) => {
    const stamp = Date.now();
    const title = `[mobile-e2e] Create-${stamp}`;

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

    await createNote(page, title, 'mobile body content');

    const item = page.getByRole('listitem').filter({ hasText: title });
    await expect(item).toBeVisible();

    // Still no horizontal scroll after note appears
    expect(await hasHorizontalScrollbar(page)).toBe(false);
  });

  test('search filters notes on mobile', async ({ page }) => {
    const stamp = Date.now();
    const token = `mob${stamp}`;
    const alphaTitle = `[mobile-e2e] Alpha-${token}`;
    const betaTitle = `[mobile-e2e] Beta-${token}`;

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

    await createNote(page, alphaTitle, 'alpha body');
    await createNote(page, betaTitle, 'beta body');

    const searchBox = page.getByRole('textbox', { name: /search notes/i });
    await searchBox.fill(alphaTitle);

    await expect(page.getByRole('list')).toContainText(alphaTitle);
    await expect(page.getByRole('list')).not.toContainText(betaTitle);

    // No horizontal scroll during search
    expect(await hasHorizontalScrollbar(page)).toBe(false);
  });

  test('view note content on mobile', async ({ page }) => {
    const stamp = Date.now();
    const title = `[mobile-e2e] View-${stamp}`;
    const body = `mobile view body ${stamp}`;

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

    await createNote(page, title, body);

    const item = page.getByRole('listitem').filter({ hasText: title });
    await expect(item).toBeVisible();
    // Body text is rendered inside the note card
    await expect(item).toContainText(body);

    expect(await hasHorizontalScrollbar(page)).toBe(false);
  });

  test('pagination controls are accessible on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

    const prevBtn = page.getByRole('button', { name: /previous page/i });
    const nextBtn = page.getByRole('button', { name: /next page/i });

    await expect(prevBtn).toBeVisible();
    await expect(nextBtn).toBeVisible();

    // Buttons must meet the 44 px minimum touch target height
    const prevBox = await prevBtn.boundingBox();
    const nextBox = await nextBtn.boundingBox();
    expect(prevBox).not.toBeNull();
    expect(nextBox).not.toBeNull();
    expect(prevBox!.height).toBeGreaterThanOrEqual(44);
    expect(nextBox!.height).toBeGreaterThanOrEqual(44);

    expect(await hasHorizontalScrollbar(page)).toBe(false);
  });

  test('Add note button meets 44 px touch target', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

    const addBtn = page.getByRole('button', { name: /add note/i });
    await expect(addBtn).toBeVisible();

    const box = await addBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('mobile layout — 320 px width (no horizontal scroll)', () => {
  test.use({ viewport: NARROW_VIEWPORT });

  test('no horizontal scroll at 320 px viewport width', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

    expect(await hasHorizontalScrollbar(page)).toBe(false);
  });

  test('form is usable at 320 px — create note succeeds', async ({ page }) => {
    const stamp = Date.now();
    const title = `[mobile-e2e] Narrow-${stamp}`;

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

    await createNote(page, title, 'narrow viewport body');

    const item = page.getByRole('listitem').filter({ hasText: title });
    await expect(item).toBeVisible();

    expect(await hasHorizontalScrollbar(page)).toBe(false);
  });
});
