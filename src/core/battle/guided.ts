/**
 * Guided mode (US2, FR-010, FR-010a, FR-013, FR-076, amendment 06): a search is one challenge whose answer is the
 * enemy's number. The enemy and its pointer line are visible in every challenge kind (amendment 07). Every fire is an
 * answer: only the exact number destroys the enemy, then a new enemy and a new search follow. A near miss
 * on the body and a plain miss both count as a miss for the help steps. Pure functions: each returns a new state.
 */
import { deriveSeed } from '../rng';
import type { BattleState, Challenge, FeedbackMessage, InputMethod, RulerLevel, Settings, Skill, TankState } from '../types';
import { generateChallenge } from '../math/generate';
import { stepPath } from '../math/stepPath';
import { emptyEntry } from './entry';
import { nextHelp } from './help';
import { makeTank, moveTank, parentDifficulty, type Difficulty } from './round';

/** Answers count only after the challenge has been visible this long (edge case "Rapid tapping or typing"). */
export const ANSWER_DELAY_MS = 1000;

/** The help step that shows the solution: the selection jumps to the answer (FR-013). */
export const SOLUTION_HELP_LEVEL = 3;

/** Tries for a new answer before the same number as the destroyed enemy is accepted again. */
const NEW_POSITION_TRIES = 8;

/**
 * The challenge of a guided search. The latest input method decides whether findNumber may come: before any input
 * the game treats the input as keyboard input (FR-076). With `avoid`, another answer is chosen whenever possible.
 */
export function searchChallenge(
  settings: Settings,
  roundSeed: number,
  turn: number,
  playerPosition: number,
  rulerLevel: RulerLevel,
  inputMethod: InputMethod | null,
  avoid: number | null = null,
  skillSteps: Record<Skill, number> = parentDifficulty(settings).skillSteps,
): Challenge {
  let challenge: Challenge | null = null;
  for (let i = 0; i < NEW_POSITION_TRIES; i++) {
    challenge = generateChallenge({
      settings,
      skillSteps,
      roundSeed: i === 0 ? roundSeed : deriveSeed(roundSeed, 4, i),
      turn,
      playerPosition,
      rulerLevel,
      inputMethod: inputMethod ?? 'keyboard',
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
 * Comparison (US4, FR-026, FR-027): every option stands on a tank at its own number, each labeled with it. The enemy
 * stands at the answer; the other options are decoys, which look the same. All of them are visible.
 *
 * `difficulty` (US7, FR-018, FR-037): the skill steps the challenge is built with and the ruler level of the search.
 */
export function startSearch(
  s: BattleState,
  settings: Settings,
  now: number,
  avoid: number | null,
  difficulty: Difficulty = { ...parentDifficulty(settings), rulerLevel: s.rulerLevel },
): BattleState {
  const rulerLevel = difficulty.rulerLevel;
  const challenge = searchChallenge(settings, s.seed, s.turn, s.player.position, rulerLevel, s.inputMethod, avoid, difficulty.skillSteps);
  const moved: TankState = { ...moveTank(s.enemy, challenge.answer, settings, s.terrain), alive: true };
  // Only a comparison enemy carries a number plate.
  delete moved.label;
  const options = challenge.options;
  const enemy: TankState = options ? { ...moved, label: challenge.answer } : moved;
  const decoys: TankState[] = (options ?? [])
    .filter((n) => n !== challenge.answer)
    .map((n, i) => ({ ...makeTank(`decoy-${challenge.id}-${i}`, 'decoy', n, settings, s.terrain), label: n }));
  return {
    ...s,
    phase: 'challenge',
    rulerLevel,
    challenge,
    enemy,
    decoys,
    notOnTank: false,
    answerableAt: now + ANSWER_DELAY_MS,
    help: { level: 0, wrongAnswers: 0, wrongAnswerTimes: [], content: null },
    message: null,
    selection: null,
    entry: emptyEntry(),
    orderTaps: [],
    stepAnimation: null,
  };
}

/** The landing number of the search's latest miss, or null before any miss (the help steps count from it). */
function landedOf(s: BattleState): number | null {
  return s.help.wrongAnswers > 0 && s.lastShot && !s.lastShot.hit ? s.lastShot.landed : null;
}

/**
 * The next help step (US5, FR-031): help.level + 1, or further when the parent turned that step's help types off
 * (FR-032, nextHelp). At the solution step the selection is the answer, so one tap on fire or Enter fires at it
 * (FR-013). A step path already running is kept, so the animation does not start again.
 */
export function raiseHelp(s: BattleState, settings: Settings): BattleState {
  const c = s.challenge;
  if (!c || s.help.level >= SOLUTION_HELP_LEVEL) return s;
  const content = nextHelp(c, s.help.level + 1, landedOf(s), settings);
  const selection = content.step === SOLUTION_HELP_LEVEL ? c.answer : s.selection;
  const stepAnimation = s.stepAnimation ?? content.stepPath;
  return { ...s, help: { ...s.help, level: content.step, content }, selection, stepAnimation };
}

/**
 * The help button, H or a parent-set time limit (FR-030, FR-034): the next help step, not a shot, no heart. A help
 * request on an addition or subtraction also starts the step path at once (US3 scenario 1); after misses it comes at
 * step 2.
 */
export function afterHelpRequest(s: BattleState, settings: Settings): BattleState {
  const next = raiseHelp(s, settings);
  const c = next.challenge;
  if (next === s || !c || next.stepAnimation || !settings.help.stepAnimation) return next;
  if (c.kind !== 'addition' && c.kind !== 'subtraction') return next;
  return { ...next, stepAnimation: stepPath(c, settings.beginnerAssist) };
}

/**
 * A miss in a search (a near miss on the body, a plain miss, a destroyed decoy or a wrong order): one more wrong
 * answer, the next help step and a feedback line, "Ganz knapp! Triff die Linie." after a near miss, otherwise an
 * encouraging phrase chosen by the round seed (FR-033).
 */
export function afterMiss(s: BattleState, now: number, settings: Settings, near = false): BattleState {
  const wrongAnswers = s.help.wrongAnswers + 1;
  const counted: BattleState = { ...s, help: { ...s.help, wrongAnswers, wrongAnswerTimes: [...s.help.wrongAnswerTimes, now] } };
  const message: FeedbackMessage = near ? { key: 'near' } : { key: 'encouragement', index: deriveSeed(s.seed, 7, s.turn, wrongAnswers) };
  return { ...raiseHelp(counted, settings), message };
}
