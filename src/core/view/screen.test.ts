import { describe, expect, it } from 'vitest';
import { numberPadShown, PAD_WIDTH_LIMIT, PHONE_WIDTH_LIMIT, screenLayout, SIDE_HEIGHT_LIMIT } from './screen';

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

  it('counts a square screen as wider than tall', () => {
    expect(screenLayout(800, 800)).toBe('wide');
    expect(screenLayout(450, 450)).toBe('side');
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

describe('numberPadShown', () => {
  it('always and never ignore the device', () => {
    for (const finePointer of [true, false]) {
      for (const width of [390, 1024, 1920]) {
        expect(numberPadShown('always', { finePointer, width })).toBe(true);
        expect(numberPadShown('never', { finePointer, width })).toBe(false);
      }
    }
  });

  it('auto shows the pad without a fine pointer or on a screen narrower than 1100 px', () => {
    expect(numberPadShown('auto', { finePointer: false, width: 1366 })).toBe(true);
    expect(numberPadShown('auto', { finePointer: true, width: 1099 })).toBe(true);
    expect(numberPadShown('auto', { finePointer: true, width: 844 })).toBe(true);
    expect(numberPadShown('auto', { finePointer: true, width: 1100 })).toBe(false);
    expect(numberPadShown('auto', { finePointer: true, width: 1280 })).toBe(false);
  });

  it('forced (a play mode without a ruler) makes auto show the pad on every device; always and never stay', () => {
    expect(numberPadShown('auto', { finePointer: true, width: 1280 }, true)).toBe(true);
    expect(numberPadShown('never', { finePointer: false, width: 390 }, true)).toBe(false);
    expect(numberPadShown('always', { finePointer: true, width: 1280 }, true)).toBe(true);
  });
});
