import { describe, expect, it } from 'vitest';
import { carveCrater, FLOOR, generateTerrain, settleY, surfaceY } from './terrain';

const W = 1600;
const H = 900;

describe('generateTerrain', () => {
  it('gives the same heightmap for the same seed', () => {
    expect(Array.from(generateTerrain(42, W, H))).toEqual(Array.from(generateTerrain(42, W, H)));
  });

  it('gives a different heightmap for a different seed', () => {
    expect(Array.from(generateTerrain(1, W, H))).not.toEqual(Array.from(generateTerrain(2, W, H)));
  });

  it('has one height per column, inside the world and above the floor', () => {
    for (let seed = 0; seed < 50; seed++) {
      const t = generateTerrain(seed, W, H);
      expect(t.length).toBe(W);
      for (const h of t) {
        expect(h).toBeGreaterThan(FLOOR);
        expect(h).toBeLessThan(H);
      }
    }
  });

  it('uses a floor of 40 units', () => {
    expect(FLOOR).toBe(40);
  });
});

describe('carveCrater', () => {
  const flat = (height: number) => new Float32Array(W).fill(height);

  it('returns a new heightmap and leaves the input unchanged', () => {
    const t = flat(300);
    const out = carveCrater(t, 800, 300, 50, FLOOR);
    expect(out).not.toBe(t);
    expect(t.every((h) => h === 300)).toBe(true);
  });

  it('lowers heights inside the circle only', () => {
    const t = generateTerrain(7, W, H);
    const cx = 800;
    const cy = surfaceY(t, cx);
    const r = 60;
    const out = carveCrater(t, cx, cy, r, FLOOR);
    let lowered = 0;
    for (let x = 0; x < W; x++) {
      const before = t[x] as number;
      const after = out[x] as number;
      if (Math.abs(x - cx) >= r) {
        expect(after).toBe(before);
      } else {
        expect(after).toBeLessThanOrEqual(before);
        const bottom = cy - Math.sqrt(r * r - (x - cx) ** 2);
        expect(after).toBeGreaterThanOrEqual(Math.min(before, Math.max(bottom, FLOOR)) - 1e-3);
        if (after < before) lowered++;
      }
    }
    expect(lowered).toBeGreaterThan(0);
    // The center column drops to the bottom of the circle.
    expect(out[cx]).toBeCloseTo(cy - r, 3);
  });

  it('never goes below the floor, even when the crater reaches the bottom', () => {
    const t = flat(60);
    const out = carveCrater(t, 800, 60, 200, FLOOR);
    for (const h of out) expect(h).toBeGreaterThanOrEqual(FLOOR);
    expect(out[800]).toBe(FLOOR);
  });
});

describe('surfaceY', () => {
  it('interpolates linearly between columns', () => {
    const t = new Float32Array(10);
    t[3] = 100;
    t[4] = 200;
    expect(surfaceY(t, 3)).toBe(100);
    expect(surfaceY(t, 3.25)).toBeCloseTo(125, 5);
    expect(surfaceY(t, 3.5)).toBeCloseTo(150, 5);
  });

  it('clamps x to the world edges', () => {
    const t = new Float32Array([10, 20, 30]);
    expect(surfaceY(t, -5)).toBe(10);
    expect(surfaceY(t, 99)).toBe(30);
  });
});

describe('settleY', () => {
  it('rests a tank on the surface after a crater, neither floating nor buried', () => {
    const t = generateTerrain(3, W, H);
    const x = 500;
    const yBefore = settleY(t, x);
    expect(yBefore).toBeCloseTo(surfaceY(t, x), 5);
    const out = carveCrater(t, x + 10, yBefore, 50, FLOOR);
    const yAfter = settleY(out, x);
    expect(yAfter).toBeLessThan(yBefore);
    expect(yAfter).toBeCloseTo(surfaceY(out, x), 5);
  });

  it('keeps a tank on a crater floor that reaches the floor', () => {
    const t = new Float32Array(W).fill(80);
    const out = carveCrater(t, 400, 80, 120, FLOOR);
    expect(settleY(out, 400)).toBe(FLOOR);
  });
});
