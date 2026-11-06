/**
 * Checks that the battle screen fits the viewport: nothing is cut off and no two controls overlap (amendment 12,
 * FR-102 to FR-105; amendment 16, FR-125). Shared by tests/e2e/devices.spec.ts (iPad and iPhone in WebKit) and
 * tests/e2e/fire.spec.ts (Amazon Fire tablets in Chromium with a Silk user agent).
 */
import type { Locator, Page } from '@playwright/test';
import { expect } from './fixtures';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box, 'element has a box').not.toBeNull();
  return box!;
}

export function inside(box: Box, width: number, height: number): boolean {
  const e = 0.5;
  return box.x >= -e && box.y >= -e && box.x + box.width <= width + e && box.y + box.height <= height + e;
}

export function overlap(a: Box, b: Box): boolean {
  const e = 0.5;
  return a.x + e < b.x + b.width && b.x + e < a.x + a.width && a.y + e < b.y + b.height && b.y + e < a.y + a.height;
}

export async function expectNoScroll(page: Page): Promise<void> {
  const size = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    sh: document.documentElement.scrollHeight,
    w: window.innerWidth,
    h: window.innerHeight,
  }));
  expect(size.sw).toBeLessThanOrEqual(size.w);
  expect(size.sh).toBeLessThanOrEqual(size.h);
}

/** `el` is no wider than its visible width (1 px of rounding allowed), so it does not scroll sideways. */
export async function expectNoSideScroll(el: Locator, message?: string): Promise<void> {
  expect(await el.evaluate((e) => e.scrollWidth <= e.clientWidth + 1), message).toBe(true);
}

/** Every number-pad key is at least 48 by 48 CSS pixels (FR-103). Returns the keys. */
export async function expectPadKeys(page: Page): Promise<Locator[]> {
  const keys = await page.getByTestId('pad-key').all();
  expect(keys.length).toBe(11);
  for (const key of keys) {
    const b = await boxOf(key);
    expect(b.width, `pad key ${await key.getAttribute('data-key')}`).toBeGreaterThanOrEqual(48);
    expect(b.height, `pad key ${await key.getAttribute('data-key')}`).toBeGreaterThanOrEqual(48);
  }
  return keys;
}

/**
 * The canvas (ruler, labels, tanks and hearts are drawn inside it, scaled with Phaser Scale FIT), the banner and every
 * control lie inside the viewport; no two controls overlap; the canvas covers no pad key, the fire key, the readout or
 * the help button; the banner covers no control and not the tank counter; the page does not scroll.
 */
export async function expectBattleFits(page: Page): Promise<void> {
  const viewport = page.viewportSize()!;
  const keys = await page.getByTestId('pad-key').all();
  const banner = page.getByTestId('challenge-banner');
  const named: Array<[string, Locator]> = [
    ['canvas', page.locator('canvas')],
    ['banner', banner],
    ['help', page.getByTestId('help-button')],
    ['gear', page.getByTestId('parent-gate')],
    ['new scene', page.getByTestId('new-scene')],
    // Pause and fullscreen in the battle (T140, T141); fullscreen only where the browser allows it (FR-106).
    ['pause', page.getByTestId('pause-button')],
    ...((await page.getByTestId('battle-fullscreen').count()) > 0 ? [['fullscreen', page.getByTestId('battle-fullscreen')] as [string, Locator]] : []),
    ...((await page.getByTestId('speaker-button').count()) > 0 ? [['speaker', page.getByTestId('speaker-button')] as [string, Locator]] : []),
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
  const targets = [...boxes.keys()].filter((n) => n !== 'canvas' && n !== 'banner' && n !== 'readout');
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      expect(overlap(boxes.get(targets[i]!)!, boxes.get(targets[j]!)!), `${targets[i]} and ${targets[j]} overlap`).toBe(false);
    }
  }
  for (const name of [...targets.filter((n) => n.startsWith('key') || n === 'fire' || n === 'help'), 'readout']) {
    expect(overlap(boxes.get('canvas')!, boxes.get(name)!), `canvas and ${name} overlap`).toBe(false);
  }
  for (const name of targets) expect(overlap(boxes.get('banner')!, boxes.get(name)!), `banner and ${name} overlap`).toBe(false);
  expect(overlap(boxes.get('banner')!, await boxOf(page.getByTestId('score'))), 'banner and counter overlap').toBe(false);
  await expectNoScroll(page);
}
