/**
 * Keyboard only (T183, FR-059 to FR-064, FR-076, SC-011, US8 scenarios 6 to 10): every step uses `page.keyboard`;
 * no click, tap or mouse call is made, and a listener fails the test when any pointer event reaches the page.
 * Enter starts the round on the start screen without a click; wrong numbers and H raise the help step; at the solution
 * step Enter fires at the shown solution and destroys the enemy; a number outside the range fires nothing and shows
 * the range hint; Escape pauses and resumes; a comparison is answered by typing the number (amendment 09); Enter on the
 * round-end screen starts a new round; holding Enter with the gear focused never opens the parent menu; the arrow keys
 * change nothing, and with typed answers no search is "Finde N" (amendment 05). G opens the garage from the start
 * screen (amendment 11). Game state comes from the overlay's data-* attributes (D4).
 */
import type { Locator, Page } from '@playwright/test';
import { expect, GAME_WAIT, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { COMPARISON_47_74 } from '../../src/core/math/fixtures';
import type { Settings } from '../../src/core/types';
import { t } from '../../src/i18n';

const m = t();

/** Comparison off, so the first test is about searches with one enemy; 3 enemies end the round. */
const positions: Settings = {
  ...defaultSettings(),
  challengeTypes: { ...defaultSettings().challengeTypes, comparison: false },
  noDamage: true,
  roundType: 'enemyCount',
  roundLength: 3,
};

/** Stores the settings and counts every pointer event that reaches the page (there must be none). */
async function prepare(page: Page, settings: Settings): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
      const w = window as unknown as { __pointerEvents: string[] };
      w.__pointerEvents = [];
      for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend']) {
        window.addEventListener(type, (e) => w.__pointerEvents.push(e.type), { capture: true });
      }
    },
    [SETTINGS_KEY, JSON.stringify(settings)] as const,
  );
}

async function expectNoPointerEvents(page: Page): Promise<void> {
  expect(await page.evaluate(() => (window as unknown as { __pointerEvents: string[] }).__pointerEvents)).toEqual([]);
}

async function startWithEnter(page: Page, seed: number): Promise<Locator> {
  await page.goto(`/?seed=${seed}`);
  await expect(page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  const overlay = page.getByTestId('battle-overlay');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  return overlay;
}

async function typeAndFire(page: Page, overlay: Locator, n: number): Promise<void> {
  await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true', { timeout: GAME_WAIT });
  await page.keyboard.type(String(n));
  await expect(page.getByTestId('readout')).toHaveText(String(n));
  await page.keyboard.press('Enter');
}

/** A number 30 away from the enemy: a plain miss. */
async function wrongNumber(overlay: Locator): Promise<number> {
  const enemy = Number(await overlay.getAttribute('data-enemy-number'));
  return enemy > 50 ? enemy - 30 : enemy + 30;
}

test('a whole round with the keyboard only: wrong answers, help, solution, range hint, pause, new round', async ({ page }) => {
  test.setTimeout(150_000);
  await prepare(page, positions);
  const overlay = await startWithEnter(page, 21);
  const banner = page.getByTestId('challenge-banner');
  const banners: string[] = [];

  // The arrow keys change nothing (amendment 05).
  const selection = await overlay.getAttribute('data-selection');
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) await page.keyboard.press(key);
  expect(await overlay.getAttribute('data-selection')).toBe(selection);
  await expect(page.getByTestId('readout')).toHaveText('?');

  // A wrong number, then H for the next help step, then two more wrong numbers.
  banners.push((await banner.textContent()) ?? '');
  await typeAndFire(page, overlay, await wrongNumber(overlay));
  await expect(overlay).toHaveAttribute('data-last-shot', 'miss', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-help-level', '1', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: GAME_WAIT });
  await page.keyboard.press('h');
  await expect(overlay).toHaveAttribute('data-help-level', '2');
  for (let i = 0; i < 2; i++) {
    const turn = Number(await overlay.getAttribute('data-turn'));
    await typeAndFire(page, overlay, await wrongNumber(overlay));
    await expect(overlay).toHaveAttribute('data-turn', String(turn + 1), { timeout: GAME_WAIT });
  }
  // At the solution step Enter fires at the shown solution and destroys the enemy.
  await expect(overlay).toHaveAttribute('data-help-level', '3', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: GAME_WAIT });
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-last-shot', 'hit');

  // 150 in the range 0 to 100: nothing fires and the range hint shows (FR-063).
  await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true', { timeout: GAME_WAIT });
  const turn = await overlay.getAttribute('data-turn');
  await page.keyboard.type('150');
  await page.keyboard.press('Enter');
  await expect(page.getByText(m.battle.rangeHint(0, 100))).toBeVisible();
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  expect(await overlay.getAttribute('data-turn')).toBe(turn);
  for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace');
  await expect(page.getByTestId('readout')).toHaveText('?');

  // Escape pauses and resumes (FR-062).
  await page.keyboard.press('Escape');
  await expect(overlay).toHaveAttribute('data-phase', 'paused');
  await expect(page.getByTestId('pause-screen')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(page.getByTestId('pause-screen')).toHaveCount(0);

  // Play to the round end by typing the enemy's number.
  for (let destroyed = 1; destroyed < 3; destroyed++) {
    await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: GAME_WAIT });
    banners.push((await banner.textContent()) ?? '');
    await typeAndFire(page, overlay, Number(await overlay.getAttribute('data-enemy-number')));
    await expect(overlay).toHaveAttribute('data-enemies-destroyed', String(destroyed + 1), { timeout: GAME_WAIT });
  }
  await expect(page.getByTestId('round-end')).toBeVisible({ timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-phase', 'roundOver');
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '0');
  banners.push((await banner.textContent()) ?? '');

  // With typed answers no search is "Finde N" (amendment 05, FR-076).
  for (const text of banners) expect(text).not.toMatch(/^Finde /);

  // Holding Enter with the gear focused by script never opens the parent menu (FR-045).
  await page.getByTestId('parent-gate').evaluate((el) => (el as HTMLElement).focus());
  await page.keyboard.down('Enter');
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(250);
    await page.keyboard.down('Enter');
  }
  await page.keyboard.up('Enter');
  await expect(page.getByRole('dialog', { name: m.parent.menu })).toHaveCount(0);
  await expect(page.getByTestId('settings-page')).toHaveCount(0);

  await expectNoPointerEvents(page);
});

test('a comparison is answered by typing the number: 47 oder 74, type 74 and Enter (amendment 09)', async ({ page }) => {
  test.setTimeout(60_000);
  await prepare(page, COMPARISON_47_74.settings);
  const overlay = await startWithEnter(page, COMPARISON_47_74.seed);
  await expect(page.getByTestId('challenge-banner')).toHaveText('Der Gegner steht bei der größeren Zahl: 47 oder 74');
  await typeAndFire(page, overlay, 74);
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-last-shot', 'hit');
  await expectNoPointerEvents(page);
});

test('G opens the garage on the start screen and Escape goes back (amendment 11)', async ({ page }) => {
  await prepare(page, defaultSettings());
  await page.goto('/');
  await expect(page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
  await page.keyboard.press('g');
  await expect(page.getByRole('heading', { name: m.garage.title })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
  await expectNoPointerEvents(page);
});
