/**
 * Amendment 21 end to end (FR-144, FR-147): a 3-enemy wave in "Nur Zahlenstrahl" with each "Linien" style. The canvas
 * reports the style drawn (`data-line-style`) and the numbers of the tanks with a pointer line (`data-pointer-lines`,
 * D4). "Gerade" draws a line under every enemy. "Keine Linien" draws none; help step 1 shows the help target's straight
 * line for about 2 seconds (`data-help-line`) and hides it again. The curved styles were removed by the product owner
 * (amendment 21 item 18). With SCREENSHOT_DIR set, the Chromium run saves a screenshot of each style and of help step 1
 * with "Keine Linien".
 */
import type { Page } from '@playwright/test';
import { expect, seedStorage, startRound, test, typeAndFire } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import type { Settings } from '../../src/core/settings/schema';
import { SETTINGS_KEY } from '../../src/core/storage/storage';

async function screenshot(page: Page, name: string): Promise<void> {
  // playwright.config.ts passes SCREENSHOT_DIR as metadata (the e2e specs have no Node types).
  const dir = test.info().config.metadata.screenshotDir as string | undefined;
  if (dir && test.info().project.name === 'chromium') await page.screenshot({ path: `${dir}/${name}.png` });
}

async function startWave(page: Page, lineStyle: Settings['lineStyle']) {
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), adaptive: false, enemiesAtOnce: 3, lineStyle } });
  await page.goto('/?seed=3');
  const overlay = await startRound(page, '2');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-enemy-tanks', '3');
  return { overlay, canvas };
}

test('"Gerade": every enemy of the wave has its straight pointer line', async ({ page }) => {
  const { canvas } = await startWave(page, 'straight');
  await expect(canvas).toHaveAttribute('data-line-style', 'straight');
  await expect(canvas).toHaveAttribute('data-pointer-lines', /^\d+,\d+,\d+$/);
  await expect(canvas).toHaveAttribute('data-help-line', '');
  await page.waitForTimeout(1200);
  await screenshot(page, 'wave-3-straight');
});

test('"Keine Linien": no pointer line; help step 1 shows the help target\'s straight line for about 2 seconds', async ({ page }) => {
  test.setTimeout(60_000);
  // The same seed places the same wave with every line style; "Gerade" reports the enemies' numbers.
  const straight = await startWave(page, 'straight');
  await expect(straight.canvas).toHaveAttribute('data-pointer-lines', /^\d+,\d+,\d+$/);
  const numbers = (await straight.canvas.getAttribute('data-pointer-lines'))!.split(',').map(Number);
  const { overlay, canvas } = await startWave(page, 'none');
  await expect(canvas).toHaveAttribute('data-line-style', 'none');
  await expect(canvas).toHaveAttribute('data-pointer-lines', '');
  await expect(canvas).toHaveAttribute('data-help-line', '');
  await page.waitForTimeout(1200);
  await screenshot(page, 'wave-3-none');
  const miss = Math.round((numbers[0]! + numbers[1]!) / 2);
  await typeAndFire(page, overlay, miss);
  await expect(overlay).toHaveAttribute('data-last-shot', /^(miss|near)$/);
  await expect(overlay).toHaveAttribute('data-help-level', '1');
  const target = await canvas.getAttribute('data-help-target');
  expect(target).toMatch(/^\d+$/);
  await expect(canvas).toHaveAttribute('data-help-line', target!);
  await expect(canvas).toHaveAttribute('data-pointer-lines', '');
  await screenshot(page, 'wave-3-none-help-1');
  await expect(canvas).toHaveAttribute('data-help-line', '', { timeout: 6000 });
  await expect(canvas).toHaveAttribute('data-pointer-lines', '');
});
