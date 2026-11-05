/**
 * Offline play (T134, FR-051, SC-008, AC-10, US8 scenario 1, decision D6). Against the production build: the first
 * load installs the service worker, which precaches the whole game; once it controls the page, the browser goes
 * offline, the page reloads from the cache, and a whole round (3 enemies) is played with the keyboard. Each answer is
 * the enemy's number, which the overlay reports (the enemy stands at the answer of every search, amendment 07).
 */
import { enemyNumber, expect, seedStorage, startButton, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';

test('after one load the game starts and plays a whole round offline, also after a reload', async ({ page, context, browserName }) => {
  test.setTimeout(120_000);
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), noDamage: true, roundType: 'enemyCount', roundLength: 3 } });
  await page.goto('/');
  await expect(startButton(page)).toBeVisible();
  const supported = await page.evaluate(() => 'serviceWorker' in navigator);
  // D6: only where the browser under Playwright offers service workers at all.
  test.skip(!supported, `${browserName} under Playwright offers no service worker here (decision D6; checked on a real iPad instead)`);

  // The service worker installs and precaches; after a reload it controls the page.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(startButton(page)).toBeVisible();
  await page.keyboard.press('Enter');
  const overlay = page.getByTestId('battle-overlay');
  for (let destroyed = 0; destroyed < 3; destroyed++) {
    await expect(overlay).toHaveAttribute('data-phase', 'challenge');
    await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true');
    const enemy = String(await enemyNumber(overlay));
    await page.keyboard.type(enemy);
    await expect(page.getByTestId('readout')).toHaveText(enemy);
    await page.keyboard.press('Enter');
    await expect(overlay).toHaveAttribute('data-enemies-destroyed', String(destroyed + 1));
  }
  await expect(overlay).toHaveAttribute('data-phase', 'roundOver');
  await context.setOffline(false);
});
