/**
 * Challenge generation, answer first (research R10, FR-021, FR-025, FR-028, FR-029).
 * The answer is a battlefield position at least minEnemyGap from the player; the question is built to produce it.
 */
import { createRng, deriveSeed, type Rng } from '../rng';
import type { Challenge, ChallengeKind, DifficultyStep, Settings, Skill } from '../types';
import { minEnemyGap } from './gaps';
import { answerCandidates, NUMBER_LINE_KINDS, numberLineBuilders, type Builder, type ChallengeDraft } from './numberLine';
import { mainSkillOf, skillsOf } from './skills';
import { validateChallenge } from './validate';

export interface GenerateInput {
  settings: Settings;
  /** Current difficulty step per skill. */
  skillSteps: Record<Skill, number>;
  /** The challenge seed is derived from the round seed, the turn and the purpose. */
  roundSeed: number;
  turn: number;
  /** range.min or range.max, fixed for the round. */
  playerPosition: number;
  /** Bonus challenges exclude comparison kinds (FR-014). */
  purpose: 'search' | 'bonus';
  kindsAllowed?: ChallengeKind[];
}

/** Answers tried per kind before the generator moves on to another kind (research R10). */
export const ANSWER_TRIES = 50;

const PURPOSE_SALT = { search: 1, bonus: 2 } as const;

const COMPARISON_KINDS: ReadonlySet<ChallengeKind> = new Set([
  'greater',
  'smaller',
  'equal',
  'order3',
  'largest3',
  'smallest3',
  'closestTo',
  'between',
]);

/**
 * Builders per kind. Addition, subtraction and comparison builders are added in later phases;
 * until then the generator offers only the kinds listed here.
 */
const BUILDERS: Partial<Record<ChallengeKind, Builder>> = { ...numberLineBuilders };

function enabledKinds(settings: Settings): ChallengeKind[] {
  const kinds: ChallengeKind[] = [];
  if (settings.challengeTypes.numberLine) kinds.push(...NUMBER_LINE_KINDS);
  if (settings.challengeTypes.addition) kinds.push('addition');
  if (settings.challengeTypes.subtraction) kinds.push('subtraction');
  if (settings.challengeTypes.comparison) {
    kinds.push('greater', 'smaller', 'equal', 'order3', 'largest3', 'smallest3', 'closestTo', 'between');
  }
  return kinds;
}

/**
 * The difficulty step a builder works with. Until the ladders exist (Phase 17), every skill uses the
 * whole range and the parent settings.
 */
function stepFor(settings: Settings): DifficultyStep {
  return { maxNumberFraction: 1, allowCrossTens: settings.crossTens };
}

/** Whole numbers in the range at least minEnemyGap from the player. */
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
  const candidates = answerCandidates[kind as keyof typeof answerCandidates];
  const pool = candidates ? candidates(input.settings).filter((n) => answers.includes(n)) : answers;
  if (pool.length === 0) return null;
  const step = stepFor(input.settings);
  for (let i = 0; i < ANSWER_TRIES; i++) {
    const draft = build(rng.pick(pool), input.settings, step, rng);
    const challenge = draft && finish(draft);
    if (challenge) return challenge;
  }
  return null;
}

export function generateChallenge(input: GenerateInput): Challenge {
  const { settings, playerPosition, purpose } = input;
  const seed = deriveSeed(input.roundSeed, input.turn, PURPOSE_SALT[purpose]);
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

  let kinds = enabledKinds(settings).filter((k) => BUILDERS[k] !== undefined);
  if (input.kindsAllowed) kinds = kinds.filter((k) => input.kindsAllowed!.includes(k));
  if (purpose === 'bonus') kinds = kinds.filter((k) => !COMPARISON_KINDS.has(k));

  while (kinds.length > 0) {
    const kind = rng.pick(kinds);
    const challenge = tryKind(kind, answers, input, rng, finish);
    if (challenge) return challenge;
    kinds = kinds.filter((k) => k !== kind);
  }

  // Fallback: "find N" always works for an allowed answer (FR-029).
  for (const answer of [rng.pick(answers), ...answers]) {
    const challenge = finish(numberLineBuilders.findNumber(answer, settings, stepFor(settings), rng)!);
    if (challenge) return challenge;
  }
  throw new Error(`generateChallenge: no allowed answer in ${settings.range.min} to ${settings.range.max}`);
}
