import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import type { Progress } from '../types';
import { emptyRecords, recordsSchema, type Records } from '../records/records';
import { emptyGarage, parseGarage, type Garage } from '../rewards/garage';
import type { KeyValue } from './keyValue';
import { migrate, parseSettings } from './migrate';
import { progressSchema } from './progressSchema';

/** Storage keys (research R11). */
export const SETTINGS_KEY = 'mathtanks.settings.v1';
export const PROGRESS_KEY = 'mathtanks.progress.v1';
/** Personal bests (amendment 06, FR-086). */
export const RECORDS_KEY = 'mathtanks.records.v1';
/** Stars and the chosen look (amendment 11, FR-097); apart from progress, so a progress reset never touches them. */
export const GARAGE_KEY = 'mathtanks.garage.v1';

/**
 * Why loaded data was replaced by its defaults: 'invalid' for damaged or invalid data, 'newer' for data written by a
 * newer version of the game (another tab or a later visit, review M2), 'unavailable' when storage cannot be read.
 */
export type ResetReason = 'none' | 'invalid' | 'newer' | 'unavailable';

/** Where persistence keeps a copy of stored data that could not be read, before anything is saved over it (review M2). */
export function unreadableKey(key: string): string {
  return `${key}.unreadable`;
}

/** True when `value` carries a version number above the one this game writes. */
function isNewer(value: unknown, current: number): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const version = (value as Record<string, unknown>).version;
  return typeof version === 'number' && version > current;
}

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

/** Loads settings; damaged, invalid, newer or unreadable data falls back to defaults (FR-048). */
export function loadSettings(kv: KeyValue): { settings: Settings; resetReason: ResetReason } {
  const r = read(kv, SETTINGS_KEY);
  if (r.kind === 'missing') return { settings: defaultSettings(), resetReason: 'none' };
  if (r.kind === 'unavailable') return { settings: defaultSettings(), resetReason: 'unavailable' };
  const json = parseJson(r.text);
  if (!json.ok) return { settings: defaultSettings(), resetReason: 'invalid' };
  if (isNewer(json.value, defaultSettings().version)) return { settings: defaultSettings(), resetReason: 'newer' };
  const settings = parseSettings(json.value);
  return settings ? { settings, resetReason: 'none' } : { settings: defaultSettings(), resetReason: 'invalid' };
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
  if (isNewer(json.value, emptyProgress().version)) return { progress: emptyProgress(), resetReason: 'newer' };
  const parsed = progressSchema.safeParse(migrate(json.value, 'progress'));
  if (!parsed.success) return { progress: emptyProgress(), resetReason: 'invalid' };
  return { progress: parsed.data, resetReason: 'none' };
}

export function saveProgress(kv: KeyValue, p: Progress): { ok: boolean } {
  return write(kv, PROGRESS_KEY, p);
}

/** Loads personal bests; damaged, invalid or unreadable data falls back to empty records (FR-048, FR-086). */
export function loadRecords(kv: KeyValue): { records: Records; resetReason: ResetReason } {
  const r = read(kv, RECORDS_KEY);
  if (r.kind === 'missing') return { records: emptyRecords(), resetReason: 'none' };
  if (r.kind === 'unavailable') return { records: emptyRecords(), resetReason: 'unavailable' };
  const json = parseJson(r.text);
  if (!json.ok) return { records: emptyRecords(), resetReason: 'invalid' };
  if (isNewer(json.value, emptyRecords().version)) return { records: emptyRecords(), resetReason: 'newer' };
  const parsed = recordsSchema.safeParse(json.value);
  if (!parsed.success) return { records: emptyRecords(), resetReason: 'invalid' };
  return { records: parsed.data, resetReason: 'none' };
}

export function saveRecords(kv: KeyValue, r: Records): { ok: boolean } {
  return write(kv, RECORDS_KEY, r);
}

/**
 * Loads the garage (balance, owned items, equipped look, total ever earned); damaged, invalid or unreadable data falls
 * back to an empty garage (FR-097). Versions 0 and 1 are migrated to version 2 (FR-133); an owned id that is unknown
 * is dropped and a look part that is not owned becomes the basic item.
 */
export function loadGarage(kv: KeyValue): { garage: Garage; resetReason: ResetReason } {
  const r = read(kv, GARAGE_KEY);
  if (r.kind === 'missing') return { garage: emptyGarage(), resetReason: 'none' };
  if (r.kind === 'unavailable') return { garage: emptyGarage(), resetReason: 'unavailable' };
  const json = parseJson(r.text);
  if (!json.ok) return { garage: emptyGarage(), resetReason: 'invalid' };
  if (isNewer(json.value, emptyGarage().version)) return { garage: emptyGarage(), resetReason: 'newer' };
  const garage = parseGarage(json.value);
  return garage ? { garage, resetReason: 'none' } : { garage: emptyGarage(), resetReason: 'invalid' };
}

export function saveGarage(kv: KeyValue, g: Garage): { ok: boolean } {
  return write(kv, GARAGE_KEY, g);
}
