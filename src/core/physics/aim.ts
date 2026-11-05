/**
 * Aim solver (research R19, FR-012). Searches every whole angle (1 degree) and power (1%) in the half
 * that faces the target: 0..90 degrees when the target is to the right, 90..180 when it is to the left.
 * Returns the shot whose impact on the terrain lands closest to the target.
 */
import type { Heightmap, Point } from '../types';
import { traceImpact } from './ballistics';

/** An impact within this distance of the target counts as a hit. */
export const HIT_TOLERANCE = 10;

export interface AimInput {
  origin: Point;
  target: Point;
  terrain: Heightmap;
  worldWidth: number;
  worldHeight: number;
}

export interface AimResult {
  angleDeg: number;
  power: number;
  hits: boolean;
  missDistance: number;
}

export function solveAim(input: AimInput): AimResult {
  const { origin, target, terrain, worldWidth, worldHeight } = input;
  const [fromAngle, toAngle] = target.x >= origin.x ? [0, 90] : [90, 180];
  let best: AimResult = { angleDeg: fromAngle, power: 0, hits: false, missDistance: Infinity };

  for (let angleDeg = fromAngle; angleDeg <= toAngle; angleDeg++) {
    for (let power = 0; power <= 100; power++) {
      const p = traceImpact({ origin, angleDeg, power, terrain, worldWidth, worldHeight });
      const d = Math.hypot(p.x - target.x, p.y - target.y);
      if (d < best.missDistance) best = { angleDeg, power, hits: false, missDistance: d };
    }
  }
  return { ...best, hits: best.missDistance <= HIT_TOLERANCE };
}
