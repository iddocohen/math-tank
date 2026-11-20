import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import type { DifficultyStep } from '../types';
import { borrows, carries, twoNumberAnswers, twoNumberFit, twoNumberPairErrors, twoNumberPairs, twoNumberRules, type TwoNumberRules } from './twoNumbers';

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

type Kind = 'addition' | 'subtraction';
type Own = Partial<Settings['addition']>;

/** Default settings with `kind` in "Zwei Zahlen" and the given fields; the battlefield and maxResult optional. */
function twoSettings(kind: Kind, own: Own, field?: { min: number; max: number; maxResult?: number }): Settings {
  const s = defaultSettings();
  if (kind === 'addition') s.addition = { ...s.addition, size: 'twoNumbers', ...own };
  else s.subtraction = { ...s.subtraction, size: 'twoNumbers', ...own };
  if (field) {
    s.range = { preset: 'custom', min: field.min, max: field.max };
    s.addition.maxResult = field.maxResult ?? field.max;
  }
  return s;
}

/** Every answer with at least one pair, by checking each pair of the ranges directly. */
function bruteAnswers(rules: TwoNumberRules, s: Settings): number[] {
  const out = new Set<number>();
  for (let a = rules.first.min; a <= rules.first.max; a++) {
    for (let b = rules.second.min; b <= rules.second.max; b++) {
      if (twoNumberPairErrors(a, b, rules, s).length === 0) out.add(rules.kind === 'addition' ? a + b : a - b);
    }
  }
  return [...out].sort((x, y) => x - y);
}

const CASES: Array<{ name: string; kind: Kind; own: Own; field?: { min: number; max: number; maxResult?: number } }> = [
  { name: 'plus 10 to 99 without carrying', kind: 'addition', own: {} },
  { name: 'plus 10 to 99 with carrying', kind: 'addition', own: { carry: true }, field: { min: 0, max: 200 } },
  { name: 'plus 10 to 99 and 1 to 9 with carrying', kind: 'addition', own: { carry: true, second: { min: 1, max: 9 } } },
  { name: 'plus 10 to 99 and 1 to 9 without carrying', kind: 'addition', own: { second: { min: 1, max: 9 } } },
  { name: 'plus three-digit without carrying', kind: 'addition', own: { first: { min: 100, max: 999 }, second: { min: 100, max: 499 } }, field: { min: 0, max: 1000 } },
  { name: 'plus three-digit with carrying and maxResult', kind: 'addition', own: { carry: true, first: { min: 100, max: 999 }, second: { min: 100, max: 499 } }, field: { min: 0, max: 1000, maxResult: 800 } },
  { name: 'minus 10 to 99 without borrowing', kind: 'subtraction', own: {} },
  { name: 'minus 10 to 99 with borrowing', kind: 'subtraction', own: { carry: true } },
  { name: 'minus 10 to 99 and 1 to 9 with borrowing', kind: 'subtraction', own: { carry: true, second: { min: 1, max: 9 } } },
  { name: 'minus three-digit without borrowing', kind: 'subtraction', own: { first: { min: 100, max: 999 }, second: { min: 10, max: 499 } }, field: { min: 0, max: 1000 } },
  { name: 'minus three-digit with borrowing on 550 to 780', kind: 'subtraction', own: { carry: true, first: { min: 100, max: 999 }, second: { min: 10, max: 300 } }, field: { min: 550, max: 780 } },
];

