/**
 * US6 persistence end to end (FR-048, SC-007, AC-08, US6 scenario 2, T109).
 *
 * Each case saves the browser context's `storageState` (localStorage included), closes the page and its context,
 * opens a new context with that state and checks that the settings are still there, as after a browser restart.
 *
 * The first case writes stored settings directly and checks that a new context plays with them; it covers
 * src/app/persistence.ts today. The second case changes the settings through the settings page; that page is
 * built in Phase 13 (T110 to T116), so the case is marked `fixme` until T116 makes it pass in all three browsers.
 */
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { expect, silenceAudio, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import type { Settings } from '../../src/core/settings/schema';
import { validateSettings, withRange } from '../../src/core/settings/validate';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const m = t();
const RUNS = 5;

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

/** A page in a new context, silenced like the shared fixture's `page` (tests/e2e/fixtures.ts). */
async function silentPage(browser: Browser, storageState?: StorageState): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext(storageState ? { storageState } : {});
  await context.addInitScript(silenceAudio);
  return { context, page: await context.newPage() };
}

async function storedSettings(page: Page): Promise<Settings | null> {
  const text = await page.evaluate((key) => window.localStorage.getItem(key), SETTINGS_KEY);
  return text === null ? null : (JSON.parse(text) as Settings);
}

test.describe('settings survive a browser restart (FR-048, SC-007)', () => {
  // A custom range far from the default 0 to 100, so an enemy number inside it can only come from the stored settings.
  const custom: Settings = { ...withRange(defaultSettings(), { preset: 'custom', min: 550, max: 780 }), enemyDifficulty: 'normal', rulerLevelStart: 3 };

  test(`stored settings are loaded in a new context, ${RUNS} runs in a row`, async ({ browser }) => {
    expect(validateSettings(custom)).toEqual({ ok: true });
    for (let run = 1; run <= RUNS; run++) {
      const first = await silentPage(browser);
      await first.page.goto('/?seed=7');
      await first.page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [SETTINGS_KEY, JSON.stringify(custom)] as const);
      const state = await first.context.storageState();
      await first.page.close();
      await first.context.close();

      const second = await silentPage(browser, state);
      await second.page.goto(`/?seed=${run}`);
      await expect(second.page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
      expect(await storedSettings(second.page), `run ${run}`).toEqual(custom);
      await second.page.keyboard.press('Enter');
      const overlay = second.page.locator('[data-phase]');
      await expect(overlay).toHaveAttribute('data-phase', 'aiming');
      const enemy = Number(await overlay.getAttribute('data-enemy-number'));
      expect(enemy, `run ${run}: enemy number from the stored range`).toBeGreaterThanOrEqual(550);
      expect(enemy, `run ${run}: enemy number from the stored range`).toBeLessThanOrEqual(780);
      await second.context.close();
    }
  });

  test(`settings changed on the settings page are shown again in a new context, ${RUNS} runs in a row (AC-08, US6 scenario 2)`, async ({ browser }) => {
    test.fixme(true, 'The parent gate and settings page are built in Phase 13; T116 removes this line and makes the case pass.');
    for (let run = 1; run <= RUNS; run++) {
      const first = await silentPage(browser);
      await first.page.goto('/');
      // Parent gate: a 2-second press on the gear (FR-045).
      const gear = first.page.getByTestId('parent-gate');
      await gear.hover();
      await first.page.mouse.down();
      await first.page.waitForTimeout(2_200);
      await first.page.mouse.up();
      await first.page.getByRole('button', { name: 'Einstellungen' }).click();
      await first.page.getByLabel('Zahlenraum').selectOption('0-20');
      await first.page.getByLabel('Gegner').selectOption({ label: 'Leicht' });
      await first.page.getByLabel('Zahlenstrahl am Anfang').selectOption('3');
      await first.page.getByRole('button', { name: 'Speichern' }).click();
      const state = await first.context.storageState();
      await first.page.close();
      await first.context.close();

      const second = await silentPage(browser, state);
      await second.page.goto('/');
      const gear2 = second.page.getByTestId('parent-gate');
      await gear2.hover();
      await second.page.mouse.down();
      await second.page.waitForTimeout(2_200);
      await second.page.mouse.up();
      await second.page.getByRole('button', { name: 'Einstellungen' }).click();
      await expect(second.page.getByLabel('Zahlenraum'), `run ${run}`).toHaveValue('0-20');
      await expect(second.page.getByLabel('Gegner'), `run ${run}`).toHaveValue('easy');
      await expect(second.page.getByLabel('Zahlenstrahl am Anfang'), `run ${run}`).toHaveValue('3');
      await second.context.close();
    }
  });
});
