/**
 * Shared Playwright fixture: every page is silent, in every browser including WebKit.
 * - speechSynthesis.speak does nothing (getVoices still works).
 * - Every AudioContext is suspended at once, and resume() resolves without resuming it.
 * All e2e specs import `test` and `expect` from here instead of @playwright/test. A spec that opens its own
 * browser context adds `silenceAudio` to that context with `context.addInitScript(silenceAudio)`.
 */
import { test as base, expect, type Page } from '@playwright/test';

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

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(silenceAudio);
    await use(page);
  },
});

export { expect };
