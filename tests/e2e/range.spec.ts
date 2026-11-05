/**
 * US9 end to end (FR-014, FR-016, FR-067, US9 scenarios 2 and 4) with the amendment 06 hit rule (FR-066, FR-072,
 * FR-073): with the range 550 to 780 on ruler level 2, free play is "read the ruler". A shot 1 away from the enemy
 * lands on its body: a near miss with "Ganz knapp! Triff die Linie.", both numbers and the distance; the enemy stays.
 * The exact number destroys it and a new enemy appears. With "Gegner pro Runde" 1 one hit ends the round, and the end
 * screen shows "1 Panzer getroffen in m:ss" (FR-082, FR-085). The ruler's first and last labels read 550 and 780,
 * and a pointer line stands under the enemy.
 * Keyboard only; state comes from data-* attributes (D4), ruler labels and pointer lines from the canvas.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import type { Settings } from '../../src/core/settings/schema';
import { validateSettings, withRange } from '../../src/core/settings/validate';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const m = t();
// withRange keeps the linked limits valid for the new range, so the app accepts the stored settings.
const settings: Settings = { ...withRange(defaultSettings(), { preset: 'custom', min: 550, max: 780 }), freePlay: true, rulerLevelStart: 2 as const };

async function startFreePlay(page: Page, stored: Settings) {
  expect(validateSettings(stored)).toEqual({ ok: true });
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [SETTINGS_KEY, JSON.stringify(stored)] as const,
  );
  await page.goto('/?seed=5&mode=free');
  await expect(page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  const overlay = page.locator('[data-phase]');
  await expect(overlay).toHaveAttribute('data-phase', 'aiming');
  return overlay;
}

async function fire(page: Page, n: number) {
  for (const ch of String(n)) await page.keyboard.press(ch);
  await expect(page.getByTestId('readout')).toHaveText(String(n));
  await page.keyboard.press('Enter');
}

/** 1 away from the enemy, inside the range. */
const nextTo = (enemy: number) => (enemy < 780 ? enemy + 1 : enemy - 1);

test('range 550 to 780: a shot 1 away is a near miss, the exact number destroys the enemy', async ({ page }) => {
  test.setTimeout(90_000);
  const overlay = await startFreePlay(page, settings);

  // The ruler spans exactly the chosen range; on level 2 the major lines (every 50) are labeled.
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-ruler-labels', /^550,.*,780$/);
  const labels = (await canvas.getAttribute('data-ruler-labels'))!.split(',').map(Number);
  expect(labels[0]).toBe(550);
  expect(labels.at(-1)).toBe(780);
  // Only the level 2 labels: the pointer line adds no number and highlights no label (FR-073).
  await expect(canvas).toHaveAttribute('data-ruler-labels', '550,600,650,700,750,780');

  // The enemy stands on a line of the ruler: a multiple of 10 at level 2, with a pointer line under it (FR-073).
  await expect(overlay).toHaveAttribute('data-enemy-number', /^\d+$/);
  const enemy = Number(await overlay.getAttribute('data-enemy-number'));
  expect(enemy % 10).toBe(0);
  expect(enemy).toBeGreaterThanOrEqual(550);
  expect(enemy).toBeLessThanOrEqual(780);
  await expect(canvas).toHaveAttribute('data-pointer-lines', String(enemy));

  // 1 away: on the tank body, a near miss with both numbers and the distance; nothing is destroyed (FR-066, FR-072).
  const near = nextTo(enemy);
  await fire(page, near);
  await expect(overlay).toHaveAttribute('data-last-shot', 'near', { timeout: 15_000 });
  await expect(page.getByTestId('hit-feedback')).toContainText(m.battle.near);
  await expect(page.getByTestId('compare')).toHaveText(m.battle.compare(near, enemy));
  await expect(page.getByTestId('compare')).toHaveText(`Du: ${near} · Gegner: ${enemy} · 1 Schritt`);
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '0');
  await expect(overlay).toHaveAttribute('data-phase', 'aiming');
  await expect(overlay).toHaveAttribute('data-enemy-number', String(enemy));

  // The exact number destroys the enemy; a new enemy stands at a new number with its own pointer line (FR-066).
  await fire(page, enemy);
  await expect(overlay).toHaveAttribute('data-last-shot', 'hit', { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1');
  await expect(page.getByTestId('hit-feedback')).toHaveText(`${m.battle.hit} ${m.battle.enemyStoodAt(enemy)}`);
  await expect(overlay).toHaveAttribute('data-phase', 'aiming');
  const second = Number(await overlay.getAttribute('data-enemy-number'));
  expect(second).not.toBe(enemy);
  await expect(canvas).toHaveAttribute('data-pointer-lines', String(second));
  await expect(canvas).toHaveAttribute('data-ruler-labels', '550,600,650,700,750,780');
});

test('"Gegner pro Runde" 1: one exact hit ends the round with the score, the time and the record', async ({ page }) => {
  test.setTimeout(90_000);
  const overlay = await startFreePlay(page, { ...settings, roundType: 'enemyCount', roundLength: 1 });
  const enemy = Number(await overlay.getAttribute('data-enemy-number'));
  await fire(page, enemy);
  await expect(overlay).toHaveAttribute('data-phase', 'roundOver', { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-outcome', 'goalReached');
  await expect(page.getByTestId('round-result')).toHaveText(/^1 Panzer getroffen in \d+:\d\d$/);
  await expect(page.getByTestId('new-record')).toHaveText(m.roundEnd.newRecord);

  // Another round with the same result: the record is shown small and neutral.
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-phase', 'aiming');
  await fire(page, Number(await overlay.getAttribute('data-enemy-number')));
  await expect(overlay).toHaveAttribute('data-phase', 'roundOver', { timeout: 15_000 });
  await expect(page.getByTestId('record')).toHaveText(m.roundEnd.yourRecord(1));
  await expect(page.getByTestId('new-record')).toHaveCount(0);
});
