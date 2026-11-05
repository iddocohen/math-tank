/**
 * Tick lines and labels for a view of the number line (research R8 and R23, FR-016, FR-017, FR-018).
 * The view is the part of the line that is visible: the whole range or a zoomed help interval.
 * Every line of the minor grid is returned and drawn on every ruler level (amendment 20); `labeled` follows the level.
 */
import { DEFAULT_LAYOUT } from './mapping';

/** Line length class (T235): major lines, medium lines at half of a major step (every level, amendment 20), and minor lines. */
export type TickSize = 'major' | 'medium' | 'minor';

export interface Tick {
  value: number;
  major: boolean;
  /** How long and bold the line is drawn (T235, FR-016). */
  size: TickSize;
  /** Drawn: true for every line on every level since amendment 20. */
  visible: boolean;
  labeled: boolean;
  /** Label row (T217): 0 directly under the line, 1 below it. Only level 1 uses row 1. */
  row: 0 | 1;
  /** Horizontal offset of the label in logical units: an end point's label may move outward to clear its neighbour. */
  shift: number;
}

/** Ruler detail level (FR-017, amendment 20): every level draws every line; 1 labels the most numbers, 5 only the end points. */
export type RulerLevel = 1 | 2 | 3 | 4 | 5;

export const MAX_TICKS = 101;

/** Two labels in the same row are at least this far apart, center to center (logical units, research R23). */
export const MIN_LABEL_SPACING = 28;

/** Label font sizes in logical units (T217): major lines and end points, minor lines in one row, in two rows. */
export const LABEL_FONT = { large: 26, minor: 20, small: 16 } as const;

/** Space kept between the estimated text widths of two labels in the same row (logical units). */
export const LABEL_GAP = 4;

/** Space kept between a small label and a large label (major line or end point) in the same row of two (T231). */
export const LARGE_LABEL_GAP = 6;

/** Estimated width of a bold digit (or minus sign) as a share of the font size: Arial and Helvetica bold digits are 0.556 em. */
const DIGIT_WIDTH = 0.56;

/** Estimated width of a number's label in logical units. */
export function labelWidth(value: number, fontSize: number): number {
  return String(value).length * DIGIT_WIDTH * fontSize;
}

/** Font size of a tick's label: large for major lines and end points, smaller for minor lines in two rows. */
export function labelFontSize(t: Tick, labelRows: 1 | 2, view: { min: number; max: number }): number {
  if (t.major || t.value === view.min || t.value === view.max) return LABEL_FONT.large;
  return labelRows === 2 ? LABEL_FONT.small : LABEL_FONT.minor;
}

/** True when v is a whole multiple of step, also for negative v. */
export function isMultiple(v: number, step: number): boolean {
  return ((v % step) + step) % step === 0;
}

/** FR-016 width table (amended by amendment 02). */
export function stepsFor(view: { min: number; max: number }): { majorStep: number; minorStep: number } {
  const width = view.max - view.min;
  if (width <= 20) {
    const includesMultipleOfTen = Math.floor(view.max / 10) * 10 >= view.min;
    return { majorStep: width > 10 && includesMultipleOfTen ? 10 : 5, minorStep: 1 };
  }
  if (width <= 100) return { majorStep: 10, minorStep: 1 };
  if (width <= 400) return { majorStep: 50, minorStep: 10 };
  return { majorStep: 100, minorStep: 10 };
}

/** Values of all lines in the view: the minor grid plus both end points, at most MAX_TICKS. */
function lineValues(min: number, max: number, majorStep: number, minorStep: number): number[] {
  let inner: number[] = [];
  for (let v = Math.ceil(min / minorStep) * minorStep; v <= max; v += minorStep) {
    if (v > min && v < max) inner.push(v + 0);
  }

  // An end point off the grid gets its own line; a minor grid line crowding it is left out.
  const crowds = (v: number, end: number) => !isMultiple(end, minorStep) && Math.abs(v - end) <= minorStep / 2;
  inner = inner.filter((v) => isMultiple(v, majorStep) || !(crowds(v, min) || crowds(v, max)));
  while (inner.length + 2 > MAX_TICKS) {
    // Only possible when both end points are off the grid: drop the minor line nearest to an end point.
    const candidates = inner.filter((v) => !isMultiple(v, majorStep));
    const nearest = candidates.reduce((a, b) => (Math.min(a - min, max - a) <= Math.min(b - min, max - b) ? a : b));
    inner = inner.filter((v) => v !== nearest);
  }
  return [min, ...inner, max];
}

