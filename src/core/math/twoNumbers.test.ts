import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import { borrows, carries, twoNumberFit } from './twoNumbers';

describe('carries and borrows (amendment 26, FR-150)', () => {
  it('finds a column that carries, with missing digits counted as 0', () => {
    expect(carries(35, 12)).toBe(false);
    expect(carries(22, 11)).toBe(false);
    expect(carries(34, 19)).toBe(true);
    expect(carries(47, 16)).toBe(true);
    expect(carries(234, 152)).toBe(false);
    expect(carries(234, 158)).toBe(true);
    expect(carries(45, 6)).toBe(true);
    expect(carries(45, 3)).toBe(false);
    expect(carries(950, 50)).toBe(true);
  });

  it('finds a column that borrows', () => {
    expect(borrows(46, 12)).toBe(false);
    expect(borrows(34, 11)).toBe(false);
    expect(borrows(42, 17)).toBe(true);
    expect(borrows(105, 7)).toBe(true);
    expect(borrows(105, 4)).toBe(false);
  });
});

describe('twoNumberFit (amendment 26, FR-151, FR-152)', () => {
  function two(kind: 'addition' | 'subtraction', patch: Partial<Settings['subtraction']> = {}): Settings {
    const s = defaultSettings();
    if (kind === 'addition') s.addition = { ...s.addition, size: 'twoNumbers', ...patch };
    else s.subtraction = { ...s.subtraction, size: 'twoNumbers', ...patch };
    return s;
  }

  it('all plus exercises without carrying fit 0 to 100; with carrying only sums up to 100 fit', () => {
    expect(twoNumberFit('addition', two('addition'))).toEqual({ any: true, all: true, extreme: 99 });
    expect(twoNumberFit('addition', two('addition', { carry: true }))).toEqual({ any: true, all: false, extreme: 100 });
  });

  it('no exercise fits when no first number lies on the battlefield', () => {
    const s = two('addition');
    s.range = { preset: 'custom', min: 550, max: 780 };
    s.addition.maxResult = 780;
    expect(twoNumberFit('addition', s)).toEqual({ any: false, all: false, extreme: null });
  });

  it('gives the smallest minus answer', () => {
    expect(twoNumberFit('subtraction', two('subtraction'))).toEqual({ any: true, all: true, extreme: 1 });
    const s = two('subtraction', { carry: true });
    s.range = { preset: 'custom', min: 50, max: 150 };
    expect(twoNumberFit('subtraction', s)).toEqual({ any: true, all: false, extreme: 50 });
  });

  it('checks 1 to 999 against 1 to 999 quickly', () => {
    const s = two('addition', { first: { min: 1, max: 999 }, second: { min: 1, max: 999 }, carry: true });
    s.range = { preset: '0-1000', min: 0, max: 1000 };
    s.addition.maxResult = 1000;
    const start = performance.now();
    expect(twoNumberFit('addition', s)).toMatchObject({ any: true, all: false, extreme: 1000 });
    expect(performance.now() - start).toBeLessThan(500);
  });
});
