/**
 * Guided mode (US2, FR-010, FR-010a, FR-013, FR-076, amendment 06): a search is one challenge whose answer is the
 * enemy's number. The enemy and its pointer line are visible in every challenge kind (amendment 07). Every fire is an
 * answer: only the exact number destroys the enemy, then a new enemy and a new search follow. A near miss
 * on the body and a plain miss both count as a miss for the help steps. Pure functions: each returns a new state.
 */
import { deriveSeed } from '../rng';
import type { BattleState, Challenge, InputMethod, RulerLevel, Settings, TankState } from '../types';
import { generateChallenge } from '../math/generate';
import { stepPath } from '../math/stepPath';
import { emptyEntry } from './entry';
import { FIRST_STEPS, makeTank, moveTank } from './round';

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
): Challenge {
  let challenge: Challenge | null = null;
  for (let i = 0; i < NEW_POSITION_TRIES; i++) {
    challenge = generateChallenge({
      settings,
      skillSteps: FIRST_STEPS,
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
 */
export function startSearch(s: BattleState, settings: Settings, now: number, avoid: number | null): BattleState {
  const challenge = searchChallenge(settings, s.seed, s.turn, s.player.position, s.rulerLevel, s.inputMethod, avoid);
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
    challenge,
    enemy,
    decoys,
    notOnTank: false,
    answerableAt: now + ANSWER_DELAY_MS,
    help: { level: 0, wrongAnswers: 0, wrongAnswerTimes: [] },
    selection: null,
    entry: emptyEntry(),
    orderTaps: [],
    stepAnimation: null,
  };
}

/**
 * A miss in a search (near miss on the body or off it): one more wrong answer and the next help step. At the
 * solution step the selection is the answer, so one tap on fire or Enter fires at it (FR-013). The full help
 * escalation (time limit, help button, visuals) comes with US5.
 */
/**
 * The help button or H during a search (FR-030): the next help step, not a shot, no heart. For addition and
 * subtraction the marker steps along stepPath (FR-024, US3). The help steps of the other kinds come with US5.
 */
export function afterHelpRequest(s: BattleState, settings: Settings): BattleState {
  const c = s.challenge;
  if (!c || (c.kind !== 'addition' && c.kind !== 'subtraction')) return s;
  const level = Math.min(SOLUTION_HELP_LEVEL, s.help.level + 1) as BattleState['help']['level'];
  const selection = level === SOLUTION_HELP_LEVEL ? c.answer : s.selection;
  return { ...s, help: { ...s.help, level }, selection, stepAnimation: stepPath(c, settings.beginnerAssist) };
}

export function afterMiss(s: BattleState, now: number): BattleState {
  const wrongAnswers = s.help.wrongAnswers + 1;
  const level = Math.min(SOLUTION_HELP_LEVEL, Math.max(s.help.level, wrongAnswers)) as BattleState['help']['level'];
  const selection = level === SOLUTION_HELP_LEVEL && s.challenge ? s.challenge.answer : s.selection;
  return { ...s, help: { level, wrongAnswers, wrongAnswerTimes: [...s.help.wrongAnswerTimes, now] }, selection };
}
