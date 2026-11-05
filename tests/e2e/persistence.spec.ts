/**
 * US6 persistence end to end (FR-048, SC-007, AC-08, US6 scenario 2, T109).
 *
 * Each case saves the browser context's `storageState` (localStorage included), closes the page and its context,
 * opens a new context with that state and checks that the settings are still there, as after a browser restart.
 *
 * The first case writes stored settings directly and checks that a new context plays with them; it covers
 * src/app/persistence.ts. The second case changes the settings through the parent gate and the settings page
 * (Phase 13, T116), including the amendment 06 round type and number of enemies. The last cases check the gate itself: a short tap does nothing, and opening it in a battle
 * pauses the game until the parent closes it (FR-045); "Fortschritt" lists a finished search after a reload (T133).
 */
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { expect, GAME_WAIT, silenceAudio, startButton, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import type { Settings } from '../../src/core/settings/schema';
import { validateSettings, withRange } from '../../src/core/settings/validate';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const m = t();
const L = m.settings.labels;
const RUNS = 5;

/** Presses the gear with the mouse for `ms` milliseconds (FR-045). */
async function pressGear(page: Page, ms: number): Promise<void> {
  await page.getByTestId('parent-gate').hover();
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/** Parent gate: a 2-second press on the gear, then "Einstellungen" in the parent menu. */
async function openSettings(page: Page): Promise<void> {
  await pressGear(page, 2_300);
  await page.getByRole('button', { name: m.parent.settings, exact: true }).click();
  await expect(page.getByTestId('settings-page')).toBeVisible();
}

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
      // Free play (?mode=free, T070) shows the enemy, so its number comes from the stored range.
      await second.page.goto(`/?seed=${run}&mode=ruler`);
      await expect(startButton(second.page)).toBeVisible();
      expect(await storedSettings(second.page), `run ${run}`).toEqual(custom);
      await second.page.keyboard.press('Enter');
      const overlay = second.page.locator('[data-phase]');
      await expect(overlay).toHaveAttribute('data-phase', 'challenge');
      const enemy = Number(await overlay.getAttribute('data-enemy-number'));
      expect(enemy, `run ${run}: enemy number from the stored range`).toBeGreaterThanOrEqual(550);
      expect(enemy, `run ${run}: enemy number from the stored range`).toBeLessThanOrEqual(780);
      await second.context.close();
    }
  });

  test(`settings changed on the settings page are shown again in a new context, ${RUNS} runs in a row (AC-08, US6 scenario 2)`, async ({ browser }) => {
    // Ten 2-second gate presses plus ten page loads; a loaded machine needs more than the default timeout.
    test.slow();
    for (let run = 1; run <= RUNS; run++) {
      const first = await silentPage(browser);
      await first.page.goto('/');
      await openSettings(first.page);
      await first.page.getByLabel(L.rangePreset, { exact: true }).selectOption('0-20');
      await first.page.getByLabel(L.enemyDifficulty, { exact: true }).selectOption({ label: L.enemyEasy });
      await first.page.getByLabel(L.rulerLevelStart, { exact: true }).selectOption('3');
      // Amendment 06: the round type and the number of enemies are saved too.
      await first.page.getByLabel(L.roundType, { exact: true }).selectOption('enemyCount');
      await first.page.getByLabel(L.roundLength, { exact: true }).fill('7');
      await first.page.getByRole('button', { name: m.settings.save }).click();
      await expect(first.page.getByText(m.settings.saved)).toBeVisible();
      const state = await first.context.storageState();
      await first.page.close();
      await first.context.close();

      const second = await silentPage(browser, state);
      await second.page.goto('/');
      await openSettings(second.page);
      await expect(second.page.getByLabel(L.rangePreset, { exact: true }), `run ${run}`).toHaveValue('0-20');
      await expect(second.page.getByLabel(L.enemyDifficulty, { exact: true }), `run ${run}`).toHaveValue('easy');
      await expect(second.page.getByLabel(L.rulerLevelStart, { exact: true }), `run ${run}`).toHaveValue('3');
      await expect(second.page.getByLabel(L.roundType, { exact: true }), `run ${run}`).toHaveValue('enemyCount');
      await expect(second.page.getByLabel(L.roundLength, { exact: true }), `run ${run}`).toHaveValue('7');
      await second.context.close();
    }
  });
});

test.describe('parent gate (FR-045, US6 scenario 1)', () => {
  test('a short tap or a key does not open the parent menu', async ({ page }) => {
    await page.goto('/?seed=3');
    await pressGear(page, 300);
    await page.getByTestId('parent-gate').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.waitForTimeout(2_300);
    await expect(page.getByRole('dialog', { name: m.parent.menu })).toHaveCount(0);
  });

  test('opening the gate in a battle pauses the game; closing the settings page resumes it', async ({ page }) => {
    await page.goto('/?seed=3');
    await expect(startButton(page)).toBeVisible();
    await page.keyboard.press('Enter');
    const overlay = page.getByTestId('battle-overlay');
    await expect(overlay).toHaveAttribute('data-phase', 'challenge');
    await openSettings(page);
    await expect(overlay).toHaveAttribute('data-phase', 'paused');
    // Keys do nothing in the game while settings are open.
    await page.keyboard.press('Escape');
    await expect(overlay).toHaveAttribute('data-phase', 'paused');
    await page.getByRole('button', { name: m.parent.close, exact: true }).click();
    await expect(page.getByTestId('settings-page')).toHaveCount(0);
    await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  });

  test('"Fortschritt" shows the saved attempt of a finished search, also after a reload (FR-040, FR-048, T133)', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/?seed=1');
    await expect(startButton(page)).toBeVisible();
    await page.keyboard.press('Enter');
    const overlay = page.locator('[data-phase]');
    await expect(overlay).toHaveAttribute('data-phase', 'challenge');
    const enemy = (await overlay.getAttribute('data-enemy-number'))!;
    // More than 1.5 s after answers became possible, so the hit is not a guess (FR-038).
    await page.waitForTimeout(2_800);
    for (const ch of enemy) await page.keyboard.press(ch);
    await page.keyboard.press('Enter');
    await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1', { timeout: GAME_WAIT });

    const P = m.progressPage;
    const openProgress = async () => {
      await pressGear(page, 2_300);
      const button = page.getByRole('button', { name: m.parent.progress, exact: true });
      await expect(button).toBeEnabled();
      await button.click();
      await expect(page.getByTestId('progress-page')).toBeVisible();
    };
    const sessionAttempts = page.getByRole('table', { name: P.sessionsTitle }).locator('tbody [data-col="attempts"]');
    await openProgress();
    await expect(page.getByRole('table', { name: P.skillsTitle }).locator('tbody tr').first()).toBeVisible();
    await expect(sessionAttempts).toHaveText(['1']);
    await page.getByRole('button', { name: m.parent.close, exact: true }).click();
    await expect(page.getByTestId('progress-page')).toHaveCount(0);
    await expect(overlay).toHaveAttribute('data-phase', 'challenge');

    // Saved in the browser: after a reload the page still lists the attempt.
    await page.reload();
    await openProgress();
    await expect(sessionAttempts).toHaveText(['1']);
  });
});
