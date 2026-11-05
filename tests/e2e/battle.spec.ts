/**
 * US1 and US8 end to end with the keyboard only (FR-001 to FR-008, FR-059 to FR-062, FR-066, SC-001, AC-01):
 * start a free-play round with Enter, fire two wrong numbers and watch the enemy fire after each, type the
 * enemy's number and fire, play to the round end and start a new round with Enter, all without a page reload.
 * Amendment 06: only the exact number destroys the enemy, the round ends after
 * the parent's number of enemies ("Gegner pro Runde" 2 here), and the end screen shows the score, the time and the
 * personal best ("Neuer Rekord!" the first time, "Dein Rekord: 2" the second).
 * Amendment 07: the enemy fires after every shot that does not destroy it, and every miss shows the step count.
 * The first test has no click, tap or mouse call. Game state is read from the overlay's data-* attributes (D4).
 * Amendment 05: the arrow keys do nothing, pointing on the ruler shows no number, there are no −1 and +1 buttons,
 * and a "Du" arrow points at the child's tank for 3 seconds at every round start.
 */
import type { Locator, Page } from '@playwright/test';
import { enemyNumber, expect, RULER_Y, seedStorage, startButton, test, waitCalmly, worldToScreen } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { withRange } from '../../src/core/settings/validate';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { forbiddenWords, t } from '../../src/i18n';
import { COMPARISON_47_74 } from '../../src/core/math/fixtures';

const m = t();
const settings = { ...defaultSettings() };
const { min, max } = settings.range;
/** Two enemies per round, so a keyboard round ends after two exact hits (FR-082). */
const twoEnemies = { ...settings, roundType: 'enemyCount' as const, roundLength: 2 };


/** Types n digit by digit; after each digit the preview shows the number typed so far (FR-060). */
async function typeNumber(page: Page, overlay: Locator, n: number): Promise<void> {
  await waitCalmly(page, overlay);
  const text = String(n);
  for (let i = 0; i < text.length; i++) {
    await page.keyboard.press(text[i] as string);
    const typed = text.slice(0, i + 1);
    if (typed === '-') continue;
    await expect(overlay).toHaveAttribute('data-selection', String(Math.min(max, Math.max(min, Number(typed)))));
  }
  await expect(page.getByTestId('readout')).toHaveText(text);
}

test('play a free-play round with the keyboard only and start another', async ({ page }) => {
  test.setTimeout(180_000);
  await seedStorage(page, { [SETTINGS_KEY]: twoEnemies });
  await page.goto('/?seed=1&mode=ruler');

  // Count page loads from here on. Firefox also fires 'load' for the initial about:blank page,
  // so counting starts after the app has loaded; a marker in the page must survive too.
  let reloads = 0;
  page.on('load', () => {
    reloads++;
  });
  await page.evaluate(() => {
    (window as unknown as { e2eMarker: boolean }).e2eMarker = true;
  });

  // Enter on the start screen starts the battle; the canvas appears within 3 seconds (SC-001, FR-062).
  await expect(startButton(page)).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('canvas')).toHaveCount(1, { timeout: 3_000 });
  await expect(page.locator('canvas')).toBeVisible({ timeout: 3_000 });

  const overlay = page.locator('[data-phase]');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(overlay).toHaveAttribute('data-turn', '0');
  await expect(overlay).toHaveAttribute('data-lives', '3');
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '0');
  await expect(page.getByTestId('score')).toHaveText('0');

  // A number off the tank body (5 away; the body covers about 2 numbers either side in 0 to 100): the shell lands
  // there and the enemy stays; the ruler shows "5 Schritte". The enemy fires back at once; its first shot of a
  // round always misses (amendment 07, FR-043, FR-066, FR-072, FR-081).
  const enemy = await enemyNumber(overlay);
  const wrong = enemy - 5 >= min ? enemy - 5 : enemy + 5;
  await typeNumber(page, overlay, wrong);
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-last-landing', String(wrong));
  await expect(overlay).toHaveAttribute('data-last-shot', 'miss');
  await expect(overlay).toHaveAttribute('data-last-distance', '5');
  await expect(page.locator('canvas')).toHaveAttribute('data-steps-label', m.battle.steps(5));
  await expect(overlay).toHaveAttribute('data-phase', 'enemyTurn');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(overlay).toHaveAttribute('data-lives', '3');
  await expect(overlay).toHaveAttribute('data-enemy-number', String(enemy));

  // The second shot that does not destroy the enemy: the enemy fires again.
  await typeNumber(page, overlay, wrong);
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-phase', 'enemyTurn');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(overlay).toHaveAttribute('data-turn', '2');

  // The enemy's number destroys it; a new enemy appears and the tank counter shows 1 (FR-066, FR-083).
  await typeNumber(page, overlay, enemy);
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1');
  await expect(overlay).toHaveAttribute('data-last-shot', 'hit');
  await expect(page.getByTestId('score')).toHaveText('1');
  await expect(page.getByTestId('hit-feedback')).toHaveText(`${m.battle.hit} ${m.battle.enemyStoodAt(enemy)}`);
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  const second = await enemyNumber(overlay);
  expect(second).not.toBe(enemy);

  // The second destroyed enemy ends the round (FR-082).
  await typeNumber(page, overlay, second);
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-phase', 'roundOver');
  await expect(overlay).toHaveAttribute('data-outcome', 'goalReached');

  // The round end: encouraging text, the score and the time, and the first record (FR-008, FR-033, FR-085, FR-086).
  const roundEnd = page.getByTestId('round-end');
  await expect(roundEnd).toBeVisible();
  await expect(roundEnd).toContainText(m.roundEnd.goalReached);
  await expect(page.getByTestId('round-result')).toHaveText(/^2 Panzer getroffen in \d+:\d\d$/);
  await expect(page.getByTestId('new-record')).toHaveText(m.roundEnd.newRecord);
  const text = (await roundEnd.innerText()).toLocaleLowerCase('de');
  for (const word of forbiddenWords) expect(text).not.toContain(word.toLocaleLowerCase('de'));
  expect(text).not.toContain('nicht geschafft');

  // Enter on the round end starts a new round without a page reload (FR-062).
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(overlay).toHaveAttribute('data-turn', '0');
  await expect(overlay).toHaveAttribute('data-lives', '3');
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '0');
  await expect(roundEnd).toBeHidden();
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(reloads).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { e2eMarker?: boolean }).e2eMarker)).toBe(true);

  // The same result again is not a new record: the record is shown small and neutral (FR-086).
  for (let i = 0; i < 2; i++) {
    await expect(overlay).toHaveAttribute('data-phase', 'challenge');
    await typeNumber(page, overlay, await enemyNumber(overlay));
    await page.keyboard.press('Enter');
    await expect(overlay).toHaveAttribute('data-enemies-destroyed', String(i + 1));
  }
  await expect(roundEnd).toBeVisible();
  await expect(page.getByTestId('record')).toHaveText(m.roundEnd.yourRecord(2));
  await expect(page.getByTestId('new-record')).toHaveCount(0);
});

