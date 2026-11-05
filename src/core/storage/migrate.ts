import { defaultSettings } from '../settings/defaults';

/**
 * Upgrades older stored versions to the current one before schema validation (research R11).
 * Settings: version 0 is any object with `version: 0` or no `version` field; versions 0 and 1 become
 * version 2 (decision D13: `aimCorrection` dropped, `labelLevel` turned into `rulerLevelStart` and
 * `rulerLevelMax`), with missing fields filled from the defaults. Progress: version 0 becomes version 1.
 * Anything that is not an object, or has an unknown version, is returned unchanged so validation rejects it.
 */
export function migrate(raw: unknown, kind: 'settings' | 'progress'): unknown {
  if (!isRecord(raw)) return raw;
  const version = raw.version ?? 0;
  if (kind === 'settings') return version === 0 || version === 1 ? migrateSettingsToV2(raw) : raw;
  return version === 0 ? migrateProgressV0(raw) : raw;
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
  const merged = mergeDeep(defaultSettings() as unknown as Record<string, unknown>, over);
  return { ...merged, version: 2 };
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
