import { settingsSchema, type Settings } from '../settings/schema';
import { validateSettings } from '../settings/validate';
import type { Progress } from '../types';
import { migrate } from './migrate';
import { progressSchema } from './progressSchema';
import { emptyRecords, recordsSchema, type Records } from '../records/records';
import { parseGarage, type Garage } from '../rewards/garage';

/** Marks an export file as ours (data-model.md "Export file"). */
export const EXPORT_APP = 'math-tanks';

/**
 * Why an import was refused; the settings page maps each reason to a German message. `notSaved` comes only from
 * persistence: the file was valid, but storing it failed and nothing was changed (review M4).
 */
export type ImportFailure = 'notJson' | 'wrongApp' | 'invalidSettings' | 'invalidProgress' | 'invalidRecords' | 'invalidGarage' | 'notSaved';

/** `garage` is null for a file exported before amendment 11; the caller then keeps its own stars (FR-096). */
export type ImportResult =
  | { ok: true; settings: Settings; progress: Progress; records: Records; garage: Garage | null }
  | { ok: false; reason: ImportFailure };

/** JSON text of `{ app, exportedAt, settings, progress, records, garage }` for the "Daten sichern" download (FR-048a, FR-086, FR-096). */
export function exportData(settings: Settings, progress: Progress, records: Records, garage: Garage, now: Date = new Date()): string {
  return JSON.stringify({ app: EXPORT_APP, exportedAt: now.toISOString(), settings, progress, records, garage }, null, 2);
}

/**
 * Reads an export file with the same migrations, schemas and settings rules as loading from storage
 * (FR-048, FR-048a). It returns new objects and stores nothing; the caller saves them only when `ok` is true.
 */
export function importData(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, reason: 'notJson' };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, reason: 'notJson' };
  const file = raw as Record<string, unknown>;
  if (file.app !== EXPORT_APP) return { ok: false, reason: 'wrongApp' };

  const settings = settingsSchema.safeParse(migrate(file.settings, 'settings'));
  if (!settings.success || !validateSettings(settings.data).ok) return { ok: false, reason: 'invalidSettings' };

  const progress = progressSchema.safeParse(migrate(file.progress, 'progress'));
  if (!progress.success) return { ok: false, reason: 'invalidProgress' };

  // A file exported before amendment 06 has no records; it imports with empty records.
  let records = emptyRecords();
  if (file.records !== undefined) {
    const parsed = recordsSchema.safeParse(file.records);
    if (!parsed.success) return { ok: false, reason: 'invalidRecords' };
    records = parsed.data;
  }

  // A file exported before amendment 11 has no garage; the stars of this browser stay (FR-096).
  let garage: Garage | null = null;
  if (file.garage !== undefined) {
    garage = parseGarage(file.garage);
    if (garage === null) return { ok: false, reason: 'invalidGarage' };
  }

  return { ok: true, settings: settings.data, progress: progress.data, records, garage };
}
