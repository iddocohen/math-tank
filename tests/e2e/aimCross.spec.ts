/**
 * "Zielkreuz" end to end (amendment 19, FR-134, FR-135, T366).
 *
 * With "Nie" the canvas reports `data-aim-cross="off"` and draws no typed label on the ruler, while a typed number
 * still shows in the "Deine Zahl" readout and Enter still destroys the enemy. With "Bis Zahlenstrahl-Stufe 2" the cross
 * shows at a fixed ruler level 2 and is hidden at a fixed ruler level 3.
 *
 * With SCREENSHOT_DIR set, the Chromium run saves a battle with "Nie" and a typed number.
 */
import { enemyNumber, expect, seedStorage, startButton, test, waitCalmly } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import type { Settings } from '../../src/core/settings/schema';

const oneEnemy: Settings = { ...defaultSettings(), roundType: 'enemyCount', roundLength: 1 };

test('with "Zielkreuz" "Nie" a typed number shows only in the readout and still destroys the enemy', async ({ page }, info) => {
  test.setTimeout(90_000);
  await seedStorage(page, { [SETTINGS_KEY]: { ...oneEnemy, aimCross: { mode: 'never', level: 2 } } }, { once: true });
  await page.goto('/?seed=3&mode=ruler');
  await expect(startButton(page)).toBeVisible();
  await page.keyboard.press('Enter');
  const overlay = page.locator('[data-phase]');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-aim-cross', 'off');

  await expect(overlay).toHaveAttribute('data-enemy-number', /^\d+$/);
  const enemy = String(await enemyNumber(overlay));
  await waitCalmly(page, overlay);
  for (const digit of enemy) await page.keyboard.press(digit);
  await expect(page.getByTestId('readout')).toHaveText(enemy);
  // No label of the typed number on the ruler (FR-135).
  await expect(canvas).toHaveAttribute('data-preview-text', '');
  await expect(canvas).toHaveAttribute('data-aim-cross', 'off');
  const dir = info.config.metadata.screenshotDir as string | undefined;
  if (dir !== undefined && info.project.name === 'chromium') await page.screenshot({ path: `${dir}/battle-aim-cross-never.png` });

  await page.keyboard.press('Enter');
  await expect(page.getByTestId('round-end')).toBeVisible();
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1');
});

for (const [level, shown] of [
  [2, 'on'],
  [3, 'off'],
] as const) {
  test(`"Bis Zahlenstrahl-Stufe 2" at ruler level ${level}: the cross is ${shown}`, async ({ page }) => {
    const settings: Settings = { ...oneEnemy, rulerLevelStart: level, rulerLevelMax: level, aimCross: { mode: 'upToLevel', level: 2 } };
    await seedStorage(page, { [SETTINGS_KEY]: settings }, { once: true });
    await page.goto('/?seed=3&mode=ruler');
    await expect(startButton(page)).toBeVisible();
    await page.keyboard.press('Enter');
    const overlay = page.locator('[data-phase]');
    await expect(overlay).toHaveAttribute('data-phase', 'challenge');
    await page.keyboard.press('4');
    await expect(page.getByTestId('readout')).toHaveText('4');
    await expect(page.locator('canvas')).toHaveAttribute('data-aim-cross', shown);
  });
}
