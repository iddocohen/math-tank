/**
 * US10 tank garage as a star shop end to end (amendments 11 and 19; FR-062, FR-089 to FR-096, FR-130 to FR-133; T366).
 *
 * Stored settings make the round short ("Gegner pro Runde" 1) and a stored garage holds a balance of 9, so one
 * destroyed enemy brings the balance to 10: the end screen shows "+1 Stern", the balance 10 and "Genug Sterne für:
 * Himmelblau" (sky blue is the first 10-star item in garage order). In the garage, 7 and Enter ask "Für 10 Sterne
 * kaufen?" for the rocket flag, Enter buys it (balance 0); "Zurückgeben" and "Ja" give the 10 stars back; a click on the
 * football flag and "Ja" buy it; Escape goes back, and Enter starts a round whose canvas carries `data-player-look`
 * with the football flag (D4). A stored garage of amendment 11 is migrated. A last case turns the garage off: no
 * button, no star total, and G does nothing.
 *
 * With SCREENSHOT_DIR set, the Chromium run saves the garage with prices and the buy question.
 */
import { enemyNumber, expect, seedStorage, startButton, test, waitCalmly } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { GARAGE_KEY, SETTINGS_KEY } from '../../src/core/storage/storage';
import { emptyGarage, lookKey } from '../../src/core/rewards/garage';
import { t } from '../../src/i18n';

const m = t();
const G = m.garage;
const oneEnemy = { ...defaultSettings(), roundType: 'enemyCount' as const, roundLength: 1 };
const nineStars = { ...emptyGarage(), balance: 9, totalEarned: 9 };
const rocketLook = lookKey({ ...emptyGarage().look, flag: 'rocket' });
const footballLook = lookKey({ ...emptyGarage().look, flag: 'football' });

test('earn stars, buy an item, return it, buy another and see it in battle', async ({ page }, info) => {
  test.setTimeout(120_000);
  const dir = info.config.metadata.screenshotDir as string | undefined;
  const shots = dir !== undefined && info.project.name === 'chromium';
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

  // The end screen shows the round's star, the balance and one item it now reaches (FR-094, FR-095).
  await expect(page.getByTestId('round-end')).toBeVisible();
  await expect(page.getByTestId('round-stars')).toHaveText(m.roundEnd.starsEarned(1));
  await expect(page.getByTestId('star-total')).toContainText('10');
  await expect(page.getByTestId('affordable')).toHaveText(m.roundEnd.affordable(G.items.sky));

  // The stars were stored: after a reload the start screen shows 10.
  await page.reload();
  await expect(startButton(page)).toBeVisible();
  await expect(page.getByTestId('star-total')).toContainText('10');

  // G opens the garage; every item not owned shows its price; the 20-star items are grey with "noch 10 Sterne".
  await page.keyboard.press('g');
  const garage = page.getByTestId('garage');
  await expect(garage).toBeVisible();
  await expect(page.getByTestId('garage-item-rocket')).toContainText(G.price(10));
  await expect(page.getByTestId('garage-item-rocket')).toHaveAttribute('data-locked', 'false');
  await expect(page.getByTestId('garage-item-teal')).toHaveAttribute('data-locked', 'true');
  await expect(page.getByTestId('garage-item-teal')).toContainText(G.stillNeeded(10));
  if (shots) await page.screenshot({ path: `${dir}/garage-prices.png` });

  // 7 and Enter ask; Enter answers "Ja": the rocket flag is bought and equipped (FR-092, FR-130).
  await page.keyboard.press('7');
  await page.keyboard.press('Enter');
  const dialog = page.getByTestId('garage-dialog');
  await expect(dialog).toContainText(G.buyQuestion(10));
  if (shots) await page.screenshot({ path: `${dir}/garage-buy-question.png` });
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(garage).toHaveAttribute('data-look', rocketLook);
  await expect(garage.getByTestId('star-total')).toContainText('0');
  await expect(page.getByTestId('garage-item-football')).toHaveAttribute('data-locked', 'true');

  // "Zurückgeben" and "Ja" give all 10 stars back and equip the star flag again (FR-131).
  await page.getByTestId('garage-return-rocket').click();
  await expect(dialog).toContainText(G.returnQuestion(10));
  await dialog.getByRole('button', { name: G.yes }).click();
  await expect(dialog).toHaveCount(0);
  await expect(garage).toHaveAttribute('data-look', lookKey(emptyGarage().look));
  await expect(garage.getByTestId('star-total')).toContainText('10');
  await expect(page.getByTestId('garage-return-rocket')).toHaveCount(0);

  // "Nein" changes nothing; a click and "Ja" buy the football flag.
  await page.getByTestId('garage-item-football').click();
  await dialog.getByRole('button', { name: G.no }).click();
  await expect(garage.getByTestId('star-total')).toContainText('10');
  await page.getByTestId('garage-item-football').click();
  await dialog.getByRole('button', { name: G.yes }).click();
  await expect(garage).toHaveAttribute('data-look', footballLook);
  await expect(garage.getByTestId('star-total')).toContainText('0');

  // Escape goes back; the next battle draws the child's tank with the football flag (FR-093).
  await page.keyboard.press('Escape');
  await expect(garage).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(page.locator('canvas')).toHaveAttribute('data-player-look', footballLook);
});

test('a stored garage of amendment 11 keeps its unlocked items as owned, with the rest of the stars as balance', async ({ page }) => {
  const look = { color: 'sky', flag: 'rocket', trail: 'sparkles', hat: 'crown' };
  await seedStorage(page, { [SETTINGS_KEY]: oneEnemy, [GARAGE_KEY]: { version: 1, stars: 45, look } }, { once: true });
  await page.goto('/?seed=3&mode=ruler');
  await expect(startButton(page)).toBeVisible();
  // 45 stars had unlocked rocket, sky, sparkles and crown (70 stars): balance 0 (FR-133).
  await expect(page.getByTestId('star-total')).toContainText('0');
  await page.keyboard.press('g');
  for (const id of ['sky', 'rocket', 'sparkles', 'crown']) await expect(page.getByTestId(`garage-item-${id}`)).toHaveAttribute('data-owned', 'true');
  await expect(page.getByTestId('garage-item-helmet')).toHaveAttribute('data-owned', 'false');
  await expect(page.getByTestId('garage')).toHaveAttribute('data-look', lookKey(look as Parameters<typeof lookKey>[0]));
});

test('with the garage off there is no garage button, no star total, and G does nothing', async ({ page }) => {
  const owned = { ...emptyGarage(), balance: 20, totalEarned: 30, owned: ['rocket'], look: { ...emptyGarage().look, flag: 'rocket' } };
  await seedStorage(page, { [SETTINGS_KEY]: { ...oneEnemy, garage: false }, [GARAGE_KEY]: owned }, { once: true });
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
