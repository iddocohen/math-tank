/**
 * US1 and US8 end to end with the keyboard only (FR-001 to FR-008, FR-059 to FR-062, FR-066, SC-001, AC-01):
 * start a free-play round with Enter, type a wrong number and fire, watch the enemy turn, type the enemy's number
 * and fire, play to the round end and start a new round with Enter, all without a page reload.
 * There is no click, tap or mouse call. Game state is read from the overlay's data-* attributes (D4).
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

  // A wrong number: the shell lands there, the enemy keeps its health, then the enemy takes its turn (FR-066).
  const enemy = await enemyNumber(overlay);
  const wrong = enemy === max ? enemy - 1 : enemy + 1;
  await typeNumber(page, overlay, wrong);
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-last-landing', String(wrong), { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-enemy-health', '100');
  await expect(overlay).toHaveAttribute('data-phase', /^(enemyTurn|aiming|roundOver)$/);
  await expect(overlay).toHaveAttribute('data-phase', /^(aiming|roundOver)$/, { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-turn', '1');

  // The enemy's number: a hit, the enemy loses health.
  let shots = 1;
  if ((await overlay.getAttribute('data-phase')) === 'aiming') {
    const target = await enemyNumber(overlay);
    await typeNumber(page, overlay, target);
    await page.keyboard.press('Enter');
    shots++;
    await expect.poll(async () => Number(await overlay.getAttribute('data-enemy-health')), { timeout: 15_000 }).toBeLessThan(100);
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
