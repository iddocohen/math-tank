/**
 * The published game under a sub-path (P11, T304). GitHub Pages serves the game at
 * https://iddocohen.github.io/math-tank/, built with `vite build --base=/math-tank/` (.github/workflows/pages.yml).
 * The Playwright project `base-path` builds the game the same way into `dist-base/` and serves it at
 * http://localhost:4174/math-tank/ (playwright.config.ts). This smoke test loads the game there, plays one whole
 * round with the keyboard, and checks that every request stays under /math-tank/ and succeeds, and that the service
 * worker and the web app manifest use the sub-path.
 */
import { expect, GAME_WAIT, startButton, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';

const BASE = '/math-tank/';

test('the game built for /math-tank/ loads, plays a round and requests nothing outside /math-tank/', async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  expect(new URL(baseURL!).pathname).toBe(BASE);
  const origin = new URL(baseURL!).origin;
  const requests: string[] = [];
  const failed: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), noDamage: true, roundType: 'enemyCount', roundLength: 1 })] as const,
  );

  // Relative to baseURL, so the page opens at /math-tank/.
  await page.goto('./?seed=8');
  expect(new URL(page.url()).pathname).toBe(BASE);
  await expect(startButton(page)).toBeVisible();

  // The manifest and its start address stay under /math-tank/, so "Zum Home-Bildschirm" opens the game there.
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifestUrl = new URL(manifestHref!, page.url());
  expect(manifestUrl.pathname.startsWith(BASE)).toBe(true);
  const manifest = (await (await page.request.get(manifestUrl.href)).json()) as { start_url: string };
  expect(new URL(manifest.start_url, manifestUrl).pathname).toBe(BASE);

  // The service worker controls only /math-tank/.
  const scope = await page.evaluate(() => navigator.serviceWorker.ready.then((r) => r.scope));
  expect(new URL(scope).pathname).toBe(BASE);

  await page.keyboard.press('Enter');
  const overlay = page.getByTestId('battle-overlay');
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true', { timeout: GAME_WAIT });
  await page.keyboard.type((await overlay.getAttribute('data-enemy-number'))!);
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1', { timeout: GAME_WAIT });
  await expect(page.getByTestId('round-end')).toBeVisible({ timeout: GAME_WAIT });

  const outside = requests.filter((url) => {
    if (url.startsWith('data:') || url.startsWith('blob:')) return false;
    const u = new URL(url);
    return u.origin !== origin || !u.pathname.startsWith(BASE);
  });
  expect(outside).toEqual([]);
  expect(failed).toEqual([]);
});
