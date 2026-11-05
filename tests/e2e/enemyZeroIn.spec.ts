/**
 * Amendment 13 end to end (T269, FR-044, FR-098 to FR-101), keyboard only. Free play on "Normal" with "Gegner pro
 * Runde" 5: every miss adds 1 to the misses in a row (`data-miss-streak` on the overlay). The first two misses cost no
 * heart, the second shows the warning (`data-enemy-warnings` on the canvas), and the third enemy shell hits and costs
 * one heart, after which the count starts again. Destroying the enemy brings new hills (`data-terrain-seed` changes)
 * while the hearts, the round seed and the counter continue. With "Ohne Schaden spielen" the third shell takes no
 * heart. Game state comes from the data-* attributes (D4).
 */
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import type { Settings } from '../../src/core/types';
import { t } from '../../src/i18n';

const m = t();

const normal: Settings = { ...defaultSettings(), freePlay: true, enemyDifficulty: 'normal', roundType: 'enemyCount', roundLength: 5 };

async function start(page: Page, settings: Settings): Promise<Locator> {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [SETTINGS_KEY, JSON.stringify(settings)] as const,
  );
  await page.goto('/?seed=3&mode=free');
  await expect(page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  const overlay = page.getByTestId('battle-overlay');
  await expect(overlay).toHaveAttribute('data-phase', 'aiming');
  return overlay;
}

async function fire(page: Page, overlay: Locator, n: number): Promise<void> {
  await expect(overlay).toHaveAttribute('data-phase', 'aiming', { timeout: 15_000 });
  await page.keyboard.type(String(n));
  await expect(page.getByTestId('readout')).toHaveText(String(n));
  await page.keyboard.press('Enter');
}

/** Fires halfway between the child's end of the range and the enemy: a plain miss away from both tanks. */
async function miss(page: Page, overlay: Locator, settings: Settings): Promise<void> {
  const enemy = Number(await overlay.getAttribute('data-enemy-number'));
  const own = (await overlay.getAttribute('data-player-side')) === 'left' ? settings.range.min : settings.range.max;
  await fire(page, overlay, Math.round((own + enemy) / 2));
  await expect(overlay).toHaveAttribute('data-last-shot', 'miss', { timeout: 15_000 });
  // The enemy fires back, then the child chooses again.
  await expect(overlay).toHaveAttribute('data-phase', 'aiming', { timeout: 15_000 });
}

test('"Normal": the enemy zeroes in, warns after the second miss and hits at the third; a destroyed enemy brings new hills', async ({ page }) => {
  test.setTimeout(120_000);
  const overlay = await start(page, normal);
  const canvas = page.locator('canvas');
  await expect(overlay).toHaveAttribute('data-miss-streak', '0');
  await expect(canvas).toHaveAttribute('data-enemy-warnings', '0');

  await miss(page, overlay, normal);
  await expect(overlay).toHaveAttribute('data-miss-streak', '1');
  await expect(overlay).toHaveAttribute('data-lives', '3');
  await expect(canvas).toHaveAttribute('data-enemy-warnings', '0');

  await miss(page, overlay, normal);
  await expect(overlay).toHaveAttribute('data-miss-streak', '2');
  await expect(overlay).toHaveAttribute('data-lives', '3');
  await expect(canvas).toHaveAttribute('data-enemy-warnings', '1');

  await miss(page, overlay, normal);
  await expect(overlay).toHaveAttribute('data-lives', '2');
  await expect(overlay).toHaveAttribute('data-miss-streak', '0');

  // Destroy the enemy: new hills, the same round, the hearts stay.
  const terrainSeed = (await canvas.getAttribute('data-terrain-seed'))!;
  const roundSeed = (await overlay.getAttribute('data-round-seed'))!;
  await fire(page, overlay, Number(await overlay.getAttribute('data-enemy-number')));
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1', { timeout: 15_000 });
  await expect(canvas).not.toHaveAttribute('data-terrain-seed', terrainSeed);
  await expect(overlay).toHaveAttribute('data-round-seed', roundSeed);
  await expect(overlay).toHaveAttribute('data-lives', '2');
  await expect(overlay).toHaveAttribute('data-miss-streak', '0');
});

test('no-damage mode: the third shell lands on the tank but takes no heart (FR-044)', async ({ page }) => {
  test.setTimeout(120_000);
  const settings: Settings = { ...normal, noDamage: true };
  const overlay = await start(page, settings);
  for (let i = 0; i < 3; i++) await miss(page, overlay, settings);
  await expect(overlay).toHaveAttribute('data-miss-streak', '0');
  await expect(overlay).toHaveAttribute('data-lives', '3');
});
