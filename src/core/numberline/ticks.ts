/**
 * Tick lines and labels for a view of the number line (research R8 and R23, FR-016, FR-017, FR-018).
 * The view is the part of the line that is visible: the whole range or a zoomed help interval.
 * Every line of the minor grid is returned; `visible` and `labeled` follow the ruler level.
 */
import { createRng } from '../rng';
import { DEFAULT_LAYOUT } from './mapping';

export interface Tick {
  value: number;
  major: boolean;
  /** Drawn at this ruler level. */
  visible: boolean;
  labeled: boolean;
}

/** Ruler detail level (FR-017): 1 shows the most, 5 only the end points. */
export type RulerLevel = 1 | 2 | 3 | 4 | 5;

export const MAX_TICKS = 101;

/** Level 1 labels minor lines only when they are at least this far apart (logical units, research R23). */
export const MIN_LABEL_SPACING = 28;

const isMultiple = (v: number, step: number) => ((v % step) + step) % step === 0;

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

/** The step between neighboring visible lines: minor on levels 1 to 3, major on 4 and 5 (FR-068). */
export function smallestVisibleStep(view: { min: number; max: number }, level: RulerLevel): number {
  const { majorStep, minorStep } = stepsFor(view);
  return level <= 3 ? minorStep : majorStep;
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

function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  const rng = createRng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function ticksFor(
  view: { min: number; max: number },
  level: RulerLevel,
  seed: number,
  opts: { allLines?: boolean } = {},
): { majorStep: number; minorStep: number; ticks: Tick[]; labelTypedNumber: boolean } {
  const { min, max } = view;
  const { majorStep, minorStep } = stepsFor(view);
  const ticks: Tick[] = lineValues(min, max, majorStep, minorStep).map((value) => ({
    value,
    major: isMultiple(value, majorStep),
    visible: false,
    labeled: false,
  }));
  const isEnd = (t: Tick) => t.value === min || t.value === max;
  const mark = (t: Tick, visible: boolean, labeled: boolean) => {
    t.visible = visible || isEnd(t);
    t.labeled = labeled || isEnd(t);
  };

  if (opts.allLines) {
    for (const t of ticks) mark(t, true, true);
    return { majorStep, minorStep, ticks, labelTypedNumber: false };
  }

  let labelTypedNumber = false;
  switch (level) {
    case 1: {
      const spacing = (minorStep / (max - min)) * (DEFAULT_LAYOUT.right - DEFAULT_LAYOUT.left);
      const roomy = spacing >= MIN_LABEL_SPACING;
      labelTypedNumber = !roomy;
      for (const t of ticks) mark(t, true, roomy || t.major);
      break;
    }
    case 2:
      for (const t of ticks) mark(t, true, t.major);
      break;
    case 3: {
      for (const t of ticks) mark(t, true, false);
      // Label a seed-chosen half (rounded down) of the major lines between the end points.
      const innerMajors = ticks.filter((t) => t.major && !isEnd(t));
      for (const t of shuffled(innerMajors, seed).slice(0, Math.floor(innerMajors.length / 2))) t.labeled = true;
      break;
    }
    case 4:
      for (const t of ticks) mark(t, t.major, t.major);
      break;
    case 5:
      for (const t of ticks) mark(t, false, false);
      break;
  }

  return { majorStep, minorStep, ticks, labelTypedNumber };
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
