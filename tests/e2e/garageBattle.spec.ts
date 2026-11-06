/**
 * Amendment 23: the garage opens from the battle. A tap on the garage icon beside the gear opens the garage over a
 * running round, which pauses; equipping the owned rocket flag and "Zurück" close it, the round continues, the canvas
 * carries the new `data-player-look`, and a hit still counts. Runs in the desktop projects and in the device projects
 * (playwright.config.ts), where the battle with the icon must also fit without overlaps (expectBattleFits).
 *
 * With SCREENSHOT_DIR set, every project saves the battle with the garage icon.
 */
import { enemyNumber, expect, seedStorage, startButton, test, waitCalmly } from './fixtures';
import { expectBattleFits } from './layout';
import { defaultSettings } from '../../src/core/settings/defaults';
import { GARAGE_KEY, SETTINGS_KEY } from '../../src/core/storage/storage';
import { emptyGarage, lookKey } from '../../src/core/rewards/garage';
import { t } from '../../src/i18n';

const m = t();
const settings = { ...defaultSettings(), roundType: 'enemyCount' as const, roundLength: 3 };
const ownsRocket = { ...emptyGarage(), balance: 5, totalEarned: 15, owned: ['rocket'] };
const standardLook = lookKey(emptyGarage().look);
const rocketLook = lookKey({ ...emptyGarage().look, flag: 'rocket' });

test('open the garage from a running round, equip a look, close it, and the round continues with the new look', async ({ page }, info) => {
  test.setTimeout(90_000);
  const touch = info.project.use.hasTouch === true;
  const press = async (locator: ReturnType<typeof page.getByTestId>) => (touch ? locator.tap() : locator.click());
  await seedStorage(page, { [SETTINGS_KEY]: settings, [GARAGE_KEY]: ownsRocket }, { once: true });
  await page.goto('/?seed=3&mode=ruler');

  await press(startButton(page));
  const overlay = page.locator('[data-phase]');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-player-look', standardLook);

  const icon = page.getByRole('button', { name: m.battle.garage, exact: true });
  await expect(icon).toBeVisible();
  if (touch) await expectBattleFits(page);
  const dir = info.config.metadata.screenshotDir as string | undefined;
  if (dir !== undefined) await page.screenshot({ path: `${dir}/battle-garage-${info.project.name}.png` });

  // One tap opens the garage over the battle; the round pauses.
  await press(icon);
  const garage = page.getByTestId('garage');
  await expect(garage).toBeVisible();
  await expect(overlay).toHaveAttribute('data-phase', 'paused');
  await expect(page.getByTestId('battle-main')).toHaveCount(1);

  await press(page.getByTestId('garage-item-rocket'));
  await expect(garage).toHaveAttribute('data-look', rocketLook);
  await press(garage.getByRole('button', { name: m.garage.back, exact: true }));
  await expect(garage).toHaveCount(0);

  // The same round continues with the new look on the child's tank.
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(canvas).toHaveAttribute('data-player-look', rocketLook);
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '0');
  await expect(overlay).toHaveAttribute('data-enemy-number', /^-?\d+$/);
  const enemy = String(await enemyNumber(overlay));
  await waitCalmly(page, overlay);
  for (const digit of enemy) await page.keyboard.press(digit);
  await expect(page.getByTestId('readout')).toHaveText(enemy);
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1');
});
