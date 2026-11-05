/**
 * Amendment 16 (FR-050, FR-125, FR-126, FR-128): the game on Amazon Fire tablets with the Silk browser. Runs only in
 * the Fire projects of playwright.config.ts: Chromium (Silk is based on Chromium) with Silk's tablet user agent, touch,
 * and the Fire 7, Fire HD 8 and Fire HD 10 sizes held sideways and upright (tests/e2e/silk.ts). Every action is a tap.
 * With SCREENSHOT_DIR set, the first test saves a screenshot of each size in the middle of a round.
 */
import type { Browser, Locator, Page, TestInfo } from '@playwright/test';
import { expect, GAME_WAIT, silenceAudio, startButton, test } from './fixtures';
import { expectBattleFits, expectPadKeys } from './layout';
import { FIRE_BARS_HEIGHT, SILK_DESKTOP_USER_AGENT } from './silk';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { screenLayout } from '../../src/core/view/screen';

const ROUND = { ...defaultSettings(), roundType: 'enemyCount', roundLength: 2 };

async function store(page: Page, settings: unknown): Promise<void> {
  await page.addInitScript(([key, value]: [string, string]) => {
    if (window.sessionStorage.getItem('e2e-seeded')) return;
    window.sessionStorage.setItem('e2e-seeded', '1');
    window.localStorage.setItem(key, value);
  }, [SETTINGS_KEY, JSON.stringify(settings)] as [string, string]);
}

async function screenshot(page: Page, name: string): Promise<void> {
  // playwright.config.ts passes SCREENSHOT_DIR as metadata (the e2e specs have no Node types).
  const dir = test.info().config.metadata.screenshotDir as string | undefined;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

function landscape(info: TestInfo): boolean {
  return info.project.name.endsWith('-landscape');
}

/** Taps "Gemischt" (the first play-mode button) on the start screen and waits for the battlefield. */
async function startMixed(page: Page): Promise<Locator> {
  await expect(startButton(page)).toHaveAttribute('data-mode', 'mixed');
  await startButton(page).tap();
  const overlay = page.getByTestId('battle-overlay');
  await expect(overlay).toHaveAttribute('data-phase', /^(challenge|aiming)$/);
  await expect(page.locator('canvas')).toBeVisible();
  return overlay;
}

/** The layout for this size: sideways is "wide" or "side", upright is "portrait" (600 px wide is not a phone). */
async function expectTouchLayout(page: Page, isLandscape: boolean): Promise<void> {
  const { width, height } = page.viewportSize()!;
  const expected = screenLayout(width, height);
  expect(isLandscape ? ['wide', 'side'] : ['portrait'], `layout for ${width} by ${height}`).toContain(expected);
  await expect(page.getByTestId('rotate-screen')).toHaveCount(0);
  await expect(page.getByTestId('battle-main')).toHaveAttribute('data-layout', expected);
  await expect(page.getByTestId('battle-overlay')).toHaveAttribute('data-number-pad', 'true');
}

/** Answers every enemy of the round with its number, typed on the number pad, until the round ends. */
async function playRoundWithPad(page: Page, overlay: Locator, enemies: number): Promise<void> {
  for (let destroyed = 0; destroyed < enemies; destroyed++) {
    await expect(overlay).toHaveAttribute('data-enemies-destroyed', String(destroyed), { timeout: GAME_WAIT });
    await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true', { timeout: GAME_WAIT });
    const enemy = (await overlay.getAttribute('data-enemy-number'))!;
    expect(enemy).toMatch(/^-?\d+$/);
    for (const key of enemy) await page.locator(`[data-key="${key === '-' ? 'minus' : key}"]`).tap();
    await expect(page.getByTestId('readout')).toHaveText(enemy);
    await page.locator('.fire-button').tap();
  }
  await expect(page.getByTestId('round-end')).toBeVisible({ timeout: GAME_WAIT });
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', String(enemies));
}

test('"Gemischt" starts from the start screen; nothing is cut off or overlapping; a round is played with the number pad only', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await store(page, ROUND);
  await page.goto('/?seed=3');
  const overlay = await startMixed(page);
  await expectTouchLayout(page, landscape(testInfo));
  await expectPadKeys(page);

  // A digit moves the banner to the top (T234), as in the middle of a round.
  await page.locator('[data-key="1"]').tap();
  await expect(page.getByTestId('challenge-banner')).toHaveAttribute('data-placement', 'top');
  await page.waitForTimeout(600);
  await screenshot(page, `fire-${testInfo.project.name}`);
  await expectBattleFits(page);
  await page.locator('[data-key="backspace"]').tap();
  await expect(page.getByTestId('readout')).toHaveText('?');

  await playRoundWithPad(page, overlay, 2);
});

test('held sideways with fewer browser bars (only the navigation bar), the battle still fits', async ({ page }, testInfo) => {
  test.skip(!landscape(testInfo), 'sideways only');
  await page.goto('/?seed=3');
  await startMixed(page);
  const { width, height } = page.viewportSize()!;
  // Silk's address bar and the status bar hidden: 48 CSS pixels for the navigation bar instead of FIRE_BARS_HEIGHT.
  await page.setViewportSize({ width, height: height + FIRE_BARS_HEIGHT - 48 });
  await expectTouchLayout(page, true);
  await expectPadKeys(page);
  await expectBattleFits(page);
});

test('offline: after one load the game starts and a round is played with the number pad', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'fire-7-landscape', 'the offline check runs once, on the Fire 7 size');
  test.setTimeout(120_000);
  await store(page, ROUND);
  await page.goto('/');
  await expect(startButton(page)).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), { timeout: GAME_WAIT }).toBe(true);

  await context.setOffline(true);
  await page.reload();
  const overlay = await startMixed(page);
  await expectTouchLayout(page, true);
  await playRoundWithPad(page, overlay, 2);
  await context.setOffline(false);
});

/**
 * Silk's desktop view sends a desktop user agent. Like Chrome's desktop site mode, it may also lay the page out at
 * least DESKTOP_LAYOUT_WIDTH CSS pixels wide and zoom it out to fit; whether Silk does this is not documented, so a
 * tablet held upright is checked at that width (with the same aspect ratio), and held sideways at its own size.
 */
const DESKTOP_LAYOUT_WIDTH = 980;

async function desktopViewPage(browser: Browser, page: Page): Promise<Page> {
  const own = page.viewportSize()!;
  const width = Math.max(own.width, DESKTOP_LAYOUT_WIDTH);
  const height = Math.round((own.height * width) / own.width);
  const context = await browser.newContext({
    userAgent: SILK_DESKTOP_USER_AGENT,
    viewport: { width, height },
    screen: { width, height: height + FIRE_BARS_HEIGHT },
    deviceScaleFactor: 1.5,
    hasTouch: true,
    isMobile: true,
  });
  await context.addInitScript(silenceAudio);
  return context.newPage();
}

test("Silk's desktop view still gets the touch layout with the number pad", async ({ browser, page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('fire-hd-10'), 'desktop view is checked on the largest tablet');
  const desktop = await desktopViewPage(browser, page);
  try {
    expect(await desktop.evaluate(() => navigator.userAgent)).toContain('X11; Linux x86_64');
    await desktop.goto('/?seed=3');
    await startMixed(desktop);
    await expectTouchLayout(desktop, landscape(testInfo));
    await expectPadKeys(desktop);
    await expectBattleFits(desktop);
  } finally {
    await desktop.context().close();
  }
});
