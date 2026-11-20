/**
 * "Zwei Zahlen" exercises (amendment 26, FR-149 to FR-152): a + b or a − b with the first number from one range and the
 * second from another, with or without carrying (plus) or borrowing (minus), checked column by column. Pure.
 */
import type { Settings } from '../settings/schema';
import type { ArithmeticKind } from './arithmetic';

/** Some column of a + b sums to 10 or more. Missing digits of the shorter number count as 0. */
export function carries(a: number, b: number): boolean {
  for (let x = a, y = b; x > 0 || y > 0; x = Math.floor(x / 10), y = Math.floor(y / 10)) {
    if ((x % 10) + (y % 10) >= 10) return true;
  }
  return false;
}

/** Some digit of a is smaller than the digit of b in the same column. Missing digits count as 0. */
export function borrows(a: number, b: number): boolean {
  for (let x = a, y = b; x > 0 || y > 0; x = Math.floor(x / 10), y = Math.floor(y / 10)) {
    if (x % 10 < y % 10) return true;
  }
  return false;
}

/** Whether the pairs of the ranges fit the battlefield (FR-152). */
export interface TwoNumberFit {
  /** At least one pair fits: the first number and the answer on the battlefield, the answer within the limits. */
  any: boolean;
  /** Every pair of the ranges that follows the carry and order rules fits. */
  all: boolean;
  /** The largest fitting answer for plus, the smallest for minus; null when none fits. */
  extreme: number | null;
}

const fitCache = new Map<string, TwoNumberFit>();
const FIT_CACHE_LIMIT = 32;

/**
 * Checks every pair of the parent's ranges for `kind` (the top difficulty step: carrying as the switch says).
 * A pair follows the rules when minus has a > b and, with the switch off, no column carries or borrows. It fits when
 * a lies on the battlefield and the answer lies within the lowest result and the battlefield's end (plus: also
 * "Größtes Ergebnis"). Memoized on the fields it reads.
 */
export function twoNumberFit(kind: ArithmeticKind, settings: Settings): TwoNumberFit {
  const { range, negativeResults } = settings;
  const k = settings[kind];
  // As lowestResult in settings/validate.ts, kept here so that module can import this one.
  const lowest = negativeResults ? range.min : Math.max(range.min, 0);
  const highest = kind === 'addition' ? Math.min(settings.addition.maxResult, range.max) : range.max;
  const key = [kind, range.min, range.max, lowest, highest, k.first.min, k.first.max, k.second.min, k.second.max, k.carry].join('|');
  const cached = fitCache.get(key);
  if (cached) return cached;

  const plus = kind === 'addition';
  let any = false;
  let all = true;
  let candidates = 0;
  let extreme: number | null = null;
  for (let a = k.first.min; a <= k.first.max; a++) {
    const aOnField = a >= range.min && a <= range.max;
    for (let b = k.second.min; b <= k.second.max; b++) {
      if (!plus && a <= b) break;
      if (!k.carry && (plus ? carries(a, b) : borrows(a, b))) continue;
      candidates++;
      const answer = plus ? a + b : a - b;
      if (aOnField && answer >= lowest && answer <= highest) {
        any = true;
        if (extreme === null || (plus ? answer > extreme : answer < extreme)) extreme = answer;
      } else all = false;
    }
  }
  const fit = { any, all: all && candidates > 0, extreme };
  if (fitCache.size >= FIT_CACHE_LIMIT) fitCache.clear();
  fitCache.set(key, fit);
  return fit;
}
