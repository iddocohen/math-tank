/**
 * Place-value help for "Zwei Zahlen" exercises (amendment 26 item 7, FR-154, FR-155). Pure.
 *
 * Plus, and minus without borrowing, are split column by column: one line per place where the second number has a
 * digit other than 0, highest place first, then the parts are added. Minus with borrowing cannot be split by column,
 * so it gives jumps instead: from the first number, subtract the second number's hundreds, then tens, then ones.
 */
import type { Challenge } from '../types';
import type { ArithmeticKind } from './arithmetic';
import { borrows } from './twoNumbers';

export type PlaceName = 'hundreds' | 'tens' | 'ones';

export type PlaceValueHelp =
  | { form: 'columns'; sign: 1 | -1; lines: Array<{ place: PlaceName; a: number; b: number; result: number }>; parts: number[]; answer: number }
  | { form: 'jumps'; lines: Array<{ place: PlaceName; from: number; by: number; to: number }> };

const PLACES: ReadonlyArray<{ place: PlaceName; value: number }> = [
  { place: 'hundreds', value: 100 },
  { place: 'tens', value: 10 },
  { place: 'ones', value: 1 },
];

/** The digit of n at the place `value` (1, 10 or 100). */
function digit(n: number, value: number): number {
  return Math.floor(n / value) % 10;
}

/**
 * The kind and operands [a, b] of a "Zwei Zahlen" plus or minus challenge (amendment 26), or null for any other
 * challenge. The one test of the step path and the help banner for "is this a + b or a − b from two ranges".
 */
export function twoNumberOperands(c: Pick<Challenge, 'kind' | 'operands' | 'twoNumbers'>): { kind: ArithmeticKind; a: number; b: number } | null {
  if (!c.twoNumbers || c.operands.length !== 2) return null;
  if (c.kind !== 'addition' && c.kind !== 'subtraction') return null;
  return { kind: c.kind, a: c.operands[0]!, b: c.operands[1]! };
}

/**
 * The banner content of help step 2. Column form: `parts` are the line results plus the place values of `a` at the
 * places without a line (a place of `a` that is 0 is left out); they add up to the answer. When `parts` has one
 * entry, it equals the answer and the place line already shows it, so the banner leaves out the sum line (i18n).
 */
export function placeValueHelp(kind: ArithmeticKind, a: number, b: number): PlaceValueHelp {
  if (kind === 'subtraction' && borrows(a, b)) {
    const lines: Array<{ place: PlaceName; from: number; by: number; to: number }> = [];
    let at = a;
    for (const { place, value } of PLACES) {
      const by = digit(b, value) * value;
      if (by === 0) continue;
      lines.push({ place, from: at, by, to: at - by });
      at -= by;
    }
    return { form: 'jumps', lines };
  }
  const sign = kind === 'addition' ? 1 : -1;
  const lines: Array<{ place: PlaceName; a: number; b: number; result: number }> = [];
  const parts: number[] = [];
  for (const { place, value } of PLACES) {
    const pa = digit(a, value) * value;
    const pb = digit(b, value) * value;
    if (pb !== 0) {
      const result = pa + sign * pb;
      lines.push({ place, a: pa, b: pb, result });
      parts.push(result);
    } else if (pa !== 0) {
      parts.push(pa);
    }
  }
  return { form: 'columns', sign, lines, parts, answer: a + sign * b };
}

/** The tens strictly between `from` and `to`, in the direction of travel: tensBetween(34, 53) is [40, 50]. */
export function tensBetween(from: number, to: number): number[] {
  const out: number[] = [];
  if (to > from) {
    for (let t = Math.floor(from / 10) * 10 + 10; t < to; t += 10) out.push(t + 0);
  } else if (to < from) {
    for (let t = Math.ceil(from / 10) * 10 - 10; t > to; t -= 10) out.push(t + 0);
  }
  return out;
}

/**
 * The marker's stops: start at `a`, jump the hundreds, then the tens, then the ones of `b` (places where `b` has a 0
 * are skipped). With `beginnerAssist` one hundred or one ten per jump, and the ones jump stops at each ten it crosses
 * (34 + 19: [34, 44, 50, 53]); without it one stop per place ([34, 44, 53]).
 */
export function placeValuePath(kind: ArithmeticKind, a: number, b: number, beginnerAssist: boolean): number[] {
  const sign = kind === 'addition' ? 1 : -1;
  const out = [a];
  let at = a;
  for (const { value } of PLACES) {
    const d = digit(b, value);
    if (d === 0) continue;
    if (value === 1) {
      const to = at + sign * d;
      if (beginnerAssist) out.push(...tensBetween(at, to));
      out.push(to);
      at = to;
    } else if (beginnerAssist) {
      for (let i = 0; i < d; i++) {
        at += sign * value;
        out.push(at);
      }
    } else {
      at += sign * d * value;
      out.push(at);
    }
  }
  return out;
}
