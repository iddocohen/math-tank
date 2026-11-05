import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import type { Challenge, Settings } from '../types';
import { checkAnswer, validateChallenge } from './validate';

const settings: Settings = defaultSettings(); // range 0 to 100, minEnemyGap 15

function challenge(patch: Partial<Challenge>): Challenge {
  return {
    id: '1-1',
    seed: 1,
    kind: 'findNumber',
    difficultyStep: 0,
    mainSkill: 'positions',
    skills: ['positions'],
    prompt: { key: 'findNumber', params: { n: 50 } },
    operands: [50],
    answer: 50,
    ...patch,
  };
}

describe('validateChallenge (FR-029)', () => {
  it('accepts a valid challenge', () => {
    expect(validateChallenge(challenge({}), settings, 0)).toEqual([]);
  });

  it('reports an answer outside the range', () => {
    const c = challenge({ answer: 101, operands: [101], prompt: { key: 'findNumber', params: { n: 101 } } });
    expect(validateChallenge(c, settings, 0).length).toBeGreaterThan(0);
    const below = challenge({ answer: -1, operands: [-1], prompt: { key: 'findNumber', params: { n: -1 } } });
    expect(validateChallenge(below, settings, 100).length).toBeGreaterThan(0);
  });

  it('reports a non-integer answer', () => {
    const c = challenge({ answer: 2.5, operands: [2.5], prompt: { key: 'findNumber', params: { n: 2.5 } } });
    expect(validateChallenge(c, settings, 100).length).toBeGreaterThan(0);
  });

  it('reports an operand outside the range', () => {
    const c = challenge({
      kind: 'after',
      mainSkill: 'countForward',
      skills: ['countForward'],
      prompt: { key: 'after', params: { n: 100 } },
      operands: [100],
      answer: 101,
    });
    expect(validateChallenge(c, settings, 0).length).toBeGreaterThan(0);
    const d = challenge({ operands: [50, 120] });
    expect(validateChallenge(d, settings, 0).length).toBeGreaterThan(0);
  });

  it('reports intermediate steps and options outside the range', () => {
    expect(validateChallenge(challenge({ steps: [50, 140] }), settings, 0).length).toBeGreaterThan(0);
    expect(validateChallenge(challenge({ options: [50, -3] }), settings, 0).length).toBeGreaterThan(0);
  });

  it('reports an answer closer than minEnemyGap to the player', () => {
    const near = challenge({ answer: 14, operands: [14], prompt: { key: 'findNumber', params: { n: 14 } } });
    expect(validateChallenge(near, settings, 0).length).toBeGreaterThan(0);
    const edge = challenge({ answer: 15, operands: [15], prompt: { key: 'findNumber', params: { n: 15 } } });
    expect(validateChallenge(edge, settings, 0)).toEqual([]);
    const right = challenge({ answer: 86, operands: [86], prompt: { key: 'findNumber', params: { n: 86 } } });
    expect(validateChallenge(right, settings, 100).length).toBeGreaterThan(0);
  });

  it('reports a number-line challenge whose answer does not follow from its prompt', () => {
    const c = challenge({
      kind: 'after',
      mainSkill: 'countForward',
      skills: ['countForward'],
      prompt: { key: 'after', params: { n: 49 } },
      operands: [49],
      answer: 51,
    });
    expect(validateChallenge(c, settings, 0).length).toBeGreaterThan(0);
  });

  it('reports a steps challenge that crosses a ten when crossing tens is off', () => {
    const c = challenge({
      kind: 'stepsRight',
      mainSkill: 'countForward',
      skills: ['countForward', 'crossTens'],
      prompt: { key: 'stepsRight', params: { n: 38, k: 5 } },
      operands: [38],
      answer: 43,
    });
    expect(validateChallenge(c, settings, 0)).toEqual([]);
    expect(validateChallenge(c, { ...settings, crossTens: false }, 0).length).toBeGreaterThan(0);
  });

  it('reports a steps challenge that crosses a hundred when crossing hundreds is off', () => {
    const wide: Settings = { ...settings, range: { preset: '0-1000', min: 0, max: 1000 } };
    const c = challenge({
      kind: 'stepsLeft',
      mainSkill: 'countBackward',
      skills: ['countBackward', 'crossTens'],
      prompt: { key: 'stepsLeft', params: { n: 503, k: 6 } },
      operands: [503],
      answer: 497,
    });
    expect(validateChallenge(c, { ...wide, crossHundreds: true }, 0)).toEqual([]);
    expect(validateChallenge(c, { ...wide, crossHundreds: false }, 0).length).toBeGreaterThan(0);
  });

  it('reports a midpoint that is not between two neighboring major ticks', () => {
    const c = challenge({
      kind: 'midpoint',
      prompt: { key: 'midpoint', params: { a: 30, b: 50 } },
      operands: [30, 50],
      answer: 40,
    });
    expect(validateChallenge(c, settings, 0).length).toBeGreaterThan(0);
  });

  it('reports duplicate options and options without the answer', () => {
    expect(validateChallenge(challenge({ options: [50, 50] }), settings, 0).length).toBeGreaterThan(0);
    expect(validateChallenge(challenge({ options: [60, 80] }), settings, 0).length).toBeGreaterThan(0);
  });
});

describe('checkAnswer (FR-029)', () => {
  it('accepts only the exact answer', () => {
    const c = challenge({});
    expect(checkAnswer(c, 50)).toBe(true);
    expect(checkAnswer(c, 49)).toBe(false);
    expect(checkAnswer(c, 51)).toBe(false);
    expect(checkAnswer(c, 50.4)).toBe(false);
    expect(checkAnswer(c, [50])).toBe(false);
  });

  it('for order3 accepts only the exact tap sequence', () => {
    const c = challenge({ kind: 'order3', options: [20, 50, 80], orderAnswer: [20, 50, 80], answer: 20 });
    expect(checkAnswer(c, [20, 50, 80])).toBe(true);
    expect(checkAnswer(c, [20, 80, 50])).toBe(false);
    expect(checkAnswer(c, [20, 50])).toBe(false);
    expect(checkAnswer(c, 20)).toBe(false);
  });
});
