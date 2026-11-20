/**
 * "Zwei Zahlen" exercises (amendment 26, FR-149 to FR-152): a + b or a − b with the first number from one range and the
 * second from another, with or without carrying (plus) or borrowing (minus), checked column by column. Pure.
 */
import type { Settings } from '../settings/schema';
import type { DifficultyStep } from '../types';
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

export interface NumberRange {
  min: number;
  max: number;
}

/** The rules a "Zwei Zahlen" pair follows (contracts/core-api.md, `core/math/twoNumbers`). */
export interface TwoNumberRules {
  kind: ArithmeticKind;
  first: NumberRange;
  /** The parent's second range, narrowed by the step's `secondFraction`. */
  second: NumberRange;
  /** Carrying (plus) or borrowing (minus) allowed: the parent's switch and the step's `allowCarry`. */
  carry: boolean;
  /** Smallest allowed answer: range.min, or 0 when negative results are off. */
  lowest: number;
  /** Largest allowed answer: min(addition.maxResult, range.max) for plus, range.max for minus. */
  highest: number;
}

export function twoNumberRules(kind: ArithmeticKind, settings: Settings, step?: DifficultyStep): TwoNumberRules {
  const { range, negativeResults } = settings;
  const own = settings[kind];
  const fraction = step?.secondFraction;
  const second =
    fraction === undefined
      ? { ...own.second }
      : { min: own.second.min, max: Math.max(own.second.min, own.second.min + Math.floor(Math.max(0, Math.min(1, fraction)) * (own.second.max - own.second.min))) };
  return {
    kind,
    first: { ...own.first },
    second,
    carry: own.carry && (step?.allowCarry ?? true),
    // As lowestResult in settings/validate.ts, kept here so that module can import this one.
    lowest: negativeResults ? range.min : Math.max(range.min, 0),
    highest: kind === 'addition' ? Math.min(settings.addition.maxResult, range.max) : range.max,
  };
}

/** Plus: a + b; minus: a − b. */
function answerOf(kind: ArithmeticKind, a: number, b: number): number {
  return kind === 'addition' ? a + b : a - b;
}

/**
 * The single pair check: one message per broken rule, empty when [a, b] is a valid pair (FR-149, FR-150). The pair
 * search below walks only pairs inside both ranges and the battlefield and then checks the order, carry and answer
 * rules in the same order as here; twoNumbers.test.ts compares the two.
 */
export function twoNumberPairErrors(a: number, b: number, rules: TwoNumberRules, settings: Settings): string[] {
  const { kind } = rules;
  const errors: string[] = [];
  if (!Number.isInteger(a) || !Number.isInteger(b)) return [`${kind}: the numbers are not whole numbers`];
  const { range } = settings;
  if (a < rules.first.min || a > rules.first.max) errors.push(`${kind}: first number ${a} is not between ${rules.first.min} and ${rules.first.max}`);
  if (b < rules.second.min || b > rules.second.max) errors.push(`${kind}: second number ${b} is not between ${rules.second.min} and ${rules.second.max}`);
  if (a < range.min || a > range.max) errors.push(`${kind}: first number ${a} is outside the battlefield ${range.min} to ${range.max}`);
  if (kind === 'subtraction' && a <= b) errors.push(`${kind}: first number ${a} is not larger than ${b}`);
  if (!rules.carry && kind === 'addition' && carries(a, b)) errors.push(`${kind}: ${a} + ${b} carries, the settings forbid carrying`);
  if (!rules.carry && kind === 'subtraction' && borrows(a, b)) errors.push(`${kind}: ${a} − ${b} borrows, the settings forbid borrowing`);
  const answer = answerOf(kind, a, b);
  if (answer < rules.lowest || answer > rules.highest) errors.push(`${kind}: answer ${answer} is outside ${rules.lowest} to ${rules.highest}`);
  return errors;
}

