import { describe, expect, it } from 'vitest';
import { STEP_MS_MAX, STEP_TOTAL_MS, stepFrames, stepMs } from './stepFrames';

describe('stepFrames (T082, FR-024, US3 scenarios 1 and 2)', () => {
  it('43 − 7 with beginner assistance: one frame per unit, counted 1 to 7, a stop at 40 and at 36', () => {
    const frames = stepFrames([43, 40, 36]);
    expect(frames.map((f) => f.value)).toEqual([42, 41, 40, 39, 38, 37, 36]);
    expect(frames.map((f) => f.count)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(frames.filter((f) => f.stop).map((f) => f.value)).toEqual([40, 36]);
  });

  it('24 + 8 moves right through 30 to 32', () => {
    const frames = stepFrames([24, 30, 32]);
    expect(frames.map((f) => f.value)).toEqual([25, 26, 27, 28, 29, 30, 31, 32]);
    expect(frames.filter((f) => f.stop).map((f) => f.value)).toEqual([30, 32]);
  });

  it('without beginner assistance only the result is a stop', () => {
    expect(stepFrames([43, 36]).filter((f) => f.stop).map((f) => f.value)).toEqual([36]);
  });

  it('52 − 4 − 9 with beginner assistance counts 13 steps and ends at 39', () => {
    const frames = stepFrames([52, 50, 48, 40, 39]);
    expect(frames).toHaveLength(13);
    expect(frames.at(-1)).toEqual({ value: 39, count: 13, stop: true });
  });

  it('a path with fewer than two numbers has no frames', () => {
    expect(stepFrames([])).toEqual([]);
    expect(stepFrames([5])).toEqual([]);
  });

  it('long paths step faster so the whole animation stays short', () => {
    expect(stepMs(7)).toBe(STEP_MS_MAX);
    expect(stepMs(230) * 230).toBeLessThanOrEqual(STEP_TOTAL_MS);
  });
});
