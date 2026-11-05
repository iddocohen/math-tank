import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, numberToX, xToNumber } from './mapping';

const RANGES: Array<[number, number]> = [
  [0, 10],
  [0, 20],
  [0, 50],
  [0, 100],
  [0, 1000],
  [-20, 30],
];

describe('number line mapping (FR-015, SC-004, AC-02)', () => {
  it('uses the default layout 1600 / 80 / 1520', () => {
    expect(DEFAULT_LAYOUT).toEqual({ worldWidth: 1600, left: 80, right: 1520 });
  });

  for (const [min, max] of RANGES) {
    describe(`range ${min}-${max}`, () => {
      it('round-trips every integer', () => {
        for (let n = min; n <= max; n++) expect(xToNumber(numberToX(n, min, max), min, max)).toBe(n);
      });

      it('gives equal x steps for equal value steps', () => {
        const step = numberToX(min + 1, min, max) - numberToX(min, min, max);
        for (let n = min; n < max; n++) {
          expect(numberToX(n + 1, min, max) - numberToX(n, min, max)).toBeCloseTo(step, 9);
        }
      });

      it('maps min to 80 and max to 1520', () => {
        expect(numberToX(min, min, max)).toBe(80);
        expect(numberToX(max, min, max)).toBe(1520);
      });

      it('clamps x outside the line to the range ends', () => {
        expect(xToNumber(0, min, max)).toBe(min);
        expect(xToNumber(1600, min, max)).toBe(max);
      });
    });
  }

  // The number-line marker and the battlefield use the same world x. A point on the battlefield
  // less than half a unit width from the marker must read back as the same number.
  for (const [min, max] of RANGES.filter(([a, b]) => b - a <= 100)) {
    it(`keeps marker and battlefield within half a unit for ${min}-${max}`, () => {
      const unit = (DEFAULT_LAYOUT.right - DEFAULT_LAYOUT.left) / (max - min);
      const offset = unit / 2 - 1e-6;
      for (let n = min; n <= max; n++) {
        const markerX = numberToX(n, min, max);
        if (n > min) expect(xToNumber(markerX - offset, min, max)).toBe(n);
        if (n < max) expect(xToNumber(markerX + offset, min, max)).toBe(n);
      }
    });
  }

  it('accepts a custom layout', () => {
    const layout = { worldWidth: 1000, left: 0, right: 1000 };
    expect(numberToX(5, 0, 10, layout)).toBe(500);
    expect(xToNumber(500, 0, 10, layout)).toBe(5);
  });
});
