/**
 * Shared Playwright fixture: every page is silent, in every browser including WebKit.
 * - speechSynthesis.speak does nothing (getVoices still works).
 * - Every AudioContext is suspended at once, and resume() resolves without resuming it.
 * All e2e specs import `test` and `expect` from here instead of @playwright/test. A spec that opens its own
 * browser context uses `silentPage`, or adds `silenceAudio` with `context.addInitScript(silenceAudio)`.
 * The file also holds the helpers that several specs share.
 */
import { test as base, expect, type Browser, type BrowserContext, type BrowserContextOptions, type Locator, type Page } from '@playwright/test';
import { HOLD_MS } from '../../src/app/useHold';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../../src/core/battle/round';
import { GUESS_RESPONSE_MS } from '../../src/core/progress/classify';
import { AXIS_Y } from '../../src/core/view/rulerText';
import { t } from '../../src/i18n';
import { GAME_WAIT } from './gameWait';

export function silenceAudio(): void {
  const w = window as unknown as Record<string, unknown>;
  // WebKit ignores a plain assignment on the instance, so the prototype is patched as well.
  const noSpeak = { value: () => {}, configurable: true, writable: true };
  if (typeof SpeechSynthesis !== 'undefined') Object.defineProperty(SpeechSynthesis.prototype, 'speak', noSpeak);
  if (window.speechSynthesis) Object.defineProperty(window.speechSynthesis, 'speak', noSpeak);
  for (const name of ['AudioContext', 'webkitAudioContext']) {
    const Original = w[name] as (new (...args: unknown[]) => AudioContext) | undefined;
    if (typeof Original !== 'function') continue;
    class SilentAudioContext extends Original {
      constructor(...args: unknown[]) {
        super(...args);
        void AudioContext.prototype.suspend.call(this).catch(() => {});
      }
      override resume(): Promise<void> {
        return Promise.resolve();
      }
    }
    w[name] = SilentAudioContext;
  }
}

export { GAME_WAIT };

/**
 * Records every `data-phase` the battle overlay takes from now on (review P9). A check that something did not happen
 * (no shot after a tap or a help request) then reads every phase of the waiting time, not only the last one, so a shot
 * that started and ended within the wait still fails the check.
 */
export async function recordPhases(page: Page): Promise<() => Promise<string[]>> {
  await page.getByTestId('battle-overlay').evaluate((el) => {
    const w = window as unknown as { __phases: string[] };
    w.__phases = [];
    new MutationObserver(() => w.__phases.push(el.getAttribute('data-phase') ?? '')).observe(el, { attributes: true, attributeFilter: ['data-phase'] });
  });
  return () => page.evaluate(() => (window as unknown as { __phases: string[] }).__phases);
}

/**
 * The first button that starts a round on the start screen (amendment 17, FR-121): the "Gemischt" picture button when
 * several play modes are offered, or the single "Spielen" button when only one is.
 */
export function startButton(page: Page): Locator {
  return page.locator('.play-buttons > button').first();
}

/**
 * Waits like a calm child before typing an answer (amendment 17: every play mode is a search). The search accepts
 * answers 1 second after it appears (`data-challenge-answerable`), and an answer less than GUESS_RESPONSE_MS after that
 * is a fast guess, whose miss adds 2 to the misses in a row (FR-038, FR-098); so the wait is GUESS_RESPONSE_MS + 300 ms.
 */
export async function waitCalmly(page: Page, overlay: Locator): Promise<void> {
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true');
  await page.waitForTimeout(GUESS_RESPONSE_MS + 300);
}

/**
 * Types n and fires with Enter. By default it first waits like a calm child (waitCalmly). With `calm: false` it fires
 * as soon as the search accepts answers, for a spec that does not depend on how fast the answer comes.
 */
export async function typeAndFire(page: Page, overlay: Locator, n: number, { calm = true }: { calm?: boolean } = {}): Promise<void> {
  if (calm) {
    await waitCalmly(page, overlay);
  } else {
    await expect(overlay).toHaveAttribute('data-phase', 'challenge');
    await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true');
  }
  await page.keyboard.type(String(n));
  await expect(page.getByTestId('readout')).toHaveText(String(n));
  await page.keyboard.press('Enter');
}

