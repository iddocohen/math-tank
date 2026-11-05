/**
 * Browser persistence for settings, progress, personal bests and the garage (FR-048, FR-048a, FR-086, FR-089,
 * FR-096, research R11). The garage (stars and the chosen look, amendment 11) has its own key, so saving an empty
 * progress ("Fortschritt zurücksetzen") never touches it.
 *
 * Amendment 15 (FR-115, FR-119): `saveData` feeds the transfer link and `applyTransfer` takes over a transferred save.
 *
 * Loads them once, saves settings on request, asks the browser once to keep stored data permanently, and reports
 * what the settings page must show: why stored data was reset (`resetReason`) and which data could not be saved
 * (edge cases "Stored data is missing or damaged" and "Browser storage full or blocked"). A failed save is kept per
 * kind of data until that data saves again (review H2), so a failure during play still shows on the settings page and
 * as a small note on the start screen (review H1).
 */
import type { Settings } from '../core/settings/schema';
import { exportData, importData, type ImportResult } from '../core/storage/exportImport';
import { localStorageKeyValue, type KeyValue } from '../core/storage/keyValue';
import { loadGarage, loadProgress, loadRecords, loadSettings, saveGarage, saveProgress, saveRecords, saveSettings, type ResetReason } from '../core/storage/storage';
import { addStars, equip, resetStars, type Garage } from '../core/rewards/garage';
import type { GarageItem } from '../core/rewards/items';
import { submitResult, type BestResult, type Records } from '../core/records/records';
import type { Progress } from '../core/types';
import type { SaveData } from '../core/transfer/transfer';

/** The part of `navigator.storage` this module uses. */
export interface StorageManagerLike {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
}

/** Result of asking the browser to keep stored data; 'notAsked' until the request runs. */
export type PersistOutcome = 'notAsked' | 'granted' | 'denied' | 'unsupported' | 'failed';

/** The four kinds of stored data, each under its own key. */
export type DataKind = 'settings' | 'progress' | 'records' | 'garage';

export interface PersistenceStatus {
  /** The worst of the settings, progress, records and garage load results: 'unavailable' before 'invalid' before 'none'. */
  resetReason: ResetReason;
  /**
   * True while the latest save of any kind of data failed (review H1, H2). A failure stays until that same kind of
   * data saves again, so a later working save of other data does not hide it. The values still apply for this session.
   */
  saveFailed: boolean;
  /** The kinds of data whose latest save failed, in the order settings, progress, records, garage. */
  failedData: DataKind[];
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
  /** The current settings, progress, records and garage, for the transfer link (amendment 15, FR-115). */
  saveData(): SaveData;
  /**
   * "Übernehmen" of a transferred save (FR-119): replaces and saves settings, progress, records and garage. The data
   * was checked by decodeTransfer; its progress has no attempt history.
   */
  applyTransfer(data: SaveData): { ok: boolean };
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
  const failed = new Set<DataKind>();
  const DATA_ORDER: DataKind[] = ['settings', 'progress', 'records', 'garage'];
  let persistent: PersistOutcome = 'notAsked';
  let request: Promise<Exclude<PersistOutcome, 'notAsked'>> | null = null;

  /** Notes the result of saving one kind of data. */
  const record = (kind: DataKind, r: { ok: boolean }) => {
    if (r.ok) failed.delete(kind);
    else failed.add(kind);
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
    status: () => ({ resetReason, saveFailed: failed.size > 0, failedData: DATA_ORDER.filter((k) => failed.has(k)), persistent }),
    saveSettings(s) {
      settings = structuredClone(s);
      return record('settings', saveSettings(kv, settings));
    },
    saveProgress(p) {
      progress = structuredClone(p);
      return record('progress', saveProgress(kv, progress));
    },
    submitResult(key, result) {
      const r = submitResult(records, key, result);
      if (r.newRecord) {
        records = r.records;
        record('records', saveRecords(kv, records));
      }
      return { newRecord: r.newRecord, best: r.best };
    },
    garage: () => garage,
    addStars(n) {
      const r = addStars(garage, n);
      if (r.garage === garage) return [];
      garage = r.garage;
      record('garage', saveGarage(kv, garage));
      return r.unlocked;
    },
    equip(id) {
      const next = equip(garage, id);
      if (next === garage) return;
      garage = next;
      record('garage', saveGarage(kv, garage));
    },
    resetStars() {
      garage = resetStars();
      record('garage', saveGarage(kv, garage));
    },
    requestPersistentStorage() {
      request ??= ask().then((outcome) => {
        persistent = outcome;
        return outcome;
      });
      return request;
    },
    exportText: (now) => exportData(settings, progress, records, garage, now),
    saveData: () => ({ settings, progress, records, garage }),
    applyTransfer(data) {
      settings = structuredClone(data.settings);
      progress = structuredClone(data.progress);
      records = structuredClone(data.records);
      garage = structuredClone(data.garage);
      const results = [
        record('settings', saveSettings(kv, settings)),
        record('progress', saveProgress(kv, progress)),
        record('records', saveRecords(kv, records)),
        record('garage', saveGarage(kv, garage)),
      ];
      return { ok: results.every((r) => r.ok) };
    },
    importText(text) {
      const r = importData(text);
      if (!r.ok) return r;
      settings = r.settings;
      progress = r.progress;
      records = r.records;
      record('settings', saveSettings(kv, settings));
      record('progress', saveProgress(kv, progress));
      record('records', saveRecords(kv, records));
      // A file without garage data keeps the stars of this browser (FR-096).
      if (r.garage) {
        garage = r.garage;
        record('garage', saveGarage(kv, garage));
      }
      return r;
    },
  };
}
