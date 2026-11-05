/** Shared core types from data-model.md. No DOM or Phaser references. */

export type { PlayMode, Settings } from './settings/schema';
export type { RulerLevel } from './numberline/ticks';
import type { RulerLevel } from './numberline/ticks';
import type { PlayMode } from './settings/schema';

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
  | 'largest3'
  | 'smallest3'
  | 'closestTo'
  | 'between'
  | 'middle3';

/** Attempts stored before amendment 09 may carry the removed kinds 'equal' and 'order3'; they still load. */
export type StoredChallengeKind = ChallengeKind | 'equal' | 'order3';

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
  /** Comparison only: the 2 or 3 numbers the banner names, in banner order; includes answer (amendment 09). */
  options?: number[];
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
  kind: StoredChallengeKind;
  skills: Skill[];
  /** e.g. `0-100` or `15-45` */
  rangeKey: string;
  difficultyStep: number;
  /** True if a correct answer was given before the solution was shown. */
  solved: boolean;
  /** solved at the exact number, with no help and no wrong answer (FR-075). */
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
  /** Positions ladder only; clamped to [rulerLevelStart, rulerLevelMax] (FR-018). */
  rulerLevel?: RulerLevel;
}

export type Phase = 'challenge' | 'playerShot' | 'enemyTurn' | 'roundOver' | 'paused';

export interface Point {
  x: number;
  y: number;
}

/** Surface height per column. */
export type Heightmap = Float32Array;

export interface TankState {
  id: string;
  /** A decoy stands at a comparison option that is not the answer and looks exactly like the enemy (amendment 10). */
  kind: 'player' | 'enemy' | 'decoy';
  /** Number on the line. */
  position: number;
  x: number;
  y: number;
  /** Tanks have no health (amendment 06); the child's hearts are RoundState.lives. No number plate (amendment 09). */
  alive: boolean;
}

/** How the child chose the last number: keyboard (digits, Enter) or pointer (ruler, fire button); amendment 05. */
export type InputMethod = 'pointer' | 'keyboard';

export interface RoundState {
  seed: number;
  /** The play mode (amendment 17, FR-121 to FR-123): every mode is a search that records attempts. */
  mode: PlayMode;
  /** Player shots fired this round. */
  turn: number;
  /** The child's hearts, LIVES at the start; 0 ends the round (amendment 06, FR-080). */
  lives: number;
  /**
   * The score: enemies destroyed this round that count (FR-083). With "Punkt nach voller Hilfe" off, an enemy destroyed
   * after help step 3 does not count (amendment 18, FR-129). The stars, "Gegner pro Runde" and the personal best read it.
   */
  enemiesDestroyed: number;
  /** Every enemy destroyed this round, counted or not (amendment 18); the new hills are seeded from it (FR-101). */
  enemiesHit: number;
  /** Time played up to the last pause, final once the round is over (FR-084); controller.elapsedMs() adds the running part. */
  elapsedMs: number;
  /**
   * The child's misses in a row (amendment 13, FR-098): + 1 per shot that does not destroy the enemy, + 2 for a fast
   * guess; 0 after a destroyed enemy and after an enemy hit; kept by "Neue Landschaft"; 0 at a new round.
   */
  missStreak: number;
  phase: Phase;
  /** The seed of the current ground; new after every destroyed enemy (amendment 13, FR-101). */
  terrainSeed: number;
  terrain: Heightmap;
  player: TankState;
  /** Always visible with its number and coordinates (amendment 07, FR-010). */
  enemy: TankState;
  /**
   * Comparison searches: a decoy at each option other than the answer, no number plate (amendment 10); [] otherwise.
   * A burst decoy stays here with alive false until the search ends.
   */
  decoys: TankState[];
  /**
   * Amendment 21 (FR-137): the other enemies of the current wave, kind 'enemy'; `enemy` is the help target. A destroyed
   * one stays here with alive false until the wave ends. [] for a wave of one and in every other search.
   */
  wave: TankState[];
  /** Fixed for the round, alternates between rounds. */
  playerSide: 'left' | 'right';
  /** The search's challenge; mode 'ruler' always readPosition, mode 'math' never readPosition or findNumber (amendment 17). */
  challenge: Challenge | null;
  /** Clock time when answers became possible (1 s after display). */
  answerableAt: number | null;
  /** The help ladder of the search (FR-031): content is what the current step shows, null at level 0. */
  help: { level: 0 | 1 | 2 | 3; wrongAnswers: number; wrongAnswerTimes: number[]; content: HelpContent | null };
  /** Feedback line after a miss (FR-033): an encouraging phrase, or "Ganz knapp! Triff die Linie." after a near miss. */
  message: FeedbackMessage | null;
  /** Previewed number; fired by the fire button or Enter. */
  selection: number | null;
  /** Keyboard digits typed so far (FR-060); outOfRange shows the range hint (FR-063). */
  entry: { typed: string; outOfRange: boolean };
  /** Latest input method (FR-076); keyboard input gets no findNumber search. Kept across rounds; null before any input. */
  inputMethod: InputMethod | null;
  /** Ruler detail level for this round (FR-018). */
  rulerLevel: RulerLevel;
  /** The player's last shot: landed number shown large; distance in steps shown after every miss, in every mode (amendment 07). */
  lastShot: LastShot | null;
  /** FR-004 trail */
  lastPlayerPath: Point[] | null;
  /** The shell in flight during 'playerShot' and 'enemyTurn', for the renderer to replay; otherwise null. */
  shot: ShotInFlight | null;
  /**
   * The step animation of an addition or subtraction after a help request: the numbers the marker stops at, from the
   * starting number to the result, e.g. [43, 40, 36] (stepPath, FR-024). Null when no animation is shown.
   */
  stepAnimation: number[] | null;
  /** goalReached: roundLength enemies destroyed with roundType 'enemyCount'; heartsGone: no lives left (FR-082). */
  outcome: 'goalReached' | 'heartsGone' | null;
}

