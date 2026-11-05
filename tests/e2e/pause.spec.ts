/**
 * Pause and fullscreen in the battle (T140, T141, FR-054, FR-059, US8 scenarios 3, 5 and 9). The pause button stops
 * a shell in flight where it is; "Weiterspielen" lets it fly on from the same point and land. The fullscreen button
 * (only where the browser allows fullscreen) puts the app root in fullscreen, and after leaving it the app root has
 * the focus again, so the keys keep working. Game state comes from the overlay's data-* attributes (D4).
 */
import { expect, GAME_WAIT, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const m = t();

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), noDamage: true, challengeTypes: { ...defaultSettings().challengeTypes, comparison: false } })] as const,
  );
  await page.goto('/?seed=6');
  await expect(page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('battle-overlay')).toHaveAttribute('data-challenge-answerable', 'true', { timeout: 10_000 });
});

test('the pause button stops a shell in flight, and "Weiterspielen" lets it land', async ({ page }) => {
  const overlay = page.getByTestId('battle-overlay');
  const enemy = Number(await overlay.getAttribute('data-enemy-number'));
  await page.keyboard.type(String(enemy > 50 ? enemy - 30 : enemy + 30));
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-phase', 'playerShot');
  await page.getByRole('button', { name: m.battle.pause }).click();
  await expect(overlay).toHaveAttribute('data-phase', 'paused');
  await expect(page.getByTestId('pause-screen')).toBeVisible();
  // Paused: the shell does not land, however long the child waits.
  await page.waitForTimeout(3_000);
  await expect(overlay).toHaveAttribute('data-phase', 'paused');
  await expect(overlay).not.toHaveAttribute('data-last-shot', /.+/);
  await page.getByRole('button', { name: m.battle.resume }).click();
  await expect(page.getByTestId('pause-screen')).toHaveCount(0);
  await expect(overlay).toHaveAttribute('data-last-shot', 'miss', { timeout: GAME_WAIT });
});

test('the fullscreen button puts the app root in fullscreen; afterwards the keys still work', async ({ page, browserName }) => {
  const button = page.getByTestId('battle-fullscreen');
  const allowed = await page.evaluate(() => document.fullscreenEnabled);
  test.skip(!allowed, `${browserName} does not allow fullscreen here, so the button is hidden (FR-106)`);
  await button.click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.getAttribute('data-testid') ?? null)).toBe('app-root');
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null)).toBe('app-root');
  await page.keyboard.press('7');
  await expect(page.getByTestId('readout')).toHaveText('7');
});
