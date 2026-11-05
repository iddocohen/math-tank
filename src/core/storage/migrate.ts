import { defaultSettings, ROUND_LENGTH_MAX, ROUND_LENGTH_MIN } from '../settings/defaults';
import { settingsSchema, type Settings } from '../settings/schema';
import { clamp, isRecord, mergeDeep } from '../util';
import { validateSettings } from '../settings/validate';

/**
 * Settings from storage, an export file or a transfer code (review T4): migrated to the current version, checked by
 * the schema and by every settings rule. Null when anything fails; the caller decides what that means.
 */
export function parseSettings(raw: unknown): Settings | null {
  const parsed = settingsSchema.safeParse(migrate(raw, 'settings'));
  return parsed.success && validateSettings(parsed.data).ok ? parsed.data : null;
}

/**
 * Upgrades older stored versions to the current one before schema validation (research R11).
 * Settings: version 0 is any object with `version: 0` or no `version` field; versions 0 and 1 become
 * version 2 (decision D13: `aimCorrection` dropped, `labelLevel` turned into `rulerLevelStart` and
 * `rulerLevelMax`), with missing fields filled from the defaults. Version 2 becomes version 3 (amendment 04:
 * `exactHit` added, default false). Version 3 becomes version 4 (amendment 06: `exactHit` dropped, `roundType`,
 * `showClock` and `showRecords` added, `roundLength` clamped to 1 to 20 enemies). Version 4 becomes version 5
 * (amendment 11: `garage` added, default true). Version 5 becomes version 6 (amendment 12: `numberPad` added, default
 * 'auto'). Version 6 becomes version 7 (PO1: "Vorlesen" turned off once). Version 7 becomes version 8 (amendment 17: `freePlay`
 * becomes `playModes`). Older versions go through every later step. Every settings version then gets `addition.maxOperand`
 * clamped to the range width (review R5). Progress: version 0 becomes version 1.
 * Anything that is not an object, or has an unknown version, is returned unchanged so validation rejects it.
 */
export function migrate(raw: unknown, kind: 'settings' | 'progress'): unknown {
  if (!isRecord(raw)) return raw;
  const version = raw.version ?? 0;
  if (kind === 'settings') return clampAdditionOperand(migrateSettings(raw, version));
  return version === 0 ? migrateProgressV0(raw) : raw;
}

/** Each step upgrades one version; older settings go through every later step in order. */
const SETTINGS_STEPS: Array<(raw: Record<string, unknown>) => Record<string, unknown>> = [
  migrateSettingsToV2, // from 0 and 1
  migrateSettingsToV3,
  migrateSettingsToV4,
  migrateSettingsToV5,
  migrateSettingsToV6,
  migrateSettingsToV7,
  migrateSettingsToV8,
];

function migrateSettings(raw: Record<string, unknown>, version: unknown): Record<string, unknown> {
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) return raw;
  // Step i turns version i + 1 into version i + 2; versions 0 and 1 both start at the first step.
  const first = Math.max(0, version - 1);
  return SETTINGS_STEPS.slice(first).reduce((r, step) => step(r), raw);
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

/**
 * Version 2 to 3 (amendment 04): version 3 added "Genau treffen" (`exactHit`), which version 4 drops again, so this step
 * only raises the version. It stays a step of its own, so SETTINGS_STEPS keeps one step per version.
 */
function migrateSettingsToV3(raw: Record<string, unknown>): Record<string, unknown> {
  return { ...raw, version: 3 };
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
    ? clamp(rest.roundLength as number, ROUND_LENGTH_MIN, ROUND_LENGTH_MAX)
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

/**
 * Version 6 to 7 (PO1, "I do not want a sound of reading the question out loud"): "Vorlesen" is now off by default,
 * and stored settings get it turned off once; a parent who turns it on again keeps it on, because version 7 settings
 * are not migrated.
 */
function migrateSettingsToV7(raw: Record<string, unknown>): Record<string, unknown> {
  const sound = isRecord(raw.sound) ? { ...raw.sound, speech: false } : raw.sound;
  return { ...raw, sound, version: 7 };
}

/**
 * Version 7 to 8 (amendment 17): `freePlay` becomes `playModes`. A parent who offered only free play (free play on and
 * every challenge type off) gets only "Nur Zahlenstrahl"; all other settings offer all three modes, the new default.
 */
function migrateSettingsToV8(raw: Record<string, unknown>): Record<string, unknown> {
  const { freePlay, ...rest } = raw;
  const types = isRecord(raw.challengeTypes) ? Object.values(raw.challengeTypes) : [];
  const onlyFreePlay = freePlay === true && types.length > 0 && !types.some((v) => v === true);
  const playModes = onlyFreePlay ? { mixed: false, ruler: true, math: false } : { mixed: true, ruler: true, math: true };
  return { ...rest, playModes, version: 8 };
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
