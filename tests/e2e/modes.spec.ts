/**
 * Amendment 17 end to end (T340, FR-121 to FR-124, FR-037), keyboard only. The start screen offers three picture
 * buttons; 1, 2 and 3 start "Gemischt", "Nur Zahlenstrahl" and "Nur Rechnen". Game state comes from the data-* attributes
 * (D4): `data-mode` and `data-skill-step` on the battle overlay, `data-ruler-labels`, `data-pointer-lines`,
 * `data-steps-label` and `data-help-zoom` on the canvas. Every shot waits like a calm child (waitCalmly), so a hit is
 * an independent answer and no miss is a fast guess. With SCREENSHOT_DIR set, the Chromium run saves the start screen,
 * a "Nur Zahlenstrahl" battle and a "Nur Rechnen" battle at help step 2.
 */
import type { Locator, Page, TestInfo } from '@playwright/test';
import { expect, GAME_WAIT, test, waitCalmly } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const m = t();

/** Number line only, so every "Nur Rechnen" search is a number line search with the zoomed ten at help step 2. */
const numberLineOnly = { ...defaultSettings(), challengeTypes: { numberLine: true, addition: false, subtraction: false, comparison: false } };

async function store(page: Page, settings: unknown): Promise<void> {
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [SETTINGS_KEY, JSON.stringify(settings)] as const);
}

async function shot(page: Page, info: TestInfo, name: string): Promise<void> {
  // playwright.config.ts passes SCREENSHOT_DIR as metadata (the e2e specs have no Node types).
  const dir = info.config.metadata.screenshotDir as string | undefined;
  if (dir && info.project.name === 'chromium') await page.screenshot({ path: `${dir}/${name}.png` });
}

/** Types n and fires with Enter, after waiting calmly. */
async function fire(page: Page, overlay: Locator, n: number): Promise<void> {
  await waitCalmly(page, overlay);
  await page.keyboard.type(String(n));
  await expect(page.getByTestId('readout')).toHaveText(String(n));
  await page.keyboard.press('Enter');
}

async function enemyNumber(overlay: Locator): Promise<number> {
  await expect(overlay).toHaveAttribute('data-enemy-number', /^-?\d+$/);
  return Number(await overlay.getAttribute('data-enemy-number'));
}

/** A number halfway between the child's end of the range and the enemy: a plain miss. */
async function missNumber(overlay: Locator): Promise<number> {
  const enemy = await enemyNumber(overlay);
  const own = (await overlay.getAttribute('data-player-side')) === 'left' ? 0 : 100;
  return Math.round((own + enemy) / 2);
}

test('the start screen shows three picture buttons with their keys (FR-121)', async ({ page }, info) => {
  await page.goto('/?seed=1');
  const buttons = page.getByTestId('mode-button');
  await expect(buttons).toHaveCount(3);
  for (const [i, mode] of (['mixed', 'ruler', 'math'] as const).entries()) {
    await expect(buttons.nth(i)).toHaveAttribute('data-mode', mode);
    await expect(buttons.nth(i)).toHaveAttribute('aria-keyshortcuts', String(i + 1));
    await expect(buttons.nth(i)).toContainText(m.start.modes[mode]);
    await expect(buttons.nth(i).locator('svg')).toHaveCount(1);
  }
  await expect(page.getByRole('button', { name: m.start.play, exact: true })).toHaveCount(0);
  await shot(page, info, 'modes-start-screen');
});

test('key 1 starts "Gemischt": the banner and the ruler', async ({ page }) => {
  await page.goto('/?seed=2');
  await expect(page.getByTestId('mode-button')).toHaveCount(3);
  await page.keyboard.press('1');
  const overlay = page.getByTestId('battle-overlay');
  await expect(overlay).toHaveAttribute('data-mode', 'mixed');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(page.getByTestId('challenge-banner')).toBeVisible();
  await expect(page.locator('canvas')).not.toHaveAttribute('data-ruler-labels', '');
});

test('key 2 starts "Nur Zahlenstrahl": no banner, a pointer line, and 3 calm hits in a row raise the step in the same round (FR-122, FR-037)', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.goto('/?seed=3');
  await expect(page.getByTestId('mode-button')).toHaveCount(3);
  await page.keyboard.press('2');
  const overlay = page.getByTestId('battle-overlay');
  const canvas = page.locator('canvas');
  await expect(overlay).toHaveAttribute('data-mode', 'ruler');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(page.getByTestId('challenge-banner')).toHaveCount(0);
  const enemy = await enemyNumber(overlay);
  await expect(canvas).toHaveAttribute('data-pointer-lines', String(enemy));
  await expect(canvas).not.toHaveAttribute('data-ruler-labels', '');
  await expect(overlay).toHaveAttribute('data-skill-step', '0');
  const roundSeed = await overlay.getAttribute('data-round-seed');
  await shot(page, info, 'modes-ruler-battle');

  for (let destroyed = 1; destroyed <= 3; destroyed++) {
    await expect(overlay).toHaveAttribute('data-skill-step', '0');
    await fire(page, overlay, await enemyNumber(overlay));
    await expect(overlay).toHaveAttribute('data-enemies-destroyed', String(destroyed), { timeout: GAME_WAIT });
    await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: GAME_WAIT });
  }
  // The fourth search is one step harder, within the same round (amendment 17).
  await expect(overlay).toHaveAttribute('data-skill-step', '1');
  await expect(overlay).toHaveAttribute('data-round-seed', roundSeed!);
});

test('key 3 starts "Nur Rechnen": the banner, no ruler; a miss shows the landing number and steps; help step 2 shows the zoomed ten (FR-123)', async ({ page }, info) => {
  test.setTimeout(120_000);
  await store(page, numberLineOnly);
  await page.goto('/?seed=4');
  await expect(page.getByTestId('mode-button')).toHaveCount(3);
  await page.keyboard.press('3');
  const overlay = page.getByTestId('battle-overlay');
  const canvas = page.locator('canvas');
  await expect(overlay).toHaveAttribute('data-mode', 'math');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(page.getByTestId('challenge-banner')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-ruler-labels', '');
  await expect(canvas).toHaveAttribute('data-pointer-lines', '');

  // A miss: the landing number and the step count still show; the help gives the direction in words.
  const wrong = await missNumber(overlay);
  await fire(page, overlay, wrong);
  await expect(overlay).toHaveAttribute('data-last-landing', String(wrong), { timeout: GAME_WAIT });
  await expect(canvas).toHaveAttribute('data-landing', String(wrong));
  await expect(canvas).toHaveAttribute('data-steps-label', /\d/);
  await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-help-level', '1');
  await expect(canvas).toHaveAttribute('data-help-zoom', '');

  // H: help step 2 shows the ten around the answer as a zoomed piece of ruler.
  await page.keyboard.press('h');
  await expect(overlay).toHaveAttribute('data-help-level', '2');
  await expect(canvas).toHaveAttribute('data-help-zoom', /^-?\d+,-?\d+$/);
  await expect(canvas).toHaveAttribute('data-ruler-labels', '');
  await page.waitForTimeout(600);
  await shot(page, info, 'modes-math-battle-help-2');

  // H again: the solution; Enter fires at it and the zoomed ten is gone.
  await page.keyboard.press('h');
  await expect(overlay).toHaveAttribute('data-help-level', '3');
  await expect(canvas).toHaveAttribute('data-help-zoom', '');
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1', { timeout: GAME_WAIT });
});
