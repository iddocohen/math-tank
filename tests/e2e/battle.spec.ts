/**
 * US1 and US8 end to end with the keyboard only (FR-001 to FR-008, FR-059 to FR-062, FR-066, SC-001, AC-01):
 * start a free-play round with Enter, type a wrong number and fire, watch the enemy turn, type the enemy's number
 * and fire, play to the round end and start a new round with Enter, all without a page reload.
 * The first test has no click, tap or mouse call. Game state is read from the overlay's data-* attributes (D4).
 * Amendment 05: the arrow keys do nothing, pointing on the ruler shows no number, there are no −1 and +1 buttons,
 * and a "Du" arrow points at the child's tank for 3 seconds at every round start.
 */
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { forbiddenWords, t } from '../../src/i18n';

const m = t();
const settings = { ...defaultSettings(), freePlay: true };
const { min, max } = settings.range;

async function healths(overlay: Locator): Promise<[string | null, string | null]> {
  return [await overlay.getAttribute('data-player-health'), await overlay.getAttribute('data-enemy-health')];
}

async function enemyNumber(overlay: Locator): Promise<number> {
  await expect(overlay).toHaveAttribute('data-enemy-number', /^-?\d+$/);
  return Number(await overlay.getAttribute('data-enemy-number'));
}

/** Types n digit by digit; after each digit the preview shows the number typed so far (FR-060). */
async function typeNumber(page: Page, overlay: Locator, n: number): Promise<void> {
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
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [SETTINGS_KEY, JSON.stringify(settings)] as const,
  );
  await page.goto('/?seed=1');

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
  await expect(page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('canvas')).toHaveCount(1, { timeout: 3_000 });
  await expect(page.locator('canvas')).toBeVisible({ timeout: 3_000 });

  const overlay = page.locator('[data-phase]');
  await expect(overlay).toHaveAttribute('data-phase', 'aiming');
  await expect(overlay).toHaveAttribute('data-turn', '0');
  const startHealth = await healths(overlay);
  expect(startHealth).toEqual(['100', '100']);

  // A number off the tank body (5 away; the body covers about 2 numbers either side in 0 to 100): the shell lands
  // there, the enemy keeps its health, then the enemy takes its turn (FR-066, amendment 04).
  const enemy = await enemyNumber(overlay);
  const wrong = enemy - 5 >= min ? enemy - 5 : enemy + 5;
  await typeNumber(page, overlay, wrong);
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-last-landing', String(wrong), { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-last-shot', 'miss');
  await expect(overlay).toHaveAttribute('data-enemy-health', '100');
  await expect(overlay).toHaveAttribute('data-phase', /^(enemyTurn|aiming|roundOver)$/);
  await expect(overlay).toHaveAttribute('data-phase', /^(aiming|roundOver)$/, { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-turn', '1');

  // The enemy's number: a Volltreffer, the enemy loses health (FR-071).
  let shots = 1;
  if ((await overlay.getAttribute('data-phase')) === 'aiming') {
    const target = await enemyNumber(overlay);
    await typeNumber(page, overlay, target);
    await page.keyboard.press('Enter');
    shots++;
    await expect.poll(async () => Number(await overlay.getAttribute('data-enemy-health')), { timeout: 15_000 }).toBeLessThan(100);
    await expect(overlay).toHaveAttribute('data-last-shot', 'bullseye');
  }

  // Keep firing at the enemy's number until the round ends.
  while ((await overlay.getAttribute('data-phase')) !== 'roundOver') {
    await expect(overlay).toHaveAttribute('data-phase', /^(aiming|roundOver)$/, { timeout: 20_000 });
    if ((await overlay.getAttribute('data-phase')) === 'roundOver') break;
    await typeNumber(page, overlay, await enemyNumber(overlay));
    await page.keyboard.press('Enter');
    shots++;
    await expect(overlay).not.toHaveAttribute('data-phase', 'aiming', { timeout: 5_000 });
    expect(shots).toBeLessThan(40);
  }

  expect(await healths(overlay)).not.toEqual(startHealth);

  // The round end shows only encouraging text (FR-008, FR-033).
  const roundEnd = page.getByTestId('round-end');
  await expect(roundEnd).toBeVisible();
  const text = (await roundEnd.innerText()).toLocaleLowerCase('de');
  const messages = [m.roundEnd.playerWon, m.roundEnd.enemyWon, m.roundEnd.turnsUsed];
  expect(messages.some((msg) => text.includes(msg.toLocaleLowerCase('de')))).toBe(true);
  for (const word of forbiddenWords) expect(text).not.toContain(word.toLocaleLowerCase('de'));

  // Enter on the round end starts a new round without a page reload (FR-062).
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-phase', 'aiming');
  await expect(overlay).toHaveAttribute('data-turn', '0');
  await expect(overlay).toHaveAttribute('data-player-health', '100');
  await expect(overlay).toHaveAttribute('data-enemy-health', '100');
  await expect(roundEnd).toBeHidden();
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(reloads).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { e2eMarker?: boolean }).e2eMarker)).toBe(true);
});

