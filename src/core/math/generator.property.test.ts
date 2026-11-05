import { describe, expect, it } from 'vitest';
import { createRng, type Rng } from '../rng';
import {
  CUSTOM_MIN_LIMIT,
  CUSTOM_MIN_UPPER_LIMIT,
  defaultSettings,
  RANGE_PRESETS,
  RANGE_SPAN_MAX,
  RANGE_SPAN_MIN,
} from '../settings/defaults';
import { validateSettings, withRange } from '../settings/validate';
import type { Settings, Skill } from '../types';
import { generateChallenge } from './generate';
import { validateChallenge } from './validate';
import { minEnemyGap, minTankGap } from './gaps';
import { clampStep, ladders } from '../progress/ladders';
import { crossesMultiple, mainSkillOf } from './skills';

const SEEDS = 10_000;
const ZERO_STEPS: Record<Skill, number> = {
  positions: 0,
  countForward: 0,
  countBackward: 0,
  tens: 0,
  crossTens: 0,
  addition: 0,
  subtraction: 0,
  comparison: 0,
};

function presetSettings(preset: keyof typeof RANGE_PRESETS, patch: Partial<Settings> = {}): Settings {
  const s = defaultSettings();
  const { min, max } = RANGE_PRESETS[preset];
  return {
    ...s,
    range: { preset, min, max },
    addition: { ...s.addition, maxResult: max },
    subtraction: { ...s.subtraction, maxOperand: Math.min(s.subtraction.maxOperand, max - min) },
    ...patch,
  };
}

const numberLineOnly = { numberLine: true, addition: false, subtraction: false, comparison: false };

