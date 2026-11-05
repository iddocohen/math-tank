/**
 * Computer opponent (amendment 07, FR-041 to FR-043, research R18). After every shot of the child that does not
 * destroy it, the enemy fires once. A seeded draw decides whether the shell hits the child's tank: 1/6 on easy,
 * 1/4 on normal, 1/3 on challenging, and never on the first shot of a round. Otherwise the shell lands on purpose
 * 40 to 100 world units beside the child's tank, outside its hit area. The draw reads only the round seed, the
 * shot index and the difficulty, so it cannot depend on the child's answers, help or mistakes (FR-042).
 */
import { createRng, deriveSeed } from '../rng';
import type { Heightmap, Point, Settings } from '../types';
import { solveArcToX } from '../physics/arc';

export type Difficulty = Settings['enemyDifficulty'];

/** Chance that one enemy shot hits the child's tank (FR-041). */
export const ENEMY_HIT_CHANCE: Record<Difficulty, number> = {
  easy: 1 / 6,
  normal: 1 / 4,
  challenging: 1 / 3,
};

/** A deliberate near miss lands this far from the child's tank center, in world units (FR-041). */
export const NEAR_MISS_MIN = 40;
export const NEAR_MISS_MAX = 100;

/** Largest distance between the planned x and the impact, in world units. */
const ARC_TOLERANCE = 0.5;

export interface EnemyPlanInput {
  difficulty: Difficulty;
  roundSeed: number;
  /** 0 for the enemy's first shot of the round. */
  shotIndexInRound: number;
  playerX: number;
  worldWidth: number;
}

export interface EnemyPlan {
  hits: boolean;
  /** Where the shell lands: the child's tank for a hit, beside it otherwise. */
  targetX: number;
}

/** The seeded draw for one enemy shot. */
export function planEnemyShot(input: EnemyPlanInput): EnemyPlan {
  const { difficulty, roundSeed, shotIndexInRound, playerX, worldWidth } = input;
  const rng = createRng(deriveSeed(roundSeed, 6, shotIndexInRound));
  // Always three draws, so the side and distance do not shift with the hit decision.
  const hitDraw = rng.next();
  const sideDraw = rng.next();
  const distance = rng.int(NEAR_MISS_MIN, NEAR_MISS_MAX);
  const hits = shotIndexInRound > 0 && hitDraw < ENEMY_HIT_CHANCE[difficulty];
  if (hits) return { hits, targetX: playerX };
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
