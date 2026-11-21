/**
 * "Zwei Zahlen" exercises (amendment 26, FR-149 to FR-152): a + b or a − b with the first number from one range and the
 * second from another, with or without carrying (plus) or borrowing (minus), checked column by column. Pure.
 */
import { highestResult, lowestResult } from '../settings/limits';
import type { NumberSpan, Settings } from '../settings/schema';
import type { DifficultyStep } from '../types';
import { clamp } from '../util';
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

/** The rules a "Zwei Zahlen" pair follows (contracts/core-api.md, `core/math/twoNumbers`). */
export interface TwoNumberRules {
  kind: ArithmeticKind;
  first: NumberSpan;
  /** The parent's second range, narrowed by the step's `secondFraction`. */
  second: NumberSpan;
  /** Carrying (plus) or borrowing (minus) allowed: the parent's switch and the step's `allowCarry`. */
  carry: boolean;
  /** Smallest allowed answer: range.min, or 0 when negative results are off. */
  lowest: number;
  /** Largest allowed answer: min(addition.maxResult, range.max) for plus, range.max for minus. */
  highest: number;
}

export function twoNumberRules(kind: ArithmeticKind, settings: Settings, step?: DifficultyStep): TwoNumberRules {
  const own = settings[kind];
  const fraction = step?.secondFraction;
  const second =
    fraction === undefined
      ? { ...own.second }
      : { min: own.second.min, max: Math.max(own.second.min, own.second.min + Math.floor(clamp(fraction, 0, 1) * (own.second.max - own.second.min))) };
  return {
    kind,
    first: { ...own.first },
    second,
    carry: own.carry && (step?.allowCarry ?? true),
    lowest: lowestResult(settings, settings.range),
    highest: highestResult(kind, settings),
  };
}

/** Plus: a + b; minus: a − b. */
function answerOf(kind: ArithmeticKind, a: number, b: number): number {
  return kind === 'addition' ? a + b : a - b;
}

/** The answer lies within the lowest and the highest allowed answer. */
function answerFits(answer: number, rules: TwoNumberRules): boolean {
  return answer >= rules.lowest && answer <= rules.highest;
}

/** One rule of a pair: when it is broken, and the message twoNumberPairErrors gives for it (after "<kind>: "). */
interface PairRule {
  broken: (a: number, b: number, rules: TwoNumberRules) => boolean;
  message: (a: number, b: number, rules: TwoNumberRules) => string;
}

/** Minus needs a > b; with carrying off, no column of a + b carries and no column of a − b borrows (FR-149, FR-150). */
const ORDER_AND_CARRY: readonly PairRule[] = [
  {
    broken: (a, b, r) => r.kind === 'subtraction' && a <= b,
    message: (a, b) => `first number ${a} is not larger than ${b}`,
  },
  {
    broken: (a, b, r) => !r.carry && (r.kind === 'addition' ? carries(a, b) : borrows(a, b)),
    message: (a, b, r) => (r.kind === 'addition' ? `${a} + ${b} carries, the settings forbid carrying` : `${a} − ${b} borrows, the settings forbid borrowing`),
  },
];

/** The order, carry and answer rules, in the order twoNumberPairErrors reports them. */
const PAIR_RULES: readonly PairRule[] = [
  ...ORDER_AND_CARRY,
  {
    broken: (a, b, r) => !answerFits(answerOf(r.kind, a, b), r),
    message: (a, b, r) => `answer ${answerOf(r.kind, a, b)} is outside ${r.lowest} to ${r.highest}`,
  },
];

/** No rule of `list` is broken by [a, b]. */
function follows(list: readonly PairRule[], a: number, b: number, rules: TwoNumberRules): boolean {
  for (const rule of list) if (rule.broken(a, b, rules)) return false;
  return true;
}

/** Order, carry and answer rules for a pair already inside both ranges and with a on the battlefield. */
function pairOk(a: number, b: number, rules: TwoNumberRules): boolean {
  return follows(PAIR_RULES, a, b, rules);
}

/**
 * The single pair check: one message per broken rule, empty when [a, b] is a valid pair (FR-149, FR-150). The pair
 * search below walks only pairs inside both ranges and the battlefield and then checks PAIR_RULES, the same rules
 * as here; twoNumbers.test.ts compares the two.
 */
export function twoNumberPairErrors(a: number, b: number, rules: TwoNumberRules, settings: Settings): string[] {
  const { kind } = rules;
  if (!Number.isInteger(a) || !Number.isInteger(b)) return [`${kind}: the numbers are not whole numbers`];
  const errors: string[] = [];
  const { range } = settings;
  if (a < rules.first.min || a > rules.first.max) errors.push(`${kind}: first number ${a} is not between ${rules.first.min} and ${rules.first.max}`);
  if (b < rules.second.min || b > rules.second.max) errors.push(`${kind}: second number ${b} is not between ${rules.second.min} and ${rules.second.max}`);
  if (a < range.min || a > range.max) errors.push(`${kind}: first number ${a} is outside the battlefield ${range.min} to ${range.max}`);
  for (const rule of PAIR_RULES) if (rule.broken(a, b, rules)) errors.push(`${kind}: ${rule.message(a, b, rules)}`);
  return errors;
}

