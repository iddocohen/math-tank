/**
 * Frames of the step animation for addition and subtraction (T082, FR-024): the marker moves one unit per frame
 * from the starting number along the stops of stepPath, and each frame counts one step. A stop is a ten boundary
 * (in beginner assistance), the intermediate result of a two-step exercise, or the result; the marker pauses there.
 */

export interface StepFrame {
  /** The number the marker stands on after this step. */
  value: number;
  /** Steps counted so far, 1 for the first step. */
  count: number;
  /** The marker pauses here: a stop of the path. */
  stop: boolean;
}

/** Longest time per unit step, for short exercises. */
export const STEP_MS_MAX = 260;
/** Longest time for all unit steps together, so a large operand still animates quickly. */
export const STEP_TOTAL_MS = 6000;

export function stepFrames(path: readonly number[]): StepFrame[] {
  const frames: StepFrame[] = [];
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]!;
    const to = path[i]!;
    const dir = Math.sign(to - from);
    for (let v = from + dir; dir !== 0 && v !== to + dir; v += dir) {
      frames.push({ value: v, count: frames.length + 1, stop: v === to });
    }
  }
  return frames;
}

/** Milliseconds per unit step for an animation of `units` steps. */
export function stepMs(units: number): number {
  return Math.min(STEP_MS_MAX, Math.floor(STEP_TOTAL_MS / Math.max(1, units)));
}
