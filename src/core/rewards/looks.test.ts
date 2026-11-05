import { describe, expect, it } from 'vitest';
import { GARAGE_ITEMS } from './items';
import type { ColorId, FlagId, HatId, TrailId } from './items';
import { colorStripes, flagShapes, hatShapes, tankColor, trailStyle, type Shape } from './looks';

const ENEMY_COLOR = 0xb3261e;

function hue(rgb: number): number {
  const r = ((rgb >> 16) & 255) / 255;
  const g = ((rgb >> 8) & 255) / 255;
  const b = (rgb & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function points(shape: Shape): Array<[number, number]> {
  switch (shape.type) {
    case 'poly':
      return shape.points;
    case 'circle':
      return [
        [shape.x - shape.r, shape.y - shape.r],
        [shape.x + shape.r, shape.y + shape.r],
      ];
    case 'line':
      return [shape.from, shape.to];
  }
}

const ids = <K extends string>(kind: string) => GARAGE_ITEMS.filter((i) => i.kind === kind).map((i) => i.id as K);

describe('tank colors (amendment 11, FR-077, FR-090)', () => {
  it('every color is blue or blue-green (hue 175 to 235) and differs from the enemy', () => {
    for (const id of ids<ColorId>('color')) {
      const c = tankColor(id);
      expect(hue(c), id).toBeGreaterThanOrEqual(175);
      expect(hue(c), id).toBeLessThanOrEqual(235);
      expect(c).not.toBe(ENEMY_COLOR);
    }
    expect(tankColor('blue')).toBe(0x2f7be8);
  });

  it('only dark blue with stripes has stripes', () => {
    expect(ids<ColorId>('color').filter(colorStripes)).toEqual(['navyStripes']);
  });
});

describe('flags and hats (FR-090, FR-093)', () => {
  it('every flag and every hat except none has shapes inside the tank drawing area', () => {
    const all: Array<[string, Shape[]]> = [
      ...ids<FlagId>('flag').map((id): [string, Shape[]] => [id, flagShapes(id)]),
      ...ids<HatId>('hat').filter((id) => id !== 'none').map((id): [string, Shape[]] => [id, hatShapes(id)]),
    ];
    for (const [id, shapes] of all) {
      expect(shapes.length, id).toBeGreaterThan(0);
      for (const [x, y] of shapes.flatMap(points)) {
        expect(x, id).toBeGreaterThanOrEqual(-60);
        expect(x, id).toBeLessThanOrEqual(60);
        expect(y, id).toBeGreaterThanOrEqual(0);
        expect(y, id).toBeLessThanOrEqual(110);
      }
    }
    expect(hatShapes('none')).toEqual([]);
  });

  it('each flag looks different', () => {
    const drawn = ids<FlagId>('flag').map((id) => JSON.stringify(flagShapes(id)));
    expect(new Set(drawn).size).toBe(drawn.length);
  });
});

describe('shell trails (FR-093)', () => {
  it('the plain trail has one line color and no dots; the others differ from it', () => {
    const plain = trailStyle('plain');
    expect(plain.line).toHaveLength(1);
    expect(plain.dots).toBe('none');
    for (const id of ids<TrailId>('trail').filter((t) => t !== 'plain')) {
      expect(JSON.stringify(trailStyle(id)), id).not.toBe(JSON.stringify(plain));
    }
    expect(trailStyle('rainbow').line.length).toBeGreaterThan(3);
    expect(trailStyle('sparkles').dots).toBe('sparkles');
    expect(trailStyle('bubbles').dots).toBe('bubbles');
  });
});
