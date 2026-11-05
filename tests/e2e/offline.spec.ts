/**
 * Offline play (T134, FR-051, SC-008, AC-10, US8 scenario 1, decision D6). Against the production build: the first
 * load installs the service worker, which precaches the whole game; once it controls the page, the browser goes
 * offline, the page reloads from the cache, and a whole round (3 enemies) is played with the keyboard. Each answer is
 * the enemy's number, which the overlay reports (the enemy stands at the answer of every search, amendment 07).
 */
import { expect, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const m = t();

test('after one load the game starts and plays a whole round offline, also after a reload', async ({ page, context, browserName }) => {
  test.setTimeout(120_000);
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), noDamage: true, roundType: 'enemyCount', roundLength: 3 })] as const,
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
  const supported = await page.evaluate(() => 'serviceWorker' in navigator);
  // D6: only where the browser under Playwright offers service workers at all.
  test.skip(!supported, `${browserName} under Playwright offers no service worker here (decision D6; checked on a real iPad instead)`);

  // The service worker installs and precaches; after a reload it controls the page.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), { timeout: 15_000 }).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  const overlay = page.getByTestId('battle-overlay');
  for (let destroyed = 0; destroyed < 3; destroyed++) {
    await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: 15_000 });
    await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true', { timeout: 15_000 });
    const enemy = (await overlay.getAttribute('data-enemy-number'))!;
    await page.keyboard.type(enemy);
    await expect(page.getByTestId('readout')).toHaveText(enemy);
    await page.keyboard.press('Enter');
    await expect(overlay).toHaveAttribute('data-enemies-destroyed', String(destroyed + 1), { timeout: 15_000 });
  }
  await expect(overlay).toHaveAttribute('data-phase', 'roundOver', { timeout: 15_000 });
  await context.setOffline(false);
});
