import { describe, expect, it } from 'vitest';
import { numberToX } from './mapping';
import {
  LABEL_GAP,
  LARGE_LABEL_GAP,
  MIN_LABEL_SPACING,
  labelFontSize,
  labelWidth,
  ticksFor,
  typedNumberLabels,
  type RulerLevel,
  type Tick,
} from './ticks';

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

/** A large label: a major line or an end point (T217). */
const isLarge = (t: Tick, v: { min: number; max: number }) => t.major || isEnd(t, v);

/**
 * No two labels in the same row are closer than MIN_LABEL_SPACING (center to center), and their estimated text
 * widths keep at least LABEL_GAP between them (T217); a small label and a large label keep LARGE_LABEL_GAP (T231).
 */
function expectRowsApart(view: { min: number; max: number }, r: ReturnType<typeof ticksFor>): void {
  for (const row of [0, 1]) {
    const inRow = r.ticks
      .filter((t) => t.labeled && t.row === row)
      .map((t) => ({ t, x: numberToX(t.value, view.min, view.max) + t.shift, w: labelWidth(t.value, labelFontSize(t, r.labelRows, view)) }))
      .sort((a, b) => a.x - b.x);
    for (let i = 1; i < inRow.length; i++) {
      const a = inRow[i - 1]!;
      // (T231) the gap between a small and a large label is checked with LARGE_LABEL_GAP.
      const b = inRow[i]!;
      expect(b.x - a.x, `${a.t.value} and ${b.t.value} in row ${row}`).toBeGreaterThanOrEqual(MIN_LABEL_SPACING - 1e-9);
      const gap = isLarge(a.t, view) !== isLarge(b.t, view) && r.labelRows === 2 ? LARGE_LABEL_GAP : LABEL_GAP;
      expect(b.x - a.x - (a.w + b.w) / 2, `${a.t.value} and ${b.t.value} in row ${row}`).toBeGreaterThanOrEqual(gap - 1e-9);
    }
  }
}

/**
 * Level 1 (T217, T231): every line is labeled, except a small label that has room in neither row only because of a
 * large label next to it; that one stays without a label and its line is still drawn.
 */
function expectLabeledOrBesideLarge(view: { min: number; max: number }, r: ReturnType<typeof ticksFor>): void {
  const x = (t: Tick) => numberToX(t.value, view.min, view.max) + t.shift;
  const w = (t: Tick) => labelWidth(t.value, labelFontSize(t, r.labelRows, view));
  const large = r.ticks.filter((t) => isLarge(t, view));
  for (const t of r.ticks) {
    if (t.labeled) continue;
    expect(r.labelRows, `${t.value} unlabeled with one row`).toBe(2);
    expect(isLarge(t, view)).toBe(false);
    const crowded = large.some((l) => Math.abs(x(l) - numberToX(t.value, view.min, view.max)) < (w(l) + w(t)) / 2 + LARGE_LABEL_GAP);
    expect(crowded, `${t.value} unlabeled but not beside a large label`).toBe(true);
  }
}

