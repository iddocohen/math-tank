/** Minimum distances between tanks, in numbers on the line (FR-027, FR-010a). */
import { DEFAULT_LAYOUT, type Layout } from '../numberline/mapping';

/** Tank width in world units. */
export const TANK_WIDTH = 60;

/** 8% of the range width, and never less than one tank width (FR-027). */
export function minTankGap(min: number, max: number, layout: Layout = DEFAULT_LAYOUT): number {
  const tankWidthInNumbers = (TANK_WIDTH / (layout.right - layout.left)) * (max - min);
  return Math.max(0.08 * (max - min), tankWidthInNumbers);
}

/** The enemy stands at least 15% of the range width away from the player tank (FR-010a). */
export function minEnemyGap(min: number, max: number): number {
  return 0.15 * (max - min);
}
