/** Shared core types from data-model.md. No DOM or Phaser references. */

export type { Settings } from './settings/schema';
export type { RulerLevel } from './numberline/ticks';
import type { RulerLevel } from './numberline/ticks';

export type Skill =
  | 'positions'
  | 'countForward'
  | 'countBackward'
  | 'tens'
  | 'crossTens'
  | 'addition'
  | 'subtraction'
  | 'comparison';

export type ChallengeKind =
  // number line
  | 'findNumber'
  | 'after'
  | 'before'
  | 'stepsRight'
  | 'stepsLeft'
  | 'missingBetween'
  | 'midpoint'
  // number line, amendment 02: the enemy is visible and the child reads the ruler
  | 'readPosition'
  // arithmetic
  | 'addition'
  | 'subtraction'
  // comparison
  | 'greater'
  | 'smaller'
  | 'equal'
  | 'order3'
  | 'largest3'
  | 'smallest3'
  | 'closestTo'
  | 'between';

/** Translation key plus parameters, e.g. { key: 'subtraction', params: { a: 43, b: 7 } }. */
export interface PromptSpec {
  key: string;
  params: Record<string, number>;
}

export interface Challenge {
  /** `${roundSeed}-${turn}` */
  id: string;
  seed: number;
  kind: ChallengeKind;
  /** Step of the main skill used to build it. */
  difficultyStep: number;
  /** Fixed per kind (FR-036). */
  mainSkill: Skill;
  /** mainSkill plus further skills it counts toward. */
  skills: Skill[];
  prompt: PromptSpec;
  /** All numbers in the question. */
  operands: number[];
  /** The target position on the number line. */
  answer: number;
  /** Comparison only: numbers on the 2 or 3 tanks; includes answer. */
  options?: number[];
  /** For 'order3': the required tap sequence. */
  orderAnswer?: number[];
  /** Intermediate positions for the step animation, e.g. [43, 40, 36]. */
  steps?: number[];
  /** readPosition only: the ruler level the challenge was built for. */
  rulerLevel?: RulerLevel;
}

/**
 * Progress outcome of a non-guess attempt. 'close' was added by amendment 04 and is no longer produced since
 * amendment 06 (a near miss on the body is a miss); a stored 'close' still loads and counts neither toward raising
 * nor toward lowering difficulty, and not toward mastery.
 */
export type RecentOutcome = 'independent' | 'close' | 'assisted' | 'unsolved';

export interface Attempt {
  challengeId: string;
  seed: number;
  kind: ChallengeKind;
  skills: Skill[];
  /** e.g. `0-100` or `15-45` */
  rangeKey: string;
  difficultyStep: number;
  /** True if a correct answer was given before the solution was shown. */
  solved: boolean;
  /** solved at the exact number, with no help and no wrong answer (FR-075). */
  independent: boolean;
  /** The shot that ended the search was at the enemy's exact number; always true since amendment 06. */
  exact: boolean;
  /** Highest help step reached; 3 means the solution was shown. */
  helpLevel: 0 | 1 | 2 | 3;
  wrongAnswers: number;
  /** From challenge answerable to final answer. */
  responseMs: number;
  /** FR-038 */
  guess: boolean;
  sessionId: string;
  /** Epoch milliseconds. */
  at: number;
}

/** Keyed in Progress.skills by `${skill}|${rangeKey}`. */
export interface SkillProgress {
  step: number;
  /** Max 6, newest last; cleared on a step change. */
  recent: RecentOutcome[];
  /** Max 10; never cleared by step changes. */
  masteryWindow: RecentOutcome[];
  guesses: number;
  attempts: number;
  independentCorrect: number;
  assisted: number;
}

export interface SessionSummary {
  id: string;
  startedAt: number;
  lastActiveAt: number;
  attempts: number;
  independentCorrect: number;
  assisted: number;
}

export interface Progress {
  version: 1;
  /** Capped at the newest 2000. */
  attempts: Attempt[];
  skills: Record<string, SkillProgress>;
  /** Not capped. */
  sessions: SessionSummary[];
}

export interface DifficultyStep {
  /** Fraction of the range the answer may come from, e.g. 0.2, 0.5, 1. */
  maxNumberFraction: number;
  /** Still limited by settings.crossTens. */
  allowCrossTens: boolean;
  /** Still limited by settings. */
  maxOperand?: number;
  /** Positions ladder only; clamped to [rulerLevelStart, rulerLevelMax] (FR-018). */
  rulerLevel?: RulerLevel;
}

