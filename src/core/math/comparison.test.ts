import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { defaultSettings } from '../settings/defaults';
import type { Challenge, ChallengeKind, DifficultyStep, Settings } from '../types';
import { buildComparison, COMPARISON_KINDS, comparisonFits, optionCount, optionParams, type ComparisonKind } from './comparison';
import { COMPARISON_47_74 } from './fixtures';
import { generateChallenge } from './generate';
import { minEnemyGap, minOptionGap, minTankGap } from './gaps';
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
  const sorted = [...options].sort((a, b) => a - b);
  switch (d.kind as ComparisonKind) {
    case 'greater':
    case 'largest3':
      return options.filter((o) => o === Math.max(...options));
    case 'smaller':
    case 'smallest3':
      return options.filter((o) => o === Math.min(...options));
    case 'middle3':
      return [sorted[1]!];
    case 'closestTo': {
      const best = Math.min(...options.map((o) => Math.abs(o - p.n!)));
      return options.filter((o) => Math.abs(o - p.n!) === best);
    }
    case 'between':
      return options.filter((o) => o > p.a! && o < p.b!);
  }
}

function checkDraft(d: ChallengeDraft, settings: Settings, playerPosition?: number): void {
  const { min, max } = settings.range;
  const gap = minOptionGap(min, max);
  const options = d.options!;
  expect(options).toHaveLength(optionCount(d.kind as ComparisonKind));
  expect(new Set(options).size).toBe(options.length);
  for (const o of options) {
    expect(Number.isInteger(o)).toBe(true);
    expect(o).toBeGreaterThanOrEqual(min);
    expect(o).toBeLessThanOrEqual(max);
  }
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) expect(Math.abs(options[i]! - options[j]!)).toBeGreaterThanOrEqual(gap);
  }
  // Amendment 10: a tank stands at every option, so every option keeps the tank gap from the player.
  if (playerPosition !== undefined) for (const o of options) expect(Math.abs(o - playerPosition)).toBeGreaterThanOrEqual(minTankGap(min, max));
  expect(correctOptions(d)).toEqual([d.answer]);
  // The banner names the options in the order of `options` (amendment 09).
  expect(optionParams(d.prompt.params)).toEqual(options);
  expect((d as Partial<Challenge> & { orderAnswer?: unknown }).orderAnswer).toBeUndefined();
  for (const v of Object.values(d.prompt.params)) {
    expect(v).toBeGreaterThanOrEqual(min);
    expect(v).toBeLessThanOrEqual(max);
  }
}

describe('comparison kinds (amendment 09, FR-026)', () => {
  it('are greater, smaller, largest3, smallest3, closestTo, between and middle3; no equal, no order3', () => {
    expect([...COMPARISON_KINDS].sort()).toEqual(['between', 'closestTo', 'greater', 'largest3', 'middle3', 'smaller', 'smallest3']);
  });

  it('two options for greater, smaller and closestTo, three for the others', () => {
    expect(COMPARISON_KINDS.map((k) => [k, optionCount(k)])).toEqual([
      ['greater', 2],
      ['smaller', 2],
      ['largest3', 3],
      ['smallest3', 3],
      ['closestTo', 2],
      ['between', 3],
      ['middle3', 3],
    ]);
  });
});

describe('minOptionGap (amendments 09 and 10, FR-027)', () => {
  it('is the minimum tank gap, or 2 numbers or 2% of the range width when that is more', () => {
    expect(minOptionGap(0, 5)).toBe(2);
    expect(minOptionGap(0, 100)).toBe(8);
    expect(minOptionGap(550, 780)).toBeCloseTo(18.4, 9);
    expect(minOptionGap(0, 1000)).toBe(80);
    for (const [min, max] of [[0, 10], [0, 20], [0, 50], [0, 100], [0, 1000], [550, 780]] as const) {
      expect(minOptionGap(min, max)).toBeGreaterThanOrEqual(minTankGap(min, max));
    }
  });
});

