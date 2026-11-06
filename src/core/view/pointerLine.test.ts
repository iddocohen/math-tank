import { describe, expect, it } from 'vitest';
import { POINTER_DASH, POINTER_GAP, POINTER_TRIANGLE, pointerLine } from './pointerLine';

describe('pointerLine (amendment 04 item 5, FR-073)', () => {
  const line = pointerLine({ x: 400, y: 300 }, 742);

  it('is a dashed vertical line from the tank center down to the ruler line', () => {
    expect(line.dashes.length).toBeGreaterThan(5);
    expect(line.dashes[0]!.y0).toBe(300);
    for (const d of line.dashes) {
      expect(d.x).toBe(400);
      expect(d.y1).toBeGreaterThan(d.y0);
      expect(d.y1 - d.y0).toBeLessThanOrEqual(POINTER_DASH);
    }
    // Gaps between the dashes make it dashed, not solid.
    for (let i = 1; i < line.dashes.length; i++) {
      expect(line.dashes[i]!.y0 - line.dashes[i - 1]!.y1).toBe(POINTER_GAP);
    }
    // The last dash stops where the triangle starts, above the ruler line.
    expect(line.dashes.at(-1)!.y1).toBeLessThanOrEqual(742 - POINTER_TRIANGLE);
  });

  it('ends in a small triangle whose tip touches the ruler line', () => {
    const [a, b, tip] = line.triangle;
    expect(tip).toEqual({ x: 400, y: 742 });
    expect(a.y).toBe(742 - POINTER_TRIANGLE);
    expect(b.y).toBe(742 - POINTER_TRIANGLE);
    expect(b.x - a.x).toBeLessThanOrEqual(2 * POINTER_TRIANGLE);
  });

  it('carries no number and no label: the child reads the number from the ruler', () => {
    expect(Object.keys(line).sort()).toEqual(['dashes', 'triangle']);
    expect(JSON.stringify(line)).not.toMatch(/label|text|number/i);
  });

  it('a tank center below the triangle start still gets the triangle and no dashes', () => {
    const short = pointerLine({ x: 10, y: 740 }, 742);
    expect(short.dashes).toEqual([]);
    expect(short.triangle[2]).toEqual({ x: 10, y: 742 });
  });
});
