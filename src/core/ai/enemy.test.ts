import { describe, expect, expectTypeOf, it } from 'vitest';
import { generateTerrain, surfaceY } from '../physics/terrain';
import { TANK_WIDTH } from '../math/gaps';
import { enemyHitsPlayer } from '../battle/hitRule';
import { createRound, muzzle } from '../battle/round';
import { defaultSettings } from '../settings/defaults';
import {
  ENEMY_HIT_CHANCE,
  enemyShot,
  NEAR_MISS_MAX,
  NEAR_MISS_MIN,
  planEnemyShot,
  type Difficulty,
  type EnemyPlanInput,
  type EnemyShotInput,
} from './enemy';
import * as enemyModule from './enemy';

const W = 1600;
const H = 900;
const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'challenging'];

function plan(difficulty: Difficulty, roundSeed: number, shotIndexInRound: number, playerX = 400) {
  return planEnemyShot({ difficulty, roundSeed, shotIndexInRound, playerX, worldWidth: W });
}

describe('enemy hit draw (amendment 07, FR-041, FR-043)', () => {
  it('hits at 1/6, 1/4 and 1/3 by difficulty', () => {
    expect(ENEMY_HIT_CHANCE).toEqual({ easy: 1 / 6, normal: 1 / 4, challenging: 1 / 3 });
  });

  it('over 3000 seeded shots the hit share is within 0.03 of the chance for each difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      let hits = 0;
      const n = 3000;
      for (let i = 0; i < n; i++) if (plan(difficulty, 1000 + Math.floor(i / 10), 1 + (i % 10)).hits) hits++;
      expect(Math.abs(hits / n - ENEMY_HIT_CHANCE[difficulty])).toBeLessThan(0.03);
    }
  });

  it('the first shot of a round never hits, on any difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 500; seed++) expect(plan(difficulty, seed, 0).hits).toBe(false);
    }
  });

  it('a hit aims at the child tank; a miss lands 40 to 100 units beside it, outside the hit area, on both sides', () => {
    expect(NEAR_MISS_MIN).toBe(40);
    expect(NEAR_MISS_MAX).toBe(100);
    expect(NEAR_MISS_MIN).toBeGreaterThan(TANK_WIDTH / 2);
    const sides = new Set<number>();
    for (let seed = 0; seed < 400; seed++) {
      const p = plan('challenging', seed, 3, 800);
      if (p.hits) {
        expect(p.targetX).toBe(800);
        continue;
      }
      const d = p.targetX - 800;
      expect(Math.abs(d)).toBeGreaterThanOrEqual(NEAR_MISS_MIN);
      expect(Math.abs(d)).toBeLessThanOrEqual(NEAR_MISS_MAX);
      sides.add(Math.sign(d));
    }
    expect(sides).toEqual(new Set([-1, 1]));
  });

  it('uses the inner side when the child tank stands at an end of the world', () => {
    for (let seed = 0; seed < 200; seed++) {
      const left = plan('easy', seed, 0, 30);
      expect(left.targetX).toBeGreaterThan(30);
      const right = plan('easy', seed, 0, W - 30);
      expect(right.targetX).toBeLessThan(W - 30);
    }
  });

  it('is deterministic: the same input gives the same plan', () => {
    for (let seed = 0; seed < 50; seed++) expect(plan('normal', seed, 4)).toEqual(plan('normal', seed, 4));
  });

  it('takes no answers, help, mistakes or challenge data as input (FR-042)', () => {
    expectTypeOf<keyof EnemyPlanInput>().toEqualTypeOf<'difficulty' | 'roundSeed' | 'shotIndexInRound' | 'playerX' | 'worldWidth'>();
    expectTypeOf<keyof EnemyShotInput>().toEqualTypeOf<
      'difficulty' | 'roundSeed' | 'shotIndexInRound' | 'playerX' | 'worldWidth' | 'origin' | 'terrain' | 'worldHeight'
    >();
    expectTypeOf<EnemyShotInput>().not.toHaveProperty('help');
    expectTypeOf<EnemyShotInput>().not.toHaveProperty('challenge');
    expectTypeOf<EnemyShotInput>().not.toHaveProperty('attempts');
  });

  it('there is no damage factor and no random aim error any more', () => {
    expect('enemyDamageFactor' in enemyModule).toBe(false);
  });
});

describe('enemyShot path (amendment 07)', () => {
  it('flies from the enemy muzzle and lands within 0.5 units of the planned x, so it hits exactly when the draw says so', () => {
    let hits = 0;
    let misses = 0;
    for (let seed = 0; seed < 40; seed++) {
      const round = createRound(defaultSettings(), 7000 + seed, seed % 2 === 0 ? 'left' : 'right');
      const origin = muzzle(round.enemy);
      for (const shotIndexInRound of [0, 1, 2, 3]) {
        const shot = enemyShot({ difficulty: 'challenging', roundSeed: round.seed, shotIndexInRound, origin, playerX: round.player.x, terrain: round.terrain, worldWidth: W, worldHeight: H });
        expect(shot.path[0]).toEqual(origin);
        expect(Math.abs(shot.impact.x - shot.targetX)).toBeLessThanOrEqual(0.5);
        expect(shot.impact.y).toBeCloseTo(surfaceY(round.terrain, shot.impact.x), 0);
        expect(enemyHitsPlayer(shot.impact, null, round.player)).toBe(shot.hits);
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
    const shot = enemyShot({ difficulty: 'easy', roundSeed: 1, shotIndexInRound: 0, origin, playerX: 100, terrain, worldWidth: W, worldHeight: H });
    expect(Math.abs(shot.impact.x - shot.targetX)).toBeLessThanOrEqual(0.5);
  });
});
