/**
 * Browser persistence for settings, progress, personal bests and the garage (FR-048, FR-048a, FR-086, FR-089,
 * FR-096, research R11). The garage (stars and the chosen look, amendment 11) has its own key, so saving an empty
 * progress ("Fortschritt zurücksetzen") never touches it.
 *
 * Loads them once, saves settings on request, asks the browser once to keep stored data permanently, and reports
 * what the settings page must show: why stored data was reset (`resetReason`) and whether the last save failed
 * (edge cases "Stored data is missing or damaged" and "Browser storage full or blocked").
 */
import type { Settings } from '../core/settings/schema';
import { exportData, importData, type ImportResult } from '../core/storage/exportImport';
import { localStorageKeyValue, type KeyValue } from '../core/storage/keyValue';
import { loadGarage, loadProgress, loadRecords, loadSettings, saveGarage, saveProgress, saveRecords, saveSettings, type ResetReason } from '../core/storage/storage';
import { addStars, equip, resetStars, type Garage } from '../core/rewards/garage';
import type { GarageItem } from '../core/rewards/items';
import { submitResult, type BestResult, type Records } from '../core/records/records';
import type { Progress } from '../core/types';

/** The part of `navigator.storage` this module uses. */
export interface StorageManagerLike {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
}

/** Result of asking the browser to keep stored data; 'notAsked' until the request runs. */
export type PersistOutcome = 'notAsked' | 'granted' | 'denied' | 'unsupported' | 'failed';

export interface PersistenceStatus {
  /** The worst of the settings, progress, records and garage load results: 'unavailable' before 'invalid' before 'none'. */
  resetReason: ResetReason;
  /** True when the latest save could not be written; the values still apply for this session. */
  saveFailed: boolean;
  persistent: PersistOutcome;
}

export interface Persistence {
  settings(): Settings;
  progress(): Progress;
  /** Personal bests (amendment 06, FR-086). */
  records(): Records;
  status(): PersistenceStatus;
  saveSettings(s: Settings): { ok: boolean };
  saveProgress(p: Progress): { ok: boolean };
  /**
   * Compares a finished round with the best for `key` (recordKey of the round's settings); a new record is stored
   * at once. Returns whether it is a new record and the best after it (FR-086).
   */
  submitResult(key: string, result: BestResult): { newRecord: boolean; best: BestResult | null };
  /** Stars and the chosen look (amendment 11). */
  garage(): Garage;
  /** Adds stars for destroyed enemies, saves at once and returns the items they unlocked (FR-089). */
  addStars(n: number): GarageItem[];
  /** Chooses an unlocked item and saves; a locked or unknown id changes nothing (FR-091). */
  equip(id: string): void;
  /** "Sterne zurücksetzen": 0 stars, every item locked, the standard look (FR-096). */
  resetStars(): void;
  /** Calls `persist()` at most once per instance; later calls return the first result. */
  requestPersistentStorage(): Promise<Exclude<PersistOutcome, 'notAsked'>>;
  /** "Daten sichern": the export file text for the current settings, progress, records and garage. */
  exportText(now?: Date): string;
  /**
   * "Daten laden": on success replaces and saves settings, progress, records and, when the file has one, the garage;
   * on failure changes nothing.
   */
  importText(text: string): ImportResult;
}

export interface PersistenceDeps {
  kv?: KeyValue;
  /** Defaults to `navigator.storage` when the key is absent; pass undefined for a browser without it. */
  storage?: StorageManagerLike;
}

const RESET_ORDER: ResetReason[] = ['none', 'invalid', 'unavailable'];

function worse(a: ResetReason, b: ResetReason): ResetReason {
  return RESET_ORDER.indexOf(a) >= RESET_ORDER.indexOf(b) ? a : b;
}

function browserStorage(): StorageManagerLike | undefined {
  return typeof navigator === 'undefined' ? undefined : (navigator.storage as StorageManagerLike | undefined);
}

export function createPersistence(deps: PersistenceDeps = {}): Persistence {
  const kv = deps.kv ?? localStorageKeyValue();
  const storage = 'storage' in deps ? deps.storage : browserStorage();

  const loadedSettings = loadSettings(kv);
  const loadedProgress = loadProgress(kv);
  const loadedRecords = loadRecords(kv);
  const loadedGarage = loadGarage(kv);
  let garage = loadedGarage.garage;
  let settings = loadedSettings.settings;
  let progress = loadedProgress.progress;
  let records = loadedRecords.records;
  const resetReason = [loadedProgress, loadedRecords, loadedGarage].reduce((r, l) => worse(r, l.resetReason), loadedSettings.resetReason);
  let saveFailed = false;
  let persistent: PersistOutcome = 'notAsked';
  let request: Promise<Exclude<PersistOutcome, 'notAsked'>> | null = null;

  const record = (r: { ok: boolean }) => {
    saveFailed = !r.ok;
    return r;
  };

  async function ask(): Promise<Exclude<PersistOutcome, 'notAsked'>> {
    if (!storage?.persist) return 'unsupported';
    try {
      if (storage.persisted && (await storage.persisted())) return 'granted';
      return (await storage.persist()) ? 'granted' : 'denied';
    } catch {
      return 'failed';
    }
  }

  return {
    settings: () => settings,
    progress: () => progress,
    records: () => records,
    status: () => ({ resetReason, saveFailed, persistent }),
    saveSettings(s) {
      settings = structuredClone(s);
      return record(saveSettings(kv, settings));
    },
    saveProgress(p) {
      progress = structuredClone(p);
      return record(saveProgress(kv, progress));
    },
    submitResult(key, result) {
      const r = submitResult(records, key, result);
      if (r.newRecord) {
        records = r.records;
        record(saveRecords(kv, records));
      }
      return { newRecord: r.newRecord, best: r.best };
    },
    garage: () => garage,
    addStars(n) {
      const r = addStars(garage, n);
      if (r.garage === garage) return [];
      garage = r.garage;
      record(saveGarage(kv, garage));
      return r.unlocked;
    },
    equip(id) {
      const next = equip(garage, id);
      if (next === garage) return;
      garage = next;
      record(saveGarage(kv, garage));
    },
    resetStars() {
      garage = resetStars();
      record(saveGarage(kv, garage));
    },
    requestPersistentStorage() {
      request ??= ask().then((outcome) => {
        persistent = outcome;
        return outcome;
      });
      return request;
    },
    exportText: (now) => exportData(settings, progress, records, garage, now),
    importText(text) {
      const r = importData(text);
      if (!r.ok) return r;
      settings = r.settings;
      progress = r.progress;
      records = r.records;
      const savedSettings = saveSettings(kv, settings);
      const savedProgress = saveProgress(kv, progress);
      const savedRecords = saveRecords(kv, records);
      // A file without garage data keeps the stars of this browser (FR-096).
      if (r.garage) garage = r.garage;
      const savedGarage = r.garage ? saveGarage(kv, garage) : { ok: true };
      record({ ok: savedSettings.ok && savedProgress.ok && savedRecords.ok && savedGarage.ok });
      return r;
    },
  };
}