export type Phase = 'challenge' | 'aiming' | 'playerShot' | 'enemyTurn' | 'roundOver' | 'paused';

export interface Point {
  x: number;
  y: number;
}

/** Surface height per column. */
export type Heightmap = Float32Array;

export interface TankState {
  id: string;
  kind: 'player' | 'enemy' | 'decoy';
  /** Number on the line. */
  position: number;
  x: number;
  y: number;
  /** Tanks have no health (amendment 06); the child's hearts are RoundState.lives. */
  label?: number;
  alive: boolean;
}

/** How the child chose the last number: keyboard (digits, Enter) or pointer (ruler, fire button); amendment 05. */
export type InputMethod = 'pointer' | 'keyboard';

export interface RoundState {
  seed: number;
  mode: 'guided' | 'freePlay';
  /** Player shots fired this round. */
  turn: number;
  /** The child's hearts, LIVES at the start; 0 ends the round (amendment 06, FR-080). */
  lives: number;
  /** The score: enemies destroyed this round (FR-083). */
  enemiesDestroyed: number;
  /** The child's shots at the current enemy since it last fired; at ENEMY_FIRE_EVERY it fires (FR-081). */
  shotsSinceEnemyFire: number;
  /** Time played up to the last pause, final once the round is over (FR-084); controller.elapsedMs() adds the running part. */
  elapsedMs: number;
  /** The latest enemy shell removed a heart. */
  lastEnemyHit: boolean;
  phase: Phase;
  terrain: Heightmap;
  player: TankState;
  enemy: TankState;
  /** Comparison turns only. */
  decoys: TankState[];
  /** Fixed for the round, alternates between rounds. */
  playerSide: 'left' | 'right';
  /** False during a position search: enemy hidden; true after a hit, for readPosition and in free play. */
  enemyFound: boolean;
  /** In free play a readPosition challenge whose answer is the enemy's number (amendment 02, FR-067). */
  challenge: Challenge | null;
  /** Clock time when answers became possible (1 s after display). */
  answerableAt: number | null;
  help: { level: 0 | 1 | 2 | 3; wrongAnswers: number; wrongAnswerTimes: number[] };
  /** Previewed number; fired by the fire button or Enter. */
  selection: number | null;
  /** Keyboard digits typed so far (FR-060); outOfRange shows the range hint (FR-063). */
  entry: { typed: string; outOfRange: boolean };
  /** order3: tank ids badged so far. */
  orderTaps: string[];
  /** Latest input method (FR-076); keyboard input gets no findNumber search. Kept across rounds; null before any input. */
  inputMethod: InputMethod | null;
  /** Ruler detail level for this round (FR-018). */
  rulerLevel: RulerLevel;
  /** The player's last shot: landed number shown large; distance in steps shown in free play. */
  lastShot: LastShot | null;
  /** FR-004 trail */
  lastPlayerPath: Point[] | null;
  /** The shell in flight during 'playerShot' and 'enemyTurn', for the renderer to replay; otherwise null. */
  shot: ShotInFlight | null;
  /** goalReached: roundLength enemies destroyed with roundType 'enemyCount'; heartsGone: no lives left (FR-082). */
  outcome: 'goalReached' | 'heartsGone' | null;
}

export interface LastShot {
  /** The number the player fired at. */
  fired: number;
  /** The number under the impact point. */
  landed: number;
  /** The fired number was the enemy's number: the enemy was destroyed (amendment 06, FR-066). */
  hit: boolean;
  /** On the enemy tank's body but not exact: the enemy shakes, "Ganz knapp! Triff die Linie." (FR-066, FR-072). */
  nearMiss: boolean;
  /** The destroyed enemy or the destroyed decoy, or null. */
  hitTankId: string | null;
  /** Steps from the landed number to the enemy's number. */
  distance: number | null;
  /** The enemy's number when the shell landed; the hit feedback shows it after the enemy has moved (FR-068). */
  enemyNumber: number;
}

export interface ShotInFlight {
  shooter: 'player' | 'enemy';
  /** Precomputed flight path from the muzzle to the impact. */
  path: Point[];
  impact: Point;
  hitTargetId: string | null;
  /** True when the shell left the battlefield over a side edge. */
  outOfBounds: boolean;
  blastRadius: number;
}
