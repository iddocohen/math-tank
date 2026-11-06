/**
 * Amendment 12 (FR-050, FR-053, FR-058, FR-102 to FR-105, US8 scenarios 2, 5, 11 and 12, T278): the game on an iPad
 * held sideways (1024 by 768) and upright (768 by 1024) and on a phone held sideways (844 by 390), in WebKit with
 * touch, and the "Bitte dreh das Handy" picture on a phone held upright (390 by 844).
 *
 * Runs only in the device projects of playwright.config.ts. Every action is a tap (or, for the parent gate, a touch
 * pointer held for 2 seconds); no keyboard call is made. The canvas is scaled with Phaser Scale FIT, so the whole world
 * (ruler, labels, tanks, hearts) is visible exactly when the canvas lies inside the screen.
 * With SCREENSHOT_DIR set, each case saves a screenshot of its size there.
 */
import type { Locator, Page, TestInfo } from '@playwright/test';
import { enemyNumber, expect, seedStorage, startButton, test, touchHold } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';
import { boxOf, expectBattleFits, expectNoScroll, expectNoSideScroll, expectPadKeys, inside } from './layout';

const m = t();

const EXPECTED_LAYOUT: Record<string, string> = {
  'ipad-landscape': 'wide',
  'ipad-portrait': 'portrait',
  'iphone-landscape': 'side',
};

async function screenshot(page: Page, name: string): Promise<void> {
  // playwright.config.ts passes SCREENSHOT_DIR as metadata (the e2e specs have no Node types).
  const dir = test.info().config.metadata.screenshotDir as string | undefined;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

async function startBattle(page: Page): Promise<Locator> {
  await page.goto('/?seed=3');
  await startButton(page).tap();
  const overlay = page.getByTestId('battle-overlay');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(page.locator('canvas')).toBeVisible();
  return overlay;
}

function layoutName(info: TestInfo): string {
  return EXPECTED_LAYOUT[info.project.name] ?? 'wide';
}

test('the battle shows the number pad, and nothing is cut off or overlapping', async ({ page }, testInfo) => {
  const overlay = await startBattle(page);
  const viewport = page.viewportSize()!;
  await expect(page.getByTestId('battle-main')).toHaveAttribute('data-layout', layoutName(testInfo));
  await expect(overlay).toHaveAttribute('data-number-pad', 'true');

  await expectPadKeys(page);

  // The banner starts large in the middle of the sky and must fit there too.
  const banner = page.getByTestId('challenge-banner');
  expect(inside(await boxOf(banner), viewport.width, viewport.height), 'banner in the middle').toBe(true);

  // A digit moves the banner to the top (T234); the readout shows it.
  await page.locator('[data-key="1"]').tap();
  await expect(page.getByTestId('readout')).toHaveText('1');
  await expect(banner).toHaveAttribute('data-placement', 'top');
  await page.waitForTimeout(600);
  await screenshot(page, `battle-${testInfo.project.name}`);

  await expectBattleFits(page);

  const fontSize = await banner.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(16);
});

test('one full guided round is played with taps on the number pad only, with no "Finde N"', async ({ page }) => {
  test.setTimeout(120_000);
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), roundType: 'enemyCount', roundLength: 2 } }, { once: true });
  const overlay = await startBattle(page);
  const banner = page.getByTestId('challenge-banner');

  for (let destroyed = 0; destroyed < 2; destroyed++) {
    await expect(overlay).toHaveAttribute('data-enemies-destroyed', String(destroyed));
    await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true');
    expect(await banner.textContent()).not.toMatch(/^Finde /);
    const enemy = String(await enemyNumber(overlay));
    expect(enemy).toMatch(/^\d+$/);
    // A wrong digit first, deleted with ⌫ (FR-103).
    await page.locator('[data-key="9"]').tap();
    await page.locator('[data-key="backspace"]').tap();
    await expect(page.getByTestId('readout')).toHaveText('?');
    for (const digit of enemy) await page.locator(`[data-key="${digit}"]`).tap();
    await expect(page.getByTestId('readout')).toHaveText(enemy);
    await page.locator('.fire-button').tap();
  }
  await expect(page.getByTestId('round-end')).toBeVisible();
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '2');
});

test('the parent gate opens by touch and the settings page fits the screen', async ({ page }, testInfo) => {
  await startBattle(page);
  const gear = page.getByTestId('parent-gate');
  expect(await gear.evaluate((el) => getComputedStyle(el).touchAction)).toBe('none');
  await touchHold(gear);
  const menu = page.getByRole('dialog', { name: m.parent.menu });
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: m.parent.settings }).tap();
  const settings = page.getByTestId('settings-page');
  await expect(settings).toBeVisible();
  await expectNoSideScroll(settings, 'settings page fits the screen width');
  await expect(settings.getByLabel(m.settings.labels.numberPad)).toBeVisible();
  await screenshot(page, `settings-${testInfo.project.name}`);
  await expectNoScroll(page);
});

test('a phone held upright shows "Bitte dreh das Handy" and pauses; the settings work; turning back continues', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-landscape', 'the rotate check runs on the phone only');
  const overlay = await startBattle(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const rotate = page.getByTestId('rotate-screen');
  await expect(rotate).toBeVisible();
  await expect(rotate).toContainText(m.rotate.turnPhone);
  await expect(overlay).toHaveAttribute('data-phase', 'paused');
  await page.waitForTimeout(400);
  await screenshot(page, 'rotate-iphone-portrait');
  await expectNoScroll(page);

  // The parent can still open the settings upright (FR-104).
  await touchHold(rotate.getByTestId('parent-gate'));
  await page.getByRole('dialog', { name: m.parent.menu }).getByRole('button', { name: m.parent.settings }).tap();
  const settings = page.getByTestId('settings-page');
  await expect(settings).toBeVisible();
  await expectNoSideScroll(settings);
  await screenshot(page, 'settings-iphone-portrait');
  await settings.getByRole('button', { name: m.parent.close }).first().tap();
  await expect(settings).toHaveCount(0);
  await expect(overlay).toHaveAttribute('data-phase', 'paused');

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(rotate).toHaveCount(0);
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
});
