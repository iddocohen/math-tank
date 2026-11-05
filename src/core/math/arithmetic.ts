/**
 * Shared rules for addition and subtraction, answer first (FR-022, FR-023, FR-025, research R10).
 * An exercise is a chain of positions: start, an intermediate result for two-step exercises, result.
 * The start is a number in the range; each later position is a result. The added or subtracted numbers are
 * between 1 and the maximum operand and may lie outside the range (for example 560 + 5 in the range 550 to 780).
 */
import type { Rng } from '../rng';
import { lowestResult } from '../settings/validate';
import type { DifficultyStep, Settings } from '../types';
import { movementAllowed, type ChallengeDraft } from './numberLine';

export type ArithmeticKind = 'addition' | 'subtraction';

export interface ArithmeticRules {
  kind: ArithmeticKind;
  /** +1 for addition, -1 for subtraction. */
  sign: 1 | -1;
  /** Largest added or subtracted number; for addition also the largest start (every operand, US3 scenario 5). */
  maxOperand: number;
  /** 1: a ± b; 2: a ± b ± c. */
  steps: 1 | 2;
  /** Smallest allowed result: range.min, or 0 when negative results are off (FR-023). */
  lowest: number;
  /** Largest allowed result: addition.maxResult for addition, range.max for subtraction. */
  highest: number;
}

/** Changes of the chosen operand tried before a two-step search gives up on the answer. */
const CHAIN_TRIES = 30;

export function arithmeticRules(kind: ArithmeticKind, settings: Settings, step?: DifficultyStep): ArithmeticRules {
  const own = kind === 'addition' ? settings.addition : settings.subtraction;
  const maxOperand = Math.min(own.maxOperand, step?.maxOperand ?? Infinity);
  const highest = kind === 'addition' ? Math.min(settings.addition.maxResult, settings.range.max) : settings.range.max;
  return { kind, sign: kind === 'addition' ? 1 : -1, maxOperand, steps: own.steps, lowest: lowestResult(settings, settings.range), highest };
}

/** Whether `n` may be the start (isStart) or a result of the exercise. */
export function validPoint(n: number, isStart: boolean, rules: ArithmeticRules, settings: Settings): boolean {
  if (!Number.isInteger(n)) return false;
  if (isStart) {
    if (n < settings.range.min || n > settings.range.max) return false;
    return rules.kind === 'subtraction' || n <= rules.maxOperand;
  }
  return n >= rules.lowest && n <= rules.highest;
}

/** The operands k with which a valid previous position reaches `to` in one allowed movement. */
function operandsInto(to: number, isStart: boolean, rules: ArithmeticRules, settings: Settings, step: DifficultyStep): number[] {
  const out: number[] = [];
  for (let k = 1; k <= rules.maxOperand; k++) {
    const from = to - rules.sign * k;
    if (validPoint(from, isStart, rules, settings) && movementAllowed(from, to, settings, step)) out.push(k);
  }
  return out;
}

/** Operands [a, b] or [a, b, c] whose exercise has the result `answer`, or null when none exists. */
export function searchOperands(answer: number, rules: ArithmeticRules, settings: Settings, step: DifficultyStep, rng: Rng): number[] | null {
  if (!validPoint(answer, false, rules, settings)) return null;
  if (rules.steps === 1) {
    const ks = operandsInto(answer, true, rules, settings, step);
    if (ks.length === 0) return null;
    const b = rng.pick(ks);
    return [answer - rules.sign * b, b];
  }
  const cs = operandsInto(answer, false, rules, settings, step);
  for (let i = 0; i < CHAIN_TRIES && cs.length > 0; i++) {
    const index = Math.floor(rng.next() * cs.length);
    const c = cs[index]!;
    const middle = answer - rules.sign * c;
    const bs = operandsInto(middle, true, rules, settings, step);
    if (bs.length > 0) {
      const b = rng.pick(bs);
      return [middle - rules.sign * b, b, c];
    }
    cs.splice(index, 1);
  }
  return null;
}

/** The positions of an exercise: start, intermediate result, result. */
export function chainOf(operands: readonly number[], sign: 1 | -1): number[] {
  const out = [operands[0]!];
  for (const k of operands.slice(1)) out.push(out[out.length - 1]! + sign * k);
  return out;
}

export function arithmeticDraft(kind: ArithmeticKind, operands: number[]): ChallengeDraft {
  const [a, b, c] = operands as [number, number, number | undefined];
  const params: Record<string, number> = c === undefined ? { a, b } : { a, b, c };
  const steps = chainOf(operands, kind === 'addition' ? 1 : -1);
  return { kind, prompt: { key: kind, params }, operands, answer: steps[steps.length - 1]!, steps };
}

/**
 * Results that pass the simple limits (range, lowest and highest result, the largest reachable sum), so the
 * generator does not try answers that can never work. Crossing rules can still rule an answer out.
 */
export function arithmeticAnswers(rules: ArithmeticRules, settings: Settings): number[] {
  const { min, max } = settings.range;
  let lo = Math.max(rules.lowest, min);
  let hi = Math.min(rules.highest, max);
  if (rules.kind === 'addition') {
    lo = Math.max(lo, min + rules.steps);
    hi = Math.min(hi, rules.maxOperand * (rules.steps + 1));
  } else {
    hi = Math.min(hi, max - rules.steps);
  }
  const out: number[] = [];
  for (let n = lo; n <= hi; n++) out.push(n);
  return out;
}

/** Rule checks for an addition or subtraction challenge against the parent settings (FR-029). */
export function arithmeticErrors(
  c: { kind: ArithmeticKind; operands: number[]; answer: number; steps?: number[]; prompt: { params: Record<string, number> } },
  settings: Settings,
): string[] {
  const errors: string[] = [];
  const rules = arithmeticRules(c.kind, settings);
  const { operands } = c;
  if (operands.length !== rules.steps + 1) errors.push(`${c.kind}: ${operands.length - 1} steps, settings say ${rules.steps}`);
  if (operands.length < 2 || !operands.every(Number.isInteger)) {
    errors.push(`${c.kind}: operands are not whole numbers`);
    return errors;
  }
  operands.slice(1).forEach((k, i) => {
    if (k < 1 || k > rules.maxOperand) errors.push(`${c.kind}: operand ${i + 1} ${k} is not between 1 and ${rules.maxOperand}`);
  });
  const chain = chainOf(operands, rules.sign);
  if (!validPoint(chain[0]!, true, rules, settings)) errors.push(`${c.kind}: start ${chain[0]} is not allowed`);
  chain.slice(1).forEach((n) => {
    if (!validPoint(n, false, rules, settings)) errors.push(`${c.kind}: result ${n} is outside ${rules.lowest} to ${rules.highest}`);
  });
  for (let i = 1; i < chain.length; i++) {
    if (!movementAllowed(chain[i - 1]!, chain[i]!, settings)) {
      errors.push(`${c.kind}: ${chain[i - 1]} to ${chain[i]} crosses a ten or hundred that the settings forbid`);
    }
  }
  if (chain[chain.length - 1] !== c.answer) errors.push(`${c.kind}: answer does not follow from the operands`);
  if (c.steps && c.steps.join() !== chain.join()) errors.push(`${c.kind}: steps do not follow from the operands`);
  const names = ['a', 'b', 'c'];
  const params = c.prompt.params;
  if (Object.keys(params).length !== operands.length || operands.some((n, i) => params[names[i]!] !== n)) {
    errors.push(`${c.kind}: prompt numbers differ from the operands`);
  }
  return errors;
}
