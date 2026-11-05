/**
 * Spoken challenges (T138, FR-055, US8 scenario 4). The test browser gets a German voice and a speak() that only
 * counts calls, so nothing is heard. "Vorlesen" is off by default (PO1). With "Vorlesen" on, the "Spielen" start (here Enter) speaks a short greeting and
 * then the challenge, and the speaker button repeats it. With "Vorlesen" off nothing is spoken and the button is
 * hidden.
 */
import type { Page } from '@playwright/test';
import { expect, seedStorage, startButton, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const m = t();

/** `speech` null stores no settings, so the defaults apply. */
async function prepare(page: Page, speech: boolean | null): Promise<void> {
  if (speech !== null) await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), sound: { effects: false, music: false, speech } } });
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown> & { __spoken: string[] };
    w.__spoken = [];
    const voice = { lang: 'de-DE', name: 'Test-Stimme', default: true, localService: true, voiceURI: 'test' };
    const synth = {
      getVoices: () => [voice],
      speak: (u: { text: string }) => w.__spoken.push(u.text),
      cancel: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    class Utterance {
      text: string;
      lang = '';
      voice: unknown = null;
      rate = 1;
      constructor(text: string) {
        this.text = text;
      }
    }
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utterance, configurable: true });
  });
}

function spoken(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
}

test('with "Vorlesen" on, starting speaks a greeting and the challenge, and the speaker button repeats it', async ({ page }) => {
  await prepare(page, true);
  await page.goto('/?seed=4');
  await expect(startButton(page)).toBeVisible();
  await page.keyboard.press('Enter');
  const banner = page.getByTestId('challenge-banner');
  await expect(banner).toBeVisible();
  const prompt = (await banner.textContent())!;
  await expect.poll(() => spoken(page)).toEqual([m.start.greeting, prompt]);
  await page.getByRole('button', { name: m.battle.speak }).click();
  await expect.poll(() => spoken(page)).toEqual([m.start.greeting, prompt, prompt]);
});

test('with "Vorlesen" off nothing is spoken and there is no speaker button', async ({ page }) => {
  await prepare(page, false);
  await page.goto('/?seed=4');
  await expect(startButton(page)).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('challenge-banner')).toBeVisible();
  await expect(page.getByRole('button', { name: m.battle.speak })).toHaveCount(0);
  expect(await spoken(page)).toEqual([]);
});

test('by default nothing is read aloud: no greeting, no challenge, no speaker button (PO1)', async ({ page }) => {
  await prepare(page, null);
  await page.goto('/?seed=4');
  await expect(startButton(page)).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('challenge-banner')).toBeVisible();
  await expect(page.getByRole('button', { name: m.battle.speak })).toHaveCount(0);
  expect(await spoken(page)).toEqual([]);
});
