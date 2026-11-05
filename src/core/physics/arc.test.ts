import { describe, expect, it } from 'vitest';
import { ARC_ANGLE_STEP_DEG, FIXED_ANGLE_DEG, MAX_ARC_ANGLE_DEG, solveArcToX, type ArcInput } from './arc';
import { generateTerrain, surfaceY } from './terrain';
import { medianMs } from './timing.testutil';
import { numberToX, xToNumber, DEFAULT_LAYOUT } from '../numberline/mapping';
import type { Heightmap } from '../types';

const W = 1600;
const H = 900;
const MUZZLE_ABOVE_GROUND = 28;

/** Elevation above the horizontal toward the shot direction, whatever the side. */
function elevation(angleDeg: number, towardRight: boolean): number {
  return towardRight ? angleDeg : 180 - angleDeg;
}

function unitWidth(min: number, max: number): number {
  return (DEFAULT_LAYOUT.right - DEFAULT_LAYOUT.left) / (max - min);
}

function inputFor(terrain: Heightmap, side: 'left' | 'right', n: number, min: number, max: number): ArcInput {
  const ox = numberToX(side === 'left' ? min : max, min, max);
  return {
    origin: { x: ox, y: surfaceY(terrain, ox) + MUZZLE_ABOVE_GROUND },
    targetX: numberToX(n, min, max),
    towardRight: side === 'left',
    terrain,
    worldWidth: W,
    worldHeight: H,
    tolerance: 0.25 * unitWidth(min, max),
  };
}

/** Flat ground at height 100 with a wall of the given top height over the columns [from, to]. */
function wallTerrain(from: number, to: number, top: number): Heightmap {
  const t = new Float32Array(W).fill(100);
  for (let x = from; x <= to; x++) t[x] = top;
  return t;
}

