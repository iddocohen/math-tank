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
import { expect, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const m = t();

const EXPECTED_LAYOUT: Record<string, string> = {
  'ipad-landscape': 'wide',
  'ipad-portrait': 'portrait',
  'iphone-landscape': 'side',
};

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

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

async function startBattle(page: Page): Promise<Locator> {
  await page.goto('/?seed=3');
  await page.getByRole('button', { name: m.start.play, exact: true }).tap();
  const overlay = page.getByTestId('battle-overlay');
  await expect(overlay).toHaveAttribute('data-phase', /^(challenge|aiming)$/);
  await expect(page.locator('canvas')).toBeVisible();
  return overlay;
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box, 'element has a box').not.toBeNull();
  return box!;
}

function inside(box: Box, width: number, height: number): boolean {
  const e = 0.5;
  return box.x >= -e && box.y >= -e && box.x + box.width <= width + e && box.y + box.height <= height + e;
}

function overlap(a: Box, b: Box): boolean {
  const e = 0.5;
  return a.x + e < b.x + b.width && b.x + e < a.x + a.width && a.y + e < b.y + b.height && b.y + e < a.y + a.height;
}

/** Holds a touch pointer on the gear for 2.3 seconds, the parent gate's press and hold (FR-045, FR-105). */
async function holdGear(gear: Locator): Promise<void> {
  await gear.dispatchEvent('pointerdown', { pointerType: 'touch', button: 0, isPrimary: true, pointerId: 1 });
  await gear.page().waitForTimeout(2300);
  await gear.dispatchEvent('pointerup', { pointerType: 'touch', button: 0, isPrimary: true, pointerId: 1 });
}

async function expectNoScroll(page: Page): Promise<void> {
  const size = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    sh: document.documentElement.scrollHeight,
    w: window.innerWidth,
    h: window.innerHeight,
  }));
  expect(size.sw).toBeLessThanOrEqual(size.w);
  expect(size.sh).toBeLessThanOrEqual(size.h);
}

function layoutName(info: TestInfo): string {
  return EXPECTED_LAYOUT[info.project.name] ?? 'wide';
}

test('the battle shows the number pad, and nothing is cut off or overlapping', async ({ page }, testInfo) => {
  const overlay = await startBattle(page);
  const viewport = page.viewportSize()!;
  await expect(page.getByTestId('battle-main')).toHaveAttribute('data-layout', layoutName(testInfo));
  await expect(overlay).toHaveAttribute('data-number-pad', 'true');

  const keys = await page.getByTestId('pad-key').all();
  expect(keys.length).toBe(11);
  for (const key of keys) {
    const b = await boxOf(key);
    expect(b.width, `pad key ${await key.getAttribute('data-key')}`).toBeGreaterThanOrEqual(48);
    expect(b.height, `pad key ${await key.getAttribute('data-key')}`).toBeGreaterThanOrEqual(48);
  }

  // The banner starts large in the middle of the sky and must fit there too.
  const banner = page.getByTestId('challenge-banner');
  expect(inside(await boxOf(banner), viewport.width, viewport.height), 'banner in the middle').toBe(true);

  // A digit moves the banner to the top (T234); the readout shows it.
  await page.locator('[data-key="1"]').tap();
  await expect(page.getByTestId('readout')).toHaveText('1');
  await expect(banner).toHaveAttribute('data-placement', 'top');
  await page.waitForTimeout(600);
  await screenshot(page, `battle-${testInfo.project.name}`);

  const named: Array<[string, Locator]> = [
    ['canvas', page.locator('canvas')],
    ['banner', banner],
    ['help', page.getByTestId('help-button')],
    ['gear', page.getByTestId('parent-gate')],
    ['new scene', page.getByTestId('new-scene')],
    ['fire', page.locator('.fire-button')],
    ['readout', page.getByTestId('readout')],
    ...keys.map((k, i): [string, Locator] => [`key ${i}`, k]),
  ];
  const boxes = new Map<string, Box>();
  for (const [name, locator] of named) {
    const b = await boxOf(locator);
    expect(inside(b, viewport.width, viewport.height), `${name} inside ${viewport.width} by ${viewport.height}: ${JSON.stringify(b)}`).toBe(true);
    boxes.set(name, b);
  }
  // No two interactive targets overlap; the canvas does not overlap the pad, the fire key, the readout or the help
  // button (which would cover the "Du" arrow or a tank).
  const targets = [...boxes.keys()].filter((n) => n !== 'canvas' && n !== 'banner' && n !== 'readout');
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      expect(overlap(boxes.get(targets[i]!)!, boxes.get(targets[j]!)!), `${targets[i]} and ${targets[j]} overlap`).toBe(false);
    }
  }
  for (const name of [...targets.filter((n) => n.startsWith('key') || n === 'fire' || n === 'help'), 'readout']) {
    expect(overlap(boxes.get('canvas')!, boxes.get(name)!), `canvas and ${name} overlap`).toBe(false);
  }
  // The banner covers no control: it sits over the sky.
  for (const name of targets) expect(overlap(boxes.get('banner')!, boxes.get(name)!), `banner and ${name} overlap`).toBe(false);
  await expectNoScroll(page);

  const fontSize = await banner.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(16);
});

