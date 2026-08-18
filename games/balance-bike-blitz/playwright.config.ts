import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './conformance',
  testMatch: 'browser.test.ts',
  timeout: 90_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
