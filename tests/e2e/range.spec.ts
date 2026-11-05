/**
 * US9 end to end (FR-014, FR-016, FR-067, US9 scenarios 2 and 4): with the range 550 to 780 on ruler level 2,
 * free play is "read the ruler". Read the enemy's number, type it, press Enter: the enemy loses health and the
 * feedback names the exact number. The ruler's first and last labels read 550 and 780.
 * Keyboard only; state comes from data-* attributes (D4), ruler labels from the canvas's data-ruler-labels.
 */
import { expect, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { validateSettings, withRange } from '../../src/core/settings/validate';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { MAX_DAMAGE } from '../../src/core/physics/damage';
import { t } from '../../src/i18n';

const m = t();
// withRange keeps the linked limits valid for the new range, so the app accepts the stored settings.
const settings = { ...withRange(defaultSettings(), { preset: 'custom', min: 550, max: 780 }), freePlay: true, rulerLevelStart: 2 as const };

test('range 550 to 780: read the ruler, type the number and hit', async ({ page }) => {
  expect(validateSettings(settings)).toEqual({ ok: true });
  test.setTimeout(90_000);
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [SETTINGS_KEY, JSON.stringify(settings)] as const,
  );
  await page.goto('/?seed=5');

  await expect(page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  const overlay = page.locator('[data-phase]');
  await expect(overlay).toHaveAttribute('data-phase', 'aiming');

  // The ruler spans exactly the chosen range; on level 2 the major lines (every 50) are labeled.
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-ruler-labels', /^550,.*,780$/);
  const labels = (await canvas.getAttribute('data-ruler-labels'))!.split(',').map(Number);
  expect(labels[0]).toBe(550);
  expect(labels.at(-1)).toBe(780);

  // The enemy stands on a line of the ruler: a multiple of 10 at level 2.
  await expect(overlay).toHaveAttribute('data-enemy-number', /^\d+$/);
  const enemy = Number(await overlay.getAttribute('data-enemy-number'));
  expect(enemy % 10).toBe(0);
  expect(enemy).toBeGreaterThanOrEqual(550);
  expect(enemy).toBeLessThanOrEqual(780);

  for (const digit of String(enemy)) await page.keyboard.press(digit);
  await expect(page.getByTestId('readout')).toHaveText(String(enemy));
  await page.keyboard.press('Enter');

  await expect(overlay).toHaveAttribute('data-enemy-health', String(100 - MAX_DAMAGE), { timeout: 15_000 });
  await expect(page.getByTestId('hit-feedback')).toHaveText(m.battle.hitAt(enemy));
  await expect(overlay).toHaveAttribute('data-phase', /^(aiming|roundOver)$/, { timeout: 15_000 });
});
