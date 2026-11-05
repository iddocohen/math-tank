/**
 * No external services (T135, FR-052): every request made while the game loads and while one whole round is played
 * goes to the game's own origin (or is a data: or blob: URL). No analytics, fonts, CDNs or tracking.
 */
import { enemyNumber, expect, seedStorage, startButton, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';

test('loading and playing a whole round sends no request to another origin', async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  const origin = new URL(baseURL!).origin;
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), noDamage: true, roundType: 'enemyCount', roundLength: 2 } });
  await page.goto('/?seed=8');
  await expect(startButton(page)).toBeVisible();
  await page.keyboard.press('Enter');
  const overlay = page.getByTestId('battle-overlay');
  for (let destroyed = 0; destroyed < 2; destroyed++) {
    await expect(overlay).toHaveAttribute('data-phase', 'challenge');
    await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true');
    const enemy = String(await enemyNumber(overlay));
    await page.keyboard.type(enemy);
    await page.keyboard.press('Enter');
    await expect(overlay).toHaveAttribute('data-enemies-destroyed', String(destroyed + 1));
  }
  await expect(page.getByTestId('round-end')).toBeVisible();

  expect(requests.length).toBeGreaterThan(0);
  const foreign = requests.filter((url) => !url.startsWith('data:') && !url.startsWith('blob:') && new URL(url).origin !== origin);
  expect(foreign).toEqual([]);
});
