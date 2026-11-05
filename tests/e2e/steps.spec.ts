/**
 * US3 step animation end to end (T082, T083, FR-024, AC-05): with only subtraction on and the fixture seed, the
 * first search is "Der Gegner ist bei 43 − 7" with 43 highlighted on the ruler. H starts the step animation
 * 43 → 40 → 36 and costs no heart and no shot; typing 36 and Enter destroys the enemy. Game state comes from the
 * overlay's and the canvas's data-* attributes (D4).
 */
import { expect, seedStorage, startButton, test } from './fixtures';
import { SUBTRACTION_43_MINUS_7 } from '../../src/core/math/fixtures';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const m = t();

test('43 − 7: H shows the step animation 43, 40, 36, then 36 and Enter destroy the enemy (AC-05)', async ({ page }) => {
  test.setTimeout(90_000);
  await seedStorage(page, { [SETTINGS_KEY]: SUBTRACTION_43_MINUS_7.settings });
  await page.goto(`/?seed=${SUBTRACTION_43_MINUS_7.seed}`);
  await expect(startButton(page)).toBeVisible();
  await page.keyboard.press('Enter');
  const overlay = page.getByTestId('battle-overlay');
  const canvas = page.locator('canvas');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(page.getByTestId('challenge-banner')).toHaveText(m.challenge.subtraction(43, 7));
  await expect(canvas).toHaveAttribute('data-start-highlight', '43');
  await expect(canvas).toHaveAttribute('data-step-animation', '');

  await page.keyboard.press('h');
  await expect(canvas).toHaveAttribute('data-step-animation', '43,40,36');
  await expect(overlay).toHaveAttribute('data-help-level', '1');
  // The marker counts every step from 43 to 36. The animation runs on the game clock, which runs slower when the
  // machine is busy (several browsers at once), so the wait is generous; it takes about 4 s at full speed.
  await expect(canvas).toHaveAttribute('data-step-count', '7', { timeout: 40_000 });
  // Help is not a shot and costs no heart (FR-030, FR-081).
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(overlay).toHaveAttribute('data-turn', '0');
  await expect(overlay).toHaveAttribute('data-lives', '3');

  await page.keyboard.type('36');
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1');
  await expect(overlay).toHaveAttribute('data-last-shot', 'hit');
  // The new search has no step animation yet.
  await expect(canvas).toHaveAttribute('data-step-animation', '');
});