/**
 * The lines and labels of `view` at ruler `level` (FR-016, FR-017, amendment 20). Every line is drawn on every level;
 * the level only chooses the labels. `_seed` no longer changes the result (level 3 chose its labels by seed until
 * amendment 20); callers keep passing it.
 */
export function ticksFor(
  view: { min: number; max: number },
  level: RulerLevel,
  _seed: number,
  opts: { allLines?: boolean } = {},
): { majorStep: number; minorStep: number; ticks: Tick[]; labelTypedNumber: boolean; labelRows: 1 | 2 } {
  const { min, max } = view;
  const { majorStep, minorStep } = stepsFor(view);
  // Medium lines (T235): half of each major step, on every level (amendment 20), when that half lies on the minor grid.
  const half = majorStep / 2;
  const hasMedium = Number.isInteger(half) && isMultiple(half, minorStep);
  const sizeOf = (value: number): TickSize => {
    if (isMultiple(value, majorStep)) return 'major';
    if (hasMedium && isMultiple(value, half)) return 'medium';
    return 'minor';
  };
  const ticks: Tick[] = lineValues(min, max, majorStep, minorStep).map((value) => ({
    value,
    major: isMultiple(value, majorStep),
    size: sizeOf(value),
    visible: true,
    labeled: false,
    row: 0,
    shift: 0,
  }));
  const isEnd = (t: Tick) => t.value === min || t.value === max;
  const mark = (t: Tick, labeled: boolean) => {
    t.labeled = labeled || isEnd(t);
  };

  if (opts.allLines) {
    for (const t of ticks) mark(t, true);
    return { majorStep, minorStep, ticks, labelTypedNumber: false, labelRows: 1 };
  }

  let labelTypedNumber = false;
  let labelRows: 1 | 2 = 1;
  switch (level) {
    case 1: {
      // Every line labeled in one row; else in two staggered rows, leaving out small labels that crowd a large one
      // (T231); else only the typed number (T203, T217).
      let skipped = placeLabels(ticks, view, 1);
      if (skipped) labelRows = 1;
      else if ((skipped = placeLabels(ticks, view, 2))) labelRows = 2;
      else {
        labelTypedNumber = true;
        for (const t of ticks) {
          t.row = 0;
          t.shift = 0;
        }
      }
      for (const t of ticks) mark(t, labelTypedNumber ? t.major : !skipped!.has(t));
      break;
    }
    case 2:
      for (const t of ticks) mark(t, t.major);
      break;
    case 3:
      // Every second major line: the multiples of twice the major step (0 to 100: 20, 40, 60, 80).
      for (const t of ticks) mark(t, t.major && isMultiple(t.value, 2 * majorStep));
      break;
    case 4: {
      // The major line nearest to the middle of the view; of two equally near, the lower one.
      const mid = (min + max) / 2;
      let middle: Tick | undefined;
      for (const t of ticks) {
        if (!t.major || isEnd(t)) continue;
        if (!middle || Math.abs(t.value - mid) < Math.abs(middle.value - mid)) middle = t;
      }
      for (const t of ticks) mark(t, t === middle);
      break;
    }
    case 5:
      for (const t of ticks) mark(t, false);
      break;
  }

  return { majorStep, minorStep, ticks, labelTypedNumber, labelRows };
}

/**
 * Places a label for every tick in `rows` rows (T217) and returns whether they fit. Major lines and end points stay
 * in row 0. With two rows, each minor label goes to the row its parity on the minor grid prefers, so neighbouring
 * numbers alternate rows, or to the other row if that one has no room. Two labels in a row fit when they are at least
 * MIN_LABEL_SPACING apart and their estimated widths keep LABEL_GAP between them; an end point's label may move
 * outward by up to half its width to make room. Sets `row` and `shift` on every tick.
 *
 * With two rows (T231), a small label and a large label (major line or end point) keep LARGE_LABEL_GAP between them,
 * and a small label that fits in neither row, and in its preferred row only because of large labels, is left out:
 * its line is still drawn. Returns the left-out ticks, or null when the labels do not fit.
 */
