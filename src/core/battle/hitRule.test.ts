import { describe, expect, it } from 'vitest';
import { MAX_DAMAGE } from '../physics/damage';
import { bodyHalfWidth, enemyDamage, shotKind } from './hitRule';

const r = (min: number, max: number) => ({ min, max });

describe('bodyHalfWidth (amendment 04, FR-066)', () => {
  it('is half the 60-unit tank width in numbers: 30 / 1440 of the range width', () => {
    expect(bodyHalfWidth(0, 100)).toBeCloseTo(2.083, 3);
    expect(bodyHalfWidth(550, 780)).toBeCloseTo(4.792, 3);
    expect(bodyHalfWidth(0, 1000)).toBeCloseTo(20.833, 3);
    expect(bodyHalfWidth(0, 10)).toBeCloseTo(0.208, 3);
  });
});

describe('shotKind (FR-066, FR-071)', () => {
  it('the exact number is a bullseye in every range', () => {
    const cases: Array<[number, number, number]> = [[0, 10, 5], [0, 100, 0], [0, 100, 100], [550, 780, 637], [-20, 30, -7], [0, 1000, 437]];
    for (const [min, max, n] of cases) {
      expect(shotKind(n, n, r(min, max))).toBe('bullseye');
    }
  });

  it('0 to 100: 1 and 2 away land on the body, 3 away is a miss', () => {
    expect(shotKind(31, 30, r(0, 100))).toBe('body');
    expect(shotKind(32, 30, r(0, 100))).toBe('body');
    expect(shotKind(28, 30, r(0, 100))).toBe('body');
    expect(shotKind(33, 30, r(0, 100))).toBe('miss');
    expect(shotKind(27, 30, r(0, 100))).toBe('miss');
  });

  it('0 to 10: the body is narrower than one step, so 1 away is a miss', () => {
    expect(shotKind(4, 5, r(0, 10))).toBe('miss');
    expect(shotKind(6, 5, r(0, 10))).toBe('miss');
  });

  it('0 to 1000: 20 away is on the body, 22 away is a miss', () => {
    expect(shotKind(457, 437, r(0, 1000))).toBe('body');
    expect(shotKind(417, 437, r(0, 1000))).toBe('body');
    expect(shotKind(459, 437, r(0, 1000))).toBe('miss');
  });

  it('550 to 780: 4 away is on the body, 5 away is a miss', () => {
    expect(shotKind(641, 637, r(550, 780))).toBe('body');
    expect(shotKind(633, 637, r(550, 780))).toBe('body');
    expect(shotKind(642, 637, r(550, 780))).toBe('miss');
    expect(shotKind(632, 637, r(550, 780))).toBe('miss');
  });

  it('is symmetric and agrees with bodyHalfWidth for every distance', () => {
    const range = r(0, 1000);
    for (let d = 1; d <= 30; d++) {
      const expected = d <= bodyHalfWidth(0, 1000) ? 'body' : 'miss';
      expect(shotKind(500 + d, 500, range)).toBe(expected);
      expect(shotKind(500 - d, 500, range)).toBe(expected);
    }
  });
});

describe('enemyDamage (FR-066, FR-071, FR-074)', () => {
  it('a bullseye costs twice the hit damage, a body hit the hit damage, a miss nothing', () => {
    expect(enemyDamage('bullseye', false)).toBe(2 * MAX_DAMAGE);
    expect(enemyDamage('body', false)).toBe(MAX_DAMAGE);
    expect(enemyDamage('miss', false)).toBe(0);
  });

  it('with exactHit only the bullseye does damage', () => {
    expect(enemyDamage('bullseye', true)).toBe(2 * MAX_DAMAGE);
    expect(enemyDamage('body', true)).toBe(0);
    expect(enemyDamage('miss', true)).toBe(0);
  });
});
