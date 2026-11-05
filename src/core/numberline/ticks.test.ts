import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT } from './mapping';
import { smallestVisibleStep, ticksFor, typedNumberLabels, type RulerLevel, type Tick } from './ticks';

/** FR-016 width table (amended by amendment 02), written out independently of the implementation. */
function expectedSteps(min: number, max: number): { majorStep: number; minorStep: number } {
  const width = max - min;
  if (width <= 20) {
    const hasMultipleOfTen = Math.floor(max / 10) * 10 >= min;
    return { majorStep: width > 10 && hasMultipleOfTen ? 10 : 5, minorStep: 1 };
  }
  if (width <= 100) return { majorStep: 10, minorStep: 1 };
  if (width <= 400) return { majorStep: 50, minorStep: 10 };
  return { majorStep: 100, minorStep: 10 };
}

const LEVELS: RulerLevel[] = [1, 2, 3, 4, 5];
const isMultiple = (v: number, step: number) => ((v % step) + step) % step === 0;
const values = (ticks: Tick[]) => ticks.map((t) => t.value);
const isEnd = (t: Tick, v: { min: number; max: number }) => t.value === v.min || t.value === v.max;
/** Distance in logical units between two neighboring minor lines on the full-width ruler. */
const spacing = (view: { min: number; max: number }, step: number) =>
  (step / (view.max - view.min)) * (DEFAULT_LAYOUT.right - DEFAULT_LAYOUT.left);

