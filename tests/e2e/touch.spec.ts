/**
 * Touch (T136, FR-053, SC-004, US8 scenario 2), in the device projects of playwright.config.ts (WebKit with touch):
 * a tap on the ruler chooses the number under the finger, and a tap on "Feuer!" fires there, so the shell lands at the
 * tapped number. There is no −1 or +1 button (amendment 05) and no text field takes focus. The ruler's selection for a
 * tapped number matches the battlefield x within half a unit. Target sizes, overlaps and screen sizes are checked in
 * tests/e2e/devices.spec.ts (T278). Game state comes from the overlay's data-* attributes (D4).
 */
import type { Page } from '@playwright/test';
import { enemyNumber, expect, RULER_Y, seedStorage, startButton, tapWorld, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { numberToX } from '../../src/core/numberline/mapping';

const { min, max } = defaultSettings().range;
/** World units per number on the ruler. */
const UNIT = numberToX(1, min, max) - numberToX(0, min, max);

/** Taps the ruler at world x `x`. */
async function tapRulerAt(page: Page, x: number): Promise<void> {
  await tapWorld(page, x, RULER_Y, { touch: true });
}

test('a tap on the ruler and on "Feuer!" fires at the tapped number; no ±1 buttons, no text field', async ({ page }) => {
  // Comparison off, so no decoy stands where the test fires.
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), noDamage: true, challengeTypes: { ...defaultSettings().challengeTypes, comparison: false } } }, { once: true });
  await page.goto('/?seed=5');
  await startButton(page).tap();
  const overlay = page.getByTestId('battle-overlay');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true', { timeout: 10_000 });

  for (const name of ['+1', '−1', '-1']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);

  // A number 30 away from the enemy, so the shot is a plain miss that lands at the tapped number.
  const enemy = await enemyNumber(overlay);
  const n = enemy > 50 ? enemy - 30 : enemy + 30;
  // Off the tick by a quarter of a unit, the selection is still n: the ruler and the battlefield share the x.
  for (const offset of [-0.25, 0, 0.25]) {
    await tapRulerAt(page, numberToX(n, min, max) + offset * UNIT);
    await expect(overlay).toHaveAttribute('data-selection', String(n));
  }
  await expect(page.getByTestId('readout')).toHaveText('?');
  await page.locator('.fire-button').tap();
  await expect(overlay).toHaveAttribute('data-last-shot', 'miss');
  await expect(overlay).toHaveAttribute('data-last-landing', String(n));

  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    return el ? { tag: el.tagName, editable: (el as HTMLElement).isContentEditable } : null;
  });
  expect(['INPUT', 'TEXTAREA', 'SELECT']).not.toContain(focused?.tag);
  expect(focused?.editable ?? false).toBe(false);
});
