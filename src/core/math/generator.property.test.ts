import { describe, expect, it } from 'vitest';
import { RANGE_PRESETS } from '../settings/defaults';
import { defaultSettings } from '../settings/defaults';
import type { Settings, Skill } from '../types';
import { generateChallenge } from './generate';
import { validateChallenge } from './validate';

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
          for (const purpose of ['search', 'bonus'] as const) {
            const c = generateChallenge({ settings, skillSteps: ZERO_STEPS, roundSeed: seed, turn: 1, playerPosition, purpose });
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
          const c = generateChallenge({ settings, skillSteps: ZERO_STEPS, roundSeed: seed, turn: 3, playerPosition, purpose: 'search' });
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
          purpose: 'search',
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
      const c = generateChallenge({ settings, skillSteps: ZERO_STEPS, roundSeed: seed, turn: 1, playerPosition: 0, purpose: 'search' });
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
          const c = generateChallenge({ settings, skillSteps: ZERO_STEPS, roundSeed: seed, turn: 2, playerPosition, purpose: 'search' });
          expect(validateChallenge(c, settings, playerPosition)).toEqual([]);
        }
      }
    }
  });

  it('a bonus challenge is never a comparison kind (FR-014)', () => {
    const settings = presetSettings('0-100');
    const comparison = ['greater', 'smaller', 'equal', 'order3', 'largest3', 'smallest3', 'closestTo', 'between'];
    for (let seed = 0; seed < 1_000; seed++) {
      const c = generateChallenge({ settings, skillSteps: ZERO_STEPS, roundSeed: seed, turn: 1, playerPosition: 0, purpose: 'bonus' });
      expect(comparison).not.toContain(c.kind);
    }
  });
});
