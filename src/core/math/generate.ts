/**
 * Challenge generation, answer first (research R10, FR-021, FR-025, FR-028, FR-029).
 * The answer is a battlefield position at least minEnemyGap from the player; the question is built to produce it.
 */
import { createRng, deriveSeed, type Rng } from '../rng';
import { additionAnswers, buildAddition } from './addition';
import { arithmeticExerciseAt } from './arithmetic';
import { COMPARISON_KINDS, comparisonAnswers, comparisonBuilders, comparisonFits, isComparisonKind } from './comparison';
import type { Challenge, ChallengeKind, DifficultyStep, InputMethod, PlayMode, RulerLevel, Settings, Skill } from '../types';
import { minEnemyGap } from './gaps';
import { answerCandidates, NUMBER_LINE_KINDS, numberLineBuilders, type Builder, type ChallengeDraft } from './numberLine';
import { buildReadPosition, readPositionAnswers } from './readPosition';
import { mainSkillOf, skillsOf } from './skills';
import { buildSubtraction, subtractionAnswers } from './subtraction';
import { validateChallenge } from './validate';
import { playableSteps } from '../progress/ladders';
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
   * Omitted: readPosition after keyboard input (FR-076), nothing otherwise. "Zahlen-Rätsel" (amendment 27, FR-160)
   * passes 'after' and 'before', which need no ruler; "Plus und Minus" passes none (FR-159).
   */
  fallbackKinds?: readonly ChallengeKind[];
  /**
   * Latest input method (amendment 05, FR-076). With 'keyboard', findNumber is skipped, because typing a given
   * number needs no thinking, and the fallback is readPosition. Omitted: no restriction.
   */
  inputMethod?: InputMethod;
  /**
   * The play modes without a ruler (amendment 17, FR-123; amendment 27): no ruler kind, also not as the final fallback.
   * When no kind fits, "after" or "before" over the whole range comes instead of "find N".
   */
  withoutRuler?: boolean;
  /**
   * "Plus und Minus" (amendment 27 item 8, FR-159, FR-163): no other kind than addition and subtraction, also not as a
   * fallback. When no allowed kind fits at its step, the same kinds at the same step over the whole battlefield come
   * (stage 2), then arithmeticExerciseAt at the parent's settings (stage 3). When stage 3 finds nothing, the generator
   * throws; the settings check `arithmeticModeNoExercise` and modeCanPlay keep it from getting there.
   */
  onlyArithmetic?: boolean;
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

