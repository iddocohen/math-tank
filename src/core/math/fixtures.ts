/**
 * Fixture seeds for the acceptance checks (AC-05, AC-06). `seed` is the value of the `seed` URL parameter
 * (`?seed=...`): the first guided round started with it searches with `input`, so the first challenge is 43 − 7.
 */
import { deriveSeed } from '../rng';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../types';
import type { GenerateInput } from './generate';
import { skillStepsFor } from '../progress/ladders';
import { emptyProgress } from '../storage/storage';

/**
 * Only subtraction on, range 0 to 100, adaptive difficulty off (the challenge follows the parent settings, not the
 * easiest ladder step of a new player), the other settings at their defaults. "Zahlen-Rätsel" needs "Zahlenstrahl" or
 * "Vergleichen", so it is not offered; otherwise the settings fail the check and load as the defaults (amendment 27,
 * FR-162).
 */
function onlySubtraction(): Settings {
  return {
    ...defaultSettings(),
    adaptive: false,
    challengeTypes: { numberLine: false, addition: false, subtraction: true, comparison: false },
    playModes: { mixed: true, ruler: true, arithmetic: true, numbers: false },
  };
}

/** The skill steps BattleController passes with adaptive difficulty off: the top step per skill. */
function parentSteps(settings: Settings): GenerateInput['skillSteps'] {
  return skillStepsFor(emptyProgress(), `${settings.range.min}-${settings.range.max}`, settings);
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
    skillSteps: parentSteps(onlySubtraction()),
    roundSeed: deriveSeed(SEED_43_MINUS_7, 1),
    turn: 0,
    // The base seed 1033 puts the player on the right, at range.max.
    playerPosition: 100,
    rulerLevel: 1,
    inputMethod: 'keyboard',
  },
};

/**
 * Only comparison on, range 0 to 100, adaptive difficulty off, the other settings at their defaults. "Plus und Minus"
 * needs "Plus" or "Minus", so it is not offered (amendment 27, FR-162).
 */
function onlyComparison(): Settings {
  return {
    ...defaultSettings(),
    adaptive: false,
    challengeTypes: { numberLine: false, addition: false, subtraction: false, comparison: true },
    playModes: { mixed: true, ruler: true, arithmetic: false, numbers: true },
  };
}

const SEED_47_74 = 65327;

/**
 * US4 Independent Test (AC-06, amendment 09): the first guided search with this seed is "Der Gegner steht bei der
 * größeren Zahl: 47 oder 74", with the one enemy at 74.
 */
export const COMPARISON_47_74: {
  seed: number;
  settings: Settings;
  input: Omit<GenerateInput, 'settings'>;
} = {
  seed: SEED_47_74,
  settings: onlyComparison(),
  input: {
    skillSteps: parentSteps(onlyComparison()),
    roundSeed: deriveSeed(SEED_47_74, 1),
    turn: 0,
    // The base seed 65327 puts the player on the right, at range.max.
    playerPosition: 100,
    rulerLevel: 1,
    inputMethod: 'keyboard',
  },
};
