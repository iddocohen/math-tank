/**
 * Browser persistence for settings and progress (FR-048, FR-048a, research R11).
 *
 * Loads both once, saves settings on request, asks the browser once to keep stored data permanently, and reports
 * what the settings page must show: why stored data was reset (`resetReason`) and whether the last save failed
 * (edge cases "Stored data is missing or damaged" and "Browser storage full or blocked").
 */
import type { Settings } from '../core/settings/schema';
import { exportData, importData, type ImportResult } from '../core/storage/exportImport';
import { localStorageKeyValue, type KeyValue } from '../core/storage/keyValue';
import { loadProgress, loadSettings, saveProgress, saveSettings, type ResetReason } from '../core/storage/storage';
import type { Progress } from '../core/types';

/** The part of `navigator.storage` this module uses. */
export interface StorageManagerLike {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
}

/** Result of asking the browser to keep stored data; 'notAsked' until the request runs. */
export type PersistOutcome = 'notAsked' | 'granted' | 'denied' | 'unsupported' | 'failed';

export interface PersistenceStatus {
  /** The worse of the settings and progress load results: 'unavailable' before 'invalid' before 'none'. */
  resetReason: ResetReason;
  /** True when the latest save could not be written; the values still apply for this session. */
  saveFailed: boolean;
  persistent: PersistOutcome;
}

export interface Persistence {
  settings(): Settings;
  progress(): Progress;
  status(): PersistenceStatus;
  saveSettings(s: Settings): { ok: boolean };
  saveProgress(p: Progress): { ok: boolean };
  /** Calls `persist()` at most once per instance; later calls return the first result. */
  requestPersistentStorage(): Promise<Exclude<PersistOutcome, 'notAsked'>>;
  /** "Daten sichern": the export file text for the current settings and progress. */
  exportText(now?: Date): string;
  /** "Daten laden": on success replaces and saves settings and progress; on failure changes nothing. */
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
  let settings = loadedSettings.settings;
  let progress = loadedProgress.progress;
  const resetReason = worse(loadedSettings.resetReason, loadedProgress.resetReason);
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
    status: () => ({ resetReason, saveFailed, persistent }),
    saveSettings(s) {
      settings = structuredClone(s);
      return record(saveSettings(kv, settings));
    },
    saveProgress(p) {
      progress = structuredClone(p);
      return record(saveProgress(kv, progress));
    },
    requestPersistentStorage() {
      request ??= ask().then((outcome) => {
        persistent = outcome;
        return outcome;
      });
      return request;
    },
    exportText: (now) => exportData(settings, progress, now),
    importText(text) {
      const r = importData(text);
      if (!r.ok) return r;
      settings = r.settings;
      progress = r.progress;
      const savedSettings = saveSettings(kv, settings);
      const savedProgress = saveProgress(kv, progress);
      record({ ok: savedSettings.ok && savedProgress.ok });
      return r;
    },
  };
}
