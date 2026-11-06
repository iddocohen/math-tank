/** Amendment 14 (T288, FR-107, FR-108): scorch marks, pebbles, grass tufts and distant hills, all seeded. */
import { describe, expect, it } from 'vitest';
import { distantHills, pebbles, SCORCH_BORDER, scorchMarks, tufts } from './groundArt';

const W = 200;

function flat(h: number): Float32Array {
  return new Float32Array(W).fill(h);
}

describe('scorchMarks', () => {
  it('starts empty for a new landscape', () => {
    const marks = scorchMarks(null, flat(300), null);
    expect(marks.length).toBe(W);
    expect(marks.every((v) => v === 0)).toBe(true);
  });

  it('marks the lowered columns plus a border on each side, and keeps earlier marks', () => {
    expect(SCORCH_BORDER).toBe(6);
    const before = flat(300);
    const after = flat(300);
    for (let x = 50; x <= 60; x++) after[x] = 280;
    const marks = scorchMarks(before, after, scorchMarks(null, before, null));
    for (let x = 0; x < W; x++) expect(marks[x]).toBe(x >= 44 && x <= 66 ? 1 : 0);

    const again = flat(300);
    for (let x = 50; x <= 60; x++) again[x] = 280;
    for (let x = 150; x <= 152; x++) again[x] = 290;
    const more = scorchMarks(after, again, marks);
    expect(more[55]).toBe(1);
    expect(more[151]).toBe(1);
    expect(more[144]).toBe(1);
    expect(more[100]).toBe(0);
    // The earlier array is not changed.
    expect(marks[151]).toBe(0);
  });
});

describe('pebbles', () => {
  it('gives 8 to 16 pebbles inside the width, the same for the same seed', () => {
    const a = pebbles(7, 1600);
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(a.length).toBeLessThanOrEqual(16);
    for (const p of a) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1600);
      expect(p.depth).toBeGreaterThan(0);
      expect(p.rx).toBeGreaterThan(0);
    }
    expect(pebbles(7, 1600)).toEqual(a);
    expect(pebbles(8, 1600)).not.toEqual(a);
  });
});

describe('tufts', () => {
  it('gives a tuft about every 14 units, 6 to 14 units tall', () => {
    const t = tufts(7, 1600);
    expect(t.length).toBeGreaterThan(1600 / 14 - 10);
    expect(t.length).toBeLessThan(1600 / 14 + 10);
    for (const tuft of t) {
      expect(tuft.height).toBeGreaterThanOrEqual(6);
      expect(tuft.height).toBeLessThanOrEqual(14);
    }
    expect(tufts(7, 1600)).toEqual(t);
  });
});

describe('distantHills', () => {
  it('gives two layers between y 300 and 640, the far one higher and lighter', () => {
    const [far, near] = distantHills(7, 1600, 900);
    for (const layer of [far!, near!]) {
      expect(layer.points.length).toBeGreaterThan(10);
      for (const [x, y] of layer.points) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1600);
        expect(y).toBeGreaterThanOrEqual(300);
        expect(y).toBeLessThanOrEqual(640);
      }
    }
    const mean = (l: typeof far) => l!.points.reduce((s, [, y]) => s + y, 0) / l!.points.length;
    expect(mean(far)).toBeLessThan(mean(near));
    const lum = (c: number) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
    expect(lum(far!.color)).toBeGreaterThan(lum(near!.color));
    expect(distantHills(7, 1600, 900)).toEqual([far, near]);
    expect(distantHills(9, 1600, 900)).not.toEqual([far, near]);
  });
});