/** The first numbers that lie in the first range and on the battlefield. */
function firstOnField(rules: TwoNumberRules, settings: Settings): NumberSpan {
  return { min: Math.max(rules.first.min, settings.range.min), max: Math.min(rules.first.max, settings.range.max) };
}

/** Every valid pair [a, b] with the answer `answer`, a ascending. */
export function twoNumberPairs(answer: number, rules: TwoNumberRules, settings: Settings): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (!Number.isInteger(answer) || !answerFits(answer, rules)) return out;
  const plus = rules.kind === 'addition';
  const { min, max } = firstOnField(rules, settings);
  for (let a = min; a <= max; a++) {
    const b = plus ? answer - a : a - answer;
    if (b >= rules.second.min && b <= rules.second.max && pairOk(a, b, rules)) out.push([a, b]);
  }
  return out;
}

/** The fields of the rules and the battlefield the pair search reads: the key of both caches below. */
function rulesKey(rules: TwoNumberRules, settings: Settings): string {
  const { range } = settings;
  return [rules.kind, range.min, range.max, rules.lowest, rules.highest, rules.first.min, rules.first.max, rules.second.min, rules.second.max, rules.carry].join('|');
}

const CACHE_LIMIT = 32;

/**
 * The cached value for `key`, or `compute()` stored under it. A full cache drops its oldest entry (Map keeps
 * insertion order), so typing on the settings page does not push out every entry the game uses. Also used by the
 * exact exercise search of "Plus und Minus" (arithmetic.ts, amendment 27).
 */
export function memo<T>(cache: Map<string, T>, key: string, compute: () => T): T {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const value = compute();
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, value);
  return value;
}

const answersCache = new Map<string, number[]>();

/**
 * The answers that have at least one valid pair, ascending (research R24). At most 1001 × 999 pair checks; memoized
 * on the rules and the battlefield, so a round computes it once per difficulty step. Do not change the returned list.
 */
export function twoNumberAnswers(rules: TwoNumberRules, settings: Settings): number[] {
  return memo(answersCache, rulesKey(rules, settings), () => {
    const plus = rules.kind === 'addition';
    const lo = rules.lowest;
    const hi = rules.highest;
    const out: number[] = [];
    if (hi < lo) return out;
    const found = new Uint8Array(hi - lo + 1);
    const first = firstOnField(rules, settings);
    for (let a = first.min; a <= first.max; a++) {
      // Only second numbers whose answer can lie within [lo, hi] (minus also needs b < a).
      const bMin = Math.max(rules.second.min, plus ? lo - a : a - hi);
      const bMax = Math.min(rules.second.max, plus ? hi - a : Math.min(a - lo, a - 1));
      for (let b = bMin; b <= bMax; b++) {
        if (pairOk(a, b, rules)) found[answerOf(rules.kind, a, b) - lo] = 1;
      }
    }
    for (let i = 0; i < found.length; i++) if (found[i]) out.push(lo + i);
    return out;
  });
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

/**
 * Checks every pair of the parent's ranges for `kind` (the top difficulty step: carrying as the switch says).
 * A pair follows the rules when minus has a > b and, with the switch off, no column carries or borrows. It fits when
 * a lies on the battlefield and the answer lies within the lowest result and the battlefield's end (plus: also
 * "Größtes Ergebnis"). Memoized on the fields it reads.
 */
export function twoNumberFit(kind: ArithmeticKind, settings: Settings): TwoNumberFit {
  const rules = twoNumberRules(kind, settings);
  return memo(fitCache, rulesKey(rules, settings), () => {
    const { range } = settings;
    const { lowest, highest, first, second } = rules;
    const plus = kind === 'addition';
    let any = false;
    let all = true;
    let candidates = 0;
    let extreme: number | null = null;
    for (let a = first.min; a <= first.max; a++) {
      const aOnField = a >= range.min && a <= range.max;
      // Once a pair does not fit, `all` is settled and only fitting pairs matter: a on the battlefield and b with
      // an answer within the limits.
      if (!all && !aOnField) continue;
      const bMin = all ? second.min : Math.max(second.min, plus ? lowest - a : a - highest);
      const bMax = all ? second.max : Math.min(second.max, plus ? highest - a : a - lowest);
      for (let b = bMin; b <= bMax; b++) {
        if (!plus && a <= b) break;
        if (!follows(ORDER_AND_CARRY, a, b, rules)) continue;
        candidates++;
        const answer = answerOf(kind, a, b);
        if (aOnField && answerFits(answer, rules)) {
          any = true;
          if (extreme === null || (plus ? answer > extreme : answer < extreme)) extreme = answer;
        } else all = false;
      }
    }
    return { any, all: all && candidates > 0, extreme };
  });
}
