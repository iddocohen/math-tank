import { describe, expect, expectTypeOf, it } from 'vitest';
import { createRng, type Rng } from '../rng';
import { simulateShot } from '../physics/ballistics';
import { BLAST_RADIUS } from '../physics/damage';
import { generateTerrain, surfaceY } from '../physics/terrain';
import { enemyDamageFactor, enemyShot, type Difficulty, type EnemyShotInput } from './enemy';

const W = 1600;
const H = 900;

const scenarios = [11, 12, 13, 14, 15].map((seed) => {
  const terrain = generateTerrain(seed, W, H);
  return {
    terrain,
    origin: { x: 1350, y: surfaceY(terrain, 1350) + 10 },
    target: { x: 250, y: surfaceY(terrain, 250) },
  };
});

function missOf(s: (typeof scenarios)[number], shot: { angleDeg: number; power: number }): number {
  const { impact } = simulateShot({ origin: s.origin, ...shot, terrain: s.terrain, targets: [], worldWidth: W, worldHeight: H });
  return Math.hypot(impact.x - s.target.x, impact.y - s.target.y);
}

function meanMiss(difficulty: Difficulty): number {
  const rng = createRng(2024);
  let sum = 0;
  let n = 0;
  for (const s of scenarios) {
    for (let i = 0; i < 100; i++) {
      const shot = enemyShot({ difficulty, rng, shotIndexInRound: i + 1, worldWidth: W, worldHeight: H, ...s });
      sum += missOf(s, shot);
      n++;
    }
  }
  expect(n).toBe(500);
  return sum / n;
}

describe('enemyShot', () => {
  it('misses by less on higher difficulties over 500 seeded shots', () => {
    const easy = meanMiss('easy');
    const normal = meanMiss('normal');
    const challenging = meanMiss('challenging');
    expect(easy).toBeGreaterThan(normal);
    expect(normal).toBeGreaterThan(challenging);
  });

  it('is deterministic for the same rng seed', () => {
    const s = scenarios[0]!;
    const a = enemyShot({ difficulty: 'normal', rng: createRng(5), shotIndexInRound: 2, worldWidth: W, worldHeight: H, ...s });
    const b = enemyShot({ difficulty: 'normal', rng: createRng(5), shotIndexInRound: 2, worldWidth: W, worldHeight: H, ...s });
    expect(a).toEqual(b);
  });

  it('on easy, always misses the first shot of a round by more than the blast radius', () => {
    for (let seed = 0; seed < 100; seed++) {
      const s = scenarios[seed % scenarios.length]!;
      const shot = enemyShot({ difficulty: 'easy', rng: createRng(seed), shotIndexInRound: 0, worldWidth: W, worldHeight: H, ...s });
      expect(missOf(s, shot)).toBeGreaterThan(BLAST_RADIUS);
    }
  });

  it('keeps the shot within angle and power limits', () => {
    const rng = createRng(77);
    for (const s of scenarios) {
      for (const difficulty of ['easy', 'normal', 'challenging'] as const) {
        const shot = enemyShot({ difficulty, rng, shotIndexInRound: 3, worldWidth: W, worldHeight: H, ...s });
        expect(shot.angleDeg).toBeGreaterThanOrEqual(90);
        expect(shot.angleDeg).toBeLessThanOrEqual(180);
        expect(shot.power).toBeGreaterThanOrEqual(0);
        expect(shot.power).toBeLessThanOrEqual(100);
      }
    }
  });

  it('takes no attempts, help or challenge data as input (FR-042)', () => {
    expectTypeOf<keyof EnemyShotInput>().toEqualTypeOf<
      'difficulty' | 'rng' | 'shotIndexInRound' | 'origin' | 'target' | 'terrain' | 'worldWidth' | 'worldHeight'
    >();
    expectTypeOf<EnemyShotInput>().not.toHaveProperty('attempts');
    expectTypeOf<EnemyShotInput>().not.toHaveProperty('help');
    expectTypeOf<EnemyShotInput>().not.toHaveProperty('challenge');
    expectTypeOf<EnemyShotInput['rng']>().toEqualTypeOf<Rng>();
  });
});

describe('enemyDamageFactor', () => {
  it('halves damage on easy only', () => {
    expect(enemyDamageFactor('easy')).toBe(0.5);
    expect(enemyDamageFactor('normal')).toBe(1);
    expect(enemyDamageFactor('challenging')).toBe(1);
  });
});