describe('generateChallenge property (FR-029, SC-003, AC-04)', () => {
  for (const preset of Object.keys(RANGE_PRESETS) as Array<keyof typeof RANGE_PRESETS>) {
    for (const side of ['left', 'right'] as const) {
      it(`range ${preset}, player ${side}: ${SEEDS} challenges all validate`, () => {
        const settings = presetSettings(preset);
        const playerPosition = side === 'left' ? settings.range.min : settings.range.max;
        const problems: string[] = [];
        for (let seed = 0; seed < SEEDS; seed++) {
          for (const rulerLevel of [1, 4] as const) {
            const c = generateChallenge({ settings, skillSteps: ZERO_STEPS, roundSeed: seed, turn: 1, playerPosition, rulerLevel });
            const errors = validateChallenge(c, settings, playerPosition);
            if (errors.length > 0 && problems.length < 5) problems.push(`${seed} ${c.kind}: ${errors.join('; ')}`);
          }
        }
        expect(problems).toEqual([]);
      });
    }

    it(`range ${preset} with every type off except number line never throws and always validates`, () => {
      const settings = presetSettings(preset, { challengeTypes: numberLineOnly, crossTens: false });
      for (let seed = 0; seed < 2_000; seed++) {
        for (const playerPosition of [settings.range.min, settings.range.max]) {
          const c = generateChallenge({ settings, skillSteps: ZERO_STEPS, roundSeed: seed, turn: 3, playerPosition, rulerLevel: 1 });
          expect(validateChallenge(c, settings, playerPosition)).toEqual([]);
        }
      }
    });
  }

  it('range 0 to 10 with crossing tens off falls back to findNumber when only midpoint is allowed', () => {
    const settings = presetSettings('0-10', { crossTens: false, challengeTypes: numberLineOnly });
    for (let seed = 0; seed < 1_000; seed++) {
      for (const playerPosition of [0, 10]) {
        const c = generateChallenge({
          settings,
          skillSteps: ZERO_STEPS,
          roundSeed: seed,
          turn: 1,
          playerPosition,
          rulerLevel: 1,
          kindsAllowed: ['midpoint'],
        });
        expect(c.kind).toBe('findNumber');
        expect(validateChallenge(c, settings, playerPosition)).toEqual([]);
      }
    }
  });

  it('range 0 to 10 with crossing tens off still returns valid challenges of several kinds', () => {
    const settings = presetSettings('0-10', { crossTens: false, challengeTypes: numberLineOnly });
    const kinds = new Set<string>();
    for (let seed = 0; seed < 1_000; seed++) {
      const c = generateChallenge({ settings, skillSteps: ZERO_STEPS, roundSeed: seed, turn: 1, playerPosition: 0, rulerLevel: 1 });
      expect(validateChallenge(c, settings, 0)).toEqual([]);
      kinds.add(c.kind);
    }
    expect(kinds.has('midpoint')).toBe(false);
    expect(kinds.size).toBeGreaterThan(1);
  });

  it('custom ranges such as 15 to 45 and -20 to 30 stay valid', () => {
    for (const [min, max] of [
      [15, 45],
      [-20, 30],
      [3, 8],
      [-1000, 0],
    ] as const) {
      const base = defaultSettings();
      const settings: Settings = {
        ...base,
        range: { preset: 'custom', min, max },
        addition: { ...base.addition, maxResult: max },
        subtraction: { ...base.subtraction, maxOperand: Math.min(base.subtraction.maxOperand, max - min) },
      };
      for (let seed = 0; seed < 2_000; seed++) {
        for (const playerPosition of [min, max]) {
          const c = generateChallenge({ settings, skillSteps: ZERO_STEPS, roundSeed: seed, turn: 2, playerPosition, rulerLevel: 1 });
          expect(validateChallenge(c, settings, playerPosition)).toEqual([]);
        }
      }
    }
  });

  it('the custom range 550 to 780 stays valid at every ruler level (SC-013)', () => {
    const base = defaultSettings();
    const settings: Settings = { ...base, range: { preset: 'custom', min: 550, max: 780 }, addition: { ...base.addition, maxResult: 780 } };
    for (const rulerLevel of [1, 2, 3, 4, 5] as const) {
      for (let seed = 0; seed < 500; seed++) {
        for (const playerPosition of [550, 780]) {
          const c = generateChallenge({ settings, skillSteps: ZERO_STEPS, roundSeed: seed, turn: 1, playerPosition, rulerLevel });
          expect(validateChallenge(c, settings, playerPosition)).toEqual([]);
        }
      }
    }
  });

  describe('addition and subtraction on, 10,000 seeds each (T079, FR-022, FR-023, FR-029, SC-003, AC-04)', () => {
    const arithmeticOnly = { numberLine: false, addition: true, subtraction: true, comparison: false };
    const custom = (min: number, max: number, patch: Partial<Settings>): Settings => ({
      ...defaultSettings(),
      challengeTypes: arithmeticOnly,
      range: { preset: 'custom', min, max },
      ...patch,
    });
    const cases: Array<[string, Settings]> = [
      ['0 to 20, one step', presetSettings('0-20', { challengeTypes: arithmeticOnly })],
      [
        '0 to 100, two steps, crossing tens off',
        presetSettings('0-100', {
          challengeTypes: arithmeticOnly,
          crossTens: false,
          addition: { maxOperand: 10, maxResult: 100, steps: 2 },
          subtraction: { maxOperand: 10, steps: 2 },
        }),
      ],
      ['0 to 1000, crossing hundreds off', presetSettings('0-1000', { challengeTypes: arithmeticOnly, crossHundreds: false })],
      [
        'custom -20 to 30, negative results on',
        custom(-20, 30, { negativeResults: true, addition: { maxOperand: 10, maxResult: 30, steps: 1 }, subtraction: { maxOperand: 10, steps: 2 } }),
      ],
      // The addition limit applies to the added numbers only, so the start can be any number in the range (T216).
      [
        'custom 550 to 780, operands up to 230',
        custom(550, 780, { addition: { maxOperand: 230, maxResult: 780, steps: 1 }, subtraction: { maxOperand: 230, steps: 2 } }),
      ],
      [
        'custom 550 to 780, operands up to 10',
        custom(550, 780, { addition: { maxOperand: 10, maxResult: 780, steps: 2 }, subtraction: { maxOperand: 10, steps: 1 } }),
      ],
    ];

    for (const [name, settings] of cases) {
      it(`${name}: every challenge validates and addition or subtraction comes`, () => {
        expect(validateSettings(settings)).toEqual({ ok: true });
        const problems: string[] = [];
        const kinds = new Map<string, number>();
        for (let seed = 0; seed < SEEDS; seed++) {
          const playerPosition = seed % 2 === 0 ? settings.range.min : settings.range.max;
          const c = generateChallenge({ settings, skillSteps: ZERO_STEPS, roundSeed: seed, turn: 1, playerPosition, rulerLevel: 1 });
          kinds.set(c.kind, (kinds.get(c.kind) ?? 0) + 1);
          const errors = validateChallenge(c, settings, playerPosition);
          if (errors.length > 0 && problems.length < 5) problems.push(`${seed} ${c.kind} ${c.operands.join(' ')}: ${errors.join('; ')}`);
        }
        expect(problems).toEqual([]);
        expect(kinds.get('subtraction') ?? 0).toBeGreaterThan(SEEDS * 0.3);
        expect(kinds.get('addition') ?? 0).toBeGreaterThan(SEEDS * 0.3);
      });
    }
  });

  describe('comparison on, 10,000 seeds each (T086, FR-026, FR-027, FR-029, SC-003)', () => {
    const comparisonOnly = { numberLine: false, addition: false, subtraction: false, comparison: true };
    const cases: Array<[string, Settings]> = [
      ['0 to 10', presetSettings('0-10', { challengeTypes: comparisonOnly })],
      ['0 to 100', presetSettings('0-100', { challengeTypes: comparisonOnly })],
      ['0 to 1000', presetSettings('0-1000', { challengeTypes: comparisonOnly })],
      ['custom 550 to 780', { ...defaultSettings(), challengeTypes: comparisonOnly, range: { preset: 'custom', min: 550, max: 780 } }],
      ['0 to 100, every type on', presetSettings('0-100')],
    ];
    for (const [name, settings] of cases) {
      it(`${name}: every challenge validates and comparisons come`, () => {
        const problems: string[] = [];
        let comparisons = 0;
        const comparisonKinds = new Set<string>();
        for (let seed = 0; seed < SEEDS; seed++) {
          const playerPosition = seed % 2 === 0 ? settings.range.min : settings.range.max;
          const c = generateChallenge({ settings, skillSteps: ZERO_STEPS, roundSeed: seed, turn: 1, playerPosition, rulerLevel: 1 });
          if (c.options) {
            comparisons++;
            comparisonKinds.add(c.kind);
          }
          const errors = validateChallenge(c, settings, playerPosition);
          // Amendment 10: every option is a tank, so each keeps minTankGap from the player.
          const { min, max } = settings.range;
          for (const o of c.options ?? []) if (Math.abs(o - playerPosition) < minTankGap(min, max)) errors.push(`option ${o} too close to the player`);
          if (errors.length > 0 && problems.length < 5) problems.push(`${seed} ${c.kind} ${String(c.options)}: ${errors.join('; ')}`);
        }
        expect(problems).toEqual([]);
        expect(comparisons).toBeGreaterThan(settings.challengeTypes.numberLine ? SEEDS * 0.2 : SEEDS * 0.99);
        // Amendment 09: no 'equal' and no 'order3'; 'middle3' comes.
        expect(comparisonKinds.has('equal') || comparisonKinds.has('order3')).toBe(false);
        expect(comparisonKinds.has('middle3')).toBe(true);
      });
    }
  });

  describe('US9 ranges, 10,000 seeds each (T148, FR-029, FR-067, SC-003, SC-013)', () => {
    function customSettings(min: number, max: number, patch: Partial<Settings> = {}): Settings {
      const base = defaultSettings();
      return {
        ...base,
        range: { preset: 'custom', min, max },
        addition: { ...base.addition, maxResult: max },
        subtraction: { ...base.subtraction, maxOperand: Math.min(base.subtraction.maxOperand, max - min) },
        ...patch,
      };
    }

    /** Generates SEEDS challenges, alternating the player side, and returns the first few problems. */
    function problemsFor(settings: Settings, rulerLevel: 1 | 2 | 3 | 4 | 5, kindsAllowed?: ['readPosition']): string[] {
      const problems: string[] = [];
      for (let seed = 0; seed < SEEDS; seed++) {
        const playerPosition = seed % 2 === 0 ? settings.range.min : settings.range.max;
        const c = generateChallenge({ settings, skillSteps: ZERO_STEPS, roundSeed: seed, turn: 1, playerPosition, rulerLevel, kindsAllowed });
        const errors = validateChallenge(c, settings, playerPosition);
        if (kindsAllowed && c.kind !== 'readPosition') errors.push(`kind ${c.kind}`);
        if (errors.length > 0 && problems.length < 5) problems.push(`${seed} ${c.kind}: ${errors.join('; ')}`);
      }
      return problems;
    }

    const cases: Array<[string, Settings]> = [
      ['0 to 50', presetSettings('0-50')],
      ['0 to 1000, crossing hundreds on', presetSettings('0-1000', { crossHundreds: true })],
      ['0 to 1000, crossing hundreds off', presetSettings('0-1000', { crossHundreds: false })],
      ['custom 15 to 45', customSettings(15, 45)],
      ['custom 550 to 780', customSettings(550, 780)],
      ['custom -20 to 30, negative results on', customSettings(-20, 30, { negativeResults: true })],
      ['custom -20 to 30, negative results off', customSettings(-20, 30, { negativeResults: false })],
    ];

    for (const [name, settings] of cases) {
      it(`${name}: every challenge validates`, () => {
        expect(problemsFor(settings, 1)).toEqual([]);
      });
    }

    for (const [name, settings] of [cases[0]!, cases[2]!, cases[3]!, cases[4]!, cases[5]!]) {
      for (const level of [1, 2, 3, 4, 5] as const) {
        it(`${name}: readPosition on ruler level ${level} always validates and stays readPosition`, () => {
          expect(problemsFor(settings, level, ['readPosition'])).toEqual([]);
        });
      }
    }
  });
});

