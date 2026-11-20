import { describe, expect, it } from 'vitest';
import type { Challenge } from '../types';
import { placeValueHelp, placeValuePath } from './placeValue';
import { stepPath } from './stepPath';

describe('placeValueHelp, column form (amendment 26 item 7, FR-154)', () => {
  it('35 + 12: a tens line and a ones line, parts [40, 7]', () => {
    expect(placeValueHelp('addition', 35, 12)).toEqual({
      form: 'columns',
      sign: 1,
      lines: [
        { place: 'tens', a: 30, b: 10, result: 40 },
        { place: 'ones', a: 5, b: 2, result: 7 },
      ],
      parts: [40, 7],
      answer: 47,
    });
  });

  it('34 + 19 with carrying stays in columns: parts [40, 13]', () => {
    expect(placeValueHelp('addition', 34, 19)).toMatchObject({
      form: 'columns',
      lines: [
        { place: 'tens', a: 30, b: 10, result: 40 },
        { place: 'ones', a: 4, b: 9, result: 13 },
      ],
      parts: [40, 13],
      answer: 53,
    });
  });

  it('45 + 6: only a ones line; the tens of the first number become a part', () => {
    expect(placeValueHelp('addition', 45, 6)).toMatchObject({ form: 'columns', lines: [{ place: 'ones', a: 5, b: 6, result: 11 }], parts: [40, 11], answer: 51 });
  });

  it('46 − 12 without borrowing: columns with sign −1', () => {
    expect(placeValueHelp('subtraction', 46, 12)).toEqual({
      form: 'columns',
      sign: -1,
      lines: [
        { place: 'tens', a: 40, b: 10, result: 30 },
        { place: 'ones', a: 6, b: 2, result: 4 },
      ],
      parts: [30, 4],
      answer: 34,
    });
  });

  it('46 − 2: only a ones line, parts [40, 4]', () => {
    expect(placeValueHelp('subtraction', 46, 2)).toMatchObject({ form: 'columns', lines: [{ place: 'ones', a: 6, b: 2, result: 4 }], parts: [40, 4], answer: 44 });
  });

  it('234 + 152: a hundreds line first, parts [300, 80, 6]', () => {
    expect(placeValueHelp('addition', 234, 152)).toMatchObject({
      form: 'columns',
      lines: [
        { place: 'hundreds', a: 200, b: 100, result: 300 },
        { place: 'tens', a: 30, b: 50, result: 80 },
        { place: 'ones', a: 4, b: 2, result: 6 },
      ],
      parts: [300, 80, 6],
      answer: 386,
    });
  });

  it('40 + 7: the ones line shows the zero ones of the first number', () => {
    expect(placeValueHelp('addition', 40, 7)).toMatchObject({ lines: [{ place: 'ones', a: 0, b: 7, result: 7 }], parts: [40, 7], answer: 47 });
  });

  it('305 + 1: a place of the first number that is 0 and has no line is not a part', () => {
    expect(placeValueHelp('addition', 305, 1)).toMatchObject({ lines: [{ place: 'ones', a: 5, b: 1, result: 6 }], parts: [300, 6], answer: 306 });
  });

  it('the parts always add up to the answer', () => {
    for (const [kind, a, b] of [['addition', 999, 1], ['addition', 7, 2], ['subtraction', 46, 40], ['subtraction', 987, 654]] as const) {
      const h = placeValueHelp(kind, a, b);
      if (h.form !== 'columns') throw new Error('expected columns');
      expect(h.parts.reduce((s, p) => s + p, 0)).toBe(h.answer);
    }
  });
});

describe('placeValueHelp, jump form for minus with borrowing (FR-154)', () => {
  it('42 − 17: first the tens, then the ones', () => {
    expect(placeValueHelp('subtraction', 42, 17)).toEqual({
      form: 'jumps',
      lines: [
        { place: 'tens', from: 42, by: 10, to: 32 },
        { place: 'ones', from: 32, by: 7, to: 25 },
      ],
    });
  });

  it('432 − 157: hundreds, tens, ones', () => {
    expect(placeValueHelp('subtraction', 432, 157)).toEqual({
      form: 'jumps',
      lines: [
        { place: 'hundreds', from: 432, by: 100, to: 332 },
        { place: 'tens', from: 332, by: 50, to: 282 },
        { place: 'ones', from: 282, by: 7, to: 275 },
      ],
    });
  });
});

describe('placeValuePath (FR-154)', () => {
  it('35 + 12: one ten, then the ones, with and without beginner assistance', () => {
    expect(placeValuePath('addition', 35, 12, true)).toEqual([35, 45, 47]);
    expect(placeValuePath('addition', 35, 12, false)).toEqual([35, 45, 47]);
  });

  it('35 + 32: one ten per jump with beginner assistance, one jump per place without', () => {
    expect(placeValuePath('addition', 35, 32, true)).toEqual([35, 45, 55, 65, 67]);
    expect(placeValuePath('addition', 35, 32, false)).toEqual([35, 65, 67]);
  });

  it('34 + 19: the ones jump stops at the ten it crosses with beginner assistance', () => {
    expect(placeValuePath('addition', 34, 19, true)).toEqual([34, 44, 50, 53]);
    expect(placeValuePath('addition', 34, 19, false)).toEqual([34, 44, 53]);
  });

  it('46 − 12 goes down', () => {
    expect(placeValuePath('subtraction', 46, 12, true)).toEqual([46, 36, 34]);
    expect(placeValuePath('subtraction', 46, 12, false)).toEqual([46, 36, 34]);
  });

  it('42 − 17 stops at 30 with beginner assistance', () => {
    expect(placeValuePath('subtraction', 42, 17, true)).toEqual([42, 32, 30, 25]);
    expect(placeValuePath('subtraction', 42, 17, false)).toEqual([42, 32, 25]);
  });

  it('jumps the hundreds first and skips places where the second number has a 0', () => {
    expect(placeValuePath('addition', 234, 205, false)).toEqual([234, 434, 439]);
    expect(placeValuePath('addition', 234, 205, true)).toEqual([234, 334, 434, 439]);
    expect(placeValuePath('subtraction', 432, 157, false)).toEqual([432, 332, 282, 275]);
  });
});

describe('stepPath for "Zwei Zahlen" (FR-154)', () => {
  type Moving = Pick<Challenge, 'kind' | 'operands' | 'answer' | 'steps' | 'twoNumbers'>;
  const two: Moving = { kind: 'addition', operands: [35, 32], answer: 67, steps: [35, 67], twoNumbers: true };
  const small: Moving = { kind: 'addition', operands: [35, 32], answer: 67, steps: [35, 67] };

  it('returns placeValuePath for a twoNumbers challenge', () => {
    expect(stepPath(two, true)).toEqual(placeValuePath('addition', 35, 32, true));
    expect(stepPath(two, false)).toEqual(placeValuePath('addition', 35, 32, false));
  });

  it('keeps the ten-stop path for other challenges', () => {
    expect(stepPath(small, true)).toEqual([35, 40, 50, 60, 67]);
    expect(stepPath(small, false)).toEqual([35, 67]);
  });
});
