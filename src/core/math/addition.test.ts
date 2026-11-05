import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { defaultSettings } from '../settings/defaults';
import type { DifficultyStep, Settings } from '../types';
import { additionAnswers, buildAddition } from './addition';
import { crossesHundred, crossesTen } from './crossing';
import type { ChallengeDraft } from './numberLine';

const SEEDS = 10_000;
const FULL_STEP: DifficultyStep = { maxNumberFraction: 1, allowCrossTens: true };

function settingsWith(patch: Partial<Settings>, addition: Partial<Settings['addition']> = {}): Settings {
  const base = defaultSettings();
  return { ...base, ...patch, addition: { ...base.addition, ...addition } };
}

/** One addition per seed: a random allowed answer, then the builder; seeds without an exercise are left out. */
function draws(settings: Settings, step: DifficultyStep = FULL_STEP): ChallengeDraft[] {
  const out: ChallengeDraft[] = [];
  const answers = additionAnswers(settings, step);
  for (let seed = 0; seed < SEEDS; seed++) {
    const rng = createRng(seed);
    if (answers.length === 0) break;
    const draft = buildAddition(rng.pick(answers), settings, step, rng);
    if (draft) out.push(draft);
  }
  return out;
}

const text = (d: ChallengeDraft) => d.operands.join(' + ');

