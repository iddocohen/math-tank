/**
 * US4 comparison with one enemy end to end (T240, AC-06, amendment 09): with only comparison on and the fixture
 * seed, the first search asks "Der Gegner steht bei der größeren Zahl: 47 oder 74". Exactly one enemy tank stands on
 * the battlefield, at 74, with its pointer line. Firing at 47 is a miss with help step 1, and the enemy fires back
 * from its own tank; typing 74 and Enter destroys the enemy. Game state comes from the overlay's and the canvas's
 * data-* attributes (D4): `data-enemy-tanks` counts the enemy tanks drawn.
 */
import { expect, test } from './fixtures';
import { COMPARISON_47_74 } from '../../src/core/math/fixtures';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const m = t();

test('47 oder 74: one enemy at 74; 47 is a miss, typing 74 and Enter destroys the enemy (AC-06)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [SETTINGS_KEY, JSON.stringify(COMPARISON_47_74.settings)] as const,
  );
  await page.goto(`/?seed=${COMPARISON_47_74.seed}`);
  await expect(page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  const overlay = page.getByTestId('battle-overlay');
  const canvas = page.locator('canvas');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(page.getByTestId('challenge-banner')).toHaveText('Der Gegner steht bei der größeren Zahl: 47 oder 74');
  await expect(page.getByTestId('banner-option')).toHaveText(['47', '74']);
  // Exactly one enemy tank, at 74, with one pointer line and no tank to tap.
  await expect(canvas).toHaveAttribute('data-enemy-tanks', '1');
  await expect(canvas).toHaveAttribute('data-pointer-lines', '74');
  await expect(canvas).not.toHaveAttribute('data-tank-taps', /.+/);
  await expect(overlay).toHaveAttribute('data-enemy-number', '74');
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true');

  await page.keyboard.type('47');
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-last-shot', 'miss', { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-last-landing', '47');
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '0');
  // A miss: the enemy fires back from its own tank, then the search goes on with help step 1 (FR-031, FR-081).
  await expect(overlay).toHaveAttribute('data-phase', 'enemyTurn', { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-help-level', '1');
  await expect(page.getByTestId('tens-digit')).toHaveText(['4', '7']);
  await expect(canvas).toHaveAttribute('data-enemy-tanks', '1');

  await page.keyboard.type('74');
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1', { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-last-shot', 'hit');
});
