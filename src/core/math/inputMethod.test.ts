/**
 * Amendment 05 (FR-029, FR-076): with keyboard input "Finde N" is skipped, because typing a given number needs no
 * thinking. When it is the only kind left, the generator falls back to "read the ruler".
 */
import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import type { ChallengeKind, Settings, Skill } from '../types';
import { generateChallenge, type GenerateInput } from './generate';
import { validateChallenge } from './validate';

const SEEDS = 2000;
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

function input(seed: number, patch: Partial<GenerateInput> = {}, settings: Settings = defaultSettings()): GenerateInput {
  return { settings, skillSteps: ZERO_STEPS, roundSeed: seed, turn: seed % 7, playerPosition: settings.range.min, rulerLevel: 1, ...patch };
}

function kinds(patch: Partial<GenerateInput>, settings?: Settings): Map<ChallengeKind, number> {
  const counts = new Map<ChallengeKind, number>();
  for (let seed = 1; seed <= SEEDS; seed++) {
    const kind = generateChallenge(input(seed, patch, settings)).kind;
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return counts;
}

function customRange(min: number, max: number, preset: Settings['range']['preset'] = 'custom'): Settings {
  const s = defaultSettings();
  return {
    ...s,
    range: { preset, min, max },
    addition: { ...s.addition, maxResult: max },
    subtraction: { ...s.subtraction, maxOperand: Math.min(s.subtraction.maxOperand, max - min) },
  };
}

describe('generateChallenge input method (amendment 05, FR-076)', () => {
  it('keyboard input never gets findNumber, and still gets at least 3 other number-line kinds', () => {
    const counts = kinds({ inputMethod: 'keyboard' });
    expect(counts.has('findNumber')).toBe(false);
    expect(counts.size).toBeGreaterThanOrEqual(3);
  });

  it('pointer input and an unknown input method can get findNumber', () => {
    expect(kinds({ inputMethod: 'pointer' }).get('findNumber')).toBeGreaterThan(0);
    expect(kinds({}).get('findNumber')).toBeGreaterThan(0);
  });

  it('with only findNumber allowed, keyboard input falls back to readPosition and pointer input keeps findNumber', () => {
    expect([...kinds({ inputMethod: 'keyboard', kindsAllowed: ['findNumber'] }).keys()]).toEqual(['readPosition']);
    expect([...kinds({ inputMethod: 'pointer', kindsAllowed: ['findNumber'] }).keys()]).toEqual(['findNumber']);
  });

  for (const [min, max, preset] of [
    [0, 10, '0-10'],
    [0, 1000, '0-1000'],
    [550, 780, 'custom'],
    [-20, 30, 'custom'],
  ] as const) {
    it(`keyboard input in ${min} to ${max}: every challenge validates and none is findNumber`, () => {
      const settings = customRange(min, max, preset);
      const problems: string[] = [];
      for (let seed = 1; seed <= SEEDS; seed++) {
        for (const kindsAllowed of [undefined, ['findNumber'] as ChallengeKind[]]) {
          const c = generateChallenge(input(seed, { inputMethod: 'keyboard', kindsAllowed }, settings));
          if (c.kind === 'findNumber') problems.push(`seed ${seed}: findNumber`);
          const errors = validateChallenge(c, settings, settings.range.min);
          if (errors.length > 0) problems.push(`seed ${seed} ${c.kind}: ${errors.join('; ')}`);
        }
      }
      expect(problems.slice(0, 5)).toEqual([]);
    });
  }

  it('same seed and input give the same challenge', () => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(generateChallenge(input(seed, { inputMethod: 'keyboard' }))).toEqual(generateChallenge(input(seed, { inputMethod: 'keyboard' })));
    }
  });
});