describe('twoNumberRules, twoNumberPairs and twoNumberAnswers (amendment 26, FR-149, FR-150)', () => {
  for (const { name, kind, own, field } of CASES) {
    it(`${name}: 500 seeds follow every rule`, () => {
      const s = twoSettings(kind, own, field);
      const rules = twoNumberRules(kind, s);
      const answers = twoNumberAnswers(rules, s);
      expect(answers.length).toBeGreaterThan(0);
      const { min, max } = s.range;
      const highest = kind === 'addition' ? Math.min(s.addition.maxResult, max) : max;
      const lowest = Math.max(min, 0);
      let carried = 0;
      for (let seed = 0; seed < 500; seed++) {
        const rng = createRng(seed);
        const answer = rng.pick(answers);
        const pairs = twoNumberPairs(answer, rules, s);
        expect(pairs.length, `answer ${answer}`).toBeGreaterThan(0);
        const [a, b] = rng.pick(pairs);
        const label = `${a} ${kind === 'addition' ? '+' : '-'} ${b}`;
        expect(kind === 'addition' ? a + b : a - b, label).toBe(answer);
        expect(a >= s[kind].first.min && a <= s[kind].first.max, label).toBe(true);
        expect(b >= s[kind].second.min && b <= s[kind].second.max, label).toBe(true);
        expect(a >= min && a <= max, label).toBe(true);
        expect(answer >= lowest && answer <= highest, label).toBe(true);
        if (kind === 'subtraction') expect(a > b, label).toBe(true);
        const crosses = kind === 'addition' ? carries(a, b) : borrows(a, b);
        if (!s[kind].carry) expect(crosses, label).toBe(false);
        if (crosses) carried++;
      }
      if (s[kind].carry) expect(carried).toBeGreaterThan(0);
    });

    it(`${name}: the answer list equals the brute-force set`, () => {
      const s = twoSettings(kind, own, field);
      const rules = twoNumberRules(kind, s);
      expect(twoNumberAnswers(rules, s)).toEqual(bruteAnswers(rules, s));
    });
  }

  it('gives 45 + 6 and 52 + 9 with carrying and 45 + 3 but not 45 + 6 without', () => {
    const on = twoSettings('addition', { carry: true, second: { min: 1, max: 9 } });
    expect(twoNumberPairs(51, twoNumberRules('addition', on), on)).toContainEqual([45, 6]);
    expect(twoNumberPairs(61, twoNumberRules('addition', on), on)).toContainEqual([52, 9]);
    const off = twoSettings('addition', { second: { min: 1, max: 9 } });
    expect(twoNumberPairs(48, twoNumberRules('addition', off), off)).toContainEqual([45, 3]);
    expect(twoNumberPairs(51, twoNumberRules('addition', off), off)).not.toContainEqual([45, 6]);
  });

  it('names the broken rule of a pair', () => {
    const s = twoSettings('subtraction', {});
    const rules = twoNumberRules('subtraction', s);
    expect(twoNumberPairErrors(46, 12, rules, s)).toEqual([]);
    expect(twoNumberPairErrors(42, 17, rules, s).join()).toMatch(/borrow/);
    expect(twoNumberPairErrors(23, 23, rules, s).join()).toMatch(/larger/);
    expect(twoNumberPairErrors(46, 5, rules, s).join()).toMatch(/second/);
  });

  it('narrows the second range by the step and turns carrying off when the step says so', () => {
    const s = twoSettings('addition', { carry: true, second: { min: 10, max: 99 } });
    const step: DifficultyStep = { maxNumberFraction: 1, allowCrossTens: true, allowCarry: false, secondFraction: 0.5 };
    const rules = twoNumberRules('addition', s, step);
    expect(rules.second).toEqual({ min: 10, max: 54 });
    expect(rules.carry).toBe(false);
    expect(twoNumberRules('addition', s).carry).toBe(true);
    expect(twoNumberRules('addition', s, { ...step, secondFraction: 0 }).second).toEqual({ min: 10, max: 10 });
    // The parent's switch is the ceiling.
    const off = twoSettings('addition', {});
    expect(twoNumberRules('addition', off, { ...step, allowCarry: true }).carry).toBe(false);
  });

  it('lists the answers of 1 to 999 against 1 to 999 in under about 50 ms', () => {
    const s = twoSettings('addition', { carry: true, first: { min: 1, max: 999 }, second: { min: 1, max: 999 } }, { min: 0, max: 1000 });
    const rules = twoNumberRules('addition', s);
    const start = performance.now();
    const answers = twoNumberAnswers(rules, s);
    expect(performance.now() - start).toBeLessThan(50);
    expect(answers[0]).toBe(2);
    expect(answers[answers.length - 1]).toBe(1000);
    const minus = twoSettings('subtraction', { carry: true, first: { min: 1, max: 999 }, second: { min: 1, max: 999 } }, { min: 0, max: 1000 });
    const minusStart = performance.now();
    twoNumberAnswers(twoNumberRules('subtraction', minus), minus);
    expect(performance.now() - minusStart).toBeLessThan(50);
  });

  it('twoNumberFit agrees with the answer list', () => {
    for (const { kind, own, field } of CASES) {
      const s = twoSettings(kind, own, field);
      const answers = twoNumberAnswers(twoNumberRules(kind, s), s);
      const fit = twoNumberFit(kind, s);
      expect(fit.any).toBe(answers.length > 0);
      expect(fit.extreme).toBe(answers.length === 0 ? null : kind === 'addition' ? answers[answers.length - 1] : answers[0]);
    }
  });
});
