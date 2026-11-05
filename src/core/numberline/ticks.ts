/**
 * Tick marks and labels for a view of the number line (research R8, FR-016, FR-017).
 * The view is the part of the line that is visible: the whole range, an overview, or a zoomed interval.
 */
import { createRng } from '../rng';

export interface Tick {
  value: number;
  major: boolean;
  labeled: boolean;
}

export type LabelLevel = 1 | 2 | 3 | 4;

export const MAX_TICKS = 101;

const isMultiple = (v: number, step: number) => ((v % step) + step) % step === 0;

/** FR-016 width table. */
export function stepsFor(view: { min: number; max: number }): { majorStep: number; minorStep: number } {
  const width = view.max - view.min;
  if (width <= 20) {
    const includesMultipleOfTen = Math.floor(view.max / 10) * 10 >= view.min;
    return { majorStep: width > 10 && includesMultipleOfTen ? 10 : 5, minorStep: 1 };
  }
  if (width <= 100) return { majorStep: 10, minorStep: 1 };
  if (width <= 200) return { majorStep: 50, minorStep: 10 };
  return { majorStep: 100, minorStep: 10 };
}

export function ticksFor(
  view: { min: number; max: number },
  labelLevel: LabelLevel,
  seed: number,
): { majorStep: number; minorStep: number; ticks: Tick[] } {
  const { min, max } = view;
  const { majorStep, minorStep } = stepsFor(view);

  // Ticks on the minor grid strictly inside the view.
  let inner: number[] = [];
  for (let v = Math.ceil(min / minorStep) * minorStep; v <= max; v += minorStep) {
    if (v > min && v < max) inner.push(v + 0);
  }

  // An end point off the grid gets its own tick; a minor grid tick crowding it is left out.
  const crowds = (v: number, end: number) => !isMultiple(end, minorStep) && Math.abs(v - end) <= minorStep / 2;
  inner = inner.filter((v) => isMultiple(v, majorStep) || !(crowds(v, min) || crowds(v, max)));
  while (inner.length + 2 > MAX_TICKS) {
    // Only possible when both end points are off the grid: drop the minor tick nearest to an end point.
    const candidates = inner.filter((v) => !isMultiple(v, majorStep));
    const nearest = candidates.reduce((a, b) =>
      Math.min(a - min, max - a) <= Math.min(b - min, max - b) ? a : b,
    );
    inner = inner.filter((v) => v !== nearest);
  }

  const values = [min, ...inner, max];
  const ticks: Tick[] = values.map((value) => ({ value, major: isMultiple(value, majorStep), labeled: false }));
  const isEnd = (t: Tick) => t.value === min || t.value === max;

  switch (labelLevel) {
    case 1:
      for (const t of ticks) t.labeled = true;
      break;
    case 2:
      for (const t of ticks) t.labeled = t.major || isEnd(t);
      break;
    case 3: {
      for (const t of ticks) t.labeled = t.major || isEnd(t);
      const minor = ticks.filter((t) => !t.labeled);
      // Fisher-Yates shuffle by seed, then label the first half (rounded down).
      const rng = createRng(seed);
      for (let i = minor.length - 1; i > 0; i--) {
        const j = rng.int(0, i);
        [minor[i], minor[j]] = [minor[j]!, minor[i]!];
      }
      for (const t of minor.slice(0, Math.floor(minor.length / 2))) t.labeled = true;
      break;
    }
    case 4:
      for (const t of ticks) t.labeled = isEnd(t);
      break;
  }

  return { majorStep, minorStep, ticks };
}
