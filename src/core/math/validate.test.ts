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

describe('validateChallenge comparison rules (T086, FR-027, amendment 09)', () => {
  // 0 to 100: minOptionGap 2, minEnemyGap 15.
  const params = (options: number[]) => Object.fromEntries(options.map((o, i) => [`o${i + 1}`, o]));
  const greater = (options: number[], answer: number) =>
    challenge({ kind: 'greater', mainSkill: 'comparison', skills: ['comparison'], prompt: { key: 'greater', params: params(options) }, operands: options, options, answer });

  it('accepts a valid comparison', () => {
    expect(validateChallenge(greater([47, 74], 74), settings, 100)).toEqual([]);
  });

  it('accepts options near the player tank and 2 apart: only the enemy keeps its distance from the player', () => {
    expect(validateChallenge(greater([5, 74], 74), settings, 0)).toEqual([]);
    expect(validateChallenge(greater([72, 74], 74), settings, 0)).toEqual([]);
  });

  it('reports options closer than minOptionGap to each other', () => {
    expect(validateChallenge(greater([73, 74], 74), settings, 0).some((e) => e.includes('closer than'))).toBe(true);
  });

  it('reports an enemy closer than minEnemyGap to the player', () => {
    expect(validateChallenge(greater([47, 90], 90), settings, 100).length).toBeGreaterThan(0);
  });

  it('reports an answer that is not the one correct option', () => {
    expect(validateChallenge(greater([47, 74], 47), settings, 100).length).toBeGreaterThan(0);
    const closest = challenge({ kind: 'closestTo', mainSkill: 'comparison', prompt: { key: 'closestTo', params: { ...params([40, 60]), n: 50 } }, operands: [40, 60, 50], options: [40, 60], answer: 40 });
    expect(validateChallenge(closest, settings, 100).some((e) => e.includes('correct option'))).toBe(true);
    const between = challenge({ kind: 'between', mainSkill: 'comparison', prompt: { key: 'between', params: { ...params([20, 40, 60]), a: 30, b: 70 } }, operands: [20, 40, 60, 30, 70], options: [20, 40, 60], answer: 40 });
    expect(validateChallenge(between, settings, 100).some((e) => e.includes('correct option'))).toBe(true);
  });

  it('middle3 needs the middle number as the answer', () => {
    const middle = (answer: number) =>
      challenge({ kind: 'middle3', mainSkill: 'comparison', prompt: { key: 'middle3', params: params([72, 27, 45]) }, operands: [72, 27, 45], options: [72, 27, 45], answer });
    expect(validateChallenge(middle(45), settings, 0)).toEqual([]);
    expect(validateChallenge(middle(72), settings, 0).some((e) => e.includes('correct option'))).toBe(true);
  });

  it('reports a wrong number of options', () => {
    expect(validateChallenge(greater([20, 47, 74], 74), settings, 100).some((e) => e.includes('options instead of'))).toBe(true);
  });

  it('reports prompt options that differ from the options', () => {
    const c = greater([47, 74], 74);
    expect(validateChallenge({ ...c, prompt: { key: 'greater', params: params([74, 47]) } }, settings, 100).some((e) => e.includes('prompt'))).toBe(true);
  });

  it('reports an order answer, which no kind has since amendment 09', () => {
    const c = { ...greater([47, 74], 74), orderAnswer: [47, 74] } as Challenge;
    expect(validateChallenge(c, settings, 100).some((e) => e.includes('order'))).toBe(true);
  });
});

describe('checkAnswer (FR-029)', () => {
  it('accepts only the exact answer', () => {
    const c = challenge({});
    expect(checkAnswer(c, 50)).toBe(true);
    expect(checkAnswer(c, 49)).toBe(false);
    expect(checkAnswer(c, 51)).toBe(false);
    expect(checkAnswer(c, 50.4)).toBe(false);
  });
});
