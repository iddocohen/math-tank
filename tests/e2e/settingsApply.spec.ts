/**
 * Amendment 25: saved settings reach the running round when the settings page closes. During a round with the range
 * 0 to 100, the parent changes "Zahlenraum" to 0 to 20 and presses "Speichern". After "Schließen" the round continues
 * with a new scene: the ruler reads 0 to 20 and the enemy stands within 0 to 20, while the hearts and the destroyed
 * count stay. Runs in the desktop projects and in the device projects (playwright.config.ts); on touch devices the
 * parent gate is a held touch and every button is a tap.
 *
 * With SCREENSHOT_DIR set, every project saves the battle before and after the range change.
 */
import type { Locator, Page } from '@playwright/test';
import { enemyNumber, expect, pressGear, seedStorage, startButton, test, touchHold, waitCalmly } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const m = t();

async function rulerEnds(page: Page): Promise<[number, number]> {
  const labels = (await page.locator('canvas').getAttribute('data-ruler-labels'))!.split(',').map(Number);
  return [labels[0]!, labels.at(-1)!];
}

test('a range saved during a round gives the round a new scene with that range; hearts and destroyed count stay', async ({ page }, info) => {
  test.setTimeout(90_000);
  const touch = info.project.use.hasTouch === true;
  const press = async (locator: Locator) => (touch ? locator.tap() : locator.click());
  const dir = info.config.metadata.screenshotDir as string | undefined;
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), noDamage: false } }, { once: true });
  await page.goto('/?seed=3&mode=ruler');

  await press(startButton(page));
  const overlay = page.getByTestId('battle-overlay');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-ruler-labels', /^0,.*,100$/);

  // One destroyed enemy, so the kept count is not just the start value.
  const first = String(await enemyNumber(overlay));
  await waitCalmly(page, overlay);
  for (const digit of first) await page.keyboard.press(digit);
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  const lives = await overlay.getAttribute('data-lives');
  const seedBefore = await canvas.getAttribute('data-terrain-seed');
  if (dir !== undefined) await page.screenshot({ path: `${dir}/settings-apply-before-${info.project.name}.png` });

  // Parent gate, "Einstellungen", 0 to 20, "Speichern", "Schließen".
  const gear = page.getByTestId('parent-gate');
  if (touch) await touchHold(gear);
  else await pressGear(page);
  await press(page.getByRole('dialog', { name: m.parent.menu }).getByRole('button', { name: m.parent.settings, exact: true }));
  const settings = page.getByTestId('settings-page');
  await expect(settings).toBeVisible();
  await expect(overlay).toHaveAttribute('data-phase', 'paused');
  await settings.getByLabel(m.settings.labels.rangePreset, { exact: true }).selectOption('0-20');
  await press(settings.getByRole('button', { name: m.settings.save, exact: true }));
  await expect(settings.getByText(m.settings.saved)).toBeVisible();
  await press(settings.getByRole('button', { name: m.parent.close, exact: true }));
  await expect(settings).toHaveCount(0);

  // The same round continues with a new scene in 0 to 20.
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(canvas).not.toHaveAttribute('data-terrain-seed', seedBefore!);
  await expect(canvas).toHaveAttribute('data-ruler-labels', /^0,.*,20$/);
  expect(await rulerEnds(page)).toEqual([0, 20]);
  const enemy = await enemyNumber(overlay);
  expect(enemy).toBeGreaterThanOrEqual(0);
  expect(enemy).toBeLessThanOrEqual(20);
  await expect(overlay).toHaveAttribute('data-lives', lives!);
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1');
  if (dir !== undefined) await page.screenshot({ path: `${dir}/settings-apply-after-${info.project.name}.png` });

  // The new range holds for the next shot: the exact number destroys the enemy.
  await waitCalmly(page, overlay);
  for (const digit of String(enemy)) await page.keyboard.press(digit);
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '2');
});
