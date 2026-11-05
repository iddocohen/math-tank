import { describe, expect, it } from 'vitest';
import * as damage from '../physics/damage';
import * as hitRule from './hitRule';
import type { TankState } from '../types';
import { bodyHalfWidth, enemyHitsPlayer, LIVES, shotKind } from './hitRule';

const r = (min: number, max: number) => ({ min, max });

describe('bodyHalfWidth (amendment 04, FR-066)', () => {
  it('is half the 60-unit tank width in numbers: 30 / 1440 of the range width', () => {
    expect(bodyHalfWidth(0, 100)).toBeCloseTo(2.083, 3);
    expect(bodyHalfWidth(550, 780)).toBeCloseTo(4.792, 3);
    expect(bodyHalfWidth(0, 1000)).toBeCloseTo(20.833, 3);
    expect(bodyHalfWidth(0, 10)).toBeCloseTo(0.208, 3);
  });
});

describe('shotKind (amendment 06, FR-066)', () => {
  it('the exact number is a hit in every range', () => {
    const cases: Array<[number, number, number]> = [[0, 10, 5], [0, 100, 0], [0, 100, 100], [550, 780, 637], [-20, 30, -7], [0, 1000, 437]];
    for (const [min, max, n] of cases) {
      expect(shotKind(n, n, r(min, max))).toBe('hit');
    }
  });

  it('0 to 100: 1 and 2 away are near misses on the body, 3 away is a miss', () => {
    expect(shotKind(31, 30, r(0, 100))).toBe('near');
    expect(shotKind(32, 30, r(0, 100))).toBe('near');
    expect(shotKind(28, 30, r(0, 100))).toBe('near');
    expect(shotKind(33, 30, r(0, 100))).toBe('miss');
    expect(shotKind(27, 30, r(0, 100))).toBe('miss');
  });

  it('0 to 10: the body is narrower than one step, so 1 away is a miss', () => {
    expect(shotKind(4, 5, r(0, 10))).toBe('miss');
    expect(shotKind(6, 5, r(0, 10))).toBe('miss');
  });

  it('0 to 1000: 20 away is on the body, 22 away is a miss', () => {
    expect(shotKind(457, 437, r(0, 1000))).toBe('near');
    expect(shotKind(417, 437, r(0, 1000))).toBe('near');
    expect(shotKind(459, 437, r(0, 1000))).toBe('miss');
  });

  it('550 to 780: 4 away is on the body, 5 away is a miss', () => {
    expect(shotKind(641, 637, r(550, 780))).toBe('near');
    expect(shotKind(633, 637, r(550, 780))).toBe('near');
    expect(shotKind(642, 637, r(550, 780))).toBe('miss');
    expect(shotKind(632, 637, r(550, 780))).toBe('miss');
  });

  it('is symmetric and agrees with bodyHalfWidth for every distance', () => {
    const range = r(0, 1000);
    for (let d = 1; d <= 30; d++) {
      const expected = d <= bodyHalfWidth(0, 1000) ? 'near' : 'miss';
      expect(shotKind(500 + d, 500, range)).toBe(expected);
      expect(shotKind(500 - d, 500, range)).toBe(expected);
    }
  });
});

describe('enemyHitsPlayer (amendment 06, FR-006)', () => {
  const player: TankState = { id: 'player', kind: 'player', position: 0, x: 200, y: 300, alive: true };

  it('a shell that entered the player\'s hit circle hits', () => {
    expect(enemyHitsPlayer({ x: 900, y: 300 }, 'player', player)).toBe(true);
  });

  it('a shell within half the tank width of the player\'s x hits, one unit further does not', () => {
    expect(enemyHitsPlayer({ x: 230, y: 300 }, null, player)).toBe(true);
    expect(enemyHitsPlayer({ x: 170, y: 300 }, null, player)).toBe(true);
    expect(enemyHitsPlayer({ x: 231, y: 300 }, null, player)).toBe(false);
    expect(enemyHitsPlayer({ x: 169, y: 300 }, null, player)).toBe(false);
  });

  it('another tank as target is not a hit on the player', () => {
    expect(enemyHitsPlayer({ x: 900, y: 300 }, 'decoy-1', player)).toBe(false);
  });
});

describe('constants and removed damage (amendment 06)', () => {
  it('the child has 3 lives; the every-2-shots rhythm is gone (amendment 07)', () => {
    expect(LIVES).toBe(3);
    expect('ENEMY_FIRE_EVERY' in hitRule).toBe(false);
  });

  it('there is no damage any more', () => {
    expect('enemyDamage' in hitRule).toBe(false);
    expect('MAX_DAMAGE' in damage).toBe(false);
    expect('damageAt' in damage).toBe(false);
  });
});