describe('ticksFor step table (FR-016, SC-013)', () => {
  for (const offset of [0, 7, -13, 550, -1000, 9000]) {
    it(`follows the width table for every width from 5 to 1000 (view starting at ${offset})`, () => {
      for (let width = 5; width <= 1000; width++) {
        const view = { min: offset, max: offset + width };
        const { majorStep, minorStep, ticks } = ticksFor(view, 1);
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
    const r = ticksFor({ min: 550, max: 780 }, 1);
    expect(r.majorStep).toBe(50);
    expect(r.minorStep).toBe(10);
    expect(r.ticks.filter((t) => t.major).map((t) => t.value)).toEqual([550, 600, 650, 700, 750]);
    expect(r.ticks).toHaveLength(24);
  });

  it('uses major 50 and minor 10 up to width 400, and major 100 above', () => {
    expect(ticksFor({ min: 0, max: 400 }, 1)).toMatchObject({ majorStep: 50, minorStep: 10 });
    expect(ticksFor({ min: 0, max: 401 }, 1)).toMatchObject({ majorStep: 100, minorStep: 10 });
  });

  it('uses major 10 when the width is over 10 and the view includes a multiple of 10', () => {
    const r = ticksFor({ min: 0, max: 20 }, 1);
    expect(r.majorStep).toBe(10);
    expect(r.ticks.filter((t) => t.major).map((t) => t.value)).toEqual([0, 10, 20]);
    expect(ticksFor({ min: 3, max: 17 }, 1).majorStep).toBe(10);
  });

  it('on the 0 to 100 line, 30 and 40 are major and 31 to 39 minor, equally spaced (AC-03)', () => {
    const { ticks } = ticksFor({ min: 0, max: 100 }, 1);
    const part = ticks.filter((t) => t.value >= 30 && t.value <= 40);
    expect(part.map((t) => t.value)).toEqual([30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40]);
    expect(part.filter((t) => t.major).map((t) => t.value)).toEqual([30, 40]);
  });

  it('in the zoomed view 30 to 40 at level 1, 30 and 40 are major with nine equally spaced lines between (US2 scenario 5)', () => {
    // FR-016 gives width 10 a major step of 5, so 35 is also major in this view.
    const { majorStep, minorStep, ticks } = ticksFor({ min: 30, max: 40 }, 1);
    expect(minorStep).toBe(1);
    expect(majorStep).toBe(5);
    expect(values(ticks)).toEqual([30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40]);
    expect(ticks.find((t) => t.value === 30)?.major).toBe(true);
    expect(ticks.find((t) => t.value === 40)?.major).toBe(true);
    for (const v of [31, 32, 33, 34, 36, 37, 38, 39]) expect(ticks.find((t) => t.value === v)?.major).toBe(false);
  });

  it('keeps at most 101 ticks when both end points are off the minor grid', () => {
    const r = ticksFor({ min: -5, max: 995 }, 1);
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

    it(`level 1 draws all lines and labels every line in one or two rows, else falls back to the typed number (${label})`, () => {
      const r = ticksFor(view, 1);
      if (r.labelTypedNumber) {
        for (const t of r.ticks) expect(t.labeled).toBe(t.major || isEnd(t, view));
      } else {
        expectLabeledOrBesideLarge(view, r);
        expectRowsApart(view, r);
      }
    });

    it(`level 2 draws all lines and labels only major lines and end points (${label})`, () => {
      const r = ticksFor(view, 2);
      expect(r.labelTypedNumber).toBe(false);
      for (const t of r.ticks) {
        expect(t.labeled).toBe(t.major || isEnd(t, view));
      }
    });

    it(`every level draws every line of level 1, with the same sizes, medium lines included (amendment 20) (${label})`, () => {
      const all = ticksFor(view, 1).ticks;
      for (const level of LEVELS) {
        const r = ticksFor(view, level);
        expect(values(r.ticks)).toEqual(values(all));
        expect(r.ticks.map((t) => t.size)).toEqual(all.map((t) => t.size));
      }
    });

    it(`level 3 labels the major lines at multiples of twice the major step and both end points (amendment 20) (${label})`, () => {
      const { majorStep } = expectedSteps(view.min, view.max);
      const expected = (t: Tick) => isEnd(t, view) || (t.major && isMultiple(t.value, 2 * majorStep));
      const { ticks, labelTypedNumber } = ticksFor(view, 3);
      expect(labelTypedNumber).toBe(false);
      for (const t of ticks) expect(t.labeled, `${t.value}`).toBe(expected(t));
    });

    it(`level 4 labels both end points and the middle major line (amendment 20) (${label})`, () => {
      const inner = ticksFor(view, 1).ticks.filter((t) => t.major && !isEnd(t, view)).map((t) => t.value);
      const mid = (view.min + view.max) / 2;
      const middle = inner.reduce<number | undefined>((best, v) => (best === undefined || Math.abs(v - mid) < Math.abs(best - mid) ? v : best), undefined);
      for (const t of ticksFor(view, 4).ticks) expect(t.labeled, `${t.value}`).toBe(isEnd(t, view) || t.value === middle);
    });

    it(`level 5 labels only the end points and still draws every line (amendment 20) (${label})`, () => {
      const r = ticksFor(view, 5);
      expect(r.ticks.length).toBe(ticksFor(view, 1).ticks.length);
      for (const t of r.ticks) {
        expect(t.labeled).toBe(isEnd(t, view));
      }
    });

    it(`allLines makes every line visible and labeled at every level (${label})`, () => {
      for (const level of LEVELS) {
        const r = ticksFor(view, level, { allLines: true });
        expect(r.labelTypedNumber).toBe(false);
        expect(r.ticks.every((t) => t.labeled)).toBe(true);
        expect(values(r.ticks)).toEqual(values(ticksFor(view, 1).ticks));
      }
    });
  }

  describe('typedNumberLabels: a crowded level 1 ruler labels only the typed number, once (T203, FR-017, FR-019)', () => {
    const wide = ticksFor({ min: 0, max: 1000 }, 1);

    it('typing 430 on 0 to 1000 gives the single label 430 and none for the neighbouring lines 420 and 440', () => {
      expect(wide.labelTypedNumber).toBe(true);
      expect(typedNumberLabels(wide, 430, true)).toEqual([430]);
    });

    it('typing 437 gives only 437', () => {
      expect(typedNumberLabels(wide, 437, true)).toEqual([437]);
    });

    it('gives at most one label for every number of crowded rulers', () => {
      for (const view of [{ min: 0, max: 100 }, { min: 550, max: 780 }, { min: 0, max: 1000 }, { min: 7, max: 893 }]) {
        const r = ticksFor(view, 1);
        if (!r.labelTypedNumber) continue;
        for (let n = view.min; n <= view.max; n++) {
          const labels = typedNumberLabels(r, n, true);
          expect(labels.length).toBeLessThanOrEqual(1);
          if (labels.length === 1) expect(labels).toEqual([n]);
        }
      }
    });

    it('gives no label for a number whose line already carries a label, so it is never drawn twice', () => {
      expect(typedNumberLabels(wide, 400, true)).toEqual([]);
      expect(typedNumberLabels(wide, 0, true)).toEqual([]);
      expect(typedNumberLabels(wide, 1000, true)).toEqual([]);
    });

    it('gives no label while pointing, without a selection, or when the ruler has room for every label', () => {
      expect(typedNumberLabels(wide, 430, false)).toEqual([]);
      expect(typedNumberLabels(wide, null, true)).toEqual([]);
      expect(typedNumberLabels(ticksFor({ min: 0, max: 20 }, 1), 7, true)).toEqual([]);
      expect(typedNumberLabels(ticksFor({ min: 0, max: 100 }, 1), 37, true)).toEqual([]);
    });

    it('gives no label on levels 2 to 5', () => {
      for (const level of [2, 3, 4, 5] as const) expect(typedNumberLabels(ticksFor({ min: 0, max: 100 }, level), 37, true)).toEqual([]);
    });
  });

  it('level 1 labels every minor line of 0 to 20 in one row with the normal minor font', () => {
    const r = ticksFor({ min: 0, max: 20 }, 1);
    expect(r).toMatchObject({ labelTypedNumber: false, labelRows: 1 });
    expect(r.ticks.every((t) => t.labeled && t.row === 0)).toBe(true);
  });

  it('level 1 on 0 to 100 labels the numbers in two staggered rows, leaving out the small labels crowding a large one (T217, T231, FR-017)', () => {
    const view = { min: 0, max: 100 };
    const r = ticksFor(view, 1);
    expect(r.labelTypedNumber).toBe(false);
    expect(r.labelRows).toBe(2);
    const labeled = r.ticks.filter((t) => t.labeled).map((t) => t.value);
    // 28 and 32 sit in the first row two units from 30: too close to its large label (P4), so they stay unlabeled.
    const besideMajor = [12, 18, 22, 28, 32, 38, 42, 48, 52, 58, 62, 68, 72, 78, 82, 88, 92];
    expect(labeled).toEqual(Array.from({ length: 101 }, (_, i) => i).filter((v) => !besideMajor.includes(v)));
    // Major lines and end points keep the large font in the first row; minor labels are smaller.
    for (const t of r.ticks) {
      if (t.major) {
        expect(t.row).toBe(0);
        expect(labelFontSize(t, r.labelRows, view)).toBe(26);
      } else expect(labelFontSize(t, r.labelRows, view)).toBeLessThan(20);
    }
    // Neighbouring numbers are never in the same row.
    for (let i = 1; i < r.ticks.length; i++) expect(r.ticks[i]!.row).not.toBe(r.ticks[i - 1]!.row);
    expectRowsApart(view, r);
  });

  it('level 2 on 0 to 100 labels only the major lines, in one row', () => {
    const r = ticksFor({ min: 0, max: 100 }, 2);
    expect(r.labelRows).toBe(1);
    expect(r.ticks.filter((t) => t.labeled).map((t) => t.value)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it('level 1 falls back to the typed number only when two rows do not fit (0 to 1000)', () => {
    const r = ticksFor({ min: 0, max: 1000 }, 1);
    expect(r.labelTypedNumber).toBe(true);
    expect(r.ticks.filter((t) => t.labeled).every((t) => t.major || t.value === 0 || t.value === 1000)).toBe(true);
  });

  it('level 1 labels every line or falls back, never overlapping, for every width from 5 to 1000', () => {
    for (let width = 5; width <= 1000; width += 1) {
      for (const min of [0, -7, 550]) {
        const view = { min, max: min + width };
        const r = ticksFor(view, 1);
        if (r.labelTypedNumber) continue;
        expectLabeledOrBesideLarge(view, r);
        expectRowsApart(view, r);
      }
    }
  });

  it('labels per level on the presets and on 550 to 780 match the amendment 20 table', () => {
    const labels = (view: { min: number; max: number }, level: RulerLevel) =>
      ticksFor(view, level)
        .ticks.filter((t) => t.labeled)
        .map((t) => t.value);
    const hundred = { min: 0, max: 100 };
    expect(labels(hundred, 2)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(labels(hundred, 3)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(labels(hundred, 4)).toEqual([0, 50, 100]);
    expect(labels(hundred, 5)).toEqual([0, 100]);
    expect(labels({ min: 550, max: 780 }, 3)).toEqual([550, 600, 700, 780]);
    expect(labels({ min: 550, max: 780 }, 4)).toEqual([550, 650, 780]);
    expect(labels({ min: 0, max: 1000 }, 3)).toEqual([0, 200, 400, 600, 800, 1000]);
    expect(labels({ min: 0, max: 1000 }, 4)).toEqual([0, 500, 1000]);
    expect(labels({ min: 0, max: 1000 }, 5)).toEqual([0, 1000]);
    expect(labels({ min: 0, max: 50 }, 4)).toEqual([0, 20, 50]);
  });

  it('every level draws all lines of every range preset and of 550 to 780 (amendment 20)', () => {
    for (const [view, count] of [
      [{ min: 0, max: 10 }, 11],
      [{ min: 0, max: 20 }, 21],
      [{ min: 0, max: 50 }, 51],
      [{ min: 0, max: 100 }, 101],
      [{ min: 0, max: 1000 }, 101],
      [{ min: 550, max: 780 }, 24],
    ] as const) {
      for (const level of LEVELS) {
        const { ticks } = ticksFor(view, level);
        expect(ticks.length, `${view.min}-${view.max} level ${level}`).toBe(count);
      }
    }
  });

  it('level 4 on 15 to 45 draws every line and labels 15, 30 and 45', () => {
    const { ticks } = ticksFor({ min: 15, max: 45 }, 4);
    expect(ticks.length).toBe(31);
    expect(ticks.filter((t) => t.labeled).map((t) => t.value)).toEqual([15, 30, 45]);
  });

  it('always draws and labels the end points, at every level, also for custom ranges', () => {
    for (const view of [...views, { min: 3, max: 8 }, { min: -1000, max: -995 }]) {
      for (const level of LEVELS) {
        const { ticks } = ticksFor(view, level);
        expect(ticks[0]).toMatchObject({ value: view.min, labeled: true });
        expect(ticks[ticks.length - 1]).toMatchObject({ value: view.max, labeled: true });
      }
    }
  });
});

describe('medium lines at half of each major step (T235, FR-016, amendment 02 item 4)', () => {
  const sizes = (view: { min: number; max: number }, level: RulerLevel, size: Tick['size']) =>
    ticksFor(view, level)
      .ticks.filter((t) => t.size === size)
      .map((t) => t.value);

  it('on 0 to 100, levels 1 to 3 have medium lines at 5, 15, 25 … 95; 10, 20 … stay major and the rest minor', () => {
    for (const level of [1, 2, 3] as RulerLevel[]) {
      expect(sizes({ min: 0, max: 100 }, level, 'medium')).toEqual([5, 15, 25, 35, 45, 55, 65, 75, 85, 95]);
      expect(sizes({ min: 0, max: 100 }, level, 'major')).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
      for (const t of ticksFor({ min: 0, max: 100 }, level).ticks) expect(t.major).toBe(t.size === 'major');
    }
  });

  it('on 0 to 1000 (major 100, minor 10) the medium lines are 50, 150 … 950', () => {
    expect(sizes({ min: 0, max: 1000 }, 1, 'medium')).toEqual([50, 150, 250, 350, 450, 550, 650, 750, 850, 950]);
  });

  it('has no medium lines when the half of the major step is off the minor grid (550 to 780: major 50, minor 10)', () => {
    expect(sizes({ min: 550, max: 780 }, 1, 'medium')).toEqual([]);
  });

  it('levels 4 and 5 have the same medium lines as level 1 (amendment 20)', () => {
    for (const level of [4, 5] as RulerLevel[]) {
      expect(sizes({ min: 0, max: 100 }, level, 'medium')).toEqual([5, 15, 25, 35, 45, 55, 65, 75, 85, 95]);
      expect(sizes({ min: 0, max: 1000 }, level, 'medium')).toEqual([50, 150, 250, 350, 450, 550, 650, 750, 850, 950]);
    }
  });

  it('medium lines do not change the labels', () => {
    const r = ticksFor({ min: 0, max: 100 }, 2);
    expect(r.ticks.filter((t) => t.labeled).map((t) => t.value)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it('the zoomed help view follows the same rule for its own steps', () => {
    const zoom = ticksFor({ min: 20, max: 50 }, 1, { allLines: true });
    expect(zoom.ticks.filter((t) => t.size === 'medium').map((t) => t.value)).toEqual([25, 35, 45]);
  });
});
