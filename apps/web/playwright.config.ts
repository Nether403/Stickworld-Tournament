import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  webServer: {
    command: process.env.CI ? 'pnpm start --port 3000' : 'pnpm dev --port 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:3000',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox',
      grep: /@cross-browser/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      grep: /@cross-browser/,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-webkit',
      grep: /@cross-browser/,
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'mobile-chromium',
      grep: /@cross-browser/,
      use: { ...devices['Pixel 5'] },
    },
  ],
});
