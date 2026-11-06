/**
 * Pointer line geometry (amendment 04 item 5, FR-073, product owner clarification): a thin dashed vertical line from
 * the center of a visible tank down to the ruler, ending in a small triangle whose tip touches the ruler line.
 * It carries no number and highlights no ruler label: the child reads the number from the ruler. Screen
 * coordinates (y grows downward).
 */
import type { Point } from '../types';

/** Length of one dash, the gap between dashes, and the height (and half width) of the end triangle. */
export const POINTER_DASH = 10;
export const POINTER_GAP = 7;
export const POINTER_TRIANGLE = 10;

export interface PointerLine {
  dashes: Array<{ x: number; y0: number; y1: number }>;
  /** Left corner, right corner, tip on the ruler line. */
  triangle: [Point, Point, Point];
}

export function pointerLine(center: Point, axisY: number): PointerLine {
  const { x } = center;
  const top = axisY - POINTER_TRIANGLE;
  const dashes: PointerLine['dashes'] = [];
  for (let y = center.y; y < top; y += POINTER_DASH + POINTER_GAP) {
    dashes.push({ x, y0: y, y1: Math.min(y + POINTER_DASH, top) });
  }
  return {
    dashes,
    triangle: [
      { x: x - POINTER_TRIANGLE / 2, y: top },
      { x: x + POINTER_TRIANGLE / 2, y: top },
      { x, y: axisY },
    ],
  };
}
