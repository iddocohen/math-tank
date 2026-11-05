/**
 * Difficulty ladders (FR-018, FR-036, FR-037, data-model.md "Difficulty ladders"). Each skill has a fixed ordered
 * list of steps, easiest first. Parent settings are ceilings: `clampStep` narrows every field to what the settings
 * allow, and only the `positions` ladder sets a ruler level, clamped to [rulerLevelStart, rulerLevelMax].
 */
import { clamp } from '../util';
import type { DifficultyStep, Progress, RulerLevel, Settings, Skill } from '../types';

export const ladders: Record<Skill, DifficultyStep[]> = {
  // Smaller part of the range first, then the whole range, then a sparser ruler one level at a time.
  positions: [
    { maxNumberFraction: 0.2, allowCrossTens: true, rulerLevel: 1 },
    { maxNumberFraction: 0.5, allowCrossTens: true, rulerLevel: 1 },
    { maxNumberFraction: 1, allowCrossTens: true, rulerLevel: 1 },
    { maxNumberFraction: 1, allowCrossTens: true, rulerLevel: 2 },
    { maxNumberFraction: 1, allowCrossTens: true, rulerLevel: 3 },
    { maxNumberFraction: 1, allowCrossTens: true, rulerLevel: 4 },
    { maxNumberFraction: 1, allowCrossTens: true, rulerLevel: 5 },
  ],
  // maxOperand is the most steps counted at once.
  countForward: [
    { maxNumberFraction: 0.2, allowCrossTens: false, maxOperand: 3 },
    { maxNumberFraction: 0.5, allowCrossTens: false, maxOperand: 5 },
    { maxNumberFraction: 1, allowCrossTens: true },
  ],
  countBackward: [
    { maxNumberFraction: 0.2, allowCrossTens: false, maxOperand: 3 },
    { maxNumberFraction: 0.5, allowCrossTens: false, maxOperand: 5 },
    { maxNumberFraction: 1, allowCrossTens: true },
  ],
  tens: [
    { maxNumberFraction: 0.2, allowCrossTens: true },
    { maxNumberFraction: 0.5, allowCrossTens: true },
    { maxNumberFraction: 1, allowCrossTens: true },
  ],
  crossTens: [
    { maxNumberFraction: 0.2, allowCrossTens: true },
    { maxNumberFraction: 0.5, allowCrossTens: true },
    { maxNumberFraction: 1, allowCrossTens: true },
  ],
  // Small operands without crossing, then larger, then crossing tens, then the parent's limits.
  addition: [
    { maxNumberFraction: 0.5, allowCrossTens: false, maxOperand: 5 },
    { maxNumberFraction: 1, allowCrossTens: false, maxOperand: 10 },
    { maxNumberFraction: 1, allowCrossTens: true, maxOperand: 10 },
    { maxNumberFraction: 1, allowCrossTens: true },
  ],
  subtraction: [
    { maxNumberFraction: 0.5, allowCrossTens: false, maxOperand: 5 },
    { maxNumberFraction: 1, allowCrossTens: false, maxOperand: 10 },
    { maxNumberFraction: 1, allowCrossTens: true, maxOperand: 10 },
    { maxNumberFraction: 1, allowCrossTens: true },
  ],
  comparison: [
    { maxNumberFraction: 0.2, allowCrossTens: true },
    { maxNumberFraction: 0.5, allowCrossTens: true },
    { maxNumberFraction: 1, allowCrossTens: true },
  ],
};

/** Key of a skill and range in Progress.skills. */
export function skillKey(skill: Skill, rangeKey: string): string {
  return `${skill}|${rangeKey}`;
}

function clampRuler(level: RulerLevel, settings: Settings): RulerLevel {
  return clamp(level, settings.rulerLevelStart, settings.rulerLevelMax) as RulerLevel;
}

/** The parent's operand limit for a skill, if the settings have one. */
function operandLimit(skill: Skill, settings: Settings): number | undefined {
  if (skill === 'addition') return settings.addition.maxOperand;
  if (skill === 'subtraction') return settings.subtraction.maxOperand;
  return undefined;
}