function placeLabels(ticks: Tick[], view: { min: number; max: number }, rows: 1 | 2): Set<Tick> | null {
  const scale = (DEFAULT_LAYOUT.right - DEFAULT_LAYOUT.left) / (view.max - view.min);
  const { minorStep } = stepsFor(view);
  const isEnd = (t: Tick) => t.value === view.min || t.value === view.max;
  const xOf = (t: Tick) => (t.value - view.min) * scale;
  const widthOf = (t: Tick) => labelWidth(t.value, labelFontSize(t, rows, view));
  const placed: Tick[][] = [[], []];
  const skipped = new Set<Tick>();
  const isLarge = (t: Tick) => t.major || isEnd(t);
  for (const t of ticks) {
    t.row = 0;
    t.shift = 0;
  }

  /** The end point's outward shift that lets `t` share a row with `other`, or null when they do not fit. */
  const fits = (t: Tick, other: Tick): { end: Tick; shift: number } | null | true => {
    const dist = Math.abs(xOf(t) - xOf(other));
    const gap = rows === 2 && isLarge(t) !== isLarge(other) ? LARGE_LABEL_GAP : LABEL_GAP;
    const need = Math.max(MIN_LABEL_SPACING, (widthOf(t) + widthOf(other)) / 2 + gap);
    if (dist >= need) return true;
    const end = isEnd(t) ? t : isEnd(other) ? other : null;
    if (!end || need - dist > widthOf(end) / 2) return null;
    return { end, shift: need - dist };
  };
  /** The labels in `row` that leave no room for `t`. */
  const blockers = (t: Tick, row: 0 | 1): Tick[] => placed[row]!.filter((other) => fits(t, other) === null);
  const tryRow = (t: Tick, row: 0 | 1): boolean => {
    const shifts: { end: Tick; shift: number }[] = [];
    for (const other of placed[row]!) {
      const f = fits(t, other);
      if (f === null) return false;
      if (f !== true) shifts.push(f);
    }
    for (const { end, shift } of shifts) {
      const outward = end.value === view.min ? -shift : shift;
      if (Math.abs(outward) > Math.abs(end.shift)) end.shift = outward;
    }
    t.row = row;
    placed[row]!.push(t);
    return true;
  };

  const first = ticks.filter((t) => t.major || isEnd(t));
  for (const t of first) if (!tryRow(t, 0)) return null;
  for (const t of ticks) {
    if (t.major || isEnd(t)) continue;
    const preferred: 0 | 1 = rows === 2 && Math.abs(Math.round(t.value / minorStep)) % 2 === 1 ? 1 : 0;
    const order: (0 | 1)[] = rows === 2 ? [preferred, preferred === 0 ? 1 : 0] : [0];
    if (order.some((row) => tryRow(t, row))) continue;
    if (rows === 2 && blockers(t, preferred).every(isLarge)) {
      skipped.add(t);
      continue;
    }
    return null;
  }
  return skipped;
}

/**
 * The labels to draw under the preview marker (T203, FR-017, FR-019). Only on a level 1 ruler that is too
 * crowded for minor labels (`labelTypedNumber`), and only for a typed number: the typed number itself, once, and
 * never the neighbouring lines, whose labels would run together into one long number. A number whose line already
 * has a label gets none, so it is never drawn twice. While pointing (`typed` false) nothing is labeled
 * (amendment 05).
 */
export function typedNumberLabels(
  r: { ticks: readonly Tick[]; labelTypedNumber: boolean },
  selection: number | null,
  typed: boolean,
): number[] {
  if (!r.labelTypedNumber || !typed || selection === null) return [];
  const own = r.ticks.find((t) => t.value === selection);
  return own?.labeled ? [] : [selection];
}
