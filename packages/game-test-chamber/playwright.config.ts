import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './conformance',
  testMatch: 'browser.test.ts',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