/** Ladder step `index` (clamped to the ladder) with every field narrowed to the parent settings. */
export function clampStep(skill: Skill, index: number, settings: Settings): DifficultyStep {
  const ladder = ladders[skill];
  const raw = ladder[clamp(Math.trunc(index), 0, ladder.length - 1)] as DifficultyStep;
  const out: DifficultyStep = {
    maxNumberFraction: clamp(raw.maxNumberFraction, 0, 1),
    allowCrossTens: raw.allowCrossTens && settings.crossTens,
  };
  const limit = operandLimit(skill, settings);
  const maxOperand = limit === undefined ? raw.maxOperand : Math.min(raw.maxOperand ?? limit, limit);
  if (maxOperand !== undefined) out.maxOperand = maxOperand;
  if (raw.rulerLevel !== undefined) out.rulerLevel = clampRuler(raw.rulerLevel, settings);
  return out;
}

function sameStep(a: DifficultyStep, b: DifficultyStep): boolean {
  return (
    a.maxNumberFraction === b.maxNumberFraction &&
    a.allowCrossTens === b.allowCrossTens &&
    a.maxOperand === b.maxOperand &&
    a.rulerLevel === b.rulerLevel
  );
}

/**
 * The highest step the parent settings allow: the first index whose clamped step equals the clamped top of the
 * ladder. Steps above it look the same to the child.
 */
export function topStep(skill: Skill, settings: Settings): number {
  const ladder = ladders[skill];
  const top = clampStep(skill, ladder.length - 1, settings);
  let i = ladder.length - 1;
  while (i > 0 && sameStep(clampStep(skill, i - 1, settings), top)) i -= 1;
  return i;
}

/** The next step up whose clamped content differs from `index`, or `index` when there is none. */
export function stepUp(skill: Skill, index: number, settings: Settings): number {
  const current = clampStep(skill, index, settings);
  for (let j = index + 1; j < ladders[skill].length; j++) if (!sameStep(clampStep(skill, j, settings), current)) return j;
  return index;
}

/** The nearest step down whose clamped content differs from `index`, or `index` when there is none. */
export function stepDown(skill: Skill, index: number, settings: Settings): number {
  const from = Math.min(index, ladders[skill].length - 1);
  const current = clampStep(skill, from, settings);
  for (let j = from - 1; j >= 0; j--) if (!sameStep(clampStep(skill, j, settings), current)) return j;
  return index;
}

/**
 * The step the generator uses for a skill in a range (FR-037). With adaptive off: the top of the ladder clamped by
 * the settings, and on the positions ladder the parent's starting ruler level (FR-018).
 */
export function effectiveStep(p: Progress, skill: Skill, rangeKey: string, settings: Settings): DifficultyStep {
  if (!settings.adaptive) {
    const top = clampStep(skill, ladders[skill].length - 1, settings);
    if (top.rulerLevel !== undefined) top.rulerLevel = settings.rulerLevelStart;
    return top;
  }
  return clampStep(skill, p.skills[skillKey(skill, rangeKey)]?.step ?? 0, settings);
}

/** The ruler level for a range: it follows the positions skill only, so it does not change between kinds (FR-018). */
export function rulerLevelFor(p: Progress, rangeKey: string, settings: Settings): RulerLevel {
  return effectiveStep(p, 'positions', rangeKey, settings).rulerLevel ?? settings.rulerLevelStart;
}

/** The last index of every ladder: with it the generator uses the parent settings unchanged. */
export const LAST_STEPS: Record<Skill, number> = Object.fromEntries(
  Object.entries(ladders).map(([skill, ladder]) => [skill, ladder.length - 1]),
) as Record<Skill, number>;

/**
 * The ladder index per skill the generator uses in a range (FR-037): the stored step with adaptive difficulty on
 * (the easiest step for a skill not played yet), the top step the settings allow with it off.
 */
export function skillStepsFor(p: Progress, rangeKey: string, settings: Settings): Record<Skill, number> {
  const out = {} as Record<Skill, number>;
  for (const skill of Object.keys(ladders) as Skill[]) {
    out[skill] = settings.adaptive
      ? Math.min(p.skills[skillKey(skill, rangeKey)]?.step ?? 0, ladders[skill].length - 1)
      : topStep(skill, settings);
  }
  return out;
}
