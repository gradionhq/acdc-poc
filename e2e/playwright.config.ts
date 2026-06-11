import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  // Run all specs serially with a single worker. The entire e2e suite shares
  // one long-lived in-memory server (no DB isolation between tests), so
  // parallel workers race on the shared note list and cause flaky ordering /
  // pagination assertions.
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:3000',
    video: 'on',
    trace: 'on',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // start:prod (root) builds the SPA then boots Express serving web/dist.
    // RATE_LIMIT_MAX and RATE_LIMIT_WINDOW_MS are forwarded so the e2e suite
    // can run with a custom window if needed.
    command: 'npm run start:prod --prefix ..',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      // Reset the in-memory store before every spec (see e2e/fixtures.ts).
      ENABLE_TEST_RESET: '1',
      // Use a very high limit so the e2e suite (which makes many API calls
      // during pagination, search, and pin tests) is never throttled.
      // The rate-limiter logic is covered by server-side unit tests; e2e
      // should not exercise a low global limit that breaks other specs.
      RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX ?? '100000',
      RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS ?? '60000',
    },
  },
});