test('one full guided round is played with taps on the number pad only, with no "Finde N"', async ({ page }) => {
  test.setTimeout(120_000);
  await store(page, { ...defaultSettings(), roundType: 'enemyCount', roundLength: 2 });
  const overlay = await startBattle(page);
  const banner = page.getByTestId('challenge-banner');

  for (let destroyed = 0; destroyed < 2; destroyed++) {
    await expect(overlay).toHaveAttribute('data-enemies-destroyed', String(destroyed), { timeout: 15_000 });
    await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true', { timeout: 15_000 });
    expect(await banner.textContent()).not.toMatch(/^Finde /);
    const enemy = (await overlay.getAttribute('data-enemy-number'))!;
    expect(enemy).toMatch(/^\d+$/);
    // A wrong digit first, deleted with ⌫ (FR-103).
    await page.locator('[data-key="9"]').tap();
    await page.locator('[data-key="backspace"]').tap();
    await expect(page.getByTestId('readout')).toHaveText('?');
    for (const digit of enemy) await page.locator(`[data-key="${digit}"]`).tap();
    await expect(page.getByTestId('readout')).toHaveText(enemy);
    await page.locator('.fire-button').tap();
  }
  await expect(page.getByTestId('round-end')).toBeVisible({ timeout: 20_000 });
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '2');
});

test('the parent gate opens by touch and the settings page fits the screen', async ({ page }, testInfo) => {
  await startBattle(page);
  const gear = page.getByTestId('parent-gate');
  expect(await gear.evaluate((el) => getComputedStyle(el).touchAction)).toBe('none');
  await holdGear(gear);
  const menu = page.getByRole('dialog', { name: m.parent.menu });
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: m.parent.settings }).tap();
  const settings = page.getByTestId('settings-page');
  await expect(settings).toBeVisible();
  const fits = await settings.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
  expect(fits, 'settings page fits the screen width').toBe(true);
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
  await holdGear(rotate.getByTestId('parent-gate'));
  await page.getByRole('dialog', { name: m.parent.menu }).getByRole('button', { name: m.parent.settings }).tap();
  const settings = page.getByTestId('settings-page');
  await expect(settings).toBeVisible();
  expect(await settings.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await screenshot(page, 'settings-iphone-portrait');
  await settings.getByRole('button', { name: m.parent.close }).first().tap();
  await expect(settings).toHaveCount(0);
  await expect(overlay).toHaveAttribute('data-phase', 'paused');

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(rotate).toHaveCount(0);
  await expect(overlay).toHaveAttribute('data-phase', /^(challenge|aiming)$/);
});
