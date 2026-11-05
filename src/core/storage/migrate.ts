import { defaultSettings, ROUND_LENGTH_MAX, ROUND_LENGTH_MIN } from '../settings/defaults';

/**
 * Upgrades older stored versions to the current one before schema validation (research R11).
 * Settings: version 0 is any object with `version: 0` or no `version` field; versions 0 and 1 become
 * version 2 (decision D13: `aimCorrection` dropped, `labelLevel` turned into `rulerLevelStart` and
 * `rulerLevelMax`), with missing fields filled from the defaults. Version 2 becomes version 3 (amendment 04:
 * `exactHit` added, default false). Version 3 becomes version 4 (amendment 06: `exactHit` dropped, `roundType`,
 * `showClock` and `showRecords` added, `roundLength` clamped to 1 to 20 enemies). Version 4 becomes version 5
 * (amendment 11: `garage` added, default true). Version 5 becomes version 6 (amendment 12: `numberPad` added, default
 * 'auto'). Older versions go through every later step. Every settings version then gets `addition.maxOperand`
 * clamped to the range width (review R5). Progress: version 0 becomes version 1.
 * Anything that is not an object, or has an unknown version, is returned unchanged so validation rejects it.
 */
export function migrate(raw: unknown, kind: 'settings' | 'progress'): unknown {
  if (!isRecord(raw)) return raw;
  const version = raw.version ?? 0;
  if (kind === 'settings') return clampAdditionOperand(migrateSettings(raw, version));
  return version === 0 ? migrateProgressV0(raw) : raw;
}

function migrateSettings(raw: Record<string, unknown>, version: unknown): Record<string, unknown> {
  if (version === 0 || version === 1) return migrateSettingsToV6(migrateSettingsToV5(migrateSettingsToV4(migrateSettingsToV3(migrateSettingsToV2(raw)))));
  if (version === 2) return migrateSettingsToV6(migrateSettingsToV5(migrateSettingsToV4(migrateSettingsToV3(raw))));
  if (version === 3) return migrateSettingsToV6(migrateSettingsToV5(migrateSettingsToV4(raw)));
  if (version === 4) return migrateSettingsToV6(migrateSettingsToV5(raw));
  return version === 5 ? migrateSettingsToV6(raw) : raw;
}

/**
 * Review R5: the settings rules now keep `addition.maxOperand` within the range width, as for subtraction. Settings
 * stored before that rule get the operand clamped instead of being reset; anything not a whole number stays as it is,
 * so validation rejects it.
 */
function clampAdditionOperand(raw: Record<string, unknown>): Record<string, unknown> {
  const { range, addition } = raw;
  if (!isRecord(range) || !isRecord(addition)) return raw;
  const { min, max } = range;
  const { maxOperand } = addition;
  if (!Number.isInteger(min) || !Number.isInteger(max) || !Number.isInteger(maxOperand)) return raw;
  const span = (max as number) - (min as number);
  if (span < 1 || (maxOperand as number) <= span) return raw;
  return { ...raw, addition: { ...addition, maxOperand: span } };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Deep merge: values from `over` replace those in `base`; nested objects merge key by key. */
function mergeDeep(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = base[k];
    out[k] = isRecord(b) && isRecord(v) ? mergeDeep(b, v) : v;
  }
  return out;
}

/** Version 1 `labelLevel` to version 2 `rulerLevelStart`: old level 4 showed only the end points, like new level 5. */
const RULER_LEVEL_FROM_LABEL_LEVEL: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 5 };

function migrateSettingsToV2(raw: Record<string, unknown>): Record<string, unknown> {
  const { labelLevel, ...over } = raw;
  delete over.aimCorrection;
  if (labelLevel !== undefined) {
    // An unknown label level is kept as is, so validation rejects the stored settings.
    over.rulerLevelStart = typeof labelLevel === 'number' ? (RULER_LEVEL_FROM_LABEL_LEVEL[labelLevel] ?? labelLevel) : labelLevel;
    over.rulerLevelMax = 5;
  }
  // Fields added by later versions are left to their own migration step (amendment 06: roundType follows noDamage).
  const base = defaultSettings() as unknown as Record<string, unknown>;
  for (const later of ['roundType', 'showClock', 'showRecords', 'garage', 'numberPad']) delete base[later];
  const merged = mergeDeep(base, over);
  return { ...merged, version: 2 };
}

/** Version 2 to 3 (amendment 04): adds "Genau treffen", off unless already set. */
function migrateSettingsToV3(raw: Record<string, unknown>): Record<string, unknown> {
  return { ...raw, exactHit: raw.exactHit ?? false, version: 3 };
}

/**
 * Version 3 to 4 (amendment 06): drops "Genau treffen"; the round ends when the hearts are gone, or after the old
 * turn count as a number of enemies when the no-damage mode is on (the hearts would never go down).
 * A whole-number `roundLength` is clamped to 1 to 20; anything else is kept so validation rejects it.
 */
function migrateSettingsToV4(raw: Record<string, unknown>): Record<string, unknown> {
  const { exactHit: _dropped, ...rest } = raw;
  void _dropped;
  const roundLength = Number.isInteger(rest.roundLength)
    ? Math.min(ROUND_LENGTH_MAX, Math.max(ROUND_LENGTH_MIN, rest.roundLength as number))
    : rest.roundLength;
  return {
    ...rest,
    roundType: rest.roundType ?? (rest.noDamage === true ? 'enemyCount' : 'untilHearts'),
    roundLength,
    showClock: rest.showClock ?? false,
    showRecords: rest.showRecords ?? true,
    version: 4,
  };
}

/** Version 4 to 5 (amendment 11): adds "Garage und Sterne", on unless already set. */
function migrateSettingsToV5(raw: Record<string, unknown>): Record<string, unknown> {
  return { ...raw, garage: raw.garage ?? true, version: 5 };
}

/** Version 5 to 6 (amendment 12): adds "Zahlenfeld", automatic unless already set. */
function migrateSettingsToV6(raw: Record<string, unknown>): Record<string, unknown> {
  return { ...raw, numberPad: raw.numberPad ?? 'auto', version: 6 };
}

function migrateProgressV0(raw: Record<string, unknown>): Record<string, unknown> {
  const skills: Record<string, unknown> = {};
  if (isRecord(raw.skills)) {
    for (const [key, sp] of Object.entries(raw.skills)) {
      skills[key] = isRecord(sp) ? { masteryWindow: [], ...sp } : sp;
    }
  }
  return {
    attempts: [],
    sessions: [],
    ...raw,
    skills,
    version: 1,
  };
}
