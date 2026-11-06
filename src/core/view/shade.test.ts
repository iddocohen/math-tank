/**
 * Amendment 14 (T285, FR-109): tank shades and the contrast rule.
 *
 * The contrast rule uses the CIE76 color difference (Euclidean distance in CIE L*a*b*). A difference of about 2.3 is
 * just noticeable; at 30 two colors read as different colors at a glance, not as two shades of one. Every shade of
 * every garage color must keep that distance from every shade of the red enemy and from every ground color, so the
 * child's tank never blends into the enemy or the hills.
 */
import { describe, expect, it } from 'vitest';
import { deltaE76, GROUND_COLORS, lab, MIN_DELTA_E, mixColor, tankShades } from './shade';
import { tankColor } from '../rewards/looks';
import type { ColorId } from '../rewards/items';
import { tankStyle } from './tankStyle';

const GARAGE_COLORS: ColorId[] = ['blue', 'sky', 'teal', 'turquoise', 'navyStripes'];
const ENEMY = tankStyle('enemy').color;

function shadesOf(color: number): number[] {
  const s = tankShades(color);
  return [s.base, s.highlight, s.shadow];
}

/** The smallest difference between any shade of `color` and any shade of the enemy or any ground color. */
function smallestDifference(color: number, enemy: number): { enemy: number; ground: number } {
  let toEnemy = Infinity;
  let toGround = Infinity;
  for (const a of shadesOf(color)) {
    for (const b of shadesOf(enemy)) toEnemy = Math.min(toEnemy, deltaE76(a, b));
    for (const g of Object.values(GROUND_COLORS)) toGround = Math.min(toGround, deltaE76(a, g));
  }
  return { enemy: toEnemy, ground: toGround };
}

describe('mixColor', () => {
  it('gives the first color at 0 and the second at 1', () => {
    expect(mixColor(0x2f7be8, 0xffffff, 0)).toBe(0x2f7be8);
    expect(mixColor(0x2f7be8, 0xffffff, 1)).toBe(0xffffff);
    expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
  });
});

describe('deltaE76', () => {
  it('is 0 for the same color, symmetric, and above 100 for black and white', () => {
    expect(deltaE76(0x2f7be8, 0x2f7be8)).toBe(0);
    expect(deltaE76(0x2f7be8, ENEMY)).toBeCloseTo(deltaE76(ENEMY, 0x2f7be8), 10);
    expect(deltaE76(0x000000, 0xffffff)).toBeGreaterThan(99.9);
  });
});

describe('tankShades', () => {
  it.each([...GARAGE_COLORS.map((id) => tankColor(id)), ENEMY])('gives a lighter highlight and a darker shadow for %s', (color) => {
    const s = tankShades(color);
    expect(s.base).toBe(color);
    expect(lab(s.highlight)[0]).toBeGreaterThan(lab(s.base)[0] + 10);
    expect(lab(s.shadow)[0]).toBeLessThan(lab(s.base)[0] - 10);
  });

  it('keeps the enemy shades red', () => {
    for (const c of shadesOf(ENEMY)) expect(lab(c)[1]).toBeGreaterThan(30);
  });
});

describe('contrast of every garage color (FR-109)', () => {
  it('uses a limit of 30', () => {
    expect(MIN_DELTA_E).toBe(30);
  });

  it('lists the ground colors the child sees around the tanks', () => {
    expect(Object.keys(GROUND_COLORS).sort()).toEqual(['bedrock', 'dirt', 'grass', 'scorch', 'soil', 'tuft']);
    expect(GROUND_COLORS.dirt).toBe(0xad7d44);
  });

  it.each(GARAGE_COLORS)('%s keeps a clear difference to the enemy and to the ground', (id) => {
    const d = smallestDifference(tankColor(id), ENEMY);
    expect(d.enemy).toBeGreaterThanOrEqual(MIN_DELTA_E);
    expect(d.ground).toBeGreaterThanOrEqual(MIN_DELTA_E);
  });

  it('fails for a color close to the enemy, so the check can fail', () => {
    expect(smallestDifference(0xa8301e, ENEMY).enemy).toBeLessThan(MIN_DELTA_E);
  });
});
