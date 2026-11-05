import { defineConfig, devices } from '@playwright/test';

/** Specs that run only in the device projects (amendment 12, T136, T306). */
const DEVICE_SPECS = /(devices|touch|rotation)\.spec\.ts$/;
/** The smoke test of the build for GitHub Pages runs only in the `base-path` project (P11, T304). */
const BASE_PATH_SPEC = /basePath\.spec\.ts$/;
/** The frame rate test runs alone, after every other project (T150). */
const PERFORMANCE_SPEC = /performance\.spec\.ts$/;
/**
 * Chromium draws WebGL with the graphics card only when asked; headless it uses software rendering (SwiftShader),
 * which is far slower than a child's computer. On macOS the performance project uses Metal through ANGLE.
 */
const GPU_ARGS = process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [];
/** The game as GitHub Pages serves it: built with `--base=/math-tank/` into its own folder, on its own port. */
const BASE_PATH_URL = 'http://localhost:4174/math-tank/';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // P6 (T303): every worker runs a browser that renders the battlefield; with more of them at once, Phaser's capped
  // time step makes game time run slower than wall time and waits time out. 4 workers keep a full run at about 5 minutes.
  // PW_WORKERS changes the number for one run.
  workers: Number(process.env.PW_WORKERS) || 4,
  // Specs that play a round wait on game state for up to GAME_WAIT (tests/e2e/fixtures.ts) per step.
  timeout: 60_000,
  // Amendment 12 (T278): with SCREENSHOT_DIR set, tests/e2e/devices.spec.ts saves a screenshot of each screen size.
  metadata: { screenshotDir: process.env.SCREENSHOT_DIR },
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    // Test runs stay silent; tests/e2e/fixtures.ts also silences audio in every browser.
    { name: 'chromium', testIgnore: [DEVICE_SPECS, BASE_PATH_SPEC, PERFORMANCE_SPEC], use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--mute-audio'] } } },
    { name: 'webkit', testIgnore: [DEVICE_SPECS, BASE_PATH_SPEC, PERFORMANCE_SPEC], use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', testIgnore: [DEVICE_SPECS, BASE_PATH_SPEC, PERFORMANCE_SPEC], use: { ...devices['Desktop Firefox'], launchOptions: { firefoxUserPrefs: { 'media.volume_scale': '0.0' } } } },
    // Amendment 12 (T278): iPad held sideways and upright, and a phone held sideways, in WebKit with touch. They run
    // only the device specs, which keeps the e2e run short.
    { name: 'ipad-landscape', testMatch: DEVICE_SPECS, use: { ...devices['iPad Mini landscape'] } },
    { name: 'ipad-portrait', testMatch: DEVICE_SPECS, use: { ...devices['iPad Mini'] } },
    {
      name: 'iphone-landscape',
      testMatch: DEVICE_SPECS,
      use: { ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 } },
    },
    // P11 (T304): the build for GitHub Pages under /math-tank/, in Chromium.
    { name: 'base-path', testMatch: BASE_PATH_SPEC, use: { ...devices['Desktop Chrome'], baseURL: BASE_PATH_URL, launchOptions: { args: ['--mute-audio'] } } },
    // T150: start time and frame rate in Chromium, after all other projects so no other browser renders at the same
    // time. `--no-deps` runs it alone.
    {
      name: 'performance',
      testMatch: PERFORMANCE_SPEC,
      dependencies: ['chromium', 'webkit', 'firefox', 'ipad-landscape', 'ipad-portrait', 'iphone-landscape', 'base-path'],
      use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--mute-audio', ...GPU_ARGS] } },
    },
  ],
  webServer: [
    {
      command: 'pnpm build && pnpm preview --port 4173',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // Its own output folder, so the two builds do not overwrite each other.
      command: 'pnpm exec vite build --base=/math-tank/ --outDir dist-base && pnpm exec vite preview --base=/math-tank/ --outDir dist-base --port 4174 --strictPort',
      url: BASE_PATH_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
