import { describe, expect, expectTypeOf, it } from 'vitest';
import { generateTerrain, surfaceY } from '../physics/terrain';
import { TANK_WIDTH } from '../math/gaps';
import { landsOnBody } from '../battle/hitRule';
import { createRound, muzzle } from '../battle/round';
import { defaultSettings } from '../settings/defaults';
import {
  enemyShot,
  HIT_STREAK,
  isWarningStreak,
  planEnemyShot,
  ZERO_IN_DISTANCE,
  type Difficulty,
  type EnemyPlanInput,
  type EnemyShotInput,
} from './enemy';
import * as enemyModule from './enemy';

const W = 1600;
const H = 900;
const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'challenging'];

function plan(difficulty: Difficulty, roundSeed: number, shotIndexInRound: number, missStreak: number, playerX = 400) {
  return planEnemyShot({ difficulty, roundSeed, shotIndexInRound, missStreak, playerX, worldWidth: W });
}

/** The miss distance for a streak below the limit (FR-099). */
function expectedDistance(streak: number): number {
  return ZERO_IN_DISTANCE[Math.min(Math.max(streak, 1), 3) - 1]!;
}

describe('enemy zeroes in on misses in a row (amendment 13, FR-041, FR-043, FR-099)', () => {
  it('hits at 4 misses in a row on easy, 3 on normal and 2 on challenging', () => {
    expect(HIT_STREAK).toEqual({ easy: 4, normal: 3, challenging: 2 });
  });

  it('lands about 100, 60 and 35 world units away, always outside the hit area', () => {
    expect([...ZERO_IN_DISTANCE]).toEqual([100, 60, 35]);
    for (const d of ZERO_IN_DISTANCE) expect(d).toBeGreaterThan(TANK_WIDTH / 2);
  });

  it('hits exactly when the streak reaches the limit and the shot is not the first of the round', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 200; seed++) {
        for (let streak = 0; streak <= 6; streak++) {
          const p = plan(difficulty, seed, 1 + (seed % 5), streak, 800);
          expect(p.hits).toBe(streak >= HIT_STREAK[difficulty]);
          if (p.hits) expect(p.targetX).toBe(800);
        }
      }
    }
  });

  it('below the limit the shell comes closer with the streak, on both sides over the seeds', () => {
    for (const difficulty of DIFFICULTIES) {
      const sides = new Set<number>();
      for (let seed = 0; seed < 200; seed++) {
        let previous = Infinity;
        for (let streak = 0; streak < HIT_STREAK[difficulty]; streak++) {
          const p = plan(difficulty, seed, 2, streak, 800);
          expect(p.hits).toBe(false);
          const d = Math.abs(p.targetX - 800);
          expect(d).toBe(expectedDistance(streak));
          expect(d).toBeLessThanOrEqual(previous);
          expect(landsOnBody({ x: p.targetX, y: 0 }, { id: 'player', kind: 'player', position: 0, x: 800, y: 0, alive: true })).toBe(false);
          previous = d;
          sides.add(Math.sign(p.targetX - 800));
        }
      }
      expect(sides).toEqual(new Set([-1, 1]));
    }
  });

  it('the first shot of a round never hits, at any streak and difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 200; seed++) {
        for (let streak = 0; streak <= 6; streak++) {
          const p = plan(difficulty, seed, 0, streak, 800);
          expect(p.hits).toBe(false);
          expect(Math.abs(p.targetX - 800)).toBe(expectedDistance(streak));
        }
      }
    }
  });

  it('uses the inner side when the child tank stands at an end of the world', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(plan('easy', seed, 0, 1, 30).targetX).toBeGreaterThan(30);
      expect(plan('easy', seed, 0, 1, W - 30).targetX).toBeLessThan(W - 30);
    }
  });

  it('is deterministic: the same input gives the same plan', () => {
    for (let seed = 0; seed < 50; seed++) expect(plan('normal', seed, 4, 2)).toEqual(plan('normal', seed, 4, 2));
  });

  it('warns one miss before the limit only (FR-100)', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let streak = 0; streak <= 6; streak++) expect(isWarningStreak(streak, difficulty)).toBe(streak === HIT_STREAK[difficulty] - 1);
    }
  });

  it('takes the miss streak but no answers, help or challenge data as input (FR-042)', () => {
    expectTypeOf<keyof EnemyPlanInput>().toEqualTypeOf<'difficulty' | 'roundSeed' | 'shotIndexInRound' | 'missStreak' | 'playerX' | 'worldWidth'>();
    expectTypeOf<keyof EnemyShotInput>().toEqualTypeOf<
      'difficulty' | 'roundSeed' | 'shotIndexInRound' | 'missStreak' | 'playerX' | 'worldWidth' | 'origin' | 'terrain' | 'worldHeight'
    >();
    expectTypeOf<EnemyShotInput>().not.toHaveProperty('help');
    expectTypeOf<EnemyShotInput>().not.toHaveProperty('challenge');
    expectTypeOf<EnemyShotInput>().not.toHaveProperty('attempts');
  });

  it('has no random hit chance, no near-miss band and no damage factor any more', () => {
    expect('ENEMY_HIT_CHANCE' in enemyModule).toBe(false);
    expect('NEAR_MISS_MIN' in enemyModule).toBe(false);
    expect('NEAR_MISS_MAX' in enemyModule).toBe(false);
    expect('enemyDamageFactor' in enemyModule).toBe(false);
  });
});

describe('enemyShot path (amendments 07 and 13)', () => {
  it('flies from the enemy muzzle and lands within 0.5 units of the planned x, so it hits exactly when the draw says so', () => {
    let hits = 0;
    let misses = 0;
    for (let seed = 0; seed < 40; seed++) {
      const round = createRound(defaultSettings(), 7000 + seed, seed % 2 === 0 ? 'left' : 'right');
      const origin = muzzle(round.enemy);
      for (const [shotIndexInRound, missStreak] of [[0, 2], [1, 1], [2, 2], [3, 3]] as const) {
        const shot = enemyShot({ difficulty: 'challenging', roundSeed: round.seed, shotIndexInRound, missStreak, origin, playerX: round.player.x, terrain: round.terrain, worldWidth: W, worldHeight: H });
        expect(shot.path[0]).toEqual(origin);
        expect(Math.abs(shot.impact.x - shot.targetX)).toBeLessThanOrEqual(0.5);
        expect(shot.impact.y).toBeCloseTo(surfaceY(round.terrain, shot.impact.x), 0);
        expect(landsOnBody(shot.impact, round.player)).toBe(shot.hits);
        if (shot.hits) hits++;
        else misses++;
      }
    }
    expect(hits).toBeGreaterThan(0);
    expect(misses).toBeGreaterThan(0);
  });

  it('works on a hilly terrain between the tanks', () => {
    const terrain = generateTerrain(3, W, H);
    const origin = { x: 1400, y: surfaceY(terrain, 1400) + 28 };
    const shot = enemyShot({ difficulty: 'easy', roundSeed: 1, shotIndexInRound: 0, missStreak: 1, origin, playerX: 100, terrain, worldWidth: W, worldHeight: H });
    expect(Math.abs(shot.impact.x - shot.targetX)).toBeLessThanOrEqual(0.5);
  });
});
