import { describe, expect, it } from 'vitest';
import { ticksFor, type RulerLevel } from '../numberline/ticks';
import { defaultSettings } from '../settings/defaults';
import { withRange } from '../settings/validate';
import type { Settings, Skill } from '../types';
import { minEnemyGap } from './gaps';
import { generateChallenge } from './generate';
import { checkAnswer, validateChallenge } from './validate';

const ZERO_STEPS: Record<Skill, number> = {
  positions: 0,
  countForward: 0,
  countBackward: 0,
  tens: 0,
  crossTens: 0,
  addition: 0,
  subtraction: 0,
  comparison: 0,
};
const LEVELS: RulerLevel[] = [1, 2, 3, 4, 5];

function rangeSettings(min: number, max: number): Settings {
  const known = ['0-10', '0-20', '0-50', '0-100', '0-1000'];
  const preset = `${min}-${max}`;
  return withRange(defaultSettings(), {
    preset: (known.includes(preset) ? preset : 'custom') as Settings['range']['preset'],
    min,
    max,
  });
}

function readPosition(settings: Settings, rulerLevel: RulerLevel, roundSeed: number, playerPosition: number) {
  return generateChallenge({
    settings,
    skillSteps: ZERO_STEPS,
    roundSeed,
    turn: 1,
    playerPosition,
    rulerLevel,
    kindsAllowed: ['readPosition'],
  });
}

const isMultiple = (v: number, step: number) => ((v % step) + step) % step === 0;

describe('readPosition challenge (FR-067, FR-068, US9 scenario 5)', () => {
  const ranges: Array<[number, number]> = [
    [0, 10],
    [0, 20],
    [0, 100],
    [0, 1000],
    [550, 780],
    [-20, 30],
    [7, 893],
    [-1000, -995],
  ];

  for (const [min, max] of ranges) {
    for (const level of LEVELS) {
      it(`places the answer by the level rule and inside the range (${min} to ${max}, level ${level})`, () => {
        const settings = rangeSettings(min, max);
        const { minorStep } = ticksFor(settings.range, level, 0);
        for (let seed = 0; seed < 100; seed++) {
          for (const playerPosition of [min, max]) {
            const c = readPosition(settings, level, seed, playerPosition);
            expect(c.kind).toBe('readPosition');
            expect(c.mainSkill).toBe('positions');
            expect(c.rulerLevel).toBe(level);
            expect(c.prompt.key).toBe('readPosition');
            expect(Number.isInteger(c.answer)).toBe(true);
            expect(c.answer).toBeGreaterThanOrEqual(min);
            expect(c.answer).toBeLessThanOrEqual(max);
            expect(Math.abs(c.answer - playerPosition)).toBeGreaterThanOrEqual(minEnemyGap(min, max));
            if (level <= 3) expect(isMultiple(c.answer, minorStep), `answer ${c.answer}`).toBe(true);
            expect(validateChallenge(c, settings, playerPosition)).toEqual([]);
          }
        }
      });
    }
  }

  it('uses answers off the minor grid on levels 4 and 5 for some seeds', () => {
    const settings = rangeSettings(0, 1000);
    for (const level of [4, 5] as const) {
      const answers = new Set<number>();
      for (let seed = 0; seed < 300; seed++) answers.add(readPosition(settings, level, seed, 0).answer);
      expect([...answers].some((a) => a % 10 !== 0)).toBe(true);
    }
  });

  it('with range 550 to 780 and level 2, every answer is a multiple of 10', () => {
    const settings = rangeSettings(550, 780);
    for (let seed = 0; seed < 300; seed++) {
      for (const playerPosition of [550, 780]) {
        expect(readPosition(settings, 2, seed, playerPosition).answer % 10).toBe(0);
      }
    }
  });

  it('challenges carry no hit tolerance: the tank-body rule decides hits (amendment 04)', () => {
    for (const [min, max] of ranges) {
      const settings = rangeSettings(min, max);
      for (const level of LEVELS) {
        for (let seed = 0; seed < 50; seed++) {
          expect(readPosition(settings, level, seed, min)).not.toHaveProperty('hitTolerance');
        }
      }
    }
  });

  it('checkAnswer accepts only the exact answer on every ruler level', () => {
    const settings = rangeSettings(0, 100);
    for (const level of LEVELS) {
      for (let seed = 0; seed < 50; seed++) {
        const c = readPosition(settings, level, seed, 0);
        expect(checkAnswer(c, c.answer)).toBe(true);
        expect(checkAnswer(c, c.answer + 1)).toBe(false);
        expect(checkAnswer(c, c.answer - 1)).toBe(false);
      }
    }
  });

  it('generateChallenge with kindsAllowed readPosition returns only that kind, also with number line off', () => {
    const settings = rangeSettings(0, 100);
    settings.challengeTypes = { numberLine: false, addition: true, subtraction: true, comparison: true };
    for (let seed = 0; seed < 200; seed++) {
      expect(readPosition(settings, 1, seed, 0).kind).toBe('readPosition');
    }
  });

  it('is offered among the number-line kinds by default', () => {
    const settings = rangeSettings(0, 100);
    const kinds = new Set<string>();
    for (let seed = 0; seed < 1_000; seed++) {
      kinds.add(generateChallenge({ settings, skillSteps: ZERO_STEPS, roundSeed: seed, turn: 1, playerPosition: 0, rulerLevel: 1 }).kind);
    }
    expect(kinds.has('readPosition')).toBe(true);
  });

  it('the same seed gives the same challenge', () => {
    const settings = rangeSettings(550, 780);
    for (const level of LEVELS) {
      expect(readPosition(settings, level, 77, 550)).toEqual(readPosition(settings, level, 77, 550));
    }
  });
});
