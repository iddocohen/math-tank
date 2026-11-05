import {
  CUSTOM_MIN_LIMIT,
  CUSTOM_MIN_UPPER_LIMIT,
  RANGE_PRESETS,
  RANGE_SPAN_MAX,
  RANGE_SPAN_MIN,
  ROUND_LENGTH_MAX,
  ROUND_LENGTH_MIN,
  TIME_LIMIT_MAX,
  TIME_LIMIT_MIN,
} from './defaults';
import type { Settings, SettingsRange } from './schema';

/** Keys of `settingsErrors` in the translation table (src/i18n/de.ts). */
export const SETTINGS_ERROR_KEYS = [
  'rangeNotInteger',
  'rangeOrder',
  'rangeSpan',
  'rangeMinOutside',
  'rangePresetMismatch',
  'noChallengeTypes',
  'rulerLevelOrder',
  'roundLength',
  'roundTypeNoDamage',
  'timeLimit',
  'additionMaxOperand',
  'additionMaxResult',
  'additionNoExercise',
  'subtractionMaxOperand',
  'subtractionNoExercise',
] as const;

export type SettingsErrorKey = (typeof SETTINGS_ERROR_KEYS)[number];

/** A translation key plus the path of the field it belongs to. */
export interface SettingsError {
  key: SettingsErrorKey;
  path: string;
}

export type SettingsValidation = { ok: true } | { ok: false; errors: SettingsError[] };

/** Smallest result an exercise may have: range.min, or 0 when negative results are off. */
export function lowestResult(s: Pick<Settings, 'negativeResults'>, range: SettingsRange): number {
  return s.negativeResults ? range.min : Math.max(range.min, 0);
}

/** Checks every rule in data-model.md (FR-047). */
export function validateSettings(s: Settings): SettingsValidation {
  const errors: SettingsError[] = [];
  const add = (key: SettingsErrorKey, path: string) => errors.push({ key, path });
  const { range } = s;
  const span = range.max - range.min;

  if (!Number.isInteger(range.min) || !Number.isInteger(range.max)) add('rangeNotInteger', 'range');
  if (range.min >= range.max) add('rangeOrder', 'range');
  else if (span < RANGE_SPAN_MIN || span > RANGE_SPAN_MAX) add('rangeSpan', 'range');
  if (range.min < CUSTOM_MIN_LIMIT || range.min > CUSTOM_MIN_UPPER_LIMIT) add('rangeMinOutside', 'range');
  if (range.preset !== 'custom') {
    const fixed = RANGE_PRESETS[range.preset];
    if (fixed.min !== range.min || fixed.max !== range.max) add('rangePresetMismatch', 'range');
  }

  const anyType = Object.values(s.challengeTypes).some(Boolean);
  if (!anyType && !s.freePlay) add('noChallengeTypes', 'challengeTypes');

  if (s.rulerLevelStart > s.rulerLevelMax) add('rulerLevelOrder', 'rulerLevelStart');

  if (!Number.isInteger(s.roundLength) || s.roundLength < ROUND_LENGTH_MIN || s.roundLength > ROUND_LENGTH_MAX) {
    add('roundLength', 'roundLength');
  }

  // "Bis alle Herzen weg" never ends when the hearts never go down (FR-044, FR-082).
  if (s.roundType === 'untilHearts' && s.noDamage) add('roundTypeNoDamage', 'roundType');

  if (s.timeLimitSeconds !== null && (s.timeLimitSeconds < TIME_LIMIT_MIN || s.timeLimitSeconds > TIME_LIMIT_MAX)) {
    add('timeLimit', 'timeLimitSeconds');
  }

  const lo = lowestResult(s, range);

  if (s.addition.maxOperand < 1) add('additionMaxOperand', 'addition.maxOperand');
  if (s.addition.maxResult > range.max) add('additionMaxResult', 'addition.maxResult');
  else if (s.challengeTypes.addition && lo + 1 > Math.min(s.addition.maxResult, range.max)) {
    // The smallest sum is lo + 1 (lo plus an operand of 1).
    add('additionNoExercise', 'addition.maxResult');
  }

  if (s.subtraction.maxOperand < 1 || s.subtraction.maxOperand > span) {
    add('subtractionMaxOperand', 'subtraction.maxOperand');
  } else if (s.challengeTypes.subtraction && lo + 1 > range.max) {
    // a - b >= lo with b >= 1 needs a >= lo + 1 inside the range.
    add('subtractionNoExercise', 'subtraction.maxOperand');
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/**
 * Returns settings with the new range and the linked limits clamped to fit it,
 * so a range change never leaves the form invalid (FR-047). Does not change `s`.
 */
export function withRange(s: Settings, range: SettingsRange): Settings {
  const next: Settings = structuredClone(s);
  next.range = { ...range };
  const span = Math.max(1, range.max - range.min);
  const lo = lowestResult(next, range);

  // A maxResult that followed the old range.max keeps following the new one.
  const followedMax = s.addition.maxResult >= s.range.max;
  const maxResult = followedMax ? range.max : s.addition.maxResult;
  next.addition.maxResult = clamp(maxResult, Math.min(lo + 1, range.max), range.max);
  next.addition.maxOperand = clamp(s.addition.maxOperand, 1, span);
  next.subtraction.maxOperand = clamp(s.subtraction.maxOperand, 1, span);
  return next;
}
