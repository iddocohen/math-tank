/**
 * Fixture seeds for the acceptance checks (AC-05). `seed` is the value of the `seed` URL parameter
 * (`?seed=...`): the first guided round started with it searches with `input`, so the first challenge is 43 − 7.
 */
import { deriveSeed } from '../rng';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../types';
import type { GenerateInput } from './generate';

/** Only subtraction on, range 0 to 100, the other settings at their defaults. */
function onlySubtraction(): Settings {
  return { ...defaultSettings(), challengeTypes: { numberLine: false, addition: false, subtraction: true, comparison: false } };
}

const SEED_43_MINUS_7 = 1033;

export const SUBTRACTION_43_MINUS_7: {
  seed: number;
  settings: Settings;
  input: Omit<GenerateInput, 'settings'>;
} = {
  seed: SEED_43_MINUS_7,
  settings: onlySubtraction(),
  // As BattleController does for its first round: round seed from the base seed and round 1, turn 0, the ruler
  // level from rulerLevelStart, keyboard input before the first input (FR-076).
  input: {
    skillSteps: { positions: 0, countForward: 0, countBackward: 0, tens: 0, crossTens: 0, addition: 0, subtraction: 0, comparison: 0 },
    roundSeed: deriveSeed(SEED_43_MINUS_7, 1),
    turn: 0,
    // The base seed 1033 puts the player on the right, at range.max.
    playerPosition: 100,
    rulerLevel: 1,
    inputMethod: 'keyboard',
  },
};
