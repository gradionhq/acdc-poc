import { test, expect } from '../fixtures';

test('note body renders Markdown headings and lists', async ({ page }) => {
  const title = `[md-e2e] markdown-${Date.now()}`;
  const body = [
    '# Main Heading',
    '',
    'Some introductory text.',
    '',
    '## Sub Heading',
    '',
    '- item one',
    '- item two',
    '- item three',
  ].join('\n');

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await page.getByLabel(/title/i).fill(title);
  // The body textarea is labelled "Body" in the create form
  await page.getByLabel(/^body$/i).fill(body);
  await page.getByRole('button', { name: /add note/i }).click();

  const item = page.getByRole('listitem').filter({ hasText: title });
  await expect(item).toBeVisible();

  // The rendered Markdown should produce real heading elements
  await expect(item.getByRole('heading', { level: 1, name: 'Main Heading' })).toBeVisible();
  await expect(item.getByRole('heading', { level: 2, name: 'Sub Heading' })).toBeVisible();

  // The list items should be rendered as real <li> elements inside a list.
  // Note: ARIA does not compute the accessible name of <li> from its text
  // content, so we use locator('li') with hasText rather than getByRole with a
  // name filter.
  const list = item.getByRole('list').first();
  await expect(list).toBeVisible();
  await expect(list.locator('li', { hasText: 'item one' })).toBeVisible();
  await expect(list.locator('li', { hasText: 'item two' })).toBeVisible();
  await expect(list.locator('li', { hasText: 'item three' })).toBeVisible();
});

test('note edit form shows raw Markdown source, not rendered HTML', async ({ page }) => {
  const title = `[md-e2e] raw-source-${Date.now()}`;
  const body = '# A Heading\n\n- list item';

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await page.getByLabel(/title/i).fill(title);
  await page.getByLabel(/^body$/i).fill(body);
  await page.getByRole('button', { name: /add note/i }).click();

  const item = page.getByRole('listitem').filter({ hasText: title });
  await expect(item).toBeVisible();

  // Open edit mode — the edit textarea should show the raw Markdown source
  await item.getByRole('button', { name: /^edit /i }).click();

  const editBodyInput = page.getByRole('textbox', { name: /edit body/i });
  await expect(editBodyInput).toBeVisible();
  // The raw markdown should be present as the textarea value, not rendered HTML
  await expect(editBodyInput).toHaveValue(body);
});

test('script tags in note body are NOT executed (XSS safety)', async ({ page }) => {
  const title = `[md-e2e] xss-${Date.now()}`;
  const body = '<script>window.__xssTest = "injected";</script>\n\nSafe content';

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await page.getByLabel(/title/i).fill(title);
  await page.getByLabel(/^body$/i).fill(body);
  await page.getByRole('button', { name: /add note/i }).click();

  const item = page.getByRole('listitem').filter({ hasText: title });
  await expect(item).toBeVisible();

  // The script should NOT have executed
  const xssResult = await page.evaluate(() => (window as Record<string, unknown>).__xssTest);
  expect(xssResult).toBeUndefined();
});
