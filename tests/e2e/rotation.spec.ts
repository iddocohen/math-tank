/**
 * Bug T306 (iPhone rotation, product owner report): turning an iPhone did not change the game's layout. Safari on iOS
 * fires `orientationchange` and `resize` while `window.innerWidth` and `window.innerHeight` still hold the size from
 * before the turn, and often sends no later event with the new size (WebKit bugs 170595 and 231269). Playwright's
 * WebKit updates the size before the events, so each test runs twice: once as Playwright's WebKit behaves, and once
 * with `iosLateSize`, which keeps reporting the old size for 250 ms after every change of the window size.
 *
 * Runs in the `iphone-landscape` project only (WebKit, touch, iPhone 13). Every action is a tap.
 */
import type { Locator, Page } from '@playwright/test';
import { expect, GAME_WAIT, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const m = t();
const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };

/** Reports the window size from before a change for 250 ms after it, as Safari on iOS does after a turn. */
function iosLateSize(): void {
  const find = (name: string) => {
    for (let o: object | null = window; o; o = Object.getPrototypeOf(o) as object | null) {
      const d = Object.getOwnPropertyDescriptor(o, name);
      if (d?.get) return d.get;
    }
    throw new Error(`no getter for ${name}`);
  };
  const realWidth = find('innerWidth');
  const realHeight = find('innerHeight');
  let shown = { w: realWidth.call(window) as number, h: realHeight.call(window) as number };
  let last = { ...shown };
  let changedAt = 0;
  const read = () => {
    const now = { w: realWidth.call(window) as number, h: realHeight.call(window) as number };
    if (now.w !== last.w || now.h !== last.h) {
      last = now;
      changedAt = performance.now();
    }
    if (performance.now() - changedAt >= 250) shown = now;
    return shown;
  };
  Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => read().w });
  Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => read().h });
}

async function turn(page: Page, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
}

async function expectSide(page: Page): Promise<void> {
  await expect(page.getByTestId('rotate-screen')).toHaveCount(0);
}

/** The canvas lies inside the screen and to the left of the number pad (nothing cut off). */
async function expectBattleFits(page: Page): Promise<void> {
  const main = page.getByTestId('battle-main');
  await expect(main).toHaveAttribute('data-layout', 'side');
  await expect(main).toHaveAttribute('data-number-pad', 'true');
  await expect
    .poll(async () => {
      const canvas = await page.locator('canvas').boundingBox();
      const pad = await page.getByTestId('number-pad').boundingBox();
      if (!canvas || !pad) return false;
      return canvas.x >= 0 && canvas.y >= 0 && canvas.y + canvas.height <= LANDSCAPE.height + 1 && canvas.x + canvas.width <= pad.x + 1;
    })
    .toBe(true);
}

/** Types a number 30 away from the enemy on the number pad and fires: the shell lands at that number. */
async function fireWithPad(page: Page, overlay: Locator): Promise<void> {
  await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true', { timeout: GAME_WAIT });
  const enemy = Number(await overlay.getAttribute('data-enemy-number'));
  const n = enemy > 50 ? enemy - 30 : enemy + 30;
  const pad = page.getByTestId('number-pad');
  for (const digit of String(n)) await pad.locator(`[data-key="${digit}"]`).tap();
  await expect(page.getByTestId('readout')).toHaveText(String(n));
  await page.locator('.fire-button').tap();
  await expect(overlay).toHaveAttribute('data-last-landing', String(n), { timeout: GAME_WAIT });
}

for (const ios of [false, true]) {
  const name = ios ? ' (size reported late, as on iOS)' : '';

  test.describe(`turning an iPhone${name}`, () => {
    test.beforeEach(async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'iphone-landscape', 'the rotation check runs on the phone only');
      if (ios) await page.addInitScript(iosLateSize);
      // No damage and no comparison challenge, so the round goes on and no decoy stands where the test fires.
      await page.addInitScript(
        ([key, value]) => {
          if (window.sessionStorage.getItem('e2e-seeded')) return;
          window.sessionStorage.setItem('e2e-seeded', '1');
          window.localStorage.setItem(key, value);
        },
        [SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), noDamage: true, challengeTypes: { ...defaultSettings().challengeTypes, comparison: false } })] as const,
      );
    });

    test('load upright, turn sideways, play a shot with the number pad, turn upright and sideways again', async ({ page }) => {
      await turn(page, PORTRAIT);
      await page.goto('/?seed=5');
      const rotate = page.getByTestId('rotate-screen');
      await expect(rotate).toBeVisible();

      await turn(page, LANDSCAPE);
      await expectSide(page);
      await page.getByRole('button', { name: m.start.play, exact: true }).tap();
      const overlay = page.getByTestId('battle-overlay');
      await expectBattleFits(page);
      await fireWithPad(page, overlay);

      await turn(page, PORTRAIT);
      await expect(rotate).toBeVisible();
      await expect(overlay).toHaveAttribute('data-phase', 'paused');

      await turn(page, LANDSCAPE);
      await expectSide(page);
      await expect(overlay).not.toHaveAttribute('data-phase', 'paused');
      await expectBattleFits(page);
      await fireWithPad(page, overlay);
    });

    test('the parent menu opened on the rotate picture stays open and the round stays paused after turning sideways (review R1)', async ({ page }) => {
      await turn(page, LANDSCAPE);
      await page.goto('/?seed=5');
      await page.getByRole('button', { name: m.start.play, exact: true }).tap();
      const overlay = page.getByTestId('battle-overlay');
      await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: GAME_WAIT });

      await turn(page, PORTRAIT);
      const rotate = page.getByTestId('rotate-screen');
      await expect(rotate).toBeVisible();
      const gear = rotate.getByTestId('parent-gate');
      await gear.dispatchEvent('pointerdown', { pointerType: 'touch', button: 0, isPrimary: true, pointerId: 1 });
      await page.waitForTimeout(2300);
      await gear.dispatchEvent('pointerup', { pointerType: 'touch', button: 0, isPrimary: true, pointerId: 1 });
      const menu = page.getByRole('dialog', { name: m.parent.menu });
      await expect(menu).toBeVisible();

      await turn(page, LANDSCAPE);
      await expectSide(page);
      await expect(menu).toBeVisible();
      await expect(overlay).toHaveAttribute('data-phase', 'paused');
      await menu.getByRole('button', { name: m.parent.close }).tap();
      await expect(menu).toHaveCount(0);
      await expect(overlay).toHaveAttribute('data-phase', 'challenge');
      await fireWithPad(page, overlay);
    });

    test('load sideways: the game shows without the rotate picture', async ({ page }) => {
      await turn(page, LANDSCAPE);
      await page.goto('/?seed=5');
      await expect(page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
      await expectSide(page);
      await page.getByRole('button', { name: m.start.play, exact: true }).tap();
      await expectBattleFits(page);
    });
  });
}
