/**
 * Shared rules for addition and subtraction, answer first (FR-022, FR-023, FR-025, research R10).
 * An exercise is a chain of positions: start, an intermediate result for two-step exercises, result.
 * The start is a number in the range; each later position is a result. The added or subtracted numbers are
 * between 1 and the maximum operand and may lie outside the range (for example 560 + 5 in the range 550 to 780).
 */
import type { Rng } from '../rng';
import { highestResult, isTwoNumbers, lowestResult } from '../settings/limits';
import type { DifficultyStep, Settings } from '../types';
import { movementAllowed, type ChallengeDraft } from './numberLine';
import { minEnemyGap } from './gaps';
import { memo, twoNumberAnswers, twoNumberPairErrors, twoNumberPairs, twoNumberRules } from './twoNumbers';

export type ArithmeticKind = 'addition' | 'subtraction';

export interface ArithmeticRules {
  kind: ArithmeticKind;
  /** +1 for addition, -1 for subtraction. */
  sign: 1 | -1;
  /** Largest added or subtracted number (every operand after the start, T216); the start is any number in the range. */
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
  return { kind, sign: kind === 'addition' ? 1 : -1, maxOperand, steps: own.steps, lowest: lowestResult(settings, settings.range), highest: highestResult(kind, settings) };
}

