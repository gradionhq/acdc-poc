import { test as base, expect } from '@playwright/test';

// Reset the shared in-memory server before every test so specs don't accumulate
// state. The reset endpoint is mounted only when the server runs with
// ENABLE_TEST_RESET=1 (see playwright.config.ts webServer env).
export const test = base.extend<{ _reset: void }>({
  _reset: [
    async ({ request }, use) => {
      await request.post('http://localhost:3000/api/test/reset').catch(() => {});
      await use(undefined);
    },
    { auto: true },
  ],
});

export { expect };
