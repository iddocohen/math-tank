import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { defaultSettings } from '../settings/defaults';
import type { Challenge, ChallengeKind, DifficultyStep, Settings } from '../types';
import { buildComparison, COMPARISON_KINDS, comparisonFits, comparisonSlots, fitsOptions, optionCount, type ComparisonKind } from './comparison';
import { COMPARISON_47_74 } from './fixtures';
import { generateChallenge } from './generate';
import { minTankGap } from './gaps';
import type { ChallengeDraft } from './numberLine';
import { validateChallenge } from './validate';

const SEEDS = 2_000;
const STEP: DifficultyStep = { maxNumberFraction: 1, allowCrossTens: true };

function onlyComparison(range: Settings['range'] = defaultSettings().range): Settings {
  return { ...defaultSettings(), range, challengeTypes: { numberLine: false, addition: false, subtraction: false, comparison: true } };
}

/** The options that answer the question, worked out from the options and the prompt alone. */
function correctOptions(d: ChallengeDraft): number[] {
  const options = d.options!;
  const p = d.prompt.params;
  switch (d.kind as ComparisonKind) {
    case 'greater':
    case 'largest3':
    case 'order3':
      return options.filter((o) => o === Math.max(...options));
    case 'smaller':
    case 'smallest3':
      return options.filter((o) => o === Math.min(...options));
    case 'equal':
      return options.filter((o) => o === p.n);
    case 'closestTo': {
      const best = Math.min(...options.map((o) => Math.abs(o - p.n!)));
      return options.filter((o) => Math.abs(o - p.n!) === best);
    }
    case 'between':
      return options.filter((o) => o > p.a! && o < p.b!);
  }
}

function checkDraft(d: ChallengeDraft, settings: Settings, player: number): void {
  const { min, max } = settings.range;
  const gap = minTankGap(min, max);
  const options = d.options!;
  expect(options).toHaveLength(optionCount(d.kind as ComparisonKind));
  expect(new Set(options).size).toBe(options.length);
  for (const o of options) {
    expect(Number.isInteger(o)).toBe(true);
    expect(o).toBeGreaterThanOrEqual(min);
    expect(o).toBeLessThanOrEqual(max);
    expect(Math.abs(o - player)).toBeGreaterThanOrEqual(gap);
  }
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) expect(Math.abs(options[i]! - options[j]!)).toBeGreaterThanOrEqual(gap);
  }
  expect(correctOptions(d)).toEqual([d.answer]);
  for (const v of Object.values(d.prompt.params)) {
    expect(v).toBeGreaterThanOrEqual(min);
    expect(v).toBeLessThanOrEqual(max);
  }
}

describe('comparison builders (FR-026, FR-027, US4 scenario 6, AC-06)', () => {
  for (const kind of COMPARISON_KINDS) {
    for (const [range, player] of [
      [{ preset: '0-100', min: 0, max: 100 }, 0],
      [{ preset: '0-100', min: 0, max: 100 }, 100],
      [{ preset: '0-20', min: 0, max: 20 }, 20],
      [{ preset: 'custom', min: 550, max: 780 }, 550],
    ] as const) {
      it(`${kind} in ${range.min} to ${range.max}, player at ${player}: one correct answer, distinct options at least minTankGap apart`, () => {
        const settings = onlyComparison({ ...range });
        const slots = comparisonSlots(settings, player);
        let built = 0;
        for (let seed = 0; seed < SEEDS; seed++) {
          const rng = createRng(seed);
          const d = buildComparison(kind, rng.pick(slots), settings, STEP, rng, player);
          if (!d) continue;
          built++;
          expect(d.kind).toBe(kind);
          checkDraft(d, settings, player);
        }
        expect(built).toBeGreaterThan(SEEDS / 4);
      });
    }
  }

  it('order3 asks for the ascending order and the enemy is the largest number', () => {
    const settings = onlyComparison();
    for (let seed = 0; seed < SEEDS; seed++) {
      const rng = createRng(seed);
      const d = buildComparison('order3', rng.int(15, 100), settings, STEP, rng, 0);
      if (!d) continue;
      expect(d.orderAnswer).toEqual([...d.options!].sort((a, b) => a - b));
      expect(d.answer).toBe(Math.max(...d.options!));
    }
  });

  it('only order3 has an order answer', () => {
    const settings = onlyComparison();
    for (const kind of COMPARISON_KINDS.filter((k) => k !== 'order3')) {
      const rng = createRng(3);
      const d = buildComparison(kind, 80, settings, STEP, rng, 0);
      expect(d?.orderAnswer).toBeUndefined();
    }
  });

  it('generateChallenge with only comparison on gives valid comparison challenges for every kind', () => {
    const settings = onlyComparison();
    const kinds = new Set<ChallengeKind>();
    for (let seed = 0; seed < SEEDS; seed++) {
      const player = seed % 2 === 0 ? 0 : 100;
      const c: Challenge = generateChallenge({ ...COMPARISON_47_74.input, settings, roundSeed: seed, playerPosition: player });
      expect(validateChallenge(c, settings, player)).toEqual([]);
      expect(COMPARISON_KINDS).toContain(c.kind);
      expect(c.mainSkill).toBe('comparison');
      checkDraft(c, settings, player);
      kinds.add(c.kind);
    }
    expect([...kinds].sort()).toEqual([...COMPARISON_KINDS].sort());
  });
});

describe('comparison is skipped when 2 options do not fit (edge case "Comparison options too close together")', () => {
  it('fitsOptions counts how many slots fit at the gap', () => {
    expect(fitsOptions([10, 20, 30], 2, 10)).toBe(true);
    expect(fitsOptions([10, 20, 30], 3, 10)).toBe(true);
    expect(fitsOptions([10, 20, 30], 3, 11)).toBe(false);
    expect(fitsOptions([10, 15, 19], 2, 10)).toBe(false);
  });

  it('every preset range fits 3 options from both ends', () => {
    for (const [min, max] of [
      [0, 10],
      [0, 20],
      [0, 50],
      [0, 100],
      [0, 1000],
      [550, 780],
      [3, 8],
    ] as const) {
      const settings = onlyComparison({ preset: 'custom', min, max });
      expect(comparisonFits('order3', settings, min)).toBe(true);
      expect(comparisonFits('greater', settings, max)).toBe(true);
    }
  });

  it('with a tank as wide as the ruler no 2 options fit, and the generator falls back to another kind', () => {
    // A layout whose ruler is one tank width long: minTankGap is the whole range.
    const narrow = { worldWidth: 1600, left: 0, right: 60 };
    const settings = onlyComparison();
    expect(comparisonFits('greater', settings, 0, narrow)).toBe(false);
    expect(comparisonFits('order3', settings, 0, narrow)).toBe(false);
    const rng = createRng(1);
    expect(buildComparison('greater', 80, settings, STEP, rng, 0, narrow)).toBeNull();
  });
});

describe('47 vs 74 fixture (US4 Independent Test, AC-06)', () => {
  it('the fixture seed produces "greater" with the options 47 and 74 and the answer 74', () => {
    const c = generateChallenge({ ...COMPARISON_47_74.input, settings: COMPARISON_47_74.settings });
    expect(c.kind).toBe('greater');
    expect([...c.options!].sort((a, b) => a - b)).toEqual([47, 74]);
    expect(c.answer).toBe(74);
  });
});
