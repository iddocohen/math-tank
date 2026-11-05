/**
 * The zoomed ten for the help steps (FR-020, FR-031, amendment 02). It is only a help visual: the child never
 * selects through it. The renderer draws it with ticksFor(view, level, seed, { allLines: true }), so every unit
 * line is shown and labeled whatever the ruler level.
 */

/**
 * The ten-number interval that contains n, clamped to the range. A number on a multiple of ten starts its ten
 * (430 gives 430 to 440), except the range maximum, which shows the ten that ends there (780 gives 770 to 780).
 */
export function helpZoomView(n: number, min: number, max: number): { min: number; max: number } {
  let lo = Math.floor(n / 10) * 10;
  if (lo === n && n === max) lo -= 10;
  return { min: Math.max(lo, min) + 0, max: Math.min(lo + 10, max) + 0 };
}
