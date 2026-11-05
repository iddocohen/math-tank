/**
 * Amendment 18 (T355, FR-129): with "Punkt nach voller Hilfe" off, a hit at the shown solution destroys the enemy and
 * brings a new one, but the tank counter, the stars and "Gegner pro Runde" do not move, and the line reads
 * "Getroffen, mit Hilfe.". A hit without help and a hit after one help step count. Keyboard only; game state comes
 * from the overlay's data-* attributes (D4).
 */
import { enemyNumber, expect, seedStorage, test, typeAndFire } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { GARAGE_KEY, SETTINGS_KEY } from '../../src/core/storage/storage';
import { emptyGarage } from '../../src/core/rewards/garage';
import { t } from '../../src/i18n';

const m = t();

test('with "Punkt nach voller Hilfe" off, the hit at the shown solution does not count; hits without full help do', async ({ page }) => {
  const settings = {
    ...defaultSettings(),
    pointAfterFullHelp: false,
    roundType: 'enemyCount' as const,
    roundLength: 2,
    enemyDifficulty: 'easy' as const,
    challengeTypes: { numberLine: true, addition: false, subtraction: false, comparison: false },
  };
  await seedStorage(page, { [SETTINGS_KEY]: settings, [GARAGE_KEY]: emptyGarage() }, { once: true });
  await page.goto('/?seed=21');
  await expect(page.getByTestId('mode-button')).toHaveCount(3);
  await page.keyboard.press('1');
  const overlay = page.getByTestId('battle-overlay');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-terrain-seed', /\d/);
  const terrain = (await canvas.getAttribute('data-terrain-seed'))!;

  // Three help requests show the solution; Enter fires at it.
  const first = await enemyNumber(overlay);
  for (const level of ['1', '2', '3']) {
    await page.keyboard.press('h');
    await expect(overlay).toHaveAttribute('data-help-level', level);
  }
  await expect(overlay).toHaveAttribute('data-selection', String(first));
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('hit-feedback')).toHaveText(`${m.battle.hitWithHelp} ${m.battle.enemyStoodAt(first)}`);
  await expect(overlay).toHaveAttribute('data-help-level', '0');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '0');
  await expect(page.getByTestId('score')).toHaveText('0');
  // New hills after the destroyed enemy, also when it does not count (FR-101).
  await expect(canvas).not.toHaveAttribute('data-terrain-seed', terrain);

  // A hit without help counts.
  await typeAndFire(page, overlay, await enemyNumber(overlay));
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1');
  await expect(page.getByTestId('hit-feedback')).toContainText(m.battle.hit);

  // A hit after one help step counts and reaches the round goal of 2.
  await expect(overlay).toHaveAttribute('data-help-level', '0');
  await page.keyboard.press('h');
  await expect(overlay).toHaveAttribute('data-help-level', '1');
  await typeAndFire(page, overlay, await enemyNumber(overlay));
  await expect(overlay).toHaveAttribute('data-outcome', 'goalReached');
  await expect(page.getByTestId('star-total')).toContainText('2');
});