test('the new scene button makes a new landscape in the same round, and no key presses it (amendment 03, amendment 08, FR-070)', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: settings });
  await page.goto('/?seed=2&mode=ruler');
  await expect(startButton(page)).toBeVisible();
  await page.keyboard.press('Enter');
  const overlay = page.locator('[data-phase]');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');

  const button = page.getByRole('button', { name: m.battle.newScene, exact: true });
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(48);
  expect(box!.height).toBeGreaterThanOrEqual(48);
  expect(await button.getAttribute('tabindex')).toBe('-1');

  // Play one shot so the round has a turn and a landing to clear.
  const enemy = await enemyNumber(overlay);
  const wrong = enemy === max ? enemy - 1 : enemy + 1;
  await typeNumber(page, overlay, wrong);
  await page.keyboard.press('Enter');
  await expect(overlay).not.toHaveAttribute('data-phase', 'challenge');
  await expect(button).toBeDisabled();
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(overlay).toHaveAttribute('data-turn', '1');
  await expect(button).toBeEnabled();

  // Tab and Enter or Space never reach the button.
  const seed = await overlay.getAttribute('data-round-seed');
  const side = await overlay.getAttribute('data-player-side');
  await page.keyboard.press('Tab');
  await page.keyboard.press(' ');
  await expect(overlay).toHaveAttribute('data-round-seed', seed!);
  // Space is the fire key, so it may have fired the selection again; wait until the child aims again.
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  const lives = (await overlay.getAttribute('data-lives'))!;
  const destroyed = (await overlay.getAttribute('data-enemies-destroyed'))!;
  const turn = (await overlay.getAttribute('data-turn'))!;

  // A new landscape in the same round (amendment 08): hearts, score and turn stay; the side switches.
  await button.click();
  await expect(overlay).not.toHaveAttribute('data-round-seed', seed!);
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(overlay).toHaveAttribute('data-turn', turn);
  await expect(overlay).toHaveAttribute('data-lives', lives);
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', destroyed);
  await expect(overlay).not.toHaveAttribute('data-player-side', side!);
  await expect(overlay).not.toHaveAttribute('data-last-landing', /.+/);

  // After the click the keyboard still plays: Enter fires at a typed number.
  await typeNumber(page, overlay, await enemyNumber(overlay));
  await page.keyboard.press('Enter');
  await expect(overlay).not.toHaveAttribute('data-phase', 'challenge');
});