/** The enemy's number from the battle overlay (`data-enemy-number`), once the overlay shows one. */
export async function enemyNumber(overlay: Locator): Promise<number> {
  await expect(overlay).toHaveAttribute('data-enemy-number', /^-?\d+$/);
  return Number(await overlay.getAttribute('data-enemy-number'));
}

function toPairs(entries: Record<string, unknown>): Array<[string, string]> {
  return Object.entries(entries).map(([k, v]): [string, string] => [k, JSON.stringify(v)]);
}

/**
 * Stores each entry as JSON in localStorage before the page's scripts run. By default this happens on every load.
 * With `once`, it happens only on the first load in the tab, so a reload keeps what the game stored.
 */
export async function seedStorage(page: Page, entries: Record<string, unknown>, { once = false }: { once?: boolean } = {}): Promise<void> {
  await page.addInitScript(
    ([pairs, onlyOnce]) => {
      if (onlyOnce) {
        if (window.sessionStorage.getItem('e2e-seeded')) return;
        window.sessionStorage.setItem('e2e-seeded', '1');
      }
      for (const [k, v] of pairs) window.localStorage.setItem(k, v);
    },
    [toPairs(entries), once] as const,
  );
}

/** Writes each entry as JSON to the localStorage of the page that is open now; the game reads it at the next load. */
export async function writeStorage(page: Page, entries: Record<string, unknown>): Promise<void> {
  await page.evaluate((pairs) => {
    for (const [k, v] of pairs) window.localStorage.setItem(k, v);
  }, toPairs(entries));
}

/** A press 300 ms longer than the app's hold time (HOLD_MS), so a busy page still counts it as held (FR-045). */
export const LONG_PRESS_MS = HOLD_MS + 300;

/** Presses `target` with the mouse for `ms` milliseconds. */
export async function holdPress(page: Page, target: Locator, ms = LONG_PRESS_MS): Promise<void> {
  await target.hover();
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/** Holds a touch pointer on `target` for `ms` milliseconds (FR-045, FR-105). */
export async function touchHold(target: Locator, ms = LONG_PRESS_MS): Promise<void> {
  const pointer = { pointerType: 'touch', button: 0, isPrimary: true, pointerId: 1 };
  await target.dispatchEvent('pointerdown', pointer);
  await target.page().waitForTimeout(ms);
  await target.dispatchEvent('pointerup', pointer);
}

/** Presses the gear with the mouse for `ms` milliseconds (FR-045). */
export async function pressGear(page: Page, ms = LONG_PRESS_MS): Promise<void> {
  await holdPress(page, page.getByTestId('parent-gate'), ms);
}

/** Parent gate: a long press on the gear, then "Einstellungen" in the parent menu. */
export async function openSettings(page: Page): Promise<void> {
  await pressGear(page);
  await page.getByRole('button', { name: t().parent.settings, exact: true }).click();
  await expect(page.getByTestId('settings-page')).toBeVisible();
}

/** A page in a new context with `options`, silenced like the shared fixture's `page`. */
export async function silentPage(browser: Browser, options: BrowserContextOptions = {}): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext(options);
  await context.addInitScript(silenceAudio);
  return { context, page: await context.newPage() };
}

/** The ruler's axis in world units (src/core/view/rulerText.ts). */
export const RULER_Y = AXIS_Y;

/** Page coordinates of a world point. The canvas shows the whole WORLD_WIDTH by WORLD_HEIGHT world, scaled to fit. */
export async function worldToScreen(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const box = (await page.locator('canvas').boundingBox())!;
  return { x: box.x + (x * box.width) / WORLD_WIDTH, y: box.y + (y * box.height) / WORLD_HEIGHT };
}

/** Clicks a world point with the mouse, or taps it with `touch`. */
export async function tapWorld(page: Page, x: number, y: number, { touch = false }: { touch?: boolean } = {}): Promise<void> {
  const pt = await worldToScreen(page, x, y);
  if (touch) await page.touchscreen.tap(pt.x, pt.y);
  else await page.mouse.click(pt.x, pt.y);
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(silenceAudio);
    await use(page);
  },
});

export { expect };
