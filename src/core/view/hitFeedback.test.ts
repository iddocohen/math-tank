import { describe, expect, it } from 'vitest';
import { followHit, hitOutdated } from './hitFeedback';
import type { Challenge, LastShot, RoundState } from '../types';

const hit = { hit: true, landed: 40 } as LastShot;
const c1 = { id: 'a' } as Challenge;
const c2 = { id: 'b' } as Challenge;
const state = (phase: RoundState['phase'], challenge: Challenge | null, lastShot: LastShot | null = hit) =>
  ({ phase, challenge, lastShot }) as RoundState;

describe('followHit and hitOutdated (T233)', () => {
  it('a hit belongs to the challenge shown after the shot phase; a later challenge outdates it', () => {
    const first = followHit(null, state('playerShot', c1))!;
    expect(first).toEqual({ shot: hit, challenge: undefined });
    expect(hitOutdated(first, state('playerShot', c1))).toBe(false);
    const owned = followHit(first, state('challenge', c2))!;
    expect(owned.challenge).toBe(c2);
    expect(followHit(owned, state('enemyTurn', c2))).toBe(owned);
    expect(hitOutdated(owned, state('challenge', c2))).toBe(false);
    expect(hitOutdated(owned, state('challenge', c1))).toBe(true);
  });

  it('gives null when the last shot was no hit', () => {
    expect(followHit(null, state('challenge', c1, null))).toBeNull();
    expect(followHit(null, state('challenge', c1, { ...hit, hit: false }))).toBeNull();
  });
});
