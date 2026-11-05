import { describe, expect, it } from 'vitest';
import type { Challenge } from '../types';
import { stepPath } from './stepPath';

type Moving = Pick<Challenge, 'kind' | 'operands' | 'answer' | 'steps'>;

const sub43minus7: Moving = { kind: 'subtraction', operands: [43, 7], answer: 36, steps: [43, 36] };
const add24plus8: Moving = { kind: 'addition', operands: [24, 8], answer: 32, steps: [24, 32] };

describe('stepPath (FR-024, US3 scenarios 1 and 2)', () => {
  it('pauses at the crossed ten with beginner assistance', () => {
    expect(stepPath(sub43minus7, true)).toEqual([43, 40, 36]);
    expect(stepPath(add24plus8, true)).toEqual([24, 30, 32]);
  });

  it('goes straight from start to result without beginner assistance', () => {
    expect(stepPath(sub43minus7, false)).toEqual([43, 36]);
    expect(stepPath(add24plus8, false)).toEqual([24, 32]);
  });

  it('works without a steps list, from the first operand to the answer', () => {
    expect(stepPath({ kind: 'subtraction', operands: [43, 7], answer: 36 }, true)).toEqual([43, 40, 36]);
  });

  it('passes through the intermediate result of a two-step exercise', () => {
    const add: Moving = { kind: 'addition', operands: [24, 8, 5], answer: 37, steps: [24, 32, 37] };
    expect(stepPath(add, false)).toEqual([24, 32, 37]);
    expect(stepPath(add, true)).toEqual([24, 30, 32, 37]);
    const sub: Moving = { kind: 'subtraction', operands: [52, 4, 9], answer: 39, steps: [52, 48, 39] };
    expect(stepPath(sub, false)).toEqual([52, 48, 39]);
    expect(stepPath(sub, true)).toEqual([52, 50, 48, 40, 39]);
  });

  it('stops at every ten when a step crosses several', () => {
    expect(stepPath({ kind: 'addition', operands: [24, 18], answer: 42, steps: [24, 42] }, true)).toEqual([24, 30, 40, 42]);
  });

  it('does not repeat a ten the exercise starts or ends on', () => {
    expect(stepPath({ kind: 'addition', operands: [24, 6], answer: 30, steps: [24, 30] }, true)).toEqual([24, 30]);
    expect(stepPath({ kind: 'subtraction', operands: [40, 3], answer: 37, steps: [40, 37] }, true)).toEqual([40, 37]);
  });
});
