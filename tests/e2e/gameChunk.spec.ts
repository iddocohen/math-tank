/**
 * Code review: when the game chunk (Phaser and the battle scene) cannot load, the round could never go on, so the
 * game goes back to the start screen instead of showing a battle without a battlefield.
 */
import { expect, startButton, test } from './fixtures';

test('a game chunk that fails to load brings the child back to the start screen', async ({ page }) => {
  await page.route(/\/assets\/createGame-[^/]*\.js$/, (route) => route.abort());
  await page.goto('/');
  await expect(startButton(page)).toBeVisible();
  await startButton(page).click();
  await expect(startButton(page)).toBeVisible();
  await expect(page.getByTestId('battle-overlay')).toHaveCount(0);
});
