/**
 * Shared Playwright fixture: every page is silent, in every browser including WebKit.
 * - speechSynthesis.speak does nothing (getVoices still works).
 * - Every AudioContext is suspended at once, and resume() resolves without resuming it.
 * All e2e specs import `test` and `expect` from here instead of @playwright/test. A spec that opens its own
 * browser context adds `silenceAudio` to that context with `context.addInitScript(silenceAudio)`.
 */
import { test as base, expect } from '@playwright/test';

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

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(silenceAudio);
    await use(page);
  },
});

export { expect };
