/**
 * No external services (T135, FR-052): every request made while the game loads and while one whole round is played
 * goes to the game's own origin (or is a data: or blob: URL). No analytics, fonts, CDNs or tracking.
 */
import { expect, GAME_WAIT, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const m = t();

test('loading and playing a whole round sends no request to another origin', async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  const origin = new URL(baseURL!).origin;
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), noDamage: true, roundType: 'enemyCount', roundLength: 2 })] as const,
  );
  await page.goto('/?seed=8');
  await expect(page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  const overlay = page.getByTestId('battle-overlay');
  for (let destroyed = 0; destroyed < 2; destroyed++) {
    await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: GAME_WAIT });
    await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true', { timeout: GAME_WAIT });
    const enemy = (await overlay.getAttribute('data-enemy-number'))!;
    await page.keyboard.type(enemy);
    await page.keyboard.press('Enter');
    await expect(overlay).toHaveAttribute('data-enemies-destroyed', String(destroyed + 1), { timeout: GAME_WAIT });
  }
  await expect(page.getByTestId('round-end')).toBeVisible({ timeout: GAME_WAIT });

  expect(requests.length).toBeGreaterThan(0);
  const foreign = requests.filter((url) => !url.startsWith('data:') && !url.startsWith('blob:') && new URL(url).origin !== origin);
  expect(foreign).toEqual([]);
});
