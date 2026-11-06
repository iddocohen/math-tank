/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * The build version (bug "iPhone rotation in Chrome", Phase 24; src/app/buildInfo.ts): APP_VERSION when set (the update
 * e2e test builds two versions), the short GITHUB_SHA in CI, the short git commit locally, or the package version
 * without git.
 */
function buildVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version;
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // Fast, safe updates (Phase 24): a new worker removes caches of older Workbox versions, and the precache drops
        // the files of the old build when it activates; it takes control of open pages at once after activation.
        // index.html is precached with a revision (its content hash), so every build with other files gives a new
        // service worker. The worker still waits until the app applies it on the start screen (FR-051a).
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      manifest: {
        name: 'Mathe-Panzer',
        short_name: 'Mathe-Panzer',
        lang: 'de',
        start_url: '.',
        display: 'fullscreen',
        background_color: '#1f2a44',
        theme_color: '#1f2a44',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  test: {
    // Vitest 5 removed environmentMatchGlobs; projects split node and jsdom tests.
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/app/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['src/app/**/*.test.{ts,tsx}'],
          // src/app/safeArea.test.ts reads the stylesheet as text (PO2); other CSS stays empty in tests.
          css: { include: [/src\/app\/styles\.css/] },
        },
      },
    ],
  },
});
