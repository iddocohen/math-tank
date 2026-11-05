/**
 * US2 guided mode end to end (T065, T070, FR-010, FR-013, FR-014, FR-019, FR-081, FR-083, SC-009, AC-02):
 * "Spielen" starts a guided search with a hidden enemy and a challenge banner. The child taps the ruler (pointer
 * input, so "Finde N" can come, FR-076), fires at a wrong number and sees where the shell landed, then taps N and
 * fires: the enemy is destroyed and a new search starts. Game state comes from the overlay's data-* attributes (D4).
 */
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
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

test('a guided "Finde N" search: a miss shows the landing number, the exact number destroys the hidden enemy', async ({ page }) => {
  test.setTimeout(120_000);
  // Comparison off: a comparison search shows the enemy among its decoys, and this test is about a hidden enemy.
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), challengeTypes: { ...defaultSettings().challengeTypes, comparison: false } })] as const,
  );
  await page.goto('/?seed=11');
  await page.getByRole('button', { name: m.start.play, exact: true }).click();
  const overlay = page.getByTestId('battle-overlay');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(page.getByTestId('challenge-banner')).toBeVisible();
  // The enemy hides: the overlay has no enemy number (FR-010).
  await expect(overlay).not.toHaveAttribute('data-enemy-number', /.*/);

  // One tap on the ruler makes the input method pointer, so a "Finde N" search can come (FR-076).
  await tapRuler(page, Math.round((min + max) / 2));
  const n = await findNumberSearch(page, overlay);
  await expect(overlay).toHaveAttribute('data-help-level', '0');
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true');
  await expect(overlay).toHaveAttribute('data-shots-since-enemy-fire', '0');

  // Tap a wrong number, 10 away (off the enemy's body): the selection moves, but no number is shown (amendment 05).
  const wrong = n - 10 >= min ? n - 10 : n + 10;
  await tapRuler(page, wrong);
  await expect(overlay).toHaveAttribute('data-selection', String(wrong));
  await expect(page.getByTestId('readout')).toHaveText('?');
  await expect(page.locator('canvas')).toHaveAttribute('data-preview-text', '');
  // Releasing on a number only previews it: nothing is fired.
  await page.waitForTimeout(500);
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(overlay).toHaveAttribute('data-turn', '0');

  // Fire: the shell lands at the wrong number. It is the first shot, so the enemy does not fire (FR-081).
  await page.getByRole('button', { name: m.battle.fire }).click();
  await expect(overlay).toHaveAttribute('data-last-landing', String(wrong), { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(overlay).toHaveAttribute('data-last-shot', 'miss');
  await expect(overlay).toHaveAttribute('data-shots-since-enemy-fire', '1');
  await expect(overlay).toHaveAttribute('data-turn', '1');
  await expect(overlay).toHaveAttribute('data-help-level', '1');
  await expect(page.getByText(m.battle.landedAt(wrong))).toBeVisible();
  await expect(page.getByTestId('encouragement')).toBeVisible();
  expect(m.encouragements).toContain(await page.getByTestId('encouragement').textContent());
  // Still hidden after the miss.
  await expect(overlay).not.toHaveAttribute('data-enemy-number', /.*/);

  // The exact number destroys the enemy; a new search starts with a new hidden enemy (FR-066, FR-083).
  await tapRuler(page, n);
  await expect(overlay).toHaveAttribute('data-selection', String(n));
  await page.getByRole('button', { name: m.battle.fire }).click();
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1', { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-last-shot', 'hit');
  await expect(page.getByTestId('hit-feedback')).toHaveText(`${m.battle.hit} ${m.battle.enemyStoodAt(n)}`);
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(overlay).toHaveAttribute('data-help-level', '0');
  await expect(overlay).toHaveAttribute('data-shots-since-enemy-fire', '0');
  await expect(page.getByTestId('score')).toHaveText('1');
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
