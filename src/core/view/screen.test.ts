import { describe, expect, it } from 'vitest';
import { layoutFromMedia, mediaFromSize, numberPadShown, PAD_WIDTH_LIMIT, PHONE_WIDTH_LIMIT, SCREEN_QUERIES, screenLayout, SIDE_HEIGHT_LIMIT } from './screen';

// Amendment 12 (FR-102, FR-104): the battle layout from the screen size, and when the number pad shows.
describe('screenLayout', () => {
  it.each([
    [1024, 768],
    [1180, 820],
    [1366, 1024],
    [1280, 720],
    [1920, 1080],
  ])('%i by %i is wide (iPad held sideways, desktop)', (w, h) => {
    expect(screenLayout(w, h)).toBe('wide');
  });

  it.each([
    [768, 1024],
    [820, 1180],
    [600, 900],
  ])('%i by %i is portrait (iPad held upright)', (w, h) => {
    expect(screenLayout(w, h)).toBe('portrait');
  });

  it.each([
    [844, 390],
    [932, 430],
    [667, 375],
  ])('%i by %i is side (phone held sideways)', (w, h) => {
    expect(screenLayout(w, h)).toBe('side');
  });

  it.each([
    [390, 844],
    [430, 932],
    [375, 667],
  ])('%i by %i is rotate (phone held upright)', (w, h) => {
    expect(screenLayout(w, h)).toBe('rotate');
  });

  it('counts a square screen as upright, as the CSS media feature orientation does (bug: iPhone rotation in Chrome)', () => {
    expect(screenLayout(800, 800)).toBe('portrait');
    expect(screenLayout(450, 450)).toBe('rotate');
  });

  it('uses the limits of data-model.md', () => {
    expect(PAD_WIDTH_LIMIT).toBe(1100);
    expect(PHONE_WIDTH_LIMIT).toBe(600);
    expect(SIDE_HEIGHT_LIMIT).toBe(500);
    expect(screenLayout(1000, SIDE_HEIGHT_LIMIT)).toBe('side');
    expect(screenLayout(1000, SIDE_HEIGHT_LIMIT + 1)).toBe('wide');
    expect(screenLayout(PHONE_WIDTH_LIMIT - 1, 900)).toBe('rotate');
  });
});

// Bug "iPhone rotation in Chrome" (Phase 24): the layout follows the CSS media queries, not innerWidth and innerHeight.
describe('layoutFromMedia', () => {
  it('upright and narrow is rotate, upright and wide is portrait, sideways and low is side, otherwise wide', () => {
    expect(layoutFromMedia({ portrait: true, phoneWidth: true, sideHeight: false })).toBe('rotate');
    expect(layoutFromMedia({ portrait: true, phoneWidth: false, sideHeight: false })).toBe('portrait');
    expect(layoutFromMedia({ portrait: false, phoneWidth: false, sideHeight: true })).toBe('side');
    expect(layoutFromMedia({ portrait: false, phoneWidth: false, sideHeight: false })).toBe('wide');
  });

  it('gives the same layout as the size rule for every example size', () => {
    for (const [w, h] of [[1024, 768], [768, 1024], [844, 390], [390, 844], [599, 900], [600, 900], [1000, 500], [1000, 501]] as const) {
      expect(layoutFromMedia(mediaFromSize(w, h, true))).toBe(screenLayout(w, h));
    }
  });

  it('uses media queries at the limits of data-model.md', () => {
    expect(SCREEN_QUERIES).toEqual({
      portrait: '(orientation: portrait)',
      phoneWidth: '(max-width: 599.98px)',
      sideHeight: '(max-height: 500px)',
      padWidth: '(max-width: 1099.98px)',
      finePointer: '(pointer: fine)',
    });
  });
});

describe('numberPadShown', () => {
  it('always and never ignore the device', () => {
    for (const finePointer of [true, false]) {
      for (const width of [390, 1024, 1920]) {
        expect(numberPadShown('always', { finePointer, padWidth: width < PAD_WIDTH_LIMIT })).toBe(true);
        expect(numberPadShown('never', { finePointer, padWidth: width < PAD_WIDTH_LIMIT })).toBe(false);
      }
    }
  });

  it('auto shows the pad without a fine pointer or on a screen narrower than 1100 px', () => {
    expect(numberPadShown('auto', { finePointer: false, padWidth: false })).toBe(true);
    expect(numberPadShown('auto', { finePointer: true, padWidth: true })).toBe(true);
    expect(numberPadShown('auto', { finePointer: true, padWidth: true })).toBe(true);
    expect(numberPadShown('auto', { finePointer: true, padWidth: false })).toBe(false);
    expect(numberPadShown('auto', { finePointer: true, padWidth: false })).toBe(false);
  });

  it('forced (a play mode without a ruler) makes auto show the pad on every device; always and never stay', () => {
    expect(numberPadShown('auto', { finePointer: true, padWidth: false }, true)).toBe(true);
    expect(numberPadShown('never', { finePointer: false, padWidth: true }, true)).toBe(false);
    expect(numberPadShown('always', { finePointer: true, padWidth: false }, true)).toBe(true);
  });
});
