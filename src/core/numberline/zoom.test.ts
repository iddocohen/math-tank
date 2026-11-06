import { describe, expect, it } from 'vitest';
import { helpZoomView } from './zoom';
import { ticksFor } from './ticks';

describe('helpZoomView (FR-020, FR-031, US9 scenario 6)', () => {
  it('returns the ten that contains the number', () => {
    expect(helpZoomView(437, 0, 1000)).toEqual({ min: 430, max: 440 });
    expect(helpZoomView(637, 550, 780)).toEqual({ min: 630, max: 640 });
    expect(helpZoomView(3, 0, 10)).toEqual({ min: 0, max: 10 });
    expect(helpZoomView(430, 0, 1000)).toEqual({ min: 430, max: 440 });
  });

  it('works for negative numbers', () => {
    expect(helpZoomView(-5, -20, 30)).toEqual({ min: -10, max: 0 });
    expect(helpZoomView(-13, -20, 30)).toEqual({ min: -20, max: -10 });
  });

  it('clamps a view at a range end to the range', () => {
    expect(helpZoomView(777, 550, 780)).toEqual({ min: 770, max: 780 });
    // The range end itself shows the ten that ends there.
    expect(helpZoomView(780, 550, 780)).toEqual({ min: 770, max: 780 });
    expect(helpZoomView(777, 555, 775)).toEqual({ min: 770, max: 775 });
    expect(helpZoomView(556, 555, 775)).toEqual({ min: 555, max: 560 });
    expect(helpZoomView(0, 0, 100)).toEqual({ min: 0, max: 10 });
  });

  it('with allLines every unit line of the zoomed view is visible and labeled at every ruler level (FR-018)', () => {
    for (const [n, min, max] of [
      [437, 0, 1000],
      [637, 550, 780],
      [3, 0, 10],
      [777, 555, 775],
    ] as const) {
      const view = helpZoomView(n, min, max);
      for (const level of [1, 2, 3, 4, 5] as const) {
        const { ticks } = ticksFor(view, level, { allLines: true });
        expect(ticks.map((t) => t.value)).toEqual(Array.from({ length: view.max - view.min + 1 }, (_, i) => view.min + i));
        expect(ticks.every((t) => t.labeled)).toBe(true);
      }
    }
  });
});
