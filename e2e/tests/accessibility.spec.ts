import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';
import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';

// Severities we treat as hard failures. axe also reports "minor" and "moderate"
// issues (mostly best-practice nits); the acceptance criterion is zero
// serious/critical violations, so we gate on those two impact levels only.
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

/** Run axe against the current page and return only serious/critical violations. */
async function blockingViolations(page: Page): Promise<Result[]> {
  const results = await new AxeBuilder({ page })
    // WCAG 2.0/2.1 A & AA — the standard the issue targets.
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.filter((v) => v.impact != null && BLOCKING_IMPACTS.has(v.impact));
}

/** Compact, readable summary so a failure points straight at the offending rule + node. */
function summarize(violations: Result[]): string {
  return violations
    .map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target).join('\n  ')}`)
    .join('\n');
}

// Seed one note so the audit covers a populated list (note card, headings,
// action buttons, tags) rather than just the empty state.
async function seedNote(page: Page): Promise<void> {
  const title = `A11y note ${Date.now()}`;
  await page.getByLabel(/^title$/i).fill(title);
  await page.getByLabel(/^body$/i).fill('Accessibility audit body with a #tag.');
  await page.getByLabel(/^tags$/i).fill('a11y');
  await page.getByRole('button', { name: /add note/i }).click();
  await expect(page.getByRole('listitem').filter({ hasText: title })).toBeVisible();
}

test.describe('accessibility (axe)', () => {
  test('main view has no serious/critical violations in light mode', async ({ page }) => {
    await page.goto('/');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();
    await seedNote(page);

    const violations = await blockingViolations(page);
    expect(violations, summarize(violations)).toEqual([]);
  });

  test('main view has no serious/critical violations in dark mode', async ({ page }) => {
    await page.goto('/');
    await page.emulateMedia({ colorScheme: 'dark' });
    // Drive the in-app toggle so data-theme="dark" is applied to <html>.
    const toggle = page.getByRole('button', { name: /switch to dark mode/i });
    if (await toggle.isVisible()) {
      await toggle.click();
    }
    await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();
    await seedNote(page);

    const violations = await blockingViolations(page);
    expect(violations, summarize(violations)).toEqual([]);
  });

  test('confirm dialog has no serious/critical violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();
    await seedNote(page);

    const item = page
      .getByRole('listitem')
      .filter({ hasText: /a11y note/i })
      .first();
    await item.getByRole('button', { name: /more actions/i }).click();
    await item.getByRole('menuitem', { name: /delete/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const violations = await blockingViolations(page);
    expect(violations, summarize(violations)).toEqual([]);
  });
});
