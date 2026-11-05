/**
 * Mapping between numbers and world x (research R7, FR-015, FR-058).
 * The number line and the battlefield both use these functions, so a number sits at the same x on both.
 */
import { clamp } from '../util';

export interface Layout {
  worldWidth: number;
  /** World x of the range minimum. */
  left: number;
  /** World x of the range maximum. */
  right: number;
}

export const DEFAULT_LAYOUT: Readonly<Layout> = Object.freeze({ worldWidth: 1600, left: 80, right: 1520 });

export function numberToX(n: number, min: number, max: number, layout: Layout = DEFAULT_LAYOUT): number {
  if (n === min) return layout.left;
  if (n === max) return layout.right;
  return layout.left + ((n - min) / (max - min)) * (layout.right - layout.left);
}

/** Snaps to the nearest integer and clamps to [min, max]. */
export function xToNumber(x: number, min: number, max: number, layout: Layout = DEFAULT_LAYOUT): number {
  const n = Math.round(min + ((x - layout.left) / (layout.right - layout.left)) * (max - min));
  // `+ 0` turns -0 (from rounding values just below zero) into 0.
  return clamp(n, min, max) + 0;
}
