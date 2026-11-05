/**
 * The player's fixed cannon and automatic arc (amendment 01, research R21, FR-004, FR-065).
 *
 * The cannon points up at 65 degrees toward the enemy side. For a chosen number the game finds the power
 * by bisection so the shell lands at that number's x. When the terrain blocks the arc, the angle rises in
 * 5-degree steps up to 85 degrees. When no angle works, the result is a lifted 85-degree arc over the highest
 * terrain between muzzle and target. Tanks are ignored in flight: damage follows the number, not the path.
 * Coordinates as in terrain.ts: y grows upward; angles as in ballistics.ts (0 right, 90 up, 180 left).
 */
import type { Heightmap, Point } from '../types';
import { simulateShot, traceImpact } from './ballistics';
import { surfaceY } from './terrain';

export const FIXED_ANGLE_DEG = 65;
export const MAX_ARC_ANGLE_DEG = 85;
export const ARC_ANGLE_STEP_DEG = 5;

/** Bisection steps per angle; 40 halvings of the power range are far finer than any tolerance in use. */
const POWER_ITERATIONS = 40;
/** Height of the lifted arc above the highest terrain point it must pass. */
const LIFT_MARGIN = 40;
/** Number of path segments of a lifted arc. */
const LIFTED_SEGMENTS = 120;

export interface ArcInput {
  /** The muzzle of the player's cannon. */
  origin: Point;
  targetX: number;
  towardRight: boolean;
  terrain: Heightmap;
  worldWidth: number;
  worldHeight: number;
  /** Largest allowed |impact.x - targetX|; the caller passes a quarter of one unit's width. */
  tolerance: number;
}

export interface ArcResult {
  /** Math convention: 65 toward the right is 65, toward the left 115. */
  angleDeg: number;
  power: number;
  path: Point[];
  impact: Point;
  /** True when no angle reached the target and the path is the lifted fallback arc. */
  lifted: boolean;
}

export function solveArcToX(input: ArcInput): ArcResult {
  const { origin, targetX, towardRight, terrain, worldWidth, worldHeight, tolerance } = input;
  const dir = towardRight ? 1 : -1;
  const end: Point = { x: targetX, y: surfaceY(terrain, targetX) };

  for (let elevation = FIXED_ANGLE_DEG; elevation <= MAX_ARC_ANGLE_DEG; elevation += ARC_ANGLE_STEP_DEG) {
    const angleDeg = towardRight ? elevation : 180 - elevation;
    // Signed distance past the target, measured in the shot direction.
    const overshoot = (power: number) => (traceImpact({ origin, angleDeg, power, terrain, worldWidth, worldHeight }).x - targetX) * dir;

    const power = findPower(overshoot, tolerance);
    if (power === null) continue;
    const r = simulateShot({ origin, angleDeg, power, terrain, targets: [], worldWidth, worldHeight });
    // Land exactly on the target x, so the landing number always equals the chosen number.
    const path = [...r.path.slice(0, -1), end];
    return { angleDeg, power, path, impact: end, lifted: false };
  }

  const angleDeg = towardRight ? MAX_ARC_ANGLE_DEG : 180 - MAX_ARC_ANGLE_DEG;
  return { angleDeg, power: 100, path: liftedPath(origin, end, terrain), impact: end, lifted: true };
}

/** The power whose impact is within the tolerance of the target, or null when this angle cannot reach it. */
function findPower(overshoot: (power: number) => number, tolerance: number): number | null {
  let lo = 0;
  const atLo = overshoot(lo);
  if (Math.abs(atLo) <= tolerance) return lo;
  if (atLo > 0) return null;
  let hi = 100;
  const atHi = overshoot(hi);
  if (Math.abs(atHi) <= tolerance) return hi;
  if (atHi < 0) return null;
  for (let i = 0; i < POWER_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    const d = overshoot(mid);
    if (Math.abs(d) <= tolerance) return mid;
    if (d < 0) lo = mid;
    else hi = mid;
  }
  // The impact jumps across the target (the shell hits a hill face below some power and clears it above).
  return null;
}

/**
 * A parabola y = top - k (s - s*)^2 over s in [0, 1] from the muzzle to the end point, with its top above
 * the highest terrain between them. The top rises until every path point is on or above the terrain.
 */
function liftedPath(origin: Point, end: Point, terrain: Heightmap): Point[] {
  const from = Math.max(0, Math.floor(Math.min(origin.x, end.x)));
  const to = Math.min(terrain.length - 1, Math.ceil(Math.max(origin.x, end.x)));
  let highest = Math.max(origin.y, end.y);
  for (let x = from; x <= to; x++) highest = Math.max(highest, terrain[x] as number);

  let top = highest + LIFT_MARGIN;
  let path = parabola(origin, end, top);
  for (let i = 0; i < 20 && !clearsTerrain(path, terrain); i++) {
    top += (top - Math.min(origin.y, end.y)) * 0.5;
    path = parabola(origin, end, top);
  }
  // Safety net for a terrain column steeper than any parabola: never draw the shell inside the ground.
  return path.map((p, i) => (i === 0 || i === path.length - 1 ? p : { x: p.x, y: Math.max(p.y, surfaceY(terrain, p.x)) }));
}

function parabola(origin: Point, end: Point, top: number): Point[] {
  const a = Math.sqrt(top - origin.y);
  const b = Math.sqrt(top - end.y);
  const sTop = a / (a + b);
  const k = (top - origin.y) / (sTop * sTop);
  const path: Point[] = [origin];
  for (let i = 1; i < LIFTED_SEGMENTS; i++) {
    const s = i / LIFTED_SEGMENTS;
    path.push({ x: origin.x + (end.x - origin.x) * s, y: top - k * (s - sTop) * (s - sTop) });
  }
  path.push(end);
  return path;
}

function clearsTerrain(path: Point[], terrain: Heightmap): boolean {
  for (let i = 1; i < path.length - 1; i++) {
    const p = path[i] as Point;
    if (p.y < surfaceY(terrain, p.x)) return false;
  }
  return true;
}

