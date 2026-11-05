import type { RangePreset, Settings } from './schema';

/** Fixed min and max per preset ("preset values fix min and max", data-model.md). */
export const RANGE_PRESETS: Record<Exclude<RangePreset, 'custom'>, { min: number; max: number }> = {
  '0-10': { min: 0, max: 10 },
  '0-20': { min: 0, max: 20 },
  '0-50': { min: 0, max: 50 },
  '0-100': { min: 0, max: 100 },
  '0-1000': { min: 0, max: 1000 },
};

/** Lowest custom range start (data-model.md). */
export const CUSTOM_MIN_LIMIT = -1000;
/** Highest custom range start (spec Assumptions: at most 4 digits plus a sign). */
export const CUSTOM_MIN_UPPER_LIMIT = 9000;
export const RANGE_SPAN_MIN = 5;
export const RANGE_SPAN_MAX = 1000;
export const ROUND_LENGTH_MIN = 3;
export const ROUND_LENGTH_MAX = 30;
export const TIME_LIMIT_MIN = 10;
export const TIME_LIMIT_MAX = 120;

/** Data-model.md defaults (FR-046). Returns a fresh object on each call. */
export function defaultSettings(): Settings {
  return {
    version: 3,
    challengeTypes: { numberLine: true, addition: true, subtraction: true, comparison: true },
    range: { preset: '0-100', min: 0, max: 100 },
    addition: { maxOperand: 10, maxResult: 100, steps: 1 },
    subtraction: { maxOperand: 10, steps: 1 },
    crossTens: true,
    crossHundreds: false,
    negativeResults: false,
    rulerLevelStart: 1,
    rulerLevelMax: 5,
    enemyDifficulty: 'easy',
    help: { nearestTen: true, countSteps: true, zoom: true, stepAnimation: true },
    beginnerAssist: true,
    sound: { effects: true, music: false, speech: true },
    roundLength: 10,
    adaptive: true,
    freePlay: false,
    noDamage: false,
    exactHit: false,
    timeLimitSeconds: null,
  };
}
