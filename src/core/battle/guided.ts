/**
 * Guided mode (US2, FR-010, FR-010a, FR-013, FR-076, amendment 06): a search is one challenge whose answer is the
 * enemy's number. The enemy and its pointer line are visible in every challenge kind (amendment 07). Every fire is an
 * answer: only the exact number destroys the enemy, then a new enemy and a new search follow. A near miss
 * on the body and a plain miss both count as a miss for the help steps. Pure functions: each returns a new state.
 */
import { deriveSeed } from '../rng';
import type { Challenge, FeedbackMessage, RoundState, Settings, TankState } from '../types';
import { enabledKinds, generateChallenge, playModeKinds } from '../math/generate';
import { isComparisonKind } from '../math/comparison';
import { stepPath } from '../math/stepPath';
import { emptyEntry } from './entry';
import { nextHelp } from './help';
import { MODE_TRAITS } from '../modes';
import { makeTank, moveTank, parentDifficulty, type Difficulty } from './round';

/** Answers count only after the challenge has been visible this long (edge case "Rapid tapping or typing"). */
export const ANSWER_DELAY_MS = 1000;

/** The help step that shows the solution: the selection jumps to the answer (FR-013). */
export const SOLUTION_HELP_LEVEL = 3;

/** Tries for a new answer before the same number as the destroyed enemy is accepted again. */
const NEW_POSITION_TRIES = 8;

export interface SearchOptions {
  /** Another answer than this one whenever possible (the number of the enemy just destroyed). */
  avoid: number | null;
  /** The skill steps the challenge is built with and the ruler level of the search. */
  difficulty: Difficulty;
  /** Never a comparison: the search right after "Neue Landschaft" (amendment 08 item 1, amendment 10 item 10). */
  noComparison: boolean;
}

/**
 * The challenge of a guided search in the round `s` (its seed, turn, player position, input method and play mode).
 * The latest input method decides whether findNumber may come: before any input the game treats the input as keyboard
 * input (FR-076). With `noComparison` exactly one tank stands opposite the child. The play mode (amendment 17):
 * "Nur Zahlenstrahl" only reads the ruler, "Nur Rechnen" never uses the ruler kinds (playModeKinds).
 */
export function searchChallenge(s: RoundState, settings: Settings, { avoid, difficulty, noComparison }: SearchOptions): Challenge {
  const byMode = playModeKinds(s.mode, settings);
  const base = byMode.kindsAllowed ?? enabledKinds(settings);
  const kindsAllowed = noComparison ? base.filter((k) => !isComparisonKind(k)) : byMode.kindsAllowed;
  let challenge: Challenge | null = null;
  for (let i = 0; i < NEW_POSITION_TRIES; i++) {
    challenge = generateChallenge({
      settings,
      skillSteps: difficulty.skillSteps,
      roundSeed: i === 0 ? s.seed : deriveSeed(s.seed, 4, i),
      turn: s.turn,
      playerPosition: s.player.position,
      rulerLevel: difficulty.rulerLevel,
      inputMethod: s.inputMethod ?? 'keyboard',
      ...(kindsAllowed ? { kindsAllowed } : {}),
      ...(byMode.fallbackKinds ? { fallbackKinds: byMode.fallbackKinds } : {}),
      ...(byMode.withoutRuler ? { withoutRuler: true } : {}),
    });
    if (challenge.answer !== avoid) break;
  }
  return challenge!;
}

/**
 * A new search: a new challenge, the enemy moved to its answer (visible, amendment 07), help and
 * input reset, answers accepted from `now + ANSWER_DELAY_MS`. lastShot stays, so the feedback of the previous shot
 * remains visible.
 *
 * Comparison (US4, FR-026, FR-027, amendment 10): the banner names the options; the enemy stands at the answer and a
 * decoy, which looks the same and carries no number plate, at each other option. Other searches have no decoys.
 *
 * `difficulty` (US7, FR-018, FR-037): the skill steps the challenge is built with and the ruler level of the search.
 * `noComparison` (amendment 08 item 1, amendment 10 item 10): the search right after "Neue Landschaft".
 */
