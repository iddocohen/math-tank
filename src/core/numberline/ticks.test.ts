import { describe, expect, it } from 'vitest';
import { ticksFor, type Tick } from './ticks';

/** FR-016 width table, written out independently of the implementation. */
function expectedSteps(min: number, max: number): { majorStep: number; minorStep: number } {
  const width = max - min;
  if (width <= 20) {
    const hasMultipleOfTen = Math.floor(max / 10) * 10 >= min;
    return { majorStep: width > 10 && hasMultipleOfTen ? 10 : 5, minorStep: 1 };
  }
  if (width <= 100) return { majorStep: 10, minorStep: 1 };
  if (width <= 200) return { majorStep: 50, minorStep: 10 };
  return { majorStep: 100, minorStep: 10 };
}

const isMultiple = (v: number, step: number) => ((v % step) + step) % step === 0;
const values = (ticks: Tick[]) => ticks.map((t) => t.value);

describe('ticksFor step table (FR-016)', () => {
  for (const offset of [0, 7, -13]) {
    it(`follows the width table for every width from 5 to 1000 (view starting at ${offset})`, () => {
      for (let width = 5; width <= 1000; width++) {
        const view = { min: offset, max: offset + width };
        const { majorStep, minorStep, ticks } = ticksFor(view, 1, 1);
        expect({ width, majorStep, minorStep }).toEqual({ width, ...expectedSteps(view.min, view.max) });
        expect(ticks.length, `width ${width}`).toBeLessThanOrEqual(101);
        // Ticks are sorted, unique and inside the view, with both end points present.
        const vs = values(ticks);
        expect(vs[0]).toBe(view.min);
        expect(vs[vs.length - 1]).toBe(view.max);
        for (let i = 1; i < vs.length; i++) expect(vs[i]!).toBeGreaterThan(vs[i - 1]!);
        // Grid ticks are equally spaced by the minor step.
        const grid = vs.filter((v) => isMultiple(v, minorStep));
        for (let i = 1; i < grid.length; i++) expect(grid[i]! - grid[i - 1]!).toBe(minorStep);
        // Major ticks are exactly the multiples of the major step.
        for (const t of ticks) expect(t.major).toBe(isMultiple(t.value, majorStep));
      }
    });
  }

  it('uses major 50 and minor 10 for a view of width 150', () => {
    const r = ticksFor({ min: 0, max: 150 }, 1, 1);
    expect(r.majorStep).toBe(50);
    expect(r.minorStep).toBe(10);
    expect(r.ticks.filter((t) => t.major).map((t) => t.value)).toEqual([0, 50, 100, 150]);
    expect(r.ticks).toHaveLength(16);
  });

  it('uses major 10 when the width is over 10 and the view includes a multiple of 10', () => {
    const r = ticksFor({ min: 0, max: 20 }, 1, 1);
    expect(r.majorStep).toBe(10);
    expect(r.ticks.filter((t) => t.major).map((t) => t.value)).toEqual([0, 10, 20]);
    expect(ticksFor({ min: 3, max: 17 }, 1, 1).majorStep).toBe(10);
  });

  it('uses major 5 for a width of 10 or less', () => {
    const r = ticksFor({ min: 0, max: 10 }, 1, 1);
    expect(r.majorStep).toBe(5);
    expect(r.ticks.filter((t) => t.major).map((t) => t.value)).toEqual([0, 5, 10]);
  });

  it('on the 0 to 100 line, 30 and 40 are major and 31 to 39 minor, equally spaced (AC-03)', () => {
    const { ticks } = ticksFor({ min: 0, max: 100 }, 1, 1);
    const part = ticks.filter((t) => t.value >= 30 && t.value <= 40);
    expect(part.map((t) => t.value)).toEqual([30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40]);
    expect(part.filter((t) => t.major).map((t) => t.value)).toEqual([30, 40]);
  });

  it('in the zoomed view 30 to 40, 30 and 40 are major and every number between has a tick', () => {
    // FR-016 gives width 10 a major step of 5, so 35 is also major in this view; see the decision note in the phase report.
    const { majorStep, minorStep, ticks } = ticksFor({ min: 30, max: 40 }, 1, 1);
    expect(minorStep).toBe(1);
    expect(majorStep).toBe(5);
    expect(values(ticks)).toEqual([30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40]);
    expect(ticks.find((t) => t.value === 30)?.major).toBe(true);
    expect(ticks.find((t) => t.value === 40)?.major).toBe(true);
    for (const v of [31, 32, 33, 34, 36, 37, 38, 39]) expect(ticks.find((t) => t.value === v)?.major).toBe(false);
  });

  it('places major ticks at 20, 30, 40 for the custom range 15 to 45', () => {
    const { ticks } = ticksFor({ min: 15, max: 45 }, 4, 1);
    expect(ticks.filter((t) => t.major).map((t) => t.value)).toEqual([20, 30, 40]);
    expect(ticks.filter((t) => t.labeled).map((t) => t.value)).toEqual([15, 45]);
  });

  it('keeps at most 101 ticks when both end points are off the minor grid', () => {
    const r = ticksFor({ min: -5, max: 995 }, 1, 1);
    expect(r.ticks.length).toBeLessThanOrEqual(101);
    expect(r.ticks[0]?.value).toBe(-5);
    expect(r.ticks[r.ticks.length - 1]?.value).toBe(995);
  });
});

