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
    // start:prod (root) builds the SPA then boots Express serving web/dist
    command: 'npm run start:prod --prefix ..',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