describe('generateChallenge with 200 random valid settings, 1000 seeds each (T107, FR-029, SC-003, SC-013, US6 scenario 3, AC-04)', () => {
  const SETTINGS_COUNT = 200;
  const SEEDS_PER_SETTINGS = 1_000;
  const PRESETS = Object.keys(RANGE_PRESETS) as Array<keyof typeof RANGE_PRESETS>;
  const LEVELS = [1, 2, 3, 4, 5] as const;

  /** All 16 on/off combinations of the four challenge-type switches. */
  const TYPE_COMBINATIONS = Array.from({ length: 16 }, (_, bits) => ({
    numberLine: (bits & 1) !== 0,
    addition: (bits & 2) !== 0,
    subtraction: (bits & 4) !== 0,
    comparison: (bits & 8) !== 0,
  }));

  /** One random settings object; it may break a rule, then the caller drops it. */
  function randomSettings(rng: Rng, forced?: { range0to20: boolean; types: Settings['challengeTypes'] }): Settings {
    const base = defaultSettings();
    let range: Settings['range'];
    if (forced?.range0to20) range = { preset: '0-20', ...RANGE_PRESETS['0-20'] };
    else if (rng.next() < 0.5) {
      const preset = rng.pick(PRESETS);
      range = { preset, ...RANGE_PRESETS[preset] };
    } else {
      // Any start, including negative and four-digit starts, with spans from the smallest to the largest.
      const min = rng.pick([rng.int(CUSTOM_MIN_LIMIT, CUSTOM_MIN_UPPER_LIMIT), rng.int(-50, 50), rng.int(0, 1000)]);
      const span = rng.pick([rng.int(RANGE_SPAN_MIN, 30), rng.int(RANGE_SPAN_MIN, RANGE_SPAN_MAX)]);
      range = { preset: 'custom', min, max: min + span };
    }
    const types = forced?.types ?? rng.pick(TYPE_COMBINATIONS);
    const allOff = !Object.values(types).some(Boolean);
    const startLevel = rng.pick(LEVELS);
    const patched: Settings = {
      ...base,
      challengeTypes: { ...types },
      addition: { maxOperand: rng.int(1, 100), maxResult: rng.int(-1000, 10_000), steps: rng.pick([1, 2] as const) },
      subtraction: { maxOperand: rng.int(1, 100), steps: rng.pick([1, 2] as const) },
      crossTens: rng.next() < 0.5,
      crossHundreds: rng.next() < 0.5,
      negativeResults: rng.next() < 0.5,
      rulerLevelStart: startLevel,
      rulerLevelMax: rng.pick(LEVELS.filter((l) => l >= startLevel)),
      // Every switch off is valid only together with free play (FR-047).
      freePlay: allOff || rng.next() < 0.3,
    };
    // withRange clamps the linked limits to the range, as the settings page does.
    return withRange(patched, range);
  }

  function collectSettings(): Settings[] {
    const rng = createRng(20_261_105);
    const out: Settings[] = [];
    // First every challenge-type combination on 0 to 20, then random settings until there are 200.
    for (const types of TYPE_COMBINATIONS) {
      const s = randomSettings(rng, { range0to20: true, types });
      if (validateSettings(s).ok) out.push(s);
    }
    for (let tries = 0; out.length < SETTINGS_COUNT && tries < 100_000; tries++) {
      const s = randomSettings(rng);
      if (validateSettings(s).ok) out.push(s);
    }
    return out;
  }

  const all = collectSettings();

  it('builds 200 valid settings covering custom starts, 0 to 20 with every type combination, and every ruler level', () => {
    expect(all).toHaveLength(SETTINGS_COUNT);
    const zeroToTwenty = all.filter((s) => s.range.preset === '0-20');
    for (const types of TYPE_COMBINATIONS) {
      expect(zeroToTwenty.some((s) => JSON.stringify(s.challengeTypes) === JSON.stringify(types))).toBe(true);
    }
    const customs = all.filter((s) => s.range.preset === 'custom');
    expect(customs.some((s) => s.range.min < 0)).toBe(true);
    expect(customs.some((s) => s.range.min > 1000)).toBe(true);
    expect(customs.some((s) => s.range.min % 10 !== 0)).toBe(true);
    for (const level of LEVELS) {
      expect(all.some((s) => s.rulerLevelStart === level)).toBe(true);
      expect(all.some((s) => s.rulerLevelMax === level)).toBe(true);
    }
  });

  for (let i = 0; i < SETTINGS_COUNT; i += 20) {
    const group = all.slice(i, i + 20);
    it(`settings ${i + 1} to ${i + group.length}: every challenge validates and stays inside the range`, () => {
      const problems: string[] = [];
      let generated = 0;
      for (const settings of group) {
        const { min, max } = settings.range;
        const levels = LEVELS.filter((l) => l >= settings.rulerLevelStart && l <= settings.rulerLevelMax);
        for (let seed = 0; seed < SEEDS_PER_SETTINGS && problems.length < 5; seed++) {
          const playerPosition = seed % 2 === 0 ? min : max;
          const rulerLevel = levels[seed % levels.length]!;
          const label = `${settings.range.preset} ${min}..${max} types ${JSON.stringify(settings.challengeTypes)} level ${rulerLevel} seed ${seed}`;
          let c;
          try {
            c = generateChallenge({ settings, skillSteps: ZERO_STEPS, roundSeed: seed, turn: 1 + (seed % 7), playerPosition, rulerLevel });
          } catch (e) {
            problems.push(`${label}: threw ${String(e)}`);
            continue;
          }
          generated++;
          const errors = validateChallenge(c, settings, playerPosition);
          if (errors.length > 0) problems.push(`${label} ${c.kind}: ${errors.join('; ')}`);
        }
      }
      expect(problems).toEqual([]);
      expect(generated).toBe(group.length * SEEDS_PER_SETTINGS);
    });
  }
});

