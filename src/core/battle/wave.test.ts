import { describe, expect, it } from 'vitest';
import { nearestEnemy, wavePositions, waveSize } from './wave';
import { defaultSettings } from '../settings/defaults';
import type { Challenge, ChallengeKind, Settings, TankState } from '../types';
import { createRng } from '../rng';
import { minTankGap } from '../math/gaps';
import { readPositionAnswers } from '../math/readPosition';
import { createRound, ENEMY_ID } from './round';
import { startSearch } from './guided';

function settingsFor(min: number, max: number, overrides: Partial<Settings> = {}): Settings {
  const preset = `${min}-${max}`;
  const known = ['0-10', '0-20', '0-50', '0-100', '0-1000'].includes(preset);
  return { ...defaultSettings(), range: { preset: (known ? preset : 'custom') as Settings['range']['preset'], min, max }, ...overrides };
}

function challengeOf(kind: ChallengeKind): Challenge {
  return { id: '1-0', seed: 1, kind, difficultyStep: 0, mainSkill: 'positions', skills: ['positions'], prompt: { key: kind, params: {} }, operands: [], answer: 50 };
}

function tank(id: string, position: number): TankState {
  return { id, kind: 'enemy', position, x: position, y: 0, alive: true };
}

describe('wavePositions (amendment 21, FR-137)', () => {
  const ranges: Array<[number, number]> = [
    [0, 10],
    [0, 100],
    [550, 780],
    [0, 1000],
  ];
  for (const [min, max] of ranges) {
    it(`places up to N enemies on drawn lines, apart from each other and from the player, in ${min} to ${max}`, () => {
      const settings = settingsFor(min, max);
      const gap = minTankGap(min, max);
      for (const level of [1, 3, 5] as const) {
        const lines = new Set(readPositionAnswers(settings, level));
        for (let seed = 1; seed <= 60; seed++) {
          for (const player of [min, max]) {
            for (let size = 1; size <= 4; size++) {
              const candidates = [...lines].filter((n) => Math.abs(n - player) >= gap);
              const first = candidates[seed % candidates.length]!;
              const out = wavePositions({ settings, rulerLevel: level, first, player, size, rng: createRng(seed) });
              expect(out[0]).toBe(first);
              expect(out.length).toBeGreaterThanOrEqual(1);
              expect(out.length).toBeLessThanOrEqual(size);
              for (const n of out) {
                expect(lines.has(n), `${n} on a drawn line`).toBe(true);
                expect(Math.abs(n - player)).toBeGreaterThanOrEqual(gap);
              }
              for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) expect(Math.abs(out[i]! - out[j]!)).toBeGreaterThanOrEqual(gap);
              // Deterministic for a seed.
              expect(wavePositions({ settings, rulerLevel: level, first, player, size, rng: createRng(seed) })).toEqual(out);
            }
          }
        }
      }
    });
  }

  it('fills the wave when the range has room (0 to 100: 4 enemies always fit)', () => {
    const settings = settingsFor(0, 100);
    for (let seed = 1; seed <= 100; seed++) {
      expect(wavePositions({ settings, rulerLevel: 1, first: 60, player: 0, size: 4, rng: createRng(seed) })).toHaveLength(4);
    }
  });

  it('places fewer enemies, never fewer than 1, when the range is too small', () => {
    // 0 to 10: the gap is about 0.8 numbers but one tank width; with the player at 0 there is room for few tanks.
    const settings = settingsFor(0, 10);
    const gap = minTankGap(0, 10);
    const most = Math.floor((10 - gap) / gap) + 1;
    for (let seed = 1; seed <= 50; seed++) {
      const out = wavePositions({ settings, rulerLevel: 1, first: 10, player: 0, size: 4, rng: createRng(seed) });
      expect(out.length).toBeGreaterThanOrEqual(1);
      expect(out.length).toBeLessThanOrEqual(Math.min(4, most));
    }
    // A range with no room at all for a second enemy keeps the first.
    const tiny = settingsFor(0, 5);
    expect(wavePositions({ settings: tiny, rulerLevel: 1, first: 5, player: 0, size: 3, rng: createRng(1) }).length).toBeGreaterThanOrEqual(1);
  });
});

describe('waveSize (amendment 21, FR-137)', () => {
  it('is enemiesAtOnce in "Nur Zahlenstrahl" and in "Gemischt" readPosition searches, 1 otherwise', () => {
    const s = { ...defaultSettings(), enemiesAtOnce: 3 as const };
    expect(waveSize('ruler', s, challengeOf('readPosition'))).toBe(3);
    expect(waveSize('mixed', s, challengeOf('readPosition'))).toBe(3);
    for (const kind of ['findNumber', 'after', 'addition', 'greater', 'middle3'] as const) expect(waveSize('mixed', s, challengeOf(kind))).toBe(1);
    expect(waveSize('math', s, challengeOf('addition'))).toBe(1);
    expect(waveSize('ruler', defaultSettings(), challengeOf('readPosition'))).toBe(1);
  });
});

describe('nearestEnemy (amendment 21, FR-141)', () => {
  it('picks the enemy nearest the number, the leftmost on a tie', () => {
    const tanks = [tank('a', 70), tank('b', 30), tank('c', 50)];
    expect(nearestEnemy(68, tanks).id).toBe('a');
    expect(nearestEnemy(40, tanks).id).toBe('b');
    expect(nearestEnemy(0, tanks).id).toBe('b');
    expect(nearestEnemy(60, tanks).id).toBe('c');
  });
});

describe('startSearch with a wave keeps the ENEMY_ID tank (amendment 21, FR-141)', () => {
  it('starts every search from the ENEMY_ID tank, also when a wave enemy was the help target', () => {
    const settings = settingsFor(0, 100, { enemiesAtOnce: 4 });
    for (let seed = 1; seed <= 40; seed++) {
      let s = createRound(settings, seed, 'left', 'ruler');
      for (let turn = 0; turn < 4; turn++) {
        s = startSearch({ ...s, turn }, settings, 0, null);
        const ids = [s.enemy, ...s.wave].map((t) => t.id);
        expect(ids).toContain(ENEMY_ID);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });
});
