/** Shared core types from data-model.md. No DOM or Phaser references. */

export type { Settings } from './settings/schema';

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
}

export type RecentOutcome = 'independent' | 'assisted' | 'unsolved';

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
  /** solved and no help was used and no wrong answer. */
  independent: boolean;
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
  labelLevel?: 1 | 2 | 3 | 4;
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
  /** 0..100 */
  health: number;
  label?: number;
  alive: boolean;
}

export interface RoundState {
  seed: number;
  mode: 'guided' | 'freePlay';
  /** Player turns used. */
  turn: number;
  phase: Phase;
  terrain: Heightmap;
  player: TankState;
  enemy: TankState;
  /** Comparison turns only. */
  decoys: TankState[];
  /** Fixed for the round, alternates between rounds. */
  playerSide: 'left' | 'right';
  /** False during a search: enemy hidden. */
  enemyFound: boolean;
  /** Shots since the enemy was found; new search after a hit or 3 shots. */
  shotsAtEnemy: number;
  challenge: Challenge | null;
  challengePurpose: 'search' | 'bonus' | null;
  /** Clock time when answers became possible (1 s after display). */
  answerableAt: number | null;
  help: { level: 0 | 1 | 2 | 3; wrongAnswers: number; wrongAnswerTimes: number[] };
  /** Previewed number; submitted only by the check button. */
  selection: number | null;
  /** FR-011 */
  charged: boolean;
  aim: { angleDeg: number; power: number };
  /** FR-004 trail */
  lastPlayerPath: Point[] | null;
  /** The shell in flight during 'playerShot' and 'enemyTurn', for the renderer to replay; otherwise null. */
  shot: ShotInFlight | null;
  outcome: 'playerWon' | 'enemyWon' | 'turnsUsed' | null;
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