describe('buildAddition (FR-022, FR-025, US3 scenarios 3 and 5)', () => {
  it('builds a + b whose sum is the answer, with the steps from start to result', () => {
    const all = draws(settingsWith({}));
    expect(all.length).toBeGreaterThan(SEEDS * 0.9);
    for (const d of all) {
      expect(d.kind).toBe('addition');
      expect(d.operands).toHaveLength(2);
      expect(d.operands[0]! + d.operands[1]!).toBe(d.answer);
      expect(d.steps).toEqual([d.operands[0], d.answer]);
      expect(d.prompt).toEqual({ key: 'addition', params: { a: d.operands[0], b: d.operands[1] } });
    }
  });

  for (const range of [
    { preset: '0-20' as const, min: 0, max: 20 },
    { preset: '0-100' as const, min: 0, max: 100 },
  ]) {
    it(`with maximum operand 10 and maximum result 20 in ${range.min} to ${range.max}, no added number is above 10 and no result above 20`, () => {
      const all = draws(settingsWith({ range }, { maxOperand: 10, maxResult: 20 }));
      expect(all.length).toBeGreaterThan(0);
      for (const d of all) {
        // T216: the limit applies to the added numbers only; the start can be any number in the range.
        for (const n of d.operands.slice(1)) expect(n, text(d)).toBeLessThanOrEqual(10);
        expect(d.answer, text(d)).toBeLessThanOrEqual(20);
        expect(d.operands[0]!).toBeGreaterThanOrEqual(range.min);
        expect(d.operands[1]!).toBeGreaterThanOrEqual(1);
      }
    });
  }

  it('with crossing tens off, no exercise crosses a ten: 24 + 8 never appears, 24 + 5 can', () => {
    const all = draws(settingsWith({ crossTens: false }, { maxOperand: 30 }));
    const seen = new Set(all.map(text));
    for (const d of all) expect(crossesTen(d.operands[0]!, d.answer), text(d)).toBe(false);
    expect(seen.has('24 + 8')).toBe(false);
    expect(seen.has('24 + 5')).toBe(true);
    // With crossing on, 24 + 8 can come.
    const crossing = new Set(draws(settingsWith({ crossTens: true }, { maxOperand: 30 })).map(text));
    expect(crossing.has('24 + 8')).toBe(true);
  });

  it('a difficulty step without crossing tens also keeps every exercise inside its ten', () => {
    const all = draws(settingsWith({ crossTens: true }, { maxOperand: 30 }), { maxNumberFraction: 1, allowCrossTens: false });
    for (const d of all) expect(crossesTen(d.operands[0]!, d.answer), text(d)).toBe(false);
  });

  it('with crossing hundreds off, no exercise crosses a hundred', () => {
    const range = { preset: '0-1000' as const, min: 0, max: 1000 };
    const all = draws(settingsWith({ range, crossHundreds: false }, { maxOperand: 1000, maxResult: 1000 }));
    expect(all.length).toBeGreaterThan(0);
    for (const d of all) {
      for (let i = 1; i < d.steps!.length; i++) expect(crossesHundred(d.steps![i - 1]!, d.steps![i]!), text(d)).toBe(false);
    }
  });

  it('steps 2 builds a + b + c with every intermediate sum in range', () => {
    const settings = settingsWith({ range: { preset: '0-50', min: 0, max: 50 } }, { maxOperand: 20, maxResult: 40, steps: 2 });
    const all = draws(settings);
    expect(all.length).toBeGreaterThan(SEEDS * 0.5);
    for (const d of all) {
      const [a, b, c] = d.operands as [number, number, number];
      expect(d.operands).toHaveLength(3);
      expect(a + b + c).toBe(d.answer);
      expect(d.steps).toEqual([a, a + b, a + b + c]);
      for (const n of d.steps!) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(40);
      }
      for (const n of d.operands.slice(1)) expect(n).toBeLessThanOrEqual(20);
      expect(d.prompt).toEqual({ key: 'addition', params: { a, b, c } });
    }
  });

  it('with range 550 to 780 every start, intermediate sum and result stays in range and every addend is valid', () => {
    const range = { preset: 'custom' as const, min: 550, max: 780 };
    for (const steps of [1, 2] as const) {
      const settings = settingsWith({ range }, { maxOperand: 780, maxResult: 780, steps });
      const all = draws(settings);
      expect(all.length).toBeGreaterThan(0);
      for (const d of all) {
        for (const n of d.steps!) {
          expect(n, text(d)).toBeGreaterThanOrEqual(550);
          expect(n, text(d)).toBeLessThanOrEqual(780);
        }
        for (const n of d.operands.slice(1)) {
          expect(Number.isInteger(n) && n >= 1 && n <= 780, text(d)).toBe(true);
        }
      }
    }
  });

  it('the start may be above the maximum operand: 0 to 100 with maximum operand 10 builds 50 from a start of 40 to 49 (T216)', () => {
    const settings = settingsWith({}, { maxOperand: 10, maxResult: 100 });
    expect(additionAnswers(settings, FULL_STEP)).toContain(50);
    const d = buildAddition(50, settings, FULL_STEP, createRng(1));
    expect(d).not.toBeNull();
    expect(d!.operands[0]).toBeGreaterThanOrEqual(40);
    expect(d!.operands[1]).toBeLessThanOrEqual(10);
  });

  it('with range 550 to 780 and maximum operand 10, additions such as 560 + 5 come and every answer finds one (T216, FR-022)', () => {
    const range = { preset: 'custom' as const, min: 550, max: 780 };
    for (const steps of [1, 2] as const) {
      const settings = settingsWith({ range }, { maxOperand: 10, maxResult: 780, steps });
      const answers = additionAnswers(settings, FULL_STEP);
      expect(answers.length).toBeGreaterThan(200);
      for (const answer of answers) {
        const d = buildAddition(answer, settings, FULL_STEP, createRng(answer));
        expect(d, `no addition for ${answer}`).not.toBeNull();
        for (const n of d!.steps!) {
          expect(n, text(d!)).toBeGreaterThanOrEqual(550);
          expect(n, text(d!)).toBeLessThanOrEqual(780);
        }
        for (const n of d!.operands.slice(1)) {
          expect(n, text(d!)).toBeGreaterThanOrEqual(1);
          expect(n, text(d!)).toBeLessThanOrEqual(10);
        }
      }
    }
    const seen = new Set(draws(settingsWith({ range }, { maxOperand: 10, maxResult: 780 })).map(text));
    expect(seen.has('560 + 5')).toBe(true);
  });

  it('returns null when no addition reaches the answer under the limits', () => {
    const settings = settingsWith({}, { maxOperand: 10, maxResult: 100 });
    expect(buildAddition(0, settings, FULL_STEP, createRng(1))).toBeNull();
    expect(additionAnswers(settings, FULL_STEP)).not.toContain(0);
    const capped = settingsWith({}, { maxOperand: 10, maxResult: 30 });
    expect(buildAddition(31, capped, FULL_STEP, createRng(1))).toBeNull();
  });
});
