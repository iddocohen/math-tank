/**
 * Amendment 14 (T286, FR-077, FR-093, FR-109, FR-110): the tank drawing shared by the battle and the garage preview.
 * The antenna (flag) and the dome top (hat) stay where amendment 11 put them, for every garage look.
 */
import { describe, expect, it } from 'vitest';
import { MUZZLE_LENGTH, playerTankShapes, TANK_ANCHORS, tankBodyShapes, turretShapes } from './tankDrawing';
import { ANTENNA_FOOT, ANTENNA_TOP, ANTENNA_X, DOME_TOP, type Shape } from '../rewards/looks';
import { GARAGE_ITEMS, STANDARD_LOOK, type Look } from '../rewards/items';
import { tankShades } from './shade';
import { tankStyle } from './tankStyle';

function ys(s: Shape): number[] {
  switch (s.type) {
    case 'poly':
      return s.points.map(([, y]) => y);
    case 'circle':
      return [s.y - s.r, s.y + s.r];
    case 'line':
      return [s.from[1], s.to[1]];
  }
}

function xs(s: Shape): number[] {
  switch (s.type) {
    case 'poly':
      return s.points.map(([x]) => x);
    case 'circle':
      return [s.x - s.r, s.x + s.r];
    case 'line':
      return [s.from[0], s.to[0]];
  }
}

function colorsOf(shapes: Shape[]): Set<number> {
  const out = new Set<number>();
  for (const s of shapes) {
    if (s.type === 'line') out.add(s.color);
    else out.add(s.fill);
  }
  return out;
}

const LOOKS: Array<[string, Look]> = GARAGE_ITEMS.map((item) => [item.id, { ...STANDARD_LOOK, [item.kind]: item.id } as Look]);

describe('TANK_ANCHORS', () => {
  it('keeps the amendment 11 anchor points', () => {
    expect(TANK_ANCHORS).toEqual({ antennaX: -20, antennaFoot: 20, antennaTop: 64, domeTop: 28, turretPivot: 28 });
    expect(TANK_ANCHORS.antennaX).toBe(ANTENNA_X);
    expect(TANK_ANCHORS.antennaFoot).toBe(ANTENNA_FOOT);
    expect(TANK_ANCHORS.antennaTop).toBe(ANTENNA_TOP);
    expect(TANK_ANCHORS.domeTop).toBe(DOME_TOP);
  });
});

describe('playerTankShapes for every garage look', () => {
  it.each(LOOKS)('%s: the body tops out at the dome, the flag and hat stay at their anchors', (_id, look) => {
    const parts = playerTankShapes(look);
    expect(parts.anchors).toEqual(TANK_ANCHORS);
    expect(Math.max(...parts.body.flatMap(ys))).toBeCloseTo(TANK_ANCHORS.domeTop, 5);
    for (const s of parts.flag) {
      expect(Math.min(...xs(s))).toBeGreaterThanOrEqual(-19);
      expect(Math.max(...xs(s))).toBeLessThanOrEqual(3);
      expect(Math.min(...ys(s))).toBeGreaterThanOrEqual(49);
      expect(Math.max(...ys(s))).toBeLessThanOrEqual(64);
    }
    for (const s of parts.hat) expect(Math.min(...ys(s))).toBeGreaterThanOrEqual(25);
    // The antenna runs from its foot to its top at its x.
    expect(parts.antenna).toEqual([{ type: 'line', from: [ANTENNA_X, ANTENNA_FOOT], to: [ANTENNA_X, ANTENNA_TOP], width: 3, color: expect.any(Number) }]);
  });

  it('draws stripes only for dark blue with stripes', () => {
    const plain = playerTankShapes(STANDARD_LOOK).body.length;
    expect(playerTankShapes({ ...STANDARD_LOOK, color: 'navyStripes' }).body.length).toBeGreaterThan(plain);
    expect(playerTankShapes({ ...STANDARD_LOOK, color: 'sky' }).body.length).toBe(plain);
  });
});

describe('tankBodyShapes', () => {
  it('shades the rounded body with the base, highlight and shadow of its color', () => {
    const color = 0x2f7be8;
    const s = tankShades(color);
    const colors = colorsOf(tankBodyShapes('rounded', color));
    expect(colors.has(s.base)).toBe(true);
    expect(colors.has(s.highlight)).toBe(true);
    expect(colors.has(s.shadow)).toBe(true);
  });

  it('draws the enemy angular, with no circle, in the enemy shades', () => {
    const enemy = tankStyle('enemy').color;
    const shapes = tankBodyShapes('angular', enemy);
    const s = tankShades(enemy);
    expect(shapes.some((x) => x.type === 'circle')).toBe(false);
    const colors = colorsOf(shapes);
    expect(colors.has(s.base) && colors.has(s.highlight) && colors.has(s.shadow)).toBe(true);
  });

  it.each(['rounded', 'angular'] as const)('%s: the wheel spokes turn with the wheel angle and repeat after a quarter turn', (body) => {
    const at = (a: number) => JSON.stringify(tankBodyShapes(body, 0x2f7be8, a));
    expect(at(0.4)).not.toBe(at(0));
    expect(at(Math.PI / 2)).toBe(at(0));
  });
});

describe('turretShapes', () => {
  it('reaches the muzzle along the barrel', () => {
    expect(MUZZLE_LENGTH).toBe(38);
    const shapes = turretShapes(0x2f7be8);
    expect(Math.max(...shapes.flatMap(xs))).toBeCloseTo(MUZZLE_LENGTH, 5);
    expect(Math.min(...shapes.flatMap(xs))).toBeGreaterThanOrEqual(0);
  });
});