const CANDIDATES: Partial<Record<ChallengeKind, (settings: Settings, step: DifficultyStep) => readonly number[]>> = {
  ...answerCandidates,
  readPosition: (settings, step) => readPositionAnswers(settings, step.rulerLevel ?? 1),
  addition: additionAnswers,
  subtraction: subtractionAnswers,
  // Comparison tanks stand on a drawn line of the minor grid (amendment 20).
  ...Object.fromEntries(COMPARISON_KINDS.map((kind) => [kind, comparisonAnswers])),
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

/** The kinds that need the ruler to be meaningful; the modes without a ruler never generate them (amendment 17, FR-123). */
export const RULER_KINDS: readonly ChallengeKind[] = ['readPosition', 'findNumber'];

/** The kinds of "Plus und Minus" (amendment 27, FR-159). */
const ARITHMETIC_KINDS: readonly ChallengeKind[] = ['addition', 'subtraction'];

export type PlayModeInput = Pick<GenerateInput, 'kindsAllowed' | 'fallbackKinds' | 'withoutRuler' | 'onlyArithmetic'>;

/**
 * The generator input of a play mode (amendment 17, MODE_TRAITS): "Nur Zahlenstrahl" only reads the ruler (FR-122),
 * "Plus und Minus" only the turned-on arithmetic kinds (FR-159), "Zahlen-Rätsel" the turned-on kinds without the
 * arithmetic and ruler kinds and its own fallbacks (FR-160), "Gemischt" adds nothing. `withoutRuler` follows
 * `showsRuler`, and `onlyArithmetic` follows the trait `kinds: 'arithmetic'`, not a field of its own (critique E1).
 */
export function playModeKinds(mode: PlayMode, settings: Settings): PlayModeInput {
  const traits = MODE_TRAITS[mode];
  const out: PlayModeInput = {};
  if (traits.kinds === 'readPosition') out.kindsAllowed = ['readPosition'];
  if (traits.kinds === 'arithmetic') {
    out.kindsAllowed = enabledKinds(settings).filter((k) => ARITHMETIC_KINDS.includes(k));
    out.onlyArithmetic = true;
  }
  if (traits.kinds === 'numbersWithoutRuler') {
    out.kindsAllowed = enabledKinds(settings).filter((k) => !RULER_KINDS.includes(k) && !ARITHMETIC_KINDS.includes(k));
  }
  if (!traits.showsRuler) out.withoutRuler = true;
  if (traits.fallbackKinds) out.fallbackKinds = traits.fallbackKinds;
  return out;
}

/**
 * The difficulty steps a builder works with, tried in order: the main skill's ladder step clamped by the settings,
 * with the round's ruler level (the ruler follows the positions skill only, FR-018, and the controller passes it). On
 * a "Zwei Zahlen" ladder a step without a valid pair moves up to the nearest harder step that has one, and the harder
 * steps follow up to the top, for when the enemy gap leaves no answer of a step (playableSteps, FR-153, review).
 */
function stepsFor(kind: ChallengeKind, input: GenerateInput): DifficultyStep[] {
  const skill = mainSkillOf(kind);
  return playableSteps(skill, input.skillSteps[skill] ?? 0, input.settings).map((step) => ({ ...step, rulerLevel: input.rulerLevel }));
}

/** The first of `stepsFor`. */
function stepFor(kind: ChallengeKind, input: GenerateInput): DifficultyStep {
  return stepsFor(kind, input)[0] as DifficultyStep;
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

/** `wholeRange` ignores the step's "smaller numbers first" and picks from every allowed answer. */
function tryKind(
  kind: ChallengeKind,
  answers: number[],
  input: GenerateInput,
  rng: Rng,
  finish: (draft: ChallengeDraft) => Challenge | null,
  wholeRange = false,
): Challenge | null {
  const build = BUILDERS[kind];
  if (!build) return null;
  const candidates = CANDIDATES[kind];
  // Only a "Zwei Zahlen" kind has more than one step here: a harder step comes when no answer of the easier one keeps
  // the enemy gap from the player (review).
  for (const step of stepsFor(kind, input)) {
    // Every "Zwei Zahlen" step (amendment 26) has maxNumberFraction 1, so withinStep keeps every answer there; those
    // steps narrow by allowCarry and secondFraction instead.
    const inStep = wholeRange ? answers : withinStep(answers, input.settings, step);
    const allowed = new Set(inStep);
    const pool = candidates ? candidates(input.settings, step).filter((n) => allowed.has(n)) : inStep;
    if (pool.length === 0) continue;
    for (let i = 0; i < ANSWER_TRIES; i++) {
      const draft = build(rng.pick(pool), input.settings, step, rng, input.playerPosition);
      const challenge = draft && finish(draft);
      if (challenge) return challenge;
    }
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

  // "Plus und Minus" (amendment 27 item 8): stage 2, the same kinds at the same step over the whole battlefield, then
  // stage 3, the parent's settings. The challenge records the skill's current step (finish), as every challenge does;
  // adaptive difficulty can then count a harder exercise as one of the current step (critique E4, accepted).
  if (input.onlyArithmetic) {
    for (const kind of (input.kindsAllowed ?? []).filter((k) => ARITHMETIC_KINDS.includes(k))) {
      const challenge = tryKind(kind, answers, input, rng, finish, true);
      if (challenge) return challenge;
    }
    const draft = arithmeticExerciseAt(settings, playerPosition, rng);
    const challenge = draft && finish(draft);
    if (challenge) return challenge;
    throw new Error(`generateChallenge: no plus or minus exercise at least the enemy gap from ${playerPosition} in ${settings.range.min} to ${settings.range.max}`);
  }

  // The mode's fallbacks ("Zahlen-Rätsel": "after", "before"), or after keyboard input "read the ruler" instead of
  // "find N" (FR-076).
  for (const kind of input.fallbackKinds ?? (keyboard ? ['readPosition'] : [])) {
    const challenge = tryKind(kind, answers, input, rng, finish);
    if (challenge) return challenge;
  }

  // The modes without a ruler never fall back to a ruler kind (FR-123, amendment 27): "after" or "before" over the whole range, still with the
  // settings, the gaps and the FR-021 rules that validateChallenge checks.
  if (input.withoutRuler) {
    for (const kind of ['after', 'before'] as const) {
      const challenge = tryKind(kind, answers, input, rng, finish, true);
      if (challenge) return challenge;
    }
    // Validation note: the property tests over random valid settings never get here (generator.property.test.ts),
    // because a range spans at least RANGE_SPAN_MIN numbers, so "after" or "before" has an answer that is no range
    // end and keeps minEnemyGap from the player. Only if that ever fails does "find N" below keep the game going.
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
