/**
 * Fixed-step shell flight (research R6, FR-004).
 *
 * Coordinates as in terrain.ts: y grows upward. angleDeg follows the usual math convention:
 * 0 points right, 90 straight up, 180 left. Power 0..100 scales the launch speed up to MAX_SPEED.
 * Positions are computed in closed form at t = n * STEP, so the result does not depend on frame rate
 * and has no accumulated rounding drift. There is no ceiling: shells may fly above the world and fall back.
 */
import type { Heightmap, Point } from '../types';
import { surfaceY } from './terrain';

export const STEP = 1 / 120;
/** World units per second squared. */
export const GRAVITY = 500;
/** Launch speed at power 100, world units per second. */
export const MAX_SPEED = 1000;
/** Safety limit for one flight, in steps (30 s). */
const MAX_STEPS = 120 * 30;
const BISECTION_ITERATIONS = 30;

export interface ShotTarget {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export interface ShotInput {
  origin: Point;
  angleDeg: number;
  power: number;
  terrain: Heightmap;
  targets: ShotTarget[];
  worldWidth: number;
  worldHeight: number;
}

export interface ShotResult {
  path: Point[];
  impact: Point;
  hitTargetId: string | null;
  outOfBounds: boolean;
}

export function simulateShot(input: ShotInput): ShotResult {
  const path: Point[] = [];
  const r = trace(input, path);
  return { path, impact: r.impact, hitTargetId: r.hitTargetId, outOfBounds: r.outOfBounds };
}

/** Flight without recording the path; used by the aim solver. */
export function traceImpact(input: Omit<ShotInput, 'targets'> & { targets?: ShotTarget[] }): Point {
  return trace({ ...input, targets: input.targets ?? [] }, null).impact;
}

interface TraceResult {
  impact: Point;
  hitTargetId: string | null;
  outOfBounds: boolean;
}

function trace(input: ShotInput, path: Point[] | null): TraceResult {
  const { origin, terrain, targets, worldWidth } = input;
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
    let kind: 'terrain' | 'target' | 'edge' | null = null;
    let hitId: string | null = null;

    if (ny <= top && ny <= surfaceY(terrain, nx)) {
      bestS = terrainCrossing(terrain, xAt, yAt, t0, px, py);
      kind = 'terrain';
    }
    for (const target of targets) {
      const s = segmentCircleEntry(px, py, nx, ny, target);
      if (s !== null && s < bestS) {
        bestS = s;
        kind = 'target';
        hitId = target.id;
      }
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
      } else if (kind === 'target') {
        impact = { x: px + (nx - px) * bestS, y: py + (ny - py) * bestS };
      } else {
        impact = { x: nx < 0 ? 0 : worldWidth, y: py + (ny - py) * bestS };
      }
      path?.push(impact);
      return { impact, hitTargetId: kind === 'target' ? hitId : null, outOfBounds: kind === 'edge' };
    }

    path?.push({ x: nx, y: ny });
    px = nx;
    py = ny;
  }

  // Not reached with the current constants; land the shell where it is.
  const x = clamp(px, 0, worldWidth);
  const impact = { x, y: surfaceY(terrain, x) };
  path?.push(impact);
  return { impact, hitTargetId: null, outOfBounds: false };
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

/** Fraction along the segment (ax, ay) to (bx, by) where it first enters the circle, or null. */
function segmentCircleEntry(ax: number, ay: number, bx: number, by: number, c: ShotTarget): number | null {
  const fx = ax - c.x;
  const fy = ay - c.y;
  const r2 = c.radius * c.radius;
  if (fx * fx + fy * fy <= r2) return 0;
  const dx = bx - ax;
  const dy = by - ay;
  const qa = dx * dx + dy * dy;
  if (qa === 0) return null;
  const qb = 2 * (fx * dx + fy * dy);
  const qc = fx * fx + fy * fy - r2;
  const disc = qb * qb - 4 * qa * qc;
  if (disc < 0) return null;
  const s = (-qb - Math.sqrt(disc)) / (2 * qa);
  return s >= 0 && s <= 1 ? s : null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
