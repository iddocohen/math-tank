import { describe, expect, it } from 'vitest';
import { GRAVITY, MAX_SPEED, simulateShot, STEP } from './ballistics';
import { generateTerrain, surfaceY } from './terrain';

const W = 1600;
const H = 900;
const flat = new Float32Array(W).fill(200);
const base = { origin: { x: 200, y: 200 }, terrain: flat, worldWidth: W, worldHeight: H };

describe('simulateShot', () => {
  it('uses a fixed step of 1/120 s and constant gravity', () => {
    expect(STEP).toBe(1 / 120);
    const { path } = simulateShot({ ...base, angleDeg: 60, power: 50 });
    const speed = (MAX_SPEED * 50) / 100;
    const vx = speed * Math.cos((60 * Math.PI) / 180);
    expect(path.length).toBeGreaterThan(10);
    // Every point but the last (the refined impact) lies on the fixed step grid.
    for (let i = 1; i < path.length - 2; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      const c = path[i + 1]!;
      expect(b.x - a.x).toBeCloseTo(vx * STEP, 6);
      expect(c.y - 2 * b.y + a.y).toBeCloseTo(-GRAVITY * STEP * STEP, 6);
    }
  });

  it('gives identical paths for identical inputs', () => {
    const terrain = generateTerrain(11, W, H);
    const input = { ...base, terrain, origin: { x: 300, y: surfaceY(terrain, 300) + 10 }, angleDeg: 47, power: 63 };
    expect(simulateShot(input)).toEqual(simulateShot(input));
  });

  it('puts the impact on the terrain surface', () => {
    const terrain = generateTerrain(5, W, H);
    for (const [angleDeg, power] of [[30, 40], [45, 55], [70, 35], [120, 50]] as const) {
      const r = simulateShot({ ...base, terrain, origin: { x: 800, y: surfaceY(terrain, 800) + 10 }, angleDeg, power });
      expect(r.impact.x).toBeGreaterThan(0);
      expect(r.impact.x).toBeLessThan(W);
      expect(r.impact.y).toBeCloseTo(surfaceY(terrain, r.impact.x), 3);
      expect(r.path[r.path.length - 1]).toEqual(r.impact);
    }
  });

  it('stops a shell that leaves the right edge at the edge, in the air', () => {
    const r = simulateShot({ ...base, angleDeg: 45, power: 100 });
    expect(r.impact.x).toBe(W);
    expect(r.impact.y).toBeGreaterThan(surfaceY(flat, W));
  });

  it('stops a shell that leaves the left edge at the edge, in the air', () => {
    const r = simulateShot({ ...base, angleDeg: 135, power: 100 });
    expect(r.impact.x).toBe(0);
    expect(r.impact.y).toBeGreaterThan(surfaceY(flat, 0));
  });
});
