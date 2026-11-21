/**
 * Amendment 17 end to end (T340, FR-121 to FR-124, FR-037), keyboard only; amendment 27 (T429, FR-158 to FR-161,
 * FR-166). The start screen offers four picture buttons; 1, 2, 3 and 4 start "Gemischt", "Nur Zahlenstrahl",
 * "Plus und Minus" and "Zahlen-Rätsel". The four buttons and the garage button lie inside the window without
 * scrolling, in one row of four or two rows of two. Game state comes from the data-* attributes (D4): `data-mode`,
 * `data-number-pad` and `data-skill-step` on the battle overlay, `data-ruler-labels`, `data-pointer-lines`,
 * `data-steps-label` and `data-help-zoom` on the canvas. Every shot waits like a calm child (waitCalmly), so a hit is
 * an independent answer and no miss is a fast guess. Runs in the desktop, device and Fire projects
 * (playwright.config.ts). With SCREENSHOT_DIR set, every project saves the start screen, and the Chromium run also
 * saves a "Nur Zahlenstrahl" battle and a "Zahlen-Rätsel" battle at help step 2.
 */
import type { Locator, Page, TestInfo } from '@playwright/test';
import { enemyNumber, expect, seedStorage, test, typeAndFire } from './fixtures';
import { boxOf, expectNoScroll, inside, type Box } from './layout';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const m = t();

/**
 * Number line only, so every "Zahlen-Rätsel" search is a number line search with the zoomed ten at help step 2.
 * "Plus und Minus" needs "Plus" or "Minus", so it is not offered (amendment 27, FR-162).
 */
const numberLineOnly = {
  ...defaultSettings(),
  challengeTypes: { numberLine: true, addition: false, subtraction: false, comparison: false },
  playModes: { mixed: true, ruler: true, arithmetic: false, numbers: true },
};

async function shot(page: Page, info: TestInfo, name: string): Promise<void> {
  // playwright.config.ts passes SCREENSHOT_DIR as metadata (the e2e specs have no Node types).
  const dir = info.config.metadata.screenshotDir as string | undefined;
  if (dir && info.project.name === 'chromium') await page.screenshot({ path: `${dir}/${name}.png` });
}


/** A number halfway between the child's end of the range and the enemy: a plain miss. */
async function missNumber(overlay: Locator): Promise<number> {
  const enemy = await enemyNumber(overlay);
  const own = (await overlay.getAttribute('data-player-side')) === 'left' ? 0 : 100;
  return Math.round((own + enemy) / 2);
}

test('the start screen shows four picture buttons with their keys (FR-121, FR-158)', async ({ page }, info) => {
  await page.goto('/?seed=1');
  const buttons = page.getByTestId('mode-button');
  await expect(buttons).toHaveCount(4);
  for (const [i, mode] of (['mixed', 'ruler', 'arithmetic', 'numbers'] as const).entries()) {
    await expect(buttons.nth(i)).toHaveAttribute('data-mode', mode);
    await expect(buttons.nth(i)).toHaveAttribute('aria-keyshortcuts', String(i + 1));
    await expect(buttons.nth(i)).toContainText(m.start.modes[mode]);
    await expect(buttons.nth(i).locator('svg')).toHaveCount(1);
  }
  await expect(page.getByRole('button', { name: m.start.play, exact: true })).toHaveCount(0);
  await shot(page, info, 'modes-start-screen');
});

test('the four mode buttons and the garage button fit the window, at least 48 pixels tall, in one row of four or two rows of two (FR-158, FR-159)', async ({ page }, info) => {
  await page.goto('/?seed=1');
  const buttons = await page.getByTestId('mode-button').all();
  expect(buttons).toHaveLength(4);
  const garage = page.locator('.garage-button');
  await expect(garage).toBeVisible();
  const viewport = page.viewportSize()!;
  const boxes: Box[] = [];
  for (const [i, button] of [...buttons, garage].entries()) {
    const b = await boxOf(button);
    expect(inside(b, viewport.width, viewport.height), `button ${i} inside ${viewport.width} by ${viewport.height}: ${JSON.stringify(b)}`).toBe(true);
    expect(b.height, `button ${i} height`).toBeGreaterThanOrEqual(48);
    if (i < 4) boxes.push(b);
  }
  await expectNoScroll(page);
  // Rows by the top edge of each mode button (1 pixel of rounding allowed).
  const rows: number[][] = [];
  for (const b of boxes) {
    const row = rows.find((r) => Math.abs(boxes[r[0]!]!.y - b.y) <= 1);
    if (row) row.push(boxes.indexOf(b));
    else rows.push([boxes.indexOf(b)]);
  }
  const shape = rows.map((r) => r.length).join('+');
  expect(['4', '2+2'], `rows of mode buttons at ${viewport.width} by ${viewport.height}`).toContain(shape);
  const dir = info.config.metadata.screenshotDir as string | undefined;
  if (dir) await page.screenshot({ path: `${dir}/modes-start-${info.project.name}.png` });
});

/** The banner "Der Gegner ist bei a + b" or "a − b" (also with three numbers): its value, or null for any other banner. */
function plusMinusValue(text: string): number | null {
  const match = /^Der Gegner ist bei (\d+(?: [+−] \d+)+)$/.exec(text);
  if (!match) return null;
  const parts = match[1]!.split(' ');
  let value = Number(parts[0]);
  for (let i = 1; i < parts.length; i += 2) value += (parts[i] === '+' ? 1 : -1) * Number(parts[i + 1]);
  return value;
}

