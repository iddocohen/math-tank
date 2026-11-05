/**
 * Shared Playwright fixture: every page is silent, in every browser including WebKit.
 * - speechSynthesis.speak does nothing (getVoices still works).
 * - Every AudioContext is suspended at once, and resume() resolves without resuming it.
 * All e2e specs import `test` and `expect` from here instead of @playwright/test. A spec that opens its own
 * browser context adds `silenceAudio` to that context with `context.addInitScript(silenceAudio)`.
 */
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { GUESS_RESPONSE_MS } from '../../src/core/progress/classify';

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

/**
 * How long a spec waits for a game state that depends on game time: a shell in flight, the enemy's turn, a new enemy,
 * the end of a round (P6, T303). Phaser caps the time step of a slow frame, so game time runs slower than wall time
 * when several browsers render at once; 15 seconds was sometimes too short in Chromium under that load. The waits
 * still end on a game state (`data-phase`, `data-last-landing` and the like), never after a fixed time. Real
 * slowdowns are caught by tests/e2e/performance.spec.ts (start time and frame rate), not by these waits.
 */
export const GAME_WAIT = 30_000;

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
  await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true', { timeout: GAME_WAIT });
  await page.waitForTimeout(GUESS_RESPONSE_MS + 300);
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(silenceAudio);
    await use(page);
  },
});

export { expect };
