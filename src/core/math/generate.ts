/**
 * Challenge generation, answer first (research R10, FR-021, FR-025, FR-028, FR-029).
 * The answer is a battlefield position at least minEnemyGap from the player; the question is built to produce it.
 */
import { createRng, deriveSeed, type Rng } from '../rng';
import { additionAnswers, buildAddition } from './addition';
import { COMPARISON_KINDS, comparisonBuilders, comparisonFits, isComparisonKind } from './comparison';
import type { Challenge, ChallengeKind, DifficultyStep, InputMethod, PlayMode, RulerLevel, Settings, Skill } from '../types';
import { minEnemyGap } from './gaps';
import { answerCandidates, NUMBER_LINE_KINDS, numberLineBuilders, type Builder, type ChallengeDraft } from './numberLine';
import { buildReadPosition, readPositionAnswers } from './readPosition';
import { mainSkillOf, skillsOf } from './skills';
import { buildSubtraction, subtractionAnswers } from './subtraction';
import { validateChallenge } from './validate';
import { clampStep } from '../progress/ladders';
import { MODE_TRAITS } from '../modes';

export interface GenerateInput {
  settings: Settings;
  /**
   * Current difficulty step per skill: an index into the skill's ladder (progress/ladders.ts). The main skill's step
   * narrows the choices: the lowest part of the range for the answer, the largest operand and crossing tens. The
   * parent settings stay ceilings (FR-037). `LAST_STEPS` uses the parent settings unchanged.
   */
  skillSteps: Record<Skill, number>;
  /** The challenge seed is derived from the round seed and the turn. */
  roundSeed: number;
  turn: number;
  /** range.min or range.max, fixed for the round. */
  playerPosition: number;
  /** Ruler level of the round; decides where a readPosition enemy may stand (FR-067). */
  rulerLevel: RulerLevel;
  /** Restricts the kinds, whatever the challenge-type switches say; see playModeKinds (amendment 17). */
  kindsAllowed?: ChallengeKind[];
  /**
   * The kinds tried in order when no allowed kind fits, before the final "find N" fallback (ModeTraits.fallbackKinds).
   * Omitted: readPosition after keyboard input (FR-076), nothing otherwise. "Nur Rechnen" (amendment 17, FR-123) passes
   * 'after' and 'before', which need no ruler.
   */
  fallbackKinds?: readonly ChallengeKind[];
  /**
   * Latest input method (amendment 05, FR-076). With 'keyboard', findNumber is skipped, because typing a given
   * number needs no thinking, and the fallback is readPosition. Omitted: no restriction.
   */
  inputMethod?: InputMethod;
}

/** Answers tried per kind before the generator moves on to another kind (research R10). */
export const ANSWER_TRIES = 50;

/** Salt for deriveSeed; kept at the value searches used before the bonus purpose was removed, so seeds stay stable. */
const SEED_SALT = 1;

/** Builders per kind. */
const BUILDERS: Partial<Record<ChallengeKind, Builder>> = {
  ...numberLineBuilders,
  readPosition: buildReadPosition,
  addition: buildAddition,
  subtraction: buildSubtraction,
  ...comparisonBuilders,
};

const CANDIDATES: Partial<Record<ChallengeKind, (settings: Settings, step: DifficultyStep) => number[]>> = {
  ...answerCandidates,
  readPosition: (settings, step) => readPositionAnswers(settings, step.rulerLevel ?? 1),
  addition: additionAnswers,
  subtraction: subtractionAnswers,
};

/** The kinds the parent's challenge-type switches turn on. */
export function enabledKinds(settings: Settings): ChallengeKind[] {
  const kinds: ChallengeKind[] = [];
  if (settings.challengeTypes.numberLine) kinds.push(...NUMBER_LINE_KINDS, 'readPosition');
  if (settings.challengeTypes.addition) kinds.push('addition');
  if (settings.challengeTypes.subtraction) kinds.push('subtraction');
  if (settings.challengeTypes.comparison) {
    kinds.push(...COMPARISON_KINDS);
  }
  return kinds;
}

/** The kinds that need the ruler to be meaningful; "Nur Rechnen" never generates them (amendment 17, FR-123). */
export const RULER_KINDS: readonly ChallengeKind[] = ['readPosition', 'findNumber'];

/**
 * The generator input of a play mode (amendment 17, MODE_TRAITS): "Nur Zahlenstrahl" only reads the ruler (FR-122),
 * "Nur Rechnen" uses the enabled kinds without the ruler kinds and its own fallbacks (FR-123), "Gemischt" adds nothing.
 */
export function playModeKinds(mode: PlayMode, settings: Settings): Pick<GenerateInput, 'kindsAllowed' | 'fallbackKinds'> {
  const traits = MODE_TRAITS[mode];
  const out: Pick<GenerateInput, 'kindsAllowed' | 'fallbackKinds'> = {};
  if (traits.kinds === 'readPosition') out.kindsAllowed = ['readPosition'];
  if (traits.kinds === 'enabledWithoutRuler') out.kindsAllowed = enabledKinds(settings).filter((k) => !RULER_KINDS.includes(k));
  if (traits.fallbackKinds) out.fallbackKinds = traits.fallbackKinds;
  return out;
}