/**
 * What one help step shows (US5, FR-031, core/battle/help.ts). Fields that do not belong to the step, or whose help
 * type the parent turned off (FR-032), are null or false.
 */
export interface HelpContent {
  step: 1 | 2 | 3;
  /** Step 1, number line: from the landing number toward the answer; null before any miss. */
  direction: 'right' | 'left' | null;
  /** Step 1, number line (help.nearestTen): the major line nearest to the answer, highlighted. */
  nearestMajor: number | null;
  /** Step 2, number line (help.zoom): the ten that contains the answer, drawn with all lines. */
  zoom: { min: number; max: number } | null;
  /** Step 2, number line (help.countSteps): numbers pop up one by one from `from` to `to`. */
  count: { from: number; to: number; steps: number } | null;
  /** Step 2, addition and subtraction (help.stepAnimation): the marker's stops (stepPath, FR-024). */
  stepPath: number[] | null;
  /** Step 1, comparison (help.nearestTen): the tens digits of the options in the banner are highlighted (amendment 09). */
  tensDigits: boolean;
  /** Step 2, comparison (help.zoom): a small marker on the ruler under every option, smallest first. */
  optionMarkers: number[] | null;
  /** Step 3: the answer, shown and selected. */
  solution: number | null;
}

/** A feedback line; the overlay turns it into text with i18n `messageText`. `index` picks an encouraging phrase. */
export type FeedbackMessage = { key: 'encouragement'; index: number } | { key: 'near' };

export interface LastShot {
  /** The number the player fired at. */
  fired: number;
  /** The number under the impact point. */
  landed: number;
  /** The fired number was the enemy's number: the enemy was destroyed (amendment 06, FR-066). */
  hit: boolean;
  /**
   * On a tank's body but not exact: that tank shakes, "Ganz knapp! Triff die Linie." (FR-066, FR-072). In comparison
   * turns the tank may be a decoy (amendment 10).
   */
  nearMiss: boolean;
  /** With nearMiss: the tank whose body the shell landed on; null otherwise. */
  nearTankId: string | null;
  /** The destroyed enemy or the burst decoy, or null. */
  hitTankId: string | null;
  /** A decoy stood at the fired number and burst; the shot is a miss (amendment 10, FR-066). */
  decoyHit: boolean;
  /**
   * The number the step count refers to: the enemy's, or in comparison turns the number of the tank nearest the
   * landing number among the tanks still standing, so the count does not show which tank is the enemy (FR-072).
   */
  targetNumber: number;
  /** Steps from the landed number to targetNumber. */
  distance: number;
  /** The enemy's number when the shell landed; the hit feedback shows it after the enemy has moved (FR-068). */
  enemyNumber: number;
  /**
   * A hit after help step 3 with "Punkt nach voller Hilfe" off: the enemy is destroyed but not counted, and the feedback
   * reads "Getroffen, mit Hilfe." (amendment 18, FR-129). Absent otherwise.
   */
  uncounted?: boolean;
  /** Amendment 21: 2 or more enemies of a wave stood when the shell landed; a miss shows "Du: N · K Schritte" (FR-140). */
  wave?: boolean;
}

export interface ShotInFlight {
  shooter: 'player' | 'enemy';
  /** Precomputed flight path from the muzzle to the impact. */
  path: Point[];
  impact: Point;
  /** An enemy shell decided as a hit on the child's tank (ai/enemy.ts, amendment 13); false for every other shell. */
  hits: boolean;
  /**
   * Comparison turns (bug report B2, FR-043a): the shells every standing decoy fires together with the enemy, each
   * from its own barrel. They are harmless: they land beside the child's tank, farther away than the enemy's shell,
   * and change neither the hearts nor the ground. Empty for every other shot.
   */
  decoyShells: DecoyShell[];
  /** Amendment 21 (FR-140): in a wave, the id of the standing enemy that fires this enemy shell; absent means `enemy`. */
  shooterId?: string;
}

/** One harmless shell of a decoy in a comparison turn's volley (bug report B2). */
export interface DecoyShell {
  /** The id of the decoy that fires it. */
  shooterId: string;
  path: Point[];
  impact: Point;
}
