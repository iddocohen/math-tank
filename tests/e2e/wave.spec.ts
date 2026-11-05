/**
 * Amendment 21 end to end (FR-137, FR-138, FR-142): with "Gegner gleichzeitig" 3, "Nur Zahlenstrahl" shows three
 * enemies, each with a pointer line. The child destroys them one by one with the keyboard: after each hit the counter
 * rises by 1, the hearts stay and no enemy fires. After the third hit the hills change and three new enemies stand.
 * State comes from data-* attributes (D4): the overlay's phases and counter, the canvas's pointer lines and terrain seed.
 */
import { expect, recordPhases, seedStorage, startButton, test, typeAndFire } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import type { Settings } from '../../src/core/settings/schema';
import { SETTINGS_KEY } from '../../src/core/storage/storage';

const settings: Settings = { ...defaultSettings(), adaptive: false, enemiesAtOnce: 3 };

test('a 3-enemy wave in "Nur Zahlenstrahl" is cleared with the keyboard, then new hills bring a new wave', async ({ page }) => {
  test.setTimeout(120_000);
  await seedStorage(page, { [SETTINGS_KEY]: settings });
  await page.goto('/?seed=1');
  await expect(startButton(page)).toBeVisible();
  await page.keyboard.press('2');
  const overlay = page.locator('[data-phase]');
  await expect(overlay).toHaveAttribute('data-mode', 'ruler');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');

  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-pointer-lines', /^\d+,\d+,\d+$/);
  await expect(canvas).toHaveAttribute('data-enemy-tanks', '3');
  const wave = (await canvas.getAttribute('data-pointer-lines'))!.split(',').map(Number);
  const terrainSeed = await canvas.getAttribute('data-terrain-seed');
  const phases = await recordPhases(page);
  // Every value of data-fading-wrecks, since the wreck fades within about a second.
  await canvas.evaluate((el) => {
    const w = window as unknown as { __wrecks: string[] };
    w.__wrecks = [];
    new MutationObserver(() => w.__wrecks.push(el.getAttribute('data-fading-wrecks') ?? '')).observe(el, { attributes: true, attributeFilter: ['data-fading-wrecks'] });
  });
  const wrecks = () => page.evaluate(() => (window as unknown as { __wrecks: string[] }).__wrecks);

  for (const [i, n] of wave.entries()) {
    await typeAndFire(page, overlay, n);
    await expect(overlay).toHaveAttribute('data-enemies-destroyed', String(i + 1));
    await expect(overlay).toHaveAttribute('data-last-shot', 'hit');
    await expect(overlay).toHaveAttribute('data-phase', 'challenge');
    await expect(overlay).toHaveAttribute('data-lives', '3');
    if (i < wave.length - 1) {
      // The other enemies stay in place; the hills stay until the wave is cleared.
      await expect(canvas).toHaveAttribute('data-pointer-lines', wave.slice(i + 1).join(','));
      await expect(canvas).toHaveAttribute('data-terrain-seed', terrainSeed!);
    }
  }
  // The last enemy's wreck stays in view during its explosion, then fades away (code review).
  await expect.poll(wrecks).toContain('1');
  await expect(canvas).toHaveAttribute('data-fading-wrecks', '0');
  expect(await wrecks()).not.toContain('2');
  // No enemy fired after a hit.
  expect(await phases()).not.toContain('enemyTurn');

  // The wave is cleared: new hills and three new enemies.
  await expect(canvas).not.toHaveAttribute('data-terrain-seed', terrainSeed!);
  await expect(canvas).toHaveAttribute('data-pointer-lines', /^\d+,\d+,\d+$/);
  await expect(canvas).toHaveAttribute('data-enemy-tanks', '3');

  // A miss shows the steps to the nearest enemy without its number, and one enemy fires back.
  const next = (await canvas.getAttribute('data-pointer-lines'))!.split(',').map(Number);
  const miss = Math.round((next[0]! + next[1]!) / 2);
  await typeAndFire(page, overlay, miss);
  await expect(overlay).toHaveAttribute('data-last-shot', /^(miss|near)$/);
  const nearest = next.reduce((b, t) => (Math.abs(t - miss) < Math.abs(b - miss) ? t : b));
  await expect(canvas).toHaveAttribute('data-steps-label', `Du: ${miss} · ${Math.abs(miss - nearest)} ${Math.abs(miss - nearest) === 1 ? 'Schritt' : 'Schritte'}`);
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  expect(await phases()).toContain('enemyTurn');
});

test('the wreck of the last enemy of a wave stays during its explosion, also when it is the first enemy of the wave (code review)', async ({ page }) => {
  test.setTimeout(120_000);
  await seedStorage(page, { [SETTINGS_KEY]: settings });
  // Seed 1 places the first enemy of the wave (the tank whose view moves on to the next wave) leftmost, so firing from
  // right to left destroys it last.
  await page.goto('/?seed=1');
  await expect(startButton(page)).toBeVisible();
  await page.keyboard.press('2');
  const overlay = page.locator('[data-phase]');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-pointer-lines', /^\d+,\d+,\d+$/);
  const wave = (await canvas.getAttribute('data-pointer-lines'))!.split(',').map(Number);
  await canvas.evaluate((el) => {
    const w = window as unknown as { __wrecks: string[] };
    w.__wrecks = [];
    new MutationObserver(() => w.__wrecks.push(el.getAttribute('data-fading-wrecks') ?? '')).observe(el, { attributes: true, attributeFilter: ['data-fading-wrecks'] });
  });
  const wrecks = () => page.evaluate(() => (window as unknown as { __wrecks: string[] }).__wrecks);
  for (const [i, n] of [...wave].reverse().entries()) {
    await typeAndFire(page, overlay, n);
    await expect(overlay).toHaveAttribute('data-enemies-destroyed', String(i + 1));
    await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  }
  await expect.poll(wrecks).toContain('1');
  await expect(canvas).toHaveAttribute('data-fading-wrecks', '0');
  expect(await wrecks()).not.toContain('2');
});
