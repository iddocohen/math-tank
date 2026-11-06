/**
 * Fixed-step shell flight (research R6, FR-004).
 *
 * Coordinates as in terrain.ts: y grows upward. angleDeg follows the usual math convention:
 * 0 points right, 90 straight up, 180 left. Power 0..100 scales the launch speed up to MAX_SPEED.
 * Positions are computed in closed form at t = n * STEP, so the result does not depend on frame rate
 * and has no accumulated rounding drift. There is no ceiling: shells may fly above the world and fall back.
 */
import type { Heightmap, Point } from '../types';
import { clamp } from '../util';
import { surfaceY } from './terrain';

export const STEP = 1 / 120;
/** World units per second squared. */
export const GRAVITY = 500;
/** Launch speed at power 100, world units per second. */
export const MAX_SPEED = 1000;
/** Safety limit for one flight, in steps (30 s). */
const MAX_STEPS = 120 * 30;
const BISECTION_ITERATIONS = 30;

export interface ShotInput {
  origin: Point;
  angleDeg: number;
  power: number;
  terrain: Heightmap;
  worldWidth: number;
  worldHeight: number;
}

export interface ShotResult {
  path: Point[];
  impact: Point;
}

/**
 * The flight path and the impact point. The shell stops where it meets the ground, or at the world's edge (the aim
 * solver never chooses such a shot).
 */
export function simulateShot(input: ShotInput): ShotResult {
  const path: Point[] = [];
  const impact = trace(input, path);
  return { path, impact };
}

/** Flight without recording the path; used by the aim solver. */
export function traceImpact(input: ShotInput): Point {
  return trace(input, null);
}

function trace(input: ShotInput, path: Point[] | null): Point {
  const { origin, terrain, worldWidth } = input;
  const speed = (MAX_SPEED * clamp(input.power, 0, 100)) / 100;
  const rad = (input.angleDeg * Math.PI) / 180;
  const vx = speed * Math.cos(rad);
  const vy = speed * Math.sin(rad);
  const ox = origin.x;
  const oy = origin.y;
  const xAt = (t: number) => ox + vx * t;
  const yAt = (t: number) => oy + vy * t - 0.5 * GRAVITY * t * t;
  const top = maxHeight(terrain);

  let px = ox;
  let py = oy;
  path?.push({ x: px, y: py });

  for (let n = 1; n <= MAX_STEPS; n++) {
    const t0 = (n - 1) * STEP;
    const nx = xAt(n * STEP);
    const ny = yAt(n * STEP);

    // Earliest event within this step, as a fraction s of the step.
    let bestS = Infinity;
    let kind: 'terrain' | 'edge' | null = null;

    if (ny <= top && ny <= surfaceY(terrain, nx)) {
      bestS = terrainCrossing(terrain, xAt, yAt, t0, px, py);
      kind = 'terrain';
    }
    if (nx < 0 || nx > worldWidth) {
      const edge = nx < 0 ? 0 : worldWidth;
      const s = vx === 0 ? 0 : (edge - px) / (nx - px);
      if (s < bestS) {
        bestS = s;
        kind = 'edge';
      }
    }

    if (kind !== null) {
      let impact: Point;
      if (kind === 'terrain') {
        const x = clamp(xAt(t0 + bestS * STEP), 0, worldWidth);
        impact = { x, y: surfaceY(terrain, x) };
      } else {
        impact = { x: nx < 0 ? 0 : worldWidth, y: py + (ny - py) * bestS };
      }
      path?.push(impact);
      return impact;
    }

    path?.push({ x: nx, y: ny });
    px = nx;
    py = ny;
  }

  // Not reached with the current constants; land the shell where it is.
  const x = clamp(px, 0, worldWidth);
  const impact = { x, y: surfaceY(terrain, x) };
  path?.push(impact);
  return impact;
}

/** Fraction of the step at which the shell meets the surface; 0 if it starts the step below it. */
function terrainCrossing(
  terrain: Heightmap,
  xAt: (t: number) => number,
  yAt: (t: number) => number,
  t0: number,
  px: number,
  py: number,
): number {
  if (py <= surfaceY(terrain, px)) return 0;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < BISECTION_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    const t = t0 + mid * STEP;
    if (yAt(t) <= surfaceY(terrain, xAt(t))) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * Highest point of a heightmap. Heightmaps are never changed in place (see terrain.ts),
 * so the value is cached per heightmap object.
 */
const maxHeightCache = new WeakMap<Heightmap, number>();

function maxHeight(t: Heightmap): number {
  let top = maxHeightCache.get(t);
  if (top === undefined) {
    top = -Infinity;
    for (const h of t) if (h > top) top = h;
    maxHeightCache.set(t, top);
  }
  return top;
}
