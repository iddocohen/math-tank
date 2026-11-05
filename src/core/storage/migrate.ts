import { defaultSettings } from '../settings/defaults';

/**
 * Upgrades older stored versions to the current one before schema validation (research R11).
 * Version 0 is any object with `version: 0` or no `version` field: fields added in version 1
 * are filled from the defaults. Anything that is not an object, or has an unknown version,
 * is returned unchanged so validation rejects it.
 */
export function migrate(raw: unknown, kind: 'settings' | 'progress'): unknown {
  if (!isRecord(raw)) return raw;
  const version = raw.version ?? 0;
  if (version !== 0) return raw;
  return kind === 'settings' ? migrateSettingsV0(raw) : migrateProgressV0(raw);
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

function migrateSettingsV0(raw: Record<string, unknown>): Record<string, unknown> {
  const merged = mergeDeep(defaultSettings() as unknown as Record<string, unknown>, raw);
  return { ...merged, version: 1 };
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
