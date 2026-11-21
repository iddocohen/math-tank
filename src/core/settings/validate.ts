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
  TWO_NUMBER_MAX,
  TWO_NUMBER_MIN,
} from './defaults';
import { twoNumberFit, type TwoNumberFit } from '../math/twoNumbers';
import { modeCanPlay } from '../modes';
import { clamp } from '../util';
import { highestResult, isTwoNumbers, lowestResult } from './limits';
import type { NumberSpan, Settings, SettingsRange } from './schema';

/** Keys of `settingsErrors` in the translation table (src/i18n/de.ts). */
export const SETTINGS_ERROR_KEYS = [
  'rangeNotInteger',
  'rangeOrder',
  'rangeSpan',
  'rangeMinOutside',
  'rangePresetMismatch',
  'noChallengeTypes',
  'noPlayMode',
  // Amendment 27 (FR-162).
  'arithmeticModeNoType',
  'arithmeticModeNoExercise',
  'numbersModeNoType',
  'rulerLevelOrder',
  'roundLength',
  'roundTypeNoDamage',
  'timeLimit',
  'additionMaxOperand',
  'additionMaxResult',
  'additionNoExercise',
  'subtractionMaxOperand',
  'subtractionNoExercise',
  // Amendment 26 (FR-151, FR-152), only for "Zahlengröße" "Zwei Zahlen".
  'additionFirstRange',
  'additionSecondRange',
  'additionNoPair',
  'subtractionFirstRange',
  'subtractionSecondRange',
  'subtractionOrder',
  'subtractionNoPair',
] as const;

export type SettingsErrorKey = (typeof SETTINGS_ERROR_KEYS)[number];

/** A translation key plus the path of the field it belongs to. */
export interface SettingsError {
  key: SettingsErrorKey;
  path: string;
}