describe('ticksFor step table (FR-016, SC-013)', () => {
  for (const offset of [0, 7, -13, 550, -1000, 9000]) {
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

  it('uses major 50 and minor 10 for 550 to 780 (width 230), with majors at 550 to 750', () => {
    const r = ticksFor({ min: 550, max: 780 }, 1, 1);
    expect(r.majorStep).toBe(50);
    expect(r.minorStep).toBe(10);
    expect(r.ticks.filter((t) => t.major).map((t) => t.value)).toEqual([550, 600, 650, 700, 750]);
    expect(r.ticks).toHaveLength(24);
  });

  it('uses major 50 and minor 10 up to width 400, and major 100 above', () => {
    expect(ticksFor({ min: 0, max: 400 }, 1, 1)).toMatchObject({ majorStep: 50, minorStep: 10 });
    expect(ticksFor({ min: 0, max: 401 }, 1, 1)).toMatchObject({ majorStep: 100, minorStep: 10 });
  });

  it('uses major 10 when the width is over 10 and the view includes a multiple of 10', () => {
    const r = ticksFor({ min: 0, max: 20 }, 1, 1);
    expect(r.majorStep).toBe(10);
    expect(r.ticks.filter((t) => t.major).map((t) => t.value)).toEqual([0, 10, 20]);
    expect(ticksFor({ min: 3, max: 17 }, 1, 1).majorStep).toBe(10);
  });

  it('on the 0 to 100 line, 30 and 40 are major and 31 to 39 minor, equally spaced (AC-03)', () => {
    const { ticks } = ticksFor({ min: 0, max: 100 }, 1, 1);
    const part = ticks.filter((t) => t.value >= 30 && t.value <= 40);
    expect(part.map((t) => t.value)).toEqual([30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40]);
    expect(part.filter((t) => t.major).map((t) => t.value)).toEqual([30, 40]);
  });

  it('in the zoomed view 30 to 40 at level 1, 30 and 40 are major with nine equally spaced lines between (US2 scenario 5)', () => {
    // FR-016 gives width 10 a major step of 5, so 35 is also major in this view.
    const { majorStep, minorStep, ticks } = ticksFor({ min: 30, max: 40 }, 1, 1);
    expect(minorStep).toBe(1);
    expect(majorStep).toBe(5);
    expect(values(ticks)).toEqual([30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40]);
    expect(ticks.every((t) => t.visible)).toBe(true);
    expect(ticks.find((t) => t.value === 30)?.major).toBe(true);
    expect(ticks.find((t) => t.value === 40)?.major).toBe(true);
    for (const v of [31, 32, 33, 34, 36, 37, 38, 39]) expect(ticks.find((t) => t.value === v)?.major).toBe(false);
  });

  it('keeps at most 101 ticks when both end points are off the minor grid', () => {
    const r = ticksFor({ min: -5, max: 995 }, 1, 1);
    expect(r.ticks.length).toBeLessThanOrEqual(101);
    expect(r.ticks[0]?.value).toBe(-5);
    expect(r.ticks[r.ticks.length - 1]?.value).toBe(995);
  });
});

describe('ticksFor ruler levels (FR-017, AC-03, US9 scenario 4)', () => {
  const views = [
    { min: 0, max: 10 },
    { min: 0, max: 20 },
    { min: 0, max: 50 },
    { min: 0, max: 100 },
    { min: 15, max: 45 },
    { min: 0, max: 150 },
    { min: 550, max: 780 },
    { min: 0, max: 1000 },
    { min: -20, max: 30 },
    { min: 7, max: 893 },
  ];

  for (const view of views) {
    const label = `${view.min} to ${view.max}`;

    it(`level 1 draws all lines and labels them all when there is room, else sets labelTypedNumber (${label})`, () => {
      const r = ticksFor(view, 1, 3);
      expect(r.ticks.every((t) => t.visible)).toBe(true);
      const roomy = spacing(view, r.minorStep) >= 28;
      expect(r.labelTypedNumber).toBe(!roomy);
      for (const t of r.ticks) expect(t.labeled).toBe(roomy || t.major || isEnd(t, view));
    });

    it(`level 2 draws all lines and labels only major lines and end points (${label})`, () => {
      const r = ticksFor(view, 2, 3);
      expect(r.labelTypedNumber).toBe(false);
      for (const t of r.ticks) {
        expect(t.visible).toBe(true);
        expect(t.labeled).toBe(t.major || isEnd(t, view));
      }
    });

    it(`level 3 draws all lines and labels the end points and a subset of major lines (${label})`, () => {
      for (let seed = 0; seed < 20; seed++) {
        const { ticks, labelTypedNumber } = ticksFor(view, 3, seed);
        expect(labelTypedNumber).toBe(false);
        const innerMajors = ticks.filter((t) => t.major && !isEnd(t, view));
        for (const t of ticks) {
          expect(t.visible).toBe(true);
          if (isEnd(t, view)) expect(t.labeled).toBe(true);
          else if (!t.major) expect(t.labeled).toBe(false);
        }
        const labeledMajors = innerMajors.filter((t) => t.labeled).length;
        expect(labeledMajors).toBeLessThanOrEqual(Math.floor(innerMajors.length / 2));
        if (innerMajors.length >= 2) expect(labeledMajors).toBeGreaterThan(0);
      }
    });

    it(`level 4 draws and labels major lines and end points, no minor lines (${label})`, () => {
      for (const t of ticksFor(view, 4, 3).ticks) {
        expect(t.visible).toBe(t.major || isEnd(t, view));
        expect(t.labeled).toBe(t.major || isEnd(t, view));
      }
    });

    it(`level 5 draws and labels only the end points (${label})`, () => {
      for (const t of ticksFor(view, 5, 3).ticks) {
        expect(t.visible).toBe(isEnd(t, view));
        expect(t.labeled).toBe(isEnd(t, view));
      }
    });

    it(`allLines makes every line visible and labeled at every level (${label})`, () => {
      for (const level of LEVELS) {
        const r = ticksFor(view, level, 3, { allLines: true });
        expect(r.labelTypedNumber).toBe(false);
        expect(r.ticks.every((t) => t.visible && t.labeled)).toBe(true);
        expect(values(r.ticks)).toEqual(values(ticksFor(view, 1, 3).ticks));
      }
    });
  }

  describe('typedNumberLabels: a crowded level 1 ruler labels only the typed number, once (T203, FR-017, FR-019)', () => {
    const wide = ticksFor({ min: 0, max: 100 }, 1, 1);

    it('typing 4 on 0 to 100 gives the single label 4 and none for the neighbouring lines 3 and 5', () => {
      expect(wide.labelTypedNumber).toBe(true);
      expect(typedNumberLabels(wide, 4, true)).toEqual([4]);
    });

    it('typing 45 gives only 45', () => {
      expect(typedNumberLabels(wide, 45, true)).toEqual([45]);
    });

    it('gives at most one label for every number of crowded rulers', () => {
      for (const view of [{ min: 0, max: 100 }, { min: 550, max: 780 }, { min: 0, max: 1000 }, { min: 7, max: 893 }]) {
        const r = ticksFor(view, 1, 2);
        if (!r.labelTypedNumber) continue;
        for (let n = view.min; n <= view.max; n++) {
          const labels = typedNumberLabels(r, n, true);
          expect(labels.length).toBeLessThanOrEqual(1);
          if (labels.length === 1) expect(labels).toEqual([n]);
        }
      }
    });

    it('gives no label for a number whose line already carries a label, so it is never drawn twice', () => {
      expect(typedNumberLabels(wide, 40, true)).toEqual([]);
      expect(typedNumberLabels(wide, 0, true)).toEqual([]);
      expect(typedNumberLabels(wide, 100, true)).toEqual([]);
    });

    it('gives no label while pointing, without a selection, or when the ruler has room for every label', () => {
      expect(typedNumberLabels(wide, 4, false)).toEqual([]);
      expect(typedNumberLabels(wide, null, true)).toEqual([]);
      expect(typedNumberLabels(ticksFor({ min: 0, max: 20 }, 1, 1), 7, true)).toEqual([]);
    });

    it('gives no label on levels 2 to 5', () => {
      for (const level of [2, 3, 4, 5] as const) expect(typedNumberLabels(ticksFor({ min: 0, max: 100 }, level, 1), 37, true)).toEqual([]);
    });
  });

  it('level 1 labels every minor line of 0 to 20 and sets labelTypedNumber for 0 to 100', () => {
    expect(ticksFor({ min: 0, max: 20 }, 1, 1)).toMatchObject({ labelTypedNumber: false });
    expect(ticksFor({ min: 0, max: 20 }, 1, 1).ticks.every((t) => t.labeled)).toBe(true);
    const wide = ticksFor({ min: 0, max: 100 }, 1, 1);
    expect(wide.labelTypedNumber).toBe(true);
    expect(wide.ticks.find((t) => t.value === 37)?.labeled).toBe(false);
    expect(wide.ticks.find((t) => t.value === 40)?.labeled).toBe(true);
  });

  it('level 3 chooses the major labels by seed, and the same seed gives the same labels', () => {
    const view = { min: 0, max: 100 };
    const labeled = (seed: number) =>
      ticksFor(view, 3, seed)
        .ticks.filter((t) => t.labeled && !isEnd(t, view))
        .map((t) => t.value);
    expect(labeled(5)).toEqual(labeled(5));
    const distinct = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((s) => labeled(s).join(',')));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('level 4 on 15 to 45 draws majors 20, 30, 40 and the end points', () => {
    const { ticks } = ticksFor({ min: 15, max: 45 }, 4, 1);
    expect(ticks.filter((t) => t.visible).map((t) => t.value)).toEqual([15, 20, 30, 40, 45]);
  });

  it('always draws and labels the end points, at every level, also for custom ranges', () => {
    for (const view of [...views, { min: 3, max: 8 }, { min: -1000, max: -995 }]) {
      for (const level of LEVELS) {
        const { ticks } = ticksFor(view, level, 9);
        expect(ticks[0]).toMatchObject({ value: view.min, visible: true, labeled: true });
        expect(ticks[ticks.length - 1]).toMatchObject({ value: view.max, visible: true, labeled: true });
      }
    }
  });
});

describe('smallestVisibleStep (FR-068)', () => {
  it('is the minor step on levels 1 to 3 and the major step on levels 4 and 5', () => {
    for (const [view, minor, major] of [
      [{ min: 0, max: 100 }, 1, 10],
      [{ min: 550, max: 780 }, 10, 50],
      [{ min: 0, max: 1000 }, 10, 100],
      [{ min: 0, max: 10 }, 1, 5],
    ] as const) {
      expect(smallestVisibleStep(view, 1)).toBe(minor);
      expect(smallestVisibleStep(view, 2)).toBe(minor);
      expect(smallestVisibleStep(view, 3)).toBe(minor);
      expect(smallestVisibleStep(view, 4)).toBe(major);
      expect(smallestVisibleStep(view, 5)).toBe(major);
    }
  });
});