export function startSearch(
  s: RoundState,
  settings: Settings,
  now: number,
  avoid: number | null,
  difficulty: Difficulty = { ...parentDifficulty(settings), rulerLevel: s.rulerLevel },
  noComparison = false,
): RoundState {
  const rulerLevel = difficulty.rulerLevel;
  const challenge = searchChallenge(s, settings, { avoid, difficulty, noComparison });
  const enemy: TankState = { ...moveTank(s.enemy, challenge.answer, settings, s.terrain), alive: true };
  const decoys: TankState[] = (challenge.options ?? [])
    .filter((n) => n !== challenge.answer)
    .map((n, i) => makeTank(`decoy-${challenge.id}-${i}`, 'decoy', n, settings, s.terrain));
  return {
    ...s,
    phase: 'challenge',
    rulerLevel,
    challenge,
    enemy,
    decoys,
    answerableAt: now + ANSWER_DELAY_MS,
    help: { level: 0, wrongAnswers: 0, wrongAnswerTimes: [], content: null },
    message: null,
    selection: null,
    entry: emptyEntry(),
    stepAnimation: null,
  };
}

/** The landing number of the search's latest miss, or null before any miss (the help steps count from it). */
export function landedOf(s: RoundState): number | null {
  return s.help.wrongAnswers > 0 && s.lastShot && !s.lastShot.hit ? s.lastShot.landed : null;
}

/**
 * The next help step (US5, FR-031): help.level + 1, or further when the parent turned that step's help types off
 * (FR-032, nextHelp). At the solution step the selection is the answer, so one tap on fire or Enter fires at it
 * (FR-013). A step path already running is kept, so the animation does not start again.
 */
export function raiseHelp(s: RoundState, settings: Settings): RoundState {
  const c = s.challenge;
  if (!c || s.help.level >= SOLUTION_HELP_LEVEL) return s;
  const content = nextHelp(c, s.help.level + 1, landedOf(s), settings, MODE_TRAITS[s.mode].showsRuler);
  const selection = content.step === SOLUTION_HELP_LEVEL ? c.answer : s.selection;
  const stepAnimation = s.stepAnimation ?? content.stepPath;
  return { ...s, help: { ...s.help, level: content.step, content }, selection, stepAnimation };
}

/**
 * The help button, H or a parent-set time limit (FR-030, FR-034): the next help step, not a shot, no heart. A help
 * request on an addition or subtraction also starts the step path at once (US3 scenario 1); after misses it comes at
 * step 2.
 */
export function afterHelpRequest(s: RoundState, settings: Settings): RoundState {
  const next = raiseHelp(s, settings);
  const c = next.challenge;
  if (next === s || !c || next.stepAnimation || !settings.help.stepAnimation) return next;
  if (c.kind !== 'addition' && c.kind !== 'subtraction') return next;
  return { ...next, stepAnimation: stepPath(c, settings.beginnerAssist) };
}

/**
 * A miss in a search (a near miss on a tank's body, a plain miss or a burst decoy): one more wrong
 * answer, the next help step and a feedback line, "Ganz knapp! Triff die Linie." after a near miss, otherwise an
 * encouraging phrase chosen by the round seed (FR-033).
 */
export function afterMiss(s: RoundState, now: number, settings: Settings, near = false): RoundState {
  const wrongAnswers = s.help.wrongAnswers + 1;
  const counted: RoundState = { ...s, help: { ...s.help, wrongAnswers, wrongAnswerTimes: [...s.help.wrongAnswerTimes, now] } };
  const message: FeedbackMessage = near ? { key: 'near' } : { key: 'encouragement', index: deriveSeed(s.seed, 7, s.turn, wrongAnswers) };
  const raised = raiseHelp(counted, settings);
  // At the solution step the selection goes back to the solution after every miss, so one tap or Enter fires at it
  // (FR-031, T183).
  const selection = raised.help.level >= SOLUTION_HELP_LEVEL && raised.challenge ? raised.challenge.answer : raised.selection;
  return { ...raised, selection, message };
}