describe('solveArcToX (FR-004, FR-065, SC-012)', () => {
  it('uses the fixed constants 65, 85 and 5 degrees', () => {
    expect(FIXED_ANGLE_DEG).toBe(65);
    expect(MAX_ARC_ANGLE_DEG).toBe(85);
    expect(ARC_ANGLE_STEP_DEG).toBe(5);
  });

  it('starts at 65 degrees toward the enemy side for both player sides on open ground', () => {
    const terrain = new Float32Array(W).fill(150);
    for (const side of ['left', 'right'] as const) {
      const r = solveArcToX(inputFor(terrain, side, 50, 0, 100));
      expect(r.lifted).toBe(false);
      expect(elevation(r.angleDeg, side === 'left')).toBe(FIXED_ANGLE_DEG);
      // The path goes toward the enemy side.
      const dx = r.path[1]!.x - r.path[0]!.x;
      expect(side === 'left' ? dx > 0 : dx < 0).toBe(true);
    }
  });

  it('lands at every number of the ranges 0-10, 0-100 and 0-1000 on 5 seeded terrains', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const terrain = generateTerrain(seed, W, H);
      for (const [min, max] of [
        [0, 10],
        [0, 100],
        [0, 1000],
      ] as const) {
        const tol = 0.25 * unitWidth(min, max);
        for (const side of ['left', 'right'] as const) {
          for (let n = min; n <= max; n++) {
            const r = solveArcToX(inputFor(terrain, side, n, min, max));
            if (xToNumber(r.impact.x, min, max) !== n) throw new Error(`seed ${seed}, ${min}-${max}, ${side}, n ${n}: landed at ${xToNumber(r.impact.x, min, max)}`);
            if (Math.abs(r.impact.x - numberToX(n, min, max)) > tol) throw new Error(`seed ${seed}, ${min}-${max}, ${side}, n ${n}: off by ${r.impact.x - numberToX(n, min, max)}`);
            expect(r.path.at(-1)).toEqual(r.impact);
          }
        }
      }
    }
  });

  it('raises the angle in 5-degree steps, never above 85, when a tall hill blocks the 65-degree arc', () => {
    // Muzzle at x = 80, target at x = 380; a wall 110 units high stands 40 units before the target.
    const terrain = wallTerrain(335, 340, 210);
    const input: ArcInput = { origin: { x: 80, y: 128 }, targetX: 380, towardRight: true, terrain, worldWidth: W, worldHeight: H, tolerance: 0.36 };
    const r = solveArcToX(input);
    const e = elevation(r.angleDeg, true);
    expect(r.lifted).toBe(false);
    expect(e).toBeGreaterThan(FIXED_ANGLE_DEG);
    expect(e).toBeLessThanOrEqual(MAX_ARC_ANGLE_DEG);
    expect((e - FIXED_ANGLE_DEG) % ARC_ANGLE_STEP_DEG).toBe(0);
    expect(Math.abs(r.impact.x - 380)).toBeLessThanOrEqual(0.36);

    // The same wall mirrored, shooting to the left.
    const mirrored = wallTerrain(W - 1 - 340, W - 1 - 335, 210);
    const left = solveArcToX({ ...input, origin: { x: W - 1 - 80, y: 128 }, targetX: W - 1 - 380, towardRight: false, terrain: mirrored });
    expect(left.lifted).toBe(false);
    expect(elevation(left.angleDeg, false)).toBe(e);
  });

  it('returns a lifted arc over a wall that blocks every angle, ending on the surface at the target x', () => {
    const terrain = wallTerrain(355, 362, 800);
    const input: ArcInput = { origin: { x: 80, y: 128 }, targetX: 380, towardRight: true, terrain, worldWidth: W, worldHeight: H, tolerance: 0.36 };
    const r = solveArcToX(input);
    expect(r.lifted).toBe(true);
    expect(elevation(r.angleDeg, true)).toBe(MAX_ARC_ANGLE_DEG);
    expect(r.impact).toEqual({ x: 380, y: surfaceY(terrain, 380) });
    expect(r.path.at(-1)).toEqual(r.impact);
    expect(r.path[0]).toEqual(input.origin);
    for (const p of r.path) expect(p.y).toBeGreaterThanOrEqual(surfaceY(terrain, p.x) - 1e-6);
    // The arc passes over the wall top.
    const overWall = r.path.filter((p) => p.x >= 355 && p.x <= 362);
    for (const p of overWall) expect(p.y).toBeGreaterThan(800);
  });

  it('gives identical output for identical input', () => {
    const terrain = generateTerrain(9, W, H);
    const a = solveArcToX(inputFor(terrain, 'right', 37, 0, 100));
    const b = solveArcToX(inputFor(terrain, 'right', 37, 0, 100));
    expect(b).toEqual(a);
  });

  it('takes under 20 ms per call (slowest input, median of 5 calls each)', () => {
    const terrain = generateTerrain(11, W, H);
    const blocked = wallTerrain(355, 362, 800);
    // Warm up the JIT, then time every input.
    for (let n = 0; n <= 100; n += 10) solveArcToX(inputFor(terrain, 'left', n, 0, 100));
    // P5 (T302): the slowest single call failed when other test files kept every core busy. Each input now counts
    // with the median of 5 calls, which ignores a call slowed by the machine; the limit still holds for the slowest
    // input, so one input that got slow still fails.
    let slowest = 0;
    for (let n = 0; n <= 1000; n += 25) {
      const input = inputFor(terrain, n % 50 === 0 ? 'left' : 'right', n, 0, 1000);
      slowest = Math.max(slowest, medianMs(5, () => solveArcToX(input)));
    }
    const wall = { origin: { x: 80, y: 128 }, targetX: 380, towardRight: true, terrain: blocked, worldWidth: W, worldHeight: H, tolerance: 0.36 };
    slowest = Math.max(slowest, medianMs(5, () => solveArcToX(wall)));
    expect(slowest).toBeLessThan(20);
  });
});
