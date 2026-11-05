/**
 * Amendment 21 end to end (FR-144 to FR-146): a 3-enemy wave in "Nur Zahlenstrahl" with each "Linien" style. The canvas
 * reports the style drawn and each curve as `number:endX:bow` (D4): every curve ends at its number's x on the ruler,
 * "Gerade" has no bow, and the curved styles bow by up to 20% of the ruler width (288 world units). With a curved style
 * help step 1 lights up the help target's curve for about 2 seconds. With SCREENSHOT_DIR set, the Chromium run saves a
 * screenshot of each style and of the highlight.
 */
import type { Page } from '@playwright/test';
import { expect, seedStorage, startButton, test, typeAndFire } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import type { Settings } from '../../src/core/settings/schema';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { numberToX } from '../../src/core/numberline/mapping';

async function screenshot(page: Page, name: string): Promise<void> {
  // playwright.config.ts passes SCREENSHOT_DIR as metadata (the e2e specs have no Node types).
  const dir = test.info().config.metadata.screenshotDir as string | undefined;
  if (dir && test.info().project.name === 'chromium') await page.screenshot({ path: `${dir}/${name}.png` });
}

async function startWave(page: Page, lineStyle: Settings['lineStyle']) {
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), adaptive: false, enemiesAtOnce: 3, lineStyle } });
  await page.goto('/?seed=3');
  await expect(startButton(page)).toBeVisible();
  await page.keyboard.press('2');
  const overlay = page.locator('[data-phase]');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-enemy-tanks', '3');
  return { overlay, canvas };
}

function parseCurves(attr: string): Array<{ number: number; endX: number; bow: number }> {
  return attr.split(';').map((entry) => {
    const [number, endX, bow] = entry.split(':').map(Number);
    return { number: number!, endX: endX!, bow: bow! };
  });
}

for (const style of ['straight', 'curved', 'tangled'] as const) {
  test(`"Linien" ${style}: three lines end at their enemies' numbers`, async ({ page }) => {
    const { canvas } = await startWave(page, style);
    await expect(canvas).toHaveAttribute('data-line-style', style);
    await expect(canvas).toHaveAttribute('data-pointer-curves', /^(-?\d+:\d+:\d+;){2}-?\d+:\d+:\d+$/);
    const curves = parseCurves((await canvas.getAttribute('data-pointer-curves'))!);
    const lines = (await canvas.getAttribute('data-pointer-lines'))!.split(',').map(Number);
    expect(curves.map((c) => c.number).sort((a, b) => a - b)).toEqual(lines);
    for (const c of curves) {
      expect(Math.abs(c.endX - numberToX(c.number, 0, 100))).toBeLessThanOrEqual(1);
      if (style === 'straight') expect(c.bow).toBe(0);
      else expect(c.bow).toBeLessThanOrEqual(288);
    }
    if (style !== 'straight') expect(curves.filter((c) => c.bow >= 115).length).toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(1200);
    await screenshot(page, `wave-3-${style}`);
  });
}

test('help step 1 lights up the help target\'s curve for about 2 seconds', async ({ page }) => {
  test.setTimeout(60_000);
  const { overlay, canvas } = await startWave(page, 'curved');
  const lines = (await canvas.getAttribute('data-pointer-lines'))!.split(',').map(Number);
  const miss = Math.round((lines[0]! + lines[1]!) / 2);
  await typeAndFire(page, overlay, miss);
  await expect(overlay).toHaveAttribute('data-help-level', '1');
  const target = await canvas.getAttribute('data-help-target');
  expect(target).toMatch(/^\d+$/);
  await expect(canvas).toHaveAttribute('data-curve-highlight', target!);
  await page.waitForTimeout(800);
  await screenshot(page, 'wave-3-curved-help-1');
  await expect(canvas).toHaveAttribute('data-curve-highlight', '', { timeout: 6000 });
});