test('key 3 starts "Plus und Minus": 5 banners with only plus and minus questions, no ruler labels, the number pad; help step 2 shows the zoomed ten (FR-160, FR-166)', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/?seed=1');
  await expect(page.getByTestId('mode-button')).toHaveCount(4);
  await page.keyboard.press('3');
  const overlay = page.getByTestId('battle-overlay');
  const canvas = page.locator('canvas');
  const banner = page.getByTestId('challenge-banner');
  await expect(overlay).toHaveAttribute('data-mode', 'arithmetic');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(overlay).toHaveAttribute('data-number-pad', 'true');
  await expect(page.getByTestId('number-pad')).toBeVisible();

  for (let i = 0; i < 5; i++) {
    await expect(banner).toBeVisible();
    const text = (await banner.textContent())!;
    const value = plusMinusValue(text);
    expect(value, `banner ${i + 1}: ${text}`).not.toBeNull();
    await expect(overlay).toHaveAttribute('data-enemy-number', String(value));
    await expect(canvas).toHaveAttribute('data-ruler-labels', '');
    await expect(canvas).toHaveAttribute('data-pointer-lines', '');
    await typeAndFire(page, overlay, value!);
    await expect(overlay).toHaveAttribute('data-enemies-destroyed', String(i + 1));
    await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  }

  // H: help step 2 shows the ten around the answer, still without ruler labels. Before a miss at this enemy, step 1
  // has nothing to show without a ruler (no landing number for the direction, no ruler tick), so it is skipped
  // (src/core/battle/help.ts nextHelp).
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true');
  await page.keyboard.press('h');
  await expect(overlay).toHaveAttribute('data-help-level', '2');
  await expect(canvas).toHaveAttribute('data-help-zoom', /^-?\d+,-?\d+$/);
  await expect(canvas).toHaveAttribute('data-ruler-labels', '');
});

test('key 4 starts "Zahlen-Rätsel": 5 banners without plus, minus, "Finde N" or "Wo steht der Gegner?", no ruler labels (FR-161)', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/?seed=1');
  await expect(page.getByTestId('mode-button')).toHaveCount(4);
  await page.keyboard.press('4');
  const overlay = page.getByTestId('battle-overlay');
  const canvas = page.locator('canvas');
  const banner = page.getByTestId('challenge-banner');
  await expect(overlay).toHaveAttribute('data-mode', 'numbers');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(overlay).toHaveAttribute('data-number-pad', 'true');

  for (let i = 0; i < 5; i++) {
    await expect(banner).toBeVisible();
    const text = (await banner.textContent())!;
    expect(plusMinusValue(text), `banner ${i + 1}: ${text}`).toBeNull();
    expect(text, `banner ${i + 1}`).not.toMatch(/ [+−] \d/);
    expect(text, `banner ${i + 1}`).not.toMatch(/^Finde /);
    expect(text, `banner ${i + 1}`).not.toBe(m.challenge.readPosition);
    expect(text, `banner ${i + 1}`).not.toBe(m.challenge.readPositionWave);
    await expect(canvas).toHaveAttribute('data-ruler-labels', '');
    await typeAndFire(page, overlay, await enemyNumber(overlay));
    await expect(overlay).toHaveAttribute('data-enemies-destroyed', String(i + 1));
    await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  }
});

test('key 1 starts "Gemischt": the banner and the ruler', async ({ page }) => {
  await page.goto('/?seed=2');
  await expect(page.getByTestId('mode-button')).toHaveCount(4);
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
  await expect(page.getByTestId('mode-button')).toHaveCount(4);
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
    await typeAndFire(page, overlay, await enemyNumber(overlay));
    await expect(overlay).toHaveAttribute('data-enemies-destroyed', String(destroyed));
    await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  }
  // The fourth search is one step harder, within the same round (amendment 17).
  await expect(overlay).toHaveAttribute('data-skill-step', '1');
  await expect(overlay).toHaveAttribute('data-round-seed', roundSeed!);
});

test('with only the number line, key 4 starts "Zahlen-Rätsel": the banner, no ruler; a miss shows the landing number and steps; help step 2 shows the zoomed ten (FR-123)', async ({ page }, info) => {
  test.setTimeout(120_000);
  await seedStorage(page, { [SETTINGS_KEY]: numberLineOnly });
  await page.goto('/?seed=4');
  await expect(page.getByTestId('mode-button')).toHaveCount(3);
  await page.keyboard.press('4');
  const overlay = page.getByTestId('battle-overlay');
  const canvas = page.locator('canvas');
  await expect(overlay).toHaveAttribute('data-mode', 'numbers');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(page.getByTestId('challenge-banner')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-ruler-labels', '');
  await expect(canvas).toHaveAttribute('data-pointer-lines', '');

  // A miss: the landing number and the step count still show; the help gives the direction in words.
  const wrong = await missNumber(overlay);
  await typeAndFire(page, overlay, wrong);
  await expect(overlay).toHaveAttribute('data-last-landing', String(wrong));
  await expect(canvas).toHaveAttribute('data-landing', String(wrong));
  await expect(canvas).toHaveAttribute('data-steps-label', /\d/);
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
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
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1');
});
