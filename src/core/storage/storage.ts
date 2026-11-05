import { defaultSettings } from '../settings/defaults';
import { settingsSchema, type Settings } from '../settings/schema';
import { validateSettings } from '../settings/validate';
import type { Progress } from '../types';
import type { KeyValue } from './keyValue';
import { migrate } from './migrate';
import { progressSchema } from './progressSchema';

/** Storage keys (research R11). */
export const SETTINGS_KEY = 'mathtanks.settings.v1';
export const PROGRESS_KEY = 'mathtanks.progress.v1';

export type ResetReason = 'none' | 'invalid' | 'unavailable';

export function emptyProgress(): Progress {
  return { version: 1, attempts: [], skills: {}, sessions: [] };
}

type ReadResult = { kind: 'missing' } | { kind: 'unavailable' } | { kind: 'text'; text: string };

function read(kv: KeyValue, key: string): ReadResult {
  try {
    const text = kv.get(key);
    return text === null ? { kind: 'missing' } : { kind: 'text', text };
  } catch {
    return { kind: 'unavailable' };
  }
}

function write(kv: KeyValue, key: string, value: unknown): { ok: boolean } {
  try {
    kv.set(key, JSON.stringify(value));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

/** Loads settings; damaged, invalid or unreadable data falls back to defaults (FR-048). */
export function loadSettings(kv: KeyValue): { settings: Settings; resetReason: ResetReason } {
  const r = read(kv, SETTINGS_KEY);
  if (r.kind === 'missing') return { settings: defaultSettings(), resetReason: 'none' };
  if (r.kind === 'unavailable') return { settings: defaultSettings(), resetReason: 'unavailable' };
  const json = parseJson(r.text);
  if (!json.ok) return { settings: defaultSettings(), resetReason: 'invalid' };
  const parsed = settingsSchema.safeParse(migrate(json.value, 'settings'));
  if (!parsed.success || !validateSettings(parsed.data).ok) {
    return { settings: defaultSettings(), resetReason: 'invalid' };
  }
  return { settings: parsed.data, resetReason: 'none' };
}

export function saveSettings(kv: KeyValue, s: Settings): { ok: boolean } {
  return write(kv, SETTINGS_KEY, s);
}

/** Loads progress; damaged, invalid or unreadable data falls back to empty progress (FR-048). */
export function loadProgress(kv: KeyValue): { progress: Progress; resetReason: ResetReason } {
  const r = read(kv, PROGRESS_KEY);
  if (r.kind === 'missing') return { progress: emptyProgress(), resetReason: 'none' };
  if (r.kind === 'unavailable') return { progress: emptyProgress(), resetReason: 'unavailable' };
  const json = parseJson(r.text);
  if (!json.ok) return { progress: emptyProgress(), resetReason: 'invalid' };
  const parsed = progressSchema.safeParse(migrate(json.value, 'progress'));
  if (!parsed.success) return { progress: emptyProgress(), resetReason: 'invalid' };
  return { progress: parsed.data, resetReason: 'none' };
}

export function saveProgress(kv: KeyValue, p: Progress): { ok: boolean } {
  return write(kv, PROGRESS_KEY, p);
}