describe('ticksFor labeling levels (FR-017)', () => {
  const views = [
    { min: 0, max: 10 },
    { min: 0, max: 20 },
    { min: 0, max: 100 },
    { min: 15, max: 45 },
    { min: 0, max: 150 },
    { min: 0, max: 1000 },
    { min: -20, max: 30 },
    { min: 7, max: 893 },
  ];
  const isEnd = (t: Tick, v: { min: number; max: number }) => t.value === v.min || t.value === v.max;

  for (const view of views) {
    const label = `${view.min} to ${view.max}`;

    it(`level 1 labels all ticks (${label})`, () => {
      expect(ticksFor(view, 1, 3).ticks.every((t) => t.labeled)).toBe(true);
    });

    it(`level 2 labels only major ticks and the end points (${label})`, () => {
      for (const t of ticksFor(view, 2, 3).ticks) expect(t.labeled).toBe(t.major || isEnd(t, view));
    });

    it(`level 3 labels major ticks and at most half of the minor ticks (${label})`, () => {
      for (let seed = 0; seed < 20; seed++) {
        const { ticks } = ticksFor(view, 3, seed);
        const minor = ticks.filter((t) => !t.major && !isEnd(t, view));
        for (const t of ticks) if (t.major || isEnd(t, view)) expect(t.labeled).toBe(true);
        expect(minor.filter((t) => t.labeled).length).toBeLessThanOrEqual(Math.floor(minor.length / 2));
      }
    });

    it(`level 4 labels only the end points (${label})`, () => {
      for (const t of ticksFor(view, 4, 3).ticks) expect(t.labeled).toBe(isEnd(t, view));
    });
  }

  it('level 3 chooses the minor labels by seed, and the same seed gives the same labels', () => {
    const view = { min: 0, max: 100 };
    const labeled = (seed: number) =>
      ticksFor(view, 3, seed)
        .ticks.filter((t) => t.labeled && !t.major)
        .map((t) => t.value);
    expect(labeled(5)).toEqual(labeled(5));
    expect(labeled(5).length).toBeGreaterThan(0);
    const distinct = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((s) => labeled(s).join(',')));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('always labels the end points, at every level, also for custom ranges', () => {
    for (const view of [...views, { min: 15, max: 45 }, { min: 3, max: 8 }]) {
      for (const level of [1, 2, 3, 4] as const) {
        const { ticks } = ticksFor(view, level, 9);
        expect(ticks[0]).toMatchObject({ value: view.min, labeled: true });
        expect(ticks[ticks.length - 1]).toMatchObject({ value: view.max, labeled: true });
      }
    }
  });
});
