/**
 * US2 guided mode end to end (T065, T070, T226, FR-010, FR-013, FR-014, FR-019, FR-072, FR-073, FR-081, FR-083,
 * SC-009, AC-02): "Spielen" starts a guided search with the enemy and its pointer line visible (amendment 07) and a
 * challenge banner. The child taps the ruler (pointer input, so "Finde N" can come, FR-076), fires at a wrong number,
 * sees where the shell landed and the step count to the enemy, and the enemy fires back; then the child taps N and
 * fires: the enemy is destroyed and a new search starts. After a page reload the enemy is visible again. Game state
 * comes from the overlay's and the canvas's data-* attributes (D4).
 */
import type { Locator, Page } from '@playwright/test';
import { expect, GAME_WAIT, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { numberToX } from '../../src/core/numberline/mapping';
import { t } from '../../src/i18n';

const m = t();
const { min, max } = defaultSettings().range;
/** The ruler's axis in world units (src/game/NumberLineView.ts). */
const RULER_Y = 742;

/** Taps the ruler at number n, using the canvas box and numberToX (the world is 1600 by 900 units, scaled to fit). */
async function tapRuler(page: Page, n: number): Promise<void> {
  const box = (await page.locator('canvas').boundingBox())!;
  const x = box.x + (numberToX(n, min, max) * box.width) / 1600;
  const y = box.y + (RULER_Y * box.height) / 900;
  await page.mouse.click(x, y);
}

/** Starts new scenes until the search is "Finde N"; returns N. The pointer input carries into every new round. */
async function findNumberSearch(page: Page, overlay: Locator): Promise<number> {
  const banner = page.getByTestId('challenge-banner');
  for (let i = 0; i < 60; i++) {
    await expect(overlay).toHaveAttribute('data-phase', 'challenge');
    const match = /^Finde (-?\d+)$/.exec((await banner.textContent()) ?? '');
    if (match) return Number(match[1]);
    const seed = await overlay.getAttribute('data-round-seed');
    await page.getByTestId('new-scene').click();
    await expect(overlay).not.toHaveAttribute('data-round-seed', seed!);
  }
  throw new Error('no "Finde N" search in 60 new scenes');
}

test('a guided "Finde N" search: the enemy is visible, a miss shows the step count and the enemy fires back, the exact number destroys it', async ({ page }) => {
  test.setTimeout(120_000);
  // Comparison off: this test is about a position search.
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), challengeTypes: { ...defaultSettings().challengeTypes, comparison: false } })] as const,
  );
  await page.goto('/?seed=11');
  await page.getByRole('button', { name: m.start.play, exact: true }).click();
  const overlay = page.getByTestId('battle-overlay');
  const canvas = page.locator('canvas');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(page.getByTestId('challenge-banner')).toBeVisible();
  // A new challenge first stands large in the middle of the sky, then moves to the top center (T234, FR-088).
  await expect(page.getByTestId('challenge-banner')).toHaveAttribute('data-placement', 'center');
  await expect(page.getByTestId('challenge-banner')).toHaveAttribute('data-placement', 'top', { timeout: 6_000 });
  // The enemy and its pointer line are visible from the start of the search (amendment 07, FR-010, FR-073).
  await expect(overlay).toHaveAttribute('data-enemy-number', /^\d+$/);
  await expect(canvas).toHaveAttribute('data-pointer-lines', (await overlay.getAttribute('data-enemy-number'))!);

  // One tap on the ruler makes the input method pointer, so a "Finde N" search can come (FR-076).
  await tapRuler(page, Math.round((min + max) / 2));
  const n = await findNumberSearch(page, overlay);
  await expect(overlay).toHaveAttribute('data-enemy-number', String(n));
  await expect(canvas).toHaveAttribute('data-pointer-lines', String(n));
  await expect(overlay).toHaveAttribute('data-help-level', '0');
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true');
  await expect(overlay).not.toHaveAttribute('data-shots-since-enemy-fire', /.*/);

  // Tap a wrong number, 10 away (off the enemy's body): the selection moves, but no number is shown (amendment 05).
  const wrong = n - 10 >= min ? n - 10 : n + 10;
  await tapRuler(page, wrong);
  await expect(overlay).toHaveAttribute('data-selection', String(wrong));
  await expect(page.getByTestId('readout')).toHaveText('?');
  await expect(canvas).toHaveAttribute('data-preview-text', '');
  // Releasing on a number only previews it: nothing is fired.
  await page.waitForTimeout(500);
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(overlay).toHaveAttribute('data-turn', '0');

  // Fire: the shell lands at the wrong number, the ruler shows "10 Schritte" to the enemy, and the enemy fires back
  // at once. Its first shot of a round always misses (amendment 07, FR-043, FR-072, FR-081).
  await page.getByRole('button', { name: m.battle.fire }).click();
  await expect(overlay).toHaveAttribute('data-last-landing', String(wrong), { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-last-shot', 'miss');
  await expect(overlay).toHaveAttribute('data-last-distance', '10');
  await expect(canvas).toHaveAttribute('data-steps-label', m.battle.steps(10));
  await expect(overlay).toHaveAttribute('data-phase', 'enemyTurn', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-lives', '3');
  await expect(overlay).toHaveAttribute('data-turn', '1');
  await expect(overlay).toHaveAttribute('data-help-level', '1');
  // One message line (T230): the ruler shows the landing number, the status line the phrase and then the help text.
  await expect(canvas).toHaveAttribute('data-landing', String(wrong));
  await expect(page.getByText(m.battle.landedAt(wrong))).toHaveCount(0);
  await expect(page.getByTestId('encouragement')).toBeVisible();
  expect(m.encouragements).toContain(await page.getByTestId('encouragement').textContent());
  await expect(page.getByRole('status').locator(':scope > *')).toHaveCount(1);
  await expect(page.getByTestId('help-text')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('encouragement')).toHaveCount(0);
  // The enemy stays visible at its number, and the step count stays on the ruler until the next fire.
  await expect(overlay).toHaveAttribute('data-enemy-number', String(n));
  await expect(canvas).toHaveAttribute('data-steps-label', m.battle.steps(10));

  // The exact number destroys the enemy; a new search starts with a new visible enemy (FR-066, FR-083).
  await tapRuler(page, n);
  await expect(overlay).toHaveAttribute('data-selection', String(n));
  await page.getByRole('button', { name: m.battle.fire }).click();
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-last-shot', 'hit');
  await expect(page.getByTestId('hit-feedback')).toHaveText(`${m.battle.hit} ${m.battle.enemyStoodAt(n)}`);
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(overlay).toHaveAttribute('data-help-level', '0');
  await expect(overlay).toHaveAttribute('data-enemy-number', /^\d+$/);
  await expect(page.getByTestId('score')).toHaveText('1');
  // The next challenge starts as a centered card; the hit text and the hit's landing marker are gone within about
  // 2 seconds while it runs (T233, T234, P7).
  await expect(page.getByTestId('challenge-banner')).toHaveAttribute('data-placement', 'center');
  await expect(page.getByTestId('hit-feedback')).toHaveCount(0, { timeout: 3_000 });
  await expect(canvas).toHaveAttribute('data-landing', '', { timeout: 3_000 });
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');

  // After a page reload the new round shows the enemy and its pointer line again (amendment 07, product owner report).
  await page.reload();
  await page.getByRole('button', { name: m.start.play, exact: true }).click();
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(overlay).toHaveAttribute('data-enemy-number', /^\d+$/);
  await expect(canvas).toHaveAttribute('data-pointer-lines', (await overlay.getAttribute('data-enemy-number'))!);
});

test('Enter starts guided mode; "Freies Spiel" shows only when the parent allows free play (T070, FR-014)', async ({ page }) => {
  await page.goto('/?seed=12');
  await expect(page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: m.start.freePlay })).toHaveCount(0);
  await page.keyboard.press('Enter');
  const overlay = page.getByTestId('battle-overlay');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(page.getByTestId('challenge-banner')).toBeVisible();

  // With free play allowed, "Freies Spiel" starts a free-play round with the enemy visible.
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), freePlay: true })] as const);
  await page.goto('/?seed=12');
  await page.getByRole('button', { name: m.start.freePlay }).click();
  await expect(overlay).toHaveAttribute('data-phase', 'aiming');
  await expect(overlay).toHaveAttribute('data-enemy-number', /^\d+$/);
  await expect(page.getByTestId('challenge-banner')).toHaveText(m.challenge.readPosition);
});