test('the new scene button starts a fresh round in the same mode, and no key presses it (amendment 03, FR-070)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [SETTINGS_KEY, JSON.stringify(settings)] as const,
  );
  await page.goto('/?seed=2');
  await expect(page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  const overlay = page.locator('[data-phase]');
  await expect(overlay).toHaveAttribute('data-phase', 'aiming');

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
  await expect(overlay).not.toHaveAttribute('data-phase', 'aiming');
  await expect(button).toBeDisabled();
  await expect(overlay).toHaveAttribute('data-phase', 'aiming', { timeout: 20_000 });
  await expect(overlay).toHaveAttribute('data-turn', '1');
  await expect(button).toBeEnabled();

  // Tab and Enter or Space never reach the button.
  const seed = await overlay.getAttribute('data-round-seed');
  const side = await overlay.getAttribute('data-player-side');
  await page.keyboard.press('Tab');
  await page.keyboard.press(' ');
  await expect(overlay).toHaveAttribute('data-round-seed', seed!);

  await button.click();
  await expect(overlay).not.toHaveAttribute('data-round-seed', seed!);
  await expect(overlay).toHaveAttribute('data-phase', 'aiming');
  await expect(overlay).toHaveAttribute('data-turn', '0');
  await expect(overlay).toHaveAttribute('data-player-health', '100');
  await expect(overlay).toHaveAttribute('data-enemy-health', '100');
  await expect(overlay).not.toHaveAttribute('data-player-side', side!);
  await expect(overlay).not.toHaveAttribute('data-last-landing', /.+/);

  // After the click the keyboard still plays: Enter fires at a typed number.
  await typeNumber(page, overlay, await enemyNumber(overlay));
  await page.keyboard.press('Enter');
  await expect(overlay).not.toHaveAttribute('data-phase', 'aiming');
});

test('no shortcuts to the answer and a "Du" arrow at every round start (amendment 05)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [SETTINGS_KEY, JSON.stringify(settings)] as const,
  );
  await page.goto('/?seed=3');
  await expect(page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  const overlay = page.locator('[data-phase]');
  await expect(overlay).toHaveAttribute('data-phase', 'aiming');
  const canvas = page.locator('canvas');

  // The "Du" arrow shows at the round start and disappears after 3 seconds of game time (FR-077). Game time can
  // run slower than the wall clock on a loaded test machine, so the wait for 'off' is generous.
  await expect(canvas).toHaveAttribute('data-you-marker', 'on');
  const shownAt = Date.now();
  await expect(canvas).toHaveAttribute('data-you-marker', 'off', { timeout: 20_000 });
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
  const box = (await canvas.boundingBox())!;
  const toScreen = (worldX: number, worldY: number) => ({ x: box.x + (worldX * box.width) / 1600, y: box.y + (worldY * box.height) / 900 });
  const rulerY = 742;
  const start = toScreen(400, rulerY);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const seen = new Set<string>();
  for (const worldX of [500, 700, 900, 1100]) {
    const pt = toScreen(worldX, rulerY);
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
  await expect(overlay).toHaveAttribute('data-last-landing', chosen!, { timeout: 15_000 });

  // A new scene shows the "Du" arrow again (FR-070, FR-077).
  await expect(overlay).toHaveAttribute('data-phase', 'aiming', { timeout: 20_000 });
  await page.getByRole('button', { name: m.battle.newScene, exact: true }).click();
  await expect(overlay).toHaveAttribute('data-turn', '0');
  await expect(canvas).toHaveAttribute('data-you-marker', 'on');
});