/** Order, carry and answer rules for a pair already inside both ranges and with a on the battlefield. */
function pairOk(a: number, b: number, rules: TwoNumberRules): boolean {
  const plus = rules.kind === 'addition';
  if (!plus && a <= b) return false;
  if (!rules.carry && (plus ? carries(a, b) : borrows(a, b))) return false;
  const answer = plus ? a + b : a - b;
  return answer >= rules.lowest && answer <= rules.highest;
}

/** The first numbers that lie in the first range and on the battlefield. */
function firstOnField(rules: TwoNumberRules, settings: Settings): NumberRange {
  return { min: Math.max(rules.first.min, settings.range.min), max: Math.min(rules.first.max, settings.range.max) };
}

/** Every valid pair [a, b] with the answer `answer`, a ascending. */
export function twoNumberPairs(answer: number, rules: TwoNumberRules, settings: Settings): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (!Number.isInteger(answer) || answer < rules.lowest || answer > rules.highest) return out;
  const plus = rules.kind === 'addition';
  const { min, max } = firstOnField(rules, settings);
  for (let a = min; a <= max; a++) {
    const b = plus ? answer - a : a - answer;
    if (b >= rules.second.min && b <= rules.second.max && pairOk(a, b, rules)) out.push([a, b]);
  }
  return out;
}

const answersCache = new Map<string, readonly number[]>();
const ANSWERS_CACHE_LIMIT = 32;

/**
 * The answers that have at least one valid pair, ascending (research R24). At most 1001 × 999 pair checks; memoized
 * on the rules and the battlefield, so a round computes it once per difficulty step. Do not change the returned list.
 */
export function twoNumberAnswers(rules: TwoNumberRules, settings: Settings): number[] {
  const { range } = settings;
  const key = [rules.kind, range.min, range.max, rules.lowest, rules.highest, rules.first.min, rules.first.max, rules.second.min, rules.second.max, rules.carry].join('|');
  const cached = answersCache.get(key);
  if (cached) return cached as number[];

  const plus = rules.kind === 'addition';
  const lo = rules.lowest;
  const hi = rules.highest;
  const out: number[] = [];
  if (hi >= lo) {
    const found = new Uint8Array(hi - lo + 1);
    const first = firstOnField(rules, settings);
    for (let a = first.min; a <= first.max; a++) {
      // Only second numbers whose answer can lie within [lo, hi] (minus also needs b < a).
      const bMin = Math.max(rules.second.min, plus ? lo - a : a - hi);
      const bMax = Math.min(rules.second.max, plus ? hi - a : Math.min(a - lo, a - 1));
      for (let b = bMin; b <= bMax; b++) {
        if (pairOk(a, b, rules)) found[(plus ? a + b : a - b) - lo] = 1;
      }
    }
    for (let i = 0; i < found.length; i++) if (found[i]) out.push(lo + i);
  }
  if (answersCache.size >= ANSWERS_CACHE_LIMIT) answersCache.clear();
  answersCache.set(key, out);
  return out;
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
  const { range } = settings;
  const rules = twoNumberRules(kind, settings);
  const { lowest, highest, first, second, carry } = rules;
  const key = [kind, range.min, range.max, lowest, highest, first.min, first.max, second.min, second.max, carry].join('|');
  const cached = fitCache.get(key);
  if (cached) return cached;

  const plus = kind === 'addition';
  let any = false;
  let all = true;
  let candidates = 0;
  let extreme: number | null = null;
  // A candidate follows the order and carry rules; it fits when pairOk also accepts its answer and a is on the field.
  const followsRules = { ...rules, lowest: -Infinity, highest: Infinity };
  for (let a = first.min; a <= first.max; a++) {
    const aOnField = a >= range.min && a <= range.max;
    for (let b = second.min; b <= second.max; b++) {
      if (!plus && a <= b) break;
      if (!pairOk(a, b, followsRules)) continue;
      candidates++;
      const answer = plus ? a + b : a - b;
      if (aOnField && pairOk(a, b, rules)) {
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
