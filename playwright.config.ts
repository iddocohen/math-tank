import { defineConfig, devices } from '@playwright/test';

/** Specs that run only in the device projects (amendment 12, T136). */
const DEVICE_SPECS = /(devices|touch)\.spec\.ts$/;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Amendment 12 (T278): with SCREENSHOT_DIR set, tests/e2e/devices.spec.ts saves a screenshot of each screen size.
  metadata: { screenshotDir: process.env.SCREENSHOT_DIR },
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    // Test runs stay silent; tests/e2e/fixtures.ts also silences audio in every browser.
    { name: 'chromium', testIgnore: DEVICE_SPECS, use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--mute-audio'] } } },
    { name: 'webkit', testIgnore: DEVICE_SPECS, use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', testIgnore: DEVICE_SPECS, use: { ...devices['Desktop Firefox'], launchOptions: { firefoxUserPrefs: { 'media.volume_scale': '0.0' } } } },
    // Amendment 12 (T278): iPad held sideways and upright, and a phone held sideways, in WebKit with touch. They run
    // only the device specs, which keeps the e2e run short.
    { name: 'ipad-landscape', testMatch: DEVICE_SPECS, use: { ...devices['iPad Mini landscape'] } },
    { name: 'ipad-portrait', testMatch: DEVICE_SPECS, use: { ...devices['iPad Mini'] } },
    {
      name: 'iphone-landscape',
      testMatch: DEVICE_SPECS,
      use: { ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 } },
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
