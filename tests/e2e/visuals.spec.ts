/**
 * Amendment 14 end to end (T292, FR-107 to FR-113, SC-002), keyboard only, free play on "Leicht" so three misses in a
 * row never cost a heart. Game state comes from the canvas test attributes (D4):
 * - `data-ground-texture` is `dirt` once the bundled texture has loaded; `data-ground-draws` counts the ground
 *   images drawn, which grows once per landscape and per crater and never per frame;
 * - `data-muzzle-flashes` grows with every shell fired, `data-explosions` with every explosion, and
 *   `data-screen-shakes` with every screen shake (none with reduced motion, `data-reduced-motion`);
 * - `data-fps` is the frame rate over the last second.
 * With SCREENSHOT_DIR set, the Chromium run saves the garage preview of every item that is not basic, a battle with the
 * equipped look, a fresh landscape, a landscape with craters, a firing moment and an explosion with debris.
 */
import type { Locator, Page } from '@playwright/test';
import { enemyNumber, expect, GAME_WAIT, seedStorage, startButton, test, waitCalmly } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { GARAGE_KEY, SETTINGS_KEY } from '../../src/core/storage/storage';
import { emptyGarage } from '../../src/core/rewards/garage';
import { GARAGE_ITEMS, itemNumber } from '../../src/core/rewards/items';
import type { Settings } from '../../src/core/types';

const easy: Settings = { ...defaultSettings(), enemyDifficulty: 'easy', roundType: 'enemyCount', roundLength: 5 };

async function start(page: Page): Promise<Locator> {
  await page.goto('/?seed=3&mode=ruler');
  await expect(startButton(page)).toBeVisible();
  await page.keyboard.press('Enter');
  const overlay = page.getByTestId('battle-overlay');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  return overlay;
}

async function count(canvas: Locator, name: string): Promise<number> {
  return Number((await canvas.getAttribute(name)) ?? 'NaN');
}

async function type(page: Page, overlay: Locator, n: number): Promise<void> {
  await waitCalmly(page, overlay);
  await page.keyboard.type(String(n));
  await expect(page.getByTestId('readout')).toHaveText(String(n));
}

/** Fires halfway between the child's end of the range and the enemy, and waits until the enemy has fired back. */
async function miss(page: Page, overlay: Locator): Promise<void> {
  const enemy = await enemyNumber(overlay);
  const own = (await overlay.getAttribute('data-player-side')) === 'left' ? easy.range.min : easy.range.max;
  await type(page, overlay, Math.round((own + enemy) / 2));
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-last-shot', 'miss');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
}

async function destroyEnemy(page: Page, overlay: Locator, destroyed: number): Promise<void> {
  await type(page, overlay, await enemyNumber(overlay));
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', String(destroyed));
}

/** Waits until the canvas attribute has grown above `from`, checked every animation frame. */
async function grows(page: Page, name: string, from: number): Promise<void> {
  await page.waitForFunction(([attr, n]) => Number(document.querySelector('canvas')?.getAttribute(attr)) > n, [name, from] as const, { polling: 'raf', timeout: GAME_WAIT });
}

