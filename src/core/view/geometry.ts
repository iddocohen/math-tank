/**
 * Engine-free geometry for the battle renderer (src/game). Kept here so it can be unit-tested.
 *
 * Physics coordinates: x to the right, y upward from the bottom of the world (terrain.ts).
 * Screen coordinates: x to the right, y downward from the top. Only toScreenY converts between them.
 */
import type { Heightmap, Point, ShotInFlight } from '../types';
import { STEP } from '../physics/ballistics';

export function toScreenY(y: number, worldHeight: number): number {
  return worldHeight - y;
}

/**
 * Outline of the ground in screen coordinates: bottom-left corner, the surface sampled every
 * `step` columns (always including the last column), bottom-right corner.
 */
export function terrainPolygon(t: Heightmap, worldHeight: number, step = 4): Point[] {
  const last = t.length - 1;
  const pts: Point[] = [{ x: 0, y: worldHeight }];
  if (last < 0) return [...pts, { x: 0, y: worldHeight }];
  for (let x = 0; ; x = Math.min(x + step, last)) {
    pts.push({ x, y: toScreenY(t[x] as number, worldHeight) });
    if (x === last) break;
  }
  pts.push({ x: last, y: worldHeight });
  return pts;
}

export interface PathSample {
  point: Point;
  /** Index of the path sample at or before the returned point. */
  index: number;
  done: boolean;
}

/**
 * Where a replayed shell is after `elapsedMs`. Path samples are STEP seconds apart in physics time;
 * `speed` scales playback (1 = real physics time).
 */
export function pathPointAt(path: readonly Point[], elapsedMs: number, speed: number): PathSample {
  const first = path[0];
  if (!first) return { point: { x: 0, y: 0 }, index: 0, done: true };
  const last = path.length - 1;
  const f = Math.max(0, (elapsedMs / 1000) * speed) / STEP;
  // The tolerance absorbs rounding, so elapsedMs === pathDuration(path, speed) always finishes.
  if (f >= last - 1e-6) {
    const end = path[last] as Point;
    return { point: { x: end.x, y: end.y }, index: last, done: true };
  }
  const i = Math.floor(f);
  const a = path[i] as Point;
  const b = path[i + 1] as Point;
  const s = f - i;
  return { point: { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s }, index: i, done: false };
}

/** Playback time in milliseconds for the whole path at `speed`. */
export function pathDuration(path: readonly Point[], speed: number): number {
  return (Math.max(0, path.length - 1) * STEP * 1000) / speed;
}

/**
 * Cannon angle that points from the muzzle to the pointer (both in physics coordinates),
 * clamped to 0..180. A pointer below the muzzle snaps to the horizontal on its side.
 * Null when the pointer is on the muzzle.
 */
export function aimAngleFromPointer(muzzle: Point, pointer: Point): number | null {
  const dx = pointer.x - muzzle.x;
  const dy = pointer.y - muzzle.y;
  if (dx === 0 && dy === 0) return null;
  if (dy < 0) return dx >= 0 ? 0 : 180;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** Cannon angle a path was fired at, from its first segment (physics convention); null if too short. */
export function launchAngle(path: readonly Point[]): number | null {
  const a = path[0];
  const b = path[1];
  if (!a || !b) return null;
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/** Dots at an even spacing along a path, for the faint trail of the previous shot (FR-004). */
export function dottedTrail(path: readonly Point[], spacing: number): Point[] {
  const first = path[0];
  if (!first) return [];
  const dots: Point[] = [{ x: first.x, y: first.y }];
  let carry = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] as Point;
    const b = path[i] as Point;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let d = spacing - carry;
    while (d <= len + 1e-9) {
      const s = len === 0 ? 0 : d / len;
      dots.push({ x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s });
      d += spacing;
    }
    carry = len - (d - spacing);
  }
  return dots;
}

export interface EdgeMarker {
  x: number;
  y: number;
  side: 'left' | 'right';
}

/** Where an out-of-bounds shell crossed the side edge (US1 scenario 6); null if it landed inside. */
export function edgeMarker(shot: Pick<ShotInFlight, 'outOfBounds' | 'impact'>, worldWidth: number): EdgeMarker | null {
  if (!shot.outOfBounds) return null;
  return { x: shot.impact.x, y: shot.impact.y, side: shot.impact.x >= worldWidth / 2 ? 'right' : 'left' };
}
