/**
 * Code review: the allowed readPosition answers are computed once per range and ruler level, not again for every
 * built challenge and every validation. The answers stay the same.
 */
import { describe, expect, it, vi } from 'vitest';
import * as ticks from '../numberline/ticks';
import { defaultSettings } from '../settings/defaults';
import type { Skill } from '../types';
import { generateChallenge } from './generate';
import { readPositionAnswers } from './readPosition';
import { validateChallenge } from './validate';

vi.mock('../numberline/ticks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../numberline/ticks')>();
  return { ...actual, ticksFor: vi.fn(actual.ticksFor) };
});

const ZERO_STEPS: Record<Skill, number> = { positions: 0, countForward: 0, countBackward: 0, tens: 0, crossTens: 0, addition: 0, subtraction: 0, comparison: 0 };

describe('readPositionAnswers cache', () => {
  it('generating and validating 200 readPosition challenges computes the ruler lines once per range and level', () => {
    const settings = { ...defaultSettings(), range: { preset: 'custom' as const, min: 37, max: 213 } };
    const ticksFor = vi.mocked(ticks.ticksFor);
    ticksFor.mockClear();
    for (let seed = 0; seed < 200; seed++) {
      const playerPosition = seed % 2 === 0 ? 37 : 213;
      const c = generateChallenge({ settings, skillSteps: ZERO_STEPS, roundSeed: seed, turn: 1, playerPosition, rulerLevel: 2, kindsAllowed: ['readPosition'] });
      expect(c.kind).toBe('readPosition');
      expect(validateChallenge(c, settings, playerPosition)).toEqual([]);
    }
    const calls = ticksFor.mock.calls.filter(([view, level]) => view.min === 37 && view.max === 213 && level === 2);
    expect(calls).toHaveLength(1);
  });

  it('gives the same answers as the ruler lines, for each range and level, also after another range was asked', () => {
    const a = { ...defaultSettings(), range: { preset: 'custom' as const, min: 0, max: 100 } };
    const b = { ...defaultSettings(), range: { preset: 'custom' as const, min: 0, max: 1000 } };
    for (const level of [1, 2, 3, 4, 5] as const) {
      const expected = (s: typeof a) => {
        const { minorStep, ticks: all } = ticks.ticksFor(s.range, level);
        return all.filter((t) => ticks.isMultiple(t.value, minorStep)).map((t) => t.value);
      };
      expect([...readPositionAnswers(a, level)]).toEqual(expected(a));
      expect([...readPositionAnswers(b, level)]).toEqual(expected(b));
      expect([...readPositionAnswers(a, level)]).toEqual(expected(a));
    }
    // Amendment 20: levels 4 and 5 draw every line, so they give the same answers as level 1.
    expect([...readPositionAnswers(b, 5)]).toEqual([...readPositionAnswers(b, 1)]);
    expect([...readPositionAnswers(b, 4)]).toEqual(Array.from({ length: 101 }, (_, i) => i * 10));
  });
});
