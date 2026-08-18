import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './conformance',
  testMatch: 'browser.harness.test.ts',
  timeout: 120_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 14'] } },
  ],
});
