/**
 * US4 comparison with decoy tanks end to end (T092, AC-06): with only comparison on and the fixture seed, the first
 * search is "Welche Zahl ist größer?" with tanks labeled 47 and 74. Tapping the tank labeled 47 destroys only the
 * decoy, a miss after which the enemy fires back with a shell from the top edge (amendment 07); typing 74 and Enter
 * destroys the enemy. Game state comes from the overlay's
 * and the canvas's data-* attributes (D4); `data-tank-taps` gives each tappable tank's tap point in world units.
 */
import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { COMPARISON_47_74 } from '../../src/core/math/fixtures';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../../src/core/battle/round';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const m = t();

/** Taps the tank labeled `label` at the tap point the canvas reports, scaled from world units to the page. */
async function tapTank(page: Page, label: number): Promise<void> {
  const canvas = page.locator('canvas');
  const taps = (await canvas.getAttribute('data-tank-taps')) ?? '';
  const entry = taps.split(';').find((e) => e.startsWith(`${label}@`));
  if (!entry) throw new Error(`no tank labeled ${label} in "${taps}"`);
  const [x, y] = entry.split('@')[1]!.split(',').map(Number) as [number, number];
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + (x * box.width) / WORLD_WIDTH, box.y + (y * box.height) / WORLD_HEIGHT);
}

test('47 vs 74: tapping 47 destroys only the decoy, typing 74 and Enter destroys the enemy (AC-06)', async ({ page }) => {
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
  await expect(page.getByTestId('challenge-banner')).toHaveText(m.challenge.greater);
  // Both tanks stand at their numbers with a pointer line and a tap area.
  await expect(canvas).toHaveAttribute('data-pointer-lines', /^(47,74|74,47)$/);
  await expect(canvas).toHaveAttribute('data-tank-taps', /47@.*74@|74@.*47@/);
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true');

  await tapTank(page, 47);
  await expect(overlay).toHaveAttribute('data-last-shot', 'miss', { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-last-landing', '47');
  // The decoy is gone: no pointer line and no tap area for 47.
  await expect(canvas).toHaveAttribute('data-pointer-lines', '74');
  await expect(canvas).not.toHaveAttribute('data-tank-taps', /47@/);
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '0');
  // A decoy hit is a miss, so the enemy fires back, then the search goes on (amendment 07, FR-081).
  await expect(overlay).toHaveAttribute('data-phase', 'enemyTurn', { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-lives', '3');
  await expect(overlay).toHaveAttribute('data-help-level', '1');

  await page.keyboard.type('74');
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1', { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-last-shot', 'hit');
});
