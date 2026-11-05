/**
 * Computer opponent (research R18, FR-041 to FR-043).
 * The enemy aims with solveAim, then adds normally distributed error whose spread depends on the difficulty.
 * Its input has no field for attempts, help or challenges, so its choices cannot depend on them (FR-042).
 */
import type { Rng } from '../rng';
import type { Heightmap, Point, Settings } from '../types';
import { solveAim, type AimResult } from '../physics/aim';
import { traceImpact } from '../physics/ballistics';
import { BLAST_RADIUS } from '../physics/damage';

export type Difficulty = Settings['enemyDifficulty'];

export interface EnemyShotInput {
  difficulty: Difficulty;
  /** The enemy's own generator, separate from the challenge generator (R18). */
  rng: Rng;
  /** 0 for the enemy's first shot of the round. */
  shotIndexInRound: number;
  origin: Point;
  target: Point;
  terrain: Heightmap;
  worldWidth: number;
  worldHeight: number;
}

export interface EnemyShot {
  angleDeg: number;
  power: number;
}

/** Standard deviation of the added error, in degrees and percent power. */
const SPREAD: Record<Difficulty, { angle: number; power: number }> = {
  easy: { angle: 6, power: 9 },
  normal: { angle: 3, power: 4.5 },
  challenging: { angle: 1.2, power: 1.8 },
};

/** The first shot on easy must land at least this far from the target, beyond the blast radius. */
const FORCED_MISS_DISTANCE = BLAST_RADIUS * 1.5;
const FORCED_MISS_TRIES = 20;

export function enemyDamageFactor(difficulty: Difficulty): number {
  return difficulty === 'easy' ? 0.5 : 1;
}

export function enemyShot(input: EnemyShotInput): EnemyShot {
  const { difficulty, rng, origin, target } = input;
  const facesRight = target.x >= origin.x;
  const [minAngle, maxAngle] = facesRight ? [0, 90] : [90, 180];
  const ideal = idealAim(input);
  const spread = SPREAD[difficulty];

  const sample = (scale: number): EnemyShot => ({
    angleDeg: clamp(ideal.angleDeg + rng.normal(0, spread.angle * scale), minAngle, maxAngle),
    power: clamp(ideal.power + rng.normal(0, spread.power * scale), 0, 100),
  });

  if (difficulty !== 'easy' || input.shotIndexInRound !== 0) return sample(1);

  // FR-043: the first shot of a round on easy always misses clearly.
  for (let i = 0; i < FORCED_MISS_TRIES; i++) {
    const shot = sample(2);
    if (missDistance(input, shot) > FORCED_MISS_DISTANCE) return shot;
  }
  return deterministicMiss(input, ideal, minAngle, maxAngle);
}

/** Walks power away from the ideal shot, then other angles, until the shot misses clearly. */
function deterministicMiss(input: EnemyShotInput, ideal: AimResult, minAngle: number, maxAngle: number): EnemyShot {
  for (let da = 0; da <= 90; da++) {
    for (const angleDeg of da === 0 ? [ideal.angleDeg] : [ideal.angleDeg - da, ideal.angleDeg + da]) {
      if (angleDeg < minAngle || angleDeg > maxAngle) continue;
      for (let dp = 10; dp <= 100; dp += 5) {
        for (const power of [ideal.power - dp, ideal.power + dp]) {
          if (power < 0 || power > 100) continue;
          const shot = { angleDeg, power };
          if (missDistance(input, shot) > FORCED_MISS_DISTANCE) return shot;
        }
      }
    }
  }
  // Every shot lands near the target only in a degenerate world; power 0 drops the shell at the cannon.
  return { angleDeg: ideal.angleDeg, power: 0 };
}

function missDistance(input: EnemyShotInput, shot: EnemyShot): number {
  const p = traceImpact({ ...shot, origin: input.origin, terrain: input.terrain, worldWidth: input.worldWidth, worldHeight: input.worldHeight });
  return Math.hypot(p.x - input.target.x, p.y - input.target.y);
}

/**
 * solveAim is deterministic and heightmaps are never changed in place (carveCrater returns a new one),
 * so results are cached per heightmap object, origin and target.
 */
const aimCache = new WeakMap<Heightmap, Map<string, AimResult>>();

function idealAim(input: EnemyShotInput): AimResult {
  const { origin, target, terrain, worldWidth, worldHeight } = input;
  const key = `${origin.x},${origin.y},${target.x},${target.y},${worldWidth},${worldHeight}`;
  let byKey = aimCache.get(terrain);
  if (!byKey) {
    byKey = new Map();
    aimCache.set(terrain, byKey);
  }
  let result = byKey.get(key);
  if (!result) {
    result = solveAim({ origin, target, terrain, worldWidth, worldHeight });
    byKey.set(key, result);
  }
  return result;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
