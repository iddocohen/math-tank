/**
 * Number-line challenge builders (FR-021, research R10).
 * Each builder starts from the answer and builds a question that produces it, or returns null when it cannot.
 */
import { stepsFor } from '../numberline/ticks';
import type { Rng } from '../rng';
import type { Challenge, DifficultyStep, Settings } from '../types';
import { crossesMultiple } from './skills';

export const NUMBER_LINE_KINDS = [
  'findNumber',
  'after',
  'before',
  'stepsRight',
  'stepsLeft',
  'missingBetween',
  'midpoint',
] as const;

export type NumberLineKind = (typeof NUMBER_LINE_KINDS)[number];

/** The parts of a challenge a builder decides; the generator adds id, seed and skills. */
export type ChallengeDraft = Pick<Challenge, 'kind' | 'prompt' | 'operands' | 'answer'> &
  Partial<Pick<Challenge, 'options' | 'steps' | 'rulerLevel'>>;

/** `playerPosition` is passed to every builder; the generator already keeps the answer minEnemyGap from the player. */
export type Builder = (answer: number, settings: Settings, step: DifficultyStep, rng: Rng, playerPosition?: number) => ChallengeDraft | null;

/** Smallest and default largest step count for "move N steps". */
export const MIN_STEP_COUNT = 2;
export const DEFAULT_MAX_STEP_COUNT = 10;

const inRange = (n: number, s: Settings) => Number.isInteger(n) && n >= s.range.min && n <= s.range.max;

/**
 * PO3: an answer that the child finds without the question, because the ruler always labels the range ends, is not
 * used by "after", "before" and the step kinds; "missingBetween" never reaches the ends anyway.
 */
export const isRangeEnd = (n: number, s: Settings) => n === s.range.min || n === s.range.max;

/** Whether moving from `a` to `b` one step at a time is allowed by the crossing settings and the step. */
export function movementAllowed(a: number, b: number, settings: Settings, step?: DifficultyStep): boolean {
  const crossTens = settings.crossTens && (step?.allowCrossTens ?? true);
  if (!crossTens && crossesMultiple(a, b, 10)) return false;
  if (!settings.crossHundreds && crossesMultiple(a, b, 100)) return false;
  return true;
}

/** The major step of the whole configured range, used for midpoint challenges. */
export function rangeMajorStep(settings: Settings): number {
  return stepsFor(settings.range).majorStep;
}

function steps(direction: 1 | -1): Builder {
  return (answer, settings, step, rng) => {
    if (!inRange(answer, settings) || isRangeEnd(answer, settings)) return null;
    const maxK = Math.max(MIN_STEP_COUNT, Math.min(step.maxOperand ?? DEFAULT_MAX_STEP_COUNT, DEFAULT_MAX_STEP_COUNT));
    const options: number[] = [];
    for (let k = MIN_STEP_COUNT; k <= maxK; k++) {
      const start = answer - direction * k;
      // PO3: "Von 2 aus 2 Schritte" reads as if the start and the count were mixed up; never the same number.
      if (k !== start && inRange(start, settings) && movementAllowed(start, answer, settings, step)) options.push(k);
    }
    if (options.length === 0) return null;
    const k = rng.pick(options);
    const n = answer - direction * k;
    const kind = direction === 1 ? 'stepsRight' : 'stepsLeft';
    return { kind, prompt: { key: kind, params: { n, k } }, operands: [n], answer };
  };
}

export const numberLineBuilders: Record<NumberLineKind, Builder> = {
  findNumber: (answer, settings) =>
    inRange(answer, settings)
      ? { kind: 'findNumber', prompt: { key: 'findNumber', params: { n: answer } }, operands: [answer], answer }
      : null,

  after: (answer, settings) => {
    const n = answer - 1;
    if (!inRange(answer, settings) || !inRange(n, settings) || isRangeEnd(answer, settings)) return null;
    return { kind: 'after', prompt: { key: 'after', params: { n } }, operands: [n], answer };
  },

  before: (answer, settings) => {
    const n = answer + 1;
    if (!inRange(answer, settings) || !inRange(n, settings) || isRangeEnd(answer, settings)) return null;
    return { kind: 'before', prompt: { key: 'before', params: { n } }, operands: [n], answer };
  },

  stepsRight: steps(1),
  stepsLeft: steps(-1),

  missingBetween: (answer, settings) => {
    const a = answer - 1;
    const b = answer + 1;
    if (!inRange(a, settings) || !inRange(b, settings)) return null;
    return { kind: 'missingBetween', prompt: { key: 'missingBetween', params: { a, b } }, operands: [a, b], answer };
  },

  midpoint: (answer, settings) => {
    const major = rangeMajorStep(settings);
    if (major % 2 !== 0) return null;
    const a = answer - major / 2;
    const b = answer + major / 2;
    if (a % major !== 0 || !inRange(a, settings) || !inRange(b, settings)) return null;
    return { kind: 'midpoint', prompt: { key: 'midpoint', params: { a: a + 0, b: b + 0 } }, operands: [a + 0, b + 0], answer };
  },
};

/** All answers a midpoint challenge can have in the configured range, so the generator need not search for them. */
export function midpointAnswers(settings: Settings): number[] {
  const major = rangeMajorStep(settings);
  if (major % 2 !== 0) return [];
  const { min, max } = settings.range;
  const out: number[] = [];
  for (let a = Math.ceil(min / major) * major; a + major <= max; a += major) out.push(a + major / 2);
  return out;
}

/** Kinds whose possible answers are few; the generator picks answers only from these lists. */
export const answerCandidates: Partial<Record<NumberLineKind, (settings: Settings, step: DifficultyStep) => number[]>> = {
  midpoint: midpointAnswers,
};

export function isNumberLineKind(kind: string): kind is NumberLineKind {
  return (NUMBER_LINE_KINDS as readonly string[]).includes(kind);
}