/**
 * The difficulty step a builder works with: the main skill's ladder step clamped by the settings, with the round's
 * ruler level (the ruler follows the positions skill only, FR-018, and the controller passes it).
 */
function stepFor(kind: ChallengeKind, input: GenerateInput): DifficultyStep {
  const skill = mainSkillOf(kind);
  return { ...clampStep(skill, input.skillSteps[skill] ?? 0, input.settings), rulerLevel: input.rulerLevel };
}

/**
 * A step's "smaller numbers first": the answers from the smallest allowed answer up to `maxNumberFraction` of the
 * range width above it. Starting at the smallest allowed answer, not at range.min, keeps the same choice of numbers
 * when the player stands at range.min and the enemy must keep its distance (FR-010a). `answers` is ascending.
 */
function withinStep(answers: number[], settings: Settings, step: DifficultyStep): number[] {
  const lowest = answers[0];
  if (step.maxNumberFraction >= 1 || lowest === undefined) return answers;
  const highest = lowest + step.maxNumberFraction * (settings.range.max - settings.range.min);
  return answers.filter((n) => n <= highest);
}

/** Whole numbers in the range at least minEnemyGap from the player, ascending. */
function allowedAnswers(settings: Settings, playerPosition: number): number[] {
  const { min, max } = settings.range;
  const gap = minEnemyGap(min, max);
  const out: number[] = [];
  for (let n = min; n <= max; n++) if (Math.abs(n - playerPosition) >= gap) out.push(n);
  return out;
}

function tryKind(
  kind: ChallengeKind,
  answers: number[],
  input: GenerateInput,
  rng: Rng,
  finish: (draft: ChallengeDraft) => Challenge | null,
): Challenge | null {
  const build = BUILDERS[kind];
  if (!build) return null;
  const step = stepFor(kind, input);
  const candidates = CANDIDATES[kind];
  const inStep = withinStep(answers, input.settings, step);
  const allowed = new Set(inStep);
  const pool = candidates ? candidates(input.settings, step).filter((n) => allowed.has(n)) : inStep;
  if (pool.length === 0) return null;
  for (let i = 0; i < ANSWER_TRIES; i++) {
    const draft = build(rng.pick(pool), input.settings, step, rng, input.playerPosition);
    const challenge = draft && finish(draft);
    if (challenge) return challenge;
  }
  return null;
}

export function generateChallenge(input: GenerateInput): Challenge {
  const { settings, playerPosition } = input;
  const seed = deriveSeed(input.roundSeed, input.turn, SEED_SALT);
  const rng = createRng(seed);
  const answers = allowedAnswers(settings, playerPosition);

  const finish = (draft: ChallengeDraft): Challenge | null => {
    const mainSkill = mainSkillOf(draft.kind);
    const challenge: Challenge = {
      id: `${input.roundSeed}-${input.turn}`,
      seed,
      ...draft,
      difficultyStep: input.skillSteps[mainSkill] ?? 0,
      mainSkill,
      skills: skillsOf(draft),
    };
    return validateChallenge(challenge, settings, playerPosition).length === 0 ? challenge : null;
  };

  const keyboard = input.inputMethod === 'keyboard';
  // A comparison kind is skipped when its options do not fit at minOptionGap clear of the player tank (edge case
  // "Comparison options too close together", amendment 10).
  let kinds = (input.kindsAllowed ?? enabledKinds(settings)).filter(
    (k) => BUILDERS[k] !== undefined && !(keyboard && k === 'findNumber') && !(isComparisonKind(k) && !comparisonFits(k, settings, playerPosition)),
  );

  while (kinds.length > 0) {
    const kind = rng.pick(kinds);
    const challenge = tryKind(kind, answers, input, rng, finish);
    if (challenge) return challenge;
    kinds = kinds.filter((k) => k !== kind);
  }

  // The mode's fallbacks ("Nur Rechnen": "after", "before"), or after keyboard input "read the ruler" instead of
  // "find N" (FR-076).
  for (const kind of input.fallbackKinds ?? (keyboard ? ['readPosition'] : [])) {
    const challenge = tryKind(kind, answers, input, rng, finish);
    if (challenge) return challenge;
  }

  // Fallback: "find N" always works for an allowed answer (FR-029). Answers within the positions step come first; a
  // very small range can leave none there, and then any allowed answer is used.
  const findStep = stepFor('findNumber', input);
  const inStep = withinStep(answers, settings, findStep);
  for (const answer of [...(inStep.length > 0 ? [rng.pick(inStep), ...inStep] : [rng.pick(answers)]), ...answers]) {
    const challenge = finish(numberLineBuilders.findNumber(answer, settings, findStep, rng)!);
    if (challenge) return challenge;
  }
  throw new Error(`generateChallenge: no allowed answer in ${settings.range.min} to ${settings.range.max}`);
}
