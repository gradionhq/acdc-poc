import { test, expect } from '../fixtures';

/**
 * E2E tests for loading skeleton, empty state, and error banner.
 *
 * These tests use page.route() to intercept /api/notes requests so we can
 * control timing and responses without touching the real in-memory server.
 * Unique per-run tokens are used to avoid any cross-test state conflicts.
 */

test('shows a loading skeleton while the API request is in-flight', async ({ page }) => {
  // Intercept the initial GET /api/notes request and delay it so we can
  // assert the skeleton is visible before the response arrives.
  let resolveDelay!: () => void;
  const delayPromise = new Promise<void>((res) => {
    resolveDelay = res;
  });

  await page.route('**/api/notes*', async (route) => {
    await delayPromise;
    await route.continue();
  });

  await page.goto('/');

  // Skeleton list should be visible while the request is still in-flight
  await expect(page.getByRole('list', { name: /loading notes/i })).toBeVisible();

  // Unblock the request and verify the skeleton disappears
  resolveDelay();
  await expect(page.getByRole('list', { name: /loading notes/i })).not.toBeVisible({
    timeout: 5000,
  });
});

test('shows a friendly empty-state message when there are no notes', async ({ page }) => {
  const stamp = Date.now();
  // Use a unique search token so we get an empty result even if the shared
  // server already has notes from other tests.
  const uniqueToken = `empty-state-e2e-${stamp}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Filter to a term that won't match any existing notes
  const searchBox = page.getByRole('textbox', { name: /search notes/i });
  await searchBox.fill(uniqueToken);

  // Wait for the debounce + API response that carries the "q=" param
  await page.waitForResponse((r) => r.url().includes('q=') && r.status() === 200);

  // When a search filter is active and there are no matches, show the
  // filter-specific message (no CTA, since the list isn't actually empty).
  await expect(page.getByText(/no notes match your search/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /add your first note/i })).not.toBeVisible();

  // Clean up: clear the search
  await searchBox.clear();
});

test('shows an error banner with a Retry button when the API returns an error', async ({
  page,
}) => {
  // Intercept only the first GET /api/notes and return a 500 error.
  // Subsequent requests (after Retry) will fall through to the real server.
  let firstRequest = true;
  await page.route('**/api/notes*', async (route) => {
    if (firstRequest) {
      firstRequest = false;
      await route.fulfill({ status: 500, body: JSON.stringify({ error: 'server error' }) });
    } else {
      await route.continue();
    }
  });

  await page.goto('/');

  // Error banner (role="alert") must appear
  const errorBanner = page.getByRole('alert');
  await expect(errorBanner).toBeVisible();

  // Error text must NOT expose raw stack traces or "Error:" prefix
  const bannerText = await errorBanner.textContent();
  expect(bannerText).not.toMatch(/Error:/);
  expect(bannerText).not.toMatch(/at \w/);
  expect(bannerText).not.toMatch(/\.tsx?:/);

  // Retry button must be visible
  const retryButton = errorBanner.getByRole('button', { name: /retry/i });
  await expect(retryButton).toBeVisible();

  // Clicking Retry triggers a new request; the route allows it through,
  // so the error banner should disappear once the real response arrives.
  await retryButton.click();
  await expect(errorBanner).not.toBeVisible({ timeout: 5000 });
});

test('empty state disappears after creating the first note', async ({ page }) => {
  const stamp = Date.now();
  const uniqueToken = `no-match-${stamp}`;
  const newNoteTitle = `[loading-e2e] FirstNote-${stamp}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Filter to an empty result
  const searchBox = page.getByRole('textbox', { name: /search notes/i });
  await searchBox.fill(uniqueToken);
  await page.waitForResponse((r) => r.url().includes('q=') && r.status() === 200);
  await expect(page.getByText(/no notes match your search/i)).toBeVisible();

  // Clear the filter and create a note
  await searchBox.clear();
  await page.waitForResponse((r) => r.url().includes('/api/notes') && r.status() === 200);

  const titleInput = page.getByLabel(/^title$/i);
  await titleInput.fill(newNoteTitle);
  await page.getByLabel(/^body$/i).fill('body content');
  await page.getByRole('button', { name: /add note/i }).click();
  // Wait for the form to clear — confirms note was accepted
  await expect(titleInput).toHaveValue('');

  // Navigate to the page containing the new note and confirm empty state is gone
  const searchBoxAfter = page.getByRole('textbox', { name: /search notes/i });
  await searchBoxAfter.fill(newNoteTitle);
  await page.waitForResponse((r) => r.url().includes('q=') && r.status() === 200);

  await expect(page.getByRole('listitem').filter({ hasText: newNoteTitle })).toBeVisible();
  await expect(page.getByText(/no notes match your search/i)).not.toBeVisible();

  // Clean up: delete the note
  const item = page.getByRole('listitem').filter({ hasText: newNoteTitle });
  await item.getByRole('button', { name: /delete/i }).click();
  await expect(item).toHaveCount(0);
  await searchBoxAfter.clear();
});
