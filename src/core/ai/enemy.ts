/**
 * Computer opponent (amendments 07 and 13, FR-041 to FR-043, FR-099, FR-100, research R18). After every shot of the
 * child that does not destroy it, the enemy fires once. It zeroes in on the child's misses in a row: its shell lands
 * about 100, 60 and 35 world units beside the child's tank at 1, 2 and 3 or more misses in a row, outside the hit area,
 * and hits once the streak reaches the difficulty's limit (4 on easy, 3 on normal, 2 on challenging), never on the
 * first shot of a round. There is no random hit chance. A seeded draw from the round seed and the shot index picks
 * the side. The input holds the streak and the difficulty, never answers, help or challenge data (FR-042).
 */
import { createRng, deriveSeed } from '../rng';
import { clamp } from '../util';
import type { Heightmap, Point, Settings } from '../types';
import { solveArcToX } from '../physics/arc';

export type Difficulty = Settings['enemyDifficulty'];

/** Misses in a row at which the enemy's shot hits the child's tank (amendment 13, FR-041, FR-099). */
export const HIT_STREAK: Record<Difficulty, number> = {
  easy: 4,
  normal: 3,
  challenging: 2,
};

/**
 * Distance of a near miss from the child's tank center, in world units, at 1, 2 and 3 or more misses in a row
 * (FR-099). The hit area reaches 30 units from the center (half the tank width), so the closest miss is 35.
 */
export const ZERO_IN_DISTANCE = [100, 60, 35] as const;

/** Largest distance between the planned x and the impact, in world units. */
const ARC_TOLERANCE = 0.5;

export interface EnemyPlanInput {
  difficulty: Difficulty;
  roundSeed: number;
  /** 0 for the enemy's first shot of the round. */
  shotIndexInRound: number;
  /** The child's misses in a row, this shot's miss included (FR-098). */
  missStreak: number;
  playerX: number;
  worldWidth: number;
}

export interface EnemyPlan {
  hits: boolean;
  /** Where the shell lands: the child's tank for a hit, beside it otherwise. */
  targetX: number;
}

/** The streak one miss before the hit, when the child's tank wobbles and the hearts pulse (FR-100). */
export function isWarningStreak(missStreak: number, difficulty: Difficulty): boolean {
  return missStreak === HIT_STREAK[difficulty] - 1;
}

/** The enemy's plan for one shot: a hit at the limit, otherwise a near miss that comes closer with the streak. */
export function planEnemyShot(input: EnemyPlanInput): EnemyPlan {
  const { difficulty, roundSeed, shotIndexInRound, missStreak, playerX, worldWidth } = input;
  const hits = shotIndexInRound > 0 && missStreak >= HIT_STREAK[difficulty];
  if (hits) return { hits, targetX: playerX };
  const sideDraw = createRng(deriveSeed(roundSeed, 6, shotIndexInRound)).next();
  const distance = ZERO_IN_DISTANCE[clamp(missStreak, 1, ZERO_IN_DISTANCE.length) - 1]!;
  const side = sideDraw < 0.5 ? -1 : 1;
  const x = playerX + side * distance;
  // A side outside the battlefield gives way to the other side.
  const targetX = x < 0 || x > worldWidth ? playerX - side * distance : x;
  return { hits, targetX };
}

export interface EnemyShotInput extends EnemyPlanInput {
  /** The enemy's muzzle. */
  origin: Point;
  terrain: Heightmap;
  worldHeight: number;
}

export interface EnemyShot extends EnemyPlan {
  path: Point[];
  impact: Point;
}

/** The planned shot with its arc from the enemy's muzzle; the shell lands within 0.5 units of targetX. */
export function enemyShot(input: EnemyShotInput): EnemyShot {
  const p = planEnemyShot(input);
  const { origin, terrain, worldWidth, worldHeight } = input;
  const arc = solveArcToX({ origin, targetX: p.targetX, towardRight: p.targetX >= origin.x, terrain, worldWidth, worldHeight, tolerance: ARC_TOLERANCE });
  return { ...p, path: arc.path, impact: arc.impact };
}

/** A decoy's shell lands at least this much farther from the child's tank than the enemy's shell (bug report B2). */
export const DECOY_SHELL_EXTRA = 60;
/** Each further decoy's shell lands this much farther again, so no two shells land on the same spot. */
const DECOY_SHELL_STEP = 45;

export interface DecoyShellInput {
  roundSeed: number;
  shotIndexInRound: number;
  /** 0 for the first standing decoy, 1 for the second. */
  decoyIndex: number;
  /** Where the enemy's shell lands. */
  realImpactX: number;
  playerX: number;
  worldWidth: number;
}

/**
 * Where a decoy's shell lands in a comparison turn's volley (bug report B2, FR-043a): beside the child's tank, at
 * least DECOY_SHELL_EXTRA world units farther from it than the enemy's shell, so it never hits. A seeded draw picks
 * the side; a side outside the battlefield gives way to the other side.
 */
export function decoyShellTargetX(input: DecoyShellInput): number {
  const { roundSeed, shotIndexInRound, decoyIndex, realImpactX, playerX, worldWidth } = input;
  const distance = Math.abs(realImpactX - playerX) + DECOY_SHELL_EXTRA + decoyIndex * DECOY_SHELL_STEP;
  const side = createRng(deriveSeed(roundSeed, 9, shotIndexInRound, decoyIndex)).next() < 0.5 ? -1 : 1;
  const x = playerX + side * distance;
  return x < 0 || x > worldWidth ? playerX - side * distance : x;
}

export interface DecoyShotInput extends DecoyShellInput {
  /** The decoy's muzzle. */
  origin: Point;
  terrain: Heightmap;
  worldHeight: number;
}

/** A decoy's shell with its arc from the decoy's own muzzle. */
export function decoyShot(input: DecoyShotInput): { path: Point[]; impact: Point } {
  const targetX = decoyShellTargetX(input);
  const { origin, terrain, worldWidth, worldHeight } = input;
  const arc = solveArcToX({ origin, targetX, towardRight: targetX >= origin.x, terrain, worldWidth, worldHeight, tolerance: ARC_TOLERANCE });
  return { path: arc.path, impact: arc.impact };
}