describe('difficulty steps only narrow the choices (US7, T130, FR-037)', () => {
  const allSkills = Object.keys(ladders) as Skill[];
  const allTypes = { numberLine: true, addition: true, subtraction: true, comparison: true };
  const moving = new Set(['addition', 'subtraction', 'stepsRight', 'stepsLeft']);

  for (const preset of ['0-20', '0-100', '0-1000'] as const) {
    for (const side of ['left', 'right'] as const) {
      it(`range ${preset}, player ${side}: with random skill steps every challenge stays inside its main skill's step and the parent settings`, () => {
        const settings = presetSettings(preset, { challengeTypes: allTypes, adaptive: true });
        const { min, max } = settings.range;
        const problems: string[] = [];
        for (let seed = 1; seed <= 2000; seed++) {
          const rng = createRng(seed * 31 + 7);
          const skillSteps = Object.fromEntries(allSkills.map((sk) => [sk, rng.int(0, ladders[sk].length - 1)])) as Record<Skill, number>;
          const c = generateChallenge({
            settings,
            skillSteps,
            roundSeed: seed,
            turn: seed % 5,
            playerPosition: side === 'left' ? min : max,
            rulerLevel: 1,
            inputMethod: 'pointer',
          });
          const skill = mainSkillOf(c.kind);
          const step = clampStep(skill, skillSteps[skill], settings);
          const tag = `seed ${seed} ${c.kind} ${c.operands.join(',')} = ${c.answer}`;
          // The parent settings stay the ceiling.
          const errors = validateChallenge(c, settings, side === 'left' ? min : max);
          if (errors.length > 0) problems.push(`${tag}: ${errors.join('; ')}`);
          if (c.difficultyStep !== skillSteps[skill]) problems.push(`${tag}: difficultyStep ${c.difficultyStep}`);
          // The step's part of the range starts at the smallest answer allowed at minEnemyGap from the player.
          const lowest = side === 'left' ? Math.ceil(min + minEnemyGap(min, max)) : min;
          if (c.answer > lowest + step.maxNumberFraction * (max - min)) problems.push(`${tag}: answer above the step's part of the range`);
          if ((c.kind === 'addition' || c.kind === 'subtraction') && step.maxOperand !== undefined && c.operands.slice(1).some((k) => k > step.maxOperand!)) {
            problems.push(`${tag}: operand above ${step.maxOperand}`);
          }
          if (moving.has(c.kind) && !step.allowCrossTens) {
            const path = c.steps ?? [c.operands[0]!, c.answer];
            if (path.some((n, i) => i > 0 && crossesMultiple(path[i - 1]!, n, 10))) problems.push(`${tag}: crosses a ten`);
          }
        }
        expect(problems).toEqual([]);
      });
    }
  }
});