test('the textured ground is drawn once per landscape and crater, shots flash, and a destroyed enemy shakes the screen', async ({ page }, info) => {
  test.setTimeout(120_000);
  await seedStorage(page, { [SETTINGS_KEY]: easy });
  const overlay = await start(page);
  const canvas = page.locator('canvas');

  await expect(canvas).toHaveAttribute('data-ground-texture', 'dirt');
  await expect(canvas).toHaveAttribute('data-ground-draws', '1');
  await expect(canvas).toHaveAttribute('data-reduced-motion', 'false');
  await page.waitForTimeout(1000);
  await expect(canvas).toHaveAttribute('data-ground-draws', '1');

  for (let i = 0; i < 2; i++) {
    const draws = await count(canvas, 'data-ground-draws');
    const flashes = await count(canvas, 'data-muzzle-flashes');
    await miss(page, overlay);
    // The child's shell and the enemy's reply: one drawing per crater, at most 2.
    const after = await count(canvas, 'data-ground-draws');
    expect(after - draws).toBeGreaterThanOrEqual(1);
    expect(after - draws).toBeLessThanOrEqual(2);
    expect((await count(canvas, 'data-muzzle-flashes')) - flashes).toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(1000);
    expect(await count(canvas, 'data-ground-draws')).toBe(after);
  }

  if (info.project.name === 'chromium') {
    // SC-002: the frame rate over a second, measured while the scene runs. The full e2e run shares the machine with
    // many browsers, so any one-second sample within 10 seconds may show it.
    await expect.poll(() => count(canvas, 'data-fps'), { timeout: 10_000, intervals: [250] }).toBeGreaterThanOrEqual(30);
  }

  const draws = await count(canvas, 'data-ground-draws');
  const explosions = await count(canvas, 'data-explosions');
  await expect(canvas).toHaveAttribute('data-screen-shakes', '0');
  await destroyEnemy(page, overlay, 1);
  await expect(canvas).toHaveAttribute('data-screen-shakes', '1');
  expect(await count(canvas, 'data-explosions')).toBeGreaterThan(explosions);
  // The new hills after the destroyed enemy are one more ground drawing.
  await expect.poll(() => count(canvas, 'data-ground-draws'), { timeout: 5000 }).toBeGreaterThan(draws);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('a destroyed enemy explodes without shaking the screen', async ({ page }) => {
    await seedStorage(page, { [SETTINGS_KEY]: easy });
    const overlay = await start(page);
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveAttribute('data-reduced-motion', 'true');
    await destroyEnemy(page, overlay, 1);
    await expect.poll(() => count(canvas, 'data-explosions')).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    await expect(canvas).toHaveAttribute('data-screen-shakes', '0');
  });
});

test('the dirt texture comes from the game itself and no request leaves the origin', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await seedStorage(page, { [SETTINGS_KEY]: easy });
  await start(page);
  await expect(page.locator('canvas')).toHaveAttribute('data-ground-texture', 'dirt');
  expect(requests.some((url) => /\/assets\/dirt-[\w-]+\.png$/.test(url) && new URL(url).origin === origin)).toBe(true);
  const foreign = requests.filter((url) => !url.startsWith('data:') && !url.startsWith('blob:') && new URL(url).origin !== origin);
  expect(foreign).toEqual([]);
});

test('screenshots of the garage looks, the landscape, a shot and an explosion', async ({ page }, info) => {
  // playwright.config.ts passes SCREENSHOT_DIR as metadata (the e2e specs have no Node types).
  const dir = info.config.metadata.screenshotDir as string | undefined;
  test.skip(!dir || info.project.name !== 'chromium', 'only with SCREENSHOT_DIR, in Chromium');
  test.setTimeout(180_000);
  // A version 1 garage with 130 stars: the amendment 19 migration makes all 13 items owned (FR-133).
  await seedStorage(page, { [SETTINGS_KEY]: easy, [GARAGE_KEY]: { version: 1, stars: 130, look: emptyGarage().look } });
  await page.goto('/?seed=3&mode=ruler');
  await expect(startButton(page)).toBeVisible();

  // Every item that is not basic, chosen in turn by its number and Enter.
  await page.keyboard.press('g');
  const preview = page.getByTestId('garage-preview');
  for (const [i, id] of GARAGE_ITEMS.filter((item) => item.price > 0).map((item) => item.id).entries()) {
    await page.keyboard.type(String(itemNumber(id)));
    await page.keyboard.press('Enter');
    await expect(page.getByTestId(`garage-item-${id}`)).toHaveAttribute('data-chosen', 'true');
    await preview.screenshot({ path: `${dir}/garage-${String(i + 1).padStart(2, '0')}-${id}.png` });
  }
  await page.screenshot({ path: `${dir}/garage-all.png` });
  await page.keyboard.press('Escape');

  await page.keyboard.press('Enter');
  const overlay = page.getByTestId('battle-overlay');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-ground-texture', 'dirt');
  await page.screenshot({ path: `${dir}/battle-look.png` });
  await expect(canvas).toHaveAttribute('data-you-marker', 'off', { timeout: 10_000 });
  await page.screenshot({ path: `${dir}/landscape-fresh.png` });

  for (let i = 0; i < 3; i++) await miss(page, overlay);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/landscape-craters.png` });

  const enemy = await enemyNumber(overlay);
  await type(page, overlay, enemy);
  const flashes = await count(canvas, 'data-muzzle-flashes');
  const explosions = await count(canvas, 'data-explosions');
  await page.keyboard.press('Enter');
  await grows(page, 'data-muzzle-flashes', flashes);
  await page.screenshot({ path: `${dir}/firing.png` });
  await grows(page, 'data-explosions', explosions);
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${dir}/explosion.png` });
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1');
});
