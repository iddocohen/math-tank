import { describe, expect, it } from 'vitest';
import { clampStep, ladders, playableStep, stepUp, topStep, twoNumberLadders } from './ladders';
import { twoNumberAnswers, twoNumberRules } from '../math/twoNumbers';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../types';

type Arith = 'addition' | 'subtraction';

/** Default settings with "Zwei Zahlen" on for `kind`, the carry switch and ranges as given. */
function twoNumbers(kind: Arith, carry: boolean, extra: Partial<Settings[Arith]> = {}, base: Partial<Settings> = {}): Settings {
  const s = { ...defaultSettings(), ...base };
  return { ...s, [kind]: { ...s[kind], size: 'twoNumbers', carry, ...extra } } as Settings;
}

describe('"Zwei Zahlen" ladders (amendment 26, FR-153)', () => {
  it('has 4 steps per kind, as the "Kleine Schritte" ladders, so a stored index keeps its meaning', () => {
    for (const kind of ['addition', 'subtraction'] as const) {
      expect(twoNumberLadders[kind]).toHaveLength(4);
      expect(twoNumberLadders[kind]).toHaveLength(ladders[kind].length);
      expect(twoNumberLadders[kind].map((s) => [s.allowCarry, s.secondFraction])).toEqual([
        [false, 0.5],
        [false, 1],
        [true, 0.5],
        [true, 1],
      ]);
      for (const s of twoNumberLadders[kind]) expect(s).toMatchObject({ maxNumberFraction: 1, allowCrossTens: true });
    }
  });

  it('clampStep reads the "Zwei Zahlen" ladder with size twoNumbers and the "Kleine Schritte" ladder otherwise', () => {
    for (const kind of ['addition', 'subtraction'] as const) {
      const s = twoNumbers(kind, true);
      for (let i = 0; i < 4; i++) {
        const step = clampStep(kind, i, s);
        expect(step.allowCarry).toBe(twoNumberLadders[kind][i]?.allowCarry);
        expect(step.secondFraction).toBe(twoNumberLadders[kind][i]?.secondFraction);
        expect(step.maxOperand).toBeUndefined();
      }
      const steps = defaultSettings();
      expect(clampStep(kind, 0, steps).allowCarry).toBeUndefined();
      expect(clampStep(kind, 0, steps).secondFraction).toBeUndefined();
      expect(clampStep(kind, 0, steps).maxOperand).toBe(5);
    }
  });

  it('turns allowCarry off on every step when the parent forbids carrying or borrowing', () => {
    for (const kind of ['addition', 'subtraction'] as const) {
      const s = twoNumbers(kind, false);
      for (let i = 0; i < 4; i++) expect(clampStep(kind, i, s).allowCarry).toBe(false);
      // Steps 3 and 4 become the parent's settings, so a step up never goes back to the lower half of the range.
      expect(clampStep(kind, 2, s)).toEqual(clampStep(kind, 1, s));
      expect(clampStep(kind, 3, s)).toEqual(clampStep(kind, 1, s));
    }
  });

  it('narrows the second range by secondFraction', () => {
    const s = twoNumbers('addition', true, { second: { min: 10, max: 90 } });
    expect(twoNumberRules('addition', s, clampStep('addition', 0, s)).second).toEqual({ min: 10, max: 50 });
    expect(twoNumberRules('addition', s, clampStep('addition', 1, s)).second).toEqual({ min: 10, max: 90 });
    expect(twoNumberRules('addition', s, clampStep('addition', 2, s)).second).toEqual({ min: 10, max: 50 });
    expect(twoNumberRules('addition', s, clampStep('addition', 3, s)).second).toEqual({ min: 10, max: 90 });
  });

  it('sameStep compares allowCarry and secondFraction: every step differs with carrying on, steps 3 and 4 fold with it off', () => {
    const on = twoNumbers('addition', true);
    expect(topStep('addition', on)).toBe(3);
    expect(stepUp('addition', 0, on)).toBe(1);
    expect(stepUp('addition', 1, on)).toBe(2);
    expect(stepUp('addition', 2, on)).toBe(3);
    const off = twoNumbers('subtraction', false);
    // Step 3 = step 1 and step 4 = step 2 without borrowing, so the top the settings allow is step 2 (index 1).
    expect(topStep('subtraction', off)).toBe(1);
    expect(stepUp('subtraction', 0, off)).toBe(1);
    expect(stepUp('subtraction', 1, off)).toBe(1);
  });

  it('playableStep falls back to the nearest harder step that has an exercise (critique E2)', () => {
    // Every first number 90 to 99 carries in the tens column with any second number 10 to 99.
    const s = twoNumbers(
      'addition',
      true,
      { first: { min: 90, max: 99 }, second: { min: 10, max: 99 }, maxResult: 200 },
      { range: { preset: 'custom', min: 0, max: 200 } } as Partial<Settings>,
    );
    const empty = (i: number): boolean => twoNumberAnswers(twoNumberRules('addition', s, clampStep('addition', i, s)), s).length === 0;
    expect(empty(0)).toBe(true);
    expect(empty(1)).toBe(true);
    expect(empty(2)).toBe(false);
    expect(playableStep('addition', 0, s)).toEqual(clampStep('addition', 2, s));
    expect(playableStep('addition', 1, s)).toEqual(clampStep('addition', 2, s));
    expect(playableStep('addition', 3, s)).toEqual(clampStep('addition', 3, s));
  });

  it('playableStep keeps a step that has an exercise and leaves other ladders unchanged', () => {
    const s = twoNumbers('addition', true);
    for (let i = 0; i < 4; i++) expect(playableStep('addition', i, s)).toEqual(clampStep('addition', i, s));
    const steps = defaultSettings();
    expect(playableStep('addition', 0, steps)).toEqual(clampStep('addition', 0, steps));
    expect(playableStep('positions', 2, steps)).toEqual(clampStep('positions', 2, steps));
  });

  it('playableStep stops at the top step when no step has an exercise', () => {
    // Minus with first 10 to 19 and second 50 to 99: the first number is never larger.
    const s = twoNumbers('subtraction', true, { first: { min: 10, max: 19 }, second: { min: 50, max: 99 } });
    expect(playableStep('subtraction', 0, s)).toEqual(clampStep('subtraction', 3, s));
  });
});
