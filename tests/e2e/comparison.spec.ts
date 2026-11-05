/**
 * US4 comparison with decoys without number plates end to end (T249, AC-06, amendment 10): with only comparison on
 * and the fixture seed, the first search asks "Der Gegner steht bei der größeren Zahl: 47 oder 74". Two tanks that
 * look the same stand at 47 and 74, each with its pointer line and no number plate. Firing at 47 bursts the decoy: a
 * miss with help step 1, and the enemy fires back. Typing 74 and Enter, or tapping the tank at 74, destroys the enemy.
 * Game state comes from the overlay's and the canvas's data-* attributes (D4): `data-enemy-tanks` counts the standing
 * tanks that look like the enemy, `data-tank-taps` gives each tappable tank's tap point in world units,
 * `data-decoy-bursts` counts burst decoys and `data-help-tanks` names the tank marked by help step 3.
 */
import { expect, GAME_WAIT, startButton, test } from './fixtures';
import type { Page } from '@playwright/test';
import { COMPARISON_47_74 } from '../../src/core/math/fixtures';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../../src/core/battle/round';
import { SETTINGS_KEY } from '../../src/core/storage/storage';

/** Starts the AC-06 round and waits until the first search is answerable. */
async function startFixture(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [SETTINGS_KEY, JSON.stringify(COMPARISON_47_74.settings)] as const,
  );
  await page.goto(`/?seed=${COMPARISON_47_74.seed}`);
  await expect(startButton(page)).toBeVisible();
  await page.keyboard.press('Enter');
  const overlay = page.getByTestId('battle-overlay');
  const canvas = page.locator('canvas');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(page.getByTestId('challenge-banner')).toHaveText('Der Gegner steht bei der größeren Zahl: 47 oder 74');
  await expect(page.getByTestId('banner-option')).toHaveText(['47', '74']);
  // Two identical tanks, at 47 and 74, each with a pointer line and a tap area.
  await expect(canvas).toHaveAttribute('data-enemy-tanks', '2');
  await expect(canvas).toHaveAttribute('data-pointer-lines', '47,74');
  await expect(canvas).toHaveAttribute('data-tank-taps', /^47@\d+,\d+;74@\d+,\d+$/);
  await expect(canvas).toHaveAttribute('data-decoy-bursts', '0');
  await expect(overlay).toHaveAttribute('data-enemy-number', '74');
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true');
}

/** Taps the tank standing at `n` at the tap point the canvas reports, scaled from world units to the page. */
async function tapTank(page: Page, n: number): Promise<void> {
  const canvas = page.locator('canvas');
  const taps = (await canvas.getAttribute('data-tank-taps')) ?? '';
  const entry = taps.split(';').find((e) => e.startsWith(`${n}@`));
  if (!entry) throw new Error(`no tank at ${n} in "${taps}"`);
  const [x, y] = entry.split('@')[1]!.split(',').map(Number) as [number, number];
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + (x * box.width) / WORLD_WIDTH, box.y + (y * box.height) / WORLD_HEIGHT);
}

test('47 oder 74: two tanks; firing at 47 bursts the decoy as a miss, typing 74 and Enter destroys the enemy (AC-06)', async ({ page }) => {
  test.setTimeout(60_000);
  await startFixture(page);
  const overlay = page.getByTestId('battle-overlay');
  const canvas = page.locator('canvas');

  await page.keyboard.type('47');
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-last-shot', 'miss', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-last-landing', '47');
  // The decoy burst: one tank left, no pointer line and no tap area at 47, and no score.
  await expect(canvas).toHaveAttribute('data-decoy-bursts', '1');
  await expect(canvas).toHaveAttribute('data-enemy-tanks', '1');
  await expect(canvas).toHaveAttribute('data-pointer-lines', '74');
  await expect(canvas).not.toHaveAttribute('data-tank-taps', /47@/);
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '0');
  // A decoy hit is a miss: the enemy fires back, then the search goes on with help step 1 (FR-031, FR-081).
  await expect(overlay).toHaveAttribute('data-phase', 'enemyTurn', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-help-level', '1');
  await expect(page.getByTestId('tens-digit')).toHaveText(['4', '7']);

  await page.keyboard.type('74');
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-last-shot', 'hit');
});

test('tapping the tank at 47 bursts the decoy; help step 3 marks the tank at 74, and tapping it destroys the enemy (FR-026, FR-031, FR-064)', async ({ page }) => {
  test.setTimeout(60_000);
  await startFixture(page);
  const overlay = page.getByTestId('battle-overlay');
  const canvas = page.locator('canvas');

  await tapTank(page, 47);
  await expect(canvas).toHaveAttribute('data-decoy-bursts', '1', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-last-shot', 'miss');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-help-level', '1');
  await expect(canvas).toHaveAttribute('data-help-tanks', '');

  await page.keyboard.press('h');
  await page.keyboard.press('h');
  await expect(overlay).toHaveAttribute('data-help-level', '3');
  await expect(canvas).toHaveAttribute('data-help-tanks', '74');

  await tapTank(page, 74);
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-last-shot', 'hit');
});

/** The x of each tank tap point in world units, sorted. */
async function tankXs(page: Page): Promise<number[]> {
  const taps = (await page.locator('canvas').getAttribute('data-tank-taps')) ?? '';
  return taps
    .split(';')
    .filter(Boolean)
    .map((e) => Number(e.split('@')[1]!.split(',')[0]))
    .sort((a, b) => a - b);
}

/** The start x of each shell of the latest enemy shot, sorted. */
async function volleyXs(page: Page): Promise<number[]> {
  const volley = (await page.locator('canvas').getAttribute('data-enemy-volley')) ?? '';
  return volley.split(';').filter(Boolean).map(Number);
}

test('bug report B2: after a miss every standing tank fires from its own barrel; after the decoy bursts only the enemy fires (FR-043a)', async ({ page }) => {
  test.setTimeout(60_000);
  await startFixture(page);
  const overlay = page.getByTestId('battle-overlay');
  const tanks = await tankXs(page);
  expect(tanks).toHaveLength(2);

  // A plain miss far from both tanks: both tanks fire together.
  await page.keyboard.type('20');
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-phase', 'enemyTurn', { timeout: GAME_WAIT });
  await expect.poll(() => volleyXs(page).then((xs) => xs.length), { timeout: 5_000 }).toBe(2);
  const xs = await volleyXs(page);
  xs.forEach((x, i) => expect(Math.abs(x - tanks[i]!)).toBeLessThanOrEqual(40));
  await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: GAME_WAIT });

  // The decoy bursts: the enemy fires alone, from its own tank at 74.
  await page.keyboard.type('47');
  await page.keyboard.press('Enter');
  await expect(page.locator('canvas')).toHaveAttribute('data-decoy-bursts', '1', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-phase', 'enemyTurn', { timeout: GAME_WAIT });
  await expect.poll(() => volleyXs(page).then((v) => v.length), { timeout: 5_000 }).toBe(1);
  expect(Math.abs((await volleyXs(page))[0]! - tanks[1]!)).toBeLessThanOrEqual(40);
  await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: GAME_WAIT });
});
