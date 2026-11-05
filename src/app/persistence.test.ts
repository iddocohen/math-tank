import { describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../core/settings/defaults';
import type { Settings } from '../core/settings/schema';
import { exportData } from '../core/storage/exportImport';
import { memoryKeyValue, type KeyValue } from '../core/storage/keyValue';
import { emptyProgress, PROGRESS_KEY, SETTINGS_KEY } from '../core/storage/storage';
import { createPersistence, type StorageManagerLike } from './persistence';

function changedSettings(): Settings {
  return { ...defaultSettings(), range: { preset: '0-20', min: 0, max: 20 }, addition: { maxOperand: 10, maxResult: 20, steps: 1 }, enemyDifficulty: 'normal', rulerLevelStart: 3 };
}

function storageManager(persisted: boolean, grant: boolean): StorageManagerLike & { persist: ReturnType<typeof vi.fn> } {
  return {
    persisted: vi.fn(() => Promise.resolve(persisted)),
    persist: vi.fn(() => Promise.resolve(grant)),
  };
}

/** A key-value store whose writes fail, as when browser storage is full or blocked. */
function failingWrites(kv: KeyValue): KeyValue {
  return {
    get: (key) => kv.get(key),
    set: () => {
      throw new DOMException('quota', 'QuotaExceededError');
    },
  };
}

describe('createPersistence (FR-048)', () => {
  it('starts with defaults and resetReason none when nothing is stored', () => {
    const p = createPersistence({ kv: memoryKeyValue(), storage: undefined });
    expect(p.settings()).toEqual(defaultSettings());
    expect(p.progress()).toEqual(emptyProgress());
    expect(p.status()).toEqual({ resetReason: 'none', saveFailed: false, persistent: 'notAsked' });
  });

  it('saves settings so a new instance on the same store loads them', () => {
    const kv = memoryKeyValue();
    const first = createPersistence({ kv, storage: undefined });
    expect(first.saveSettings(changedSettings())).toEqual({ ok: true });
    expect(first.settings()).toEqual(changedSettings());
    expect(JSON.parse(kv.get(SETTINGS_KEY) ?? 'null')).toEqual(changedSettings());
    expect(createPersistence({ kv, storage: undefined }).settings()).toEqual(changedSettings());
  });

  it('reports resetReason invalid for damaged settings or progress, so the settings page can show it', () => {
    expect(createPersistence({ kv: memoryKeyValue({ [SETTINGS_KEY]: '{oops' }), storage: undefined }).status().resetReason).toBe('invalid');
    expect(createPersistence({ kv: memoryKeyValue({ [PROGRESS_KEY]: '[]' }), storage: undefined }).status().resetReason).toBe('invalid');
  });

  it('reports resetReason unavailable when storage cannot be read', () => {
    const blocked: KeyValue = {
      get: () => {
        throw new Error('blocked');
      },
      set: () => {
        throw new Error('blocked');
      },
    };
    const p = createPersistence({ kv: blocked, storage: undefined });
    expect(p.settings()).toEqual(defaultSettings());
    expect(p.status().resetReason).toBe('unavailable');
  });

  it('reports a failed save and keeps the new settings for this session', () => {
    const p = createPersistence({ kv: failingWrites(memoryKeyValue()), storage: undefined });
    expect(p.saveSettings(changedSettings())).toEqual({ ok: false });
    expect(p.status().saveFailed).toBe(true);
    expect(p.settings()).toEqual(changedSettings());
  });

  it('clears the save failure after a later save works', () => {
    let fail = true;
    const inner = memoryKeyValue();
    const kv: KeyValue = {
      get: inner.get,
      set: (k, v) => {
        if (fail) throw new Error('full');
        inner.set(k, v);
      },
    };
    const p = createPersistence({ kv, storage: undefined });
    p.saveSettings(changedSettings());
    fail = false;
    p.saveSettings(changedSettings());
    expect(p.status().saveFailed).toBe(false);
  });
});

describe('requestPersistentStorage (FR-048)', () => {
  it('asks the browser once to keep stored data, however often it is called', async () => {
    const storage = storageManager(false, true);
    const p = createPersistence({ kv: memoryKeyValue(), storage });
    const [a, b] = await Promise.all([p.requestPersistentStorage(), p.requestPersistentStorage()]);
    await p.requestPersistentStorage();
    expect(a).toBe('granted');
    expect(b).toBe('granted');
    expect(storage.persist).toHaveBeenCalledTimes(1);
    expect(p.status().persistent).toBe('granted');
  });

  it('does not ask again when the data is already kept', async () => {
    const storage = storageManager(true, false);
    const p = createPersistence({ kv: memoryKeyValue(), storage });
    expect(await p.requestPersistentStorage()).toBe('granted');
    expect(storage.persist).not.toHaveBeenCalled();
  });

  it('reports denied, unsupported and failed', async () => {
    expect(await createPersistence({ kv: memoryKeyValue(), storage: storageManager(false, false) }).requestPersistentStorage()).toBe('denied');
    expect(await createPersistence({ kv: memoryKeyValue(), storage: undefined }).requestPersistentStorage()).toBe('unsupported');
    expect(await createPersistence({ kv: memoryKeyValue(), storage: {} }).requestPersistentStorage()).toBe('unsupported');
    const throwing: StorageManagerLike = { persist: () => Promise.reject(new Error('no')) };
    expect(await createPersistence({ kv: memoryKeyValue(), storage: throwing }).requestPersistentStorage()).toBe('failed');
  });
});

describe('export and import through persistence (FR-048a)', () => {
  it('exports the current settings and progress', () => {
    const p = createPersistence({ kv: memoryKeyValue(), storage: undefined });
    p.saveSettings(changedSettings());
    const file = JSON.parse(p.exportText(new Date('2026-11-05T00:00:00.000Z'))) as Record<string, unknown>;
    expect(file).toEqual({ app: 'math-tanks', exportedAt: '2026-11-05T00:00:00.000Z', settings: changedSettings(), progress: emptyProgress() });
  });

  it('a valid import replaces and saves settings and progress', () => {
    const kv = memoryKeyValue();
    const p = createPersistence({ kv, storage: undefined });
    const r = p.importText(exportData(changedSettings(), emptyProgress()));
    expect(r.ok).toBe(true);
    expect(p.settings()).toEqual(changedSettings());
    expect(createPersistence({ kv, storage: undefined }).settings()).toEqual(changedSettings());
  });

  it('a failed import changes nothing', () => {
    const kv = memoryKeyValue();
    const p = createPersistence({ kv, storage: undefined });
    p.saveSettings(changedSettings());
    const stored = kv.get(SETTINGS_KEY);
    expect(p.importText('{"app":"other"}')).toEqual({ ok: false, reason: 'wrongApp' });
    expect(p.settings()).toEqual(changedSettings());
    expect(kv.get(SETTINGS_KEY)).toBe(stored);
  });
});