describe('comparison builders (FR-026, FR-027, US4 scenario 6, AC-06)', () => {
  for (const kind of COMPARISON_KINDS) {
    for (const range of [
      { preset: '0-100', min: 0, max: 100 },
      { preset: '0-20', min: 0, max: 20 },
      { preset: 'custom', min: 0, max: 5 },
      { preset: 'custom', min: 550, max: 780 },
      { preset: '0-1000', min: 0, max: 1000 },
    ] as const) {
      it(`${kind} in ${range.min} to ${range.max}: distinct options at least minOptionGap apart and minTankGap from the player, exactly one correct, named in the prompt`, () => {
        const settings = onlyComparison({ ...range });
        let built = 0;
        for (let seed = 0; seed < SEEDS; seed++) {
          const rng = createRng(seed);
          const player = seed % 2 === 0 ? range.min : range.max;
          const d = buildComparison(kind, rng.int(range.min, range.max), settings, STEP, rng, player);
          if (!d) continue;
          built++;
          expect(d.kind).toBe(kind);
          checkDraft(d, settings, player);
        }
        // In 0 to 5 three options fit only at a few answers, so fewer drafts are built there.
        expect(built).toBeGreaterThan(range.max - range.min >= 10 ? SEEDS / 5 : 0);
      });
    }
  }

  it('middle3 has its answer between the two other options', () => {
    const settings = onlyComparison();
    for (let seed = 0; seed < SEEDS; seed++) {
      const rng = createRng(seed);
      const d = buildComparison('middle3', rng.int(0, 100), settings, STEP, rng);
      if (!d) continue;
      const others = d.options!.filter((o) => o !== d.answer);
      expect(Math.min(...others)).toBeLessThan(d.answer);
      expect(Math.max(...others)).toBeGreaterThan(d.answer);
    }
  });

  it('the banner order of the options is not always ascending', () => {
    const settings = onlyComparison();
    let unsorted = 0;
    for (let seed = 0; seed < 200; seed++) {
      const rng = createRng(seed);
      const d = buildComparison('largest3', rng.int(40, 100), settings, STEP, rng);
      if (d && d.options!.some((o, i) => i > 0 && o < d.options![i - 1]!)) unsorted++;
    }
    expect(unsorted).toBeGreaterThan(50);
  });

  it('an easy ladder step narrows the option spread around the answer (amendment 09 item 7)', () => {
    const settings = onlyComparison();
    const easy: DifficultyStep = { maxNumberFraction: 0.2, allowCrossTens: true };
    for (const kind of COMPARISON_KINDS) {
      for (let seed = 0; seed < 500; seed++) {
        const rng = createRng(seed);
        const d = buildComparison(kind, rng.int(0, 100), settings, easy, rng);
        if (!d) continue;
        for (const o of d.options!) expect(Math.abs(o - d.answer)).toBeLessThanOrEqual(20);
      }
    }
  });

  it('generateChallenge with only comparison on gives valid comparison challenges for every kind, the enemy away from the player', () => {
    const settings = onlyComparison();
    const kinds = new Set<ChallengeKind>();
    for (let seed = 0; seed < SEEDS; seed++) {
      const player = seed % 2 === 0 ? 0 : 100;
      const c: Challenge = generateChallenge({ ...COMPARISON_47_74.input, settings, roundSeed: seed, playerPosition: player });
      expect(validateChallenge(c, settings, player)).toEqual([]);
      expect(COMPARISON_KINDS).toContain(c.kind);
      expect(c.mainSkill).toBe('comparison');
      expect(Math.abs(c.answer - player)).toBeGreaterThanOrEqual(minEnemyGap(0, 100));
      checkDraft(c, settings, player);
      kinds.add(c.kind);
    }
    expect([...kinds].sort()).toEqual([...COMPARISON_KINDS].sort());
  });
});

describe('comparison fits (edge case "Comparison options too close together", amendment 10)', () => {
  it('every preset range and a range of width 5 fit 3 options with the player at either end', () => {
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
      for (const kind of COMPARISON_KINDS) {
        expect(comparisonFits(kind, settings, min)).toBe(true);
        expect(comparisonFits(kind, settings, max)).toBe(true);
      }
    }
  });

  it('counts only the numbers clear of the player tank: in 0 to 4 with the player at 2, 2 options fit, 3 do not', () => {
    // 0 to 4 is narrower than any valid range; it shows that the player's number is never an option.
    const settings = onlyComparison({ preset: 'custom', min: 0, max: 4 });
    expect(comparisonFits('greater', settings, 2)).toBe(true);
    expect(comparisonFits('largest3', settings, 2)).toBe(false);
    expect(comparisonFits('largest3', settings, 0)).toBe(false);
    expect(comparisonFits('largest3', settings, undefined)).toBe(true);
  });

  it('a builder returns null when the options cannot keep the tank gap from the player', () => {
    const settings = onlyComparison({ preset: 'custom', min: 0, max: 4 });
    for (let seed = 0; seed < 200; seed++) expect(buildComparison('largest3', 4, settings, STEP, createRng(seed), 2)).toBeNull();
  });
});

describe('47 oder 74 fixture (US4 Independent Test, AC-06)', () => {
  it('the fixture seed produces "greater" with the options 47 and 74 in that order and the answer 74', () => {
    const c = generateChallenge({ ...COMPARISON_47_74.input, settings: COMPARISON_47_74.settings });
    expect(c.kind).toBe('greater');
    expect(c.options).toEqual([47, 74]);
    expect(c.answer).toBe(74);
    expect(COMPARISON_47_74.settings.adaptive).toBe(false);
  });
});
