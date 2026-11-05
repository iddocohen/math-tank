import { describe, expect, it } from 'vitest';
import { createRng, deriveSeed } from '../rng';
import { defaultSettings } from '../settings/defaults';
import type { DifficultyStep, Settings } from '../types';
import { crossesHundred, crossesTen } from './crossing';
import { SUBTRACTION_43_MINUS_7 } from './fixtures';
import { generateChallenge } from './generate';
import type { ChallengeDraft } from './numberLine';
import { buildSubtraction, subtractionAnswers } from './subtraction';
import { validateChallenge } from './validate';

const SEEDS = 10_000;
const FULL_STEP: DifficultyStep = { maxNumberFraction: 1, allowCrossTens: true };

function settingsWith(patch: Partial<Settings>, subtraction: Partial<Settings['subtraction']> = {}): Settings {
  const base = defaultSettings();
  return { ...base, ...patch, subtraction: { ...base.subtraction, ...subtraction } };
}

/** One subtraction per seed: a random allowed answer, then the builder; seeds without an exercise are left out. */
function draws(settings: Settings, step: DifficultyStep = FULL_STEP): ChallengeDraft[] {
  const out: ChallengeDraft[] = [];
  const answers = subtractionAnswers(settings, step);
  if (answers.length === 0) return out;
  for (let seed = 0; seed < SEEDS; seed++) {
    const rng = createRng(seed);
    const draft = buildSubtraction(rng.pick(answers), settings, step, rng);
    if (draft) out.push(draft);
  }
  return out;
}

const text = (d: ChallengeDraft) => d.operands.join(' − ');

describe('buildSubtraction (FR-023, FR-025, US3 scenario 4)', () => {
  it('builds a − b whose difference is the answer, with no subtrahend above the maximum operand', () => {
    const all = draws(settingsWith({}, { maxOperand: 7 }));
    expect(all.length).toBeGreaterThan(SEEDS * 0.9);
    for (const d of all) {
      const [a, b] = d.operands as [number, number];
      expect(d.kind).toBe('subtraction');
      expect(a - b).toBe(d.answer);
      expect(b, text(d)).toBeGreaterThanOrEqual(1);
      expect(b, text(d)).toBeLessThanOrEqual(7);
      expect(a, text(d)).toBeLessThanOrEqual(100);
      expect(d.steps).toEqual([a, d.answer]);
      expect(d.prompt).toEqual({ key: 'subtraction', params: { a, b } });
    }
  });

  it('with negative results off, no result is below 0 or below range.min', () => {
    for (const range of [
      { preset: 'custom' as const, min: -20, max: 30 },
      { preset: 'custom' as const, min: 15, max: 45 },
    ]) {
      for (const steps of [1, 2] as const) {
        const all = draws(settingsWith({ range, negativeResults: false }, { maxOperand: 20, steps }));
        expect(all.length).toBeGreaterThan(0);
        for (const d of all) {
          for (const n of d.steps!.slice(1)) {
            expect(n, text(d)).toBeGreaterThanOrEqual(0);
            expect(n, text(d)).toBeGreaterThanOrEqual(range.min);
          }
        }
      }
    }
  });

  it('with range -20 to 30 and negative results on, results may be negative but never below range.min', () => {
    const range = { preset: 'custom' as const, min: -20, max: 30 };
    const all = draws(settingsWith({ range, negativeResults: true }, { maxOperand: 20 }));
    expect(all.some((d) => d.answer < 0)).toBe(true);
    for (const d of all) for (const n of d.steps!) expect(n, text(d)).toBeGreaterThanOrEqual(-20);
  });

  it('with crossing tens off, no step crosses a ten; with crossing hundreds off, none crosses a hundred', () => {
    for (const steps of [1, 2] as const) {
      const noTens = draws(settingsWith({ crossTens: false }, { maxOperand: 30, steps }));
      expect(noTens.length).toBeGreaterThan(0);
      for (const d of noTens) {
        for (let i = 1; i < d.steps!.length; i++) expect(crossesTen(d.steps![i - 1]!, d.steps![i]!), text(d)).toBe(false);
      }
      const range = { preset: '0-1000' as const, min: 0, max: 1000 };
      const noHundreds = draws(settingsWith({ range, crossHundreds: false }, { maxOperand: 1000, steps }));
      expect(noHundreds.length).toBeGreaterThan(0);
      for (const d of noHundreds) {
        for (let i = 1; i < d.steps!.length; i++) expect(crossesHundred(d.steps![i - 1]!, d.steps![i]!), text(d)).toBe(false);
      }
    }
    // 43 − 7 crosses 40, so it comes only with crossing tens on.
    expect(new Set(draws(settingsWith({ crossTens: false }, { maxOperand: 10 })).map(text)).has('43 − 7')).toBe(false);
    expect(new Set(draws(settingsWith({ crossTens: true }, { maxOperand: 10 })).map(text)).has('43 − 7')).toBe(true);
  });

  it('steps 2 builds a − b − c with every intermediate result in range', () => {
    const all = draws(settingsWith({ range: { preset: '0-50', min: 0, max: 50 } }, { maxOperand: 10, steps: 2 }));
    expect(all.length).toBeGreaterThan(SEEDS * 0.5);
    for (const d of all) {
      const [a, b, c] = d.operands as [number, number, number];
      expect(d.operands).toHaveLength(3);
      expect(a - b - c).toBe(d.answer);
      expect(d.steps).toEqual([a, a - b, a - b - c]);
      for (const n of d.steps!) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(50);
      }
      expect(Math.max(b, c)).toBeLessThanOrEqual(10);
      expect(d.prompt).toEqual({ key: 'subtraction', params: { a, b, c } });
    }
  });

  it('returns null when no subtraction reaches the answer inside the range', () => {
    expect(buildSubtraction(100, settingsWith({}), FULL_STEP, createRng(1))).toBeNull();
    expect(subtractionAnswers(settingsWith({}), FULL_STEP)).not.toContain(100);
  });
});

describe('subtraction fixture (AC-05)', () => {
  it('the fixture seed produces 43 − 7 as the first search of a guided round', () => {
    const { settings, input } = SUBTRACTION_43_MINUS_7;
    const c = generateChallenge({ ...input, settings });
    expect(c.kind).toBe('subtraction');
    expect(c.operands).toEqual([43, 7]);
    expect(c.answer).toBe(36);
    expect(c.prompt).toEqual({ key: 'subtraction', params: { a: 43, b: 7 } });
    expect(validateChallenge(c, settings, input.playerPosition)).toEqual([]);
  });

  it('the fixture input follows from its URL seed as in the first guided round', () => {
    const { seed, input } = SUBTRACTION_43_MINUS_7;
    expect(input.roundSeed).toBe(deriveSeed(seed, 1));
    expect(input.turn).toBe(0);
    const side = createRng(deriveSeed(seed, 0)).next() < 0.5 ? 'left' : 'right';
    expect(input.playerPosition).toBe(side === 'left' ? 0 : 100);
  });

  it('only subtraction is on in the fixture settings', () => {
    expect(SUBTRACTION_43_MINUS_7.settings.challengeTypes).toEqual({ numberLine: false, addition: false, subtraction: true, comparison: false });
  });
});
