/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
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
