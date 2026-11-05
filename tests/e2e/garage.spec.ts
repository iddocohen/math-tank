/**
 * US10 tank garage end to end with the keyboard only (amendment 11, FR-062, FR-089 to FR-096, T261).
 *
 * Stored settings make the round short (free play, "Gegner pro Runde" 1) and a stored garage holds 9 stars, so one
 * destroyed enemy crosses the first 10-star mark: the end screen names the rocket flag and shows 10 stars. After a
 * reload the start screen shows 10 stars; G opens the garage, 7 and Enter choose the rocket flag, Escape goes back,
 * and Enter starts a round whose canvas carries `data-player-look` with the rocket flag (D4). A second case turns
 * the garage off: no button, no star total, and G does nothing.
 */
import { enemyNumber, expect, seedStorage, startButton, test, waitCalmly } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { GARAGE_KEY, SETTINGS_KEY } from '../../src/core/storage/storage';
import { emptyGarage, lookKey } from '../../src/core/rewards/garage';
import { t } from '../../src/i18n';

const m = t();
const oneEnemy = { ...defaultSettings(), roundType: 'enemyCount' as const, roundLength: 1 };
const nineStars = { ...emptyGarage(), stars: 9 };
const rocketLook = lookKey({ ...emptyGarage().look, flag: 'rocket' });

test('destroy an enemy for the tenth star, choose the rocket flag in the garage and see it in battle', async ({ page }) => {
  test.setTimeout(120_000);
  await seedStorage(page, { [SETTINGS_KEY]: oneEnemy, [GARAGE_KEY]: nineStars }, { once: true });
  await page.goto('/?seed=3&mode=ruler');

  await expect(page.getByTestId('star-total')).toContainText('9');
  await page.keyboard.press('Enter');
  const overlay = page.locator('[data-phase]');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(page.getByTestId('star-total')).toHaveCount(0);
  await expect(overlay).toHaveAttribute('data-enemy-number', /^\d+$/);
  const enemy = String(await enemyNumber(overlay));
  await waitCalmly(page, overlay);
  for (const digit of enemy) await page.keyboard.press(digit);
  await expect(page.getByTestId('readout')).toHaveText(enemy);
  await page.keyboard.press('Enter');

  // The end screen names the new item and shows the star total (FR-094, FR-095).
  await expect(page.getByTestId('round-end')).toBeVisible();
  await expect(page.getByTestId('unlocked')).toHaveText(m.roundEnd.unlocked(m.garage.items.rocket));
  await expect(page.getByTestId('star-total')).toContainText('10');

  // The stars were stored: after a reload the start screen shows 10.
  await page.reload();
  await expect(startButton(page)).toBeVisible();
  await expect(page.getByTestId('star-total')).toContainText('10');

  // G opens the garage; 7 and Enter choose the rocket flag; Escape goes back (FR-092).
  await page.keyboard.press('g');
  const garage = page.getByTestId('garage');
  await expect(garage).toBeVisible();
  await expect(page.getByTestId('garage-item-rocket')).toHaveAttribute('data-locked', 'false');
  await expect(page.getByTestId('garage-item-sky')).toContainText(m.garage.stillNeeded(10));
  await page.keyboard.press('7');
  await page.keyboard.press('Enter');
  await expect(garage).toHaveAttribute('data-look', rocketLook);
  await page.keyboard.press('Escape');
  await expect(garage).toHaveCount(0);

  // The next battle draws the child's tank with the rocket flag (FR-093).
  await page.keyboard.press('Enter');
  await expect(page.locator('canvas')).toHaveAttribute('data-player-look', rocketLook);
});

test('with the garage off there is no garage button, no star total, and G does nothing', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: { ...oneEnemy, garage: false }, [GARAGE_KEY]: { ...emptyGarage(), stars: 30, look: { ...emptyGarage().look, flag: 'rocket' } } }, { once: true });
  await page.goto('/?seed=3&mode=ruler');
  await expect(startButton(page)).toBeVisible();
  await expect(page.getByRole('button', { name: m.start.garage, exact: true })).toHaveCount(0);
  await expect(page.getByTestId('star-total')).toHaveCount(0);
  await page.keyboard.press('g');
  await expect(page.getByTestId('garage')).toHaveCount(0);
  // The standard look in battle (FR-096).
  await page.keyboard.press('Enter');
  await expect(page.locator('canvas')).toHaveAttribute('data-player-look', lookKey(emptyGarage().look));
});