export type SettingsValidation = { ok: true } | { ok: false; errors: SettingsError[] };

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

  // Amendment 17 and 27: at least one play mode; "Gemischt" needs a challenge type, "Plus und Minus" needs "Plus" or
  // "Minus", "Zahlen-Rätsel" needs "Zahlenstrahl" or "Vergleichen"; "Nur Zahlenstrahl" needs none.
  const { challengeTypes: t, playModes } = s;
  const anyType = Object.values(t).some(Boolean);
  if (!Object.values(playModes).some(Boolean)) add('noPlayMode', 'playModes');
  if (!anyType && playModes.mixed) add('noChallengeTypes', 'challengeTypes');
  if (playModes.arithmetic && !t.addition && !t.subtraction) add('arithmeticModeNoType', 'playModes.arithmetic');
  if (playModes.numbers && !t.numberLine && !t.comparison) add('numbersModeNoType', 'playModes.numbers');

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
  // The largest operand and the steps apply to "Kleine Schritte" only; with "Zwei Zahlen" they are hidden (review).
  const addSteps = !isTwoNumbers('addition', s);
  const subSteps = !isTwoNumbers('subtraction', s);

  // Like subtraction, at most the range width, so generating an exercise stays fast (review R5).
  if (addSteps && (s.addition.maxOperand < 1 || s.addition.maxOperand > span)) add('additionMaxOperand', 'addition.maxOperand');
  if (s.addition.maxResult > range.max) add('additionMaxResult', 'addition.maxResult');
  else if (s.challengeTypes.addition && lo + 1 > highestResult('addition', s)) {
    // The smallest sum is lo + 1 (lo plus an operand of 1).
    add('additionNoExercise', 'addition.maxResult');
  }

  if (subSteps && (s.subtraction.maxOperand < 1 || s.subtraction.maxOperand > span)) {
    add('subtractionMaxOperand', 'subtraction.maxOperand');
  } else if (subSteps && s.challengeTypes.subtraction && lo + 1 > range.max) {
    // a - b >= lo with b >= 1 needs a >= lo + 1 inside the range.
    add('subtractionNoExercise', 'subtraction.maxOperand');
  }

  for (const kind of ['addition', 'subtraction'] as const) errors.push(...twoNumberStatus(kind, s).errors);

  // Amendment 27 item 7 (FR-162): "Plus und Minus" needs a plus or minus exercise far enough from the child's tank at
  // both ends. The search walks every operand, so it runs only when the range, the largest operands, "Größtes
  // Ergebnis" and the "Zwei Zahlen" fields have no error (critique E3).
  if (playModes.arithmetic && (t.addition || t.subtraction) && !errors.some((e) => EXERCISE_FIELDS.test(e.path)) && !modeCanPlay('arithmetic', s)) {
    add('arithmeticModeNoExercise', 'playModes.arithmetic');
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/** The error paths of the fields the "Plus und Minus" exercise check reads: the range and the plus and minus fields. */
const EXERCISE_FIELDS = /^(range|addition\.|subtraction\.)/;

/** A "Zwei Zahlen" range of whole numbers from 1 to 999, smallest first (FR-151). */
function spanOk(r: NumberSpan): boolean {
  return Number.isInteger(r.min) && Number.isInteger(r.max) && r.min >= TWO_NUMBER_MIN && r.max <= TWO_NUMBER_MAX && r.min <= r.max;
}

/**
 * The "Zwei Zahlen" checks of one kind (amendment 26, FR-149 to FR-152), shared by validateSettings and
 * settingsNotices: the errors of its fields, and how its pairs fit the battlefield when the fields have no error
 * and the kind is on (else `fit` is null). Each size also checks that the fields it hides hold whole numbers, so the
 * saved settings pass the schema (review); that error shows at "Zahlengröße". No fit for "Kleine Schritte".
 */
function twoNumberStatus(kind: 'addition' | 'subtraction', s: Settings): { errors: SettingsError[]; fit: TwoNumberFit | null } {
  const errors: SettingsError[] = [];
  const k = s[kind];
  if (!isTwoNumbers(kind, s)) {
    // The hidden ranges are saved too, and the schema takes whole numbers only (review). The page resets them when
    // "Zahlengröße" changes, so this error shows at "Zahlengröße" only for settings made elsewhere.
    const whole = [k.first.min, k.first.max, k.second.min, k.second.max].every(Number.isInteger);
    if (!whole) errors.push({ key: 'rangeNotInteger', path: `${kind}.size` });
    return { errors, fit: null };
  }
  if (!spanOk(k.first)) errors.push({ key: `${kind}FirstRange`, path: `${kind}.first` });
  if (!spanOk(k.second)) errors.push({ key: `${kind}SecondRange`, path: `${kind}.second` });
  // Minus: some first number must be larger than some second number (FR-149).
  if (errors.length === 0 && kind === 'subtraction' && k.first.max <= k.second.min) errors.push({ key: 'subtractionOrder', path: 'subtraction.first' });
  const fit = errors.length === 0 && s.challengeTypes[kind] ? twoNumberFit(kind, s) : null;
  if (fit && !fit.any) errors.push({ key: `${kind}NoPair`, path: `${kind}.size` });
  // The same for the hidden largest operand of "Kleine Schritte".
  if (!Number.isInteger(k.maxOperand)) errors.push({ key: 'rangeNotInteger', path: `${kind}.size` });
  return { errors, fit };
}

/** Keys of `settingsNotes` in the translation table (src/i18n/de.ts). */
export type SettingsNoticeKey = 'additionSomeOff' | 'subtractionSomeOff';

/**
 * A note on the settings page that does not block saving (amendment 26, FR-152): only some "Zwei Zahlen" exercises
 * fit the battlefield. `value` is the largest plus answer or the smallest minus answer that can come.
 */
export interface SettingsNotice {
  key: SettingsNoticeKey;
  path: string;
  value: number;
}

/**
 * The non-blocking notes for settings without errors in the kind's fields: for each kind that is on with "Zwei Zahlen",
 * when some pairs of its ranges fit and some do not.
 */
export function settingsNotices(s: Settings): SettingsNotice[] {
  const notices: SettingsNotice[] = [];
  for (const kind of ['addition', 'subtraction'] as const) {
    const { fit } = twoNumberStatus(kind, s);
    if (fit && fit.any && !fit.all && fit.extreme !== null) notices.push({ key: `${kind}SomeOff`, path: `${kind}.size`, value: fit.extreme });
  }
  return notices;
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
