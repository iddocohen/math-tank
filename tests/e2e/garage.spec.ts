/**
 * US10 tank garage end to end with the keyboard only (amendment 11, FR-062, FR-089 to FR-096, T261).
 *
 * Stored settings make the round short (free play, "Gegner pro Runde" 1) and a stored garage holds 9 stars, so one
 * destroyed enemy crosses the first 10-star mark: the end screen names the rocket flag and shows 10 stars. After a
 * reload the start screen shows 10 stars; G opens the garage, 7 and Enter choose the rocket flag, Escape goes back,
 * and Enter starts a round whose canvas carries `data-player-look` with the rocket flag (D4). A second case turns
 * the garage off: no button, no star total, and G does nothing.
 */
import type { Page } from '@playwright/test';
import { expect, GAME_WAIT, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { GARAGE_KEY, SETTINGS_KEY } from '../../src/core/storage/storage';
import { emptyGarage, lookKey } from '../../src/core/rewards/garage';
import { t } from '../../src/i18n';

const m = t();
const oneEnemy = { ...defaultSettings(), freePlay: true, roundType: 'enemyCount' as const, roundLength: 1 };
const nineStars = { ...emptyGarage(), stars: 9 };
const rocketLook = lookKey({ ...emptyGarage().look, flag: 'rocket' });

async function store(page: Page, entries: Record<string, unknown>): Promise<void> {
  // Only on the first load of the page, so a reload keeps what the game stored.
  await page.addInitScript((pairs: Array<[string, string]>) => {
    if (window.sessionStorage.getItem('e2e-seeded')) return;
    window.sessionStorage.setItem('e2e-seeded', '1');
    for (const [k, v] of pairs) window.localStorage.setItem(k, v);
  }, Object.entries(entries).map(([k, v]): [string, string] => [k, JSON.stringify(v)]));
}

test('destroy an enemy for the tenth star, choose the rocket flag in the garage and see it in battle', async ({ page }) => {
  test.setTimeout(120_000);
  await store(page, { [SETTINGS_KEY]: oneEnemy, [GARAGE_KEY]: nineStars });
  await page.goto('/?seed=3&mode=free');

  await expect(page.getByTestId('star-total')).toContainText('9');
  await page.keyboard.press('Enter');
  const overlay = page.locator('[data-phase]');
  await expect(overlay).toHaveAttribute('data-phase', 'aiming');
  await expect(page.getByTestId('star-total')).toHaveCount(0);
  await expect(overlay).toHaveAttribute('data-enemy-number', /^\d+$/);
  const enemy = (await overlay.getAttribute('data-enemy-number'))!;
  for (const digit of enemy) await page.keyboard.press(digit);
  await expect(page.getByTestId('readout')).toHaveText(enemy);
  await page.keyboard.press('Enter');

  // The end screen names the new item and shows the star total (FR-094, FR-095).
  await expect(page.getByTestId('round-end')).toBeVisible({ timeout: GAME_WAIT });
  await expect(page.getByTestId('unlocked')).toHaveText(m.roundEnd.unlocked(m.garage.items.rocket));
  await expect(page.getByTestId('star-total')).toContainText('10');

  // The stars were stored: after a reload the start screen shows 10.
  await page.reload();
  await expect(page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
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
  await store(page, { [SETTINGS_KEY]: { ...oneEnemy, garage: false }, [GARAGE_KEY]: { ...emptyGarage(), stars: 30, look: { ...emptyGarage().look, flag: 'rocket' } } });
  await page.goto('/?seed=3&mode=free');
  await expect(page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: m.start.garage, exact: true })).toHaveCount(0);
  await expect(page.getByTestId('star-total')).toHaveCount(0);
  await page.keyboard.press('g');
  await expect(page.getByTestId('garage')).toHaveCount(0);
  // The standard look in battle (FR-096).
  await page.keyboard.press('Enter');
  await expect(page.locator('canvas')).toHaveAttribute('data-player-look', lookKey(emptyGarage().look));
});
