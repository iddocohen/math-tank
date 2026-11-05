/**
 * Touch (T136, FR-053, SC-004, US8 scenario 2), in the device projects of playwright.config.ts (WebKit with touch):
 * a tap on the ruler chooses the number under the finger, and a tap on "Feuer!" fires there, so the shell lands at the
 * tapped number. There is no −1 or +1 button (amendment 05) and no text field takes focus. The ruler's selection for a
 * tapped number matches the battlefield x within half a unit. Target sizes, overlaps and screen sizes are checked in
 * tests/e2e/devices.spec.ts (T278). Game state comes from the overlay's data-* attributes (D4).
 */
import type { Page } from '@playwright/test';
import { expect, GAME_WAIT, startButton, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { numberToX } from '../../src/core/numberline/mapping';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../../src/core/battle/round';

const { min, max } = defaultSettings().range;
/** The ruler's axis in world units (src/game/NumberLineView.ts). */
const RULER_Y = 742;
/** World units per number on the ruler. */
const UNIT = numberToX(1, min, max) - numberToX(0, min, max);

/** Taps the ruler at world x `x` (the canvas shows the whole 1600 by 900 world, scaled to fit). */
async function tapRulerAt(page: Page, x: number): Promise<void> {
  const box = (await page.locator('canvas').boundingBox())!;
  await page.touchscreen.tap(box.x + (x * box.width) / WORLD_WIDTH, box.y + (RULER_Y * box.height) / WORLD_HEIGHT);
}

test('a tap on the ruler and on "Feuer!" fires at the tapped number; no ±1 buttons, no text field', async ({ page }) => {
  test.setTimeout(60_000);
  // Comparison off, so no decoy stands where the test fires.
  await page.addInitScript(
    ([key, value]) => {
      if (window.sessionStorage.getItem('e2e-seeded')) return;
      window.sessionStorage.setItem('e2e-seeded', '1');
      window.localStorage.setItem(key, value);
    },
    [SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), noDamage: true, challengeTypes: { ...defaultSettings().challengeTypes, comparison: false } })] as const,
  );
  await page.goto('/?seed=5');
  await startButton(page).tap();
  const overlay = page.getByTestId('battle-overlay');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true', { timeout: 10_000 });

  for (const name of ['+1', '−1', '-1']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);

  // A number 30 away from the enemy, so the shot is a plain miss that lands at the tapped number.
  const enemy = Number(await overlay.getAttribute('data-enemy-number'));
  const n = enemy > 50 ? enemy - 30 : enemy + 30;
  // Off the tick by a quarter of a unit, the selection is still n: the ruler and the battlefield share the x.
  for (const offset of [-0.25, 0, 0.25]) {
    await tapRulerAt(page, numberToX(n, min, max) + offset * UNIT);
    await expect(overlay).toHaveAttribute('data-selection', String(n));
  }
  await expect(page.getByTestId('readout')).toHaveText('?');
  await page.locator('.fire-button').tap();
  await expect(overlay).toHaveAttribute('data-last-shot', 'miss', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-last-landing', String(n));

  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    return el ? { tag: el.tagName, editable: (el as HTMLElement).isContentEditable } : null;
  });
  expect(['INPUT', 'TEXTAREA', 'SELECT']).not.toContain(focused?.tag);
  expect(focused?.editable ?? false).toBe(false);
});
