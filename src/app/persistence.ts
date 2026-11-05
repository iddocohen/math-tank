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
import {
  GARAGE_KEY,
  loadGarage,
  loadProgress,
  loadRecords,
  loadSettings,
  PROGRESS_KEY,
  RECORDS_KEY,
  SETTINGS_KEY,
  unreadableKey,
  type ResetReason,
} from '../core/storage/storage';
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
  /** The worst of the settings, progress, records and garage load results: 'unavailable', 'newer', 'invalid', 'none'. */
  resetReason: ResetReason;
  /** The kinds of data that could not be read and now hold their defaults (review M3). */
  resetData: DataKind[];
  /** The kinds of data written by a newer version of the game; they are never saved over in this session (review M2). */
  newerData: DataKind[];
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
   * on failure changes nothing. All keys are written or none (review M4): when any write fails, the keys written so far
   * get their old text back and the result is `notSaved`.
   */
  importText(text: string): ImportResult;
  /** The current settings, progress, records and garage, for the transfer link (amendment 15, FR-115). */
  saveData(): SaveData;
  /**
   * "Übernehmen" of a transferred save (FR-119): replaces and saves settings, progress, records and garage. The data
   * was checked by decodeTransfer; its progress has no attempt history. All or nothing, like `importText` (review M4).
   */
  applyTransfer(data: SaveData): { ok: boolean };
}

export interface PersistenceDeps {
  kv?: KeyValue;
  /** Defaults to `navigator.storage` when the key is absent; pass undefined for a browser without it. */
  storage?: StorageManagerLike;
}

const RESET_ORDER: ResetReason[] = ['none', 'invalid', 'newer', 'unavailable'];

const DATA_ORDER: DataKind[] = ['settings', 'progress', 'records', 'garage'];

const KEYS: Record<DataKind, string> = { settings: SETTINGS_KEY, progress: PROGRESS_KEY, records: RECORDS_KEY, garage: GARAGE_KEY };

function worse(a: ResetReason, b: ResetReason): ResetReason {
  return RESET_ORDER.indexOf(a) >= RESET_ORDER.indexOf(b) ? a : b;
}

function browserStorage(): StorageManagerLike | undefined {
  return typeof navigator === 'undefined' ? undefined : (navigator.storage as StorageManagerLike | undefined);
}

/** The values of every kind of data, as the session holds them. */
type Values = { settings: Settings; progress: Progress; records: Records; garage: Garage };

export function createPersistence(deps: PersistenceDeps = {}): Persistence {
  const kv = deps.kv ?? localStorageKeyValue();
  const storage = 'storage' in deps ? deps.storage : browserStorage();

  const loaded = {
    settings: loadSettings(kv),
    progress: loadProgress(kv),
    records: loadRecords(kv),
    garage: loadGarage(kv),
  };
  const values: Values = {
    settings: loaded.settings.settings,
    progress: loaded.progress.progress,
    records: loaded.records.records,
    garage: loaded.garage.garage,
  };
  const reasonOf = (kind: DataKind): ResetReason => loaded[kind].resetReason;
  const resetReason = DATA_ORDER.reduce((r, kind) => worse(r, reasonOf(kind)), 'none' as ResetReason);
  const resetData = DATA_ORDER.filter((kind) => reasonOf(kind) === 'invalid' || reasonOf(kind) === 'unavailable');
  const newerData = DATA_ORDER.filter((kind) => reasonOf(kind) === 'newer');

  // Kinds of data that are never saved over in this session: data from a newer version, and damaged data whose copy
  // under `<key>.unreadable` could not be written (review M2).
  const kept = new Set<DataKind>(newerData);
  for (const kind of DATA_ORDER) {
    if (reasonOf(kind) !== 'invalid') continue;
    try {
      const raw = kv.get(KEYS[kind]);
      if (raw !== null) kv.set(unreadableKey(KEYS[kind]), raw);
    } catch {
      kept.add(kind);
    }
  }

  const failed = new Set<DataKind>();
  let persistent: PersistOutcome = 'notAsked';
  let request: Promise<Exclude<PersistOutcome, 'notAsked'>> | null = null;

  /**
   * Saves the given kinds of data, all or none (review M4). On success the session takes the new values; when any
   * write fails or a kind is kept, the keys written so far get their old text back and nothing changes.
   */
  function save(next: Partial<Values>): { ok: boolean } {
    const kinds = DATA_ORDER.filter((kind) => next[kind] !== undefined);
    const fail = () => {
      for (const kind of kinds) failed.add(kind);
      return { ok: false };
    };
    if (kinds.some((kind) => kept.has(kind))) return fail();
    // Only a save of several kinds can need a rollback, so only then are the old texts read (E1).
    const rollback = kinds.length > 1;
    const written: Array<{ key: string; old: string | null }> = [];
    try {
      for (const kind of kinds) {
        const key = KEYS[kind];
        const old = rollback ? kv.get(key) : null;
        kv.set(key, JSON.stringify(next[kind]));
        written.push({ key, old });
      }
    } catch {
      for (const { key, old } of written.reverse()) {
        try {
          if (old === null) kv.remove(key);
          else kv.set(key, old);
        } catch {
          // Storage refuses even the old text; the session keeps its old values, and the parent sees the failure.
        }
      }
      return fail();
    }
    Object.assign(values, next);
    for (const kind of kinds) failed.delete(kind);
    return { ok: true };
  }

  /**
   * Saves one kind of data that the session already uses, as during play: the value applies for this session even
   * when the write fails (edge case "Browser storage full or blocked").
   */
  function saveOne<K extends DataKind>(kind: K, value: Values[K]): { ok: boolean } {
    const r = save({ [kind]: value } as Partial<Values>);
    values[kind] = value;
    return r;
  }

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
    settings: () => values.settings,
    progress: () => values.progress,
    records: () => values.records,
    status: () => ({
      resetReason,
      resetData,
      newerData,
      saveFailed: failed.size > 0,
      failedData: DATA_ORDER.filter((kind) => failed.has(kind)),
      persistent,
    }),
    saveSettings: (s) => saveOne('settings', structuredClone(s)),
    // The progress store hands over a new object on every attempt and never changes it afterwards (E1).
    saveProgress: (p) => saveOne('progress', p),
    submitResult(key, result) {
      const r = submitResult(values.records, key, result);
      if (r.newRecord) saveOne('records', r.records);
      return { newRecord: r.newRecord, best: r.best };
    },
    garage: () => values.garage,
    addStars(n) {
      const r = addStars(values.garage, n);
      if (r.garage === values.garage) return [];
      saveOne('garage', r.garage);
      return r.unlocked;
    },
    equip(id) {
      const next = equip(values.garage, id);
      if (next !== values.garage) saveOne('garage', next);
    },
    resetStars() {
      saveOne('garage', resetStars());
    },
    requestPersistentStorage() {
      request ??= ask().then((outcome) => {
        persistent = outcome;
        return outcome;
      });
      return request;
    },
    exportText: (now) => exportData(values.settings, values.progress, values.records, values.garage, now),
    saveData: () => ({ ...values }),
    applyTransfer: (data) => save(structuredClone({ settings: data.settings, progress: data.progress, records: data.records, garage: data.garage })),
    importText(text) {
      const r = importData(text);
      if (!r.ok) return r;
      // A file without garage data keeps the stars of this browser (FR-096).
      const next: Partial<Values> = { settings: r.settings, progress: r.progress, records: r.records };
      if (r.garage) next.garage = r.garage;
      return save(next).ok ? r : { ok: false, reason: 'notSaved' };
    },
  };
}
