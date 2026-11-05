/**
 * "Read the ruler" challenges (amendment 02, FR-067, FR-068, data-model.md "readPosition placement").
 * The enemy is visible and no number is given; the child fires at the number under the enemy.
 * Only the exact number hits the enemy (amendment 06, core/battle/hitRule.ts); there is no tolerance. Every ruler level
 * draws every line (amendment 20), so the enemy always stands on a drawn line and the exact number can be counted.
 */
import { isMultiple, ticksFor, type RulerLevel } from '../numberline/ticks';
import type { Settings } from '../types';
import type { Builder } from './numberLine';

/** Ruler level used when a difficulty step does not name one. */
export const DEFAULT_RULER_LEVEL: RulerLevel = 1;

/** Computed answers by range and ruler level; a few ranges per session, so the cache stays small. */
const cache = new Map<string, { list: readonly number[]; set: ReadonlySet<number> }>();
const CACHE_LIMIT = 32;

function answersFor(settings: Settings, level: RulerLevel): { list: readonly number[]; set: ReadonlySet<number> } {
  const { min, max } = settings.range;
  const key = `${min}:${max}:${level}`;
  let entry = cache.get(key);
  if (!entry) {
    const { minorStep, ticks } = ticksFor(settings.range, level, 0);
    const list = ticks.filter((t) => t.visible && isMultiple(t.value, minorStep)).map((t) => t.value);
    if (cache.size >= CACHE_LIMIT) cache.clear();
    entry = { list, set: new Set(list) };
    cache.set(key, entry);
  }
  return entry;
}

/**
 * Where the enemy may stand: on every level a whole number with a drawn line on the minor grid (amendment 20; before,
 * levels 4 and 5 allowed any whole number). Computed once per range and level, then reused by the generator
 * and by validateChallenge (code review).
 */
export function readPositionAnswers(settings: Settings, level: RulerLevel): readonly number[] {
  return answersFor(settings, level).list;
}

/** Whether `n` is one of readPositionAnswers(settings, level). */
export function isReadPositionAnswer(settings: Settings, level: RulerLevel, n: number): boolean {
  return answersFor(settings, level).set.has(n);
}

/**
 * The generator only passes answers from readPositionAnswers (its candidates), and validateChallenge checks the answer
 * again, so the builder does not repeat the check.
 */
export const buildReadPosition: Builder = (answer, _settings, step) => {
  const level = step.rulerLevel ?? DEFAULT_RULER_LEVEL;
  return {
    kind: 'readPosition',
    prompt: { key: 'readPosition', params: {} },
    operands: [],
    answer,
    rulerLevel: level,
  };
};
