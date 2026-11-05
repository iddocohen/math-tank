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

/**
 * Comparison options stand at least this far apart: a tank stands at every option, so at least minTankGap
 * (amendment 10), and so the ruler markers of help step 2 stay apart, at least 2 numbers or 2% of the range width
 * (amendment 09, FR-027).
 */
export function minOptionGap(min: number, max: number, layout: Layout = DEFAULT_LAYOUT): number {
  return Math.max(minTankGap(min, max, layout), 2, Math.ceil(0.02 * (max - min)));
}