/** Whether `n` may be the start (isStart) or a result of the exercise. */
export function validPoint(n: number, isStart: boolean, rules: ArithmeticRules, settings: Settings): boolean {
  if (!Number.isInteger(n)) return false;
  if (isStart) {
    return n >= settings.range.min && n <= settings.range.max;
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
 * Results that pass the simple limits (range, lowest and highest result, the smallest reachable sum), so the
 * generator does not try answers that can never work. Crossing rules can still rule an answer out.
 */
export function arithmeticAnswers(rules: ArithmeticRules, settings: Settings): number[] {
  const { min, max } = settings.range;
  let lo = Math.max(rules.lowest, min);
  let hi = Math.min(rules.highest, max);
  if (rules.kind === 'addition') {
    lo = Math.max(lo, min + rules.steps);
  } else {
    hi = Math.min(hi, max - rules.steps);
  }
  const out: number[] = [];
  for (let n = lo; n <= hi; n++) out.push(n);
  return out;
}

/** "Zwei Zahlen" builder (FR-149, FR-150): a pair [a, b] with the answer, picked with the rng from every valid pair. */
export function twoNumberDraft(kind: ArithmeticKind, answer: number, settings: Settings, step: DifficultyStep, rng: Rng): ChallengeDraft | null {
  const pairs = twoNumberPairs(answer, twoNumberRules(kind, settings, step), settings);
  if (pairs.length === 0) return null;
  return { ...arithmeticDraft(kind, rng.pick(pairs)), twoNumbers: true };
}

/** "Zwei Zahlen" answers at this step: exactly the answers with at least one pair (research R24). */
export function twoNumberCandidates(kind: ArithmeticKind, settings: Settings, step: DifficultyStep): number[] {
  return twoNumberAnswers(twoNumberRules(kind, settings, step), settings);
}

type ArithmeticChallenge = {
  kind: ArithmeticKind;
  operands: number[];
  answer: number;
  steps?: number[];
  twoNumbers?: true;
  prompt: { params: Record<string, number> };
};

/** Shared checks of the answer, the steps and the prompt numbers. */
function chainErrors(c: ArithmeticChallenge, chain: number[], errors: string[]): void {
  if (chain[chain.length - 1] !== c.answer) errors.push(`${c.kind}: answer does not follow from the operands`);
  if (c.steps && c.steps.join() !== chain.join()) errors.push(`${c.kind}: steps do not follow from the operands`);
  const names = ['a', 'b', 'c'];
  const params = c.prompt.params;
  if (Object.keys(params).length !== c.operands.length || c.operands.some((n, i) => params[names[i]!] !== n)) {
    errors.push(`${c.kind}: prompt numbers differ from the operands`);
  }
}

/**
 * "Zwei Zahlen" checks (FR-149, FR-150) against the parent's settings, not a ladder step: the ranges, the battlefield,
 * the order for minus and the carry switch, instead of maxOperand, steps and the global crossing switches.
 */
function twoNumberErrors(c: ArithmeticChallenge, settings: Settings): string[] {
  const errors: string[] = [];
  if (c.operands.length !== 2) {
    errors.push(`${c.kind}: ${c.operands.length} numbers, "Zwei Zahlen" needs 2`);
    return errors;
  }
  const [a, b] = c.operands as [number, number];
  errors.push(...twoNumberPairErrors(a, b, twoNumberRules(c.kind, settings), settings));
  if (errors.length === 0) chainErrors(c, chainOf(c.operands, c.kind === 'addition' ? 1 : -1), errors);
  return errors;
}

/** Rule checks for an addition or subtraction challenge against the parent settings (FR-029). */
export function arithmeticErrors(c: ArithmeticChallenge, settings: Settings): string[] {
  const twoNumbers = isTwoNumbers(c.kind, settings);
  if (Boolean(c.twoNumbers) !== twoNumbers) {
    return [`${c.kind}: the challenge ${c.twoNumbers ? 'uses' : 'does not use'} "Zwei Zahlen", the settings ${twoNumbers ? 'do' : 'do not'}`];
  }
  if (twoNumbers) return twoNumberErrors(c, settings);
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
  chainErrors(c, chain, errors);
  return errors;
}

// ---------------------------------------------------------------------------------------------------------------
// Exact exercise search of "Plus und Minus" (amendment 27, FR-159, FR-162, FR-163, research R25)
// ---------------------------------------------------------------------------------------------------------------

/** The top difficulty step: the parent's settings unchanged (no operand limit, no crossing limit of a ladder step). */
const TOP_STEP: DifficultyStep = { maxNumberFraction: 1, allowCrossTens: true };

/** The turned-on kinds among addition and subtraction, in this order. */
function turnedOnKinds(settings: Settings): ArithmeticKind[] {
  const out: ArithmeticKind[] = [];
  if (settings.challengeTypes.addition) out.push('addition');
  if (settings.challengeTypes.subtraction) out.push('subtraction');
  return out;
}

/** The settings fields the exact search of `kind` reads: the key of the caches below. */
function exactKey(kind: ArithmeticKind, settings: Settings): string {
  const own = settings[kind];
  const { range } = settings;
  const common = [kind, range.min, range.max, lowestResult(settings, range), highestResult(kind, settings)];
  if (isTwoNumbers(kind, settings)) return [...common, 'two', own.first.min, own.first.max, own.second.min, own.second.max, own.carry].join('|');
  return [...common, 'steps', own.maxOperand, own.steps, settings.crossTens, settings.crossHundreds].join('|');
}

/** Results of a "Kleine Schritte" exercise at the parent's settings: `first` after one step, `answers` after all steps. */
interface StepReach {
  /** first[r - lowest] is 1 when some start in the range reaches r in one allowed movement. */
  first: Uint8Array;
  /** The answers that have an exercise, ascending. */
  answers: number[];
}

/**
 * Marks every result in [lowest, highest] that a marked `from` reaches with one operand from 1 to maxOperand in an
 * allowed movement. The loop bounds keep each result inside [lowest, highest], so the work is at most the number of
 * `from` values times min(maxOperand, highest - lowest + 1).
 */
function reach(froms: Iterable<number>, rules: ArithmeticRules, settings: Settings): Uint8Array {
  const { lowest, highest, sign, maxOperand } = rules;
  const out = new Uint8Array(Math.max(0, highest - lowest + 1));
  for (const from of froms) {
    const kMin = Math.max(1, sign === 1 ? lowest - from : from - highest);
    const kMax = Math.min(maxOperand, sign === 1 ? highest - from : from - lowest);
    for (let k = kMin; k <= kMax; k++) {
      const to = from + sign * k;
      if (!out[to - lowest] && movementAllowed(from, to, settings)) out[to - lowest] = 1;
    }
  }
  return out;
}

/** The whole numbers from lo to hi. */
function* span(lo: number, hi: number): Generator<number> {
  for (let n = lo; n <= hi; n++) yield n;
}

/** The numbers whose entry in `found` is 1: entry i stands for offset + i. */
function* marked(found: Uint8Array, offset: number): Generator<number> {
  for (let i = 0; i < found.length; i++) if (found[i]) yield offset + i;
}

const stepReachCache = new Map<string, StepReach>();

/** The "Kleine Schritte" reach of `kind` at the parent's settings; memoized on the fields it reads. */
function stepReach(kind: ArithmeticKind, settings: Settings): StepReach {
  return memo(stepReachCache, exactKey(kind, settings), () => {
    const rules = arithmeticRules(kind, settings);
    const first = reach(span(settings.range.min, settings.range.max), rules, settings);
    const last = rules.steps === 1 ? first : reach(marked(first, rules.lowest), rules, settings);
    return { first, answers: [...marked(last, rules.lowest)] };
  });
}

/** Every answer of `kind` that has an exercise at the parent's settings, ascending, before the enemy gap. */
function exactAnswers(kind: ArithmeticKind, settings: Settings): readonly number[] {
  if (isTwoNumbers(kind, settings)) return twoNumberAnswers(twoNumberRules(kind, settings), settings);
  return stepReach(kind, settings).answers;
}

const answersNearCache = new Map<string, number[]>();

/** `exactAnswers` of `kind` that keep minEnemyGap from the player, ascending; memoized per player position. */
function answersAt(kind: ArithmeticKind, settings: Settings, playerPosition: number): number[] {
  return memo(answersNearCache, `${exactKey(kind, settings)}|${playerPosition}`, () => {
    const gap = minEnemyGap(settings.range.min, settings.range.max);
    return exactAnswers(kind, settings).filter((n) => Math.abs(n - playerPosition) >= gap);
  });
}

const answerSetCache = new Map<string, ReadonlySet<number>>();

/**
 * The answers of a plus or minus exercise of the turned-on kinds at the parent's settings (the top step) that keep
 * minEnemyGap from `playerPosition` (amendment 27, research R25). Exact: every answer in the set has an exercise,
 * and no other answer has one. Memoized per settings fields read and player position. Do not change the returned set.
 */
export function arithmeticAnswerSet(settings: Settings, playerPosition: number): ReadonlySet<number> {
  const kinds = turnedOnKinds(settings);
  const key = [...kinds.map((kind) => exactKey(kind, settings)), playerPosition].join('#');
  return memo(answerSetCache, key, () => new Set(kinds.flatMap((kind) => answersAt(kind, settings, playerPosition))));
}

/** A "Kleine Schritte" exercise with the answer `answer` at the parent's settings, operands picked with the rng. */
function stepExercise(kind: ArithmeticKind, answer: number, settings: Settings, rng: Rng): ChallengeDraft | null {
  const rules = arithmeticRules(kind, settings);
  const { min, max } = settings.range;
  const into = (to: number, ok: (from: number) => boolean): number[] => {
    const out: number[] = [];
    for (let k = 1; k <= rules.maxOperand; k++) {
      const from = to - rules.sign * k;
      if (ok(from) && movementAllowed(from, to, settings)) out.push(k);
    }
    return out;
  };
  const isStart = (from: number) => from >= min && from <= max;
  if (rules.steps === 1) {
    const ks = into(answer, isStart);
    if (ks.length === 0) return null;
    const b = rng.pick(ks);
    return arithmeticDraft(kind, [answer - rules.sign * b, b]);
  }
  const { first } = stepReach(kind, settings);
  const cs = into(answer, (middle) => first[middle - rules.lowest] === 1);
  if (cs.length === 0) return null;
  const c = rng.pick(cs);
  const middle = answer - rules.sign * c;
  const bs = into(middle, isStart);
  if (bs.length === 0) return null;
  const b = rng.pick(bs);
  return arithmeticDraft(kind, [middle - rules.sign * b, b, c]);
}

/**
 * Stage 3 of the "Plus und Minus" generator (amendment 27 item 8, FR-163): a plus or minus exercise of the turned-on
 * kinds at the parent's settings whose answer keeps minEnemyGap from `playerPosition`, or null when there is none.
 * The rng picks the kind to try first, the start answer of the walk through `arithmeticAnswerSet` and the operands,
 * so stage 3 does not give the same exercise every time (critique E6).
 *
 * `accept` turns a draft into the caller's result, or null to reject it; the walk then moves on to the next answer
 * and takes the first draft that `accept` keeps (amendment 27 Behavior item 8). Without `accept`, every draft is kept.
 */
export function arithmeticExerciseAt(settings: Settings, playerPosition: number, rng: Rng): ChallengeDraft | null;
export function arithmeticExerciseAt<T>(settings: Settings, playerPosition: number, rng: Rng, accept: (draft: ChallengeDraft) => T | null): T | null;
export function arithmeticExerciseAt<T>(
  settings: Settings,
  playerPosition: number,
  rng: Rng,
  accept: (draft: ChallengeDraft) => T | null = (draft) => draft as T,
): T | null {
  for (const kind of rng.shuffled(turnedOnKinds(settings))) {
    const answers = answersAt(kind, settings, playerPosition);
    if (answers.length === 0) continue;
    const start = rng.int(0, answers.length - 1);
    for (let i = 0; i < answers.length; i++) {
      const answer = answers[(start + i) % answers.length]!;
      const draft = isTwoNumbers(kind, settings) ? twoNumberDraft(kind, answer, settings, TOP_STEP, rng) : stepExercise(kind, answer, settings, rng);
      const result = draft && accept(draft);
      if (result) return result;
    }
  }
  return null;
}