test('no shortcuts to the answer and a "Du" arrow at every round start (amendment 05)', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: settings });
  await page.goto('/?seed=3&mode=ruler');
  await expect(startButton(page)).toBeVisible();
  await page.keyboard.press('Enter');
  const overlay = page.locator('[data-phase]');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  const canvas = page.locator('canvas');

  // The "Du" arrow shows at the round start and disappears after 3 seconds of game time (FR-077). Game time can
  // run slower than the wall clock on a loaded test machine, so the wait for 'off' is generous.
  await expect(canvas).toHaveAttribute('data-you-marker', 'on');
  const shownAt = Date.now();
  await expect(canvas).toHaveAttribute('data-you-marker', 'off');
  expect(Date.now() - shownAt).toBeGreaterThanOrEqual(2_000);

  // No −1 or +1 buttons and no corner health labels (FR-019, FR-078).
  for (const name of ['+1', '−1', 'Eins mehr', 'Eins weniger']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  }
  await expect(page.locator('.top-bars, .health-label')).toHaveCount(0);

  // Arrow keys do nothing (FR-061).
  await typeNumber(page, overlay, 42);
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
    await page.keyboard.press(key);
    await expect(overlay).toHaveAttribute('data-selection', '42');
  }
  await expect(page.getByTestId('readout')).toHaveText('42');

  // Dragging on the ruler moves the selection but shows no number (FR-019).
  const start = await worldToScreen(page, 400, RULER_Y);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const seen = new Set<string>();
  for (const worldX of [500, 700, 900, 1100]) {
    const pt = await worldToScreen(page, worldX, RULER_Y);
    await page.mouse.move(pt.x, pt.y, { steps: 4 });
    const selection = await overlay.getAttribute('data-selection');
    expect(selection).toMatch(/^\d+$/);
    seen.add(selection!);
    await expect(page.getByTestId('readout')).toHaveText('?');
    await expect(canvas).toHaveAttribute('data-preview-text', '');
    await expect(overlay).not.toContainText(selection!);
  }
  expect(seen.size).toBeGreaterThan(1);
  await page.mouse.up();
  await expect(page.getByTestId('readout')).toHaveText('?');
  await expect(canvas).toHaveAttribute('data-preview-text', '');

  // After firing, the landing number is shown.
  const chosen = await overlay.getAttribute('data-selection');
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-last-landing', chosen!);

  // A new scene shows the "Du" arrow again (FR-070, FR-077).
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  const sceneSeed = await overlay.getAttribute('data-round-seed');
  await page.getByRole('button', { name: m.battle.newScene, exact: true }).click();
  await expect(overlay).not.toHaveAttribute('data-round-seed', sceneSeed!);
  await expect(canvas).toHaveAttribute('data-you-marker', 'on');
});

test('on a crowded level 1 ruler only the typed number is labeled, once, under the marker (T203, T217, FR-017)', async ({ page }) => {
  // 0 to 1000 at level 1: the minor labels do not fit even in two rows (T217); 0 to 100 now labels every number.
  const wide = withRange(settings, { preset: '0-1000', min: 0, max: 1000 });
  expect(wide.rulerLevelStart).toBe(1);
  await seedStorage(page, { [SETTINGS_KEY]: wide });
  await page.goto('/?seed=4&mode=ruler');
  await expect(startButton(page)).toBeVisible();
  await page.keyboard.press('Enter');
  const overlay = page.locator('[data-phase]');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  const canvas = page.locator('canvas');

  // Typing 43: the label is "43" alone. Typing 430: only "430", not "420,430,440".
  await page.keyboard.press('4');
  await page.keyboard.press('3');
  await expect(overlay).toHaveAttribute('data-selection', '43');
  await expect(canvas).toHaveAttribute('data-preview-text', '43');
  await page.keyboard.press('0');
  await expect(overlay).toHaveAttribute('data-selection', '430');
  await expect(canvas).toHaveAttribute('data-preview-text', '430');
  await page.screenshot({ path: test.info().outputPath('typed-430.png') });

  // 400 is a labeled major line, so it gets no second label.
  for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace');
  for (const key of ['4', '0', '0']) await page.keyboard.press(key);
  await expect(overlay).toHaveAttribute('data-selection', '400');
  await expect(canvas).toHaveAttribute('data-preview-text', '');
  await expect(canvas).toHaveAttribute('data-ruler-labels', /(^|,)400(,|$)/);
});

test('after "Neue Landschaft" the search is never a comparison, so one tank stands opposite the child (amendment 08 item 1, amendment 10 item 10, FR-070)', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: COMPARISON_47_74.settings });
  await page.goto(`/?seed=${COMPARISON_47_74.seed}`);
  await expect(startButton(page)).toBeVisible();
  await page.keyboard.press('Enter');
  const overlay = page.getByTestId('battle-overlay');
  const canvas = page.locator('canvas');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  // Only comparison is on, so the first search is a comparison with a decoy.
  await expect(page.getByTestId('banner-option')).toHaveCount(2);
  await expect(canvas).toHaveAttribute('data-enemy-tanks', '2');

  const seed = await overlay.getAttribute('data-round-seed');
  await page.getByRole('button', { name: m.battle.newScene, exact: true }).click();
  await expect(overlay).not.toHaveAttribute('data-round-seed', seed!);
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(page.getByTestId('banner-option')).toHaveCount(0);
  await expect(canvas).toHaveAttribute('data-enemy-tanks', '1');
  await expect(canvas).toHaveAttribute('data-pointer-lines', /^-?\d+$/);
});
