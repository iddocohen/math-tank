/**
 * Amendment 16 (FR-127, SC-001, SC-002): speed on a slow Fire tablet. The Fire 7 size in Chromium with Silk's user
 * agent and touch, with the processor slowed 4 times through the Chrome DevTools Protocol
 * (`Emulation.setCPUThrottlingRate`), which approximates a Fire 7 or Fire HD 8.
 *
 * - The battlefield is ready within 3 seconds of tapping "Gemischt".
 * - While the child's shell flies, the main thread needs at most 1000 / 30 ms per drawn frame (CDP `TaskDuration`
 *   divided by the frames counted with `requestAnimationFrame`). This is measured in every environment: throttling
 *   slows only the page's main thread, and the drawing itself happens in the GPU process, so this number is what a slow
 *   processor changes.
 * - With a graphics card (Metal on macOS, see playwright.config.ts), the frame rate during the shot is at least 30. Without
 *   one, Chromium draws WebGL in software (SwiftShader) in the GPU process, which says nothing about a Fire tablet's
 *   graphics chip, so the frame rate check is skipped there and only the main-thread time is checked.
 *
 * Runs in its own project `fire-performance`, after the `performance` project, alone.
 * `pnpm e2e --project=fire-performance --no-deps` runs it alone.
 */
import { enemyNumber, expect, seedStorage, startButton, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';

declare global {
  interface Window {
    __shotFrames?: number[];
  }
}

const FRAME_BUDGET_MS = 1000 / 30;

test('with the processor slowed 4 times: the battlefield within 3 s, and a shot within the 30 fps budget', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const cdp = await page.context().newCDPSession(page);
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), noDamage: true, roundType: 'enemyCount', roundLength: 3 } });
  await page.addInitScript(() => {
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
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const overlay = page.getByTestId('battle-overlay');
  const pressed = Date.now();
  await startButton(page).tap();
  await expect(page.locator('canvas')).toBeVisible({ timeout: 3_000 });
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true', { timeout: 3_000 });
  const startMs = Date.now() - pressed;
  expect(startMs).toBeLessThan(3_000);

  const taskSeconds = async () => (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'TaskDuration')!.value;

  // Two misses far from the enemy give long flights; the first warms up the drawing code, the second is measured.
  let mainMs = 0;
  for (let shot = 0; shot < 2; shot++) {
    await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true');
    await page.evaluate(() => {
      window.__shotFrames = [];
    });
    const enemy = await enemyNumber(overlay);
    for (const key of String(enemy > 50 ? 5 : 95)) await page.locator(`[data-key="${key}"]`).tap();
    await page.locator('.fire-button').tap();
    await expect(overlay).toHaveAttribute('data-phase', 'playerShot');
    const before = await taskSeconds();
    await expect(overlay).not.toHaveAttribute('data-phase', 'playerShot');
    mainMs = ((await taskSeconds()) - before) * 1000;
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  const frames = await page.evaluate(() => window.__shotFrames ?? []);
  expect(frames.length).toBeGreaterThan(10);
  const fps = ((frames.length - 1) * 1000) / (frames.at(-1)! - frames[0]!);
  const perFrameMs = mainMs / frames.length;
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return info ? String(gl!.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown';
  });
  testInfo.annotations.push({
    type: 'fire-performance',
    description: `start ${startMs} ms; ${frames.length} frames at ${fps.toFixed(1)} fps; main thread ${perFrameMs.toFixed(1)} ms per frame; renderer ${renderer}`,
  });

  expect(perFrameMs, 'main-thread time per frame with the processor slowed 4 times').toBeLessThanOrEqual(FRAME_BUDGET_MS);
  const software = /SwiftShader|llvmpipe|software/i.test(renderer);
  if (!software) expect(fps, `frame rate with ${renderer}`).toBeGreaterThanOrEqual(30);
});
