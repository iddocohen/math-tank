/**
 * "Read the ruler" challenges (amendment 02, FR-067, FR-068, data-model.md "readPosition placement").
 * The enemy is visible and no number is given; the child fires at the number under the enemy.
 * Whether a shot hits follows the tank-body rule in core/battle/hitRule.ts (amendment 04); there is no tolerance.
 */
import { ticksFor, type RulerLevel } from '../numberline/ticks';
import type { Settings } from '../types';
import type { Builder } from './numberLine';

const isMultiple = (v: number, step: number) => ((v % step) + step) % step === 0;

/** Ruler level used when a difficulty step does not name one. */
export const DEFAULT_RULER_LEVEL: RulerLevel = 1;

/**
 * Where the enemy may stand: on levels 1 to 3 a whole number with a visible line on the minor grid,
 * on levels 4 and 5 any whole number in the range.
 */
export function readPositionAnswers(settings: Settings, level: RulerLevel): number[] {
  const { min, max } = settings.range;
  if (level >= 4) {
    const out: number[] = [];
    for (let n = min; n <= max; n++) out.push(n);
    return out;
  }
  const { minorStep, ticks } = ticksFor(settings.range, level, 0);
  return ticks.filter((t) => t.visible && isMultiple(t.value, minorStep)).map((t) => t.value);
}

export const buildReadPosition: Builder = (answer, settings, step) => {
  const level = step.rulerLevel ?? DEFAULT_RULER_LEVEL;
  if (!readPositionAnswers(settings, level).includes(answer)) return null;
  return {
    kind: 'readPosition',
    prompt: { key: 'readPosition', params: {} },
    operands: [],
    answer,
    rulerLevel: level,
  };
};
