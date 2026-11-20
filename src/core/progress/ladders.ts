/**
 * Difficulty ladders (FR-018, FR-036, FR-037, data-model.md "Difficulty ladders"). Each skill has a fixed ordered
 * list of steps, easiest first. Parent settings are ceilings: `clampStep` narrows every field to what the settings
 * allow, and only the `positions` ladder sets a ruler level, clamped to [rulerLevelStart, rulerLevelMax].
 */
import { twoNumberAnswers, twoNumberRules } from '../math/twoNumbers';
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

/**
 * "Zwei Zahlen" ladders (amendment 26, FR-153): no carrying with the lower half of the second range, no carrying with
 * the whole ranges, carrying with the lower half, then the parent's settings. Same length as the addition and
 * subtraction ladders above, so a stored step index keeps its place when the parent changes "Zahlengröße".
 * maxNumberFraction and allowCrossTens are not used by these exercises.
 */
const TWO_NUMBER_STEPS: DifficultyStep[] = [
  { maxNumberFraction: 1, allowCrossTens: true, allowCarry: false, secondFraction: 0.5 },
  { maxNumberFraction: 1, allowCrossTens: true, allowCarry: false, secondFraction: 1 },
  { maxNumberFraction: 1, allowCrossTens: true, allowCarry: true, secondFraction: 0.5 },
  { maxNumberFraction: 1, allowCrossTens: true, allowCarry: true, secondFraction: 1 },
];

export const twoNumberLadders: Record<'addition' | 'subtraction', DifficultyStep[]> = {
  addition: TWO_NUMBER_STEPS.map((s) => ({ ...s })),
  subtraction: TWO_NUMBER_STEPS.map((s) => ({ ...s })),
};

/** The "Zwei Zahlen" kind of a skill when the parent chose "Zwei Zahlen" for it, else undefined. */
function twoNumberKind(skill: Skill, settings: Settings): 'addition' | 'subtraction' | undefined {
  return (skill === 'addition' || skill === 'subtraction') && settings[skill].size === 'twoNumbers' ? skill : undefined;
}

/** The ladder a skill uses with these settings: the "Zwei Zahlen" ladder for plus or minus with "Zwei Zahlen" on. */
export function ladderFor(skill: Skill, settings: Settings): DifficultyStep[] {
  const kind = twoNumberKind(skill, settings);
  return kind ? twoNumberLadders[kind] : ladders[skill];
}

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
  const ladder = ladderFor(skill, settings);
  const raw = ladder[clamp(Math.trunc(index), 0, ladder.length - 1)] as DifficultyStep;
  const out: DifficultyStep = {
    maxNumberFraction: clamp(raw.maxNumberFraction, 0, 1),
    allowCrossTens: raw.allowCrossTens && settings.crossTens,
  };
  const kind = twoNumberKind(skill, settings);
  if (kind) {
    // "Zwei Zahlen" has no operand limit; the parent's carry switch is the ceiling (FR-153). A carrying step with the
    // switch off becomes the parent's settings (whole second range), so steps 3 and 4 fold into step 2 and a step up
    // never goes back to the lower half of the second range.
    const carry = settings[kind].carry;
    const wantsCarry = raw.allowCarry ?? true;
    out.allowCarry = wantsCarry && carry;
    out.secondFraction = wantsCarry && !carry ? 1 : clamp(raw.secondFraction ?? 1, 0, 1);
    return out;
  }
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
    a.rulerLevel === b.rulerLevel &&
    a.allowCarry === b.allowCarry &&
    a.secondFraction === b.secondFraction
  );
}

/**
 * The highest step the parent settings allow: the first index whose clamped step equals the clamped top of the
 * ladder. Steps above it look the same to the child.
 */
export function topStep(skill: Skill, settings: Settings): number {
  const ladder = ladderFor(skill, settings);
  const top = clampStep(skill, ladder.length - 1, settings);
  let i = ladder.length - 1;
  while (i > 0 && sameStep(clampStep(skill, i - 1, settings), top)) i -= 1;
  return i;
}

/** The next step up whose clamped content differs from `index`, or `index` when there is none. */
export function stepUp(skill: Skill, index: number, settings: Settings): number {
  const current = clampStep(skill, index, settings);
  for (let j = index + 1; j < ladderFor(skill, settings).length; j++) if (!sameStep(clampStep(skill, j, settings), current)) return j;
  return index;
}

/** The nearest step down whose clamped content differs from `index`, or `index` when there is none. */
export function stepDown(skill: Skill, index: number, settings: Settings): number {
  const from = Math.min(index, ladderFor(skill, settings).length - 1);
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
    const top = clampStep(skill, ladderFor(skill, settings).length - 1, settings);
    if (top.rulerLevel !== undefined) top.rulerLevel = settings.rulerLevelStart;
    return top;
  }
  return playableStep(skill, p.skills[skillKey(skill, rangeKey)]?.step ?? 0, settings);
}

/**
 * The clamped step the generator builds exercises with (FR-153, critique E2). On a "Zwei Zahlen" ladder a step can
 * have no valid pair (first numbers 90 to 99 carry with every second number of 10 or more), so this walks up to the
 * nearest harder step that has one, ending at the top step. Other ladders, and steps with an exercise, return
 * `clampStep` unchanged. The stored step index is not changed: the child's progress stays where it is.
 * Lives here, not in core/math/generate.ts, so effectiveStep and the generator share it; core/math/twoNumbers.ts
 * imports only types, so there is no import cycle.
 */
export function playableStep(skill: Skill, index: number, settings: Settings): DifficultyStep {
  const step = clampStep(skill, index, settings);
  const kind = twoNumberKind(skill, settings);
  if (!kind) return step;
  const last = ladderFor(skill, settings).length - 1;
  for (let i = clamp(Math.trunc(index), 0, last); i <= last; i++) {
    const candidate = clampStep(skill, i, settings);
    if (twoNumberAnswers(twoNumberRules(kind, settings, candidate), settings).length > 0) return candidate;
  }
  return clampStep(skill, last, settings);
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
      ? Math.min(p.skills[skillKey(skill, rangeKey)]?.step ?? 0, ladderFor(skill, settings).length - 1)
      : topStep(skill, settings);
  }
  return out;
}
