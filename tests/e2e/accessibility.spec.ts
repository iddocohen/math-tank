/**
 * Accessibility pass on the child's screens (T153, FR-053, FR-057, FR-059).
 *
 * - Every icon-only button (gear, help, speaker, pause, fullscreen, new scene) has a German `aria-label` from
 *   src/i18n/de.ts; the fire button has its German text.
 * - The app root has focus after loading, so keys work at once, and a button reached with Tab shows a visible
 *   focus ring.
 * - The readout of typed digits is announced with `aria-live="polite"`; it shows no number while pointing
 *   (amendment 05).
 * - No visible text on the start screen, the battle screen, the round end or the garage is smaller than 18 CSS px.
 */
import type { Page } from '@playwright/test';
import { expect, GAME_WAIT, startButton, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const m = t();
const MIN_TEXT_PX = 18;

/** Every visible element with its own text that is smaller than 18 px, as "<tag>.<class> "text" <size>px". */
async function smallTexts(page: Page): Promise<string[]> {
  return page.evaluate((min) => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const ownText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (!ownText) continue;
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      if (style.visibility === 'hidden' || style.display === 'none' || box.width === 0 || box.height === 0) continue;
      const size = parseFloat(style.fontSize);
      if (size < min) out.push(`${el.tagName.toLowerCase()}.${el.className} "${ownText}" ${size}px`);
    }
    return out;
  }, MIN_TEXT_PX);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), noDamage: true, roundType: 'enemyCount', roundLength: 1 })] as const,
  );
  await page.goto('/?seed=8');
  await expect(startButton(page)).toBeVisible();
});

test('start screen and garage: labels, focus and text size', async ({ page, browserName }) => {
  // The app root has focus at once, so Enter and the number keys work without a click.
  await expect(page.getByTestId('app-root')).toBeFocused();
  await expect(page.getByRole('button', { name: m.start.gear, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: m.start.fullscreen, exact: true })).toBeVisible();
  expect(await smallTexts(page)).toEqual([]);

  // A button reached with Tab shows a visible focus ring. Safari moves to buttons with Alt+Tab (Option+Tab).
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    return el.tagName === 'BUTTON' ? getComputedStyle(el).outlineWidth : 'no button focused';
  });
  expect(parseFloat(outline)).toBeGreaterThanOrEqual(2);

  await page.getByRole('button', { name: m.start.garage, exact: true }).click();
  await expect(page.getByTestId('garage')).toBeVisible();
  expect(await smallTexts(page)).toEqual([]);
});

test('battle and round end: labels, live readout and text size', async ({ page }) => {
  await page.keyboard.press('Enter');
  const overlay = page.getByTestId('battle-overlay');
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true', { timeout: GAME_WAIT });

  for (const name of [m.battle.help, m.battle.newScene, m.battle.pause, m.start.gear]) {
    await expect(page.getByRole('button', { name, exact: true }), name).toBeVisible();
  }
  // The speaker button shows only where the browser can speak, which headless browsers often cannot.
  const speaker = page.getByTestId('speaker-button');
  if ((await speaker.count()) > 0) await expect(speaker).toHaveAttribute('aria-label', m.battle.speak);
  await expect(page.getByRole('button', { name: m.battle.fire })).toBeVisible();

  // The typed digits are announced politely; while nothing is typed the readout shows "?".
  const readout = page.getByTestId('readout');
  await expect(readout).toHaveAttribute('aria-live', 'polite');
  await expect(readout).toHaveText('?');
  await page.keyboard.type('4');
  await expect(readout).toHaveText('4');
  await page.keyboard.press('Backspace');
  expect(await smallTexts(page)).toEqual([]);

  await page.keyboard.type((await overlay.getAttribute('data-enemy-number'))!);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('round-end')).toBeVisible({ timeout: GAME_WAIT });
  expect(await smallTexts(page)).toEqual([]);
});
