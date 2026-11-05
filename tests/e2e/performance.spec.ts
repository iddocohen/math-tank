/**
 * Start time and frame rate (T150, SC-001, SC-002), in Chromium on desktop.
 *
 * - The battlefield is ready within 3 seconds of pressing Enter on the start screen.
 * - While the child's shell flies (`data-phase="playerShot"`), the frame rate measured from `requestAnimationFrame`
 *   timestamps averages at least 55 frames per second.
 *
 * Frame rates depend on the machine being idle, so this spec runs in its own Playwright project `performance`, after
 * every other project has finished (playwright.config.ts). `pnpm e2e --project=performance --no-deps` runs it alone.
 */
import { enemyNumber, expect, seedStorage, startButton, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';

declare global {
  interface Window {
    __shotFrames?: number[];
  }
}

test('the battlefield is ready within 3 s of Enter, and a shot flies at 55 frames per second or more', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), noDamage: true, roundType: 'enemyCount', roundLength: 3 } });
  await page.addInitScript(() => {
    // Every animation frame while the child's shell flies, by its requestAnimationFrame timestamp.
    window.__shotFrames = [];
    const sample = (ts: number) => {
      const overlay = document.querySelector<HTMLElement>('[data-testid="battle-overlay"]');
      if (overlay?.dataset.phase === 'playerShot') window.__shotFrames!.push(ts);
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.goto('/?seed=8');
  await expect(startButton(page)).toBeVisible();

  const overlay = page.getByTestId('battle-overlay');
  const pressed = Date.now();
  await page.keyboard.press('Enter');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 3_000 });
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true', { timeout: 3_000 });
  expect(Date.now() - pressed).toBeLessThan(3_000);

  // Without a graphics card, Chromium draws WebGL in software (SwiftShader) at about 40 frames per second; that says
  // nothing about a child's computer, so the frame rate is measured only on a real GPU.
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return info ? String(gl!.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown';
  });
  test.skip(/SwiftShader|llvmpipe|software/i.test(renderer), `no GPU in this browser (${renderer}); the frame rate is not measured`);

  // Two misses far from the enemy give long flights. The first shot warms up the drawing code (it can show one
  // stall of about 100 ms while the browser prepares the shell, trail and smoke); the second is measured.
  for (let shot = 0; shot < 2; shot++) {
    await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true');
    await page.evaluate(() => {
      window.__shotFrames = [];
    });
    const enemy = await enemyNumber(overlay);
    await page.keyboard.type(String(enemy > 50 ? 5 : 95));
    await page.keyboard.press('Enter');
    await expect(overlay).toHaveAttribute('data-phase', 'playerShot');
    await expect(overlay).not.toHaveAttribute('data-phase', 'playerShot');
  }

  const frames = await page.evaluate(() => window.__shotFrames ?? []);
  expect(frames.length).toBeGreaterThan(10);
  const fps = ((frames.length - 1) * 1000) / (frames.at(-1)! - frames[0]!);
  expect(fps).toBeGreaterThanOrEqual(55);
});
