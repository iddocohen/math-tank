/**
 * US9 end to end (FR-014, FR-016, FR-067, US9 scenarios 2 and 4) with the amendment 04 hit rule (FR-066, FR-071 to
 * FR-074): with the range 550 to 780 on ruler level 2, free play is "read the ruler". A shot 1 away from the enemy
 * lands on its body: a hit with both numbers and the distance. The exact number is a Volltreffer with double damage.
 * With "Genau treffen" a shot 1 away does no damage and shows "Ganz knapp!". The ruler's first and last labels read
 * 550 and 780, and a pointer line stands under the enemy.
 * Keyboard only; state comes from data-* attributes (D4), ruler labels and pointer lines from the canvas.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { validateSettings, withRange } from '../../src/core/settings/validate';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { MAX_DAMAGE } from '../../src/core/physics/damage';
import { t } from '../../src/i18n';

const m = t();
// withRange keeps the linked limits valid for the new range, so the app accepts the stored settings.
const settings = { ...withRange(defaultSettings(), { preset: 'custom', min: 550, max: 780 }), freePlay: true, rulerLevelStart: 2 as const };

async function startFreePlay(page: Page, stored: typeof settings) {
  expect(validateSettings(stored)).toEqual({ ok: true });
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [SETTINGS_KEY, JSON.stringify(stored)] as const,
  );
  await page.goto('/?seed=5');
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

test('range 550 to 780: a shot 1 away hits the tank body, the exact number is a Volltreffer', async ({ page }) => {
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

  // 1 away: on the tank body, a hit with both numbers and the distance (FR-066, FR-072).
  const near = nextTo(enemy);
  await fire(page, near);
  await expect(overlay).toHaveAttribute('data-enemy-health', String(100 - MAX_DAMAGE), { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-last-shot', 'body');
  await expect(page.getByTestId('hit-feedback')).toContainText(m.battle.bodyHit);
  await expect(page.getByTestId('compare')).toHaveText(m.battle.compare(near, enemy));
  await expect(page.getByTestId('compare')).toHaveText(`Du: ${near} · Gegner: ${enemy} · 1 Schritt`);

  // After the enemy turn the enemy has moved; its exact number is a Volltreffer (FR-071).
  await expect(overlay).toHaveAttribute('data-phase', /^(aiming|roundOver)$/, { timeout: 15_000 });
  if ((await overlay.getAttribute('data-phase')) === 'roundOver') return;
  const second = Number(await overlay.getAttribute('data-enemy-number'));
  expect(second).not.toBe(enemy);
  await expect(canvas).toHaveAttribute('data-pointer-lines', String(second));
  await expect(canvas).toHaveAttribute('data-ruler-labels', '550,600,650,700,750,780');
  await fire(page, second);
  await expect(overlay).toHaveAttribute('data-last-shot', 'bullseye', { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-enemy-health', String(Math.max(0, 100 - 3 * MAX_DAMAGE)));
  await expect(page.getByTestId('hit-feedback')).toHaveText(`${m.battle.bullseye} ${m.battle.enemyStoodAt(second)}`);
  await expect(overlay).toHaveAttribute('data-phase', 'roundOver', { timeout: 15_000 });
});

test('range 550 to 780 with "Genau treffen": a shot 1 away is "Ganz knapp!" without damage', async ({ page }) => {
  test.setTimeout(90_000);
  const overlay = await startFreePlay(page, { ...settings, exactHit: true });
  const enemy = Number(await overlay.getAttribute('data-enemy-number'));
  const near = nextTo(enemy);
  await fire(page, near);
  await expect(overlay).toHaveAttribute('data-last-shot', 'close', { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-enemy-health', '100');
  await expect(page.getByTestId('hit-feedback')).toContainText(m.battle.close);
  await expect(page.getByTestId('compare')).toHaveText(m.battle.compare(near, enemy));
  // The enemy stays where it was for the next turn.
  await expect(overlay).toHaveAttribute('data-phase', /^(aiming|roundOver)$/, { timeout: 15_000 });
  if ((await overlay.getAttribute('data-phase')) === 'aiming') await expect(overlay).toHaveAttribute('data-enemy-number', String(enemy));
});
