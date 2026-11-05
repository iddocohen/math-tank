/**
 * Bug "iPhone rotation in Chrome" (Phase 24), found while testing it: Phaser queues `scene.pause()` and
 * `scene.resume()` until its next frame, and the battle scene asked `scene.isPaused()`, which still answers the state
 * before the queue runs. A pause and a resume within one frame (a phone turned upright and back quickly, now that the
 * media queries report a turn at once) left the scene paused while the round went on, so the enemy's shell never
 * landed and the round hung in `enemyTurn`. The spec pauses and resumes within one task with the pause button.
 */
import { enemyNumber, expect, seedStorage, startButton, test, typeAndFire } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';

test('a pause and a resume within one frame during the enemy turn do not stop the round', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), noDamage: true, challengeTypes: { ...defaultSettings().challengeTypes, comparison: false } } });
  await page.goto('/?seed=5');
  await startButton(page).click();
  const overlay = page.getByTestId('battle-overlay');
  const enemy = await enemyNumber(overlay);
  await typeAndFire(page, overlay, enemy > 50 ? enemy - 30 : enemy + 30, { calm: false });
  await expect(overlay).toHaveAttribute('data-phase', 'enemyTurn');

  await page.evaluate(async () => {
    (document.querySelector('[data-testid="pause-button"]') as HTMLButtonElement).click();
    await Promise.resolve();
    (document.querySelector('[data-testid="pause-screen"] button') as HTMLButtonElement).click();
  });
  await expect(page.getByTestId('pause-screen')).toHaveCount(0);
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
});
