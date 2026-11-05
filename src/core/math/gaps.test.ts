import { describe, expect, it } from 'vitest';
import { minEnemyGap, minTankGap, TANK_WIDTH } from './gaps';
import { DEFAULT_LAYOUT } from '../numberline/mapping';

const LINE_WIDTH = DEFAULT_LAYOUT.right - DEFAULT_LAYOUT.left;

describe('minimum gaps (FR-027, FR-010a)', () => {
  it('uses a 60-unit tank width', () => {
    expect(TANK_WIDTH).toBe(60);
  });

  for (const [min, max] of [
    [0, 10],
    [0, 20],
    [0, 100],
    [0, 1000],
    [-20, 30],
    [15, 20],
  ] as const) {
    it(`minTankGap for ${min}-${max} is max(8% of the range, one tank width in numbers)`, () => {
      const tankWidthInNumbers = (TANK_WIDTH / LINE_WIDTH) * (max - min);
      expect(minTankGap(min, max)).toBeCloseTo(Math.max(0.08 * (max - min), tankWidthInNumbers), 9);
      expect(minTankGap(min, max)).toBeGreaterThanOrEqual(tankWidthInNumbers);
    });

    it(`minEnemyGap for ${min}-${max} is 15% of the range`, () => {
      expect(minEnemyGap(min, max)).toBeCloseTo(0.15 * (max - min), 9);
    });
  }

  it('uses the tank width when a layout makes it larger than 8%', () => {
    const narrow = { worldWidth: 600, left: 0, right: 600 };
    // 60 / 600 * 100 = 10 numbers, more than 8.
    expect(minTankGap(0, 100, narrow)).toBeCloseTo(10, 9);
  });
});
